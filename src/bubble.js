// 머리 위 말풍선 한 틀 (#190): 채팅·NPC·동료·사진사(social.js showBubble)와 혼잣말(game/mutter.js)이 같이 씀
// - 줄 나눔: 한 줄 TALK.bubble.ch 자, TALK.bubble.lines 줄까지(채팅은 chatLines). 긴 NPC 대사는 bubblePages 로 두 장까지 넘김. 띄어쓰기에서 끊고(낱말이 너무 길면 글자에서), 넘치면 마지막 줄 끝을 '…'
// - 캔버스 크기는 가장 긴 줄에 맞춤. 글은 늘리거나 줄여 그리지 않는다(예전엔 한 줄을 maxWidth 로 눌러 그려 깨져 보였음)
import { TALK } from './balance.js';

const len = (s) => [...s].length;
// text → 줄 배열 (최대 lines 줄, 한 줄 ch 자)
export function bubbleLines(text, ch = TALK.bubble.ch, lines = TALK.bubble.lines) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const out = []; let cur = '', cut = false;
  const push = () => { if (cur) out.push(cur); cur = ''; };
  for (let w of words) {
    while (len(w) > ch) { // 낱말 하나가 한 줄보다 김: 글자에서 자름
      const room = cur ? ch - len(cur) - 1 : ch;
      if (room >= 2) { const a = [...w]; cur = (cur ? cur + ' ' : '') + a.slice(0, room).join(''); w = a.slice(room).join(''); }
      push(); if (out.length >= lines) { cut = true; break; }
    }
    if (cut) break;
    if (!w) continue;
    if (!cur) cur = w;
    else if (len(cur) + 1 + len(w) <= ch) cur += ' ' + w;
    else { push(); if (out.length >= lines) { cut = true; break; } cur = w; }
  }
  if (!cut) push();
  if (cut || out.length > lines) {
    out.length = lines;
    const a = [...out[lines - 1]]; out[lines - 1] = (a.length >= ch ? a.slice(0, ch - 1) : a).join('').replace(/[\s.,]+$/, '') + '…';
  }
  return out;
}

// 두 장까지 (#190): 긴 대사(혼잣말 실마리 등)는 잘라 버리지 않고 lines 줄씩 장을 넘김. 그래도 넘치면 마지막 장 끝을 '…'
export function bubblePages(text, ch = TALK.bubble.ch, lines = TALK.bubble.lines, pages = TALK.bubble.pages) {
  const all = bubbleLines(text, ch, lines * pages), out = [];
  for (let i = 0; i < all.length; i += lines) out.push(all.slice(i, i + lines));
  return out;
}

// 말풍선 캔버스 (text 대신 style.L 로 줄 배열을 줄 수 있음). style: { fill, stroke, ink, font, dash, lines }
export function bubbleCanvas(text, style = {}) {
  const font = style.font || '500 26px "Noto Sans KR", sans-serif';
  const L = style.L || bubbleLines(text, TALK.bubble.ch, style.lines || TALK.bubble.lines);
  const c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = font;
  const tw = Math.max(...L.map((l) => g.measureText(l).width), 60);
  const LH = 34, padX = 22, top = 8, bodyH = top * 2 + LH * L.length + 2;
  const w = Math.ceil(tw + padX * 2), h = bodyH + 16;
  c.width = w; c.height = h; g.font = font;
  g.fillStyle = style.fill || '#fbf6e6'; g.strokeStyle = style.stroke || '#33402a'; g.lineWidth = style.lineW || 4;
  if (style.dash) g.setLineDash(style.dash);
  const r = 18, B = bodyH;
  g.beginPath(); g.moveTo(r, 2); g.lineTo(w - r, 2); g.quadraticCurveTo(w - 2, 2, w - 2, r); g.lineTo(w - 2, B - r); g.quadraticCurveTo(w - 2, B, w - r, B);
  g.lineTo(w / 2 + 10, B); g.lineTo(w / 2, B + 14); g.lineTo(w / 2 - 10, B); g.lineTo(r, B); g.quadraticCurveTo(2, B, 2, B - r); g.lineTo(2, r); g.quadraticCurveTo(2, 2, r, 2); g.closePath(); g.fill(); g.stroke();
  g.setLineDash([]); g.fillStyle = style.ink || '#33402a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  L.forEach((l, i) => g.fillText(l, w / 2, top + 2 + LH * (i + 0.5)));
  return { canvas: c, w, h, lines: L };
}
// 캔버스 → 스프라이트 크기 (높이 72px 한 줄 말풍선 = 0.9m 와 같은 비율)
export const bubbleScale = (b) => [b.w / 72 * 0.9, b.h / 72 * 0.9];
