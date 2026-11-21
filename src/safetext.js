// 남이 보낸 글 다듬기 (#84): 닉네임·말풍선·의견. 서버(server/src)와 게임이 같이 씀 (three 를 끌어오지 않음)
// 제어 문자·글자 방향 바꾸기(RLO 등)·폭 없는 글자·꺾쇠(<>)를 빼고 길이를 자른다. 화면에는 늘 글자(textContent·캔버스)로만 그린다
import { BAN, ALLOW, STAFF, STAFF_WORD, ADJ, NOUN } from './nickwords.js';
import { NICK } from './balance.js';
// eslint-disable-next-line no-control-regex
const BAD = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿￹-￻<>]/g;
export function cleanText(v, max, { lines = false } = {}) {
  if (typeof v !== 'string') return '';
  let s = lines ? v.replace(/\r\n?/g, '\n').replace(/[^\S\n]+/g, ' ') : v.replace(/\s+/g, ' ');
  s = lines ? s.split('\n').map((l) => l.replace(BAD, '')).join('\n').replace(/\n{3,}/g, '\n\n') : s.replace(BAD, '');
  return [...s.trim()].slice(0, max).join(''); // 글자(코드 포인트) 단위로 자름 (이모지 반쪽 막기)
}

// 이름 거르기 (#162): 목록은 nickwords.js. nickBad = 욕설·성적인 말·혐오·사칭이 들어 있음, nickOk = 새로 짓는 이름으로 써도 됨 (글자 수·글자 종류까지)
const LEET = { 1: 'i', '!': 'i', '|': 'i', 0: 'o', '@': 'a', 4: 'a', 3: 'e', 5: 's', $: 's', 7: 't', 8: 'b', 9: 'g' };
const N = (w) => w.normalize('NFKC'); // NFKC 는 낱자 ㅅ(U+3145)를 첫소리 자모(U+1109)로 바꾸므로 목록도 같은 모양으로
const CHO = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'].map(N);
const BANN = BAN.map(N), ALLOWN = ALLOW.map(N), JAMO_BAN = BAN.filter((w) => /^[ㄱ-ㅎ]{2,}$/.test(w)).map(N);
// 비교할 모양 여럿: ① 글자 바꿔치기를 풀고 한글·영문만 ② 한글만(사이 숫자·영문 무시) ③ 영문만 ④ 첫소리만(초성 욕 'ㅅㅂ' 을 '시ㅂ'·'ㅅ발' 처럼 섞어 쓴 것)
function forms(name) {
  const s = String(name || '').normalize('NFKC').toLowerCase();
  const lt = [...s].map((c) => LEET[c] || c).join('');
  const hl = lt.replace(/[^\p{Script=Hangul}a-z]/gu, ''), h = s.replace(/[^\p{Script=Hangul}]/gu, ''), l = lt.replace(/[^a-z]/g, '');
  const cho = [...h].map((c) => { const k = c.charCodeAt(0) - 0xac00; return k >= 0 && k < 11172 ? CHO[Math.floor(k / 588)] : c; }).join('');
  return { list: [hl, h, l], cho, raw: s };
}
const cut = (s) => ALLOWN.reduce((a, w) => a.split(w).join('·'), s);
export function nickBad(name) {
  const { list, cho, raw } = forms(name);
  if (list.some((f) => { const c = cut(f); return BANN.some((w) => c.includes(w)) || STAFF.some((w) => f.includes(w)); })) return true;
  const ch = cut(cho); if (JAMO_BAN.some((w) => ch.includes(w)) && /[\u1100-\u11ff\u3131-\u318e]/.test(raw)) return true; // 첫소리 욕은 이름에 낱자(ㄱ~ㅎ)가 섞였을 때만 (평범한 낱말의 첫소리가 우연히 같은 것은 통과)
  return STAFF_WORD.some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(raw));
}
const NICK_CH = /^[\p{Script=Hangul}A-Za-z0-9 _.\-\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️]+$/u;
export function nickOk(name) {
  if (typeof name !== 'string') return false;
  const s = cleanText(name, NICK.max + 1), n = [...s].length;
  if (s !== name.trim().replace(/\s+/g, ' ') || n < NICK.min || n > NICK.max || !NICK_CH.test(s) || !/[^ _.\-]/.test(s)) return false;
  if (n >= NICK.max && new Set(s).size === 1) return false; // 같은 글자만 가득
  return !nickBad(s);
}
export const randomNick = () => `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${NOUN[Math.floor(Math.random() * NOUN.length)]}`;
// 이름 바꾸기 값 (#162): n = 지금까지 바꾼 횟수(처음 짓기 빼고), free = 서버가 걸린 이름을 바꿔 준 뒤 한 번 무료
export const nickPrice = (n, free) => (free || !(n > 0) ? 0 : Math.min(NICK.cap, Math.round((NICK.price * NICK.grow ** (n - 1)) / 50) * 50));
