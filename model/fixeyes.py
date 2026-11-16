# 머리 3종(#51) 눈을 기본 캐릭터 눈과 같게 (#54)
# python3 model/fixeyes.py [short bob bun]
# - 기본 캐릭터(src/runnermodel.js) 얼굴을 정면(+z)에서 직교 투영해 눈(피부가 아닌 곳)만 뽑음
# - 머리 텍셀마다 3D 위치를 구해, 같은 (x, y) 의 기본 캐릭터 눈 색을 그대로 옮김 → 눈 크기·간격·높이가 같아짐
# - 기본 눈 윗끝(y 0.80)이 앞머리에 가리지 않게 가운데 앞머리를 HAIRLINE 까지 올림. 튀어나온 앞머리 면은 이마 면으로 눌러 넣음
# - 예전 눈 자리·앞머리 자리는 피부색, 얼굴 얼룩(피부색 범위를 벗어나 피부색 바꾸기를 안 받는 밝은 텍셀)도 피부색으로
# - 섬 밖 여백 텍셀은 가장 가까운 섬 색으로 채움
# 입력은 src/gear/head-<이름>.js (model/bake-head.py → extract-gear.js 결과). 같은 파일에 위치·법선·텍스처를 다시 씀
import sys, re, base64, colorsys
import numpy as np
from scipy import ndimage
sys.path.insert(0, 'model')
from meshjs import load, save_tex, bary_raster, sample, front_view

HAIRLINE = 0.815      # 가운데 앞머리 아래 끝 (기본 눈 윗끝 0.80 + 여유)
FLAT_X, EDGE_X = 0.10, 0.165  # 앞머리 끝: |x| FLAT_X 까지 곧게, EDGE_X 에서 SIDE_Y 로 둥글게 내려옴. 그 바깥(옆머리)은 그대로
SIDE_Y = 0.745
SOFT = 0.003          # 지우는 경계를 부드럽게 (3D 단위, 약 1.3 텍셀)
EYE_BOX = (-0.17, 0.17, 0.6, 0.83)

def hsv(c):
    c = np.clip(c / 255.0, 0, 1); mx = c.max(-1); mn = c.min(-1); d = mx - mn
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    h = np.where(d < 1e-6, 0, np.where(mx == r, ((g - b) / np.maximum(d, 1e-6)) % 6, np.where(mx == g, (b - r) / np.maximum(d, 1e-6) + 2, (r - g) / np.maximum(d, 1e-6) + 4))) / 6
    return h, d / np.maximum(mx, 1e-6), mx
ss = lambda a, b, x: np.clip((x - a) / (b - a), 0, 1) ** 2 * (3 - 2 * np.clip((x - a) / (b - a), 0, 1))
def skinness(c):  # runner.js skinGLSL 과 같은 식
    h, s, v = hsv(c)
    return ss(0.035, 0.05, h) * (1 - ss(0.088, 0.098, h)) * ss(0.14, 0.2, s) * (1 - ss(0.5, 0.58, s)) * ss(0.62, 0.72, v)

def cut_y(ax):  # 앞머리를 올릴 선: 가운데는 곧게, 끝은 타원으로 둥글게
    t = np.clip((ax - FLAT_X) / (EDGE_X - FLAT_X), 0, 1); return SIDE_Y + (HAIRLINE - SIDE_Y) * np.sqrt(1 - t * t)
def clear_w(x, y):  # 얼굴에서 지울(피부로 바꿀) 정도 0..1: 앞머리선 아래 · |x| EDGE_X 안 · y 0.6 위
    ax = np.abs(x); d = np.minimum(np.minimum(cut_y(ax) - y, EDGE_X - ax), y - 0.6)
    return np.clip(d / SOFT + 0.5, 0, 1)

