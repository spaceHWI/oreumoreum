// 큰 순위판 (#289): 들머리 광장(정낭을 나서면 바로 보이는 곳)의 사람 키 두 배 나무 게시판 + 가게 거리 입구 작은 판. 수치·자리는 balance.js RANKBOARD
// - 판 글: '오늘 가장 많이 치운 사람', 1~5위 이름·치운 쓰레기 수, 내 순위 한 줄. 1위 이름은 크게. 캔버스 텍스처 한 장을 두 판이 같이 씀
// - 서버 순위(GET /rank, rank.js fetch)를 들어올 때 한 번 + RANKBOARD.refreshMs 마다. 순위 창과 같은 읽기(30초 안이면 다시 묻지 않음)라 서버 호출이 늘지 않음
// - 손님·오프라인: '로그인하면 이름이 올라요' + 이 기기의 오늘 치운 수 (#261 안내와 같은 말)
// - 다가가서 상호작용(F·버튼) '순위판' → 순위 창(오늘·이번 주·전체). 밤엔 판 위 등 하나(불빛만, 조명 없음)
// - 1위가 바뀌면 오름 방송 상황 한 줄(punktext RADIO_SITU.rank1, 하루 radioPerDay 번까지). 드러남 단계와 무관한 글
// - 그리는 수: 큰 판 3(나무·글판·등) + 작은 판 2(나무·글판). 닉네임은 캔버스 글자로만 (#84)
// dev: __oreum.rankBoard (state()·draw(data)·refresh()·go('big'|'small')·night(v))
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RANKBOARD as RB, RANK, TUT, CART, NET } from '../balance.js';
import { height, surfaceAt } from '../world.js';
import { nsAlong } from '../namsongi.js';
import { STREET } from '../streetlayout.js';
import { gradHard } from '../toon.js';
import { cleanText } from '../safetext.js';
import { kstDay } from '../rankday.js';
import { RADIO_SITU } from '../punktext.js';
import { state, late } from './state.js';
import { save, persist } from './save.js';
import { scene, spots } from './scene.js';
import * as SC from './scene.js';
import { NS_TUT, street, col, trash, cairns, player, CH } from './place.js';
import { interactables } from './stores.js';
import { rank } from './start.js';
import { cam } from './camera.js';

const ON = !!NS_TUT && !!trash;
const FONT = '"Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const st = { big: null, small: null, data: null, mode: 'wait', drawn: 0, reads: 0, t: 0, night: null, radio: 0 };

