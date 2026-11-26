'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const raw = JSON.parse(read('data.json'));
const art = JSON.parse(read('assets/characters/manifest.json'));
const engine = require('../engine.js');
const data = engine.normalize(raw);
const CHAR_COUNT = data.characters.length;
const Q_COUNT = 36;

test('browser scripts and editable JSON remain synchronized', () => {
  const context = {window: {}};
  vm.runInNewContext(read('data.js'), context);
  vm.runInNewContext(read('art.js'), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.JOJO_DATA)), raw);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.JOJO_ART)), art);
});

test('36 Likert questions, expanded cast and 9 dimensions are valid', () => {
  assert.equal(data.questions.length, Q_COUNT);
  assert.equal(data.characters.length, CHAR_COUNT);
  assert.ok(CHAR_COUNT >= 53);
  assert.equal(data.dimensions.length, 9);
  assert.equal(data.parts.length, 9);
  assert.equal(new Set(data.characters.map(c => c.id)).size, CHAR_COUNT);
  assert.equal(new Set(data.questions.map(q => q.id)).size, Q_COUNT);
  assert.equal(raw.meta.version, '1.3.0');
  assert.equal(raw.meta.characterCount, CHAR_COUNT);
  assert.deepEqual(raw.scoring.choiceValues, [-3, -2, -1, 0, 1, 2, 3]);
  assert.ok(Array.isArray(raw.works) && raw.works.length >= 10);
  assert.ok(raw.works.some(w => w.id === 'none'));
  const requiredIds = ['stroheim', 'hol_horse', 'fugo', 'trish', 'anasui', 'emporio', 'kakyoin'];
  for (const id of requiredIds) assert.ok(data.characters.some(c => c.id === id), `missing ${id}`);
  const dimensions = new Set(data.dimensions.map(d => d.id));
  for (const q of data.questions) {
    assert.equal(q.options.length, 7);
    assert.ok(q.text);
    const rawQ = raw.questions.find(rq => rq.id === q.id);
    assert.deepEqual(rawQ.options.map(o => o.scores[rawQ.category]), [3, 2, 1, 0, -1, -2, -3]);
    for (const o of q.options) {
      assert.ok(o.text);
      for (const [id, value] of Object.entries(o.scores)) {
        assert.ok(dimensions.has(id));
        assert.ok(Number.isFinite(value));
      }
    }
  }
  for (const c of data.characters) {
    assert.ok(c.part >= 1 && c.part <= 9);
    assert.ok(c.name && c.summary && c.traits.length && c.strengths.length);
    for (const d of data.dimensions) assert.ok(Number.isFinite(c.vector[d.id]) && c.vector[d.id] >= 0 && c.vector[d.id] <= 100);
  }
});

test('scoring is bounded, deterministic and sorted across 2000 seeded samples', () => {
  let seed = 20261028;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let sample = 0; sample < 2000; sample++) {
    const answers = data.questions.map(q => Math.floor(random() * q.options.length));
    const result = engine.score(answers, data);
    assert.deepEqual(result, engine.score(answers, data));
    assert.equal(result.ranking.length, CHAR_COUNT);
    for (const value of Object.values(result.values)) assert.ok(Number.isFinite(value) && value >= 0 && value <= 100);
    result.ranking.forEach((r, i) => {
      assert.ok(Number.isFinite(r.similarity) && r.similarity >= 0 && r.similarity <= 100);
      if (i) assert.ok(result.ranking[i - 1].distance <= r.distance);
    });
    const c = data.characters.find(c => c.id === result.ranking[0].id);
    assert.equal(engine.reasons(c, result.values, data).length, 3);
  }
});

test('works selection boosts familiar parts without dropping others', () => {
  const answers = data.questions.map(() => 3);
  const base = engine.score(answers, data, {selectedWorks: ['none']});
  const boosted = engine.score(answers, data, {selectedWorks: ['part-3']});
  assert.equal(base.ranking.length, CHAR_COUNT);
  assert.equal(boosted.ranking.length, CHAR_COUNT);
  assert.deepEqual(boosted.familiarParts, [3]);
  const kakyoinBase = base.ranking.find(r => r.id === 'kakyoin');
  const kakyoinBoost = boosted.ranking.find(r => r.id === 'kakyoin');
  assert.ok(kakyoinBoost.distance <= kakyoinBase.distance);
  assert.ok(kakyoinBoost.partMatch);
  const noneOnly = engine.score(answers, data, {selectedWorks: ['none']});
  assert.equal(noneOnly.familiarParts.length, 0);
});

