(function () {
  var cs = document.currentScript, mainSrc = cs && cs.getAttribute('data-main');
  window.__loadMain = function () { if (!mainSrc) return; var m = document.createElement('script'); m.src = mainSrc; document.body.appendChild(m); mainSrc = ''; };
  var ua = navigator.userAgent || '';
  var kakao = /KAKAOTALK/i.test(ua);
  var other = /Instagram|FBAN|FBAV|NAVER\(inapp|Line\//i.test(ua);
  if (!kakao && !other) { window.__loadMain(); return; }
  window.__inapp = true;
  var url = location.href, ios = /iPhone|iPad|iPod/i.test(ua), android = /Android/i.test(ua);
  var box = document.getElementById('inapp');
  var kakaoUrl = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
  var chromeUrl = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end';
  window.__inappUrls = { kakao: kakaoUrl, chrome: chromeUrl };
  function go() {
    if (kakao) { location.href = kakaoUrl; if (android) setTimeout(function () { location.href = chromeUrl; }, 1200); }
    else if (android) location.href = chromeUrl;
  }
  box.hidden = false;
  if (ios) document.getElementById('inapp-ios').hidden = false;
  document.getElementById('inapp-open').onclick = go;
  document.getElementById('inapp-copy').onclick = function () {
    var b = this, done = function () { b.textContent = '복사했어요'; };
    try { navigator.clipboard.writeText(url).then(done, fb); } catch (e) { fb(); }
    function fb() { var t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) {} t.remove(); }
  };
  document.getElementById('inapp-stay').onclick = function () {
    box.hidden = true; window.__inapp = false; window.__loadMain();
  };
  if (kakao) go(); // 카카오톡만 자동으로 넘긴다
})();
