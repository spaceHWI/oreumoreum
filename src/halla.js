// 먼 풍경 한라산 (#81): 후처리 없이 납작한 실루엣 메시 3겹 (뒤 구름띠 → 본 산 → 앞 능선)
// 남송이오름에서 동북동 하늘 아래. 아래쪽은 지평선 색(안개)으로 녹아들고, 시간대 색은 namsongi.js 의 PRE.hal 에서 받음
// 카메라를 HALLA.<층>.follow 만큼 따라가 아주 조금만 어긋나 보임 (멀리 있는 느낌)
import * as THREE from 'three';
import { HALLA } from './balance.js';
import { LOW } from './gfx2.js';

const T = THREE;
function hash(i) { let h = Math.imul(i | 0, 374761393) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const bump = (u, c, w) => { const t = (u - c) / w; return Math.exp(-t * t); };

// 높이 함수: u -1..1 (서 → 동), 반환 0..1 (h 비율)
const PROFILE = {
  main(u) {
    const a = Math.abs(u);
    // 완만한 방패: 넓게 퍼진 기슭 + 둥근 어깨
    let y = 0.5 * Math.pow(Math.max(0, 1 - a * a), 2.6) + 0.32 * Math.pow(Math.max(0, 1 - a), 1.3);
    // 백록담 봉우리: 가운데 솟은 머리, 꼭대기는 넓고 살짝 패임(서봉이 조금 높음)
    y += 0.13 * Math.pow(Math.max(0, 1 - Math.pow((u + 0.01) / 0.14, 2)), 0.75);
    y -= 0.012 * bump(u, 0.015, 0.025); y += 0.006 * bump(u, -0.06, 0.02);
    // 기슭의 기생 오름들 (작은 혹)
    [[-0.62, 0.05, 0.03], [-0.43, 0.04, 0.035], [-0.28, 0.035, 0.02], [0.3, 0.05, 0.03], [0.5, 0.06, 0.04], [0.71, 0.05, 0.03]].forEach(([c, w, h]) => { y += h * bump(u, c, w); });
    return y * (1 - Math.pow(a, 6));
  },
  front(u) {
    // 앞 능선: 낮게 이어지는 오름 혹들
    let y = 0.25 + 0.08 * Math.sin(u * 5.3 + 1.1) + 0.05 * Math.sin(u * 13.1 + 0.4);
    for (let i = 0; i < 9; i++) { const c = -0.92 + i * 0.23 + (hash(i) - 0.5) * 0.12; y += (0.25 + hash(i + 40) * 0.45) * Math.pow(Math.max(0, 1 - Math.pow((u - c) / (0.05 + hash(i + 80) * 0.05), 2)), 0.6); }
    return y * (1 - Math.pow(Math.abs(u), 8));
  },
  cloud(u) {
    // 구름띠: 몽글몽글한 윗선, 양 끝으로 가늘어짐
    let y = 0.55;
    for (let i = 0; i < 14; i++) { const c = -1 + i / 6.5 + (hash(i + 7) - 0.5) * 0.08; y += (0.18 + hash(i + 21) * 0.22) * Math.sqrt(Math.max(0, 1 - Math.pow((u - c) / (0.06 + hash(i + 33) * 0.05), 2))); }
    return y * Math.pow(Math.max(0, 1 - u * u), 0.5);
  },
};

const VS = `attribute float hn; varying float vH; void main(){ vH=hn; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const FS = `uniform vec3 uCol; uniform vec3 uHor; uniform vec2 uFade; uniform float uTop; varying float vH;
void main(){ float k=smoothstep(uFade.x,uFade.y,vH); vec3 c=mix(uHor,uCol,k*(1.0-uTop)+uTop*k*k); gl_FragColor=vec4(c,1.0); }`;

function layer(kind, cfg, colU, horU) {
  const N = LOW ? HALLA.seg >> 1 : HALLA.seg, f = PROFILE[kind], pos = [], hn = [], idx = [];
  let mx = 0; for (let i = 0; i <= N; i++) mx = Math.max(mx, f(-1 + 2 * i / N));
  for (let i = 0; i <= N; i++) {
    const u = -1 + 2 * i / N, y = f(u) / mx;
    pos.push(u * cfg.w, HALLA.base, 0, u * cfg.w, HALLA.base + y * cfg.h, 0); hn.push(0, y);
    if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('hn', new T.Float32BufferAttribute(hn, 1)); g.setIndex(idx);
  const m = new T.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, side: T.DoubleSide, fog: false,
    uniforms: { uCol: colU, uHor: horU, uFade: { value: new T.Vector2(HALLA.fade[0], HALLA.fade[1]) }, uTop: { value: kind === 'cloud' ? 0 : HALLA.hazeTop } } });
  const mesh = new T.Mesh(g, m); mesh.name = 'halla-' + kind; mesh.frustumCulled = false; mesh.matrixAutoUpdate = true;
  return mesh;
}

// 반환: { group, update(camera), set(cur) } — cur 는 namsongi.js 시간대 색 (hal, hor, cl)
export function buildHalla(scene) {
  const b = HALLA.bearing * Math.PI / 180, dx = Math.sin(b), dz = -Math.cos(b), rot = Math.atan2(-dx, -dz);
  const U = { main: { value: new T.Color() }, front: { value: new T.Color() }, cloud: { value: new T.Color() } }, hor = { value: new T.Color() };
  const group = new T.Group(); group.name = 'halla';
  const L = ['cloud', 'main', 'front'].map((k, i) => { const cfg = HALLA[k], m = layer(k, cfg, U[k], hor); m.rotation.y = rot; m.renderOrder = -5 + i; group.add(m); return { m, cfg }; });
  scene.add(group);
  const tmp = new T.Color();
  return {
    group, layers: L,
    set(cur) {
      hor.value.copy(cur.hor); U.main.value.copy(cur.hal);
      U.front.value.copy(cur.hal).multiplyScalar(0.84).lerp(tmp.copy(cur.gr), 0.12);
      U.cloud.value.copy(cur.cl).lerp(cur.hor, 0.35);
    },
    update(camera) { const c = camera.position; for (const { m, cfg } of L) m.position.set(c.x * cfg.follow + dx * cfg.d, 0, c.z * cfg.follow + dz * cfg.d); },
  };
}
