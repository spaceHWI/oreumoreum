// 겉모습 옷 모양 (#179): balance.js STYLE_CLOTHES 의 새 kind 와, 이미 있는 kind(tee·long·shorts·vest·jacket·socks)에 더한 무늬 값
// - clothes.js 의 틀(shell 몸통 껍질·tube 팔다리 관)과 좌표(TORSO·HIPS·LEG·ARM·HC)를 그대로 씀. 체형(#177) 표를 읽어 만듦
// - CLOTH_BUILD 에 새 kind 를 더하고, 있던 kind 는 '원래 모양 + 덧붙임' 으로 감쌈. gear.js 가 addClothes 전에 이 파일을 읽음
// - 옷 하나 = 그리기 한 번 (runner bake 가 조각을 정점 색으로 합침). 면 수는 기존 옷과 비슷하게 (조각 몇 개)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CLOTH_BUILD, KIND_COVER, KIND_HAT, COVER, HAT_CLIP, HC, TORSO, HIPS, ARM, LEG, legR, prof, frontZ, shell, tube, dark, tee, pants, vest, jacket, socks } from './clothes.js';

const mesh = (g, m) => new THREE.Mesh(g, m);
const both = (f) => [f(1), f(-1)];
const at = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
const G = (...ms) => { const g = new THREE.Group(); ms.flat(3).forEach((m) => m && g.add(m)); return g; };
const side2 = (m) => { m.side = THREE.DoubleSide; return m; };
const band = (m, y0, y1, pad, open = 0) => mesh(shell(TORSO, y0, y1, pad, { rows: 1, open }), m);
const add = (g, ...ms) => { ms.flat(3).forEach((m) => m && g.add(m)); return g; };
const backZ = (y, pad = 0) => prof(TORSO, y)[3] - pad;
const RAIN = ['#e0443a', '#f29a2e', '#f2d03a', '#5cb84a', '#3f78c0', '#8a5ac8'];

