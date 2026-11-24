// 모델 떼어 내기 (#85): JS 안에 base64 로 들어 있던 모델 자료(src/model-*.js 등)를 따로 받는 이진 파일로 묶는다.
// build.mjs 가 부른다. 원본 자료 파일(src/model-*.js, boarmodel.js, gear/head-*.js, stepsamples.js)은 그대로 두고 게임 코드는 더 이상 import 하지 않는다
// 파일 하나 = [u32 머리 길이][머리 JSON][조각들]. 머리: { meta, chunks: [{ k, o, l, c, n, s, e }] }
//   c: 'raw'(그대로: 텍스처 jpg·소리 mp3), 'v'(meshopt 정점 압축: n 개, 한 개 s 바이트(4의 배수로 채움), 실제 e 바이트), 'i'(meshopt 삼각형 인덱스: n 개, s=2|4)
// 정점 압축은 손실 없음(값이 원본과 똑같이 풀림). 텍스처는 jpg, 또는 더 작고 거의 같은 webp 가 구워져 있으면 webp (#293, KTX2 는 #85 코멘트 참고)
import { MeshoptEncoder } from 'meshoptimizer';
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import { fileURLToPath } from 'url';
/* 텍스처 webp (#293): tools/texwebp.mjs 가 구워 둔 assets/tex/<jpg 해시>.webp 가 있으면 그것을, 없으면 jpg 그대로 */
const TEX_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/tex');
export function texOf(mime, jpg) {
  const f = path.join(TEX_DIR, crypto.createHash('sha256').update(jpg).digest('hex').slice(0, 16) + '.webp');
  return fs.existsSync(f) ? { mime: 'image/webp', data: fs.readFileSync(f) } : { mime, data: jpg };
}

const b64 = (s) => Buffer.from(s, 'base64');
// 자료 모양별 칸: [이름, 한 개 요소 바이트, 칸 수] (정점 압축 단위 = 요소 × 칸)
const PROP = { pos: [2, 3], nor: [1, 3], uv: [2, 2] }; // 가게·들개·외계인: 위치·uv 를 uint16 으로 줄여 둔 것
const FLOAT = { pos: [4, 3], nor: [1, 3], uv: [4, 2] }; // 멧돼지·머리: float
export const ASSET_SRC = [
  // 이름, 원본 파일, 내보낸 이름, 칸 모양
  ['runner', 'runnermodel.js', 'RM', FLOAT], // 내 캐릭터: 첫 화면에 필요해서 게임 코드보다 먼저 받음(assets.js CORE, index.html preload)
  ['stone', 'model-stone.js', 'STONE_M', PROP],
  ['salon', 'model-salon.js', 'SALON_M', PROP],
  ['leap', 'model-leap.js', 'LEAP_M', PROP],
  ['dog', 'model-dog.js', 'DOG_M', PROP],
  ['alien', 'model-alien.js', 'ALIEN_M', PROP],
  ['hareubang', 'model-hareubang.js', 'HAREUBANG_M', PROP], // #2 돌하르방·가로등·노루
  ['lamp', 'model-lamp.js', 'LAMP_M', PROP],
  ['deer', 'model-deer.js', 'DEER_M', PROP],
  ['boar', 'boarmodel.js', 'BM', FLOAT],
  ['hair-short', 'gear/head-short.js', 'default', FLOAT],
  ['hair-bob', 'gear/head-bob.js', 'default', FLOAT],
  ['hair-bun', 'gear/head-bun.js', 'default', FLOAT],
  ['steps', 'stepsamples.js', 'STEP_SAMPLES', null],
  // 사건 파일 Tripo 모델 (#262): 가까이 갔을 때만 받음(meta.lazy → 한가할 때 받는 차례에 넣지 않음). -lo 는 멀리용(1,500 삼각형·텍스처 128)
  // #305: 오름지기(jigi)·망고 좌판(stall)·서바이벌 징(gong)·수거 관 투입구(chute)·망고(mango). 모두 가까이 갔을 때만
  ...['yeti', 'mib', 'ghost-keeper', 'arena-keeper', 'hose', 'jigi', 'stall', 'gong', 'chute', 'mango'].flatMap((n) => {
    const N = n.toUpperCase().replace(/-/g, '_');
    return [['case-' + n, 'model-case-' + n + '.js', N + '_M', PROP, true], ['case-' + n + '-lo', 'model-case-' + n + '-lo.js', N + '_LO', PROP, true]];
  }),
];

