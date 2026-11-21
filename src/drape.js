// 바닥 표시가 땅에 묻히지 않게 (#151): 평평한 고리·원(XZ 평면, y=0 으로 만든 지오메트리)의 점마다 땅 높이를 읽어 지형을 따라 휘게 함.
// 쓰는 곳: 튜토리얼 목표 원, 가는 곳 표시(marker), 타겟 고리(aimMark #148), 줍기 고리(pickMark #104), 돌진 조짐 고리(enemies)
// mesh 는 자기 지오메트리를 가져야 함(나눠 쓰는 지오메트리면 clone 해서 넘김). 같은 자리·크기·방향이면 다시 계산하지 않음
export const DRAPE_LIFT = 0.06; // 땅에서 띄우는 높이(m)

export function drape(mesh, height, lift = DRAPE_LIFT) {
  const pos = mesh.geometry.attributes.position, n = pos.count, base = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { base[i * 2] = pos.getX(i); base[i * 2 + 1] = pos.getZ(i); }
  let kx = NaN, kz = 0, ks = 0, kr = 0, ky = 0;
  // (x, z) 에 크기 s, y 축 회전 r 로 놓음. yb: 고리 기준 높이(없으면 가운데 땅 높이). up: 더 띄울 높이
  return function place(x, z, s = 1, r = 0, up = 0) {
    mesh.position.x = x; mesh.position.z = z; mesh.rotation.y = r; mesh.scale.set(1, 1, 1);
    if (x === kx && z === kz && s === ks && r === kr && up === ky) return;
    kx = x; kz = z; ks = s; kr = r; ky = up;
    const y0 = height(x, z); mesh.position.y = y0;
    const c = Math.cos(r), sn = Math.sin(r);
    for (let i = 0; i < n; i++) {
      const lx = base[i * 2] * s, lz = base[i * 2 + 1] * s;
      const wx = lx * c + lz * sn, wz = -lx * sn + lz * c; // rotation.y 로 돌린 뒤의 세상 좌표
      pos.setXYZ(i, lx, height(x + wx, z + wz) - y0 + lift + up, lz);
    }
    pos.needsUpdate = true; mesh.geometry.computeBoundingSphere();
  };
}
