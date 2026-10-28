'use strict';

// Keep file:// support: runtime data is a plain script, not fetch() or a module.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const art = JSON.parse(fs.readFileSync(path.join(root, 'assets/characters/manifest.json'), 'utf8'));
fs.writeFileSync(path.join(root, 'data.js'), `window.JOJO_DATA = ${JSON.stringify(data)};\n`);
fs.writeFileSync(path.join(root, 'art.js'), `window.JOJO_ART = ${JSON.stringify(art)};\n`);
console.log('Synced data.js and art.js from their JSON sources.');