function vchunk(buf, [eb, comps]) {
  const e = eb * comps, s = Math.ceil(e / 4) * 4, n = buf.length / e;
  if (n !== Math.floor(n)) throw new Error('정점 크기 안 맞음');
  let src = buf;
  if (s !== e) { src = Buffer.alloc(n * s); for (let i = 0; i < n; i++) buf.copy(src, i * s, i * e, i * e + e); }
  const out = Buffer.from(MeshoptEncoder.encodeVertexBuffer(new Uint8Array(src.buffer, src.byteOffset, src.length), n, s));
  return { c: 'v', n, s, e, data: out };
}
function ichunk(buf, size) {
  const n = buf.length / size;
  if (n % 3) throw new Error('삼각형 인덱스가 아님');
  const out = Buffer.from(MeshoptEncoder.encodeIndexBuffer(new Uint8Array(buf.buffer, buf.byteOffset, buf.length), n, size));
  return { c: 'i', n, s: size, data: out };
}
// 모델 자료 → 위치·법선·uv 를 묶은 bbox(임시 모양 크기)도 계산해 meta 에 넣음
function bbox(M, shape) {
  if (M.min && M.max) return { min: M.min, max: M.max };
  const p = b64(M.pos), f = new Float32Array(p.buffer, p.byteOffset, p.length / 4), min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (let i = 0; i < f.length; i++) { const c = i % 3; if (f[i] < min[c]) min[c] = f[i]; if (f[i] > max[c]) max[c] = f[i]; }
  return { min: min.map((v) => +v.toFixed(4)), max: max.map((v) => +v.toFixed(4)) };
}

export async function packAssets(srcDir) {
  await MeshoptEncoder.ready;
  const out = [];
  for (const [name, file, exp, shape, lazy] of ASSET_SRC) {
    const mod = await import(srcDir + '/' + file);
    const M = mod[exp];
    const chunks = [], meta = {};
    if (!shape) { // 소리: { 종류: [mp3 base64, ...] }
      meta.steps = {};
      for (const [k, list] of Object.entries(M)) { meta.steps[k] = list.map((s, i) => { chunks.push({ k: k + i, c: 'raw', data: b64(s) }); return k + i; }); }
    } else {
      // 정점 순서를 캐시·압축에 좋게 다시 늘어놓음(meshopt reorderMesh). 그려지는 모양은 같고, 안 쓰는 정점만 빠짐
      const isz = (M.idx16 || shape === PROP || name === 'boar') ? 2 : 4; // 머리·캐릭터는 idx16 표시가 있으면 2
      const ib = b64(M.idx), idx = Uint32Array.from(isz === 2 ? new Uint16Array(ib.buffer, ib.byteOffset, ib.length / 2) : new Uint32Array(ib.buffer, ib.byteOffset, ib.length / 4));
      const [remap, unique] = MeshoptEncoder.reorderMesh(idx, true, true);
      const vtx = (buf, e) => { const n = buf.length / e, o = Buffer.alloc(unique * e); for (let v = 0; v < n; v++) { const r = remap[v]; if (r !== 0xffffffff) buf.copy(o, r * e, v * e, v * e + e); } return o; };
      const ibuf = isz === 2 ? Buffer.from(Uint16Array.from(idx).buffer) : Buffer.from(idx.buffer);
      for (const [k, v] of Object.entries(M)) {
        if (typeof v !== 'string') { meta[k] = v; continue; }
        if (k === 'tex') { const m = /^data:([^;]+);base64,(.*)$/.exec(v); chunks.push({ k, c: 'raw', ...texOf(m[1], b64(m[2])) }); continue; }
        if (k === 'idx') chunks.push({ k, ...ichunk(ibuf, isz) });
        else if (shape[k]) chunks.push({ k, ...vchunk(vtx(b64(v), shape[k][0] * shape[k][1]), shape[k]) });
        else throw new Error('모르는 칸 ' + name + '.' + k);
      }
      if (meta.n != null) meta.n = unique;
      Object.assign(meta, bbox(M, shape));
      if (lazy) meta.lazy = true;
    }
    let o = 0; const head = { meta, chunks: chunks.map(({ data, ...c }) => { const r = { ...c, o, l: data.length }; o += data.length; return r; }) };
    const hj = Buffer.from(JSON.stringify(head)), hl = Buffer.alloc(4); hl.writeUInt32LE(hj.length);
    const buf = Buffer.concat([hl, hj, ...chunks.map((c) => c.data)]);
    const rawB64 = Object.values(M).reduce((s, v) => s + (typeof v === 'string' ? v.length : Array.isArray(v) ? v.reduce((a, x) => a + (typeof x === 'string' ? x.length : 0), 0) : 0), 0);
    out.push({ name, buf, meta, before: rawB64, core: name === 'runner' });
  }
  return out;
}
