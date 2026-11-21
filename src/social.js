import * as THREE from 'three';
import { cleanText } from './safetext.js';
import { TEXCS } from './boot.js';
import { bubbleCanvas, bubbleScale, bubblePages } from './bubble.js';
import { TALK } from './balance.js';

// 채팅 말풍선(presence.say), 소원 돌탑(db stones/{self}), 표지석 줄서기(presence.pq)
const clean = (s, n) => cleanText(s, n); // 제어·방향 글자·꺾쇠 빼기 (#84, safetext.js)

export function createSocial({ scene, net, save, onToast, mapId }) {
  let db = null, uid = null, dbReady = false;
  // 돌탑: cairnId -> [{uid, nick, wish, at, mine}] (오래된 순, 모두의 돌이 쌓임)
  const stones = new Map();
  const listeners = { stones: [] };
  let remote = [];
  const srv = new Map(); // 서버 소원 (#127, game/wish.js): cairnId -> [{ id, nick, text, at, mine }]. 남의 소원 하나 = 돌 하나
  function rebuild() {
    stones.clear();
    const push = (cid, e) => { if (!stones.has(cid)) stones.set(cid, []); stones.get(cid).push(e); };
    for (const r of remote) push(r.cid, r);
    for (const [cid, l] of srv) for (const w of l) if (!w.mine && !remote.some((r) => r.cid === cid && r.nick === w.nick && r.wish === w.text)) push(cid, { uid: 'w' + w.id, nick: w.nick || '누군가', wish: w.text, at: w.at, wid: w.id });
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
  // 말풍선 그림은 src/bubble.js 한 틀 (#190: 긴 글이 한 줄로 눌려 깨지던 것). 채팅은 TALK.bubble.chatLines 줄까지
  function makeBubble(text, chat, L) {
    const b = bubbleCanvas(text, L ? { L } : { lines: chat ? TALK.bubble.chatLines : TALK.bubble.lines });
    const tx = new THREE.CanvasTexture(b.canvas); tx.colorSpace = TEXCS;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, depthTest: false }));
    const [sx, sy] = bubbleScale(b); sp.scale.set(sx, sy, 1); sp.center.set(0.5, 0); sp.renderOrder = 10; // 꼬리 끝을 기준으로 위로 자람
    return sp;
  }
  // NPC·동료(key 'npc…'·'mate…')는 14자 × 2줄씩 두 장까지 넘김, 사람 채팅은 한 장 3줄 (#190)
  function showBubble(key, root, text, yOff) {
    const t = clean(text, 60); if (!t) return;
    const old = bubbles.get(key); if (old) { old.sprite.parent?.remove(old.sprite); old.sprite.material.map.dispose(); }
    const npc = String(key).startsWith('npc') || String(key).startsWith('mate');
    const pages = npc ? bubblePages(t) : null;
    const sp = makeBubble(t, !npc, pages?.[0]); sp.position.y = yOff - 0.42; root.add(sp);
    const now = performance.now(), dur = pages?.length > 1 ? 8000 : 6000;
    bubbles.set(key, { sprite: sp, text: t, until: now + dur, pages: pages?.length > 1 ? pages : null, flip: now + dur / 2, root, yOff });
  }
  function tickBubbles() {
    const now = performance.now();
    for (const [k, b] of bubbles) {
      if (now > b.until) { b.sprite.parent?.remove(b.sprite); b.sprite.material.map.dispose(); bubbles.delete(k); continue; }
      if (b.pages && now > b.flip) { // 다음 장
        const sp = makeBubble(b.text, false, b.pages[1]); sp.position.y = b.yOff - 0.42; b.sprite.parent?.add(sp); b.sprite.parent?.remove(b.sprite); b.sprite.material.map.dispose(); b.sprite = sp; b.pages = null;
      }
    }
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

  function setServer(cid, list) { srv.set(cid, Array.isArray(list) ? list : []); rebuild(); }
  return {
    start, stones, listeners, placeStone, setServer, tickBubbles, say, showBubble,
    joinQueue, leaveQueue, queueAhead, queueLength,
    get uid() { return uid; }, get canWrite() { return dbReady && !!uid; },
    presenceExtra: () => ({ say: mySay, pq: myQueueAt || null }),
  };
}
