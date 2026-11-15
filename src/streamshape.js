// 들머리 개울 모양 (#41): 길 가운데(징검다리)는 넓고 곧게, 거기서 멀어질수록 좁아지고 굽이치며 돌담 밖 원경까지 이어진다.
// 좌표는 stream.js 와 같다: 개울 방향 lat(하류 +), 길 방향 al(오름 쪽 +). 같은 식을 셰이더(풀 안 나는 곳)에서도 쓴다
import { STREAM, TUT } from './balance.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const S = STREAM;

// 굽이 진폭: 길 근처 0 → 돌담 안 S.meanderIn → 돌담 밖 멀리 S.meanderOut
export const meanderAmp = (lat) => { const a = Math.abs(lat); return S.meanderIn * sstep(S.flatLat, S.flatLat + 21, a) + (S.meanderOut - S.meanderIn) * sstep(55, 130, a); };
// 물길 가운데의 길 방향 어긋남
export const centerOff = (lat) => meanderAmp(lat) * (Math.sin(lat * 0.043 + 0.6) + 0.5 * Math.sin(lat * 0.117 + 2.2));
// 물 반폭. walls = [돌담과 만나는 lat 둘]: 그 근처는 S.wallW 로 좁혀 수문 아래로 지나게
export function halfW(lat, walls) {
  const a = Math.abs(lat), n = S.narrowW + 0.8 * Math.sin(lat * 0.071 + 1.3) + 0.4 * Math.sin(lat * 0.23 + 0.4);
  let w = mix(TUT.streamW, n, sstep(S.flatLat, S.flatLat + 11, a));
  for (const l of walls) w = mix(w, S.wallW, 1 - sstep(4, 14, Math.abs(lat - l)));
  return w;
}

const f = (v) => v.toFixed(4);
// 셰이더용 (uStream = 가운데 xz·길 방향, uStreamM = 돌담 lat 둘, uStreamW = 반폭(음수면 개울 없음))
export const STREAM_GLSL = `
float stA(float l){ float a=abs(l); return ${f(S.meanderIn)}*smoothstep(${f(S.flatLat)},${f(S.flatLat + 21)},a)+${f(S.meanderOut - S.meanderIn)}*smoothstep(55.0,130.0,a); }
float stOff(float l){ return stA(l)*(sin(l*0.043+0.6)+0.5*sin(l*0.117+2.2)); }
float stW(float l, float W, vec2 wl){ float a=abs(l); float n=${f(S.narrowW)}+0.8*sin(l*0.071+1.3)+0.4*sin(l*0.23+0.4);
  float w=mix(W,n,smoothstep(${f(S.flatLat)},${f(S.flatLat + 11)},a));
  w=mix(w,${f(S.wallW)},1.0-smoothstep(4.0,14.0,abs(l-wl.x))); w=mix(w,${f(S.wallW)},1.0-smoothstep(4.0,14.0,abs(l-wl.y))); return w; }
// 개울 물 가장자리에서 얼마나 바깥인가 (음수면 물 안)
float stOut(vec2 p, vec4 st, float W, vec2 wl){ vec2 d=p-st.xy; float al=dot(d,st.zw), lat=dot(d,vec2(-st.w,st.z));
  if(W<0.0||abs(lat)>${f(S.far)}) return 1e4; return abs(al-stOff(lat))-stW(lat,W,wl); }
`;

// 물길 가운데 선이 바깥 돌담(경계)과 만나는 곳 둘. line = nsbound.crossLine(TUT.streamD), insideBy = nsbound.insideBy
// 반환 { lats:[상류 lat, 하류 lat], pts:[{ x, z, w, lat }] }
export function streamCross(line, insideBy) {
  const { c, fx, fz, ux, uz } = line, pt = (lat) => { const al = centerOff(lat); return [c.x + fx * al + ux * lat, c.z + fz * al + uz * lat]; };
  const lats = [-1, 1].map((sgn) => { let l = 0; while (Math.abs(l) < S.far && insideBy(...pt(l)) > 0) l += sgn * 0.25; return l; });
  return { lats, pts: lats.map((lat) => { const [x, z] = pt(lat); return { x, z, w: S.wallW, lat }; }) };
}
