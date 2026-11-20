// 새 버전 알림 (#134): 실서버에 새 버전이 나와도 하던 사람은 예전 버전 그대로라서, 새로 나오면 위쪽에 '새로고침' 알림을 띄운다.
// version.json({ v, main })은 빌드(build.mjs)가 index.html 옆에 같이 만든다. 5분마다·탭으로 돌아올 때 캐시 없이 받아 지금 main-해시.js 와 비교.
// 전투 중·튜토리얼 중·창이 열려 있을 때는 미뤘다가 끝나면 띄운다. 닫으면 30분쯤 뒤 다시. 서버가 minVer(최소 버전)를 알려 주면 닫을 수 없는 알림.
import { VERSION } from '../version.js';
import { assetHooks } from '../assets.js';
import { state, late } from './state.js';
import { $, persist, writeLocal } from './save.js';
import { busy } from './hud.js';
import { life, player } from './place.js';

export const NEWVER = { pollSec: 300, snoozeMin: 30, snoozeJitter: 0.5 };
const myMain = document.querySelector('script[data-main]')?.getAttribute('data-main') || ''; // 한 파일(test.html)이면 비어 있음 → 확인 안 함
let pending = false, forced = false, shown = false, snooze = 0, lastPoll = 0, polling = false;

const num = (s) => String(s || '').split('.').map((n) => parseInt(n, 10) || 0);
export const verLess = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0); } return false; };

const box = document.createElement('div');
box.id = 'newver'; box.className = 'tip-toast panel go'; box.setAttribute('role', 'status'); box.hidden = true;
box.innerHTML = '<span>새 버전이 나왔어요</span><button type="button" class="btn small primary" id="newver-go">새로고침</button><button type="button" class="btn small" id="newver-x" aria-label="닫기">✕</button>';
document.body.append(box);

async function reload() {
  const b = $('newver-go'); b.disabled = true;
  try { persist(); await Promise.race([state.account?.push?.(), new Promise((r) => setTimeout(r, 3000))]); writeLocal(); } catch (e) { /* 저장 실패해도 이 기기 기록은 이미 씀 */ }
  location.reload();
}
$('newver-go').addEventListener('click', reload);
$('newver-x').addEventListener('click', () => { box.hidden = true; shown = false; snooze = NEWVER.snoozeMin * 60 * (1 - NEWVER.snoozeJitter / 2 + Math.random() * NEWVER.snoozeJitter); });

function want(force = false) { pending = true; if (force) { forced = true; $('newver-x').hidden = true; } }
async function poll() {
  if (!myMain || polling || pending) return;
  polling = true; lastPoll = Date.now();
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    if (j && typeof j.main === 'string' && j.main && j.main !== myMain) want();
  } catch (e) { /* 못 받으면 조용히 넘어감 */ } finally { polling = false; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastPoll > 10000) poll(); });

// 서버가 '너무 낡았다' 고 알림: hi 메시지의 minVer (지금은 서버가 비워 둠)
export const checkMinVer = (min) => { if (min && verLess(VERSION, min)) want(true); };
// 모델 받기 404: 배포로 예전 파일이 지워졌다는 뜻
assetHooks.stale = () => want();
late.newver = { checkMinVer };

const blocked = () => document.body.classList.contains('tut') || busy() || life.enemies.near(player.pos, 25) || !state.sessionOn;
let acc = 0;
export function tickNewVer(dt) {
  if (snooze > 0) snooze -= dt;
  acc += dt;
  if (acc >= 1) { acc = 0; if (Date.now() - lastPoll > NEWVER.pollSec * 1000) poll(); }
  if (!pending) return;
  if (!shown && (snooze <= 0 || forced) && !blocked()) { box.hidden = false; shown = true; }
  else if (shown && forced) box.hidden = false;
}
