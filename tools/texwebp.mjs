// 텍스처 webp 바꿔 두기 (#293): node tools/texwebp.mjs → 모델 텍스처(jpg)를 webp 로 구워 assets/tex/<jpg 해시>.webp 에 둔다 (python3 Pillow 필요, 이 도구만)
// 빌드(packassets.mjs)는 jpg 해시가 같은 webp 가 있을 때만 그것을 쓴다 → 빌드에는 인코더가 필요 없고, 원본 jpg 가 바뀌면 저절로 jpg 로 돌아감 (다시 돌리면 새로 구움)
// 고르는 기준: webp 가 jpg 의 85% 이하이고, jpg 와 견준 PSNR 이 36dB 이상일 때만 (그 밖은 jpg 그대로). 품질은 82, 1024 텍스처는 86
import { ASSET_SRC } from './packassets.mjs';
import path from 'path'; import fs from 'fs'; import os from 'os'; import crypto from 'crypto'; import { execFileSync } from 'child_process';
const DIR = path.resolve('assets/tex'); fs.mkdirSync(DIR, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'texwebp-'));
const PY = `import sys,io,math
from PIL import Image
import numpy as np
src,dst=sys.argv[1],sys.argv[2]
im=Image.open(src).convert('RGB'); q=86 if max(im.size)>=1024 else 82
b=io.BytesIO(); im.save(b,'WEBP',quality=q,method=6); w=b.getvalue()
d=np.asarray(im,float)-np.asarray(Image.open(io.BytesIO(w)).convert('RGB'),float); mse=(d**2).mean()
ps=10*math.log10(255**2/mse) if mse else 99
open(dst,'wb').write(w); print(len(w), round(ps,1))`;
const keep = new Set(); let t0 = 0, t1 = 0;
for (const [name, file, exp, shape] of ASSET_SRC) {
  if (!shape) continue;
  const M = (await import(path.resolve('src', file)))[exp];
  const m = /^data:image\/jpe?g;base64,(.*)$/.exec(M.tex || ''); if (!m) continue;
  const jpg = Buffer.from(m[1], 'base64'), h = crypto.createHash('sha256').update(jpg).digest('hex').slice(0, 16);
  const out = path.join(DIR, h + '.webp'); t0 += jpg.length;
  if (fs.existsSync(out)) { keep.add(h + '.webp'); t1 += fs.statSync(out).size; console.log(name.padEnd(22), 'webp (있음)', jpg.length, '→', fs.statSync(out).size); continue; }
  const j = path.join(tmp, h + '.jpg'), w = path.join(tmp, h + '.webp'); fs.writeFileSync(j, jpg);
  const [sz, ps] = execFileSync('python3', ['-c', PY, j, w]).toString().trim().split(' ').map(Number);
  if (sz <= jpg.length * 0.85 && ps >= 36) { fs.copyFileSync(w, out); keep.add(h + '.webp'); t1 += sz; console.log(name.padEnd(22), 'webp', jpg.length, '→', sz, ps + 'dB'); }
  else { t1 += jpg.length; console.log(name.padEnd(22), 'jpg 그대로', jpg.length, '(webp', sz, ps + 'dB)'); }
}
for (const f of fs.readdirSync(DIR)) if (!keep.has(f)) { fs.rmSync(path.join(DIR, f)); console.log('지움', f); }
fs.rmSync(tmp, { recursive: true, force: true });
console.log('텍스처', t0, '→', t1, (100 * t1 / t0).toFixed(0) + '%');