/* ---------- 모자 칸 (머리 뼈에 붙는 단단한 것) ---------- */
function headband(m, y = HC.y + 0.03, r = 0.262, w = 0.026) { const b = at(new THREE.CylinderGeometry(r, r, w, 22, 1, true), side2(m), 0, y, HC.z); b.scale.z = 1.05; return b; }
const HATS = {
  goggle(mat, L) { // 해녀 물안경: 이마에 걸친 둥근 알 둘 + 끈
    const M = mat('main', L.main), A = mat('acc', L.acc), y = HC.y + 0.06, z = HC.z + 0.255;
    return G(headband(M, y, 0.258, 0.022), both((s) => { const f = at(new THREE.TorusGeometry(0.05, 0.016, 6, 14), M, s * 0.065, y + 0.01, z); f.rotation.y = s * 0.18; const l = at(new THREE.CircleGeometry(0.046, 12), A, s * 0.065, y + 0.01, z + 0.01); l.rotation.y = s * 0.18; return [f, l]; }));
  },
  beanie(mat, L) { // 감귤 꼭지 비니: 귤색 니트 + 꼭지·잎
    const M = mat('main', L.main), A = mat('acc', L.acc), K = mat('rib', dark(L.main, 0.85));
    const d = at(new THREE.SphereGeometry(0.265, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M, 0, HC.y - 0.005, HC.z); d.scale.set(1, 0.95, 1.06);
    const st = at(new THREE.CylinderGeometry(0.018, 0.024, 0.07, 6), A, 0, HC.y + 0.27, HC.z); const lf = at(new THREE.SphereGeometry(0.05, 8, 6), A, 0.05, HC.y + 0.27, HC.z); lf.scale.set(1.4, 0.35, 0.8); lf.rotation.z = -0.4;
    return G(d, headband(K, HC.y + 0.01, 0.27, 0.06), st, lf);
  },
  harubang(mat, L) { // 돌하르방 모자: 둥글고 높은 벙거지, 아래 띠
    const M = mat('main', L.main), A = mat('acc', L.acc);
    const c = at(new THREE.CylinderGeometry(0.2, 0.262, 0.26, 18, 2), M, 0, HC.y + 0.15, HC.z); c.scale.z = 1.05;
    const t = at(new THREE.SphereGeometry(0.2, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), M, 0, HC.y + 0.28, HC.z); t.scale.set(1, 0.7, 1.05);
    return G(c, t, headband(A, HC.y + 0.035, 0.268, 0.05));
  },
  halfgyul(mat, L) { // 귤 반쪽 헬멧: 귤 껍질 반구 + 안쪽 흰 테 + 꼭지
    const M = mat('main', L.main), A = mat('acc', L.acc), K = mat('stem', '#3f9a5a');
    const d = at(new THREE.SphereGeometry(0.28, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M, 0, HC.y - 0.01, HC.z); d.scale.set(1, 0.9, 1.05);
    const rim = at(new THREE.TorusGeometry(0.278, 0.016, 6, 24), A, 0, HC.y - 0.005, HC.z); rim.rotation.x = Math.PI / 2; rim.scale.y = 1.05;
    return G(d, rim, at(new THREE.CylinderGeometry(0.02, 0.03, 0.04, 6), K, 0, HC.y + 0.25, HC.z));
  },
  gat(mat, L) { // 말총 갓: 넓고 얇은 챙 + 높은 통 + 끈
    const M = side2(mat('main', L.main)), A = mat('acc', L.acc);
    const brim = at(new THREE.CylinderGeometry(0.46, 0.48, 0.012, 28, 1), M, 0, HC.y + 0.06, HC.z);
    const c = at(new THREE.CylinderGeometry(0.15, 0.17, 0.2, 18, 1), M, 0, HC.y + 0.17, HC.z);
    return G(brim, c, at(new THREE.CircleGeometry(0.15, 18), M, 0, HC.y + 0.27, HC.z).rotateX(-Math.PI / 2), both((s) => { const t = at(new THREE.BoxGeometry(0.012, 0.2, 0.012), A, s * 0.21, HC.y - 0.06, HC.z + 0.12); t.rotation.z = s * 0.1; return t; }));
  },
  chef(mat, L) { // 요리사 모자: 띠 + 부푼 윗부분
    const M = mat('main', L.main), A = mat('acc', L.acc);
    const top = at(new THREE.SphereGeometry(0.25, 16, 10), M, 0, HC.y + 0.3, HC.z); top.scale.set(1.08, 0.72, 1.08);
    return G(at(new THREE.CylinderGeometry(0.255, 0.262, 0.16, 20, 1), A, 0, HC.y + 0.1, HC.z), top);
  },
  hardhat(mat, L) { // 안전모: 둥근 통 + 가운데 등줄 + 앞 챙
    const M = mat('main', L.main), A = mat('acc', L.acc);
    const d = at(new THREE.SphereGeometry(0.27, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M, 0, HC.y, HC.z); d.scale.set(1, 0.85, 1.07);
    const ridge = at(new THREE.BoxGeometry(0.05, 0.03, 0.46), M, 0, HC.y + 0.22, HC.z); const brim = at(new THREE.CylinderGeometry(0.31, 0.32, 0.016, 22, 1), M, 0, HC.y + 0.005, HC.z + 0.02); brim.scale.z = 1.1;
    return G(d, ridge, brim, headband(A, HC.y + 0.05, 0.268, 0.03));
  },
  lamp(mat, L) { // 캠핑 헤드랜턴: 머리띠 + 이마 등 (불빛 색)
    const M = mat('main', L.main), A = mat('acc', L.acc), y = HC.y + 0.04, z = HC.z + 0.262;
    return G(headband(M, y, 0.26, 0.03), at(new RoundedBoxGeometry(0.1, 0.07, 0.05, 2, 0.015), M, 0, y, z), at(new THREE.CircleGeometry(0.028, 12), A, 0, y, z + 0.027));
  },
  antenna(mat, L) { // 외계인 더듬이 머리띠: 머리 위를 넘는 띠 + 휜 대 둘 + 끝 구슬
    const M = mat('main', L.main), A = mat('acc', L.acc), out = [];
    const b = at(new THREE.TorusGeometry(0.262, 0.016, 6, 22, Math.PI), M, 0, HC.y - 0.07, HC.z - 0.01); out.push(b);
    both((s) => { const g = new THREE.Group(); g.position.set(s * 0.1, HC.y + 0.17, HC.z); g.rotation.z = -s * 0.4; out.push(g);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.2, 5), M); st.position.y = 0.1; g.add(st);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), A); ball.position.y = 0.21; g.add(ball); });
    return G(out);
  },
  paperbag(mat, L) { // 종이봉투: 머리를 덮는 봉투 + 눈구멍 둘 + 접힌 윗단
    const M = mat('main', L.main), D = mat('hole', L.acc), cy = HC.y + 0.04, W = 0.5, H = 0.5, Dp = 0.48;
    const bag = at(new RoundedBoxGeometry(W, H, Dp, 2, 0.04), M, 0, cy, HC.z); bag.rotation.y = 0.04;
    const fold = at(new THREE.BoxGeometry(W + 0.02, 0.05, Dp + 0.02), mat('fold', dark(L.main, 0.86)), 0, cy + H / 2 - 0.03, HC.z);
    return G(bag, fold, both((s) => { const e = at(new THREE.CircleGeometry(0.04, 10), D, s * 0.1, cy, HC.z + Dp / 2 + 0.003); e.scale.set(1, 1.2, 1); return e; }), at(new THREE.PlaneGeometry(0.12, 0.016), D, 0, cy - 0.12, HC.z + Dp / 2 + 0.003));
  },
  shades(mat, L) { // 선글라스: 눈 앞 알 둘 + 다리
    const M = mat('main', L.main), A = mat('acc', L.acc), y = HC.y - 0.075, z = HC.z + 0.25;
    const lens = (s) => { const l = at(new RoundedBoxGeometry(0.1, 0.06, 0.016, 2, 0.012), M, s * 0.065, y, z); l.rotation.y = s * 0.15; return l; };
    return G(both(lens), at(new THREE.BoxGeometry(0.04, 0.012, 0.012), A, 0, y + 0.012, z + 0.004), both((s) => at(new THREE.BoxGeometry(0.012, 0.012, 0.24), A, s * 0.23, y + 0.01, HC.z + 0.13)));
  },
};
Object.assign(KIND_HAT, {
  goggle: { clip: undefined }, lamp: { clip: undefined }, antenna: { clip: undefined }, shades: { clip: undefined }, // 머리카락 그대로
  beanie: { clip: HAT_CLIP }, harubang: { clip: HAT_CLIP }, halfgyul: { clip: HAT_CLIP }, gat: { clip: HAT_CLIP }, chef: { clip: HAT_CLIP }, hardhat: { clip: HAT_CLIP },
  paperbag: { clip: 0.6, hide: true },
});