# 기본 캐릭터 눈 (정면 직교 투영)
FX0, FX1, FY0, FY1, FPX = -0.25, 0.25, 0.55, 0.9, 1400
B = load('src/runnermodel.js')
bcol, br = front_view(B, FX0, FX1, FY0, FY1, FPX)
FH = bcol.shape[0]
Yf, Xf = np.meshgrid(FY1 - (np.arange(FH) + 0.5) / FH * (FY1 - FY0), FX0 + (np.arange(FPX) + 0.5) / FPX * (FX1 - FX0), indexing='ij')
inbox = (Xf > EYE_BOX[0]) & (Xf < EYE_BOX[1]) & (Yf > EYE_BOX[2]) & (Yf < EYE_BOX[3]) & ~np.isnan(br[..., 0])
_, bs, bv = hsv(bcol)
white = (bs < 0.2) & (bv > 0.75) & inbox
eyes = np.zeros_like(white)
for side in (Xf < -0.01, Xf > 0.01):  # 눈마다 흰 테두리 → 볼록하게 채움 (눈은 타원). 가운데 머리카락 뭉치는 테두리 밖이라 빠짐
    w = white & side; lab, n = ndimage.label(w); k = 1 + np.argmax(ndimage.sum(w, lab, range(1, n + 1))); w = lab == k
    r = np.zeros_like(w); c = np.zeros_like(w)
    for i in np.nonzero(w.any(1))[0]: j = np.nonzero(w[i])[0]; r[i, j.min():j.max() + 1] = True
    for j in np.nonzero(w.any(0))[0]: i = np.nonzero(w[:, j])[0]; c[i.min():i.max() + 1, j] = True
    eyes |= r & c
core = ndimage.binary_dilation(eyes, iterations=1); eyes = ndimage.binary_dilation(eyes, iterations=4)
# 가장자리는 부드럽게. 테두리 바깥 띠에서는 밝은(흰자 번진) 색만 — 근처 머리카락 뭉치 조각이 따라오지 않게
ea = np.where(core, 1 - skinness(bcol), np.where(eyes, (1 - skinness(bcol)) * ss(0.45, 0.6, bv), 0))
# 몸 셰이더(runner.js)가 목 위 어두운 곳(눈동자·머리카락)을 무채색 검정(밝기×0.75)으로 바꾸는 것을 텍스처에 미리 해 둠 (머리 장비 셰이더엔 없음)
_dk = (1 - ss(0.22, 0.34, bv))[..., None]; bcol = bcol * (1 - _dk) + (bcol @ np.array([0.3, 0.59, 0.11]))[..., None] * 0.75 * _dk
ys, xs = np.nonzero(eyes); print('base eyes x %.3f..%.3f y %.3f..%.3f' % (Xf[eyes].min(), Xf[eyes].max(), Yf[eyes].min(), Yf[eyes].max()))
def front_lookup(img, x, y):
    x = np.asarray(x, float); y = np.broadcast_to(np.asarray(y, float), x.shape)
    j = np.clip(((x - FX0) / (FX1 - FX0) * FPX).astype(int), 0, FPX - 1); i = np.clip(((FY1 - y) / (FY1 - FY0) * FH).astype(int), 0, FH - 1)
    return img[i, j]

