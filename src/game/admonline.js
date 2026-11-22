// 지금 접속 (#186): 어드민 설정 맨 위 한 줄 '지금 접속 ○명'. 누르면 방별 인원·로그인/손님·구역별(내 방)·오늘 최고
// 서버 GET /admin/online (어드민만, 숫자만). 메뉴와 어드민 설정이 열려 있을 때만 NET.onlinePollMs 마다 물음
// 구역별 인원은 서버가 지형을 모르므로 내 화면이 아는 같은 방 사람 자리(net.peersById)로 셈 (좌표는 서버가 내보내지 않음)
import { NET, ZONES } from '../balance.js';
import { MAPS } from '../maps.js';
import { getOnline } from '../online.js';
import { late } from './state.js';
import { $, MAP_ID } from './save.js';
import { trash, player } from './place.js';
import { admTab } from './admwin.js';

let on = false, last = 0, busy = false, data = null, wasOpen = false;
const kstHM = (t) => new Date(t).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false });
const mapName = (id) => MAPS[id]?.short || MAPS[id]?.name || id;
const zoneName = (z) => (z ? ZONES[z - 1]?.name || '구역 ' + z : '들머리');
const isOpen = () => !$('admwin').hidden && admTab() === 'state' && !document.hidden; /* 어드민 창 '상태' 탭 (#220) */

function row(k, v, me) {
  const d = document.createElement('div'); d.className = 'r' + (me ? ' me' : '');
  const a = document.createElement('span'); a.textContent = k; const b = document.createElement('b'); b.textContent = v;
  d.append(a, b); return d;
}
const head = (t) => { const h = document.createElement('div'); h.className = 'h'; h.textContent = t; return h; };
// 내 방 구역별: 나 + 같은 방에서 보이는 사람
function zoneCounts() {
  if (!trash?.zoneAt) return null;
  const c = new Map(), add = (x, z) => { const k = trash.zoneAt(x, z) || 0; c.set(k, (c.get(k) || 0) + 1); };
  add(player.pos.x, player.pos.z);
  const pb = late.net?.peersById; if (pb) for (const e of pb.values()) if (e.pos) add(e.pos.x, e.pos.z);
  return [...c].sort((a, b) => a[0] - b[0]);
}
function draw() {
  $('adm-onl-n').textContent = data ? data.n.toLocaleString('ko-KR') : '–';
  const box = $('adm-onl-d'); if (box.hidden) return;
  box.replaceChildren();
  if (!data) { box.append(row('불러오는 중', '')); return; }
  box.append(row('로그인 / 손님', `${data.login} / ${data.guest}`));
  if (data.peak) box.append(row('오늘 최고', `${data.peak.n}명 · ${kstHM(data.peak.at)}`));
  const myCh = late.mpRoom?.ch;
  box.append(head('방'));
  if (!data.rooms.length) box.append(row('열린 방 없음', ''));
  for (const r of data.rooms) box.append(row(`${mapName(r.map)} ${r.ch + 1}번 방`, `${r.n}명 (로그인 ${r.login})`, r.map === MAP_ID && r.ch === myCh));
  const zc = zoneCounts();
  if (zc) { box.append(head('내 방 구역별')); for (const [z, n] of zc) box.append(row(zoneName(z), n + '명')); }
}
async function load() {
  if (busy) return; busy = true; last = Date.now();
  try { data = await getOnline(); } catch (e) { if (e && e.status === 403) { $('adm-onl-sec').hidden = true; on = false; } } finally { busy = false; }
  draw();
}
export function initOnline() {
  if (on || !getOnline) return; on = true; // 서버 없음(혼자 하기)이면 getOnline 이 없어 줄이 숨은 채로
  $('adm-onl-sec').hidden = false;
  $('adm-onl').addEventListener('click', () => { const b = $('adm-onl-d'), open = b.hidden; b.hidden = !open; $('adm-onl').setAttribute('aria-expanded', String(open)); draw(); });
  // 1초마다 열려 있는지만 보고, 막 열렸거나 onlinePollMs 가 지났으면 물음. 닫혀 있으면 묻지 않음
  setInterval(() => {
    if (!on) return;
    const o = isOpen();
    if (o && (!wasOpen || Date.now() - last >= NET.onlinePollMs)) load();
    else if (o && !$('adm-onl-d').hidden) draw(); // 구역별(내 화면 값)은 그사이에도 새로
    wasOpen = o;
  }, 1000);
}
