// 폰 발열 재기 창 (#271): 주소에 ?heat=1 일 때만 game/fps.js 가 불러옴. 사용자가 실제 폰에서 돌려 보고 요약을 복사해 보냄
// 화면 구석에 fps·프레임 셈 시간·그리는 수·삼각형·픽셀 배율·단계·배터리(%). PERF.heatLog.every 초마다 한 줄을 쌓고,
// PERF.heatLog.total 초 뒤(또는 '요약' 누르면) 처음 base 초 대비 프레임 시간 변화·배터리 줄어든 양·단계가 내려간 때를 보여 주고 복사 단추
import { PERF } from '../balance.js';
import { VERSION } from '../version.js';
import { late } from './state.js';
import { renderer, quality } from './scene.js';

const L = PERF.heatLog;
const css = document.createElement('style');
css.textContent = `#heatlog{position:fixed;left:calc(6px + var(--safe-l,0px));bottom:calc(6px + var(--safe-b,0px));z-index:90;max-width:min(92vw,330px);font:600 11px/1.35 ui-monospace,Menlo,monospace;color:#e8f3e8;background:rgba(10,14,12,.72);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:6px 8px;pointer-events:auto;white-space:pre-wrap}
#heatlog .b{display:flex;gap:6px;margin-top:4px}#heatlog button{font:700 11px var(--body,sans-serif);padding:3px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:inherit}
#heatlog .sum{max-height:40vh;overflow:auto;margin-top:4px;border-top:1px solid rgba(255,255,255,.15);padding-top:4px}`;
document.head.append(css);
const box = document.createElement('div'); box.id = 'heatlog';
box.innerHTML = '<div class="now"></div><div class="b"><button type="button" class="s">요약</button><button type="button" class="c" hidden>복사</button><button type="button" class="x">접기</button></div><div class="sum" hidden></div>';
document.body.append(box);
const nowEl = box.querySelector('.now'), sumEl = box.querySelector('.sum'), cBtn = box.querySelector('.c');

let bat = null; navigator.getBattery?.().then((b) => { bat = b; }).catch(() => {});
const batPct = () => (bat ? Math.round(bat.level * 100) : null);
const t0 = performance.now(), rows = [];
let acc = { n: 0, ms: 0, calls: 0, tris: 0, t: performance.now() }, last = null, done = false, fold = false;

late.heatLog = (ms) => {
  acc.n++; acc.ms += ms; acc.calls += renderer.info.render.calls; acc.tris += renderer.info.render.triangles;
  const now = performance.now(), dt = (now - acc.t) / 1000;
  if (dt < 1) return;
  const f = late.fps?.state?.() || {};
  last = { s: Math.round((now - t0) / 1000), fps: +(acc.n / dt).toFixed(1), ms: +(acc.ms / acc.n).toFixed(2), calls: Math.round(acc.calls / acc.n), tris: Math.round(acc.tris / acc.n), pr: +quality.pr.toFixed(2), lv: quality.level, heat: quality.heat, cap: f.cap, mode: f.mode, bat: batPct() };
  acc = { n: 0, ms: 0, calls: 0, tris: 0, t: now };
  if (!rows.length || last.s - rows[rows.length - 1].s >= L.every) rows.push(last);
  if (!fold) nowEl.textContent = `${last.fps}fps (상한 ${last.cap} ${last.mode}) · 셈 ${last.ms}ms\n그리기 ${last.calls} · 삼각형 ${(last.tris / 1000).toFixed(0)}k · 배율 ${last.pr}\n단계 ${last.lv} 발열 ${last.heat} · 배터리 ${last.bat ?? '?'}% · ${Math.floor(last.s / 60)}분 ${last.s % 60}초`;
  if (!done && last.s >= L.total) summary();
};

function summary() {
  done = true;
  const base = rows.filter((r) => r.s <= L.base), end = rows.slice(-Math.max(1, base.length)), avg = (a, k) => a.reduce((s, r) => s + r[k], 0) / (a.length || 1);
  const b0 = rows.find((r) => r.bat != null)?.bat, b1 = [...rows].reverse().find((r) => r.bat != null)?.bat;
  const ms0 = avg(base, 'ms'), ms1 = avg(end, 'ms'), f0 = avg(base, 'fps'), f1 = avg(end, 'fps');
  const drops = []; for (let i = 1; i < rows.length; i++) if (rows[i].lv < rows[i - 1].lv || rows[i].heat > rows[i - 1].heat) drops.push(`${Math.round(rows[i].s / 60)}분: 단계 ${rows[i].lv} 발열 ${rows[i].heat}`);
  const ua = navigator.userAgent.replace(/\s+/g, ' ').slice(0, 140);
  const txt = [`오름오름 발열 재기 v${VERSION} · ${Math.round(rows[rows.length - 1]?.s / 60 || 0)}분`, ua, `화면 ${innerWidth}×${innerHeight} 배율 ${quality.pr}`,
    `프레임 셈: 처음 ${L.base / 60}분 ${ms0.toFixed(2)}ms → 끝 ${ms1.toFixed(2)}ms (${ms0 ? ((ms1 / ms0 - 1) * 100).toFixed(0) : '?'}%)`,
    `fps: ${f0.toFixed(1)} → ${f1.toFixed(1)}`, `배터리: ${b0 ?? '?'}% → ${b1 ?? '?'}%${b0 != null && b1 != null ? ` (−${b0 - b1})` : ''}`,
    `내려간 때: ${drops.join(', ') || '없음'}`, `발열 기록: ${JSON.stringify(late.fps?.state?.().log || [])}`,
    '— 10초마다 —', ...rows.map((r) => `${r.s}s ${r.fps}fps ${r.ms}ms c${r.calls} t${Math.round(r.tris / 1000)}k pr${r.pr} L${r.lv}h${r.heat} ${r.mode} b${r.bat ?? '-'}`)].join('\n');
  sumEl.textContent = txt; sumEl.hidden = false; cBtn.hidden = false; cBtn.onclick = () => { navigator.clipboard?.writeText(txt).then(() => { cBtn.textContent = '복사됨'; }).catch(() => { const r = document.createRange(); r.selectNodeContents(sumEl); getSelection().removeAllRanges(); getSelection().addRange(r); }); };
}
box.querySelector('.s').addEventListener('click', (e) => { e.stopPropagation(); summary(); });
box.querySelector('.x').addEventListener('click', (e) => { e.stopPropagation(); fold = !fold; nowEl.hidden = fold; sumEl.hidden = fold || !done; e.currentTarget.textContent = fold ? '펴기' : '접기'; });
for (const ev of ['pointerdown', 'touchstart']) box.addEventListener(ev, (e) => e.stopPropagation());
