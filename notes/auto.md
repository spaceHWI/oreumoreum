# 자동 세션 규칙

예약 작업으로 뜬 세션이 이슈 하나를 끝까지 수행할 때 따른다. 사람이 지켜보지 않으므로 질문하지 않는다.

## 시작
1. `gh api repos/spaceHWI/oreumoreum/issues/<번호>` 로 이슈 본문과 코멘트를 읽는다. 기획 전체는 `notes/spec.md`, 코드 구조는 `notes/prototype-v1.md`
2. 최신 `dev` 에서 `work/<번호>-<짧은 이름>` 브랜치를 만든다
3. 앞 이슈에서 만든 코드를 먼저 읽고 그 위에 얹는다

## 만들 때
- 이슈에 적힌 것만 한다. 무관한 코드는 고치지 않는다
- 남송이오름 기준. 새 3D 오브젝트는 지금 그림체(`toon.js`, `namsongi.js` 재질)에 맞춘 로우폴리 임시 모양으로 만든다
- UI 는 `src/page.html` 의 현무암 UI 토큰을 쓴다. 글자는 최소로, 아이콘 중심. 폰(폭 600 이하)과 데스크톱 둘 다
- 저사양(LOW)에서도 프레임이 떨어지지 않게 한다
- 저장은 `save` + `persist()`. 예전 저장 데이터로 시작해도 오류가 없어야 한다
- 멀티는 붙이지 않는다. 다만 쓰레기 상태를 읽고 쓰는 부분은 한곳에 모아 나중에 서버로 바꾸기 쉽게 한다
- 수치는 한 파일(예: `src/balance.js`)에 모은다

## 확인
- `npm ci` 후 `node build.mjs` 통과
- `tools/err.js` 를 남송이 기준으로 돌려 페이지 오류가 없는지 확인 (필요하면 스크립트의 주소 해시를 고쳐 쓴다). 스크린샷은 꼭 필요할 때만, 작게
- 새 기능은 `window.__oreum` 으로 값을 넣어 보며 동작을 확인한다

## 끝
1. 커밋하고 `work/` 브랜치를 올린다: `git -c push.negotiate=true push -u origin <브랜치>`
2. 확인이 통과했으면 `dev` 에 합쳐 올린다 (`git checkout dev && git pull --ff-only origin dev && git merge --no-ff <브랜치> && git push origin dev`). 개발 서버에 자동 게시된다
3. `notes/prototype-v1.md` 에 새 모듈·결정 사항을 몇 줄 더한다 (2의 합치기 전에)
4. 이슈에 결과 코멘트(바꾼 것, dev 에서 확인하는 방법, 임시로 둔 것·남은 점)를 달고 이슈를 닫는다
5. 프롬프트에 다음 예약 작업 ID 가 있으면 `fire_trigger` 도구로 실행한다 (ToolSearch 로 `select:mcp__claude-code-remote__fire_trigger`). 도구가 없으면 넘어간다
- 확인이 통과하지 못하고 고칠 수 없으면: `dev` 에 합치지 않고, 이슈에 막힌 점을 코멘트로 남기고, 이슈를 닫지 않고, 다음 작업도 실행하지 않는다
- `release`·`main` 은 건드리지 않는다. PR 은 만들지 않는다
- 답변은 한글로 짧게
