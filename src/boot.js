// 가장 먼저 불러와야 하는 모듈: 어떤 맵인지 정하고, 남송이오름(새 그림체)이면 색 관리를 끈다.
// 새 그림체는 색을 화면 값 그대로 다루는 방식으로 만들었기 때문 (시안과 같은 색이 나오게)
import * as THREE from 'three';
export const MAP_IDS = ['namsongi', 'gate', 'darangswi', 'donnaeko'];
const h = (typeof location !== 'undefined' ? location.hash || '' : '').replace('#', '').split('&')[0];
export const MAP_ID = MAP_IDS.includes(h) ? h : 'namsongi'; // 예전 맵은 주소 해시(#darangswi 등)로만
export const NSMODE = MAP_ID === 'namsongi';
if (NSMODE) THREE.ColorManagement.enabled = false;
export const TEXCS = NSMODE ? THREE.NoColorSpace : THREE.SRGBColorSpace;
export const LIGHT_K = NSMODE ? Math.PI : 1; // 예전 three 기준 빛 세기를 지금 단위로
