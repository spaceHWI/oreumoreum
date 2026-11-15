# 코·입 지우기: 얼굴 앞면의 코/입 영역 텍셀을 주변 피부색으로 덮음 (lo 메시의 UV로 텍스처 공간에서 처리)
import json, struct, sys, numpy as np
from PIL import Image, ImageFilter
GLB, PNG, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
buf = open(GLB, 'rb').read(); jl = struct.unpack('<I', buf[12:16])[0]; js = json.loads(buf[20:20 + jl]); binb = buf[20 + jl + 8:]
def acc(i):
    a = js['accessors'][i]; v = js['bufferViews'][a['bufferView']]; n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
    dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}[a['componentType']]; off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return np.frombuffer(binb, dtype=dt, count=a['count'] * n, offset=off).reshape(-1, n).astype(np.float64 if dt == np.float32 else np.int64)
p = js['meshes'][0]['primitives'][0]; pos = acc(p['attributes']['POSITION']); uv = acc(p['attributes']['TEXCOORD_0']); idx = acc(p['indices']).reshape(-1, 3)
img = Image.open(PNG).convert('RGB'); W, H = img.size; px = np.array(img).astype(np.float64)
BOX = json.loads(sys.argv[4])  # [[x0,x1,y0,y1], ...] in rest space, front face (z>0)
RING = json.loads(sys.argv[5])  # [x0,x1,y0,y1] 피부색을 뽑을 넓은 영역
mask = np.zeros((H, W), bool); ring = np.zeros((H, W), bool)
def inbox(P, b): return (P[:, 0] > b[0]) & (P[:, 0] < b[1]) & (P[:, 1] > b[2]) & (P[:, 1] < b[3]) & (P[:, 2] > 0.1)
for t in idx:
    P = pos[t]; 
    if P[:, 2].max() < 0.1 or P[:, 1].min() > RING[3] + 0.02 or P[:, 1].max() < RING[2] - 0.02 or abs(P[:, 0]).min() > 0.2: continue
    U = uv[t] * [W, H]; mn = np.floor(U.min(0)).astype(int) - 1; mx = np.ceil(U.max(0)).astype(int) + 1
    xs, ys = np.meshgrid(np.arange(max(mn[0], 0), min(mx[0], W - 1) + 1), np.arange(max(mn[1], 0), min(mx[1], H - 1) + 1)); q = np.stack([xs.ravel() + 0.5, ys.ravel() + 0.5], 1)
    d = (U[1, 1] - U[2, 1]) * (U[0, 0] - U[2, 0]) + (U[2, 0] - U[1, 0]) * (U[0, 1] - U[2, 1])
    if abs(d) < 1e-9: continue
    a = ((U[1, 1] - U[2, 1]) * (q[:, 0] - U[2, 0]) + (U[2, 0] - U[1, 0]) * (q[:, 1] - U[2, 1])) / d
    b = ((U[2, 1] - U[0, 1]) * (q[:, 0] - U[2, 0]) + (U[0, 0] - U[2, 0]) * (q[:, 1] - U[2, 1])) / d
    c = 1 - a - b; ok = (a >= -0.15) & (b >= -0.15) & (c >= -0.15)
    R = a[:, None] * P[0] + b[:, None] * P[1] + c[:, None] * P[2]
    m = np.zeros(len(q), bool)
    for bx in BOX: m |= inbox(R, bx)
    r = inbox(R, RING) & ~m
    yy, xx = ys.ravel()[ok & m], xs.ravel()[ok & m]; mask[yy, xx] = True
    yy, xx = ys.ravel()[ok & r], xs.ravel()[ok & r]; ring[yy, xx] = True
ring &= ~mask
rc = px[ring]; lum = rc.sum(1); skin = np.median(rc[(lum > np.percentile(lum, 40))], 0)  # 눈·눈썹 같은 어두운 텍셀 제외한 피부 중간값
print('mask texels', mask.sum(), 'ring', ring.sum(), 'skin', skin.round())
big = np.array(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0
out = px.copy(); out[big] = skin; mask = big
# 가장자리를 살짝 부드럽게
sm = np.array(Image.fromarray(out.astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))).astype(np.float64)
soft = np.array(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(2))).astype(np.float64)[..., None] / 255
out = out * (1 - soft) + sm * soft; out[mask] = sm[mask]
Image.fromarray(out.astype(np.uint8)).save(OUT, quality=84)
