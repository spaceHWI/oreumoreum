// 캐릭터 고르기·머리, 표지판, 탐방로 고르기 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { HAIR } from '../balance.js';
import { SKIN_TONES } from '../runner.js';
import { MAPS } from '../maps.js';
import { late } from './state.js';
import { $, save, CL, clothGear, syncEquipGear, lookS, persist, MAP_ID } from './save.js';
import { spots } from './scene.js';
import { runner, player } from './place.js';
import { cam, followCam } from './camera.js';
import { closePanels, cancelAll, ach } from './hud.js';
import { marker } from './input.js';
import { net } from './room.js';
import { LC_SLOTS, tintGear, lcClean, colorDots, markDots } from '../lookcolors.js'; // 기본 옷 색 (#155)
import { LOOK_COLORS, NICK } from '../balance.js';
import { cleanText, nickOk, randomNick } from '../safetext.js'; // 이름 (#162)

Object.assign(late, { openSign, leaveTo }); // 옷장은 내 가방(#166, bag.js)으로 옮김 // 앞 파일에서 부르는 함수

// ---------- 캐릭터 고르기·머리 (#51) ----------
const HEAD_SVG = (key, skin = SKIN_TONES[0]) => { // 머리 그림 (상점·고르기 화면)
  const hair = '#2b2724', face = `<circle cx="20" cy="22" r="11" fill="${skin}"/><circle cx="16" cy="23" r="1.6" fill="#2b2724"/><circle cx="24" cy="23" r="1.6" fill="#2b2724"/>`;
  const H = {
    'hat:short': `${face}<path d="M8.5 21c0-8 5-12 11.5-12S31.5 13 31.5 21c-2-3-5-5-9-5-3 0-5 1-7 3-2-1-4 0-7 2z" fill="${hair}"/>`,
    'hat:bob': `<path d="M7.5 30V20c0-8 5.5-12 12.5-12s12.5 4 12.5 12v10h-5V21H12.5v9z" fill="${hair}"/>${face}<path d="M8.5 20c0-7 5-11 11.5-11s11.5 4 11.5 11c-4-1-7-2-11.5-2s-7.5 1-11.5 2z" fill="${hair}"/>`,
    'hat:bun': `<circle cx="20" cy="6.5" r="4.5" fill="${hair}"/>${face}<path d="M8.5 21c0-8 5-11.5 11.5-11.5S31.5 13 31.5 21c-3-2-6-3-11.5-3s-8.5 1-11.5 3z" fill="${hair}"/>`,
    'hat:cap': `${face}<path d="M8.5 19c0-7 5-10.5 11.5-10.5S31.5 12 31.5 19z" fill="#5c9a3c"/><path d="M27 18.5h8c0 1.5-1 2.5-3 2.5h-5z" fill="#4a8030"/>`,
  };
  return `<svg viewBox="0 0 40 40" aria-hidden="true">${H[key] || ''}</svg>`;
}; late.HEAD_SVG = HEAD_SVG;
const wearHair = (key) => { save.outfit.gear = { ...(save.outfit.gear || {}), hair: key }; syncEquipGear(); runner.apply(save.outfit); persist(); net.send(true); }; late.wearHair = wearHair;
// 머리는 루이네 미장원(#58)에서만 바꿈 (상점 옷 탭·옷장의 머리 줄은 없앰)
// 고르기 화면: 성별(기본 머리) 둘 + 피부색 셋 + 확인. 고르면 바로 캐릭터에 입혀 보임
export function lookPreview() {
  const of = { ...save.outfit, skin: { color: SKIN_TONES[lookS.skin] }, gear: tintGear({ ...(save.outfit.gear || {}), ...clothGear(), hair: HAIR.start[lookS.sex], hat: CL.wear.hat || 'hat:none' }, lookS.colors) };
  runner.apply(of);
  document.querySelectorAll('#look [data-sex]').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.sex === lookS.sex)); b.innerHTML = HEAD_SVG(HAIR.start[b.dataset.sex], SKIN_TONES[lookS.skin]); });
  document.querySelectorAll('#look [data-skin]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.skin === lookS.skin)));
  document.querySelectorAll('#look-colors .lc-dots').forEach((r) => markDots(r, lookS.colors[r.dataset.k]));
}
export function openLook() {
  if (lookS.open) return;
  cancelAll(); player.target = null; marker.visible = false;
  lookS.open = true; lookS.t = 0; lookS.sex = save.look?.sex || 'm'; lookS.skin = save.look?.skin || 0; lookS.colors = lcClean(save.look?.colors);
  cam.mode = 'look'; $('look').hidden = false; document.body.classList.add('looking'); lookPreview();
  $('look-nickrow').hidden = !!save.nickSet; $('look-nick').value = save.nick; $('look-nick').placeholder = save.nick; checkLookNick(); // 처음 한 번만 이름을 지음. 정한 뒤 바꾸기는 이름 바꾸기 창 (#162)
}
// 이름 칸 (#162): 걸리면 칸 아래 한 줄만 보이고(어느 낱말인지는 말하지 않음) 시작 버튼이 눌리지 않음
const lookNick = () => cleanText($('look-nick').value, NICK.max + 4) || save.nick; /* #230 비워 두면 처음 붙은 이름 그대로 */
function checkLookNick() {
  const ok = !!save.nickSet || nickOk(lookNick()), typed = $('look-nick').value.trim() !== '';
  $('look-nick-err').hidden = ok || !typed; $('look-nick-hint').hidden = !$('look-nick-err').hidden; $('look-nick').setAttribute('aria-invalid', String(!ok)); $('look-ok').disabled = !ok;
  return ok;
}
export function closeLook() {
  if (!checkLookNick()) return false;
  if (!save.nickSet) { save.nick = lookNick(); save.nickSet = 1; }
  save.look = { sex: lookS.sex, skin: lookS.skin, colors: lcClean(lookS.colors) };
  const start = HAIR.start[lookS.sex]; save.hairs[start] = 1;
  save.outfit.skin = { color: SKIN_TONES[lookS.skin] }; save.outfit.gear = { ...(save.outfit.gear || {}), hair: start }; syncEquipGear();
  lookS.open = false; $('look').hidden = true; document.body.classList.remove('looking'); cam.mode = 'follow';
  runner.apply(save.outfit); persist(); net.send(true); followCam(0, true);
}
{
  const sx = $('look-sex'), sk = $('look-skin');
  ['m', 'f'].forEach((v) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.sex = v; b.setAttribute('aria-label', v === 'm' ? '기본 남성 · 짧은 머리' : '기본 여성 · 단발'); b.addEventListener('click', () => { lookS.sex = v; lookPreview(); }); sx.append(b); });
  SKIN_TONES.forEach((c, i) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.skin = i; b.style.background = c; b.setAttribute('aria-label', ['밝은 피부', '중간 피부', '어두운 피부'][i]); b.addEventListener('click', () => { lookS.skin = i; lookPreview(); }); sk.append(b); });
  $('look-ok').addEventListener('click', closeLook);
  // 기본 옷 색 (#155): 모자·티·바지·신발 줄마다 색 동그라미, 아무거나
  const lc = $('look-colors');
  LC_SLOTS.forEach((k) => { const r = document.createElement('div'); r.className = 'lc-row'; r.innerHTML = `<span class="lc-k">${LOOK_COLORS.names[k]}</span>`; r.append(colorDots(k, 0, (i) => { lookS.colors[k] = i; lookPreview(); })); lc.append(r); });
  $('look-rand').addEventListener('click', () => { LC_SLOTS.forEach((k) => { lookS.colors[k] = Math.floor(Math.random() * LOOK_COLORS[k].length); }); lookPreview(); });
}
$('look-nick').addEventListener('input', checkLookNick);
$('look-nick').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('look-nick').blur(); } });
$('look-nick-dice').addEventListener('click', () => { $('look-nick').value = randomNick(); checkLookNick(); });

function openSign() { closePanels(); $('sign').hidden = false; ach.emit('sign'); }
$('sign-body').innerHTML = spots.sign.html;

// 탐방로 고르기
export let introMap = MAP_ID;
export function switchMap(id) { save.prevMap = MAP_ID; save.map = id; persist(); location.hash = id; location.reload(); }
export let leaving = false;
export function leaveTo(id) {
  leaving = true; player.target = null; player.onArrive = null;
  if (save.tut && !save.tut.done) { save.tut.done = true; }
  save.entered = 1; save.introSound = late.sound.on ? 1 : 0; persist();
  $('flash').hidden = false; $('flash').classList.remove('go'); $('flash').style.transition = 'opacity .5s'; $('flash').style.opacity = '0'; requestAnimationFrame(() => { $('flash').style.opacity = '1'; });
  setTimeout(() => switchMap(id), 520);
}
