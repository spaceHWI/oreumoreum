(function () {
  var cs = document.currentScript, mainSrc = cs && cs.getAttribute('data-main');
  window.__loadMain = function () { if (!mainSrc) return; var m = document.createElement('script'); m.src = mainSrc; document.body.appendChild(m); mainSrc = ''; };
  var ua = navigator.userAgent || '';
  /* 앱별 안내 표 (#239): re=UA 판별, name=앱 이름, steps=따라 하기 단계, auto=자동으로 넘기는 앱 */
  var APPS = [
    { id: 'kakao', re: /KAKAOTALK/i, name: '카카오톡', auto: true, steps: ['오른쪽 아래 공유 아이콘 누르기', "'다른 브라우저로 열기' 누르기"] },
    { id: 'insta', re: /Instagram/i, name: '인스타그램', steps: ['오른쪽 위 ⋯ 누르기', "'외부 브라우저에서 열기' 누르기"] },
    { id: 'fb', re: /FBAN|FBAV/i, name: '페이스북', steps: ['오른쪽 위(또는 아래) ⋯ 누르기', "'외부 브라우저에서 열기' 누르기"] },
    { id: 'naver', re: /NAVER\(inapp/i, name: '네이버 앱', steps: ['아래쪽 ≡ 또는 ⋮ 누르기', "'기본 브라우저로 열기' 누르기"] },
    { id: 'line', re: /Line\//i, name: '라인', steps: ['오른쪽 위 ⋮ 누르기', "'다른 앱으로 열기' 또는 '기본 브라우저로 열기' 누르기"] }
  ];
  var app = null;
  for (var i = 0; i < APPS.length; i++) if (APPS[i].re.test(ua)) { app = APPS[i]; break; }
  if (!app) { window.__loadMain(); return; }
  window.__inapp = true;
  var url = location.href, ios = /iPhone|iPad|iPod/i.test(ua), android = /Android/i.test(ua);
  var box = document.getElementById('inapp');
  var kakaoUrl = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
  var chromeUrl = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end';
  window.__inappUrls = { kakao: kakaoUrl, chrome: chromeUrl };
  var kakao = app.id === 'kakao';
  var canGo = kakao || android; /* 아이폰의 인스타그램·페이스북 등은 앱이 직접 못 넘긴다 */
  function go() {
    if (kakao) { location.href = kakaoUrl; if (android) setTimeout(function () { location.href = chromeUrl; }, 1200); }
    else if (android) location.href = chromeUrl;
  }
  document.getElementById('inapp-title').textContent = app.name + ' 안에서는 잘 안 돼요';
  var ol = document.getElementById('inapp-steps');
  app.steps.forEach(function (t, n) {
    var li = document.createElement('li'); li.style.cssText = 'margin:0 0 8px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.08)';
    li.textContent = (n + 1) + '. ' + t; ol.appendChild(li);
  });
  var openBtn = document.getElementById('inapp-open');
  if (!canGo) openBtn.style.display = 'none'; else openBtn.textContent = ios ? '사파리로 열기' : '크롬으로 열기';
  box.hidden = false;
  openBtn.onclick = go;
  document.getElementById('inapp-copy').onclick = function () {
    var b = this, done = function () { b.textContent = '복사했어요'; };
    try { navigator.clipboard.writeText(url).then(done, fb); } catch (e) { fb(); }
    function fb() { var t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) {} t.remove(); }
  };
  document.getElementById('inapp-stay').onclick = function () {
    box.hidden = true; window.__inapp = false; window.__loadMain();
  };
  if (kakao) go(); /* 카카오톡만 자동으로 넘긴다 */
})();
