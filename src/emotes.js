import * as THREE from 'three';
import { TEXCS } from './boot.js';
import { EMOTE } from './balance.js';

// 동작(이모트) (#76, #242 8개·버튼 곁 부채꼴): 채팅 없이 뜻을 전하는 동작. 부채꼴 메뉴·머리 위 아이콘 말풍선·방향 표시·net 으로 보내기
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
// 화면에 보이는 8개 (#242). 남이 목록 밖 동작을 보내도 EMOTE_BY 에 있으면 그대로 보이고, 모르는 것은 isEmote 로 거름
export const SHOWN = EMOTE.list.filter(isEmote);

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
  if ('emoFav' in save) { delete save.emoFav; persist(); } /* 예전 안쪽 고정 4칸 (#242 에서 없앰) */
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

  // ----- 동작 버튼 곁 부채꼴 (#242) -----
  // 버튼을 누르면 버튼을 중심으로 8칸이 펼쳐짐. 누른 채 밀어서 떼면 그 칸, 그냥 누르고 떼면 열린 채로 두고 눌러 고름. 고르면 닫힘
  // 버튼이 화면 왼쪽이면 위→오른쪽, 오른쪽이면 위→왼쪽, 가운데면 위 반원. 위 공간이 모자라면 반지름을 줄임
  let wheel = null, chatEl = null, anchor = null, hot = null;
  const F = EMOTE.fan;
  function anchorAt(btn) {
    const r = btn?.getBoundingClientRect();
    if (r && r.width > 0) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    /* 단순 화면(#189)처럼 버튼이 숨어 있으면: 폰 동작 버튼 자리(왼쪽 아래, 조이스틱 위) */
    const cs = getComputedStyle(document.documentElement), px = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
    return { x: Math.max(16, px('--safe-l')) + 22, y: innerHeight - px('--safe-b') - 172 };
  }
  function layout(a) {
    const W = innerWidth, H = innerHeight, half = F.cell / 2 + 6;
    const hx = a.x < W / 3 ? 1 : a.x > W * 2 / 3 ? -1 : 0, up = a.y > H / 2;
    const cl = (p) => ({ ...p, x: Math.max(half, Math.min(W - half, p.x)), y: Math.max(half, Math.min(H - half, p.y)) });
    /* 폰 가로처럼 위가 낮으면: 버튼 옆으로 한 줄 (조이스틱 위, 엄지로 옆으로 밀기) */
    if (hx && H < F.rowH) {
      const cells = SHOWN.map((_, i) => ({ i, x: a.x + hx * (F.cell / 2 + 30 + i * (F.cell + 8)), y: a.y }));
      return { cells: cells.map(cl), chat: cl({ x: a.x, y: a.y + (up ? -1 : 1) * (F.cell + 8) }) };
    }
    let [a0, a1] = hx ? F.side : F.mid;
    if (hx < 0) [a0, a1] = [-180 - a0, -180 - a1];
    if (!up) [a0, a1] = [-a0, -a1];
    const room = up ? a.y - F.top : H - a.y - half, k = Math.max(0.7, Math.min(1, room / (F.r[1] + half)));
    /* 안쪽 줄은 바깥 줄 칸 사이에 오게 엇갈림 (양 끝을 1/8 씩 안으로) */
    const ring = (n, r, off, st) => Array.from({ length: n }, (_, i) => {
      const t = ((a0 + (a1 - a0) * (st ? (n > 1 ? 0.125 + (i * 0.75) / (n - 1) : 0.5) : n > 1 ? i / (n - 1) : 0.5)) * Math.PI) / 180;
      return { i: off + i, x: a.x + Math.cos(t) * r * k, y: a.y + Math.sin(t) * r * k };
    });
    const out = [...ring(F.inner, F.r[0], 0, 1), ...ring(SHOWN.length - F.inner, F.r[1], F.inner, 0)];
    const mt = (((a0 + a1) / 2) * Math.PI) / 180, cr = (F.r[1] + F.cell) * k;
    return { cells: out.map(cl), chat: cl({ x: a.x + Math.cos(mt) * cr, y: a.y + Math.sin(mt) * cr }) };
  }
  function render() {
    if (!wheel) return;
    const ride = riding(), L = layout(anchor || anchorAt(null));
    wheel.innerHTML = SHOWN.map((id, i) => {
      const e = EMOTE_BY[id], p = L.cells[i];
      return `<button type="button" class="emo-c${ride && !e.hand ? ' off' : ''}" data-id="${id}" style="left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px;--d:${i * 18}ms" aria-label="${e.name}">${svg(e)}<span>${e.name}</span><kbd>${i + 1}</kbd></button>`;
    }).join('');
    if (chatEl) { chatEl.style.left = L.chat.x.toFixed(1) + 'px'; chatEl.style.top = L.chat.y.toFixed(1) + 'px'; }
    hot = null;
  }
  const cellAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('.emo-c') || null;
  function light(b) { if (b === hot) return; hot?.classList.remove('hot'); hot = b; b?.classList.add('hot'); }
  function bindWheel(el, chat) {
    wheel = el; chatEl = chat || null;
    el.addEventListener('click', (ev) => { const b = ev.target.closest('.emo-c'); if (b) pick(b.dataset.id); });
  }
  // btn: 동작 버튼, isOpen()/setOpen(bool): 창 열고 닫기 (menu.js)
  function bindButton(btn, isOpen, setOpen) {
    let drag = null, skip = false;
    btn.addEventListener('pointerdown', (ev) => {
      if (ev.button > 0) return;
      skip = true;
      if (isOpen()) { setOpen(false); return; }
      setOpen(true);
      drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, moved: false };
      try { btn.setPointerCapture(ev.pointerId); } catch (e) { /* 무시 */ }
    });
    btn.addEventListener('pointermove', (ev) => {
      if (!drag || ev.pointerId !== drag.id) return;
      if (Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) > 12) drag.moved = true;
      light(cellAt(ev.clientX, ev.clientY));
    });
    const end = (ev, cancel) => {
      if (!drag || ev.pointerId !== drag.id) return;
      const b = cancel ? null : cellAt(ev.clientX, ev.clientY), moved = drag.moved; drag = null; light(null);
      if (b) pick(b.dataset.id); else if (moved && !cancel) setOpen(false); /* 그냥 눌렀다 떼면 열린 채로 */
    };
    btn.addEventListener('pointerup', (ev) => { end(ev, false); setTimeout(() => { skip = false; }, 400); });
    btn.addEventListener('pointercancel', (ev) => end(ev, true));
    /* 키보드·메뉴 타일(단순 화면)은 click 만 옴 */
    btn.addEventListener('click', () => { if (skip) { skip = false; return; } setOpen(!isOpen()); });
  }
  let onChoose = null;
  function pick(id) { toast(EMOTE_BY[id].name, tipSec); onChoose?.(id); }
  function opened(btn) { anchor = anchorAt(btn); render(); }
  // 숫자 키 1~8: 열려 있든 닫혀 있든 같은 8개
  function key(n) {
    const id = SHOWN[n - 1];
    if (!id) return false;
    pick(id); return true;
  }

  return {
    perform, stop, tick, overlay, overlayPeer, presence, bindWheel, bindButton, render, opened, key, shown: SHOWN,
    set onChoose(f) { onChoose = f; },
    get mine() { return mine; }, get over() { return over; },
    test: { marks, bubbles, edges, seen, layout: () => layout(anchor || anchorAt(null)) },
  };
}
