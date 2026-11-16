// node build.mjs → dist/oreumoreum.html (claude.ai 아티팩트용, 뼈대 없음) + dist/index.html (Pages·로컬 확인용 완성 페이지)
// DEV=1 이면 개발 서버용: 저장 키를 따로 써서 실서버 기록과 섞이지 않게 한다
import * as esbuild from 'esbuild';
import fs from 'fs';
const DEV = !!process.env.DEV;
const r = await esbuild.build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', define: { __DEV__: String(DEV) } });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const page = fs.readFileSync('src/page.html', 'utf8');
const i = page.indexOf('__BUNDLE__');
fs.mkdirSync('dist', { recursive: true });
const body = page.slice(0, i) + js + page.slice(i + 10);
fs.writeFileSync('dist/oreumoreum.html', body);
const full = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"></head><body>' + body + '</body></html>';
fs.writeFileSync('dist/index.html', full);
fs.writeFileSync('dist/test.html', full);
console.log('ok', (fs.statSync('dist/oreumoreum.html').size / 1024).toFixed(0) + 'KB', DEV ? '(dev)' : '');
