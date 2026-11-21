// 줄 중간 주석 검사 (#193). build.mjs 가 먼저 부르고, 걸리면 빌드가 멈춘다. 따로: node tools/lint.js
// 막는 것
//  1) 줄 주석(//) 안에 코드로 보이는 것이 이어짐: 문장 여러 개를 한 줄에 이어 쓴 곳 중간에 // 를 넣으면 그 뒤 문장이 모두 주석이 된다 (#182·#129 사고)
//  2) 300자 넘는 줄의 줄 주석: 긴 줄에는 /* */ 만 쓴다
// 글자 단위로 읽어 문자열·템플릿·정규식·블록 주석 안의 // (URL 의 :// 포함)는 주석으로 치지 않는다
// 어떤 주석이 '코드로 보이나' 는 esbuild 로 주석 글을 JS 로 읽어 보아 정한다: 읽히고, 문장 끝 ; 뒤에 또 무엇이 있거나
// if/for/대입/함수 부르기 문장이면 코드. 한글 설명은 대개 JS 로 읽히지 않아 걸리지 않는다
// 정말 코드 같은 설명을 써야 하면 /* */ 로 쓴다
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const MAX = 300;
const ROOTS = ['src', 'server/src'];

// 정규식이 올 수 있는 자리인지: 앞의 의미 있는 글자/낱말로 판단
const KW_BEFORE_RE = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
function regexAllowed(src, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(src[j])) j--;
  if (j < 0) return true;
  const c = src[j];
  if (/[A-Za-z0-9_$]/.test(c)) {
    let k = j; while (k >= 0 && /[A-Za-z0-9_$]/.test(src[k])) k--;
    return KW_BEFORE_RE.has(src.slice(k + 1, j + 1));
  }
  if (c === ')' || c === ']' || c === '}') return false; // ) / 는 나눗셈으로 본다 (if (x) /re/ 는 드묾)
  return true;
}

// 줄 주석 목록: { line, col, text, lineLen }
function lineComments(src) {
  const out = [];
  let i = 0, line = 1;
  const stack = []; // 템플릿 ${ } 깊이
  let lineStart = 0;
  const n = src.length;
  const nl = () => { line++; lineStart = i + 1; };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '\n') { nl(); i++; continue; }
    if (c === '/' && d === '/') {
      let e = src.indexOf('\n', i); if (e < 0) e = n;
      let le = e; // 줄 길이
      out.push({ line, col: i - lineStart, text: src.slice(i + 2, e), lineLen: le - lineStart, trailing: src.slice(lineStart, i).trim() !== '' });
      i = e; continue;
    }
    if (c === '/' && d === '*') {
      const e = src.indexOf('*/', i + 2); const end = e < 0 ? n : e + 2;
      for (let k = i; k < end; k++) if (src[k] === '\n') { line++; lineStart = k + 1; }
      i = end; continue;
    }
    if (c === '"' || c === "'") {
      i++;
      while (i < n && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') i++; i++; }
      i++; continue;
    }
    if (c === '`') { i++; i = tmpl(i); continue; }
    if (c === '{') { if (stack.length) stack[stack.length - 1]++; i++; continue; }
    if (c === '}') {
      i++;
      if (stack.length) { if (stack[stack.length - 1] > 0) stack[stack.length - 1]--; else { stack.pop(); i = tmpl(i); } }
      continue;
    }
    if (c === '/' && regexAllowed(src, i)) {
      i++; let cls = false;
      while (i < n && src[i] !== '\n') {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false;
        else if (src[i] === '/' && !cls) break;
        i++;
      }
      i++; continue;
    }
    i++;
  }
  return out;
  // 템플릿 글 안을 건너뜀. ${ 를 만나면 코드로 돌아가고 스택에 표시
  function tmpl(k) {
    while (k < n) {
      if (src[k] === '\\') { k += 2; continue; }
      if (src[k] === '\n') { line++; lineStart = k + 1; }
      if (src[k] === '`') return k + 1;
      if (src[k] === '$' && src[k + 1] === '{') { stack.push(0); return k + 2; }
      k++;
    }
    return k;
  }
}

