import * as THREE from 'three';
import { WEATHER } from './balance.js';

// 실제 제주 날씨 연동 (#18) — Open-Meteo 현재 날씨(키 없음). 실패하면 맑음.
// 종류: clear 맑음 · cloudy 구름 많음 · overcast 흐림 · fog 안개 · rain 비 · snow 눈 · wind 강풍
// 날씨마다 하늘·빛·안개·풀 흔들림 값을 정해 두고, 바뀔 때 천천히 섞는다.
// #147: 비·흐림·눈이 한눈에 보이게. sky 하늘을 회색 톤(top·hor)으로 덮는 정도, sunHide 해 원반·햇무리 가림,
// sun 햇빛 배율(그림자 진하기) · amb 하늘빛 배율, wet 땅·풀·나무 채도·밝기 낮춤, low 구름을 낮고 크게, cl 구름 색
export const WX = {
  clear: { name: '맑음', cover: 0.35, gray: 0, light: 1, amb: 1, fog: 1, wind: 1, rain: 0, snow: 0, snd: 0, sky: 0, sunHide: 0, wet: 0, low: 0, top: '#3f8fe2', hor: '#cfe8f6', cl: '#ffffff' },
  cloudy: { name: '구름 많음', cover: 0.8, gray: 0.12, light: 0.88, amb: 0.95, fog: 0.9, wind: 1.1, rain: 0, snow: 0, snd: 0, sky: 0, sunHide: 0.1, wet: 0, low: 0, top: '#3f8fe2', hor: '#cfe8f6', cl: '#ffffff' },
  overcast: { name: '흐림', cover: 1, gray: 0.42, light: 0.42, amb: 0.95, fog: 0.62, wind: 1.2, rain: 0, snow: 0, snd: 0, sky: 0.88, sunHide: 1, wet: 0.5, low: 0.55, top: '#8c9399', hor: '#aeb3b6', cl: '#9aa0a5' },
  fog: { name: '안개', cover: 0.9, gray: 0.5, light: 0.45, amb: 0.95, fog: 0.07, wind: 0.6, rain: 0, snow: 0, snd: 0, sky: 0.9, sunHide: 1, wet: 0.45, low: 0.4, top: '#aab0b2', hor: '#c3c7c7', cl: '#b6bbbd' },
  rain: { name: '비', cover: 1, gray: 0.55, light: 0.3, amb: 0.9, fog: 0.26, wind: 1.6, rain: 1, snow: 0, snd: 1, sky: 0.95, sunHide: 1, wet: 0.9, low: 1, top: '#596066', hor: '#7b8287', cl: '#5d6469' },
  snow: { name: '눈', cover: 1, gray: 0.5, light: 0.5, amb: 1, fog: 0.3, wind: 1, rain: 0, snow: 1, snd: 0, sky: 0.9, sunHide: 1, wet: 0.45, low: 0.7, top: '#b2b8bc', hor: '#d0d4d6', cl: '#c4c9cc' },
  wind: { name: '강풍', cover: 0.6, gray: 0.1, light: 0.95, amb: 0.98, fog: 1, wind: 3.2, rain: 0, snow: 0, snd: 0, sky: 0, sunHide: 0, wet: 0, low: 0, top: '#3f8fe2', hor: '#cfe8f6', cl: '#ffffff' },
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

export function createWeather({ scene, low, renderer = null }) {
  const NUM = ['cover', 'gray', 'light', 'amb', 'fog', 'wind', 'rain', 'snow', 'snd', 'sky', 'sunHide', 'wet', 'low'], COL = ['top', 'hor', 'cl'];
  const cur = {}; NUM.forEach((n) => { cur[n] = WX.clear[n]; }); COL.forEach((n) => { cur[n] = new THREE.Color(WX.clear[n]); }); // 지금 화면에 반영된 값 (목표를 향해 천천히 이동)
  const tcol = {}; for (const k in WX) tcol[k] = Object.fromEntries(COL.map((n) => [n, new THREE.Color(WX[k][n])]));
  let target = 'clear', real = 'clear', forced = null, lastOk = 0;
  const listeners = [];

  // 비 (#147): 바람 쪽으로 기운 짧은 선(카메라를 보는 얇은 띠). 움직임은 셰이더에서, 가까운 몇 줄은 굵게
  const N = low ? WEATHER.particlesLow : WEATHER.particles, BOX = WEATHER.box, R = WEATHER.streak;
  const rg = new THREE.InstancedBufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0], 3)); rg.setIndex([0, 1, 2, 1, 3, 2]);
  const rs = new Float32Array(N * 4); for (let i = 0; i < N * 4; i++) rs[i] = Math.random();
  rg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(rs, 4)); rg.instanceCount = 0;
  const RU = { uT: { value: 0 }, uC: { value: new THREE.Vector3() }, uDrift: { value: 0 }, uFall: { value: WEATHER.rainFall }, uA: { value: 0 }, uCol: { value: new THREE.Color(WEATHER.rainCol) }, uRes: { value: new THREE.Vector2(800, 600) } };
  const rmat = new THREE.ShaderMaterial({ uniforms: RU, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    vertexShader: `attribute vec4 aSeed; uniform vec2 uRes; uniform float uT; uniform vec3 uC; uniform float uDrift; uniform float uFall; varying float vA; varying float vY;
void main(){ float B=${BOX.toFixed(1)};
  float y=mod(aSeed.y*B-uT*uFall*(0.85+aSeed.x*0.3),B), x=mod(aSeed.x*B+uT*uDrift*(0.7+aSeed.z*0.3),B);
  vec3 c=uC+vec3(x-B*0.5,y-4.0,aSeed.z*B-B*0.5);
  vec3 dir=normalize(vec3(uDrift,-uFall,uDrift*0.35));
  float len=${R.len[0].toFixed(2)}+aSeed.w*${(R.len[1] - R.len[0]).toFixed(2)}, w=${R.w.toFixed(3)}*(aSeed.w>${(1 - R.thick).toFixed(3)}?${R.thickK.toFixed(1)}:1.0);
  vec4 a=viewMatrix*vec4(c,1.0), b=viewMatrix*vec4(c-dir*len,1.0);
  vec4 p=mix(a,b,position.y); float vz=-p.z;
  vec4 ca=projectionMatrix*a, cb=projectionMatrix*b, cp=projectionMatrix*p;
  vec2 sa=ca.xy/ca.w*uRes, sb=cb.xy/cb.w*uRes; vec2 sd=normalize(vec2(-(sb.y-sa.y),sb.x-sa.x)+vec2(1e-5));
  float px=max(w*projectionMatrix[1][1]*0.5*uRes.y/max(vz,0.1), ${R.minPx.toFixed(2)}); // 굵기(픽셀): 가까울수록 굵게, 멀어도 최소 minPx (얇으면 안 그려지는 것 막기)
  cp.xy+=sd*position.x*px*2.0/uRes*cp.w;
  vA=(0.55+0.45*aSeed.z)*smoothstep(1.5,5.0,vz); vY=position.y; gl_Position=cp; }`,
    fragmentShader: `uniform float uA; uniform vec3 uCol; varying float vA; varying float vY;
void main(){ gl_FragColor=vec4(uCol,uA*vA*smoothstep(0.0,0.35,vY)*smoothstep(1.0,0.75,vY)); }` });
  const streaks = new THREE.Mesh(rg, rmat); streaks.frustumCulled = false; streaks.visible = false; streaks.renderOrder = 5; scene.add(streaks);

  // 눈: 굵은 점
  const SN = low ? WEATHER.snowLow : WEATHER.snowN;
  const pos = new Float32Array(SN * 3), seed = new Float32Array(SN * 3);
  for (let i = 0; i < SN * 3; i++) seed[i] = Math.random();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: '#ffffff', size: low ? WEATHER.snowSize[0] : WEATHER.snowSize[1], sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 5; scene.add(pts);
  let pt = 0, lastNow = 0;

  function update(dt, p, wind) {
    // 목표를 향해 섞기: 프레임과 상관없이 실제 시간으로 약 blendSec 초 (#147: dt 상한 때문에 느린 기기에서 늦게 섞이던 것)
    const now = performance.now(), real = lastNow ? Math.min(1, (now - lastNow) / 1000) : dt; lastNow = now;
    const k = 1 - Math.exp(-real * 3 / WEATHER.blendSec), T = WX[target], TC = tcol[target];
    NUM.forEach((n) => { cur[n] += (T[n] - cur[n]) * k; }); COL.forEach((n) => { cur[n].lerp(TC[n], k); });
    pt += dt;
    // 비
    streaks.visible = cur.rain > 0.02;
    if (streaks.visible) {
      if (renderer) renderer.getDrawingBufferSize(RU.uRes.value);
      RU.uT.value = pt; RU.uC.value.copy(p); RU.uDrift.value = WEATHER.rainDrift * (wind || 1); RU.uA.value = Math.min(1, cur.rain) * WEATHER.rainAlpha;
      rg.instanceCount = Math.floor(N * Math.min(1, cur.rain));
    }
    // 눈
    pts.visible = cur.snow > 0.02;
    if (!pts.visible) return;
    const fall = WEATHER.snowFall, drift = 2.2 * (wind || 1);
    mat.opacity = Math.min(1, cur.snow) * 0.95;
    const n = Math.floor(SN * Math.min(1, cur.snow));
    geo.setDrawRange(0, n);
    for (let i = 0; i < n; i++) {
      const sx = seed[i * 3], sy = seed[i * 3 + 1], sz = seed[i * 3 + 2];
      const y = ((sy * BOX - pt * fall * (0.8 + sx * 0.4)) % BOX + BOX) % BOX;
      const sw = Math.sin(pt * 1.3 + sz * 40) * 1.2;
      let x = (sx * BOX + pt * drift * (0.6 + sz * 0.4) + sw) % BOX; if (x < 0) x += BOX;
      pos[i * 3] = p.x + x - BOX / 2; pos[i * 3 + 1] = p.y - 4 + y; pos[i * 3 + 2] = p.z + ((sz * BOX) % BOX) - BOX / 2;
    }
    geo.attributes.position.needsUpdate = true;
  }
  // 바로 목표값으로 (확인·스크린샷용)
  function snap() { NUM.forEach((n) => { cur[n] = WX[target][n]; }); COL.forEach((n) => { cur[n].copy(tcol[target][n]); }); }

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
      const j = await r.json(); setReal(classify(j.current || {})); lastOk = Date.now();
    } catch { if (!lastOk || Date.now() - lastOk > WEATHER.keepMin * 60000) setReal('clear'); } // #147: 앞에 받은 날씨가 있으면 keepMin 분까지 그대로
  }
  fetchNow(); setInterval(fetchNow, WEATHER.pollMin * 60000);

  const settled = () => NUM.every((n) => Math.abs(cur[n] - WX[target][n]) < 0.003);
  return { cur, update, snap, get settled() { return settled(); }, set, setReal, calm, onChange: (f) => listeners.push(f), get kind() { return target; }, get real() { return real; }, get forced() { return forced; }, get drawn() { return { rain: streaks.visible ? rg.instanceCount : 0, snow: pts.visible ? geo.drawRange.count : 0 }; } };
}
