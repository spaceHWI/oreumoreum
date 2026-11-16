# src/runnermodel.js · src/gear/*.js 의 base64 메시·텍스처를 읽고 쓰는 도구 (#54)
import re, base64, io
import numpy as np
from PIL import Image

def load(path):
    s = open(path).read()
    f = lambda k: re.search(k + r": '([^']*)'", s).group(1)
    pos = np.frombuffer(base64.b64decode(f('pos')), np.float32).reshape(-1, 3)
    nor = np.frombuffer(base64.b64decode(f('nor')), np.int8).reshape(-1, 3) / 127.0
    uv = np.frombuffer(base64.b64decode(f('uv')), np.float32).reshape(-1, 2)
    i16 = 'idx16: true' in s
    idx = np.frombuffer(base64.b64decode(f('idx')), np.uint16 if i16 else np.uint32).reshape(-1, 3).astype(np.int64)
    tex = f('tex'); head, b = tex.split(',', 1)
    img = np.asarray(Image.open(io.BytesIO(base64.b64decode(b))).convert('RGB')).astype(np.float32)
    return dict(src=s, pos=pos, nor=nor, uv=uv, idx=idx, img=img, tex=tex)

def save_tex(path, img, quality=85):
    s = open(path).read()
    old = re.search(r"tex: '([^']*)'", s).group(1)
    buf = io.BytesIO(); Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(buf, 'JPEG', quality=quality)
    s = s.replace(old, 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode())
    open(path, 'w').write(s)

def bary_raster(P2, idx, W, H, attrs, zkey=None, expand=0.0):
    """P2: 정점 2D 픽셀 좌표 (n,2). 삼각형마다 래스터해 attrs(정점 값 (n,k))를 보간. zkey 가 있으면 큰 값이 앞(덮어씀)
    expand: 삼각형 바깥 이 픽셀 거리까지도 채움(이미 채운 곳은 그대로) — uv 섬 가장자리 텍셀용"""
    out = np.full((H, W, attrs.shape[1]), np.nan, np.float32); zb = np.full((H, W), -np.inf); db = np.full((H, W), np.inf)
    for t in idx:
        a, b, c = P2[t]
        x0, x1 = int(np.floor(min(a[0], b[0], c[0]))), int(np.ceil(max(a[0], b[0], c[0])))
        y0, y1 = int(np.floor(min(a[1], b[1], c[1]))), int(np.ceil(max(a[1], b[1], c[1])))
        x0, x1, y0, y1 = int(x0 - expand), int(x1 + expand + 1), int(y0 - expand), int(y1 + expand + 1)
        x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, W - 1), min(y1, H - 1)
        if x1 < x0 or y1 < y0: continue
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-12: continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        l0 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / d
        l1 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / d
        l2 = 1 - l0 - l1
        if expand > 0:  # 변까지 픽셀 거리 = l_i * 2넓이 / 변 길이
            e = [np.hypot(*(c - b)), np.hypot(*(a - c)), np.hypot(*(b - a))]
            dd = -np.minimum(np.minimum(l0 * abs(d) / max(e[0], 1e-9), l1 * abs(d) / max(e[1], 1e-9)), l2 * abs(d) / max(e[2], 1e-9))  # 삼각형 밖 거리
            sub = db[y0:y1 + 1, x0:x1 + 1]; m = (dd <= expand) & (dd < sub); sub[m] = dd[m]  # 가장 가까운 삼각형이 차지
        else: m = (l0 >= -1e-4) & (l1 >= -1e-4) & (l2 >= -1e-4)
        if not m.any(): continue
        v = l0[..., None] * attrs[t[0]] + l1[..., None] * attrs[t[1]] + l2[..., None] * attrs[t[2]]
        if zkey is not None:
            z = v[..., zkey]; sub = zb[y0:y1 + 1, x0:x1 + 1]; m = m & (z > sub); sub[m] = z[m]
        out[y0:y1 + 1, x0:x1 + 1][m] = v[m]
    return out

def sample(img, uv):
    H, W = img.shape[:2]; x = np.clip((uv[..., 0] * W - 0.5), 0, W - 1); y = np.clip((uv[..., 1] * H - 0.5), 0, H - 1)
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int); x1 = np.minimum(x0 + 1, W - 1); y1 = np.minimum(y0 + 1, H - 1); fx = (x - x0)[..., None]; fy = (y - y0)[..., None]
    return (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x1] * fx * (1 - fy) + img[y1, x0] * (1 - fx) * fy + img[y1, x1] * fx * fy)

def front_view(M, x0=-0.25, x1=0.25, y0=0.55, y1=0.9, px=800):
    """정면(+z 에서) 직교 투영 그림과 그 픽셀의 uv·z"""
    W = px; H = int(px * (y1 - y0) / (x1 - x0))
    P = np.stack([(M['pos'][:, 0] - x0) / (x1 - x0) * W, (y1 - M['pos'][:, 1]) / (y1 - y0) * H], 1)
    A = np.concatenate([M['uv'], M['pos'][:, 2:3], M['nor']], 1)
    r = bary_raster(P, M['idx'], W, H, A, zkey=2)
    col = np.where(np.isnan(r[..., :1]), 200, sample(M['img'], np.nan_to_num(r[..., :2])))
    return col, r