test('invalid answers are rejected and exact ties use character IDs', () => {
  const valid = data.questions.map(() => 0);
  for (const invalid of [null, [], valid.slice(1), [...valid, 0]]) assert.throws(() => engine.score(invalid, data));
  for (const invalid of [null, -1, 7, 0.5, '0', NaN, Infinity]) {
    const answers = valid.slice(); answers[0] = invalid;
    assert.throws(() => engine.score(answers, data));
  }
  const c = data.characters[0];
  const tied = {...data, characters: [{...c, id: 'z'}, {...c, id: 'a'}]};
  assert.deepEqual(engine.score(valid, tied).ranking.map(r => r.id), ['a', 'z']);
});

test('every runtime image is local, present and consistent with rights metadata', () => {
  assert.equal(art.length, CHAR_COUNT);
  assert.equal(new Set(art.map(a => a.id)).size, CHAR_COUNT);
  for (const a of art) {
    assert.ok(data.characters.some(c => c.id === a.id));
    assert.equal(a.rightsUnknown, true);
    assert.match(a.sourcePage, /^https:\/\//);
    if (a.placeholder) {
      assert.equal(a.placeholder, true);
      assert.ok(a.image == null || a.image === '');
      continue;
    }
    for (const name of [a.image, a.thumbnail]) {
      assert.ok(name && !path.isAbsolute(name) && !name.split('/').includes('..'));
      assert.ok(fs.statSync(path.join(root, name)).isFile());
    }
    if (!a.excludedFromDistribution) {
      const bytes = fs.readFileSync(path.join(root, a.image));
      assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
      assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), a.sha256);
    } else {
      assert.equal(a.image, 'assets/placeholder.svg');
      assert.equal(a.thumbnail, 'assets/placeholder.svg');
      assert.ok(a.originalPreviewAsset.image.endsWith('.webp'));
    }
  }
});

test('runtime has no remote asset loading or network submission APIs', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /(?:src|href)=["']https?:/i);
  assert.doesNotMatch(read('styles.css'), /@import|url\(\s*["']?https?:/i);
  assert.doesNotMatch(read('app.js'), /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  for (const file of ['styles.css', 'data.js', 'art.js', 'engine.js', 'app.js']) assert.ok(fs.statSync(path.join(root, file)).isFile());
  assert.match(read('app.js'), /likert/);
  assert.match(read('app.js'), /works/);
  assert.match(read('app.js'), /GROUP_SIZE\s*=\s*3/);
  assert.match(read('app.js'), /group-next/);
  assert.match(read('app.js'), /scrollToNextUnanswered|scrollIntoView/);
  assert.match(read('app.js'), /查看结果/);
  assert.doesNotMatch(read('app.js'), /id="previous-question"|下一题/);
  assert.match(read('styles.css'), /button-group-next/);
  assert.match(read('styles.css'), /quiz-divider/);
});

test('release tree contains no credential files or private workspace metadata', () => {
  const blocked = new Set(['.openai', '.codex', '.agents', '.aws', 'screenshots', 'storage-state.json']);
  const privatePath = new RegExp('/' + '(?:work' + 'space|ho' + 'me|tm' + 'p)/');
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      if (['.git', 'node_modules'].includes(entry.name)) continue;
      assert.ok(!blocked.has(entry.name), `Excluded path found: ${entry.name}`);
      assert.ok(!/^\.env(?:\.|$)/.test(entry.name) && !/\.(?:pem|key)$/.test(entry.name));
      const file = path.join(directory, entry.name);
      assert.ok(!entry.isSymbolicLink(), `No symlinks in release: ${entry.name}`);
      if (entry.isDirectory()) visit(file);
      else if (/\.(?:js|json|html|css)$/.test(entry.name)) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), privatePath);
    }
  }
  visit(root);
});

test('126 profiles have distinct vectors and can rank first on valid answer paths', () => {
  const ids = new Set(data.characters.map(c => c.id));
  assert.equal(ids.size, 126);
  assert.equal(new Set(data.characters.map(c => JSON.stringify(c.vector))).size, ids.size);
  let seed = 20261121;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const winners = new Set();
  for (let run = 0; run < 30000 && winners.size < ids.size; run++) {
    const bias = Object.fromEntries(data.dimensions.map(d => [d.id, random() * 6]));
    const answers = raw.questions.map(q => Math.round(Math.max(0, Math.min(6, bias[q.category] + (random() - 0.5) * 2))));
    winners.add(engine.score(answers, data).ranking[0].id);
  }
  assert.deepEqual([...ids].filter(id => !winners.has(id)), [], 'unreachable result profiles');
});

