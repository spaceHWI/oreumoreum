// 동굴 탐험 (#195) 4번 조각: 벽 쪽지 · 동굴 옷 · 감독 문 cave · 퀘스트 '바람 새는 굴' 고리 · 혼잣말 실마리는 mutter.js
// - 같이 들어가기(멀티 칸)는 net.js netCave·server roomcore caveCell (이 파일 아님)
// - 쪽지: 층마다 벽에 붙은 종이 하나(CAVE.note.ids[층], punktext.js NOTES 의 z 'cave'). 다가가 '쪽지 읽기' → #165 쪽지 창(처음이면 주운 쪽지에 더함). 맨 아래 층은 주인 방
// - 옷: 처음 연 동굴 상자 → CAVE.cloth.chest, 처음 쫓아낸 동굴의 주인 → CAVE.cloth.owner (balance.js CAVE_CLOTHES, 가게에 없음·값 0)
// - 감독(#176): 문 cave (레벨·구역 3 완료, gate = caveCan). 열리면 한 줄 안내. 퀘스트 셈 'caveOut'(든 동굴 쓰레기를 들고 나옴), 길 안내 go 'cave' = 입구 앞(late.caveEnt)
// dev: __oreum.cave.extra (note·read·cloth·door)
import * as THREE from 'three';
import { CAVE, CLOTHES } from '../balance.js';
import { state, late } from './state.js';
import { save, persist, CL } from './save.js';
import { toast, ach } from './hud.js';
import { director } from './director.js';
import { interactables } from './stores.js';
import { player } from './place.js';

const N = CAVE.note, L4 = CAVE.lines4;
const X = { g: null, id: null, pos: new THREE.Vector3(1e9, 0, 1e9), cs: null };
const paperMat = new THREE.MeshBasicMaterial({ color: '#d9ceb0' }), glowMat = new THREE.MeshBasicMaterial({ color: '#7cf05a', transparent: true, opacity: 0.55, depthWrite: false });
const paperGeo = new THREE.PlaneGeometry(0.62, 0.8), glowGeo = new THREE.PlaneGeometry(0.95, 1.12);

// 방 안에서 벽 쪽 걸을 수 있는 점과 방 가운데를 보는 방향: [x, z, 벽 방향 각]
function wallSpot(F, c, r, seed) {
  let best = null;
  for (let k = 0; k < 12; k++) {
    const a = seed * 0.7 + k * Math.PI / 6, dx = Math.cos(a), dz = Math.sin(a);
    let d = 0.5; while (d < r + 4 && F.walk(c.x + dx * d, c.z + dz * d)) d += 0.25;
    if (d >= r + 4 || d < 2.5) continue;
    const p = [c.x + dx * (d - 0.35), c.z + dz * (d - 0.35), a];
    if (!best || Math.abs(d - r) < best.e) best = { p, e: Math.abs(d - r) };
  }
  return best && best.p;
}
function placeNote(F, fi) {
  clearNote();
  const id = N.ids[fi]; if (!id || !X.cs) return;
  const last = fi >= CAVE.floors - 1, far = F.far, st = F.start;
  const rooms = F.rooms.map((o) => ({ ...F.world(o), r: o.r }));
  const isAt = (o, p) => p && Math.hypot(o.x - p.x, o.z - p.z) < 1;
  let room = last && far ? rooms.find((o) => isAt(o, far)) : null;
  if (!room) { const cand = rooms.filter((o) => !isAt(o, st) && !isAt(o, far)); room = cand.length ? cand[(F.seed >>> 0) % cand.length] : rooms[0]; }
  if (!room) return;
  const at = wallSpot(F, room, room.r, (F.seed >>> 3) % 7); if (!at) return;
  const [x, z, a] = at, y = F.floorY(x, z) + N.y;
  const g = new THREE.Group(); g.name = 'cave-note'; g.position.set(x, y, z); g.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); /* 앞면(+z)이 방 가운데 쪽 */
  const glow = new THREE.Mesh(glowGeo, glowMat); glow.position.z = 0.01; const paper = new THREE.Mesh(paperGeo, paperMat); paper.position.z = 0.03; paper.rotation.z = 0.06;
  g.add(glow, paper); X.cs.add(g); X.g = g; X.id = id; X.pos.set(x, F.floorY(x, z), z);
}
function clearNote() { if (X.g) { X.g.parent?.remove(X.g); X.g = null; } X.id = null; X.pos.set(1e9, 0, 1e9); }
const P = () => late.punkWorld?.note;
const haveNote = (id) => !!P()?.got().includes(id);
function readNote() {
  const id = X.id, w = P(); if (!id || !w) return false;
  if (!haveNote(id)) w.give(id, false); else w.open(id);
  return true;
}
interactables.push({ label: '쪽지 읽기', ic: 'notes', pos: X.pos, r: N.r, when: () => !!state.cave && !!X.id, act: readNote });

// ---------- 동굴 옷 ----------
function giveCloth(id) {
  const c = CLOTHES_BY[id]; if (!c || !CL || CL.own[id]) return false;
  CL.own[id] = 1; persist(); late.bagRefresh?.('wear');
  setTimeout(() => toast(L4.cloth(c.name), 3.4), 3300); /* 상자·주인 토스트 뒤 */
  return true;
}
const CLOTHES_BY = Object.fromEntries(CLOTHES.filter((c) => c.cave).map((c) => [c.id, c]));
{ const emit = ach.emit; ach.emit = (ev, n = 1) => { emit(ev, n); try { if (ev === 'cave-chest') giveCloth(CAVE.cloth.chest); else if (ev === 'cave-owner') giveCloth(CAVE.cloth.owner); } catch (e) { /* 옷 주기는 게임을 멈추지 않음 */ } }; }

// ---------- 감독 문·퀘스트 ----------
director.register({ id: 'cave', gate: () => !!late.caveApi?.can()[0], sec: 4, intro: () => toast(L4.door, 4) });
late.caveEnt = () => { const e = late.caveApi?.ent(); return e ? new THREE.Vector3(e.fx, player.pos.y, e.fz) : null; };

// ---------- 이어 붙이기 (cave.js·cavelife.js·cavedeep.js 의 late 고리를 감쌈) ----------
{
  const ci = late.caveIn, cf = late.caveFloor, co = late.caveFloorOff, out = late.caveOut;
  late.caveIn = (cs) => { ci(cs); X.cs = cs; };
  late.caveFloor = (F, fi) => { cf(F, fi); try { placeNote(F, fi); } catch (e) { clearNote(); } };
  late.caveFloorOff = () => { co(); clearNote(); };
  late.caveOut = (downed) => {
    const carried = !downed && (Number(save.cave?.held?.g) || 0) > 0;
    clearNote(); out(downed);
    if (carried) late.questEv?.('caveOut');
  };
}

late.caveApi && (late.caveApi.extra = {
  note: () => X.id && { id: X.id, x: +X.pos.x.toFixed(1), z: +X.pos.z.toFixed(1), shown: !!X.g?.parent, got: haveNote(X.id) },
  goNote: () => { if (!X.id) return null; player.pos.set(X.pos.x, X.pos.y, X.pos.z); player.visY = player.pos.y; return true; },
  read: readNote,
  cloth: () => Object.keys(CLOTHES_BY).map((id) => [id, !!CL?.own[id]]),
  give: (k) => giveCloth(CAVE.cloth[k]),
  door: () => director.state?.()?.open?.includes?.('cave') ?? null,
});
