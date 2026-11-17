// 남이 보낸 글 다듬기 (#84): 닉네임·말풍선·의견. 서버(server/src)와 게임이 같이 씀 (three 를 끌어오지 않음)
// 제어 문자·글자 방향 바꾸기(RLO 등)·폭 없는 글자·꺾쇠(<>)를 빼고 길이를 자른다. 화면에는 늘 글자(textContent·캔버스)로만 그린다
// eslint-disable-next-line no-control-regex
const BAD = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿￹-￻<>]/g;
export function cleanText(v, max, { lines = false } = {}) {
  if (typeof v !== 'string') return '';
  let s = lines ? v.replace(/\r\n?/g, '\n').replace(/[^\S\n]+/g, ' ') : v.replace(/\s+/g, ' ');
  s = lines ? s.split('\n').map((l) => l.replace(BAD, '')).join('\n').replace(/\n{3,}/g, '\n\n') : s.replace(BAD, '');
  return [...s.trim()].slice(0, max).join(''); // 글자(코드 포인트) 단위로 자름 (이모지 반쪽 막기)
}
