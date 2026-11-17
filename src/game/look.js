// 캐릭터 고르기·머리·옷장, 표지판, 탐방로 고르기 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { HAIR } from '../balance.js';
import { SKIN_TONES } from '../runner.js';
import { MAPS } from '../maps.js';
import { late } from './state.js';
import { $, ADJ, NOUN, pick, save, CL, clothGear, syncEquipGear, lookS, persist, MAP_ID } from './save.js';
import { spots } from './scene.js';
import { LEAPB, runner, player } from './place.js';
import { cam, followCam } from './camera.js';
import { busy, closePanels, cancelAll, ach } from './hud.js';
import { marker } from './input.js';
import { net } from './room.js';
import { openShop, buildWearRows } from './shop.js';

Object.assign(late, { buildWardrobe, openWardrobe, closeWardrobe, openSign, leaveTo }); // 앞 파일에서 부르는 함수

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
  const of = { ...save.outfit, skin: { color: SKIN_TONES[lookS.skin] }, gear: { ...(save.outfit.gear || {}), ...clothGear(), hair: HAIR.start[lookS.sex], hat: CL.wear.hat || 'hat:none' } };
  runner.apply(of);
  document.querySelectorAll('#look [data-sex]').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.sex === lookS.sex)); b.innerHTML = HEAD_SVG(HAIR.start[b.dataset.sex], SKIN_TONES[lookS.skin]); });
  document.querySelectorAll('#look [data-skin]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.skin === lookS.skin)));
}
export function openLook() {
  if (lookS.open) return;
  cancelAll(); player.target = null; marker.visible = false;
  lookS.open = true; lookS.t = 0; lookS.sex = save.look?.sex || 'm'; lookS.skin = save.look?.skin || 0;
  cam.mode = 'look'; $('look').hidden = false; document.body.classList.add('looking'); lookPreview();
}
export function closeLook() {
  save.look = { sex: lookS.sex, skin: lookS.skin };
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
}
let camBefore = null;
function buildWardrobe() { // 옷장 (#52): 가진 머리·옷만, 눌러서 갈아입기
  const body = $('wardrobe-body'); body.innerHTML = '';
  buildWearRows(body, false);
}
function openWardrobe() {
  if (busy()) return;
  player.target = null; marker.visible = false;
  camBefore = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist };
  cam.mode = 'wardrobe'; buildWardrobe();
  $('nick-mirror').textContent = save.nick;
  $('wardrobe').hidden = false;
}
function closeWardrobe() { $('wardrobe').hidden = true; cam.mode = 'follow'; if (camBefore) Object.assign(cam, camBefore); }
$('wardrobe-shop').addEventListener('click', () => { closeWardrobe(); openShop('wear'); });
$('wardrobe-shop').hidden = !!LEAPB; // 옷은 LEAP 에서 삼 (#59)
$('wardrobe-done').addEventListener('click', closeWardrobe);
$('nick-reroll').addEventListener('click', () => { save.nick = `${pick(ADJ)} ${pick(NOUN)}`; $('nick-mirror').textContent = save.nick; persist(); });

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