test('canon separates both Dios and the two Requiems, and maps all original major arcana 0–21', () => {
  const by = Object.fromEntries(raw.characters.map(c => [c.id,c]));
  assert.deepEqual(by.dio.parts, [1]);
  assert.equal(by.dio.stand, '无替身');
  assert.match(by.dio.summary,/吸血鬼/);
  assert.equal(by.dio3.part,3);
  assert.match(by.dio3.stand,/世界/);
  assert.equal(raw.tarotOrder.length,22);
  assert.equal(new Set(raw.tarotOrder.map(id=>by[id].tarot)).size,22);
  assert.deepEqual(raw.tarotOrder.map(id=>by[id].tarotNumber),Array.from({length:22},(_,i)=>i));
  for(const id of raw.tarotOrder) assert.ok(by[id].part===3 && by[id].stand && !by[id].egyptianGod);
  assert.equal(raw.characters.filter(c=>c.egyptianGod).length,9);
  for (const [id, owner] of [['gold_experience_requiem','giorno'],['silver_chariot_requiem','polnareff5']]) {
    assert.equal(by[id].formOf,owner);
    assert.notDeepEqual(by[id].vector,by[owner].vector);
  }
  for (const id of ['esidisi','suzi_q','reimi','keicho','angelo','fugo','trish','vanilla_ice']) assert.ok(by[id]?.stand);
});

test('GitHub release only uses existing portraits and accurately separates the two Dio forms', () => {
  assert.equal(art.length,126);
  assert.equal(art.filter(a=>!a.placeholder && a.image && a.thumbnail).length,45);
  assert.equal(art.filter(a=>a.placeholder).length,81);
  const by=Object.fromEntries(art.map(a=>[a.id,a]));
  assert.ok(by.dio.placeholder);
  assert.equal(by.dio3.image,'assets/characters/dio.webp');
  assert.ok(art.every(a=>!a.standArt));
});