/* ---------- 티 칸 ---------- */
function tee2(mat, L) { // 글씨 티·하와이안·단체 티·I♥ 티: 기본 티 + 앞 무늬
  const g = tee(mat, L), y0 = 0.47;
  if (L.print) { const P = mat('print', L.print); [[0.5, 0.15], [0.465, 0.11]].forEach(([y, w], i) => add(g, at(new THREE.BoxGeometry(L.heart && !i ? 0.07 : w, 0.022, 0.006), P, L.heart && !i ? 0.06 : 0, L.heart ? y - 0.07 : y, frontZ(L.heart ? y - 0.07 : y, 0.004)))); }
  if (L.num) { const P = mat('num', L.acc); add(g, at(new THREE.CircleGeometry(0.035, 12), P, 0, 0.42, frontZ(0.42, 0.006))); }
  if (L.heart) { const H = mat('heart', L.heart), z = frontZ(y0 + 0.02, 0.006), flat = (m) => { m.scale.z = 0.3; return m; }; // 가슴의 하트: 동그라미 둘 + 뒤집은 뿔
    add(g, both((s) => flat(at(new THREE.SphereGeometry(0.024, 8, 6), H, s * 0.02, y0 + 0.04, z))), flat(at(new THREE.ConeGeometry(0.043, 0.05, 4), H, 0, y0 + 0.008, z).rotateZ(Math.PI))); }
  if (L.flowers) { const F = mat('flower', L.flowers), C = mat('fc', '#f2c94c'); [[-0.1, 0.52], [0.08, 0.55], [0.11, 0.42], [-0.06, 0.4], [0.0, 0.48]].forEach(([x, y]) => { const f = at(new THREE.SphereGeometry(0.03, 8, 6), F, x, y, frontZ(y, 0.002) - 0.006); f.scale.set(1, 1, 0.3); add(g, f, at(new THREE.SphereGeometry(0.01, 6, 4), C, x, y, frontZ(y, 0.004))); }); }
  return g;
}
function tank(mat, L) { // 멜빵 러닝: 소매 없는 몸통 + 어깨 끈 둘(멜빵)
  const M = mat('main', L.main), A = mat('acc', L.acc), out = [mesh(shell(TORSO, 0.345, 0.575, 0, { rows: 6 }), M)];
  both((s) => { const x = s * 0.1; out.push(at(new THREE.BoxGeometry(0.035, 0.27, 0.01), A, x, 0.47, frontZ(0.47, 0.012)), at(new THREE.BoxGeometry(0.035, 0.27, 0.01), A, x, 0.47, backZ(0.47, 0.012)), at(new THREE.BoxGeometry(0.04, 0.012, 0.29), A, x, 0.605, 0.03)); });
  out.push(band(A, 0.345, 0.37, 0.004));
  return G(out);
}
KIND_COVER.tank = ['chest', 'waist'];
KIND_COVER.tee2 = COVER.tee;

