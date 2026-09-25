'use strict';
// Build a genuinely self-contained, offline HTML file using only Node built-ins.
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto');
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const core = read('core.js'), app = read('app.js'), css = read('style.css');
const hash = text => "'sha256-" + crypto.createHash('sha256').update(text).digest('base64') + "'";
let html = read('index.html');
html = html.replace("script-src 'self'", () => 'script-src ' + hash(core) + ' ' + hash(app)).replace("style-src 'self'", () => 'style-src ' + hash(css));
// Callback replacements prevent $&, $` and $' inside source from becoming replacement patterns.
html = html.replace('<link rel="stylesheet" href="style.css">', () => '<style>' + css + '</style>');
html = html.replace('<script src="core.js" defer></script>\n<script src="app.js" defer></script>', '');
html = html.replace('</body>', () => '<script>' + core + '</script>\n<script>' + app + '</script>\n</body>');
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'ScopeDiff.html'), html);
console.log('Built dist/ScopeDiff.html: no runtime dependencies, no external requests.');
