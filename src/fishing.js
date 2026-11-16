// 낚시 (#44): 개울 물가(또는 돌다리 위)에 서면 상호작용(F)이 낚시로 바뀐다. 튜토리얼과 상관없는 자유 기능.
// 던지기(cast) → 찌가 떠 있음(wait, 2~6초) → 쑥 들어감(bite, 1초 안에 F) → 당기기(pull) → 물고기면 들어 보이고(show) 놓아줌(release),
// 쓰레기면 배낭으로(stow). 늦으면 놓침(miss). 기다리는 동안 F 를 누르면 그냥 거둠. 움직이거나 점프·줍기를 하면 그만둠.
// 낚싯대는 따로 사지 않고 낚시할 때만 오른손에 생긴다(손 도구는 그동안 숨김, main.js setHoldRod).
// 물길 좌표·물보라는 stream.js, 보상(귤·배낭·도감·업적)은 main.js 의 reward 콜백. 수치는 balance.js FISH
import * as THREE from 'three';
import { gradHard } from './toon.js';
import { FISH, DEX, TRASH_TYPES, STREAM } from './balance.js';

const sm = (k) => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); };
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: gradHard, ...extra });

/* 로우폴리 임시 모델: 물고기 3종·쓰레기 3종·드문 것(병). 앞쪽 = +z */
function fishMesh(i) {
  const g = new THREE.Group();
  if (i === 2) { // 참게: 납작한 등딱지 + 다리 8개 + 집게 둘
    const shell = toon('#8a5a3a'), leg = toon('#a8693f');
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 7, 4), shell); body.scale.set(1, 0.45, 0.85); g.add(body);
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.2, 4), leg); l.position.set(s * 0.18, -0.02, -0.08 + k * 0.06); l.rotation.z = s * 1.0; g.add(l); }
    for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), leg); c.scale.set(1, 0.7, 1.4); c.position.set(s * 0.12, 0.01, 0.17); g.add(c); }
    return g;
  }
  if (i >= 3) { // 잭팟 물고기 (#55): 다금바리(붉은 갈색 긴 몸)·황금 옥돔(금색)·귤색 잉어(주황), 평소 것보다 크고 지느러미가 큼
    const col = ['#a8553c', '#f2c230', '#f08a1c'][i - 3], dk = ['#7d3a28', '#c9961a', '#c4650e'][i - 3], L = 0.68, H = 0.2;
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(1, 1), toon(col)); body.scale.set(0.07, H, L / 2); g.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(H, 0.2, 4), toon(dk)); tail.rotation.x = Math.PI / 2; tail.scale.x = 0.25; tail.position.z = -L / 2 - 0.05; g.add(tail);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 3), toon(dk)); fin.scale.z = 0.4; fin.position.set(0, H * 0.95, 0); g.add(fin);
    for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 5, 4), toon('#22251f')); e.position.set(sd * 0.06, H * 0.25, L / 2 - 0.08); g.add(e); }
    return g;
  }
  const col = i === 0 ? '#a9c2b8' : '#c9a24a', L = i === 0 ? 0.46 : 0.4, H = i === 0 ? 0.1 : 0.15;
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(1, 1), toon(col)); body.scale.set(0.05, H, L / 2); g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(H * 0.9, 0.14, 4), toon(i === 0 ? '#86a096' : '#b08a3a')); tail.rotation.x = Math.PI / 2; tail.scale.x = 0.25; tail.position.z = -L / 2 - 0.03; g.add(tail);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.09, 3), toon(i === 0 ? '#e8c13a' : '#b08a3a')); fin.scale.z = 0.3; fin.position.set(0, H * 0.95, 0); g.add(fin);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.016, 5, 4), toon('#22251f')); e.position.set(s * 0.04, H * 0.25, L / 2 - 0.06); g.add(e); }
  return g;
}
function trashMesh(id) {
  const g = new THREE.Group();
  if (id === 'boot') { // 장화
    const m = toon('#3f6b4a'); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.34, 7), m); shaft.position.y = 0.1; g.add(shaft);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.28), m); foot.position.set(0, -0.08, 0.07); g.add(foot);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.29), toon('#2b2b30')); sole.position.set(0, -0.13, 0.07); g.add(sole);
  } else if (id === 'tin') { // 깡통 (찌그러짐)
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.085, 0.2, 7), toon('#b9bcc4')); c.rotation.z = 0.3; c.scale.x = 0.8; g.add(c);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.083, 0.083, 0.06, 7), toon('#c9473d')); b.rotation.z = 0.3; b.scale.x = 0.8; g.add(b);
  } else if (id === 'bag') { // 비닐
    const v = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), toon('#eef0ea', { transparent: true, opacity: 0.85 })); v.scale.set(1.2, 0.8, 1); g.add(v);
  } else { // 드문 것: 유리병 (편지)
    const glass = toon('#8fd0b8', { transparent: true, opacity: 0.7 });
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.2, 7), glass); g.add(b);
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, 0.1, 6), glass); n.position.y = 0.15; g.add(n);
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.04, 6), toon('#a7825a')); k.position.y = 0.21; g.add(k);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.01), toon('#fbf6e6')); p.rotation.z = 0.3; g.add(p);
  }
  g.rotation.x = Math.PI / 2; const w = new THREE.Group(); w.add(g); return w; // 눕혀서 앞쪽(+z)으로
}

