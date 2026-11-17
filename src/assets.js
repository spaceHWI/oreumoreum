// 따로 받는 모델 (#85): 가게·적·머리 종류·발소리는 첫 화면에 받지 않고, 첫 화면이 그려진 뒤 한가할 때 차례로 받는다.
// 받기 전에는 쓰는 곳이 임시 모양(placeholder)을 보이고, 받으면 whenAsset 콜백에서 진짜 모양으로 갈아 끼운다.
// 파일 모양은 tools/packassets.mjs (meshopt 압축 정점·인덱스 + jpg·mp3 그대로)
import * as THREE from 'three';
import { MeshoptDecoder as WasmDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { MeshoptDecoder as JsDecoder } from 'meshoptimizer/meshopt_decoder_reference.js';
import { ASSETS } from './assetlist.js';

const cache = new Map(); // 이름 → 풀린 자료 { ...meta, pos: Uint8Array, ..., tex: blob URL }
const waiting = new Map(); // 이름 → [콜백]
const loading = new Map(); // 이름 → Promise
const fails = new Map(); // 이름 → 받기 실패 횟수
let go = false; // 첫 화면이 그려지기 전에는 받지 않음
const queue = []; // 받을 차례 (앞이 먼저)
const ORDER = ['steps', 'boar', 'stone', 'leap', 'salon', 'hair-short', 'hair-bob', 'hair-bun', 'dog', 'alien', 'hareubang', 'lamp', 'deer']; // 한가할 때 받는 순서
export const CORE = ['runner']; // 첫 화면 전에 받아야 하는 것 (main.js 가 기다림)
export const assetInfo = { done: 0, total: Object.keys(ASSETS).length, bytes: 0, ms: 0 };

export const assetMeta = (name) => ASSETS[name]?.meta || {};
export const getAsset = (name) => cache.get(name) || null;

// base64 문자열(예전 JS 안 자료) 이든 이미 받은 바이트(Uint8Array) 든 같은 형식 배열로
export const bytesAs = (s, T) => {
  if (typeof s !== 'string') return new T(s.buffer, s.byteOffset, s.byteLength / T.BYTES_PER_ELEMENT);
  const bin = atob(s), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new T(u8.buffer);
};

async function fetchBytes(a) {
  if (a.b64) return bytesAs(a.b64, Uint8Array); // 한 파일로 여는 빌드: 자료가 JS 안에
  const r = await fetch(a.url); if (!r.ok) throw new Error('asset ' + r.status);
  return new Uint8Array(await r.arrayBuffer());
}
// 풀기: three.js 의 meshopt 디코더(wasm). wasm 이 막힌 브라우저면 느리지만 같은 결과인 JS 디코더로
let dec = null;
const decoder = () => dec || (dec = WasmDecoder.ready.then(() => (WasmDecoder.supported ? WasmDecoder : JsDecoder)).catch(() => JsDecoder));
async function unpack(name) {
  const a = ASSETS[name]; if (!a) throw new Error('없는 모델 ' + name);
  const t0 = performance.now();
  const buf = await fetchBytes(a); assetInfo.bytes += buf.length;
  const MeshoptDecoder = await decoder();
  const hl = new DataView(buf.buffer, buf.byteOffset, 4).getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(buf.subarray(4, 4 + hl)));
  const base = 4 + hl, out = { ...head.meta };
  for (const c of head.chunks) {
    const src = buf.subarray(base + c.o, base + c.o + c.l);
    if (c.c === 'raw') { out[c.k] = c.mime ? URL.createObjectURL(new Blob([src], { type: c.mime })) : src.slice(); continue; }
    const dst = new Uint8Array(c.n * c.s);
    if (c.c === 'v') MeshoptDecoder.decodeVertexBuffer(dst, c.n, c.s, src);
    else MeshoptDecoder.decodeIndexBuffer(dst, c.n, c.s, src);
    if (c.c === 'v' && c.e !== c.s) { const o = new Uint8Array(c.n * c.e); for (let i = 0; i < c.n; i++) o.set(dst.subarray(i * c.s, i * c.s + c.e), i * c.e); out[c.k] = o; } else out[c.k] = dst;
  }
  assetInfo.ms += performance.now() - t0;
  return out;
}
function load(name) {
  if (cache.has(name)) return Promise.resolve(cache.get(name));
  if (!loading.has(name)) {
    loading.set(name, unpack(name).then((d) => {
      cache.set(name, d); assetInfo.done++;
      const cbs = waiting.get(name) || []; waiting.delete(name);
      for (const cb of cbs) { try { cb(d); } catch (e) { console.error(e); } }
      for (const cb of anyCbs) cb(name);
      return d;
    }).catch((e) => { loading.delete(name); const n = fails.set(name, (fails.get(name) || 0) + 1).get(name); console.warn('모델을 받지 못함', name, e); setTimeout(() => want(name), Math.min(60000, 4000 * 2 ** (n - 1))); return null; })); // 다시 받기: 4초부터 두 배씩, 최대 1분 (#90)
  }
  return loading.get(name);
}
// 자료가 오면 cb(자료). 이미 받았으면 바로 부름. 받기 시작은 첫 화면 뒤 (now: 내 캐릭터 머리처럼 첫 화면에 필요하면 바로)
// lazy: 받기를 시작하지 않고 기다리기만 (가까이 갔을 때 쓰는 곳이 want 를 부름. #2 노루)
export function whenAsset(name, cb, { now = false, lazy = false } = {}) {
  const d = cache.get(name); if (d) { cb(d); return; }
  if (!waiting.has(name)) waiting.set(name, []);
  waiting.get(name).push(cb);
  if (!lazy) want(name, now);
}
// 가까이 왔거나 지금 필요함 → 차례 맨 앞으로 (now 면 첫 화면 전이라도 바로 받음)
export function want(name, now = false) {
  if (cache.has(name) || loading.has(name) || !ASSETS[name]) return;
  if (!go && !now) { if (!queue.includes(name)) queue.unshift(name); return; }
  load(name);
}
// 첫 화면이 그려진 뒤 부름: 먼저 찾은 것(want)부터, 그다음 ORDER 순서로 두 개씩 나란히 받음
// (받기·풀기는 가볍다. 텍스처 올리기·셰이더 준비는 그릴 때 하나씩 일어남)
export function startAssets() {
  if (go) return; go = true;
  for (const n of [...ORDER, ...Object.keys(ASSETS)]) if (!queue.includes(n)) queue.push(n);
  const next = () => {
    while (queue.length && (cache.has(queue[0]) || loading.has(queue[0]))) queue.shift();
    const n = queue.shift(); if (!n) return;
    load(n).then(() => setTimeout(next, 0));
  };
  next(); next();
}
// 첫 화면에 꼭 필요한 모델(내 캐릭터)을 받아 둠. 실패하면 조금 있다 다시
export function loadCore() {
  const get = (n) => load(n).then((d) => d || new Promise((r) => setTimeout(r, 1500)).then(() => get(n)));
  return Promise.all(CORE.map(get));
}
const anyCbs = [];
export const onAnyAsset = (cb) => { anyCbs.push(cb); }; // 모델 하나가 와서 갈아 끼운 뒤 (update.js 가 셰이더를 다시 준비)
export const assetsDone = () => assetInfo.done >= assetInfo.total;

