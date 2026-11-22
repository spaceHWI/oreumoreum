// 징표 (#255): 셈만 (three·DOM 없음). 게임 src/game/token.js · 서버 server/src/token.js · tools 가 같이 씀. 수치는 balance.js TOKEN
// 저장 save.tok = { n 가진 징표, got 얻은 누적, own { 무기 id: 단계 1~3 }, arm 골라 든 무기 id|null, rec { 구역: { at, n, win } } 마지막 판 기록(서버가 인정),
//   kit { pick, fight: { wear: { 칸: 옷 id }, arm: id|null, use: 귤 무기 단계 } } 차림 묶음, rv 한 벌 덤(일어남)이 다시 차는 ms, seen 첫 징표 안내를 봤음 }
import { TOKEN, CLOTHES } from './balance.js';

const isO = (v) => v && typeof v === 'object' && !Array.isArray(v);
const int = (v, lo, hi, d = 0) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
export const TOK_ARMS = TOKEN.arms;
export const TOK_ARM = Object.fromEntries(TOKEN.arms.map((a) => [a.id, a]));
export const TOK_CLOTHES = CLOTHES.filter((c) => c.tok);
export const TOK_CLOTH = Object.fromEntries(TOK_CLOTHES.map((c) => [c.id, c]));
export const LV_MAX = 3;

// 한 판 징표: zone 구역, win 버팀, leader 대장을 쫓아냄, clean 한 번도 안 쓰러짐, waves 버틴 물결 수
export function runTokens({ zone, win, leader, clean, waves }) {
  const E = TOKEN.earn, z = int(zone, 1, 5, 1);
  if (win) return z * E.win + (leader ? E.leader : 0) + (clean ? E.clean : 0);
  return Math.min(E.partMax, Math.floor(Math.max(0, waves | 0) * E.part));
}
export const runMax = (z) => int(z, 1, 5, 1) * TOKEN.earn.win + TOKEN.earn.leader + TOKEN.earn.clean; // 판 하나 상한 (서버)

// 저장 바로잡기 (게임·서버 같이): 아는 것만, 범위 안 숫자만
export function normTok(s) {
  const T = isO(s.tok) ? s.tok : {}, own = {}, rec = {};
  if (isO(T.own)) for (const [id, l] of Object.entries(T.own)) if (TOK_ARM[id]) { const n = int(l, 0, LV_MAX, 0); if (n) own[id] = n; }
  if (isO(T.rec)) for (let z = 1; z <= 5; z++) { const r = T.rec[z]; if (isO(r)) rec[z] = { at: int(r.at, 0, 1e14, 0), n: int(r.n, 0, runMax(z), 0), win: r.win ? 1 : 0 }; }
  const kit = {};
  if (isO(T.kit)) for (const k of ['pick', 'fight']) { const v = T.kit[k]; if (!isO(v)) continue; const w = {}; if (isO(v.wear)) for (const [slot, id] of Object.entries(v.wear)) if (typeof id === 'string' && id.length < 40 && /^[a-z]+$/.test(slot)) w[slot] = id; kit[k] = { wear: w, arm: TOK_ARM[v.arm] ? v.arm : null, use: int(v.use, 1, 9, 1) }; }
  s.tok = { n: int(T.n, 0, 1e6, 0), got: int(T.got, 0, 1e9, 0), own, arm: own[T.arm] ? T.arm : null, rec, kit, rv: int(T.rv, 0, 1e14, 0), seen: T.seen ? 1 : 0 };
  return s.tok;
}

// 값: 무기 단계 l (1~3) · 옷
export const armPrice = (id, l) => TOK_ARM[id]?.lv[l - 1]?.price ?? Infinity;
export const clothPrice = (id) => TOK_CLOTH[id]?.tokPrice ?? Infinity;
// 지난 저장 P 에서 S 로 새로 산 것의 징표 값 (서버). 무기는 올라간 단계마다, 옷은 새로 가진 것
export function tokSpent(P, S) {
  let sp = 0;
  const po = P.tok?.own || {}, so = S.tok?.own || {};
  for (const id of Object.keys(so)) for (let l = (po[id] | 0) + 1; l <= so[id]; l++) sp += armPrice(id, l);
  const pc = P.clothes?.own || {}, sc = S.clothes?.own || {};
  for (const c of TOK_CLOTHES) if (sc[c.id] && !pc[c.id]) sp += c.tokPrice;
  return sp;
}
// 그 구역 좌판에 나오는 것 (z 이하)
export const stallArms = (z) => TOK_ARMS.map((a) => ({ a, lv: a.lv.filter((l) => l.z <= z).length })).filter((x) => x.lv > 0);
export const stallCloth = (z) => TOK_CLOTHES.filter((c) => c.tokZ <= z);
// 무기 단계 l 의 쏘는 값 (balance.js WEAPONS 의 바탕 무기 위에 덮음)
export function armDef(id, l, WEAPONS) {
  const a = TOK_ARM[id], L = a?.lv[l - 1]; if (!L) return null;
  const B = WEAPONS.find((w) => w.id === a.base); if (!B) return null;
  const { z, price, ...v } = L;
  return { ...B, ...v, name: a.name, tok: id, lv: l, price: 0 };
}
