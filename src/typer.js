// 대사 타자 효과 (#224): 누가 말하는 글을 한 글자씩. 게임에 붙이는 일(소리·설정·프로필)은 game/talkfx.js
// - 자리를 먼저 잡음: 한 줄마다 <보이는 글><투명한 나머지> 두 조각이라 줄바꿈이 타자 도중에 튀지 않음
// - 한글은 완성된 글자 단위(Intl.Segmenter grapheme, 없으면 코드 포인트)
// - 빠르기 TALK.type: 초당 cps 자, 쉼표 뒤 comma 초, 마침표·물음표 뒤 stop 초. every 글자마다 blip(pitch)
// - finish(el): 바로 전체. 같은 el 에 새로 치면 앞의 것은 그 자리에서 끝남
const SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('ko', { granularity: 'grapheme' }) : null;
export const graphemes = (s) => (SEG ? Array.from(SEG.segment(String(s)), (x) => x.segment) : [...String(s)]);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PAUSE_COMMA = /[,，、]/, PAUSE_STOP = /[.?!…~。]/;

export function createTyper(o = {}) {
  const C = { cps: 28, comma: 0.12, stop: 0.28, every: 3, ...o.speed };
  const on = o.on || (() => true), blip = o.blip || (() => {});
  const live = new Map(); // el → 치는 중
  let raf = 0, last = 0;
  // 글자마다 나오는 때(초). 쉼표·마침표 뒤에 쉼
  function times(G) {
    const T = new Array(G.length); let t = 0;
    for (let i = 0; i < G.length; i++) {
      T[i] = t; t += 1 / C.cps;
      const g = G[i], nx = G[i + 1];
      if (nx !== undefined && !/\s/.test(g)) { if (PAUSE_STOP.test(g) && !PAUSE_STOP.test(nx)) t += C.stop; else if (PAUSE_COMMA.test(g)) t += C.comma; }
    }
    return { T, end: t };
  }
  // 걸리는 시간(초): 토스트 머무는 시간에 더함
  const dur = (lines) => { if (!on()) return 0; let s = 0; for (const l of [].concat(lines)) s += times(graphemes(l)).end; return s; };
  function draw(h, n) {
    let k = n;
    for (const r of h.rows) {
      const m = Math.max(0, Math.min(r.G.length, k)); k -= r.G.length;
      if (m === r.m) continue; r.m = m;
      r.s.textContent = r.G.slice(0, m).join(''); r.h.textContent = r.G.slice(m).join('');
    }
  }
  function end(h) {
    if (h.done) return; h.done = true; draw(h, h.N); live.delete(h.el);
    h.el.classList.remove('ty-run'); h.talker?.classList.remove('ty-talk');
    try { h.onDone?.(); } catch (e) { /* 끝난 뒤 할 일이 실패해도 글은 다 보임 */ }
  }
  function step(now) {
    raf = 0; const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    for (const h of [...live.values()]) {
      if (!h.el.isConnected || h.el.closest('[hidden]')) { end(h); continue; }
      h.t += dt; let n = h.n;
      while (n < h.N && h.T[n] <= h.t) { n++; const g = h.flat[n - 1]; if (!/\s/.test(g) && ++h.bc % C.every === 1) blip(h.pitch); }
      if (n !== h.n) { h.n = n; draw(h, n); }
      if (n >= h.N) end(h);
    }
    if (live.size) raf = requestAnimationFrame(step);
  }
  // el 에 lines(글 하나 또는 줄 배열)을 침. opt: tag(줄 틀, 기본 p · '' 이면 줄 틀 없이 이어 씀), pitch, talker(치는 동안 .ty-talk), onDone
  function type(el, lines, opt = {}) {
    if (!el) return null;
    const old = live.get(el); if (old) end(old);
    const L = [].concat(lines).map((x) => String(x ?? '')), tag = opt.tag === undefined ? 'p' : opt.tag;
    el.innerHTML = L.map((l) => (tag ? `<${tag}>` : '') + `<span class="ty-s"></span><span class="ty-h">${esc(l)}</span>` + (tag ? `</${tag}>` : '')).join('');
    const S = el.querySelectorAll('.ty-s'), H = el.querySelectorAll('.ty-h');
    const rows = L.map((l, i) => ({ G: graphemes(l), s: S[i], h: H[i], m: 0 }));
    const flat = rows.flatMap((r) => r.G), { T } = times(flat);
    const h = { el, rows, flat, T, N: flat.length, n: 0, t: 0, bc: 0, pitch: opt.pitch || 1, talker: opt.talker || null, onDone: opt.onDone, done: false };
    if (!on() || !h.N) { h.done = true; draw(h, h.N); opt.onDone?.(); return h; }
    live.set(el, h); el.classList.add('ty-run'); h.talker?.classList.add('ty-talk');
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
    return h;
  }
  const finish = (el) => { const h = live.get(el); if (!h) return false; end(h); return true; };
  const busy = (el) => (el ? live.has(el) : live.size > 0);
  return { type, finish, busy, dur, times: (s) => times(graphemes(s)), C };
}
