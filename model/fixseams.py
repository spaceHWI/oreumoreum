# UV 이음매 선 정리 (#27): lo 메시 UV 로 텍스처 공간에서 처리
#  1) 이음매 양쪽 색 맞추기: 같은 3D 모서리를 가진 두 UV 모서리를 따라 안쪽 색을 비교해, 차이의 반씩을 양쪽 섬 안으로 부드럽게(가우스) 번지게 더함
#  2) 섬 바깥 채우기: 섬 밖 텍셀(검정 배경·좁은 bake 여백)을 가장 가까운 섬 텍셀 색으로 끝까지 채움 → 밉맵·필터에서 검정·이웃 섬 색이 번지지 않음
# 사용: python3 model/fixseams.py model/lo4.glb model/tex4.jpg model/tex5.jpg && node model/extract.js model/lo4.glb model/params.json model/tex5.jpg
import json, struct, sys, numpy as np
from PIL import Image
from scipy import ndimage
GLB, SRC, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
SIG = 3.0      # 색 맞춤이 섬 안으로 번지는 폭(px)
INSET = 1.2    # 이음매에서 안쪽으로 이만큼 들어가 색을 읽음(px)
GATE = (50, 100)  # 양쪽 색 차이(RGB 합)가 이보다 작으면 맞추고, 크면 원래 경계로 보고 둠
buf = open(GLB, 'rb').read(); jl = struct.unpack('<I', buf[12:16])[0]; js = json.loads(buf[20:20 + jl]); binb = buf[20 + jl + 8:]
def acc(i):
    a = js['accessors'][i]; v = js['bufferViews'][a['bufferView']]; n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
    dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}[a['componentType']]; off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return np.frombuffer(binb, dtype=dt, count=a['count'] * n, offset=off).reshape(-1, n).astype(np.float64 if dt == np.float32 else np.int64)
p = js['meshes'][0]['primitives'][0]; pos = acc(p['attributes']['POSITION']); uv = acc(p['attributes']['TEXCOORD_0']); idx = acc(p['indices']).reshape(-1, 3)
T = np.array(Image.open(SRC).convert('RGB')).astype(np.float64); H, W = T.shape[:2]
U = uv * [W, H]

# 섬: 정점 번호를 공유하는 삼각형끼리 (glb 는 UV 이음매에서 정점이 나뉨)
par = np.arange(len(uv))
def find(a):
    while par[a] != a: par[a] = par[par[a]]; a = par[a]
    return a
for t in idx:
    r = [find(k) for k in t]
    for k in r[1:]: par[k] = r[0]
tri_isl = np.array([find(t[0]) for t in idx]); _, tri_isl = np.unique(tri_isl, return_inverse=True); tri_isl += 1

# 섬 번호 지도: 텍셀 중심이 삼각형 안(가장자리 0.75px 여유)이면 그 섬
isl = np.zeros((H, W), np.int32); EPS = 0.75
for ti, t in enumerate(idx):
    P = U[t]; mn = np.floor(P.min(0) - 1).astype(int); mx = np.ceil(P.max(0) + 1).astype(int)
    xs, ys = np.meshgrid(np.arange(max(mn[0], 0), min(mx[0], W - 1) + 1), np.arange(max(mn[1], 0), min(mx[1], H - 1) + 1)); q = np.stack([xs.ravel() + .5, ys.ravel() + .5], 1)
    inside = np.ones(len(q), bool)
    for i in range(3):
        a, b, c = P[i], P[(i + 1) % 3], P[(i + 2) % 3]; e = b - a; n = np.array([-e[1], e[0]]); L = np.hypot(*n)
        if L < 1e-9: inside[:] = False; break
        n /= L
        if (c - a) @ n < 0: n = -n
        inside &= (q - a) @ n >= -EPS
    yy, xx = ys.ravel()[inside], xs.ravel()[inside]
    isl[yy, xx] = np.where(isl[yy, xx] == 0, tri_isl[ti], isl[yy, xx])
cov = isl > 0
print('islands', tri_isl.max(), 'coverage', round(cov.mean(), 3))

