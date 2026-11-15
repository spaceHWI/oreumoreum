// 돌담 조각 GLB 두 벌(bake-wall.py 결과) → src/wallmodel.js. 사용: node model/extract-wall.js model/wall-near.glb model/wall-far.glb
const fs = require('fs');
function read(file) {
  const buf = fs.readFileSync(file);
  const jsonLen = buf.readUInt32LE(12); const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString());
  const bin = buf.slice(20 + jsonLen + 8);
  const acc = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView]; const n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type]; const off = (v.byteOffset || 0) + (a.byteOffset || 0);
    const T = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[a.componentType]; const out = new T(a.count * n); const stride = v.byteStride || T.BYTES_PER_ELEMENT * n;
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) { const o = off + k * stride + c * T.BYTES_PER_ELEMENT; out[k * n + c] = T === Float32Array ? bin.readFloatLE(o) : T === Uint16Array ? bin.readUInt16LE(o) : bin.readUInt32LE(o); }
    return out; };
  const p = json.meshes[0].primitives[0];
  const pos = acc(p.attributes.POSITION), nor = acc(p.attributes.NORMAL), uv = acc(p.attributes.TEXCOORD_0), idx = Uint16Array.from(acc(p.indices));
  const mn = [9, 9, 9], mx = [-9, -9, -9]; for (let i = 0; i < pos.length; i += 3) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], pos[i + c]); mx[c] = Math.max(mx[c], pos[i + c]); }
  console.log(file, 'verts', pos.length / 3, 'tris', idx.length / 3, 'bbox', mn.map((v) => v.toFixed(3)), mx.map((v) => v.toFixed(3)));
  const norQ = new Int8Array(nor.length); for (let i = 0; i < nor.length; i++) norQ[i] = Math.round(nor[i] * 127);
  const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
  const im = json.images[0], iv = json.bufferViews[im.bufferView]; const jpg = bin.slice(iv.byteOffset || 0, (iv.byteOffset || 0) + iv.byteLength);
  return `{ n: ${pos.length / 3}, size: [${mx.map((v, c) => +(v - mn[c]).toFixed(4))}], pos: '${b64(pos)}', nor: '${b64(norQ)}', uv: '${b64(uv)}', idx: '${b64(idx)}', tex: 'data:${im.mimeType};base64,${jpg.toString('base64')}' }`;
}
const near = read(process.argv[2] || 'model/wall-near.glb'), far = read(process.argv[3] || 'model/wall-far.glb');
fs.writeFileSync('src/wallmodel.js', `// Tripo로 생성한 현무암 돌담 조각 (#39). 원본 크기 상자를 겉면에 붙여 가까이용 400·멀리용 48 삼각형, 텍스처 512·256으로 다시 구움\n// model/bake-wall.py, model/extract-wall.js 로 생성. x = 길이, y = 높이(바닥 0), z = 두께\nexport const WM_NEAR = ${near};\nexport const WM_FAR = ${far};\n`);
console.log('wrote', (fs.statSync('src/wallmodel.js').size / 1024).toFixed(0) + 'KB');