/* ---------- 글판 (캔버스) ---------- */
const [TW, TH] = RB.tex;
const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
const g2 = cv.getContext('2d');
const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
const nickOf = (n) => cleanText(n || '', NET.nickMax) || '이름 없는 러너';
function fit(text, max, size, weight = 800) { /* 폭 안에 들어가게 글자 크기를 줄이고, 그래도 넘치면 말줄임 */
  let s = size; g2.font = `${weight} ${s}px ${FONT}`;
  while (s > 18 && g2.measureText(text).width > max) { s -= 2; g2.font = `${weight} ${s}px ${FONT}`; }
  let t = text; while (t.length > 1 && g2.measureText(t).width > max) t = t.slice(0, -2) + '…';
  return t;
}
function bagIcon(x, y, s, c) { /* 쓰레기 봉투 (귤 아이콘이 아님) */
  g2.fillStyle = c; g2.beginPath(); g2.moveTo(x - s * 0.42, y - s * 0.2); g2.quadraticCurveTo(x - s * 0.55, y + s * 0.5, x, y + s * 0.5); g2.quadraticCurveTo(x + s * 0.55, y + s * 0.5, x + s * 0.42, y - s * 0.2); g2.closePath(); g2.fill();
  g2.beginPath(); g2.moveTo(x - s * 0.22, y - s * 0.2); g2.lineTo(x - s * 0.08, y - s * 0.46); g2.lineTo(x + s * 0.08, y - s * 0.46); g2.lineTo(x + s * 0.22, y - s * 0.2); g2.closePath(); g2.fill();
}
const INK = '#3e2f1f', SOFT = '#7a6448', PAPER = '#f1e6c8';
function draw(d) {
  st.data = d; st.drawn++;
  const W = TW, H = TH, P = 26;
  g2.fillStyle = PAPER; g2.fillRect(0, 0, W, H);
  g2.fillStyle = 'rgba(120,90,50,.08)'; for (let i = 0; i < 9; i++) g2.fillRect(0, 40 + i * 52, W, 2); /* 나뭇결 */
  /* 제목 띠 */
  g2.fillStyle = '#5b4429'; g2.fillRect(0, 0, W, 84);
  g2.fillStyle = '#ffd77a'; g2.textBaseline = 'middle'; g2.textAlign = 'center';
  g2.fillText(fit('오늘 가장 많이 치운 사람', W - 2 * P, 40), W / 2, 44);
  g2.textAlign = 'left';
  const rows = d?.top || [];
  if (d?.mode === 'list' && rows.length) {
    let y = 98;
    rows.slice(0, 5).forEach((r, i) => {
      const big = i === 0, rh = big ? 92 : 62, cy = y + rh / 2, me = !!r.me;
      if (me) { g2.fillStyle = 'rgba(255,138,31,.22)'; g2.fillRect(8, y + 2, W - 16, rh - 4); }
      const mr = big ? 30 : 22, mx = P + mr;
      g2.fillStyle = RANK.medalColor[i] || '#b9a888'; g2.beginPath(); g2.arc(mx, cy, mr, 0, 7); g2.fill();
      g2.fillStyle = i < 3 ? '#2a1d08' : '#fff'; g2.textAlign = 'center'; g2.font = `800 ${big ? 34 : 26}px ${FONT}`; g2.fillText(String(r.rank || i + 1), mx, cy + 1);
      g2.textAlign = 'right'; g2.fillStyle = INK; g2.font = `800 ${big ? 46 : 32}px ${FONT}`;
      const n = (r.n || 0).toLocaleString('ko-KR'); g2.fillText(n, W - P, cy + 1); const nw = g2.measureText(n).width;
      bagIcon(W - P - nw - (big ? 26 : 20), cy + 2, big ? 34 : 26, SOFT);
      g2.textAlign = 'left'; g2.fillStyle = INK;
      const nx = mx + mr + 16, nmax = W - P - nw - (big ? 60 : 46) - nx;
      g2.fillText(fit(nickOf(r.nick), nmax, big ? 58 : 34), nx, cy + 2);
      y += rh;
    });
  } else {
    g2.textAlign = 'center'; g2.fillStyle = SOFT;
    const msg = d?.mode === 'guest' ? '로그인하면 이름이 올라요' : d?.mode === 'empty' ? '아직 아무도 치우지 않았어요' : d?.mode === 'fail' ? '순위를 불러오지 못했어요' : '순위를 불러오는 중…';
    g2.fillText(fit(msg, W - 2 * P, 42), W / 2, 230);
    if (d?.mode === 'guest' || d?.mode === 'empty') { g2.font = `600 28px ${FONT}`; g2.fillText(d.mode === 'guest' ? '구글 로그인 → 오늘 순위에 올라가요' : '처음 치우는 사람이 1위예요', W / 2, 290); }
  }
  /* 내 순위 한 줄 */
  const me = d?.me;
  g2.fillStyle = '#5b4429'; g2.fillRect(0, H - 74, W, 74);
  g2.fillStyle = '#fff'; g2.textAlign = 'left';
  const line = d?.mode === 'guest' ? `나 · 오늘 ${(d.local || 0).toLocaleString('ko-KR')}개 치움` : me?.rank ? `나 ${me.rank}위 · ${(me.n || 0).toLocaleString('ko-KR')}개` : me ? `나 · 아직 순위 없음` : '';
  g2.fillText(fit(line, W - 2 * P - 40, 34), P + 40, H - 37);
  if (line) bagIcon(P + 14, H - 36, 26, '#ffd77a');
  tex.needsUpdate = true;
}

