// 평소 음악의 악보와 음색 (#292). 엮는 차례는 music.js (Music._bar), 수치는 balance.js MUSIC.calm
// 음은 장조 5음 음계의 칸(0 = 으뜸음 key, 5 = 한 옥타브 위)으로 적음. null 은 쉼. 한 마디 = 8분음표 8칸
import { MUSIC } from './balance.js';

export const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];
export const degMidi = (d, key = MUSIC.calm.key) => key + 12 * Math.floor(d / 5) + PENTA[((d % 5) + 5) % 5];

// 가락 조각 12개 (가운데 마디들)
export const FRAGS = [
  [2, null, 3, null, 4, null, 3, null],
  [5, null, 4, 3, 2, null, null, null],
  [3, null, null, 5, 4, null, 2, null],
  [0, 2, 3, null, 5, null, null, null],
  [4, null, 5, null, 7, null, 5, null],
  [7, 6, 5, null, 4, null, null, null],
  [2, null, 2, 3, null, null, 1, null],
  [1, null, 2, null, null, 4, 3, null],
  [5, null, null, null, 3, null, 4, null],
  [3, 4, 5, null, 6, null, 5, null],
  [6, null, 5, null, 3, null, 2, null],
  [4, null, 3, null, null, null, null, null],
];
// 맺는 조각 (악구 끝 마디, 딸림화음 위: 레·솔로 끝남)
export const CADS = [
  [5, null, 4, null, 3, null, null, null],
  [2, null, 1, null, null, null, null, null],
  [4, 3, 2, null, 1, null, null, null],
];
// 화음 진행 (악구 4마디, 마디마다 화음 하나): [베이스, 패드 위 음] MIDI
const CH = { C: [36, 64], Am: [45, 60], F: [41, 57], G: [43, 62], Em: [40, 59], Dm: [38, 57] };
export const PROGS = [['C', 'Am', 'F', 'G'], ['F', 'C', 'Am', 'G'], ['Am', 'F', 'C', 'G'], ['C', 'Em', 'F', 'G'], ['Dm', 'F', 'C', 'G']].map((p) => p.map((k) => CH[k]));
// 불멍 기타: 화음을 뜯는 차례 (0 베이스·1 5도·2 옥타브·3 3도)
export const ARP = [0, 1, 2, 3, 2, 1, 3, 1];
const ARP_ST = [0, 7, 12, 16];

// 다음 마디 가락 고르기: 최근 3개는 피하고, 앞 마디 끝음에서 가까운 첫음을 고름. 가끔 한 칸 옮김
// 피하는 것은 그 묶음(가락·맺는 조각) 것만, 많아야 '묶음 수 - 1' 개: 맺는 조각은 3개뿐이라 가락 없이 맺기만 세 번 이으면 고를 것이 없었음 (#321)
export function pickFrag(recent, lastDeg, cad) {
  const pool = cad ? CADS : FRAGS, list = [], pre = cad ? 'c' : 'f';
  const avoid = recent.filter((id) => id[0] === pre).slice(1 - pool.length);
  for (let i = 0; i < pool.length; i++) {
    const id = pre + i; if (avoid.includes(id)) continue;
    const first = pool[i].find((d) => d != null), w = lastDeg == null ? 1 : 1 / (1 + Math.abs(first - lastDeg));
    list.push([id, pool[i], w]);
  }
  let r = Math.random() * list.reduce((s, x) => s + x[2], 0);
  for (const x of list) { r -= x[2]; if (r <= 0) return x; }
  return list[list.length - 1];
}

// 음색. 반환: 울리는 끝 시각. g 는 크기(0~1), out 마른 소리, wet 메아리로
export function playNote(c, inst, f, t, v, decay, out, wet) {
  const g = c.createGain(), oscs = [];
  const add = (type, freq, gain, dec) => {
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const og = c.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(gain, t + 0.006); og.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(og); og.connect(g); oscs.push([o, dec]);
  };
  let d;
  if (inst === 'pluck') {
    /* 기타 뜯기: 세모파+톱니파를 로우패스로 거르고 필터가 빨리 닫힘 */
    d = 1.3 * decay; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(420, t + 0.35);
    lp.connect(g);
    for (const [type, k, gn] of [['triangle', 1, 0.8], ['sawtooth', 1.002, 0.25]]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f * k;
      const og = c.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(gn, t + 0.004); og.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(og); og.connect(lp); oscs.push([o, d]);
    }
  } else if (inst === 'bell') { d = 2.6 * decay; add('sine', f, 1, d); add('sine', f * 2.76, 0.18, d * 0.4); }
  else if (inst === 'kalimba') { d = 1.7 * decay; add('sine', f, 1, d); add('sine', f * 3.01, 0.12, 0.18); }
  else { d = 1.4 * decay; add('sine', f, 1, d); add('triangle', f, 0.25, d * 0.6); add('sine', f * 4, 0.08, 0.1); } /* 마림바 */
  g.gain.value = v; g.connect(out); if (wet) g.connect(wet);
  for (const [o, dd] of oscs) { o.start(t); o.stop(t + dd + 0.05); }
  return t + d;
}
// 낮은 패드: 사인·세모파 두 겹, 느린 들고남
export function playPad(c, f, t, len, v, out) {
  const g = c.createGain(), att = Math.min(1.8, len / 3), rel = 1.6, end = t + len + rel;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + att); g.gain.setValueAtTime(v, t + len); g.gain.linearRampToValueAtTime(0, end);
  g.connect(out);
  for (const [type, cents] of [['sine', -4], ['triangle', 5]]) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = cents; o.connect(g); o.start(t); o.stop(end + 0.05); }
  return end;
}
export const arpMidi = (ch, k) => ch[0] + 12 + ARP_ST[ARP[k % 8]];
