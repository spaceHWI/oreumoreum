// node sian/char-motion/build.mjs → dist/char-motion.html (브라우저에서 바로 열기)
import * as esbuild from 'esbuild';
import fs from 'fs';
const r = await esbuild.build({ entryPoints: ['sian/char-motion/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', define: { __DEV__: 'false' } });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/char-motion.html', `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>캐릭터 동작</title><style>body{margin:0;overflow:hidden}</style></head><body><script>${js}</script></body></html>`);
console.log('ok', (fs.statSync('dist/char-motion.html').size / 1024).toFixed(0) + 'KB');
