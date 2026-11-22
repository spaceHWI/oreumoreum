# 로고 글자 윤곽 뽑기 (#209): Black Han Sans 의 '오'·'름' 윤곽을 src/logo.js 에 넣을 SVG path 로.
# 게임에는 글꼴 파일을 싣지 않는다. 로고 모양을 바꿀 때만 한 번 돌려 나온 문자열을 logo.js 의 GLYPH 에 붙여 넣는다.
# 글꼴: https://github.com/google/fonts/tree/main/ofl/blackhansans (또는 npm @fontsource/black-han-sans 의 korean .woff)
# 쓰기: python3 tools/logoglyph.py <BlackHanSans .ttf/.woff>
# 좌표: 글자 칸 1000(em) → 0.125 배, 위를 0 으로 뒤집음(ㅇ 꼭대기 y=752 가 0). '오' 는 ㅇ 고리(바깥·안쪽 두 윤곽)를 빼고 ㅗ 만.
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

S, TOP, LEFT = 0.125, 752, 60
t = TTFont(sys.argv[1]); gs = t.getGlyphSet(); cm = t.getBestCmap()
for ch in '오름':
    g = gs[cm[ord(ch)]]; rec = RecordingPen(); g.draw(rec)
    cs, cur = [], []
    for op, a in rec.value:
        cur.append((op, a))
        if op in ('closePath', 'endPath'): cs.append(cur); cur = []
    if ch == '오':
        keep = [c for c in cs if min(p[1] for _, a in c for p in a) < 300]
        ring = [c for c in cs if c not in keep]
        xs = [p[0] for _, a in ring[0] for p in a]; ys = [p[1] for _, a in ring[0] for p in a]
        print('// ㅇ 바깥: x', (min(xs) - LEFT) * S, '~', (max(xs) - LEFT) * S, ' y', (TOP - max(ys)) * S, '~', (TOP - min(ys)) * S)
        cs = keep
    sp = SVGPathPen(None, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
    tp = TransformPen(sp, (S, 0, 0, -S, -LEFT * S, TOP * S))
    for c in cs:
        for op, a in c: getattr(tp, op)(*a)
    print(ch, 'adv', g.width * S, sp.getCommands())
