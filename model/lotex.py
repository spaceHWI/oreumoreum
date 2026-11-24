# 사건 모델 멀리용(-lo) 텍스처를 큰 모델 텍스처에서 줄여 다시 채움 (#295).
# bake-case.py 로 굽다가 멀리용 텍스처가 통째로 검게 나왔다(Blender img.copy() 가 굽는 그림을 못 옮김). 같은 UV 라 큰 텍스처를 줄이면 된다.
# 사용: python3 model/lotex.py [크기=128]   (src/model-case-*.js 중 -lo 가 있는 것 모두)
import re, io, base64, glob, sys
from PIL import Image
SZ = int(sys.argv[1]) if len(sys.argv) > 1 else 128
RE = re.compile(r"(tex: *')data:image/jpeg;base64,([^']+)(')")
for lo in sorted(glob.glob('src/model-case-*-lo.js')):
    hi = lo.replace('-lo.js', '.js')
    s = open(hi).read(); m = RE.search(s)
    if not m: print('큰 모델 텍스처 없음', hi); continue
    im = Image.open(io.BytesIO(base64.b64decode(m.group(2)))).convert('RGB').resize((SZ, SZ), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=80, optimize=True)
    b = base64.b64encode(buf.getvalue()).decode()
    t = open(lo).read(); n = len(RE.findall(t))
    if n != 1: print('멀리용 텍스처 자리가 1개가 아님', lo, n); continue
    open(lo, 'w').write(RE.sub(lambda k: k.group(1) + 'data:image/jpeg;base64,' + b + k.group(3), t))
    print(lo, SZ, len(b))
