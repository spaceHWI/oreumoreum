import * as THREE from 'three';
import { TEXCS } from './boot.js';
import { EMOTE } from './balance.js';

// 동작(이모트) (#76): 채팅 없이 뜻을 전하는 동작. 바퀴 메뉴·머리 위 아이콘 말풍선·방향 표시·net 으로 보내기
// 동작 이름 = 캐릭터 포즈 이름 (runner.js animate). hand: 손동작(탈것을 타고 있어도 됨)
// dur: 초 (0 = 걸을 때까지 계속). mark: 다른 사람 화면에 방향 표시를 남김
// 아이콘은 24×24 선 그림 path 문자열 하나로: 바퀴 칸(SVG)과 말풍선(캔버스 Path2D)이 같은 그림을 씀
const C = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const FACE = C(12, 12, 9);
export const EMOTES = [
  // 인사
  { id: 'wave', name: '안녕', hand: 1, dur: 2.2, icon: 'M7 12.5V7.5a1.4 1.4 0 0 1 2.8 0V11M9.8 10.5V5.5a1.4 1.4 0 0 1 2.8 0v5M12.6 10.5V6.5a1.4 1.4 0 0 1 2.8 0V12M15.4 12V10a1.4 1.4 0 0 1 2.8 0v4a7 7 0 0 1-7 7h-.4a5.6 5.6 0 0 1-4.7-2.6L4 15.2a1.4 1.4 0 0 1 2.2-1.7L7 14.6M19.5 3.5c1 .7 1.7 1.7 2 2.9M3 6.4c.3-1.2 1-2.2 2-2.9' },
  { id: 'insa', name: '꾸벅 인사', dur: 1.8, icon: `M15 21v-8M15 13L9 9.5M10.5 10.5l-.5 4.5${C(6.8, 9.6, 2)}M8 21h10` },
  { id: 'five', name: '하이파이브', hand: 1, dur: 1.6, icon: `${C(8.5, 12, 3.2)}${C(15.5, 12, 3.2)}M7 15.2L5 21M17 15.2l2 5.8M12 2.5v2.5M8 3.5l1.3 1.8M16 3.5l-1.3 1.8` },
  // 부르기·알리기
  { id: 'come', name: '이리 와', hand: 1, dur: 2.2, icon: 'M19 4v6a4 4 0 0 1-4 4H5M9 10l-4 4 4 4' },
  { id: 'point', name: '저기!', hand: 1, dur: 2, mark: 1, icon: `M4 20L15 9M9 9h6v6${C(19, 5, 1.6)}` },
  { id: 'follow', name: '같이 가자', hand: 1, dur: 2.2, icon: 'M5 6l6 6-6 6M12 6l6 6-6 6' },
  { id: 'wait', name: '기다려', hand: 1, dur: 2, icon: 'M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9' },
  // 도움
  { id: 'help', name: '도와줘', hand: 1, dur: 2.6, mark: 1, icon: 'M12 3L2 20h20L12 3zM12 9.5v4.5M12 17h.01' },
  { id: 'trash', name: '여기 쓰레기 많아', hand: 1, dur: 2.2, mark: 1, icon: 'M5 7h14M9.5 7V4.5h5V7M7 7l1 13h8l1-13M10.5 11v5M13.5 11v5' },
  // 대답
  { id: 'thumb', name: '좋아', hand: 1, dur: 1.8, icon: 'M7 11v9H4v-9h3zM7 11l4-7a2 2 0 0 1 3 1.7V10h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7' },
  { id: 'no', name: '싫어', hand: 1, dur: 1.8, icon: `${FACE}M8.5 8.5l7 7M15.5 8.5l-7 7` },
  { id: 'thanks', name: '고마워', hand: 1, dur: 2, icon: 'M12 3.5V20M12 3.5c-2 2-4 6-4 10l-3.5 3.5M12 3.5c2 2 4 6 4 10l3.5 3.5' },
  { id: 'sorry', name: '미안', hand: 1, dur: 2, icon: `${C(11, 13, 7.5)}M8.5 16h5M8.3 11.2h.01M13.7 11.2h.01M19.5 2.5c-1.3 1.9-1.9 3-1.9 3.8a1.9 1.9 0 0 0 3.8 0c0-.8-.6-1.9-1.9-3.8z` },
  // 기분
  { id: 'clap', name: '박수', hand: 1, dur: 2.2, icon: 'M9 21l-3.5-6 4-9 3 1-2 6M15 21l3.5-6-4-9-3 1 2 6M12 2v2M7.5 3l1 1.6M16.5 3l-1 1.6' },
  { id: 'hop', name: '기뻐', dur: 1.8, icon: 'M12 3l2.4 5 5.6.8-4 3.9.9 5.5L12 15.6l-4.9 2.6.9-5.5-4-3.9 5.6-.8L12 3z' },
  { id: 'laugh', name: '하하', dur: 2, icon: `${FACE}M7.5 13.5a4.5 4.5 0 0 0 9 0zM7.5 9.5l1.6-1.2 1.6 1.2M13.3 9.5l1.6-1.2 1.6 1.2` },
  { id: 'wow', name: '깜짝', dur: 1.6, icon: `${FACE}${C(12, 15.5, 1.9)}M8.8 9.5h.01M15.2 9.5h.01` },
  { id: 'sad', name: '슬퍼', dur: 2.4, icon: `${FACE}M8.5 17a4 4 0 0 1 7 0M8.8 10h.01M15.2 10h.01M16.5 12.5v2` },
  { id: 'heart', name: '하트', hand: 1, dur: 2.2, fill: 1, icon: 'M12 20.5s-7.5-4.6-7.5-10.4A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.8c0 5.8-7.5 10.4-7.5 10.4z' },
  { id: 'dance', name: '춤', dur: 6, icon: `M9 18V5l11-2v13${C(6, 18, 3)}${C(17, 16, 3)}` },
  // 쉬기
  { id: 'sitg', name: '앉기', dur: 0, icon: `${C(9, 4.5, 2)}M9 7.5V14h6v6.5M9 10.5l4 2M5 21h15` },
  { id: 'lie', name: '눕기', dur: 0, icon: `${C(5.5, 15, 2)}M8.5 15.5H20M2 19.5h20M14 4h4l-4 4.5h4` },
];
export const EMOTE_BY = Object.fromEntries(EMOTES.map((e) => [e.id, e]));
export const isEmote = (id) => !!EMOTE_BY[id];
// 바퀴 쪽: 8칸씩. 동작이 많아 3쪽 (마지막 쪽은 6칸)
export const PAGES = [];
for (let i = 0; i < EMOTES.length; i += 8) PAGES.push(EMOTES.slice(i, i + 8).map((e) => e.id));

