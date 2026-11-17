// Tripo 모델 GLB(bake-prop.py 결과) → src/<출력>.js (#71). 위치·UV 는 16비트로 줄여 담음, 텍스처는 JPEG 그대로
// 사용: node model/extract-prop.js <입력.glb> <출력.js> <이름> "<설명 한 줄>" [JPEG 품질(다시 압축, python3 PIL)]
const fs = require('fs');
const [IN, OUT, NAME, NOTE, Q] = process.argv.slice(2);
const buf = fs.readFileSync(IN);
const jsonLen = buf.readUInt32LE(12); const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString());
const bin = buf.slice(20 + jsonLen + 8);
const acc = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView]; const n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type]; const off = (v.byteOffset || 0) + (a.byteOffset || 0);
  const T = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[a.componentType]; const out = new T(a.count * n); const stride = v.byteStride || T.BYTES_PER_ELEMENT * n;
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) { const o = off + k * stride + c * T.BYTES_PER_ELEMENT; out[k * n + c] = T === Float32Array ? bin.readFloatLE(o) : T === Uint16Array ? bin.readUInt16LE(o) : bin.readUInt32LE(o); }
  return out; };
const p = json.meshes[0].primitives[0];
const pos = acc(p.attributes.POSITION), nor = acc(p.attributes.NORMAL), uv = acc(p.attributes.TEXCOORD_0), idx = acc(p.indices);
const n = pos.length / 3; if (n > 65535) throw new Error('too many verts');
const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < pos.length; i += 3) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], pos[i + c]); mx[c] = Math.max(mx[c], pos[i + c]); }
console.log(NAME, 'verts', n, 'tris', idx.length / 3, 'bbox', mn.map((v) => v.toFixed(3)), mx.map((v) => v.toFixed(3)));
const posQ = new Uint16Array(pos.length); for (let i = 0; i < pos.length; i++) { const c = i % 3; posQ[i] = Math.round((pos[i] - mn[c]) / (mx[c] - mn[c] || 1) * 65535); }
const uvQ = new Uint16Array(uv.length); for (let i = 0; i < uv.length; i++) uvQ[i] = Math.round(Math.min(1, Math.max(0, uv[i])) * 65535);
const norQ = new Int8Array(nor.length); for (let i = 0; i < nor.length; i++) norQ[i] = Math.round(nor[i] * 127);
const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const im = json.images[0], iv = json.bufferViews[im.bufferView]; let jpg = bin.slice(iv.byteOffset || 0, (iv.byteOffset || 0) + iv.byteLength);
if (Q) { // 텍스처를 더 낮은 품질로 다시 압축 (번들 크기)
  const tmp = require('os').tmpdir() + '/prop-tex'; fs.writeFileSync(tmp + '.in', jpg);
  require('child_process').execFileSync('python3', ['-c', `from PIL import Image; Image.open('${tmp}.in').convert('RGB').save('${tmp}.jpg', quality=${+Q}, optimize=True, progressive=True)`]);
  jpg = fs.readFileSync(tmp + '.jpg'); im.mimeType = 'image/jpeg';
}
const r = (v) => +v.toFixed(5);
fs.writeFileSync(OUT, `// ${NOTE} model/bake-prop.py, model/extract-prop.js 로 생성 (src/propmodel.js 가 풂)\nexport const ${NAME} = { n: ${n}, min: [${mn.map(r)}], max: [${mx.map(r)}], pos: '${b64(posQ)}', nor: '${b64(norQ)}', uv: '${b64(uvQ)}', idx: '${b64(Uint16Array.from(idx))}', tex: 'data:${im.mimeType};base64,${jpg.toString('base64')}' };\n`);
console.log('wrote', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + 'KB', 'tex', (jpg.length / 1024).toFixed(0) + 'KB');