// 주석 글이 코드로 보이나
function looksLikeCode(t) {
  const s = t.trim();
  if (!s || !/[;(=]/.test(s)) return false;
  const bare = s.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""');
  if (/[)\]\w$]\s*;\s*(if\s*\(|[A-Za-z_$][\w$.]*\s*(\(|\+\+|--|[-+*/|&]?=[^=]))/.test(bare)) return true; // 문장 ; 문장 (한글 설명 뒤라도)
  if (/[\w$\]]\s*(\(.*\)|\+\+|--)\s*;\s*$/.test(bare)) return true; // 끝이 '문장;' (설명 foo(); · tk.n++;)
  if (/[가-힣]/.test(bare)) return false; // 따옴표 밖에 한글이 있으면 설명
  let code;
  try { code = esbuild.transformSync(s, { loader: 'js', minify: false, logLevel: 'silent' }).code.trim(); } catch { return false; }
  if (!code) return false;
  const stmts = code.split('\n').filter((x) => x.trim());
  if (stmts.length >= 2) return true; // 문장 여럿
  return /^(if|for|while|switch|return|const|let|var)\b/.test(code) || /^[\w$.\[\]'"]+\s*[-+*/|&]?=[^=]/.test(code) || /\)\s*;?$/.test(code) && /^[\w$.]+\(/.test(code);
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
    else if (/\.(m?js)$/.test(e.name)) out.push(p);
  }
  return out;
}

function lintSource(src, file = '(글)') {
  const errs = [];
  for (const c of lineComments(src)) {
    if (!c.trailing) continue;
    if (c.lineLen > MAX) errs.push(`${file}:${c.line}:${c.col + 1} ${c.lineLen}자 줄에 // 주석 — /* */ 로 쓰거나 줄을 나눈다`);
    else if (looksLikeCode(c.text)) errs.push(`${file}:${c.line}:${c.col + 1} // 주석 안에 코드: "${c.text.trim().slice(0, 80)}" — 줄을 나누거나 /* */ 로`);
  }
  return errs;
}

function lintAll(root = process.cwd()) {
  const files = ROOTS.flatMap((r) => walk(path.join(root, r), []));
  const errs = [];
  for (const f of files) errs.push(...lintSource(fs.readFileSync(f, 'utf8'), path.relative(root, f)));
  return errs;
}

// 검사 자체의 검사: 걸러야 할 것·걸러지면 안 되는 것
function selfTest() {
  const bad = [
    'a(); b(); // 설명 c(); d();',
    'a(); // x\nb();'.replace('x', 'tut.update(dt); camBack();'),
    'x = 1; // if (y) z();',
    'a(); ' + 'b(); '.repeat(70) + '// 긴 줄 주석',
    'a(); // 설명 tk.tut++;',
    'a(); // 지붕 간판 크기·밤빛 (#182) tickCartMark(); if (STN) tickMeal(dt);', /* #182 사고 그대로 */
    'x(); // 손맛 late.throwAct();', /* #129 사고 비슷하게 */
  ];
  const good = [
    'const u = "https://a.b/c"; a();',
    'const r = /\\/\\/x/g; a();',
    'const t = `http://${h}/x`; a();',
    'a(); /* tut.update(dt); */ b();',
    'a(); // 튜토리얼 진행 (foo() 를 부름)',
    'a(); // 2단계 — x = 3 일 때',
    'x = y / 2; // 반으로',
    '// 맨 앞 주석 a(); b();',
    'a(); // 반쯤 (0.5)',
    'a(); // #141: 숫자·흙먼지',
  ];
  const fails = [];
  for (const s of bad) if (!lintSource(s).length) fails.push('놓침: ' + s.slice(0, 60));
  for (const s of good) { const e = lintSource(s); if (e.length) fails.push('잘못 잡음: ' + s.slice(0, 60) + ' → ' + e[0]); }
  return fails;
}

module.exports = { lintAll, lintSource, selfTest, lineComments };

if (require.main === module) {
  const st = selfTest();
  if (st.length) { console.log('lint 자체 검사 실패\n' + st.join('\n')); process.exit(1); }
  const errs = lintAll();
  if (errs.length) { console.log(errs.join('\n') + `\n줄 주석 검사: ${errs.length}곳`); process.exit(1); }
  console.log('줄 주석 검사 ok');
}
