// 용량 표 (#293): node build.mjs 뒤 node tools/sizereport.mjs [--md] → 받는 양을 파일별로 원래·gzip·brotli 크기로, main 안의 몫(esbuild metafile) 큰 것 20개
// 묶음: 첫 화면까지(index.html + main-*.js + 내 캐릭터 모델, preload) / 게임 시작까지(+ 한가할 때 받는 모델) / 한 시간 놀며 받는 전부(+ 가까이 가야 받는 사건 모델·쪽지 그림)
// GitHub Pages 는 brotli 없이 gzip 으로 보낸다(2026-11-24 실서버 응답 머리글: content-encoding: gzip, cache-control: max-age=600). 그래서 표의 기준 열은 gzip
// 바깥에서 받는 것(구글 글꼴 Gothic A1 은 unicode-range 조각이라 쓴 글자 조각만, 구글 로그인·원스토어 SDK)은 넣지 않는다
// --md 를 주면 notes/size.md 의 '지금' 표를 이 값으로 바꿔 쓴다
import fs from 'fs'; import path from 'path'; import zlib from 'zlib';
import * as esbuild from 'esbuild';
const D = 'dist';
if (!fs.existsSync(D + '/version.json')) { console.error('dist 가 없음: 먼저 node build.mjs'); process.exit(1); }
const main = JSON.parse(fs.readFileSync(D + '/version.json', 'utf8')).main;
const gz = (b) => zlib.gzipSync(b, { level: 6 }).length;
const br = (b) => zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const row = (f) => { const b = fs.readFileSync(path.join(D, f)); return { f, raw: b.length, gz: gz(b), br: br(b) }; };
const head = (b) => { const hl = b.readUInt32LE(0); return JSON.parse(b.subarray(4, 4 + hl).toString()); };
const bins = fs.readdirSync(D + '/a').map((f) => { const r = row('a/' + f), m = head(fs.readFileSync(path.join(D, 'a', f))).meta || {}; return { ...r, core: /^runner-/.test(f), lazy: !!m.lazy }; });
const notes = fs.existsSync(D + '/assets/notes') ? fs.readdirSync(D + '/assets/notes').map((f) => row('assets/notes/' + f)) : [];
const first = [row('index.html'), row(main), ...bins.filter((b) => b.core)];
const start = [...first, ...bins.filter((b) => !b.core && !b.lazy)];
const all = [...start, ...bins.filter((b) => b.lazy), ...notes];
const sum = (l) => l.reduce((s, r) => ({ raw: s.raw + r.raw, gz: s.gz + r.gz, br: s.br + r.br }), { raw: 0, gz: 0, br: 0 });
const kb = (n) => (n / 1024).toFixed(0) + 'KB';
const G = { first: sum(first), start: sum(start), all: sum(all) };
// main 안의 몫: build.mjs 와 같은 설정으로 다시 묶어 metafile 을 얻음 (모델 목록 자리는 작아서 뺌)
const r = await esbuild.build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none', metafile: true, logLevel: 'silent', define: { __DEV__: 'false', __PUBLIC__: 'false' } });
const ins = Object.entries(Object.values(r.metafile.outputs)[0].inputs).map(([k, v]) => [k, v.bytesInOutput]).sort((a, b) => b[1] - a[1]);
const grp = { three: 0, '박아 넣은 자료(지형·벽·글·그림)': 0, '게임 코드': 0 };
const DATA = /namsongidata|wallmodel|punktext|version\.js|stonelogo|icons\.js|npclines|buddylines|balance\.js|dexicons|clothicons|mangoicon|stoneicons/;
for (const [k, v] of ins) grp[k.includes('node_modules') ? 'three' : DATA.test(k) ? '박아 넣은 자료(지형·벽·글·그림)' : '게임 코드'] += v;
const L = [];
L.push('| 묶음 | 파일 수 | 원래 | gzip (Pages) | brotli |', '|---|---|---|---|---|');
for (const [n, k, l] of [['첫 화면까지', 'first', first], ['게임 시작까지', 'start', start], ['한 시간 전부', 'all', all]]) L.push(`| ${n} | ${l.length} | ${kb(G[k].raw)} | ${kb(G[k].gz)} | ${kb(G[k].br)} |`);
L.push('', '| 파일 | 언제 | 원래 | gzip | brotli |', '|---|---|---|---|---|');
for (const x of all.sort((a, b) => b.gz - a.gz)) L.push(`| ${x.f.replace(/-[0-9a-f]{10}\./, '.')} | ${first.includes(x) ? '첫 화면' : start.includes(x) ? '시작 뒤 한가할 때' : '가까이 갈 때'} | ${kb(x.raw)} | ${kb(x.gz)} | ${kb(x.br)} |`);
L.push('', '**main 안의 몫** (minify 뒤): ' + Object.entries(grp).map(([k, v]) => `${k} ${kb(v)}`).join(' · '), '', '| main 안 큰 것 20 | 크기 |', '|---|---|');
for (const [k, v] of ins.slice(0, 20)) L.push(`| ${k} | ${kb(v)} |`);
const out = L.join('\n');
console.log(out);
if (process.argv.includes('--md')) {
  const f = 'notes/size.md', s = fs.readFileSync(f, 'utf8'), a = '<!-- 지금 -->', b = '<!-- /지금 -->';
  const i = s.indexOf(a), j = s.indexOf(b);
  if (i < 0 || j < 0) { console.error(f + ' 에 ' + a + ' … ' + b + ' 자리가 없음'); process.exit(1); }
  fs.writeFileSync(f, s.slice(0, i + a.length) + '\n' + out + '\n' + s.slice(j));
  console.log('→ ' + f);
}
