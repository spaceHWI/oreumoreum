// 귤 맞춤 기록·운영자 귤 보내기 (#188): 어드민(개발자 메뉴)만. 서버 GET /admin/clamps · GET /admin/grants · POST /admin/grant
// 깎인 기록을 누르면 그 줄의 계정 번호·깎인 수가 보내기 칸에 들어감 (돌려주기)
import { adminApi } from '../online.js';
import { cleanText } from '../safetext.js';
import { $ } from './save.js';
import { toast, closePanels } from './hud.js';

const kst = (t) => new Date(t).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
const li = (head, body, meta, onClick) => {
  const e = document.createElement('li');
  const h = document.createElement('small'); h.textContent = head;
  const t = document.createElement('div'); t.className = 't'; t.textContent = body;
  const m = document.createElement('small'); m.textContent = meta;
  e.append(h, t, m); if (onClick) e.addEventListener('click', onClick);
  return e;
};
async function load() {
  const cl = $('clamp-list'), gl = $('grant-list'); cl.textContent = ''; gl.textContent = '';
  const [c, g] = await Promise.all([adminApi.clamps().catch(() => null), adminApi.grants().catch(() => null)]);
  if (!Array.isArray(c)) toast('기록을 불러오지 못했어요');
  for (const r of c || []) cl.append(li(`${kst(r.at)} · ${cleanText(r.nick, 24) || '이름 없음'} · v${cleanText(r.ver, 20) || '?'}`, `귤 -${r.amt} (${cleanText(r.why, 20)}) ${r.before} → 요청 ${r.ask} → ${r.after}`,
    `계정 ${cleanText(r.sub, 80)} · 몫 ${r.info?.room ?? '?'} · 인정 ${r.info?.rec ?? '?'} · 거절한 판 것 ${r.info?.bad ?? 0}`,
    () => { $('grant-sub').value = r.sub; $('grant-n').value = r.amt; $('grant-why').value = '잘못 깎인 귤을 돌려드려요'; }));
  if (Array.isArray(c) && !c.length) cl.append(li('', '깎인 기록이 없어요', ''));
  for (const r of g || []) gl.append(li(`${kst(r.at)} · ${cleanText(r.nick, 24) || '이름 없음'}`, `귤 ${r.n} · ${cleanText(r.why, 60)}`, `계정 ${cleanText(r.sub, 80)} · ${r.got ? '받음 ' + kst(r.got_at) : '아직 안 받음'}`));
}
function open() { closePanels(); $('gyuladm').hidden = false; load(); }
let on = false;
export function initGyulAdmin() {
  if (on || !adminApi) return; on = true;
  $('dev-gyuladm').addEventListener('click', open);
  $('gyuladm-refresh').addEventListener('click', load);
  $('gyuladm-close').addEventListener('click', () => { $('gyuladm').hidden = true; });
  $('gyuladm').addEventListener('pointerdown', (e) => { if (e.target === $('gyuladm')) $('gyuladm').hidden = true; });
  for (const id of ['grant-sub', 'grant-n', 'grant-why']) $(id).addEventListener('keydown', (e) => e.stopPropagation());
  $('grant-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const sub = $('grant-sub').value.trim(), n = Math.floor(Number($('grant-n').value)), why = $('grant-why').value.trim();
    if (!sub || !(n > 0) || !why) return;
    $('grant-send').disabled = true;
    try { await adminApi.grant(sub, n, why); toast(`귤 ${n}개를 보냈어요 (다음 접속 때 받음)`); $('grant-n').value = ''; load(); } catch (err) { toast(err.status === 404 ? '그 계정이 없어요' : '보내지 못했어요'); }
    $('grant-send').disabled = false;
  });
}