/* ---------- 바지 칸 ---------- */
function pants2(mat, L) {
  if (L.tight) { // 레깅스: 다리 단면(legR)을 따라 꼭 붙는 관
    const M = mat('main', L.main), A = mat('acc', L.acc), out = [mesh(shell(HIPS, 0.262, 0.4, 0, { rows: 4, capLo: true }), M)]; // 양말(두꺼운 것 포함)보다는 바깥 (tools/fit.mjs)
    out.push(...both((s) => mesh(tube('y', 0.04, 0.34, legR(0.04) + 0.024, legR(0.34) + 0.014, [s * LEG.x, LEG.z], { rows: 6 }), M)), ...both((s) => mesh(tube('y', 0.036, 0.058, legR(0.04) + 0.027, legR(0.058) + 0.026, [s * LEG.x, LEG.z], { rows: 1, capLo: true }), A)));
    out.push(...both((s) => mesh(tube('y', 0.06, 0.24, 0.006, 0.006, [s * (LEG.x + legR(0.15) + 0.026), LEG.z], { rows: 1, n: 4 }), A))); // 옆 줄 (잠바 아래로는 안 나오게 무릎 위까지)
    return G(out);
  }
  const g = pants(mat, L);
  if (L.rips) { const R = mat('rip', L.rips); both((s) => [0.17, 0.27].forEach((y, i) => { const p = at(new THREE.CircleGeometry(0.03, 8), R, s * LEG.x + (i ? -s * 0.02 : 0), y, LEG.z + 0.07 + (0.34 - y) * 0.03 + 0.012); p.scale.set(1.3, 0.6, 1); add(g, p); })); }
  if (L.check) { const C = mat('check', L.acc); [0.24, 0.29].forEach((y) => add(g, both((s) => mesh(tube('y', y, y + 0.014, 0.088, 0.088, [s * LEG.x, LEG.z], { rows: 1 }), C)))); add(g, both((s) => at(new THREE.BoxGeometry(0.012, 0.12, 0.01), C, s * LEG.x, 0.27, LEG.z + 0.088))); }
  if (L.bib) { // 멜빵 작업 바지: 가슴판 + 어깨 끈 (티셔츠 위, 잠바·조끼 안). 몸통이 둥글어 x 가 클수록 앞뒤 z 를 조금 안쪽으로 (0.94)
    const M = mat('main', L.main), A = mat('acc', L.acc), fz = (y, k = 0.94) => frontZ(y) * k + 0.006, bz = (y) => backZ(y) * 0.94 - 0.006;
    add(g, at(new RoundedBoxGeometry(0.15, 0.13, 0.014, 2, 0.006), M, 0, 0.465, fz(0.465, 0.97)), at(new RoundedBoxGeometry(0.07, 0.045, 0.01, 2, 0.004), A, 0, 0.475, fz(0.475, 0.97) + 0.009));
    add(g, both((s) => [at(new THREE.BoxGeometry(0.028, 0.14, 0.008), M, s * 0.075, 0.56, fz(0.56)), at(new THREE.BoxGeometry(0.028, 0.2, 0.008), M, s * 0.075, 0.5, bz(0.5)), at(new THREE.BoxGeometry(0.03, 0.01, 0.27), M, s * 0.075, 0.612, 0.03), at(new THREE.SphereGeometry(0.01, 6, 4), A, s * 0.075, 0.52, fz(0.52) + 0.006)]));
  }

  return g;
}
function mombbe(mat, L) { // 꽃무늬 몸뻬: 넉넉한 긴바지 + 발목 고무줄 + 꽃 점
  const M = mat('main', L.main), A = mat('acc', L.acc), D = mat('dots', L.dots), out = [mesh(shell(HIPS, 0.262, 0.4, 0, { rows: 4, capLo: true }), M)]; // 허리는 티셔츠 안 (tools/fit.mjs)
  // 무릎께가 가장 넉넉하고 위는 잠바 안으로
  out.push(...both((s) => mesh(tube('y', 0.05, 0.2, 0.072, 0.1, [s * LEG.x, LEG.z], { rows: 3 }), M)), ...both((s) => mesh(tube('y', 0.2, 0.34, 0.1, 0.09, [s * LEG.x, LEG.z], { rows: 3 }), M)), ...both((s) => mesh(tube('y', 0.04, 0.065, 0.066, 0.07, [s * LEG.x, LEG.z], { rows: 1, capLo: true }), A)));
  out.push(mesh(shell(HIPS, 0.275, 0.3, 0.004, { rows: 1 }), A)); // 고무줄 띠 (티셔츠·잠바 아래끝보다 아래)
  for (const s of [1, -1]) for (let i = 0; i < 6; i++) { const th = (i / 6) * Math.PI * 2 + s, y = 0.1 + (i % 3) * 0.08, r = 0.072 + (y - 0.05) / 0.29 * 0.028; const d = at(new THREE.SphereGeometry(0.014, 6, 4), D, s * LEG.x + Math.cos(th) * r, y, LEG.z + Math.sin(th) * r * 1.06); out.push(d); }
  return G(out);
}
KIND_COVER.mombbe = COVER.long;

