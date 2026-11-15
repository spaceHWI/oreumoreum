// glb 장비 → src/gear/<이름>.js (장비 데이터). 기본 캐릭터와 같은 T포즈·크기(키 0.98, 발바닥 y 0, 얼굴 +z)로 만든 glb 를 넣는다
// node model/extract-gear.js 입력.glb 이름
// 만든 뒤 src/gear.js 의 ACCESSORIES 에 { slot, label, bone 또는 skin, hide, build: fromData(데이터) } 로 등록
const fs = require('fs');
const [IN, NAME] = process.argv.slice(2);
if (!IN || !NAME) { console.log('node model/extract-gear.js 입력.glb 이름'); process.exit(1); }
const buf = fs.readFileSync(IN);
const jsonLen = buf.readUInt32LE(12); const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString());
const bin = buf.slice(20 + jsonLen + 8);
const acc = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView]; const n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type]; const off = (v.byteOffset || 0) + (a.byteOffset || 0);
  const T = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[a.componentType]; const out = new T(a.count * n); const stride = v.byteStride || T.BYTES_PER_ELEMENT * n;
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) { const o = off + k * stride + c * T.BYTES_PER_ELEMENT; out[k * n + c] = T === Float32Array ? bin.readFloatLE(o) : T === Uint16Array ? bin.readUInt16LE(o) : bin.readUInt32LE(o); }
  return out; };
const p = json.meshes[0].primitives[0];
const pos = acc(p.attributes.POSITION), nor = acc(p.attributes.NORMAL), uv = p.attributes.TEXCOORD_0 !== undefined ? acc(p.attributes.TEXCOORD_0) : null; let idx = acc(p.indices);
if (pos.length / 3 < 65536) idx = Uint16Array.from(idx);
const norQ = new Int8Array(nor.length); for (let i = 0; i < nor.length; i++) norQ[i] = Math.round(nor[i] * 127);
const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
let tex = null; if (json.images?.length) { const im = json.images[0], iv = json.bufferViews[im.bufferView]; tex = `data:${im.mimeType};base64,${bin.slice(iv.byteOffset || 0, (iv.byteOffset || 0) + iv.byteLength).toString('base64')}`; }
fs.mkdirSync('src/gear', { recursive: true });
fs.writeFileSync(`src/gear/${NAME}.js`, `// ${IN} 에서 model/extract-gear.js 로 생성\nexport default { pos: '${b64(pos)}', nor: '${b64(norQ)}', uv: ${uv ? `'${b64(uv)}'` : 'null'}, idx: '${b64(idx)}', idx16: ${idx instanceof Uint16Array}, tex: ${tex ? `'${tex}'` : 'null'} };\n`);
console.log('wrote', `src/gear/${NAME}.js`, (pos.length / 3) + ' verts', (idx.length / 3) + ' tris');
