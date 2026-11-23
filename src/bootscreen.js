/* 로딩 창 (#281): 페이지가 열리면 바로 덮고(page.html #boot, 인라인 CSS), 첫 그림이 온전히 그려진 뒤 0.4초에 걸쳐 걷는다.
   빌드(build.mjs)가 inapp.js 앞에 붙여 맨 처음 도는 인라인 스크립트로 넣는다. 게임 쪽은 src/bootbar.js 로 부른다.
   window.__boot: p(값, 천천히 올라갈 끝) · fetchMain(주소, 다 되면) · ready() · fail() · show(글) · state() */
(function () {
  var el = document.getElementById('boot'); if (!el) return;
  var bar = document.getElementById('boot-bar'), wit = document.getElementById('boot-wit'), slow = document.getElementById('boot-slow'), retry = document.getElementById('boot-retry');
  var WITS = ['귤 닦는 중…', '오름지기 깨우는 중…', '억새 빗질하는 중…', '돌하르방 모자 고쳐 씌우는 중…', '바람 방향 맞추는 중…', '클린하우스 문 여는 중…', '현무암 구멍 세는 중…', '노루에게 길 묻는 중…'];
  var t0 = Date.now(), floor = 3, cap = 40, shown = 0, done = false, failed = false, wi = Math.floor(Math.random() * WITS.length), log = [];
  function note(s) { log.push(Math.round((Date.now() - t0) / 100) / 10 + 's ' + s); if (log.length > 20) log.shift(); }
  function draw() { if (bar) bar.style.transform = 'scaleX(' + (shown / 100).toFixed(3) + ')'; el.setAttribute('aria-valuenow', String(Math.round(shown))); }
  function setWit() { if (wit) wit.textContent = WITS[wi % WITS.length]; wi++; }
  setWit();
  var witT = setInterval(function () { if (done) return; setWit(); }, 3000);
  /* 막대: 단계가 정한 floor 아래로는 안 내려가고, 기다리는 동안 cap 쪽으로 천천히 다가감 */
  var tickT = setInterval(function () {
    if (done) return;
    var s = (Date.now() - t0) / 1000;
    if (!failed) {
      if (s > 10 && slow) slow.hidden = false;
      if (s > 30 && retry) retry.hidden = false;
    }
    if (floor < cap) floor += (cap - floor) * 0.02;
    shown += (Math.max(shown, floor) - shown) * 0.25;
    draw();
  }, 100);
  if (retry) retry.onclick = function () { location.reload(); };
  function p(v, c) { if (done) return; v = +v || 0; if (v > floor) floor = Math.min(99, v); cap = Math.max(floor, Math.min(99, c == null ? floor : +c)); note('p ' + Math.round(v)); }
  function ready() {
    if (done) return; done = true; note('ready');
    clearInterval(witT); clearInterval(tickT);
    shown = 100; draw();
    el.classList.add('off');
    setTimeout(function () { if (done) el.hidden = true; }, 450);
  }
  /* 받기 실패: 지금 오류 안내(오류 알림)는 그대로 두고, 여기서는 다시 시도 단추만 바로 */
  function fail() { failed = true; note('fail'); if (slow) { slow.textContent = '불러오지 못했어요'; slow.hidden = false; } if (retry) retry.hidden = false; }
  /* 다시 받기 직전(새 버전·로그인·로그아웃): 같은 창을 다시 덮어 흰 화면이 끼지 않게 */
  function show(text) {
    done = false; failed = false; el.hidden = false; el.classList.remove('off');
    if (wit) wit.textContent = text || '불러오는 중…';
    if (slow) slow.hidden = true; if (retry) retry.hidden = true;
    shown = floor = 100; cap = 100; draw(); note('show');
  }
  /* 게임 코드(main-해시.js) 받기: 받은 양을 막대로. 받은 것은 브라우저 캐시에 남아 바로 이어 붙는 스크립트 태그가 다시 받지 않음 */
  function fetchMain(src, run) {
    var go = function () { if (run) { var r = run; run = null; r(); } };
    if (!window.fetch || !window.ReadableStream) { p(5, 38); go(); return; }
    fetch(src).then(function (r) {
      if (!r.ok || !r.body) { go(); return; }
      var total = +r.headers.get('content-length') || 0, got = 0, rd = r.body.getReader();
      if (!total) p(5, 38);
      (function pump() {
        rd.read().then(function (x) {
          if (x.done) { p(40, 58); go(); return; }
          got += x.value.length; if (total) p(3 + 37 * Math.min(1, got / total), 40);
          pump();
        }, go);
      })();
    }, go);
  }
  window.__boot = { p: p, ready: ready, fail: fail, show: show, fetchMain: fetchMain, state: function () { return { done: done, shown: Math.round(shown), floor: Math.round(floor), cap: Math.round(cap), hidden: el.hidden, slow: slow ? !slow.hidden : false, retry: retry ? !retry.hidden : false, wit: wit ? wit.textContent : '', ms: Date.now() - t0, log: log.slice() }; } };
  draw();
})();
