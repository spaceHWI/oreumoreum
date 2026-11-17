// 모델 압축 확인 (#85): node tools/assetcheck.mjs → 따로 받는 모델을 wasm·JS 디코더로 풀어 원본과 삼각형(위치·법선·uv)·텍스처가 똑같은지
// 압축 전후 같은지: 삼각형마다 (위치·법선·uv) 묶음을 문자열로 만들어 정렬 비교
import { packAssets, ASSET_SRC } from './packassets.mjs';
import { MeshoptDecoder as W } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { MeshoptDecoder as J } from 'meshoptimizer/meshopt_decoder_reference.js';
import path from 'path';
await W.ready;
const packed = await packAssets(path.resolve('src'));
const b64 = (s) => { const b = Buffer.from(s, 'base64'); return new Uint8Array(b.buffer, b.byteOffset, b.length).slice(); };
function unpack(buf, D) {
  const hl = new DataView(buf.buffer, buf.byteOffset, 4).getUint32(0, true); const head = JSON.parse(Buffer.from(buf.subarray(4, 4 + hl)).toString()); const base = 4 + hl, out = { ...head.meta };
  for (const c of head.chunks) { const src = buf.subarray(base + c.o, base + c.o + c.l); if (c.c === 'raw') { out[c.k] = src.slice(); continue; } const dst = new Uint8Array(c.n * c.s);
    if (c.c === 'v') D.decodeVertexBuffer(dst, c.n, c.s, src); else D.decodeIndexBuffer(dst, c.n, c.s, src);
    if (c.c === 'v' && c.e !== c.s) { const o = new Uint8Array(c.n * c.e); for (let i = 0; i < c.n; i++) o.set(dst.subarray(i * c.s, i * c.s + c.e), i * c.e); out[c.k] = o; } else out[c.k] = dst; }
  return out;
}
const tris = (M, sizes, isz) => { const idx = isz === 2 ? new Uint16Array(M.idx.buffer, M.idx.byteOffset, M.idx.length / 2) : new Uint32Array(M.idx.buffer, M.idx.byteOffset, M.idx.length / 4); const keys = [];
  const v = (i) => ['pos', 'nor', 'uv'].map((k) => Buffer.from(M[k].subarray(i * sizes[k], (i + 1) * sizes[k])).toString('hex')).join('|');
  for (let t = 0; t < idx.length; t += 3) { const k = [v(idx[t]), v(idx[t + 1]), v(idx[t + 2])]; const r = [k, [k[1], k[2], k[0]], [k[2], k[0], k[1]]].map((x) => x.join('/')).sort()[0]; keys.push(r); } return keys.sort().join('\n'); };
for (const a of packed) {
  const src = ASSET_SRC.find((x) => x[0] === a.name); const mod = await import(path.resolve('src', src[1])); const M = mod[src[2]];
  if (!src[3]) { const w = unpack(a.buf, J); let ok = true; for (const [k, l] of Object.entries(M)) l.forEach((s, i) => { if (Buffer.compare(Buffer.from(w[k + i]), Buffer.from(s, 'base64'))) ok = false; }); console.log(a.name, ok ? 'same' : 'DIFF'); continue; }
  const sh = src[3], sizes = { pos: sh.pos[0] * 3, nor: 3, uv: sh.uv[0] * 2 }, isz = (M.idx16 || sh.pos[0] === 2 || a.name === 'boar') ? 2 : 4;
  const orig = { pos: b64(M.pos), nor: b64(M.nor), uv: b64(M.uv), idx: b64(M.idx) };
  const T0 = tris(orig, sizes, isz);
  for (const [nm, D] of [['wasm', W], ['js', J]]) { const d = unpack(a.buf, D); console.log(a.name, nm, tris(d, sizes, isz) === T0 ? 'same' : 'DIFF', Buffer.compare(Buffer.from(d.tex), Buffer.from(M.tex.split(',')[1], 'base64')) === 0 ? 'tex same' : 'tex DIFF'); }
}