def fix(name):
    path = f'src/gear/head-{name}.js'; M = load(path); P = M['pos'].copy(); N = M['nor'].copy(); img = M['img'].copy(); T = img.shape[0]
    # 1) 이마 면 = 기본 캐릭터 얼굴 면(정면 투영 z)을 이 머리 얼굴 높이에 맞춰 옮긴 것.
    #    기본 캐릭터는 눈이 살짝 도드라져 있고 눈 위는 바로 모자라, YB 위는 가운데(x 0) 기울기로 이어 가는 매끈한 면(z = zc(y) + KX x²)
    #    앞머리 자리에서 그 면보다 튀어나온 정점을 면으로 눌러 넣고, 얼굴 앞 법선은 기본 캐릭터 법선을 그대로 씀
    #    → 툰 명암 경계가 기본 캐릭터와 같은 곳에 생김 (얼굴 앞이 빛 경계 NdotL 0.5 근처라 조금만 달라도 얼룩덜룩해짐)
    YB = 0.775
    zb = lambda x, y: front_lookup(br[..., 2], x, y)
    f = (np.abs(P[:, 0]) < 0.12) & (P[:, 1] > 0.66) & (P[:, 1] < 0.74) & (N[:, 2] > 0.5)
    dz0 = np.nanmedian(P[f, 2] - zb(P[f, 0], P[f, 1]))
    # 기본 얼굴 YB 줄을 z = z0 + KX x² 로 맞춤 (눈 볼록한 것은 평균으로 무시) → 이음매에서 높이가 거의 같음
    xr = np.linspace(-0.15, 0.15, 61); zr = zb(xr, YB); ok = ~np.isnan(zr); KX, z0 = np.polyfit(xr[ok] ** 2, zr[ok], 1)
    g = float((zb(np.array([0.0]), YB)[0] - zb(np.array([0.0]), YB - 0.01)[0]) / 0.01)
    smooth = lambda x, y: z0 + dz0 + g * (y - YB) + KX * x * x
    def zf(x, y):  # YB-0.01 ~ YB+0.01 사이에서 기본 얼굴 → 매끈한 면
        t = ss(YB - 0.01, YB + 0.01, y); return (zb(x, np.minimum(y, YB)) + dz0) * (1 - t) + smooth(x, y) * t
    ax = np.abs(P[:, 0]); below = cut_y(np.minimum(ax, EDGE_X)) - P[:, 1]
    w = (1 - ss(EDGE_X - 0.02, EDGE_X + 0.02, ax)) * ss(-0.004, 0.004, below) * (P[:, 1] > 0.7) * (P[:, 2] > 0.1)
    zt = np.nan_to_num(zf(P[:, 0], P[:, 1]), nan=9.0)
    push = (P[:, 2] > zt - 0.04) & (w > 0)  # 튀어나온 앞면 + 앞머리 밑면(그대로 두면 얼굴 면과 겹쳐 가는 줄이 보임)도 면 위로
    P[push, 2] = P[push, 2] + (zt[push] - P[push, 2]) * w[push]
    yb = np.minimum(P[:, 1], YB)
    bn = front_lookup(np.nan_to_num(br[..., 3:6]), P[:, 0], yb); okb = ~np.isnan(front_lookup(br[..., 3], P[:, 0], yb))
    sn = np.c_[-2 * KX * P[:, 0], -g * np.ones(len(P)), np.ones(len(P))]; sn /= np.linalg.norm(sn, axis=1, keepdims=True)
    t = ss(YB - 0.01, YB + 0.01, P[:, 1])[:, None]; bn = bn * (1 - t) + sn * t; okb = okb | (t[:, 0] > 0.99)
    cy = cut_y(np.minimum(ax, EDGE_X))  # 앞머리선 위 0.03 까지도 (선에 걸친 큰 삼각형이 피부 쪽 명암을 흔들지 않게)
    wn = (1 - ss(0.13, 0.17, ax)) * ss(0.6, 0.62, P[:, 1]) * np.maximum(np.maximum(ss(0.3, 0.5, N[:, 2]), ss(0.7, 0.72, P[:, 1]) * ss(0.16, 0.19, P[:, 2])) * (1 - ss(cy + 0.01, cy + 0.035, P[:, 1])), push * w) * okb
    N = N + (bn - N) * wn[:, None]; N /= np.linalg.norm(N, axis=1, keepdims=True)
    co = [dz0, KX, z0, g]
    print(name, 'forehead fit', np.round(co, 3), 'pushed', push.sum(), 'normals', (wn > 0.5).sum())
    # 2) 텍셀마다 3D 위치·법선
    UVp = M['uv'] * T
    At = np.c_[P, N].astype(np.float32); R = bary_raster(UVp, M['idx'], T, T, At); R2 = bary_raster(UVp, M['idx'], T, T, At, expand=6)  # 섬 둘레 여백도 3D 위치로 칠함 (멀리서 밉맵이 옆 섬 머리카락 색을 섞어 줄이 생기지 않게)
    R = np.where(np.isnan(R[..., :1]), R2, R)
    cov = ~np.isnan(R[..., 0]); p = np.nan_to_num(R[..., :3]); nr = np.nan_to_num(R[..., 3:])
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    sk = skinness(img); h, s, v = hsv(img)
    skinpx = cov & (sk > 0.9)
    S = np.median(img[skinpx & (y < 0.78) & (z > 0.15)], 0); print(name, 'skin', S.round(1))
    # 앞에서 보이는 면: 정면 투영에서 가장 앞 z 와 거의 같은 텍셀 (법선은 눌러 넣은 곳에서 흔들려서 안 씀)
    _, hr = front_view({**M, 'pos': P, 'nor': N}, FX0, FX1, FY0, FY1, 700); zfr = np.nan_to_num(hr[..., 2], nan=9.0)
    x = np.asarray(x, float); y = np.broadcast_to(np.asarray(y, float), x.shape)
    j = np.clip(((x - FX0) / (FX1 - FX0) * 700).astype(int), 0, 699); i = np.clip(((FY1 - y) / (FY1 - FY0) * hr.shape[0]).astype(int), 0, hr.shape[0] - 1)
    front = cov & (z > 0.1) & (z > zfr[i, j] - 0.012)
    # 3) 얼굴 지우기: 예전 눈 + 올릴 앞머리 자리 → 피부
    cw = np.where(cov & (z > 0.1) & (z > zfr[i, j] - 0.05), clear_w(x, y), 0)  # 앞머리 밑면(눌러 넣어 얇아진 삼각형)까지 넉넉히
    out = img.copy()
    # 얼룩: 머리카락(어두움)이 아닌데 피부색 범위를 벗어난 텍셀 → 피부색(밝기 조금만 따라감)
    lum = img.mean(-1); sl = S.mean()
    # 머리카락↔피부 사이 중간 밝기 텍셀은 피부색 바꾸기를 안 받아 어두운 피부에서 주황 얼룩이 됨 → 밝기 0.5 를 기준으로 피부 또는 머리카락으로 가름
    hairc = np.median(img[cov & (v < 0.25)], 0)
    mid = cov & (v >= 0.25) & (v < 0.72) & (sk < 0.9)
    skinlike = cov & ((v >= 0.5) | (sk > 0.3))
    out = np.where((mid & (v < 0.5) & (sk <= 0.3))[..., None], hairc[None, None], img)
    ratio = np.clip(lum / sl, 0.92, 1.05)[..., None]
    out = np.where(skinlike[..., None], S[None, None] * ratio, out)
    cw = (cw > 0.5).astype(np.float32)  # 지우는 경계도 반반 섞지 않음 (같은 얼룩 이유)
    out = out * (1 - cw[..., None]) + S[None, None] * cw[..., None]
    # 4) 기본 캐릭터 눈 옮기기
    eyefront = cov & (z > 0.1) & (z > zfr[i, j] - 0.05) & (x > EYE_BOX[0]) & (x < EYE_BOX[1]) & (y > EYE_BOX[2]) & (y < EYE_BOX[3])
    a = np.where(eyefront, front_lookup(ea, x, y), 0)[..., None]; bc = front_lookup(bcol, x, y)
    out = out * (1 - a) + bc * a
    # 5) 섬 밖 여백은 가장 가까운 섬 텍셀 색
    _, (ii, jj) = ndimage.distance_transform_edt(~cov, return_indices=True)
    out = out[ii, jj]
    save_tex(path, out)
    # 위치·법선도 다시 씀
    s0 = open(path).read()
    rep = lambda k, arr: re.sub(k + r": '[^']*'", k + ": '" + base64.b64encode(arr.tobytes()).decode() + "'", s0, count=1)
    s0 = rep('pos', P.astype(np.float32)); open(path, 'w').write(s0); s0 = open(path).read()
    s0 = rep('nor', np.round(N * 127).astype(np.int8)); open(path, 'w').write(s0)

for n in (sys.argv[1:] or ['short', 'bob', 'bun']): fix(n)