# 0) 볼터치 남은 테두리: #24 에서 덮고 남은 분홍 테두리가 섬 가장자리를 따라 선처럼 보임 → 얼굴 앞(볼 둘레)의 피부색 텍셀에서 분홍 성분만 뺌 (명암 결은 유지)
P3 = np.full((H, W, 3), np.nan)
for ti, t in enumerate(idx):
    P = pos[t]
    if P[:, 1].max() <= 0.5 or P[:, 2].max() <= -0.05: continue
    Q = U[t]; mn = np.floor(Q.min(0)).astype(int) - 2; mx = np.ceil(Q.max(0)).astype(int) + 2
    xs, ys = np.meshgrid(np.arange(max(mn[0], 0), min(mx[0], W - 1) + 1), np.arange(max(mn[1], 0), min(mx[1], H - 1) + 1)); q = np.stack([xs.ravel() + .5, ys.ravel() + .5], 1)
    d = (Q[1, 1] - Q[2, 1]) * (Q[0, 0] - Q[2, 0]) + (Q[2, 0] - Q[1, 0]) * (Q[0, 1] - Q[2, 1])
    if abs(d) < 1e-12: continue
    a = ((Q[1, 1] - Q[2, 1]) * (q[:, 0] - Q[2, 0]) + (Q[2, 0] - Q[1, 0]) * (q[:, 1] - Q[2, 1])) / d; b = ((Q[2, 1] - Q[0, 1]) * (q[:, 0] - Q[2, 0]) + (Q[0, 0] - Q[2, 0]) * (q[:, 1] - Q[2, 1])) / d; c = 1 - a - b
    ok = (a >= -0.3) & (b >= -0.3) & (c >= -0.3); Rr = (a[:, None] * P[0] + b[:, None] * P[1] + c[:, None] * P[2])[ok]
    yy, xx = ys.ravel()[ok], xs.ravel()[ok]; keep = np.isnan(P3[yy, xx, 0]) | (isl[yy, xx] == tri_isl[ti]); P3[yy[keep], xx[keep]] = Rr[keep]
X, Y, Z = P3[..., 0], P3[..., 1], P3[..., 2]
face = (np.abs(X) < 0.235) & (Y > 0.55) & (Y < 0.82) & (Z > -0.02)
SKIN = np.array([232, 188, 153.])
mx_ = T.max(-1); mn_ = T.min(-1); sat = (mx_ - mn_) / np.maximum(mx_, 1)
hue = np.where(mx_ == T[..., 0], ((T[..., 1] - T[..., 2]) / np.maximum(mx_ - mn_, 1)) / 6, 0.5)  # 빨강이 가장 클 때만 (피부·분홍)
pinkm = face & (mx_ == T[..., 0]) & (hue > -0.12) & (hue < 0.12) & (sat > 0.1) & (sat < 0.62) & (mx_ > 150)
lum = T @ [0.3, 0.59, 0.11]; tgt = SKIN * (lum / (SKIN @ [0.3, 0.59, 0.11]))[..., None]  # 밝기 결은 두고 색만 피부색으로
T = np.where(pinkm[..., None], tgt, T)
print('de-pinked texels', pinkm.sum())

# 읽기용: 섬 밖을 먼저 가까운 섬 색으로 채우고 살짝 흐림 (JPEG 잡음·여백 영향 줄임)
def fill(img, m):
    _, (iy, ix) = ndimage.distance_transform_edt(~m, return_indices=True); return img[iy, ix]
Tf = fill(T, cov); Tb = np.stack([ndimage.gaussian_filter(Tf[..., c], 1.0) for c in range(3)], -1)
def bil(img, pts):
    x = np.clip(pts[:, 0] - .5, 0, W - 1.001); y = np.clip(pts[:, 1] - .5, 0, H - 1.001); x0 = x.astype(int); y0 = y.astype(int); fx = (x - x0)[:, None]; fy = (y - y0)[:, None]
    return (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x0 + 1] * fx * (1 - fy) + img[y0 + 1, x0] * (1 - fx) * fy + img[y0 + 1, x0 + 1] * fx * fy)

# 이음매 모서리 찾기: 3D 위치가 같은 모서리인데 UV 가 다른 것
key = {}; pk = [tuple(np.round(P, 5)) for P in pos]; pid = {}
vid = np.array([pid.setdefault(k, len(pid)) for k in pk])
edges = {}
for ti, t in enumerate(idx):
    for i in range(3):
        a, b, c = t[i], t[(i + 1) % 3], t[(i + 2) % 3]
        k = (min(vid[a], vid[b]), max(vid[a], vid[b]))
        if vid[a] > vid[b]: a, b = b, a
        edges.setdefault(k, []).append((a, b, c, ti))