/* ---------- 나무 게시판 (큰 판·작은 판 같은 모양, 작은 판은 배율) ---------- */
const woodMat = new THREE.MeshToonMaterial({ color: '#7a5634', gradientMap: gradHard });
const faceMat = new THREE.MeshBasicMaterial({ map: tex });
const bulbMat = new THREE.MeshBasicMaterial({ color: '#6b5a3a' });
let woodGeo = null;
function woodGeometry() {
  if (woodGeo) return woodGeo;
  const { w, h, y } = RB, top = y + h / 2, parts = [];
  const box = (sx, sy, sz, x, yy, z) => new THREE.BoxGeometry(sx, sy, sz).translate(x, yy, z);
  for (const s of [-1, 1]) parts.push(box(0.16, top + 0.25, 0.16, s * (w / 2 + 0.02), (top + 0.25) / 2, -0.04)); /* 기둥 */
  parts.push(box(w + 0.3, h + 0.24, 0.1, 0, y, -0.06)); /* 판 테두리(뒤판) */
  parts.push(box(w + 0.7, 0.12, 0.62, 0, top + 0.3, 0.06)); /* 지붕 */
  parts.push(box(w + 0.5, 0.08, 0.5, 0, top + 0.38, 0.04).rotateZ(0));
  parts.push(box(0.06, 0.06, 0.42, 0, top + 0.2, 0.2)); /* 등 팔 */
  parts.push(box(w * 0.5, 0.1, 0.14, 0, 0.55, -0.04)); /* 다리 사이 가로대 */
  woodGeo = mergeGeometries(parts); return woodGeo;
}
function buildBoard(x, z, rot, s, lamp) {
  const g = new THREE.Group(); g.name = 'rank-board';
  const wood = new THREE.Mesh(woodGeometry(), woodMat); wood.castShadow = true; wood.receiveShadow = false; g.add(wood);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(RB.w, RB.h), faceMat); face.position.set(0, RB.y, 0.005); g.add(face);
  let bulb = null;
  if (lamp) { bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), bulbMat); bulb.position.set(0, RB.y + RB.h / 2 + 0.1, 0.42); g.add(bulb); }
  g.scale.setScalar(s); g.position.set(x, height(x, z) - 0.04, z); g.rotation.y = rot; scene.add(g);
  const front = new THREE.Vector3(x + Math.sin(rot) * 1.6 * s, 0, z + Math.cos(rot) * 1.6 * s); front.y = height(front.x, front.z);
  if (col) for (const k of [-1, 1]) col.add(x + Math.cos(rot) * k * (RB.w / 2) * s, z - Math.sin(rot) * k * (RB.w / 2) * s, 0.22 * s + 0.1);
  return { g, x, z, rot, s, front, bulb, top: new THREE.Vector3(x, height(x, z) + (RB.y + RB.h / 2 + 0.4) * s, z) };
}

/* ---------- 자리 ---------- */
function others() { /* 떨어져 있어야 할 것들 */
  const L = [];
  const add = (q) => { if (q && Number.isFinite(q.x)) L.push([q.x, q.z]); };
  add(spots.sign?.pos); add(spots.sign?.npc); (spots.hareubangs || []).forEach((h) => add(h.pos)); (cairns || []).forEach((c) => add(c.pos));
  (late.punkWorld?.radio?.spots?.() || []).forEach(add);
  const c0 = CART.stops?.[0]; if (c0) add(nsAlong(c0.path, c0.d, 1, CART.side));
  (spots.lamps || []).forEach((l) => add({ x: l[0], z: l[1] }));
  for (const h of trash.heaps || []) add(h);
  return L;
}
const offPath = (x, z, r) => [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([dx, dz]) => surfaceAt(x + dx, z + dz) === 0); /* 길(흙길·판석) 위가 아님 */
function pickAt(cands, at, L, gap) { /* 앞 후보부터: 막히지 않고, 길 밖이고, 다른 것과 gap m 떨어진 자리 */
  for (const c of cands) {
    const q = at(c);
    if (L.every(([x, z]) => Math.hypot(x - q.x, z - q.z) >= gap) && offPath(q.x, q.z, 1.2) && !(col && col.blocked(q.x, q.z, 1.6))) return q;
  }
  return at(cands[0]);
}
function pickSpot() { return pickAt([RB.at, ...(RB.alt || [])], ([d, side, off]) => nsAlong('approach', TUT.gateD + d, side, off), others(), RB.gap); }
function pickStreet() {
  const L = [...others(), ...(STREET.lamps || []).map((l) => [l[0], l[1]])];
  if (CH) { const c = CH.center || CH.front; if (c) L.push([c.x, c.z]); }
  return pickAt(RB.street, ([s, t]) => STREET.P(s, t), L, 3.5);
}

/* ---------- 읽기·그리기 ---------- */
function localDay() { try { return trash?.store?.localRank('battle')?.day || 0; } catch (e) { return 0; } }
function noteTop(top) { /* 1위가 바뀌면 방송 (오늘 처음 본 1위는 기준만) */
  const t = top?.[0]; if (!t || !(t.n > 0)) return;
  const d = kstDay(), A = (save.rankAch ||= {}), nick = nickOf(t.nick), prev = A.b1?.d === d ? A.b1.nick : null;
  if (prev === nick) return;
  A.b1 = { d, nick };
  if (prev != null) {
    const R = A.br?.d === d ? A.br : (A.br = { d, n: 0 });
    if (R.n < RB.radioPerDay && late.radioSitu?.('rank1', RADIO_SITU.rank1.replace('{nick}', nick))) { R.n++; st.radio++; } /* 방송이 꺼져 있으면 세지 않음 */
  }
  persist();
}
async function refresh(fresh = false) {
  if (!ON) return null;
  if (!rank.online()) { draw({ mode: 'guest', local: localDay() }); return st.data; }
  st.reads++;
  try {
    const r = await rank.fetch('day', fresh);
    if (!r) { draw({ mode: 'guest', local: localDay() }); return st.data; }
    const me = r.me ? { ...r.me } : null;
    draw({ mode: r.top?.length ? 'list' : 'empty', top: r.top || [], me });
    noteTop(r.top);
  } catch (e) { if (!st.data || st.data.mode !== 'list') draw({ mode: 'fail' }); }
  st.t = Date.now(); return st.data;
}

