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
  assert.equal(raw.meta.version, '1.1.0');
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
