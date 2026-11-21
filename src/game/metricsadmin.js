// 어드민 '수치' 표 (#121): 개발자 메뉴 → 수치. 서버 GET /admin/metrics (어드민 계정만) 의 날짜별 합계를 줄(잴 것) × 칸(날짜) 표로
// 출처 단추: 실서버(live) · dev(/dev/) · 어드민 계정 플레이(adm)
import { METRICS } from '../balance.js';
import { adminApi } from '../online.js';
import { $ } from './save.js';
import { toast, closePanels } from './hud.js';

const TUT = ['walk', 'zoom', 'run', 'gyul', 'throw', 'pick', 'dump', 'bonus', 'tongs', 'bag', 'gate']; // tutorial.js steps 순서
const f1 = (v) => (v == null || !Number.isFinite(v) ? '·' : Math.abs(v) >= 100 ? Math.round(v).toLocaleString('ko-KR') : String(Math.round(v * 10) / 10));
const dayStr = (d) => new Date(d * 864e5).toISOString().slice(5, 10); // 한국 날 번호 → 월-일
// 줄: [이름, 값(g) ] 또는 [이름, '갈래 접두'] (그 갈래를 '이름 값' 으로 늘어놓음). g(k) = { s, n }
const sum = (g, k) => g(k).s, avg = (g, k) => (g(k).n ? g(k).s / g(k).n : null);
const ROWS = [
  ['들어오기'],
  ['들어온 수', (g) => sum(g, 'in')], ['처음 온 사람', (g) => sum(g, 'new')], ['다시 온 사람', (g) => sum(g, 'ret')], ['구글 로그인', (g) => sum(g, 'glog')],
  ['기기', 'dev:'], ['어디서', 'ref:'], ['인앱 브라우저', 'app:'],
  ['플레이 시간'],
  ['평균(분)', (g) => (sum(g, 'in') ? sum(g, 'play') / sum(g, 'in') / 60 : null)],
  ['1분 안', (g) => sum(g, 'in') - sum(g, 'pt1')], ['1~5분', (g) => sum(g, 'pt1') - sum(g, 'pt5')], ['5~15분', (g) => sum(g, 'pt5') - sum(g, 'pt15')], ['15분 넘게', (g) => sum(g, 'pt15')],
  ['튜토리얼'], ['칸 도착 (번호 이름)', 'tut:'],
  ['줍기'],
  ['첫 줍기까지(초, 처음 온 사람)', (g) => avg(g, 'fpick')], ['주운 수', (g) => sum(g, 'pick')], ['치운 더미', (g) => sum(g, 'heap')], ['도감 새 항목', (g) => sum(g, 'dex')],
  ['구역 도착', 'zone:'], ['정상 도착', (g) => sum(g, 'top')],
  ['귤·가게'],
  ['번 귤', (g) => sum(g, 'earn')], ['쓴 귤', (g) => sum(g, 'spend')], ['산 것', 'buy:'], ['탄 것', 'ride:'], ['마차', (g) => sum(g, 'cart')],
  ['적'], ['만남', 'em:'], ['쫓아냄', 'er:'], ['쓰러짐', (g) => sum(g, 'down')],
  ['멀티'], ['같이 있던 사람 평균', (g) => avg(g, 'peer')], ['최대', (g) => sum(g, 'peermx')], ['동작', (g) => sum(g, 'emote')], ['말', (g) => sum(g, 'chat')],
  ['성능'], ['기기 단계', 'tier:'], ['평균 fps 구간', 'fps:'], ['자동 단계 내림', (g) => sum(g, 'qdown')], ['오류', (g) => sum(g, 'crash')],
  ['의견'], ['연 수', (g) => sum(g, 'fbopen')], ['보낸 수', (g) => sum(g, 'fbsend')],
];
const fpsName = (b) => { const c = METRICS.fpsCut; b = +b; return b === 0 ? `<${c[0]}` : b >= c.length ? `${c[c.length - 1]}+` : `${c[b - 1]}~${c[b]}`; };
const subName = (pre, s) => (pre === 'tut:' && /^\d+$/.test(s) ? `${s} ${TUT[+s] || ''}` : pre === 'fps:' ? fpsName(s) : pre === 'tier:' ? ['낮음', '보통', '높음'][+s] || s : s);

let rows = [], cur = 'live';
function draw() {
  const tb = $('mt-table'); tb.textContent = '';
  const by = new Map(); // d → Map(k → {s, n})
  for (const r of rows) if (r.src === cur) { if (!by.has(r.d)) by.set(r.d, new Map()); by.get(r.d).set(r.k, { s: r.sum, n: r.n }); }
  const days = [...by.keys()].sort((a, b) => b - a);
  const head = document.createElement('thead'), hr = document.createElement('tr');
  for (const t of ['', ...days.map(dayStr)]) { const th = document.createElement('th'); th.textContent = t; hr.append(th); }
  head.append(hr); tb.append(head);
  const body = document.createElement('tbody');
  for (const [name, fn] of ROWS) {
    const tr = document.createElement('tr'), td0 = document.createElement('td'); td0.textContent = name; tr.append(td0);
    if (fn == null) { tr.className = 'h'; td0.colSpan = days.length + 1; body.append(tr); continue; }
    for (const d of days) {
      const m = by.get(d), g = (k) => m.get(k) || { s: 0, n: 0 }, td = document.createElement('td');
      if (typeof fn === 'string') { td.className = 'g'; const list = [...m].filter(([k]) => k.startsWith(fn)).sort((a, b) => (fn === 'tut:' ? 0 : b[1].s - a[1].s)); td.textContent = list.map(([k, v]) => `${subName(fn, k.slice(fn.length))} ${f1(v.s)}`).join(' · ') || '·'; }
      else td.textContent = f1(fn(g));
      tr.append(td);
    }
    body.append(tr);
  }
  tb.append(body);
  $('mt-note').textContent = days.length ? `한국 날짜 기준 최근 ${METRICS.viewDays}일 · 합계만 (계정·IP 없음) · ${METRICS.keepDays}일 지나면 지움` : '아직 모인 수치가 없어요';
}
async function load() {
  const r = await adminApi.metrics(METRICS.viewDays).catch(() => null);
  if (!r || !Array.isArray(r.rows)) { toast('수치를 불러오지 못했어요'); rows = []; } else rows = r.rows;
  draw();
}
function open() { closePanels(); $('mtadm').hidden = false; load(); }
if ($('dev-metrics')) {
  if (!adminApi) $('dev-metrics').hidden = true;
  else {
    $('dev-metrics').addEventListener('click', open);
    $('mtadm-refresh').addEventListener('click', load);
    $('mtadm-close').addEventListener('click', () => { $('mtadm').hidden = true; });
    $('mtadm').addEventListener('pointerdown', (e) => { if (e.target === $('mtadm')) $('mtadm').hidden = true; });
    for (const b of document.querySelectorAll('[data-mtsrc]')) b.addEventListener('click', () => { cur = b.dataset.mtsrc; for (const x of document.querySelectorAll('[data-mtsrc]')) x.setAttribute('aria-pressed', String(x === b)); draw(); });
  }
}