accD = np.zeros((H, W, 3)); accW = np.zeros((H, W)); R = int(np.ceil(SIG * 3)); gk = np.arange(-R, R + 1)
nseam = 0; diffs = []
def side(a, b, c, n):
    A, B, C = U[a], U[b], U[c]; t = np.linspace(0, 1, n)[:, None]; P = A + (B - A) * t
    e = B - A; nn = np.array([-e[1], e[0]]) / max(np.hypot(*e), 1e-9)
    if (C - A) @ nn < 0: nn = -nn
    return P, P + nn * INSET
for k, lst in edges.items():
    if len(lst) != 2: continue
    (a1, b1, c1, t1), (a2, b2, c2, t2) = lst
    if np.allclose(U[a1], U[a2]) and np.allclose(U[b1], U[b2]): continue  # 이음매 아님
    n = int(max(np.hypot(*(U[b1] - U[a1])), np.hypot(*(U[b2] - U[a2]))) / 0.7) + 2
    P1, S1 = side(a1, b1, c1, n); P2, S2 = side(a2, b2, c2, n)
    c1v, c2v = bil(Tb, S1), bil(Tb, S2); d = c2v - c1v
    if n >= 5: d = ndimage.uniform_filter1d(d, 3, axis=0, mode='nearest')
    diffs.append(np.abs(d).sum(1).mean()); nseam += 1
    m = np.abs(d).sum(1); d = d * np.clip((GATE[1] - m) / (GATE[1] - GATE[0]), 0, 1)[:, None]  # 큰 차이는 원래 색 경계(모자↔머리 등)라 그대로 둠
    for P, dd, isn in ((P1, d / 2, tri_isl[t1]), (P2, -d / 2, tri_isl[t2])):
        for j in range(n):
            cx, cy = int(P[j, 0]), int(P[j, 1])
            x0, x1, y0, y1 = max(cx - R, 0), min(cx + R + 1, W), max(cy - R, 0), min(cy + R + 1, H)
            gx = np.exp(-((np.arange(x0, x1) + .5 - P[j, 0]) ** 2) / (2 * SIG * SIG)); gy = np.exp(-((np.arange(y0, y1) + .5 - P[j, 1]) ** 2) / (2 * SIG * SIG))
            w = gy[:, None] * gx[None, :] * (isl[y0:y1, x0:x1] == isn)
            accW[y0:y1, x0:x1] += w; accD[y0:y1, x0:x1] += w[..., None] * dd[j]
diffs = np.array(diffs)
W0 = SIG * np.sqrt(2 * np.pi) / 0.7 * 0.8  # 이음매 위에서의 대략 가중치 합
corr = accD / np.maximum(accW, W0)[..., None]
out = T + corr * cov[..., None]
out = fill(out, cov)  # 섬 밖은 가까운 섬 색으로
print('seam edges', nseam, 'mean |diff| before', diffs.mean().round(1), 'p90', np.percentile(diffs, 90).round(1))
Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8)).save(OUT, quality=86)
# 결과 측정
T2 = np.array(Image.open(OUT).convert('RGB')).astype(np.float64); Tb2 = np.stack([ndimage.gaussian_filter(T2[..., c], 1.0) for c in range(3)], -1); d2 = []
for k, lst in edges.items():
    if len(lst) != 2: continue
    (a1, b1, c1, t1), (a2, b2, c2, t2) = lst
    if np.allclose(U[a1], U[a2]) and np.allclose(U[b1], U[b2]): continue
    n = int(max(np.hypot(*(U[b1] - U[a1])), np.hypot(*(U[b2] - U[a2]))) / 0.7) + 2
    _, S1 = side(a1, b1, c1, n); _, S2 = side(a2, b2, c2, n); d2.append(np.abs(bil(Tb2, S2) - bil(Tb2, S1)).sum(1).mean())
d2 = np.array(d2); sm = diffs < GATE[0]
print('small seams', sm.sum(), 'mean |diff| before', diffs[sm].mean().round(1), 'after', d2[sm].mean().round(1), '| all after', d2.mean().round(1))