/* ---------- 베스트·잠바 칸 ---------- */
function vest2(mat, L) {
  const g = vest(mat, L), pad = L.puff ? 0.05 : 0.04;
  if (L.pockets > 4) { const A = mat('acc', L.acc); for (const s of [1, -1]) for (const [x, y] of [[0.075, 0.4], [0.14, 0.4], [0.075, 0.455], [0.14, 0.455], [0.1, 0.51], [0.155, 0.53]]) add(g, at(new RoundedBoxGeometry(0.05, 0.042, 0.02, 1, 0.006), A, s * x, y, frontZ(y, pad) - 0.006)); }
  if (L.studs) { const S = mat('stud', L.acc); for (const s of [1, -1]) for (let i = 0; i < 5; i++) { const y = 0.39 + i * 0.045; add(g, at(new THREE.ConeGeometry(0.01, 0.018, 5), S, s * 0.1, y, frontZ(y, pad) + 0.002).rotateX(Math.PI / 2)); } for (let i = -2; i <= 2; i++) add(g, at(new THREE.ConeGeometry(0.011, 0.02, 5), S, i * 0.06, 0.5, backZ(0.5, pad) - 0.004).rotateX(-Math.PI / 2)); }
  return g;
}
function jacket2(mat, L) {
  const g = jacket(mat, L), pad = L.puff ? 0.026 : 0.018;
  if (L.hem) { const M = mat('main', L.main); add(g, mesh(shell(HIPS, 0.25, 0.33, pad + 0.03, { rows: 2 }), side2(M))); } // 엉덩이를 덮는 긴 자락 (가랑이 위에서 끝나 걸을 때 다리를 뚫지 않음)
  if (L.goreum) { const A = mat('acc', L.acc), y = 0.47, z = frontZ(y, pad) + 0.004; const k = at(new THREE.SphereGeometry(0.02, 8, 6), A, 0.04, y, z); add(g, k, at(new THREE.BoxGeometry(0.025, 0.14, 0.008), A, 0.03, y - 0.075, z).rotateZ(0.12), at(new THREE.BoxGeometry(0.025, 0.11, 0.008), A, 0.06, y - 0.06, z).rotateZ(-0.2)); }
  return g;
}
function boxarmor(mat, L) { // 귤 상자 갑옷: 몸통을 감싼 골판지 상자 (팔 구멍) + 귤 그림 + 글씨 줄
  const M = mat('main', L.main), A = mat('acc', L.acc), I = mat('ink', L.ink);
  const b = at(new RoundedBoxGeometry(0.43, 0.3, 0.33, 2, 0.015), M, 0, 0.45, 0.035);
  return G(b, at(new THREE.CircleGeometry(0.055, 12), A, -0.07, 0.48, 0.205 + 0.002), at(new THREE.PlaneGeometry(0.14, 0.018), I, 0.06, 0.44, 0.207), at(new THREE.PlaneGeometry(0.1, 0.018), I, 0.05, 0.4, 0.207), at(new THREE.BoxGeometry(0.44, 0.012, 0.012), I, 0, 0.6, 0.2));
}
function basket(mat, L) { // 등에 멘 귤 바구니: 등 뒤 대나무 바구니 + 귤 다섯 + 어깨 끈
  const M = mat('main', L.main), A = mat('acc', L.acc), D = mat('rim', dark(L.main, 0.75)), z = backZ(0.47, 0.2), out = []; // 배낭보다 뒤
  const bk = at(new THREE.CylinderGeometry(0.15, 0.11, 0.24, 10, 2, true), side2(M), 0, 0.47, z); out.push(bk, at(new THREE.CircleGeometry(0.11, 10), M, 0, 0.35, z).rotateX(Math.PI / 2));
  const rim = at(new THREE.TorusGeometry(0.15, 0.014, 5, 14), D, 0, 0.59, z); rim.rotation.x = Math.PI / 2; out.push(rim, at(new THREE.TorusGeometry(0.135, 0.008, 4, 14), D, 0, 0.5, z).rotateX(Math.PI / 2));
  [[0, 0.6, 0], [0.07, 0.59, 0.05], [-0.07, 0.59, -0.04], [0.05, 0.6, -0.07], [-0.05, 0.62, 0.06]].forEach(([x, y, dz]) => out.push(at(new THREE.SphereGeometry(0.045, 8, 6), A, x, y, z + dz)));
  both((s) => out.push(at(new THREE.BoxGeometry(0.03, 0.22, 0.012), D, s * 0.1, 0.48, frontZ(0.48, 0.014)), at(new THREE.BoxGeometry(0.032, 0.012, 0.3), D, s * 0.1, 0.6, 0.01)));
  return G(out);
}

