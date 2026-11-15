import * as THREE from 'three';
import { TEXCS } from './boot.js';

// 제주(다랑쉬 근처) 기준 실제 태양 위치 — NOAA 근사식
export const JEJU = { lat: 33.47, lon: 126.82 };
const rad = Math.PI / 180;

// date: Date (실제 시각). 반환: 고도(도), 방위(북=0, 시계방향, 도)
export function sunPosition(date, lat = JEJU.lat, lon = JEJU.lon) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const eps = (23.439 - 0.0000004 * n) * rad;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lst = (gmst * 15 + lon) * rad;
  const ha = lst - ra;
  const la = lat * rad;
  const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
  let az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(ha));
  az = (az / rad + 360) % 360;
  return { el: el / rad, az };
}

// 그날의 해돋이·해넘이 시각 (Date). 고도 -0.833° 통과 시점을 1분 단위로 찾음
export function sunTimes(date) {
  const kst = new Date(date.getTime());
  // KST 자정
  const y = kst.getUTCFullYear(), mo = kst.getUTCMonth(), d = kst.getUTCDate();
  const base = Date.UTC(y, mo, d, 0, 0, 0) - 9 * 3600000 + ((date.getTime() + 9 * 3600000) % 86400000 < 0 ? -86400000 : 0);
  const startOfDay = Math.floor((date.getTime() + 9 * 3600000) / 86400000) * 86400000 - 9 * 3600000;
  let rise = null, set = null, prev = sunPosition(new Date(startOfDay)).el;
  for (let m = 1; m <= 1440; m++) {
    const t = startOfDay + m * 60000;
    const el = sunPosition(new Date(t)).el;
    if (prev < -0.833 && el >= -0.833 && !rise) rise = new Date(t);
    if (prev >= -0.833 && el < -0.833 && !set) set = new Date(t);
    prev = el;
  }
  void base;
  return { rise, set };
}

// 방위·고도 → 월드 방향 (북 = -z, 동 = +x)
export function sunDir(el, az, out = new THREE.Vector3()) {
  const e = el * rad, a = az * rad;
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).normalize();
}

export const fmtKST = (d) => { if (!d) return '--:--'; const k = new Date(d.getTime() + 9 * 3600000); return `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`; };

// 하늘에 해·별
export function buildSkyBodies(scene) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,240,1)'); grd.addColorStop(0.25, 'rgba(255,240,200,0.95)'); grd.addColorStop(0.5, 'rgba(255,200,120,0.35)'); grd.addColorStop(1, 'rgba(255,160,80,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = TEXCS;
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  sunSprite.scale.set(900, 900, 1); sunSprite.renderOrder = -1; scene.add(sunSprite);
  // 별
  const N = 900, pos = new Float32Array(N * 3);
  let s = 3; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < N; i++) { const u = r() * 2 - 1, th = r() * Math.PI * 2; const y = Math.abs(u) * 0.95 + 0.05; const rr = Math.sqrt(1 - y * y); pos[i * 3] = Math.cos(th) * rr * 7000; pos[i * 3 + 1] = y * 7000; pos[i * 3 + 2] = Math.sin(th) * rr * 7000; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(stars);
  return { sunSprite, stars };
}
