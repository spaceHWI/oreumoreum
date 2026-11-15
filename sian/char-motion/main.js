// 캐릭터 동작 확인 페이지: 경사면 위에서 걷기·달리기·포즈를 본다. node sian/char-motion/build.mjs → dist/char-motion.html
import * as THREE from 'three';
import '../../src/boot.js';
import { buildRunner, DEFAULT_OUTFIT } from '../../src/runner.js';
import { ACCESSORIES } from '../../src/gear.js';

const q = new URLSearchParams(location.search);
const W = innerWidth, H = innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#cfe3e8');
const camera = new THREE.PerspectiveCamera(+(q.get('fov') || 30), W / H, 0.1, 200);
scene.add(new THREE.HemisphereLight('#fff6e6', '#6b7d5a', 0.5));
const sun = new THREE.DirectionalLight('#fff1d6', 1.6); sun.position.set(6, 10, 8); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); scene.add(sun);

// 경사면: 앞(+z)으로 오르막. slope = 높이/거리
const state = { slope: +(q.get('slope') ?? 0.45), speed: +(q.get('speed') ?? 7), running: q.get('run') !== '0', pose: q.get('pose') || 'move', play: !q.has('phase'), gear: q.get('gear') || '' };
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40, 1, 1), new THREE.MeshLambertMaterial({ color: '#8fae6a' }));
ground.receiveShadow = true; scene.add(ground);
const grid = new THREE.GridHelper(40, 40, '#5d7a45', '#7a9a58'); scene.add(grid);
const setSlope = () => { const a = Math.atan(state.slope); ground.rotation.set(-Math.PI / 2 - a, 0, 0); grid.rotation.set(-a, 0, 0); };
const heightAt = (z) => z * state.slope;

const runners = [];
const wearAll = (r) => state.gear.split(',').filter((k) => ACCESSORIES[k]).forEach((k) => r.setGear(ACCESSORIES[k].slot, k));
const add = (x, heading) => { const r = buildRunner(); r.apply(DEFAULT_OUTFIT); wearAll(r); scene.add(r.root); runners.push({ r, x, heading }); return r; };
add(0, +(q.get('h') || 0)); // h=0 오르막을 향해, 3.14 내리막
if (!q.has('one')) { add(-2.2, Math.PI); add(2.2, Math.PI / 2); } // 내리막, 옆으로

const view = q.get('view') || 'side';
function placeCam() {
  const y = 1.3;
  if (view === 'side') { camera.position.set(11, y + 1.2, 0); camera.lookAt(0, y, 0); }
  else if (view === 'front') { camera.position.set(0, y + 1.0, 11); camera.lookAt(0, y, 0); }
  else if (view === 'back') { camera.position.set(0, y + 1.6, -11); camera.lookAt(0, y, 0); }
  else if (view === 'shoulder') { camera.position.set(4.5, 2.4, 5.5); camera.lookAt(0, 1.3, 0); }
  else if (view === 'quarter') { camera.position.set(6, 2.2, -6); camera.lookAt(0, 1.2, 0); }
  else if (view === 'top') { camera.position.set(0.01, 12, 0.01); camera.lookAt(0, 0, 0); }
}
placeCam(); setSlope();

let t = 0;
function step(dt) {
  t += dt;
  runners.forEach(({ r, x, heading }) => {
    const z = 0; r.root.position.set(x, heightAt(z), z); r.root.rotation.y = heading;
    const k = state.slope * Math.cos(heading); // 진행 방향 기울기
    r.animate(dt, { speed: state.pose === 'move' ? state.speed : 0, running: state.running, pose: state.pose, t, breath: 0, air: false, jumpV: 0, slope: k });
  });
}
// 고정 위상 렌더(확인용): ?phase=1.3
window.__char = { state, runners, step, render: () => renderer.render(scene, camera), setSlope, ACCESSORIES,
  at(phase) { for (let i = 0; i < 40; i++) step(1 / 60); runners.forEach(({ r }) => r.setPhase?.(phase)); step(0); renderer.render(scene, camera); } };
if (q.has('phase')) window.__char.at(+q.get('phase'));

// 조작 패널
const ui = document.createElement('div');
ui.style.cssText = 'position:fixed;left:8px;top:8px;max-width:340px;background:#fffd;padding:8px 10px;border-radius:8px;font:13px sans-serif;display:grid;gap:4px';
ui.innerHTML = `<label>기울기 <input id=s type=range min=-0.8 max=0.8 step=0.05 value=${state.slope}> <b id=sv>${state.slope}</b></label>
<label>속도 <input id=v type=range min=0 max=10 step=0.5 value=${state.speed}></label>
<label><input id=r type=checkbox ${state.running ? 'checked' : ''}> 달리기</label>
<label>포즈 <select id=p>${['move', 'wave', 'sit', 'photo', 'crouch', 'eat', 'dance', 'breath'].map((p) => `<option ${p === state.pose ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
<div>장비 ${Object.entries(ACCESSORIES).map(([k, a]) => `<button data-k=${k}>${a.label}</button>`).join(' ')}</div>
<label>시점 <select id=c>${['side', 'front', 'back', 'shoulder', 'quarter', 'top'].map((p) => `<option ${p === view ? 'selected' : ''}>${p}</option>`).join('')}</select></label>`;
if (!q.has('noui')) document.body.appendChild(ui);
const $ = (id) => ui.querySelector('#' + id);
$('s').oninput = (e) => { state.slope = +e.target.value; $('sv').textContent = state.slope; setSlope(); };
$('v').oninput = (e) => { state.speed = +e.target.value; };
$('r').onchange = (e) => { state.running = e.target.checked; };
$('p').onchange = (e) => { state.pose = e.target.value; t = 0; };
ui.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => { const k = b.dataset.k; runners.forEach(({ r }) => r.setGear(ACCESSORIES[k].slot, k)); }; });
$('c').onchange = (e) => { const u = new URL(location); u.searchParams.set('view', e.target.value); location = u; };

let last = performance.now();
function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (state.play) step(dt); renderer.render(scene, camera); requestAnimationFrame(loop); }
if (state.play) requestAnimationFrame(loop);
