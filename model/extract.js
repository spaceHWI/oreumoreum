const fs = require('fs');
const IN = process.argv[2] || 'model/lo.glb'; const PARAMS = JSON.parse(fs.readFileSync(process.argv[3] || 'model/params.json', 'utf8'));
const buf = fs.readFileSync(IN);
const jsonLen = buf.readUInt32LE(12); const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString());
const bin = buf.slice(20 + jsonLen + 8);
const acc = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView]; const n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type]; const off = (v.byteOffset || 0) + (a.byteOffset || 0);
  const T = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[a.componentType]; const out = new T(a.count * n); const stride = v.byteStride || T.BYTES_PER_ELEMENT * n;
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) { const o = off + k * stride + c * T.BYTES_PER_ELEMENT; out[k * n + c] = T === Float32Array ? bin.readFloatLE(o) : T === Uint16Array ? bin.readUInt16LE(o) : bin.readUInt32LE(o); }
  return out; };
const p = json.meshes[0].primitives[0];
const pos = acc(p.attributes.POSITION), nor = acc(p.attributes.NORMAL), uv = acc(p.attributes.TEXCOORD_0); let idx = acc(p.indices);
console.log('verts', pos.length / 3, 'tris', idx.length / 3, 'node', JSON.stringify(json.nodes));
let mn = [9, 9, 9], mx = [-9, -9, -9]; for (let i = 0; i < pos.length; i += 3) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], pos[i + c]); mx[c] = Math.max(mx[c], pos[i + c]); } console.log('bbox', mn, mx);
// width profile: for y slices, max |x|
for (let y = 0; y < 1; y += 0.04) { let w = 0, zf = 0; for (let i = 0; i < pos.length; i += 3) if (pos[i + 1] >= y && pos[i + 1] < y + 0.04) { w = Math.max(w, Math.abs(pos[i])); zf = Math.max(zf, pos[i + 2]); } console.log(y.toFixed(2), 'maxX', w.toFixed(3), 'maxZ', zf.toFixed(3)); }
// 코 돌기 평탄화 (params.noseFlat)
if (PARAMS.noseFlat) { const f = PARAMS.noseFlat; let n = 0; for (let i = 0; i < pos.length; i += 3) { const x = pos[i], y = pos[i + 1], z = pos[i + 2]; if (Math.abs(x) < f.x && y > f.y0 && y < f.y1 && z > 0.2) { const zr = f.z0 + (y - f.y0) / (f.y1 - f.y0) * (f.z1 - f.z0) - x * x * 0.6; if (z > zr) { pos[i + 2] = zr; const l = Math.hypot(x * 0.8, 0.05, 1); nor[i] = x * 0.8 / l; nor[i + 1] = 0.05 / l; nor[i + 2] = 1 / l; n++; } } } console.log('nose verts flattened', n); }
// 입 홈 메우기 (params.mouthFill): 홈을 주변 면 높이로 올리고 법선을 매끈하게
if (PARAMS.mouthFill) { const f = PARAMS.mouthFill; let n = 0; for (let i = 0; i < pos.length; i += 3) { const x = pos[i], y = pos[i + 1], z = pos[i + 2]; if (Math.abs(x) < f.x && y > f.y0 && y < f.y1 && z > 0.18) { const zr = f.z0 + (y - f.y0) / (f.y1 - f.y0) * (f.z1 - f.z0) - x * x * f.k; const edge = Math.min(1, (f.x - Math.abs(x)) / 0.02, (y - f.y0) / 0.012, (f.y1 - y) / 0.012); pos[i + 2] = z + (zr - z) * Math.max(0, edge); const l = Math.hypot(x * 1.6, -0.3, 1); const t = Math.max(0, edge); nor[i] += (x * 1.6 / l - nor[i]) * t; nor[i + 1] += (-0.3 / l - nor[i + 1]) * t; nor[i + 2] += (1 / l - nor[i + 2]) * t; n++; } } console.log('mouth verts', n); }
if (pos.length / 3 < 65536) idx = Uint16Array.from(idx);
const norQ = new Int8Array(nor.length); for (let i = 0; i < nor.length; i++) norQ[i] = Math.round(nor[i] * 127);
const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const im = json.images[0], iv = json.bufferViews[im.bufferView]; let jpg = bin.slice(iv.byteOffset || 0, (iv.byteOffset || 0) + iv.byteLength);
if (process.argv[4]) jpg = fs.readFileSync(process.argv[4]);
console.log('jpg', jpg.length, im.mimeType);
fs.writeFileSync('src/runnermodel.js', `// Tripo로 생성한 기본 캐릭터 (9천 삼각형으로 줄이고 텍스처를 다시 구움). model/bake.py, model/extract.js 로 생성\nexport const RM = { P: ${JSON.stringify(PARAMS)}, n: ${pos.length / 3}, pos: '${b64(pos)}', nor: '${b64(norQ)}', uv: '${b64(uv)}', idx: '${b64(idx)}', idx16: ${idx instanceof Uint16Array}, tex: 'data:${im.mimeType};base64,${jpg.toString('base64')}' };\n`);
console.log('wrote', (fs.statSync('src/runnermodel.js').size / 1024).toFixed(0) + 'KB');
