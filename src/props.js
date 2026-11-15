import * as THREE from 'three';
import { TEXCS } from './boot.js';

export const SIGN_TEXT = `
<p class="sign-eyebrow">제주특별자치도 제주시 구좌읍 세화리 · 송당리</p>
<h2>다랑쉬오름 <small>月郞峰 · Darangswi Oreum</small></h2>
<p>표고 382.4m · 비고 227m · 둘레 3,391m · 굼부리 깊이 115m</p>
<p>'오름의 여왕'이라 불릴 만큼 매끈한 원뿔 모양을 가진 오름이에요. 정상의 굼부리(분화구)는 한라산 백록담과 깊이가 비슷하고, 둘레를 따라 한 바퀴 돌 수 있는 길이 나 있어요.</p>
<p>'다랑쉬'는 산봉우리 위로 쟁반 같은 달이 떠오르는 모습에서 왔다는 이야기가 전해져요. 굼부리 둘레를 걸으면 동쪽으로 성산일출봉과 바다, 서쪽으로 한라산, 발아래로 아끈다랑쉬오름이 보여요.</p>
<p class="muted">탐방로는 억새밭 사이 송이길과 나무 계단으로 이어지고, 정상까지는 보통 20~30분이 걸려요. 비 온 뒤에는 송이길이 미끄러우니 천천히 걸어 주세요.</p>
<ul class="sign-tips">
  <li>굼부리 둘레길은 한 바퀴가 한 바퀴로 세어져요</li>
  <li>돌탑에는 1인당 돌 하나를 얹을 수 있어요</li>
  <li>정상석에서는 줄을 서서 차례대로 인증샷을 찍어요</li>
</ul>`;

export function buildSign(board) {
  const B = board || { title: '다랑쉬오름', sub: '月郞峰 · 표고 382.4m · 비고 227m', l1: '굼부리 깊이 115m · 둘레 3.4km', go: '▲ 탐방로 입구  ·  정상까지 약 25분' };
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: '#7a5636', flatShading: true });
  const c = document.createElement('canvas'); c.width = 512; c.height = 320;
  const x = c.getContext('2d');
  x.fillStyle = '#3f5a2f'; x.fillRect(0, 0, 512, 320);
  x.fillStyle = '#fbf6e6'; x.fillRect(14, 14, 484, 292);
  x.fillStyle = '#33402a'; x.textAlign = 'left'; x.textBaseline = 'top';
  x.font = 'bold 54px sans-serif'; x.fillText(B.title, 34, 36);
  x.font = '26px sans-serif'; x.fillText(B.sub, 34, 104);
  x.fillText(B.l1, 34, 142);
  x.fillStyle = '#9c4a33'; x.font = 'bold 26px sans-serif'; x.fillText(B.go, 34, 200);
  x.fillStyle = '#5d6a4f'; x.font = '22px sans-serif'; x.fillText('가까이 가서 상호작용을 누르면 설명이 떠요', 34, 250);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = TEXCS;
  const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.0, 0.12), [wood, wood, wood, wood, new THREE.MeshLambertMaterial({ map: tx }), wood]);
  boardMesh.position.y = 2.1; boardMesh.castShadow = true; g.add(boardMesh);
  [-1.3, 1.3].forEach((px) => { const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 0.16), wood); post.position.set(px, 1.3, -0.1); post.castShadow = true; g.add(post); });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 0.5), wood); roof.position.set(0, 3.18, 0.1); roof.rotation.x = 0.25; g.add(roof);
  return g;
}
