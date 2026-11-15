import * as THREE from 'three';

// 가로등: 밤에 길을 밝힘. 기둥·갓은 인스턴스, 바닥 빛웅덩이는 가산 혼합 원판,
// 실제 광원(PointLight)은 가까운 3개에만 붙여 돌려 씀 (수십 개를 켜면 무거움)
export function createLamps({ scene, positions, height }) {
  const n = positions.length;
  const post = new THREE.CylinderGeometry(0.08, 0.12, 3.6, 6); post.translate(0, 1.8, 0);
  const arm = new THREE.BoxGeometry(0.1, 0.1, 0.9); arm.translate(0, 3.55, 0.4);
  const shade = new THREE.ConeGeometry(0.42, 0.3, 8, 1, true); shade.translate(0, 3.5, 0.8); shade.rotateX(Math.PI);
  const bulb = new THREE.SphereGeometry(0.16, 8, 6); bulb.translate(0, 3.38, 0.8);
  const dark = new THREE.MeshLambertMaterial({ color: '#4a4a46', flatShading: true });
  const bulbMat = new THREE.MeshLambertMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 0 });
  const poolGeo = new THREE.PlaneGeometry(9, 9); poolGeo.rotateX(-Math.PI / 2);
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,215,140,1)'); gr.addColorStop(0.45, 'rgba(255,200,120,0.45)'); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const mk = (geo, mat) => { const im = new THREE.InstancedMesh(geo, mat, n); im.castShadow = geo === post; scene.add(im); return im; };
  const posts = mk(post, dark), arms = mk(arm, dark), shades = mk(shade, dark), bulbs = mk(bulb, bulbMat), pools = mk(poolGeo, poolMat);
  pools.renderOrder = 2;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  const pts = positions.map(([x, z, ry]) => new THREE.Vector3(x, height(x, z), z));
  pts.forEach((p, i) => {
    const ry = positions[i][2] || 0; e.set(0, ry, 0); q.setFromEuler(e);
    m.compose(p, q, one); posts.setMatrixAt(i, m); arms.setMatrixAt(i, m); shades.setMatrixAt(i, m); bulbs.setMatrixAt(i, m);
    const pp = p.clone(); pp.x += Math.sin(ry) * 0.8; pp.z += Math.cos(ry) * 0.8; pp.y += 0.08;
    m.compose(pp, q, one); pools.setMatrixAt(i, m);
  });
  const lights = Array.from({ length: 3 }, () => { const l = new THREE.PointLight('#ffd08a', 0, 16, 2); l.visible = false; scene.add(l); return l; });
  let night = 0;
  function update(playerPos, nightK) {
    night = nightK;
    bulbMat.emissiveIntensity = nightK * 1.4; poolMat.opacity = nightK * 0.5;
    if (nightK < 0.02) { lights.forEach((l) => { l.visible = false; }); return; }
    // 가까운 3개
    const near = pts.map((p, i) => [p.distanceToSquared(playerPos), i]).sort((a, b) => a[0] - b[0]).slice(0, 3);
    lights.forEach((l, k) => {
      const hit = near[k]; if (!hit || hit[0] > 60 * 60) { l.visible = false; return; }
      const p = pts[hit[1]]; const ry = positions[hit[1]][2] || 0;
      l.position.set(p.x + Math.sin(ry) * 0.8, p.y + 3.3, p.z + Math.cos(ry) * 0.8);
      l.intensity = 26 * nightK; l.visible = true;
    });
  }
  return { update, points: pts };
}
