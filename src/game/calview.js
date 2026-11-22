// 철 달력 판 그림 (#222 어드벤트 캘린더). 셈·저장은 game/season.js, 모양 값은 balance.js SEASON.<철>.calLook (다음 철도 같은 판)
// drawCal(box, look, days): 5×5 칸에 작은 문. days = [{ d, st: 'done'|'today'|'miss'|'lock', r: 선물, label, just: 방금 엶 }]
// 문마다 크기·자리·기울기가 날짜로 조금씩 다름(jit). ribbon 날은 조금 크고 리본, big 날은 가운데 가장 큰 모양 문(tree)
// 연 문은 열린 채 안 그림, 오늘 문은 흔들리고 반짝, 놓친 날은 눈 덮인 문, 앞날은 잠긴 문. 방금 연 문은 열리며 선물이 튀어나옴
import { clothSvg } from '../clothicons.js';
import { CLOTHES } from '../balance.js';

const CN = Object.fromEntries(CLOTHES.map((c) => [c.id, c]));
const GYUL = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="22" r="12" fill="#f29a2e"/><circle cx="16" cy="18" r="3" fill="#ffc46a" opacity=".7"/><path d="M20 10c2-4 6-5 9-4-1 4-5 5-9 4z" fill="#3f9a5a"/></svg>';
const SNOW = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="22" r="11" fill="#f4f8ff" stroke="#b8c8dc" stroke-width="2"/><circle cx="16" cy="18" r="3" fill="#fff"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="11" width="12" height="9" rx="2" fill="currentColor"/><path d="M9 11V8a3 3 0 0 1 6 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const f = (d, k) => ((d * 37 + k * 17 + 5) % 11) / 10; /* 날짜로 정해지는 0~1 */
export const giftArt = (r) => (r.coins ? GYUL : r.cloth && CN[r.cloth] ? clothSvg(CN[r.cloth], 'gift') : SNOW);

// 판 색을 CSS 변수로 (테두리·문 색은 look.c)
export function paintBoard(board, look) {
  const c = look.c || {};
  const v = { '--xb': c.board, '--xf': c.frame, '--xf2': c.frame2, '--xi': c.ink, '--xr': c.rim, '--xl': c.lock, '--xrib': c.ribbon, '--xs': c.snow };
  for (const [k, x] of Object.entries(v)) if (x) board.style.setProperty(k, x);
  board.classList.toggle('roof-snow', look.roof === 'snow');
}

// 가장자리 눈송이 (n 개, 0 이면 없음)
export function flakes(el, n) {
  if (el.childElementCount === n) return;
  el.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i'), side = i % 2 ? 100 - (i * 7) % 16 : (i * 7) % 16;
    s.style.cssText = `left:${side}%;animation-delay:${-(i * 1.7) % 9}s;animation-duration:${7 + (i % 4) * 1.5}s;--fs:${0.6 + (i % 3) * 0.25}`;
    el.append(s);
  }
}

export function drawCal(box, look, days, onOpen) {
  box.innerHTML = '';
  const by = Object.fromEntries(days.map((x) => [x.d, x])), order = look.order?.length === days.length ? look.order : days.map((x) => x.d);
  const dc = look.c?.doors || ['#c8333a'], jit = look.jit ?? 0.5, rib = new Set(look.ribbon || []), big = look.big || {};
  for (const d of order) {
    const x = by[d]; if (!x) continue;
    const b = document.createElement('button'); b.type = 'button';
    b.className = `xd ${x.st}${rib.has(d) ? ' rib' : ''}${big[d] ? ' big ' + big[d] : ''}${x.just ? ' just' : ''}`;
    const s = big[d] ? 1.22 : rib.has(d) ? 1.04 : 1 - jit * 0.18 * f(d, 1);
    b.style.cssText = `--s:${s.toFixed(3)};--dx:${((f(d, 2) - 0.5) * jit * 8).toFixed(1)}px;--dy:${((f(d, 3) - 0.5) * jit * 8).toFixed(1)}px;--rot:${big[d] ? 0 : ((f(d, 4) - 0.5) * jit * 6).toFixed(1)}deg;--dc:${dc[d % dc.length]};--wd:${(f(d, 5) * 0.6).toFixed(2)}s`;
    b.innerHTML = `<span class="in">${giftArt(x.r)}<small></small></span><span class="leaf"><b>${d}</b>${x.st === 'lock' ? LOCK : ''}${x.st === 'miss' ? '<em></em><i class="cost"></i>' : ''}</span>${x.st === 'today' ? '<span class="spark" aria-hidden="true"></span>' : ''}`;
    b.querySelector('small').textContent = x.label || '';
    const cost = b.querySelector('.cost'); if (cost) cost.textContent = x.label || '';
    b.setAttribute('aria-label', x.aria || `${d}일`);
    b.disabled = x.st === 'done' || x.st === 'lock';
    b.addEventListener('click', () => onOpen(d));
    box.append(b);
  }
}

// 다 열면 칸: 실루엣(받기 전) → 색(받은 뒤), 진행 n/total 띠
export function drawAll(el, { name, items, title, coins, n, total, got }) {
  el.classList.toggle('got', !!got);
  el.querySelector('.xa-art').innerHTML = items.map((id) => (CN[id] ? clothSvg(CN[id], 'gift') : '')).join('');
  el.querySelector('.xa-what').textContent = `${name} 세트 · 칭호 '${title}' · 귤 ${coins}`;
  el.querySelector('.xa-n').textContent = got ? '받음' : `${n}/${total}`;
  el.querySelector('.xa-bar i').style.width = `${Math.min(100, (n / total) * 100)}%`;
}
