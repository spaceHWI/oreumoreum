import * as THREE from 'three';
import { WEATHER } from './balance.js';

// 실제 제주 날씨 연동 (#18) — Open-Meteo 현재 날씨(키 없음). 실패하면 맑음.
// 종류: clear 맑음 · cloudy 구름 많음 · overcast 흐림 · fog 안개 · rain 비 · snow 눈 · wind 강풍
// 날씨마다 하늘·빛·안개·풀 흔들림 값을 정해 두고, 바뀔 때 천천히(실제 시간 WEATHER.blendSec) 섞는다.
// cover 구름 덮인 비율 · gray 하늘·안개·구름의 회색기(1 = 파란 기 없음) · sky 하늘 밝기 배율(회색으로 바꾼 뒤) · flat 하늘 위·지평선 차이를 없애는 정도
// light 해·하늘빛 세기 · fog 안개 거리 배율 · sunHide 해 원반·햇무리·노을빛 가림 · wet 땅·풀·나무 채도·밝기 낮춤 · cloud 구름을 어둡게·크게·낮게(낮게 덮인 비구름)
// wind 풀 흔들림 · rain·snow 입자 · snd 빗소리 (#147: 비가 와도 맑아 보이던 것 → 하늘 짙은 회색, 해 숨김, 땅 칙칙, 비구름, 빗줄기)
export const WX = {
  clear: { name: '맑음', cover: 0.35, gray: 0, sky: 1, flat: 0, light: 1, fog: 1, sunHide: 0, wet: 0, cloud: 0, wind: 1, rain: 0, snow: 0, snd: 0 },
  cloudy: { name: '구름 많음', cover: 0.8, gray: 0.12, sky: 1, flat: 0, light: 0.88, fog: 0.9, sunHide: 0, wet: 0, cloud: 0, wind: 1.1, rain: 0, snow: 0, snd: 0 },
  overcast: { name: '흐림', cover: 1, gray: 0.9, sky: 0.82, flat: 0.55, light: 0.62, fog: 0.6, sunHide: 1, wet: 0.35, cloud: 0.45, wind: 1.2, rain: 0, snow: 0, snd: 0 },
  fog: { name: '안개', cover: 0.9, gray: 0.85, sky: 0.95, flat: 0.8, light: 0.62, fog: 0.07, sunHide: 0.9, wet: 0.4, cloud: 0.3, wind: 0.6, rain: 0, snow: 0, snd: 0 },
  rain: { name: '비', cover: 1, gray: 1, sky: 0.6, flat: 0.75, light: 0.45, fog: 0.22, sunHide: 1, wet: 1, cloud: 1, wind: 1.6, rain: 1, snow: 0, snd: 1 },
  snow: { name: '눈', cover: 1, gray: 1, sky: 1.05, flat: 0.7, light: 0.72, fog: 0.26, sunHide: 1, wet: 0.55, cloud: 0.35, wind: 1, rain: 0, snow: 1, snd: 0 },
  wind: { name: '강풍', cover: 0.6, gray: 0.1, sky: 1, flat: 0, light: 0.95, fog: 1, sunHide: 0, wet: 0, cloud: 0, wind: 3.2, rain: 0, snow: 0, snd: 0 },
};
export const WX_KEYS = Object.keys(WX);

// Open-Meteo 날씨 코드 + 구름양·바람 → 우리 종류
export function classify(c) {
  const code = c.weather_code, cloud = c.cloud_cover ?? 0, wind = c.wind_speed_10m ?? 0, pr = (c.precipitation ?? 0) + (c.rain ?? 0) + (c.showers ?? 0);
  if ([71, 73, 75, 77, 85, 86].includes(code) || (c.snowfall ?? 0) > 0) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95 || pr > 0.1) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (wind >= WEATHER.windKmh) return 'wind';
  if (cloud >= 85 || code === 3) return 'overcast';
  if (cloud >= 45 || code === 2) return 'cloudy';
  return 'clear';
}

