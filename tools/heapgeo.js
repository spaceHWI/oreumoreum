// 더미·낱개 쓰레기 모양의 열린 모서리 세기 (#154): node tools/heapgeo.js
// 열린 모서리 = 한 면만 쓰는 모서리(자리 기준). 몸통·윗덩이처럼 닫힌 모양이 0 이 아니면 겉면이 벌어져 속이 보인다
// src/trash.js 의 __geo(makeGeos·makeHeapGeo·jitter)를 esbuild 로 묶어 node 에서 부른다
const esbuild = require('esbuild'), path = require('path'), fs = require('fs'), os = require('os');
const out = path.join(os.tmpdir(), 'heapgeo-' + process.pid + '.cjs');
esbuild.buildSync({ stdin: { contents: "export { __geo } from './src/trash.js'; export * as THREE from 'three';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error', define: { __DEV__: 'false' } });
const { __geo: G, THREE } = require(out); fs.unlinkSync(out);
const key = (p, i) => [p.getX(i), p.getY(i), p.getZ(i)].map((v) => Math.round(v * 1e4)).join(',');
function openEdges(g) {
  const p = g.attributes.position, ix = g.index, n = ix ? ix.count : p.count, E = new Map(), tris = n / 3;
  for (let t = 0; t < n; t += 3) {
    const k = [0, 1, 2].map((j) => key(p, ix ? ix.getX(t + j) : t + j));
    if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) continue; // 넓이 0 인 면
    for (let j = 0; j < 3; j++) { const a = k[j], b = k[(j + 1) % 3], e = a < b ? a + '|' + b : b + '|' + a; E.set(e, (E.get(e) || 0) + 1); }
  }
  let open = 0; E.forEach((c) => { if (c === 1) open++; });
  return { open, tris };
}
const rows = [];
// 닫혀 있어야 하는 모양: 더미 몸통·윗덩이·봉지, 낱개 비닐·폐어구 덩이·스티로폼
['s', 'l', 'xl', 'mt'].forEach((k) => [0, 1, 2, 3].forEach((st) => {
  const P = G.heapParts(k, st, false);
  rows.push([`heap ${k}${st} 몸통`, openEdges(P[0])], [`heap ${k}${st} 윗덩이`, openEdges(P[1])]);
  let o = 0, t = 0; P.slice(2).forEach((g) => { const r = openEdges(g); o += r.open; t += r.tris; }); rows.push([`heap ${k}${st} 얹은 것(${P.length - 2})`, { open: o, tris: t }]);
  const M = G.makeHeapGeo(k, st, false); rows.push([`heap ${k}${st} 합친 삼각형`, { open: '-', tris: M.attributes.position.count / 3 }]);
}));
const names = ['캔', '페트병', '비닐', '스티로폼', '폐어구'];
G.makeGeos().forEach((g, i) => rows.push([`낱개 ${names[i]}`, openEdges(g)]));
let bad = 0;
rows.forEach(([n, r]) => { console.log(n.padEnd(28), 'open', String(r.open).padStart(4), 'tris', r.tris); if (/몸통|윗덩이/.test(n) && r.open) bad++; });
console.log(bad ? `실패: 몸통·윗덩이 열린 모서리 ${bad}곳` : '통과: 몸통·윗덩이 열린 모서리 0');
process.exit(bad ? 1 : 0);
