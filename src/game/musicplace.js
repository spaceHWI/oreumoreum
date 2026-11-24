// 음악이 고르는 곳 (#292): 0.5초마다 플레이어 자리를 보고 sound.setPlace(곳, 사건 장면) 를 부름. 곡은 src/music.js·musiccalm.js
// 곳: 불멍(숙소 불가 앉음) fire · 정상 전망 top · 가게 거리·들머리(구역 밖) bright · 초보·중수 구역(숲길·사면) calm · 고수 구역(능선·굼부리)·동굴 sparse
// 밤은 music.js 가 해 높이로 정함(불멍은 밤에도 불멍). 사건 장면·엔딩(state.cine, 수거 관 이동은 빼고)이면 음악을 MUSIC.cine 배로 줄임
import { ZONE_LOOK } from '../balance.js';
import { STREET } from '../streetlayout.js';
import { state } from './state.js';
import { spots } from './scene.js';
import { trash, player } from './place.js';

let wait = 0, last = '';
export function placeNow() {
  const p = player.pos;
  if (document.body.classList.contains('mung')) return 'fire';
  if (state.cave) return 'sparse';
  if (spots.isViewpoint?.(p)) return 'top';
  if (STREET?.center && Math.hypot(p.x - STREET.center.x, p.z - STREET.center.z) < (STREET.radius || 30)) return 'bright';
  const z = trash ? trash.zoneAt(p.x, p.z) : 1, tier = ZONE_LOOK.tier[z] | 0;
  return !z ? 'bright' : tier >= 3 ? 'sparse' : 'calm';
}
export function tickMusicPlace(dt, sound) {
  if ((wait -= dt) > 0 || !sound.music) return; wait = 0.5;
  const c = state.cine, cine = !!c && c.kind !== 'tube', pl = placeNow(), key = pl + (cine ? '!' : '');
  if (key !== last) { last = key; sound.setPlace(pl, cine); }
}