// 텍스처를 먼저 만들어 재질에 넣고, 이미지는 자료가 오면 채움
export function lazyTexture(name, setup) {
  const t = new THREE.Texture(); setup?.(t);
  whenAsset(name, (d) => { if (!d.tex) return; new THREE.ImageLoader().load(d.tex, (img) => { t.image = img; t.needsUpdate = true; }); });
  return t;
}
// 임시 모양: 모델 bbox 크기의 상자(건물) 또는 타원체(생물·머리). 색은 둔한 회색
const tmpMat = {};
export function placeholderGeo(name, kind = 'box') {
  const { min = [-0.5, 0, -0.5], max = [0.5, 1, 0.5] } = assetMeta(name);
  const sx = max[0] - min[0], sy = max[1] - min[1], sz = max[2] - min[2];
  const g = kind === 'box' ? new THREE.BoxGeometry(sx * 0.92, sy * 0.85, sz * 0.92) : new THREE.SphereGeometry(0.5, 10, 7).scale(sx * 0.8, sy * 0.85, sz * 0.8);
  g.translate((min[0] + max[0]) / 2, kind === 'box' ? min[1] + sy * 0.85 / 2 : (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  return g;
}
export function placeholderMat(color = '#9a9a92') {
  return tmpMat[color] || (tmpMat[color] = new THREE.MeshLambertMaterial({ color }));
}
