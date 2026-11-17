import * as THREE from 'three';
import { TEXCS } from './boot.js';

// 채팅 말풍선(presence.say), 소원 돌탑(db stones/{self}), 표지석 줄서기(presence.pq)
const clean = (s, n) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n) : '');

export function createSocial({ scene, net, save, onToast, mapId }) {
  let db = null, uid = null, dbReady = false;
  // 돌탑: cairnId -> [{uid, nick, wish, at, mine}] (오래된 순, 모두의 돌이 쌓임)
  const stones = new Map();
  const listeners = { stones: [] };
  let remote = [];
  function rebuild() {
    stones.clear();
    const push = (cid, e) => { if (!stones.has(cid)) stones.set(cid, []); stones.get(cid).push(e); };
    for (const r of remote) push(r.cid, r);
    // 내 돌 (db에 아직 없거나 오프라인일 때)
    for (const [cid, v] of Object.entries(save.wishes || {})) {
      if (!v || (uid && remote.some((r) => r.cid === cid && r.uid === uid))) continue;
      push(cid, { uid: uid || 'me', nick: save.nick, wish: v.wish || '', at: v.at || 0, mine: true });
    }
    for (const l of stones.values()) l.sort((x, y) => x.at - y.at);
    listeners.stones.forEach((f) => f());
  }

  async function start() {
    rebuild();
    if (!window.claude?.use) return;
    try {
      const user = await window.claude.use('user');
      uid = user ? await user.id() : null;
      db = await window.claude.use('db');
    } catch (e) { db = null; }
    if (!db) return;
    try {
      db.collection('stones').onSnapshot((snap) => {
        remote = [];
        for (const d of snap.docs) {
          const data = d.data() || {}; const items = data.items || {};
          for (const [cid, it] of Object.entries(items)) {
            if (!it || typeof it !== 'object' || typeof it.at !== 'number') continue;
            remote.push({ cid, uid: d.id, nick: clean(data.nick, 16) || '누군가', wish: clean(it.wish, 60), at: it.at, mine: d.id === uid });
          }
        }
        rebuild();
      }, () => {});
      dbReady = true;
    } catch (e) { dbReady = false; }
  }

  // 한 사람당 돌탑마다 돌 하나. 이미 올렸으면 내 돌이 맨 위로 옮겨짐
  async function placeStone(cid, wish) {
    save.wishes ||= {};
    const had = !!save.wishes[cid];
    save.wishes[cid] = { at: Date.now(), wish: clean(wish, 60) };
    rebuild();
    if (!db || !uid) return had;
    const ref = db.collection('stones').doc(uid);
    try {
      const snap = await ref.get();
      const items = (snap.exists && snap.data()?.items) || {};
      items[cid] = { at: save.wishes[cid].at, wish: save.wishes[cid].wish };
      await ref.set({ nick: save.nick, items });
    } catch (e) { onToast('돌을 다른 사람에게 보여 주지 못했어요. 잠시 후 다시 올려 주세요'); }
    return had;
  }

  // ----- 채팅 말풍선 -----
  const bubbles = new Map(); // peer -> {sprite, text, until}
  function makeBubble(text) {
    const c = document.createElement('canvas'); const g = c.getContext('2d');
    g.font = '500 26px "Noto Sans KR", sans-serif';
    const w = Math.min(520, Math.max(120, g.measureText(text).width + 40)); c.width = w; c.height = 72;
    g.font = '500 26px "Noto Sans KR", sans-serif';
    g.fillStyle = '#fbf6e6'; g.strokeStyle = '#33402a'; g.lineWidth = 4;
    const r = 18; g.beginPath(); g.moveTo(r, 2); g.lineTo(w - r, 2); g.quadraticCurveTo(w - 2, 2, w - 2, r); g.lineTo(w - 2, 50 - r); g.quadraticCurveTo(w - 2, 50, w - r, 50); g.lineTo(w / 2 + 10, 50); g.lineTo(w / 2, 64); g.lineTo(w / 2 - 10, 50); g.lineTo(r, 50); g.quadraticCurveTo(2, 50, 2, 50 - r); g.lineTo(2, r); g.quadraticCurveTo(2, 2, r, 2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#33402a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 27);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = TEXCS;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, depthTest: false }));
    sp.scale.set(w / 72 * 0.9, 0.9, 1); sp.renderOrder = 10;
    return sp;
  }
  function showBubble(key, root, text, yOff) {
    const t = clean(text, 60); if (!t) return;
    const old = bubbles.get(key); if (old) { old.sprite.parent?.remove(old.sprite); old.sprite.material.map.dispose(); }
    const sp = makeBubble(t); sp.position.y = yOff; root.add(sp);
    bubbles.set(key, { sprite: sp, text: t, until: performance.now() + 6000 });
  }
  function tickBubbles() {
    const now = performance.now();
    for (const [k, b] of bubbles) if (now > b.until) { b.sprite.parent?.remove(b.sprite); b.sprite.material.map.dispose(); bubbles.delete(k); }
    // 다른 사람 말풍선: presence.say = {t, at}
    for (const e of net.peersById.values()) {
      const say = e.data.say;
      if (say && typeof say === 'object' && typeof say.at === 'number' && Date.now() - say.at < 8000) {
        const cur = bubbles.get(e.peer);
        if (!cur || cur.at !== say.at) { showBubble(e.peer, e.runner.root, say.t, 3.4); bubbles.get(e.peer).at = say.at; }
      }
    }
  }
  let mySay = null;
  function say(text, myRoot) {
    const t = clean(text, 60); if (!t) return;
    mySay = { t, at: Date.now() };
    showBubble('me', myRoot, t, 3.4);
    net.send(true);
  }

  // ----- 정상석 줄서기 (presence.pq = 내가 줄 선 시각) -----
  let myQueueAt = 0;
  function joinQueue() { myQueueAt = Date.now(); net.send(true); }
  function leaveQueue() { myQueueAt = 0; net.send(true); }
  function queueAhead() {
    if (!myQueueAt) return 0;
    let n = 0;
    for (const e of net.peersById.values()) { const q = e.data.pq; if (typeof q === 'number' && q > 0 && q < myQueueAt) n++; }
    return n;
  }
  function queueLength() { let n = 0; for (const e of net.peersById.values()) if (typeof e.data.pq === 'number' && e.data.pq > 0) n++; return n; }

  return {
    start, stones, listeners, placeStone, tickBubbles, say, showBubble,
    joinQueue, leaveQueue, queueAhead, queueLength,
    get uid() { return uid; }, get canWrite() { return dbReady && !!uid; },
    presenceExtra: () => ({ say: mySay, pq: myQueueAt || null }),
  };
}