const svg = (e, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="${e.fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${e.icon}"/></svg>`;

// 말풍선 텍스처: 동작마다 한 번 그려 같이 씀
const texCache = new Map();
function bubbleTex(e, accent) {
  const key = e.id + (accent ? '+' : '');
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = 128; c.height = 140; const g = c.getContext('2d');
  g.fillStyle = accent ? '#ff8a1f' : '#fbf6e6'; g.strokeStyle = '#24251f'; g.lineWidth = 6;
  g.beginPath(); g.arc(64, 62, 54, 0.62 * Math.PI, 0.38 * Math.PI); g.lineTo(64, 134); g.closePath(); g.fill(); g.stroke();
  g.save(); g.translate(64 - 36, 62 - 36); g.scale(3, 3);
  g.strokeStyle = '#24251f'; g.fillStyle = e.id === 'heart' ? '#e8495f' : '#24251f'; g.lineWidth = 2.1; g.lineCap = 'round'; g.lineJoin = 'round';
  const p = new Path2D(e.icon); if (e.fill) g.fill(p); g.stroke(p); g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = TEXCS; texCache.set(key, t); return t;
}
function makeSprite(e, accent, size) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex(e, accent), transparent: true, depthWrite: false, depthTest: false }));
  sp.renderOrder = 11; sp.scale.set(size, size * 140 / 128, 1); sp.userData.size = size;
  return sp;
}

export function createEmotes({ scene, player, save, persist, net, toast, sound, camera, placeArrow, ui, can, riding, heapPos, faceTo, onEmote, groundAt, myRoot }) {
  const tipSec = 1.6;
  save.emoFav = Array.isArray(save.emoFav) && save.emoFav.length === 4 && save.emoFav.every(isEmote) ? save.emoFav : [...EMOTE.favDefault];
  let mine = null; // presence 로 보내는 내 동작 { id, at, mx, mz }
  let over = null; // 탈것을 타고 있을 때 손동작 { id, t }
  let lastMark = -1e9;
  const bubbles = []; // { sp, root, t, dur }
  const marks = [];   // { sp, t, base }
  const edges = [];   // { el, peer, t }
  const seen = new Map(); // peer -> { at, local }
  let fiveT = -1e9;   // 내가 하이파이브를 한 때 (performance.now)

  // ----- 머리 위 말풍선 -----
  function bubble(root, e) {
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].root === root) { bubbles[i].sp.removeFromParent(); bubbles[i].sp.material.dispose(); bubbles.splice(i, 1); }
    const sp = makeSprite(e, false, 0.95); sp.position.y = EMOTE.bubbleY; root.add(sp);
    bubbles.push({ sp, root, t: 0, dur: EMOTE.bubble });
  }
  // ----- 방향 표시 (땅 위 아이콘, 5초) -----
  function addMark(e, x, z, y) {
    const sp = makeSprite(e, true, 1.5); sp.position.set(x, y + 1.6, z); scene.add(sp);
    marks.push({ sp, t: 0, base: y + 1.6 });
  }
  // ----- 도와줘: 화면 가장자리 표시 -----
  function addEdge(peer, e) {
    let it = edges.find((x) => x.peer === peer);
    if (!it) {
      const el = document.createElement('div'); el.className = 'emo-edge'; el.innerHTML = svg(e) + '<i class="tip"></i>';
      ui.appendChild(el); it = { el, peer, t: 0 }; edges.push(it);
    }
    it.t = 0;
  }

  function markTarget(e) {
    const p = player.pos;
    if (e.id === 'help') return { x: p.x, z: p.z };
    if (e.id === 'trash') { const h = heapPos?.(); if (h && Math.hypot(h.x - p.x, h.z - p.z) < EMOTE.trashR) return { x: h.x, z: h.z, face: 1 }; }
    const hd = player.heading;
    return { x: p.x + Math.sin(hd) * EMOTE.pointDist, z: p.z + Math.cos(hd) * EMOTE.pointDist };
  }

  function perform(id) {
    const e = EMOTE_BY[id]; if (!e) return false;
    const ride = riding();
    if (ride && !e.hand) { toast('타고 있을 때는 손동작만', tipSec); return false; }
    if (!can()) return false;
    const now = performance.now();
    if (e.mark && now - lastMark < EMOTE.markCd * 1000) { toast('조금 있다가 다시', tipSec); return false; }
    // 하던 동작 끝내기 (같은 춤·앉기를 다시 누르면 그만)
    if (!ride && player.pose === id && (e.dur === 0 || id === 'dance')) { stop(); return true; }
    player.target = null; player.onArrive = null;
    const face = (x, z) => { if (!ride) faceTo(x, z); }; // 타고 있을 땐 몸을 돌리지 않음
    let mx = null, mz = null;
    if (id === 'wave') face(camera.position.x, camera.position.z);
    if (id === 'five') {
      const pe = net.nearestPeer(EMOTE.fiveR); fiveT = now;
      if (pe) { face(pe.pos.x, pe.pos.z); const s = seen.get(pe.peer); if (s && s.id === 'five' && now - s.local < EMOTE.fiveWin * 1000) slap(pe); }
    }
    if (e.mark) {
      lastMark = now; const m = markTarget(e); mx = m.x; mz = m.z;
      if (m.face) face(mx, mz);
      addMark(e, mx, mz, groundAt(mx, mz));
    }
    if (ride) over = { id, t: 0 };
    else { player.pose = id; player.poseT = 0; }
    mine = { id, at: Date.now(), ...(mx != null ? { mx: +mx.toFixed(1), mz: +mz.toFixed(1) } : {}) };
    bubble(myRoot(), e);
    net.send(true);
    onEmote?.(id);
    return true;
  }
  // 하이파이브가 맞았을 때: 짝 소리 + 두 사람 사이에 반짝
  function slap(pe) {
    sound()?.clap?.();
    const x = (pe.pos.x + player.pos.x) / 2, z = (pe.pos.z + player.pos.z) / 2;
    const sp = makeSprite(EMOTE_BY.hop, true, 0.8); sp.position.set(x, groundAt(x, z) + 2.3, z); scene.add(sp);
    marks.push({ sp, t: EMOTE.mark - 0.8, base: sp.position.y });
    toast(`${pe.nick}과(와) 하이파이브!`, tipSec);
  }
  function stop() {
    if (isEmote(player.pose)) player.pose = 'move';
    over = null;
  }

  function tick(dt) {
    // 내 동작 시간
    const e = EMOTE_BY[player.pose];
    if (e && e.dur > 0 && player.poseT > e.dur) player.pose = 'move';
    if (over) { over.t += dt; if (!riding() || over.t > EMOTE_BY[over.id].dur) over = null; }
    if (mine && Date.now() - mine.at > 6000) { mine = null; }
    // 다른 사람 동작
    const now = performance.now();
    for (const pe of net.peersById.values()) {
      const em = pe.data.em;
      if (!em || typeof em !== 'object' || typeof em.at !== 'number' || !isEmote(em.id)) continue;
      const s = seen.get(pe.peer);
      if (s && s.at === em.at) continue;
      const fresh = !!s || Math.abs(Date.now() - em.at) < 4000; // 처음 들어왔을 때 오래된 동작은 다시 보이지 않음
      seen.set(pe.peer, { at: em.at, id: em.id, local: now });
      if (!fresh) continue;
      const pd = EMOTE_BY[em.id];
      bubble(pe.runner.root, pd);
      if (pd.mark && typeof em.mx === 'number' && typeof em.mz === 'number') {
        const x = Math.max(-600, Math.min(600, em.mx)), z = Math.max(-600, Math.min(600, em.mz));
        addMark(pd, x, z, groundAt(x, z));
        if (em.id === 'help') addEdge(pe.peer, pd);
      }
      if (em.id === 'five' && now - fiveT < EMOTE.fiveWin * 1000 && pe.pos.distanceTo(player.pos) < EMOTE.fiveR + 0.5) slap(pe);
    }
    for (const id of seen.keys()) if (!net.peersById.has(id)) seen.delete(id);
    // 말풍선: 톡 나타났다가 끝에 흐려짐
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]; b.t += dt;
      if (b.t > b.dur || !b.root.parent) { b.sp.removeFromParent(); b.sp.material.dispose(); bubbles.splice(i, 1); continue; }
      const k = Math.min(1, b.t / 0.15), s = b.sp.userData.size * (0.6 + 0.4 * k + Math.sin(Math.min(1, b.t / 0.3) * Math.PI) * 0.12);
      b.sp.scale.set(s, s * 140 / 128, 1); b.sp.material.opacity = Math.min(1, (b.dur - b.t) / 0.3);
    }
    for (let i = marks.length - 1; i >= 0; i--) {
      const m = marks[i]; m.t += dt;
      if (m.t > EMOTE.mark) { m.sp.removeFromParent(); m.sp.material.dispose(); marks.splice(i, 1); continue; }
      m.sp.position.y = m.base + Math.abs(Math.sin(m.t * 3)) * 0.35;
      m.sp.material.opacity = Math.min(1, (EMOTE.mark - m.t) / 0.5);
    }
    for (let i = edges.length - 1; i >= 0; i--) {
      const it = edges[i]; it.t += dt; const pe = net.peersById.get(it.peer);
      if (!pe || it.t > EMOTE.mark) { it.el.remove(); edges.splice(i, 1); continue; }
      const far = pe.pos.distanceTo(player.pos) > EMOTE.edgeFar;
      it.el.hidden = !far; if (far) placeArrow(it.el, pe.pos, 2.6);
    }
  }

  // 탈것을 타고 있을 때 손동작 겹치기
  const overlay = () => over && { id: over.id, t: over.t };
  function overlayPeer(pe) {
    const s = seen.get(pe.peer); if (!s) return null;
    const d = EMOTE_BY[s.id], t = (performance.now() - s.local) / 1000;
    return d && d.hand && t < d.dur ? { id: s.id, t } : null;
  }
  const presence = () => ({ em: mine });

  // ----- 바퀴 메뉴 -----
  let page = 0, editing = null, wheel = null, holdT = 0, held = false;
  function render() {
    if (!wheel) return;
    const ids = PAGES[page], ride = riding();
    const cell = (id, i, n, r, cls, key) => {
      const e = EMOTE_BY[id]; const a = (i / n) * Math.PI * 2 - Math.PI / 2 + (cls === 'fav' ? Math.PI / 4 : 0);
      return `<button type="button" class="emo-c ${cls}${ride && !e.hand ? ' off' : ''}${editing === id ? ' pick' : ''}" data-id="${id}" data-i="${i}" style="left:${(50 + Math.cos(a) * r).toFixed(2)}%;top:${(50 + Math.sin(a) * r).toFixed(2)}%" aria-label="${e.name}">${svg(e)}${key ? `<kbd>${key}</kbd>` : ''}</button>`;
    };
    wheel.innerHTML = ids.map((id, i) => cell(id, i, 8, 38.5, 'out', i + 1)).join('')
      + save.emoFav.map((id, i) => cell(id, i, 4, 21, 'fav', '')).join('')
      + `<button type="button" class="emo-pg" aria-label="다음 쪽">${PAGES.map((_, i) => `<i class="${i === page ? 'on' : ''}"></i>`).join('')}</button>`;
    wheel.classList.toggle('edit', !!editing);
  }
  function bindWheel(el) {
    wheel = el;
    el.addEventListener('pointerdown', (ev) => {
      const b = ev.target.closest('.emo-c.out'); held = false; clearTimeout(holdT);
      if (!b) return;
      holdT = setTimeout(() => { held = true; editing = b.dataset.id; render(); toast('안쪽 칸을 누르면 바뀌어요', 2.4); }, EMOTE.hold);
    });
    const cancelHold = () => clearTimeout(holdT);
    el.addEventListener('pointerup', cancelHold); el.addEventListener('pointerleave', cancelHold); el.addEventListener('pointercancel', cancelHold);
    el.addEventListener('contextmenu', (ev) => { ev.preventDefault(); const b = ev.target.closest('.emo-c.out'); if (b) { held = true; editing = b.dataset.id; render(); toast('안쪽 칸을 누르면 바뀌어요', 2.4); } });
    el.addEventListener('wheel', (ev) => { ev.preventDefault(); flip(ev.deltaY > 0 ? 1 : -1); }, { passive: false });
    el.addEventListener('click', (ev) => {
      if (held) { held = false; return; }
      if (ev.target.closest('.emo-pg')) { flip(1); return; }
      const b = ev.target.closest('.emo-c'); if (!b) { if (editing) { editing = null; render(); } return; }
      const id = b.dataset.id;
      if (editing) {
        if (b.classList.contains('fav')) { save.emoFav[+b.dataset.i] = editing; persist(); toast(`${EMOTE_BY[editing].name} 고정`, tipSec); }
        editing = null; render(); return;
      }
      toast(EMOTE_BY[id].name, tipSec);
      choose(id);
    });
  }
  let onChoose = null;
  function choose(id) { onChoose?.(id); }
  function flip(d) { page = (page + d + PAGES.length) % PAGES.length; editing = null; render(); }
  function opened() { editing = null; render(); }
  // 숫자 키: 바퀴가 열려 있으면 이 쪽 1~8, 닫혀 있으면 1~4 = 안쪽 고정 칸
  function key(n, open) {
    const id = open ? PAGES[page][n - 1] : n <= 4 ? save.emoFav[n - 1] : null;
    if (!id) return false;
    toast(EMOTE_BY[id].name, tipSec); choose(id); return true;
  }

  return {
    perform, stop, tick, overlay, overlayPeer, presence, bindWheel, render, opened, flip, key,
    set onChoose(f) { onChoose = f; },
    get page() { return page; }, get mine() { return mine; }, get over() { return over; },
    test: { marks, bubbles, edges, seen, get editing() { return editing; } },
  };
}
