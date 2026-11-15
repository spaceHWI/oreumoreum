import * as esbuild from 'esbuild'; import fs from 'fs';
const r = await esbuild.build({ entryPoints: ['proto/scene.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020' });
fs.writeFileSync('proto/index.html', '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;overflow:hidden;background:#000}</style></head><body><script>' + r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script></body></html>');
console.log('ok');