test('v1.1 and v1.2 completed answers survive; new canon and original owner render', () => {
  const answers = Array(Q_COUNT).fill(3);
  const stored = JSON.stringify({version:'1.1.0', answers, complete:true, works:['part-7'], worksDone:true});
  const main = {innerHTML:''};
  const document = {body:{dataset:{}}, querySelectorAll:() => [], getElementById:id => id==='main' ? main : null};
  const location = {hash:'#/legacy-result'};
  const window = {JOJO_DATA:raw, JOJO_ART:art, JOJO_NORMALIZE:engine.normalize, JOJO_ENGINE:engine, addEventListener:() => {}};
  const localStorage = {getItem:() => stored};
  vm.runInNewContext(read('app.js'), {document, location, window, localStorage});
  assert.doesNotMatch(main.innerHTML, /你的冒险，还差几页/);
  assert.match(main.innerHTML, /<svg/);

  location.hash = '#/legacy-result';
  localStorage.getItem=()=>JSON.stringify({...JSON.parse(stored),version:'1.2.0'});
  vm.runInNewContext(read('app.js'), {document, location, window, localStorage});
  assert.doesNotMatch(main.innerHTML, /你的冒险，还差几页/);
  location.hash = '#/character/lucy_steel';
  vm.runInNewContext(read('app.js'), {document, location, window, localStorage});
  assert.match(main.innerHTML, /露西·史提尔/);
  location.hash = '#/character/dio';
  vm.runInNewContext(read('app.js'), {document, location, window, localStorage});
  assert.match(main.innerHTML,/无替身/);
  location.hash = '#/character/silver_chariot_requiem';
  vm.runInNewContext(read('app.js'), {document, location, window, localStorage});
  assert.match(main.innerHTML,/对应原角色/);
  assert.match(main.innerHTML, /#\/character\/polnareff5/);
});

test('quick mode uses one question per dimension, and ranks the whole roster', () => {
  const questions = engine.quickQuestions(data);
  assert.equal(questions.length, 9);
  assert.equal(new Set(questions.map(q=>q.id)).size, 9);
  assert.deepEqual(new Set(questions.map(q=>q.category)),new Set(data.dimensions.map(d=>d.label)));
  const quick = {...data,questions};
  for (const i of [0,3,6]) {
    const scored=engine.score(questions.map(()=>i),quick);
    assert.equal(scored.ranking.length,CHAR_COUNT);
    assert.deepEqual(scored.familiarParts,[]);
    assert.ok(Object.values(scored.values).every(v=>v===100-i/6*100 || Math.abs(v-(100-i/6*100))<1e-9));
  }
  assert.equal(data.questions.length,36);
  assert.throws(()=>engine.score(data.questions.map(()=>3),quick));
});

test('plot bank covers all 36 prompts; the quick block spans all nine parts and dimensions', () => {
  const rows=fs.readFileSync(path.resolve(__dirname,'../docs/story-questions.tsv'),'utf8').trim().split('\n').map(line=>line.split('\t'));
  assert.deepEqual(raw.storyQuestions.map(x=>[x.id,String(x.part),x.scene,x.situation,x.left,x.right]),rows);
  assert.deepEqual(raw.storyQuestions.map(x=>x.id),raw.questions.map(x=>x.id));
  assert.deepEqual(raw.storyQuestions.slice(0,9).map(x=>x.part),[1,2,3,4,5,6,7,8,9]);
  assert.equal(new Set(raw.questions.slice(0,9).map(x=>x.category)).size,9);
  for(const part of data.parts)assert.equal(raw.storyQuestions.filter(x=>x.part===Number(part.id)).length,4);
  for(const q of raw.storyQuestions){ assert.ok(q.situation.length>22); assert.notEqual(q.left,q.right); }
});

test('story tests, old attempts, and direct results use distinct save keys', () => {
  const main={innerHTML:''};
  const node={addEventListener(){},querySelector(){return node;},querySelectorAll(){return [];}};
  const document={body:{dataset:{}},querySelectorAll:()=>[],querySelector:()=>node,getElementById:id=>id==='main'?main:node};
  const location={hash:'#/'};
  const window={JOJO_DATA:raw, JOJO_ART:art, JOJO_NORMALIZE:engine.normalize, JOJO_ENGINE:engine,addEventListener:()=>{}};
  const full={version:'1.3.0',answers:Array(36).fill(3),complete:true,works:['part-3'],worksDone:true};
  const quick={version:'1',answers:Array(9).fill(6),complete:true};
  const saved={'jojo-personality-archive-v2':full,'jojo-personality-quick-v1':quick};
  const localStorage={getItem:key=>JSON.stringify(saved[key]??null)};
  const run=hash=>{location.hash=hash;vm.runInNewContext(read('app.js'),{document,location,window,localStorage});return main.innerHTML;};
  assert.match(run('#/'),/href="#\/quick"[^>]*>快速测试 · 9 题/);
  assert.match(main.innerHTML,/href="#\/quiz"[^>]*>完整版 · 36 题/);
  assert.match(main.innerHTML,/旧版测试记录/);
  assert.match(run('#/quick-result'),/你的冒险，还差几页/);
  assert.match(run('#/result'),/你的冒险，还差几页/);
  assert.match(run('#/legacy-quick-result'),/旧版日常题 · 结果/);
  assert.match(run('#/legacy-result'),/已按你勾选的第 3 部/);
  assert.match(run('#/quick'),/虫箭/);
  assert.match(main.innerHTML,/被箭刺中可能重伤，甚至死亡/);
  assert.match(main.innerHTML,/QUESTION 01 \/ 9/);
  assert.match(main.innerHTML,/明显偏 B/);
  assert.doesNotMatch(run('#/legacy-quick'),/story-choices/);
  saved['jojo-personality-story-quick-v2']={version:'story-2',answers:Array(9).fill(6),complete:true};
  saved['jojo-personality-story-full-v2']={version:'story-2',answers:Array(36).fill(3),complete:true,works:['part-3'],worksDone:true};
  assert.match(run('#/quick-result'),/9 题剧情快测结果/);
  assert.match(main.innerHTML,/做 36 题完整版/);
  assert.doesNotMatch(main.innerHTML,/轻微优先熟悉角色/);
  for(const label of ['勇气与风险','正义与原则','思考与应变','情感与羁绊'])assert.ok(main.innerHTML.includes(label));
  assert.equal([...main.innerHTML.matchAll(/class="dimension-row"/g)].length,4);
  assert.match(run('#/result'),/完整版剧情测试完成/);
  assert.match(main.innerHTML,/已按你勾选的第 3 部/);
});

test('final scenario questionnaire uses exact four-axis split and preserves intermediate records',()=>{
 const rows=fs.readFileSync(path.resolve(__dirname,'../docs/story-questions-v2.tsv'),'utf8').trim().split('\n').map(line=>line.split('\t'));
 assert.deepEqual(raw.storyQuestionsV2.map(x=>[x.id,x.axis,String(x.part),x.scene,x.situation,x.left,x.right]),rows);
 const tally=(rows)=>Object.fromEntries(['courage','justice','thinking','bond'].map(axis=>[axis,rows.filter(q=>q.axis===axis).length]));
 assert.deepEqual(tally(raw.storyQuestionsV2),{courage:9,justice:9,thinking:9,bond:9});
 assert.deepEqual(tally(raw.storyQuestionsV2.slice(0,9)),{courage:3,justice:2,thinking:2,bond:2});
 assert.equal(new Set(raw.storyQuestionsV2.map(q=>q.id)).size,36);
 assert.match(raw.storyQuestionsV2[0].situation,/没有替身.*不知道自己是否有资质.*可能重伤/);
});

test('quick work chooser is optional, validates and persists only selected parts',()=>{
 const main={innerHTML:''}, handlers={}, checks=[], skip={}, next={};
 const saved={answers:Array(9).fill(3),index:8,complete:false,works:[],version:'story-2'};
 const storage={'jojo-personality-story-quick-v2':JSON.stringify(saved)};
 const form={addEventListener(k,f){handlers[k]=f;},querySelectorAll(q){return q.includes(':checked')?checks:[];}};
 const document={body:{dataset:{}},querySelectorAll:()=>[],getElementById:id=>id==='main'?main:id==='quick-works-form'&&main.innerHTML.includes('id="quick-works-form"')?form:id==='quick-works-skip'?skip:id==='quick-works-next'?next:null};
 const location={hash:'#/quick-works'};
 const window={JOJO_DATA:raw,JOJO_ART:art,JOJO_NORMALIZE:engine.normalize,JOJO_ENGINE:engine,addEventListener:()=>{}};
 const localStorage={getItem:key=>storage[key]||null,setItem:(key,value)=>storage[key]=value};
 const run=hash=>{location.hash=hash;vm.runInNewContext(read('app.js'),{document,location,window,localStorage});return main.innerHTML;};
 assert.match(run('#/'),/href="#\/quick-works"[^>]*>继续快测/);
 assert.match(run('#/quick-works'),/跳过，直接看结果/);
 assert.equal((main.innerHTML.match(/name="quick-part"/g)||[]).length,9);
 checks.push({value:'part-3'},{value:'part-3'},{value:'part-5'},{value:'other'});
 handlers.change();assert.equal(next.disabled,false);
 handlers.submit({preventDefault(){}});
 assert.equal(location.hash,'#/quick-result');assert.deepEqual(JSON.parse(storage['jojo-personality-story-quick-v2']).works,['part-3','part-5']);
 assert.match(run('#/quick-result'),/已按你勾选的第 3、5 部/);
 assert.match(run('#/quick-works'),/value="part-3" checked/);
 skip.onclick();assert.equal(location.hash,'#/quick-result');
 assert.deepEqual(JSON.parse(storage['jojo-personality-story-quick-v2']).works,[]);
 assert.doesNotMatch(run('#/quick-result'),/轻微优先熟悉角色/);
 delete storage['jojo-personality-story-quick-v2'];
 assert.match(run('#/quick-works'),/先答完 9 道题/);
});

test('familiarity changes close matches, not a character with a clear lead',()=>{
 const q={options:[{scores:{x:0}}]};
 const sample={questions:[q],dimensions:[{id:'x'}],characters:[
  {id:'original',part:1,vector:{x:50}},{id:'close',part:3,vector:{x:51}},{id:'distant',part:4,vector:{x:54}}
 ]};
 assert.equal(engine.score([0],sample).ranking[0].id,'original');
 // ID tie-break at distance zero favors "close", after the bounded boost.
 assert.equal(engine.score([0],sample,{selectedWorks:['part-3']}).ranking[0].id,'close');
 assert.equal(engine.score([0],sample,{selectedWorks:['part-4']}).ranking[0].id,'original');
});