const ICON = {
  clear: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  cloudy: '<circle cx="9" cy="9" r="3"/><path d="M9 3v1M3 9h1M4.8 4.8l.7.7M13.2 4.8l-.7.7"/><path d="M8 20h9a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.4 1.2A3 3 0 0 0 8 20z"/>',
  overcast: '<path d="M7 19h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.5A3.4 3.4 0 0 0 7 19z"/>',
  fog: '<path d="M4 8h12M7 12h13M4 16h10M9 20h9"/>',
  rain: '<path d="M7 15h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.5A3.4 3.4 0 0 0 7 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>',
  wind: '<path d="M3 9h10a3 3 0 1 0-3-3M3 14h14a3 3 0 1 1-3 3M3 19h6"/>',
};
export const wxIcon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ICON.clear}</svg>`;

export function createWeather({ scene, low }) {
  const cur = { ...WX.clear }; // 지금 화면에 반영된 값 (목표를 향해 천천히 이동)
  let target = 'clear', real = 'clear', forced = null, realAt = 0;
  const listeners = [];
  const NUM = ['cover', 'gray', 'sky', 'flat', 'light', 'fog', 'sunHide', 'wet', 'cloud', 'wind', 'rain', 'snow', 'snd'];

  // 눈: 캐릭터 둘레 상자 안에서 떨어지고 감겨 올라가는 굵은 점
  const N = low ? WEATHER.particlesLow : WEATHER.particles, BOX = WEATHER.box;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N * 3);
  for (let i = 0; i < N * 3; i++) seed[i] = Math.random();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: '#ffffff', size: 3.4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 5; scene.add(pts);
  // 비 (#147): 점 대신 바람 쪽으로 기운 짧은 선. 카메라 가까이 몇 줄은 굵은 띠(사각형)
  const R = WEATHER.rainLine, NR = low ? R.nLow : R.n;
  const lpos = new Float32Array(NR * 6), lgeo = new THREE.BufferGeometry(); lgeo.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
  const lmat = new THREE.LineBasicMaterial({ color: R.color, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const lines = new THREE.LineSegments(lgeo, lmat); lines.frustumCulled = false; lines.visible = false; lines.renderOrder = 5; scene.add(lines);
  const NB = low ? R.nearLow : R.near, bpos = new Float32Array(NB * 12), bidx = [];
  for (let i = 0; i < NB; i++) bidx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3);
  const bgeo = new THREE.BufferGeometry(); bgeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3)); bgeo.setIndex(bidx);
  const bmat = new THREE.MeshBasicMaterial({ color: R.color, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const bands = new THREE.Mesh(bgeo, bmat); bands.frustumCulled = false; bands.visible = false; bands.renderOrder = 6; scene.add(bands);
  const bseed = new Float32Array(NB * 3); for (let i = 0; i < bseed.length; i++) bseed[i] = Math.random();
  const lseed = new Float32Array(NR * 3); for (let i = 0; i < lseed.length; i++) lseed[i] = Math.random();
  let pt = 0, last = 0;
  const _r = new THREE.Vector3(), _f = new THREE.Vector3();

  // cam: 카메라 (가까운 굵은 빗줄기). dt 는 프레임 dt(상한 있음) 대신 실제 시간으로 섞음 (#147: 느린 기기에서 12초 뒤에도 0.37 만 섞이던 것)
  function update(dt, p, wind, cam = null) {
    const now = performance.now() / 1000, rdt = last ? Math.min(1, Math.max(0, now - last)) : dt; last = now;
    const T = WX[target], k = 1 - Math.exp(-rdt * 3 / WEATHER.blendSec); // blendSec 이면 95%
    NUM.forEach((n) => { cur[n] += (T[n] - cur[n]) * k; });
    pt += dt;
    const drift = (cur.snow > cur.rain ? 2.2 : R.drift) * (wind || 1);
    // 눈
    pts.visible = cur.snow > 0.02;
    if (pts.visible) {
      mat.size = low ? 3.2 : 4.2; mat.opacity = Math.min(1, cur.snow) * 0.95;
      const n = Math.floor(N * Math.min(1, cur.snow)); geo.setDrawRange(0, n);
      for (let i = 0; i < n; i++) {
        const sx = seed[i * 3], sy = seed[i * 3 + 1], sz = seed[i * 3 + 2];
        const y = ((sy * BOX - pt * WEATHER.snowFall * (0.8 + sx * 0.4)) % BOX + BOX) % BOX;
        const sw = Math.sin(pt * 1.3 + sz * 40) * 1.2;
        let x = (sx * BOX + pt * drift * (0.6 + sz * 0.4) + sw) % BOX; if (x < 0) x += BOX;
        pos[i * 3] = p.x + x - BOX / 2; pos[i * 3 + 1] = p.y - 4 + y; pos[i * 3 + 2] = p.z + ((sz * BOX) % BOX) - BOX / 2;
      }
      geo.attributes.position.needsUpdate = true;
    }
    // 비: 선 (위 끝 = 아래 끝 + 떨어지는 방향의 반대로 len)
    const ra = cur.rain; lines.visible = ra > 0.02; bands.visible = ra > 0.02 && !!cam;
    if (!lines.visible) return;
    const fall = WEATHER.rainFall, sl = drift / fall, L = R.len, ux = sl * L, uy = L; // 기울기: 바람/떨어지는 빠르기
    lmat.opacity = Math.min(1, ra) * R.opacity;
    const n = Math.floor(NR * Math.min(1, ra)); lgeo.setDrawRange(0, n * 2);
    for (let i = 0; i < n; i++) {
      const sx = lseed[i * 3], sy = lseed[i * 3 + 1], sz = lseed[i * 3 + 2], j = i * 6;
      const y = ((sy * BOX - pt * fall * (0.85 + sx * 0.3)) % BOX + BOX) % BOX;
      let x = (sx * BOX + pt * drift * (0.9 + sz * 0.2)) % BOX; if (x < 0) x += BOX;
      const X = p.x + x - BOX / 2, Y = p.y - 4 + y, Z = p.z + sz * BOX - BOX / 2;
      lpos[j] = X; lpos[j + 1] = Y; lpos[j + 2] = Z; lpos[j + 3] = X - ux; lpos[j + 4] = Y + uy; lpos[j + 5] = Z;
    }
    lgeo.attributes.position.needsUpdate = true;
    if (!bands.visible) return;
    // 가까운 굵은 빗줄기: 카메라 앞 near[0]~near[1] m, 화면 쪽을 보는 띠
    bmat.opacity = Math.min(1, ra) * R.bandOpacity;
    _f.set(0, 0, -1).applyQuaternion(cam.quaternion); _r.set(1, 0, 0).applyQuaternion(cam.quaternion);
    const W = R.bandW, BL = R.bandLen, cx = cam.position.x, cy = cam.position.y, cz = cam.position.z, [d0, d1] = R.bandD;
    for (let i = 0; i < NB; i++) {
      const a = bseed[i * 3], b = bseed[i * 3 + 1], c = bseed[i * 3 + 2], d = d0 + a * (d1 - d0), sideK = (b - 0.5) * d * 1.3;
      const yy = ((c * 8 - pt * fall * 1.1) % 8 + 8) % 8 - 4;
      const X = cx + _f.x * d + _r.x * sideK, Y = cy + yy, Z = cz + _f.z * d + _r.z * sideK, o = i * 12;
      const tx = -ux / L * BL, ty = BL; // 위쪽 끝까지
      const rx = _r.x * W, rz = _r.z * W;
      bpos[o] = X - rx; bpos[o + 1] = Y; bpos[o + 2] = Z - rz;
      bpos[o + 3] = X + rx; bpos[o + 4] = Y; bpos[o + 5] = Z + rz;
      bpos[o + 6] = X - rx + tx; bpos[o + 7] = Y + ty; bpos[o + 8] = Z - rz;
      bpos[o + 9] = X + rx + tx; bpos[o + 10] = Y + ty; bpos[o + 11] = Z + rz;
    }
    bgeo.attributes.position.needsUpdate = true;
  }

  let calmOn = false; // #100 튜토리얼 동안은 맑음 (어드민이 정한 날씨는 그대로)
  function resolve() { const t = forced || (calmOn ? 'clear' : real); if (t !== target) { target = t; listeners.forEach((f) => f(t)); } }
  function calm(v) { calmOn = !!v; resolve(); }
  function set(k) { if (k && !WX[k]) return false; forced = k || null; resolve(); return true; }
  function setReal(k) { real = WX[k] ? k : 'clear'; resolve(); }

  async function fetchNow() {
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER.lat}&longitude=${WEATHER.lon}&current=weather_code,cloud_cover,wind_speed_10m,precipitation,rain,showers,snowfall&timezone=Asia%2FSeoul`;
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(u, { signal: ctl.signal }); clearTimeout(to);
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json(); setReal(classify(j.current || {})); realAt = Date.now();
    } catch { if (!realAt || Date.now() - realAt > WEATHER.keepMin * 60000) setReal('clear'); } // #147: 못 받으면 앞에 받은 날씨를 keepMin 분까지 둠
  }
  fetchNow(); setInterval(fetchNow, WEATHER.pollMin * 60000);

  const settled = () => NUM.every((n) => Math.abs(cur[n] - WX[target][n]) < 0.003);
  return { cur, update, get settled() { return settled(); }, set, setReal, calm, onChange: (f) => listeners.push(f), get kind() { return target; }, get real() { return real; }, get forced() { return forced; } };
}
