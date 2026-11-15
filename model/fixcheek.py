# 볼터치 지우기: 얼굴 앞면 볼 영역에서 피부↔분홍 선 위에 있는 텍셀을 주변 피부색으로 덮음 (lo 메시 UV 로 텍스처 공간에서 처리)
# 사용: python3 model/fixcheek.py model/lo4.glb model/tex4.jpg && node model/extract.js model/lo4.glb model/params.json model/tex4.jpg
import io, json, struct, sys, numpy as np
from PIL import Image, ImageFilter
GLB, OUT = sys.argv[1], sys.argv[2]
buf = open(GLB, 'rb').read(); jl = struct.unpack('<I', buf[12:16])[0]; js = json.loads(buf[20:20 + jl]); binb = buf[20 + jl + 8:]
def acc(i):
    a = js['accessors'][i]; v = js['bufferViews'][a['bufferView']]; n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
    dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}[a['componentType']]; off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return np.frombuffer(binb, dtype=dt, count=a['count'] * n, offset=off).reshape(-1, n).astype(np.float64 if dt == np.float32 else np.int64)
p = js['meshes'][0]['primitives'][0]; pos = acc(p['attributes']['POSITION']); uv = acc(p['attributes']['TEXCOORD_0']); idx = acc(p['indices']).reshape(-1, 3)
iv = js['bufferViews'][js['images'][0]['bufferView']]; o = iv.get('byteOffset', 0)
T = np.array(Image.open(io.BytesIO(binb[o:o + iv['byteLength']])).convert('RGB')).astype(np.float64); H, W = T.shape[:2]
# 텍셀마다 rest 위치 (머리 앞쪽 삼각형만, bake 여백까지 조금 넓혀서)
P3 = np.full((H, W, 3), np.nan)
for t in idx:
    P = pos[t]
    if P[:, 1].max() <= 0.5 or P[:, 2].max() <= 0: continue
    U = uv[t] * [W, H]; mn = np.floor(U.min(0)).astype(int) - 1; mx = np.ceil(U.max(0)).astype(int) + 1
    xs, ys = np.meshgrid(np.arange(max(mn[0], 0), min(mx[0], W - 1) + 1), np.arange(max(mn[1], 0), min(mx[1], H - 1) + 1)); q = np.stack([xs.ravel() + .5, ys.ravel() + .5], 1)
    d = (U[1, 1] - U[2, 1]) * (U[0, 0] - U[2, 0]) + (U[2, 0] - U[1, 0]) * (U[0, 1] - U[2, 1])
    if abs(d) < 1e-12: continue
    a = ((U[1, 1] - U[2, 1]) * (q[:, 0] - U[2, 0]) + (U[2, 0] - U[1, 0]) * (q[:, 1] - U[2, 1])) / d
    b = ((U[2, 1] - U[0, 1]) * (q[:, 0] - U[2, 0]) + (U[0, 0] - U[2, 0]) * (q[:, 1] - U[2, 1])) / d
    c = 1 - a - b; ok = (a >= -0.3) & (b >= -0.3) & (c >= -0.3)
    R = a[:, None] * P[0] + b[:, None] * P[1] + c[:, None] * P[2]
    P3[ys.ravel()[ok], xs.ravel()[ok]] = R[ok]
x, y, z = P3[..., 0], P3[..., 1], P3[..., 2]
box = (np.abs(x) > 0.05) & (np.abs(x) < 0.24) & (y > 0.55) & (y < 0.77) & (z > 0.03)  # 볼 둘레 (귀·눈 안쪽 제외)
c = T[box]; pk = (c[:, 0] - c[:, 1]) > 70
blush = np.median(c[pk], 0); skin = np.median(c[(~pk) & (np.abs(c - [232, 189, 154]).sum(1) < 60)], 0)
D = blush - skin; rel = T - skin; a = (rel @ D) / (D @ D)
perp = np.linalg.norm(rel - a[..., None] * D, axis=-1)
skinlike = box & (perp < 45) & (a > -0.6)  # 눈 흰자·검은자·머리카락은 건드리지 않음
core = skinlike & (a > 0.06)
dil = lambda m, k: np.array(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(k))) > 0
mask = dil(core, 7) & skinlike
rng = np.random.default_rng(1)
noise = np.array(Image.fromarray(np.clip(128 + rng.normal(0, 40, (H, W)), 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float64) - 128
fill = skin + noise[..., None] * 0.12  # 주변 피부 결 정도의 잔잔한 얼룩
soft = np.array(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float64)[..., None] / 255
soft = soft * skinlike[..., None]; soft[mask] = 1
out = T * (1 - soft) + fill * soft
print('blush', blush, 'skin', skin, 'masked texels', mask.sum())
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(OUT, quality=76)  # 원본과 비슷한 크기
