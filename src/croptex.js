// 크롭서클 무늬 그림 (#212 game/traces.js, #246 사건 1 game/caseprops.js 가 같이 씀): 분리수거 화살표 셋을 닮은 둥근 무늬. 256px 캔버스 → 텍스처
import * as THREE from 'three';

export function cropTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), m = 128;
  g.clearRect(0, 0, 256, 256); g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = 'rgba(214,224,150,1)'; g.lineWidth = 12; g.beginPath(); g.arc(m, m, 118, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 5; g.beginPath(); g.arc(m, m, 104, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 3; i++) { /* 화살표 셋이 서로 쫓는 삼각형 */
    const a0 = -Math.PI / 2 + i * Math.PI * 2 / 3, a1 = a0 + Math.PI * 2 / 3, r = 62;
    const p0 = [m + Math.cos(a0 + 0.32) * r, m + Math.sin(a0 + 0.32) * r], p1 = [m + Math.cos(a1 - 0.32) * r, m + Math.sin(a1 - 0.32) * r];
    g.lineWidth = 18; g.beginPath(); g.moveTo(...p0); g.lineTo(...p1); g.stroke();
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
    g.fillStyle = 'rgba(214,224,150,1)'; g.beginPath();
    g.moveTo(p1[0] + ux * 22, p1[1] + uy * 22); g.lineTo(p1[0] - uy * 22, p1[1] + ux * 22); g.lineTo(p1[0] + uy * 22, p1[1] - ux * 22); g.closePath(); g.fill();
  }
  g.fillStyle = 'rgba(214,224,150,1)'; g.beginPath(); g.arc(m, m, 14, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