/* ---------- 양말 칸 ---------- */
function socks2(mat, L) {
  const g = socks(mat, L);
  if (L.toes) { for (const s of [1, -1]) for (let i = 0; i < 5; i++) add(g, at(new THREE.SphereGeometry(0.014, 6, 4), mat('toe' + i, RAIN[i]), s * LEG.x + (i - 2) * 0.018 * s, 0.022, LEG.z + 0.165)); }
  if (L.rainbow) { const h = 0.045 + ((L.h || 0.11) - 0.045) * 1.25; for (let i = 0; i < 6; i++) { const y = 0.04 + (h - 0.06) * i / 6, y1 = y + (h - 0.06) / 6, R = mat('rb' + i, RAIN[i]); add(g, both((s) => mesh(tube('y', y, y1, legR(y) + 0.01, legR(y1) + 0.01, [s * LEG.x, LEG.z], { rows: 1 }), R))); } }
  if (L.rim) { const A = mat('acc', L.acc); add(g, both((s) => { const t = at(new THREE.TorusGeometry(0.06, 0.008, 5, 14), A, s * LEG.x, 0.012, LEG.z + 0.06); t.rotation.x = Math.PI / 2; t.scale.set(1, 2.1, 1); return t; }), both((s) => { const t = at(new THREE.ConeGeometry(0.02, 0.05, 6), A, s * LEG.x, 0.014, LEG.z + 0.2); t.rotation.x = Math.PI / 2; return t; })); } /* 고무신 테·뾰족 코 */
  if (L.fur) { const F = mat('fur', L.acc), h = 0.045 + ((L.h || 0.11) - 0.045) * 1.25; add(g, both((s) => mesh(tube('y', h - 0.035, h, legR(h - 0.035) + 0.019, legR(h) + 0.018, [s * LEG.x, LEG.z], { rows: 1 }), F))); } // 털 테 (바지 안쪽에 들어가게 얇게)
  return g;
}
function oddsocks(mat, L) { // 짝짝이 양말: 왼쪽 main, 오른쪽 acc, 목 길이도 조금 다름
  const g = new THREE.Group(), out = [];
  [[1, 'main', L.main, L.h], [-1, 'other', L.acc, L.h - 0.03]].forEach(([s, n, c, hh]) => { const M = mat(n, c), h = 0.045 + (hh - 0.045) * 1.25, r = (y) => legR(y) + 0.009;
    out.push(mesh(tube('y', 0.02, h, r(0.04) - 0.003, r(h), [s * LEG.x, LEG.z], { rows: 3, capLo: true }), M), mesh(tube('y', h - 0.02, h, r(h - 0.02) + 0.004, r(h) + 0.004, [s * LEG.x, LEG.z], { rows: 1 }), mat('cuff', '#f6f4ee'))); });
  return add(g, out);
}

Object.assign(CLOTH_BUILD, {
  ...HATS, tee2, tank, mombbe, boxarmor, basket, oddsocks,
  long: pants2, shorts: pants2, vest: vest2, jacket: jacket2, socks: socks2,
});
