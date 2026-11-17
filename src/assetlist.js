// 따로 받는 모델 파일 목록 (#85). build.mjs 가 빌드할 때 이 파일 내용을 바꿔 끼운다 (esbuild 플러그인)
//   Pages(index.html): { 이름: { url: 'a/stone-해시.bin', meta } }  · 한 파일(oreumoreum.html·test.html): { 이름: { b64, meta } }
// meta 는 받기 전에도 알아야 하는 것(크기 bbox 등 → 임시 모양)
export const ASSETS = {};
