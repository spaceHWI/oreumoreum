# 쪽지 그림 (#199)

쪽지 창(`src/game/noteview.js`)이 종이 위쪽에 테이프로 붙인 듯 보여 주는 그림.

- 파일 이름: `<쪽지 id>.webp` (예: `n1c.webp`). id 는 `src/punktext.js` 의 `NOTES`
- 512px 안팎 정사각, webp. 그림체는 `notes/style-kit.md`
- 넣은 뒤 그 쪽지에 `img: true` 를 단다 (안 달면 종이만 보임)
- 빌드가 `dist/assets/notes/` 로 복사하고, 게시(publish.yml)가 `assets/` 로 올린다. 창을 열 때만 받는다
