// 멧돼지 GLB(bake-boar.py 결과) → src/boarmodel.js. 사용: node model/extract-boar.js model/boar.glb
const fs = require('fs');
const IN = process.argv[2] || 'model/boar.glb';
const buf = fs.readFileSync(IN);
const jsonLen = buf.readUInt32LE(12); const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString());
const bin = buf.slice(20 + jsonLen + 8);
const acc = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView]; const n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type]; const off = (v.byteOffset || 0) + (a.byteOffset || 0);
  const T = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[a.componentType]; const out = new T(a.count * n); const stride = v.byteStride || T.BYTES_PER_ELEMENT * n;
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) { const o = off + k * stride + c * T.BYTES_PER_ELEMENT; out[k * n + c] = T === Float32Array ? bin.readFloatLE(o) : T === Uint16Array ? bin.readUInt16LE(o) : bin.readUInt32LE(o); }
  return out; };
const p = json.meshes[0].primitives[0];
const pos = acc(p.attributes.POSITION), nor = acc(p.attributes.NORMAL), uv = acc(p.attributes.TEXCOORD_0); let idx = acc(p.indices);
console.log('verts', pos.length / 3, 'tris', idx.length / 3);
let mn = [9, 9, 9], mx = [-9, -9, -9]; for (let i = 0; i < pos.length; i += 3) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], pos[i + c]); mx[c] = Math.max(mx[c], pos[i + c]); } console.log('bbox', mn, mx);
for (let z = mn[2]; z < mx[2]; z += 0.05) { let lo = 9, hi = -9, w = 0; for (let i = 0; i < pos.length; i += 3) if (pos[i + 2] >= z && pos[i + 2] < z + 0.05) { lo = Math.min(lo, pos[i + 1]); hi = Math.max(hi, pos[i + 1]); w = Math.max(w, Math.abs(pos[i])); } console.log('z', z.toFixed(2), 'y', lo.toFixed(3), hi.toFixed(3), 'maxX', w.toFixed(3)); }
idx = Uint16Array.from(idx);
const norQ = new Int8Array(nor.length); for (let i = 0; i < nor.length; i++) norQ[i] = Math.round(nor[i] * 127);
const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const im = json.images[0], iv = json.bufferViews[im.bufferView]; const jpg = bin.slice(iv.byteOffset || 0, (iv.byteOffset || 0) + iv.byteLength);
fs.writeFileSync('src/boarmodel.js', `// Tripo로 생성한 멧돼지 B3 (약 1,500 삼각형으로 줄이고 텍스처 512로 다시 구움). model/bake-boar.py, model/extract-boar.js 로 생성\nexport const BM = { n: ${pos.length / 3}, pos: '${b64(pos)}', nor: '${b64(norQ)}', uv: '${b64(uv)}', idx: '${b64(idx)}', tex: 'data:${im.mimeType};base64,${jpg.toString('base64')}' };\n`);
console.log('wrote', (fs.statSync('src/boarmodel.js').size / 1024).toFixed(0) + 'KB');