/* ---------- 밤 등 ---------- */
const DAY = new THREE.Color('#ffffff'), NIGHT = new THREE.Color('#d8ccb0'), OFF = new THREE.Color('#6b5a3a'), LIT = new THREE.Color('#fff1b8');
function lightUp(force) {
  const n = st.night != null ? st.night : SC.lampNight || 0;
  if (!force && Math.abs(n - (st.lastN ?? -1)) < 0.02) return; st.lastN = n;
  bulbMat.color.copy(OFF).lerp(LIT, Math.min(1, n * 1.4));
  faceMat.color.copy(DAY).lerp(NIGHT, n); /* 판은 늘 읽힘 (조명을 받지 않는 글판), 밤엔 등빛 색으로 조금 누렇게 */
}

if (ON) {
  const q = pickSpot(), G0 = TUT.gateD;
  const back = nsAlong('approach', G0 + RB.at[0] - 10);
  const rot = Math.atan2(back.x - q.x, back.z - q.z); /* 정낭에서 걸어 나오는 쪽을 봄 */
  st.big = buildBoard(q.x, q.z, rot, 1, true);
  if (street) {
    const p = pickStreet();
    const lk = STREET.P(0, -6), r2 = Math.atan2(lk.x - p.x, lk.z - p.z); /* 들머리 길 가운데, 시작에서 걸어오는 쪽을 봄 */
    st.small = buildBoard(p.x, p.z, r2, RB.small, false);
  }
  draw({ mode: rank.online() ? 'wait' : 'guest', local: localDay() });
  document.fonts?.ready?.then(() => { if (st.data) draw(st.data); });
  const open = () => { late.openRank?.(); return true; };
  interactables.push({ label: '순위판', ic: 'rank', pos: st.big.front, r: RB.r, act: open });
  if (st.small) interactables.push({ label: '순위판', ic: 'rank', pos: st.small.front, r: RB.r * 0.7, act: open });
  setTimeout(() => refresh(), RB.firstMs);
  setInterval(() => { if (!document.hidden) refresh(); }, RB.refreshMs);
  setInterval(() => lightUp(), 1500); lightUp(true);
  /* 손님은 버린 뒤 이 기기 수만 다시 그림 (서버 호출 없음) */
  const was = late.rankAfterDump;
  late.rankAfterDump = (...a) => { const r = was?.(...a); if (!rank.online()) setTimeout(() => draw({ mode: 'guest', local: localDay() }), 300); return r; };
}

late.rankBoardApi = {
  on: ON,
  state: () => ({ mode: st.data?.mode || null, top: (st.data?.top || []).map((r) => ({ rank: r.rank, nick: r.nick, n: r.n })), me: st.data?.me || null, drawn: st.drawn, reads: st.reads, radio: st.radio, calls: rank.state().calls,
    big: st.big && { x: +st.big.x.toFixed(1), z: +st.big.z.toFixed(1), front: [+st.big.front.x.toFixed(1), +st.big.front.z.toFixed(1)] }, small: st.small && { x: +st.small.x.toFixed(1), z: +st.small.z.toFixed(1) } }),
  draw: (d) => { draw(d); if (d?.top) noteTop(d.top); return st.data?.mode; },
  refresh: (fresh) => refresh(fresh),
  night: (v) => { st.night = v; lightUp(true); return v; },
  go: (k = 'big') => { const b = st[k]; if (!b) return null; const f = b.front, m = 1 + 2.2 / (1.6 * b.s), bx = b.x + (f.x - b.x) * m, bz = b.z + (f.z - b.z) * m; player.pos.set(bx, height(bx, bz), bz); player.visY = player.pos.y; player.heading = Math.atan2(b.x - bx, b.z - bz); cam.yaw = Math.atan2(bx - b.x, bz - b.z); return { x: +bx.toFixed(1), z: +bz.toFixed(1) }; },
  spot: () => pickSpot(),
  png: () => cv.toDataURL('image/png'),
};