export function createFishing({ scene, stream, player, runner, groundAt, height, sound, room, reward, setHoldRod, toast }) {
  if (!stream) return null;
  const F = FISH, hw = stream.halfW, co = stream.centerOff;
  const [x0, z0] = stream.at(0, 0), [x1, z1] = stream.at(1, 0), [x2, z2] = stream.at(0, 1);
  const fdir = [x1 - x0, z1 - z0], udir = [x2 - x0, z2 - z0]; // 길 방향(오름 쪽)·하류 방향

  /* 낚싯대·줄·찌·느낌표 */
  const rodGeo = new THREE.CylinderGeometry(0.012, 0.03, 1, 5).translate(0, 0.5, 0);
  const rod = new THREE.Group(); rod.visible = false; scene.add(rod);
  const pole = new THREE.Mesh(rodGeo, toon('#7a5a34')); pole.scale.y = F.rodL; rod.add(pole);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 6), toon('#c9a26a')); grip.position.y = 0.12; rod.add(grip);
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8), toon('#3a3d42')); reel.rotation.z = Math.PI / 2; reel.position.set(0.05, 0.3, 0); rod.add(reel);
  const NL = 14, lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * NL), 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#f4f1e8', transparent: true, opacity: 0.85 })); line.frustumCulled = false; line.visible = false; scene.add(line);
  const bob = new THREE.Group(); bob.visible = false; scene.add(bob);
  { const top = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#e2453a' })); bob.add(top);
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fbf6e6' })); bob.add(bot);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 4), new THREE.MeshBasicMaterial({ color: '#e2453a' })); st.position.y = 0.1; bob.add(st); }
  const bang = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
    x.fillStyle = '#ff8a1f'; x.beginPath(); x.arc(32, 32, 28, 0, 7); x.fill(); x.fillStyle = '#fff'; x.fillRect(27, 11, 10, 27); x.fillRect(27, 43, 10, 10);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true })); sp.visible = false; sp.renderOrder = 6; sp.scale.setScalar(0.6); scene.add(sp); return sp; })();
  // 잡히는 것 모양 (한 번만 만들어 두고 켜고 끔)
  const items = { fish: FISH.species.map((_, i) => fishMesh(i)), trash: {}, rare: trashMesh('rare') };
  F.trash.forEach((t) => { items.trash[t.id] = trashMesh(t.id); });
  [...items.fish, ...Object.values(items.trash), items.rare].forEach((m) => { m.visible = false; scene.add(m); });

  let S = null; // 지금 낚시 상태
  let forceNext = null, forceWait = null, forceJack = null; // 확인용
  const tip = new THREE.Vector3(), hand = new THREE.Vector3(), tv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tq = new THREE.Quaternion();
  const showPt = new THREE.Vector3(), backPt = new THREE.Vector3();

  // 물 위 한 점이 다리 판 위인지
  const overBridge = (x, z) => groundAt(x, z) - height(x, z) > 0.05;
  // 지금 자리에서 낚시할 수 있으면 찌가 떨어질 곳 {x, y, z}
  function spot() {
    const p = player.pos;
    if (player.riding || player.air || player.rescue || stream.busy || stream.inWater(p.x, p.z)) return null;
    const [al, lat] = stream.local(p.x, p.z);
    if (Math.abs(lat) > STREAM.far - 6) return null;
    const hu = Math.sin(player.heading) * udir[0] + Math.cos(player.heading) * udir[1];
    let tLat, tAl;
    if (stream.onBridge(p.x, p.z)) { // 다리 위: 보는 쪽(상류·하류) 옆 물로
      tLat = lat + (hu >= 0 ? 1 : -1) * F.castD; const o = co(tLat), w = hw(tLat) - 0.8; tAl = o + Math.max(-w, Math.min(w, al - o));
    } else {
      const d = al - co(lat), dist = Math.abs(d) - hw(lat);
      if (dist > F.bankR || dist < -0.3) return null;
      tLat = lat + Math.max(-2.5, Math.min(2.5, hu * 2.5));
      tAl = co(tLat) + Math.sign(d || 1) * Math.max(0.5, hw(tLat) - F.castIn);
    }
    let [x, z] = stream.at(tAl, tLat);
    if (overBridge(x, z)) { tLat = (tLat >= 0 ? 1 : -1) * (stream.bridge.halfW + 1.6); [x, z] = stream.at(co(tLat) + Math.sign(tAl - co(tLat) || 1) * Math.max(0.5, hw(tLat) - F.castIn), tLat); }
    if (!stream.inWater(x, z)) return null;
    return { x, y: stream.waterY(x, z) + 0.02, z };
  }

  // 무엇이 낚일지: 자리가 없으면 쓰레기(드문 것 포함) 대신 물고기
  function roll() {
    if (forceNext) { const f = forceNext; forceNext = null; return f; }
    if (S && S.jack) return { type: 'fish', i: FISH.jackpot.first + Math.floor(Math.random() * (F.species.length - FISH.jackpot.first)), jack: true }; // 잭팟 (#55)
    const r = Math.random(), O = F.odds, free = room();
    const fits = (kind) => (TRASH_TYPES.find((t) => t.id === kind)?.vol ?? 99) <= free;
    if (r < O.trash) { const t = F.trash[Math.floor(Math.random() * F.trash.length)]; if (fits(t.kind)) return { type: 'trash', t }; }
    else if (r >= O.trash + O.fish) { const ok = DEX.rare.map((d, i) => ({ d, i })).filter((x) => fits(x.d.kind)); if (ok.length) { const x = ok[Math.floor(Math.random() * ok.length)]; return { type: 'rare', kind: x.d.kind, name: x.d.name }; } }
    return { type: 'fish', i: Math.floor(Math.random() * FISH.jackpot.first) };
  }
  const meshOf = (c) => (c.type === 'fish' ? items.fish[c.i] : c.type === 'trash' ? items.trash[c.t.id] : items.rare);

  function begin() {
    const sp = spot(); if (!sp) return false;
    player.target = null; player.onArrive = null; player.speed = 0;
    player.heading = Math.atan2(sp.x - player.pos.x, sp.z - player.pos.z);
    player.pose = 'fish'; player.poseT = 0;
    setHoldRod(true);
    S = { ph: 'cast', t: 0, to: new THREE.Vector3(sp.x, sp.y, sp.z), from: new THREE.Vector3(), jack: false, wait: forceWait ?? F.waitMin + Math.random() * (F.waitMax - F.waitMin), ringT: 0, catch: null, item: null, elev: 0.4, landed: false };
    forceWait = null;
    rod.visible = line.visible = true; bob.visible = false;
    sound?.cast?.();
    return true;
  }
  function end() {
    if (!S) return;
    if (S.item) S.item.visible = false;
    S = null; rod.visible = line.visible = bob.visible = bang.visible = false; bang.material.color.set('#ffffff'); bang.scale.setScalar(0.6);
    if (player.pose === 'fish') player.pose = 'move';
    setHoldRod(false);
  }
  function go(ph) { S.ph = ph; S.t = 0; }
  // F: 기다리는 중이면 거둠, 찌가 들어갔으면 당김
  function press() {
    if (!S) return begin();
    if (S.ph === 'wait' || S.ph === 'cast') { go('miss'); S.quiet = true; S.from.copy(bob.position); return true; }
    if (S.ph === 'bite') {
      S.catch = roll(); S.item = meshOf(S.catch); S.from.copy(S.to);
      reward(S.catch, S.to.clone()); // 보상은 누르는 순간 확정 (연출 도중 그만둬도 받음)
      go('pull'); bang.visible = false; bang.material.color.set('#ffffff'); bang.scale.setScalar(0.6);
      if (S.catch.jack) stream.splash(S.to.x, S.to.y, S.to.z, 1.2);
      stream.splash(S.to.x, S.to.y, S.to.z, 0.55); sound?.reel?.(F.pullT);
      return true;
    }
    return false;
  }
  const lerpArc = (out, a, b, k, hgt) => { out.lerpVectors(a, b, k); out.y += Math.sin(k * Math.PI) * hgt; return out; };

  function update(dt) {
    if (!S) return;
    if (player.pose !== 'fish' || player.rescue || player.air || player.riding) { end(); return; }
    S.t += dt; let t = S.t; // 단계가 바뀐 프레임에는 t = 0 부터 (다음 단계가 예전 시간으로 바로 끝나지 않게)
    // 손 위치 (오른팔 끝)
    const arm = runner.root.userData.parts?.armR;
    runner.root.updateMatrixWorld(true);
    if (arm) arm.localToWorld(hand.set(0, -0.5, 0)); else hand.copy(player.pos).setY(player.visY + 1.2);
    const fw = tv.set(Math.sin(player.heading), 0, Math.cos(player.heading));
    showPt.copy(player.pos).addScaledVector(fw, 0.75); showPt.y = player.visY + 1.75;
    backPt.copy(player.pos).addScaledVector(fw, -0.35); backPt.y = player.visY + 1.45;
    let e = 0.45, bobPos = null, sag = 0.3, it = null;
    if (S.ph === 'cast') {
      const k = t / F.castT;
      e = k < 0.4 ? 0.45 + (2.3 - 0.45) * sm(k / 0.4) : 2.3 + (0.25 - 2.3) * sm((k - 0.4) / 0.3) + 0.2 * sm((k - 0.7) / 0.3);
      if (k >= 0.55) { if (!S.landed) { S.from.copy(tip); S.landed = 1; } const kk = Math.min(1, (k - 0.55) / 0.45); bobPos = lerpArc(new THREE.Vector3(), S.from, S.to, kk, 1.2); sag = 0.05; }
      if (k >= 1) { go('wait'); t = 0; bob.visible = true; stream.ring(S.to.x, S.to.y, S.to.z); sound?.plop?.(); }
    }
    if (S.ph === 'wait') {
      e = 0.45 + Math.sin(t * 1.3) * 0.03; bobPos = S.to.clone(); bobPos.y += Math.sin(t * 2.4) * 0.025;
      if (t > S.wait - 0.9 && t < S.wait - 0.7) bobPos.y -= 0.04; // 살짝 입질
      if ((S.ringT -= dt) <= 0) { S.ringT = 1.6; stream.ring(S.to.x, S.to.y, S.to.z); }
      if (t >= S.wait) { go('bite'); t = 0; S.jack = forceJack ?? Math.random() < F.jackpot.p; forceJack = null; if (S.jack) { sound?.jackBite?.(); bang.material.color.set('#ffd23a'); bang.scale.setScalar(1.1); } stream.splash(S.to.x, S.to.y, S.to.z, 0.3, false); stream.ring(S.to.x, S.to.y, S.to.z); sound?.bite?.(); bang.visible = true; }
    }
    if (S.ph === 'bite') {
      const J = S.jack; e = 0.32 + Math.sin(t * 30) * (J ? 0.1 : 0.03); bobPos = S.to.clone(); bobPos.y -= (J ? 0.3 : 0.16) + Math.sin(t * (J ? 26 : 18)) * (J ? 0.1 : 0.04); sag = 0;
      if (J && ((S.ringT -= dt) <= 0)) { S.ringT = 0.25; stream.ring(S.to.x, S.to.y, S.to.z); stream.splash(S.to.x, S.to.y, S.to.z, 0.5, false); }
      bang.position.set(S.to.x, S.to.y + 0.9 + Math.sin(t * 12) * 0.05, S.to.z);
      if (t >= (S.jack ? F.jackpot.bigT : F.biteT)) { go('miss'); t = 0; S.from.copy(bobPos); toast?.('놓쳤어요'); bang.visible = false; }
    }
    if (S.ph === 'miss') {
      const k = Math.min(1, t / F.missT); e = 0.45 + 0.8 * sm(k / 0.5) - 0.5 * sm((k - 0.6) / 0.4);
      bobPos = lerpArc(new THREE.Vector3(), S.from, tip, sm(k), 0.8); sag = 0.05;
      if (k >= 1) { end(); return; }
    }
    if (S.ph === 'pull') {
      const k = Math.min(1, t / F.pullT); e = 0.4 + 1.1 * sm(k * 1.6);
      it = lerpArc(new THREE.Vector3(), S.from, showPt, sm(k), 1.4); bobPos = it.clone(); bobPos.y += 0.12; sag = 0;
      if (k >= 1) { go(S.catch.type === 'fish' ? 'show' : 'stow'); t = 0; }
    }
    if (S.ph === 'show') {
      e = 1.25 + Math.sin(t * 3) * 0.04; it = showPt.clone(); it.y += Math.sin(t * 5) * 0.03; bobPos = it.clone(); bobPos.y += 0.12; sag = 0;
      if (t >= F.showT) { go('release'); t = 0; S.from.copy(showPt); }
    }
    if (S.ph === 'release') {
      const k = Math.min(1, t / F.releaseT); e = 1.25 - 0.7 * sm(k);
      it = lerpArc(new THREE.Vector3(), S.from, S.to, k, 0.9); bobPos = null;
      if (k >= 1) { stream.splash(S.to.x, S.to.y, S.to.z, 0.45); end(); return; }
    }
    if (S.ph === 'stow') {
      const k = Math.min(1, t / F.stowT); e = 1.25 - 0.5 * sm(k);
      it = lerpArc(new THREE.Vector3(), showPt, backPt, k * k, 0.5); bobPos = null;
      if (k >= 1) { end(); return; }
    }
    S.elev = e;
    // 낚싯대: 손에서 보는 쪽으로 e 만큼 들림 (π/2 넘으면 뒤로 젖힘)
    const dir = new THREE.Vector3(fw.x * Math.cos(e), Math.sin(e), fw.z * Math.cos(e)).normalize();
    rod.position.copy(hand).addScaledVector(dir, -0.28); tq.setFromUnitVectors(up, dir); rod.quaternion.copy(tq);
    tip.copy(rod.position).addScaledVector(dir, F.rodL);
    if (!bobPos) bobPos = tip.clone().setY(tip.y - 0.6);
    bob.visible = S.ph !== 'pull' && S.ph !== 'show' && (S.ph !== 'cast' || S.landed);
    bob.position.copy(bobPos);
    const a = lineGeo.attributes.position;
    for (let i = 0; i < NL; i++) { const k = i / (NL - 1); a.setXYZ(i, tip.x + (bobPos.x - tip.x) * k, tip.y + (bobPos.y - tip.y) * k - Math.sin(k * Math.PI) * sag, tip.z + (bobPos.z - tip.z) * k); }
    a.needsUpdate = true; line.visible = S.ph !== 'release' && S.ph !== 'stow';
    if (S.item) {
      S.item.visible = !!it;
      if (it) {
        S.item.position.copy(it);
        const wig = S.ph === 'show' || S.ph === 'pull' ? Math.sin(t * 16) * 0.5 : 0;
        S.item.rotation.set(S.ph === 'release' ? t * 6 : 0, player.heading + Math.PI / 2 + wig, 0);
        S.item.scale.setScalar((S.catch.jack ? 1.9 : 1.5) * (S.ph === 'stow' ? 1 - 0.7 * Math.min(1, t / F.stowT) : 1)); // 들어 보일 때 잘 보이게 조금 크게
      }
    }
  }
  const LABEL = { idle: ['낚시하기', 'fish'], cast: ['거두기', 'reel'], wait: ['거두기', 'reel'], bite: ['당기기', 'reel'] };
  return {
    update, press, spot, stop: end,
    canFish: () => !S && !!spot(),
    get active() { return !!S; },
    get phase() { return S ? S.ph : null; },
    get elev() { return S ? S.elev : 0.4; },
    get label() { return (LABEL[S ? S.ph : 'idle'] || ['낚시 중'])[0]; },
    get ic() { return (LABEL[S ? S.ph : 'idle'] || [0, 'fish'])[1]; },
    test: { force: (c) => { forceNext = c; }, jack: (v = true) => { forceJack = v; }, wait: (s) => { forceWait = s; if (S && S.ph === 'wait') S.wait = Math.min(S.wait, S.t + s); }, state: () => S && { ph: S.ph, t: S.t, wait: S.wait, to: S.to.toArray(), catch: S.catch }, parts: { rod, bob, line, tip, hand } },
  };
}
