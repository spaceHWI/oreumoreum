# 오름오름

제주 오름을 걷고 달리는 웹 게임. three.js 0.170, HTML 한 파일로 빌드.

```
npm ci
node build.mjs          # dist/index.html (브라우저에서 바로 열기), dist/oreumoreum.html (claude.ai 아티팩트용)
```

## 브랜치와 서버
| 브랜치 | 쓰임 | 주소 |
|---|---|---|
| `work/<이름>` | 세션 하나의 작업 | 없음 |
| `dev` | 개발 서버 소스. 올리면 자동 게시 | https://spacehwi.github.io/oreumoreum/dev/ |
| `release` | 실서버 소스. dev 를 합쳐 올리면 자동 게시 | https://spacehwi.github.io/oreumoreum/ |
| `main` | 게시물만 (Actions 가 씀). 직접 고치지 않음 | |

작업 규칙은 `notes/auto.md`, 기획은 `notes/spec.md`, 구조와 결정은 `notes/prototype-v1.md`.

## 폴더
- `src/` 게임 소스 (`main.js` 가 진입점, `boot.js` 가 맨 먼저)
- `tools/` 확인용 스크립트 (playwright 필요): `view.js` 위치·시간별 스크린샷, `uishot.js` UI, `err.js` 오류, `tris.js` 삼각형 수
- `model/` 캐릭터 모델 파이프라인 (`lo4.glb` 가 지금 모델, `extract.js` 로 `src/runnermodel.js` 생성)
- `sian/` 시안 소스, `proto/` 초기 그래픽 시안
