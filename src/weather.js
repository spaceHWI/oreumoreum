import * as THREE from 'three';
import { WEATHER } from './balance.js';

// 실제 제주 날씨 연동 (#18) — Open-Meteo 현재 날씨(키 없음). 실패하면 맑음.
// 종류: clear 맑음 · cloudy 구름 많음 · overcast 흐림 · fog 안개 · rain 비 · snow 눈 · wind 강풍
// 날씨마다 하늘·빛·안개·풀 흔들림 값을 정해 두고, 바뀔 때 천천히 섞는다.
export const WX = {
  clear: { name: '맑음', cover: 0.35, gray: 0, light: 1, fog: 1, wind: 1, rain: 0, snow: 0, snd: 0 },
  cloudy: { name: '구름 많음', cover: 0.8, gray: 0.12, light: 0.88, fog: 0.9, wind: 1.1, rain: 0, snow: 0, snd: 0 },
  overcast: { name: '흐림', cover: 1, gray: 0.42, light: 0.7, fog: 0.7, wind: 1.2, rain: 0, snow: 0, snd: 0 },
  fog: { name: '안개', cover: 0.9, gray: 0.5, light: 0.68, fog: 0.07, wind: 0.6, rain: 0, snow: 0, snd: 0 },
  rain: { name: '비', cover: 1, gray: 0.55, light: 0.58, fog: 0.3, wind: 1.6, rain: 1, snow: 0, snd: 1 },
  snow: { name: '눈', cover: 1, gray: 0.5, light: 0.78, fog: 0.28, wind: 1, rain: 0, snow: 1, snd: 0 },
  wind: { name: '강풍', cover: 0.6, gray: 0.1, light: 0.95, fog: 1, wind: 3.2, rain: 0, snow: 0, snd: 0 },
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
  let target = 'clear', real = 'clear', forced = null;
  const listeners = [];
  const NUM = ['cover', 'gray', 'light', 'fog', 'wind', 'rain', 'snow', 'snd'];

  // 비·눈 입자: 캐릭터 둘레 상자 안에서 떨어지고 감겨 올라가는 점·선
  const N = low ? WEATHER.particlesLow : WEATHER.particles, BOX = WEATHER.box;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N * 3);
  for (let i = 0; i < N * 3; i++) seed[i] = Math.random();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: '#cfe0f2', size: 2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 5; scene.add(pts);
  let pt = 0;

  function update(dt, p, wind) {
    // 목표를 향해 섞기 (약 6초)
    const T = WX[target], k = Math.min(1, dt / WEATHER.blendSec);
    NUM.forEach((n) => { cur[n] += (T[n] - cur[n]) * k; });
    const amt = Math.max(cur.rain, cur.snow);
    pts.visible = amt > 0.02;
    if (!pts.visible) return;
    pt += dt;
    const snow = cur.snow > cur.rain;
    const fall = snow ? WEATHER.snowFall : WEATHER.rainFall, drift = (snow ? 2.2 : 5) * (wind || 1);
    mat.size = snow ? (low ? 3 : 3.4) : 2; mat.color.set(snow ? '#ffffff' : '#cfe0f2'); mat.opacity = Math.min(1, amt) * (snow ? 0.9 : 0.55);
    const n = Math.floor(N * Math.min(1, amt));
    geo.setDrawRange(0, n);
    for (let i = 0; i < n; i++) {
      const sx = seed[i * 3], sy = seed[i * 3 + 1], sz = seed[i * 3 + 2];
      const y = ((sy * BOX - pt * fall * (0.8 + sx * 0.4)) % BOX + BOX) % BOX;
      const sw = snow ? Math.sin(pt * 1.3 + sz * 40) * 1.2 : 0;
      let x = (sx * BOX + pt * drift * (0.6 + sz * 0.4) + sw) % BOX; if (x < 0) x += BOX;
      pos[i * 3] = p.x + x - BOX / 2 + (BOX / 2 - y) * 0.05 * drift * 0.1; pos[i * 3 + 1] = p.y - 4 + y; pos[i * 3 + 2] = p.z + ((sz * BOX) % BOX) - BOX / 2;
    }
    geo.attributes.position.needsUpdate = true;
  }

  function resolve() { const t = forced || real; if (t !== target) { target = t; listeners.forEach((f) => f(t)); } }
  function set(k) { if (k && !WX[k]) return false; forced = k || null; resolve(); return true; }
  function setReal(k) { real = WX[k] ? k : 'clear'; resolve(); }

  async function fetchNow() {
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER.lat}&longitude=${WEATHER.lon}&current=weather_code,cloud_cover,wind_speed_10m,precipitation,rain,showers,snowfall&timezone=Asia%2FSeoul`;
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(u, { signal: ctl.signal }); clearTimeout(to);
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json(); setReal(classify(j.current || {}));
    } catch { setReal('clear'); }
  }
  fetchNow(); setInterval(fetchNow, WEATHER.pollMin * 60000);

  const settled = () => NUM.every((n) => Math.abs(cur[n] - WX[target][n]) < 0.003);
  return { cur, update, get settled() { return settled(); }, set, setReal, onChange: (f) => listeners.push(f), get kind() { return target; }, get real() { return real; }, get forced() { return forced; } };
}
