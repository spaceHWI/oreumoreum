// 오류 자리 찾기 (#122): node tools/crashmap.js <버전> <main-해시.js:줄:칸> [--keep]
// 실서버 오류 알림(/crashes)의 '@ 자리' 를 원래 파일·줄·함수 이름으로 바꿔 준다
// 1. 버전 → 커밋: src/version.js 를 VERSION = '<버전>' 으로 바꾼 커밋을 git log -S 로 찾고(태그 없이), 그 버전이었던 커밋들을 후보로 삼음
// 2. 후보마다 임시 worktree 에서 그 커밋의 build.mjs 를 소스맵을 켜고(esbuild 만 감싸서) DEV=1(dev)·PUBLIC=1(release) 로 다시 빌드,
//    main-해시가 같은 빌드를 찾음 (같은 것이 없으면 그렇다고 알리고 가장 최근 후보로 짐작)
// 3. 소스맵으로 원래 파일·줄·칸, 그 자리 이름, 감싼 함수 이름, 원래 줄을 보여 줌
// 소스맵은 임시 폴더에만 만들고 dist·게시물에는 넣지 않는다. 얕게 받은 저장소면 먼저 전체 기록을 받는다
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const { SourceMap } = require('module');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const KEEP = process.argv.includes('--keep');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }).trim();
const tryGit = (...a) => { try { return git(...a); } catch (e) { return null; } };
const die = (m) => { console.log(m); process.exit(1); };

const [ver, spot0] = args;
if (!ver || !spot0) die('쓰는 법: node tools/crashmap.js <버전> <main-해시.js:줄:칸>\n  예: node tools/crashmap.js 0.23.3 main-b04ab00a41.js:1:23456   (/crashes 의 text 를 통째로 넣어도 됨)');
const sm = String(spot0).match(/(main-([0-9a-f]+)\.js):(\d+):(\d+)/);
if (!sm) die(`자리에서 main-해시.js:줄:칸 을 찾지 못함: ${spot0}`);
const [, file, want, line, col] = sm;

// 1. 기록 받기 (얕은 저장소면 전체)
if (tryGit('rev-parse', '--is-shallow-repository') === 'true') {
  console.log('얕게 받은 저장소라 전체 기록을 받음…');
  tryGit('fetch', '--unshallow', '--quiet', 'origin', '+refs/heads/*:refs/remotes/origin/*');
} else tryGit('fetch', '--quiet', 'origin', '+refs/heads/*:refs/remotes/origin/*');

const needle = `VERSION = '${ver}'`;
const intro = (tryGit('log', '--all', '--format=%H', '-S' + needle, '--', 'src/version.js') || '').split('\n').filter(Boolean)
  .filter((c) => (tryGit('show', `${c}:src/version.js`) || '').includes(needle));
if (!intro.length) die(`버전 ${ver} 을 넣은 커밋을 찾지 못함 (src/version.js 에 ${needle} 가 들어간 커밋 없음)`);
console.log(`버전 ${ver} 을 넣은 커밋: ${intro.map((c) => c.slice(0, 7)).join(', ')}`);

// 그 버전이었던 커밋들 (최근 것부터). 빌드에 들어가는 것이 같은 커밋은 하나만
const seen = new Set(), cands = [];
const after = tryGit('rev-list', '--all', '--date-order', ...intro.filter((i) => tryGit('rev-parse', '--verify', '--quiet', i + '^')).map((i) => '^' + i + '^')) || '';
for (const c of after.split('\n').concat(intro)) {
  if (!c || cands.includes(c)) continue;
  if (!(tryGit('show', `${c}:src/version.js`) || '').includes(needle)) continue;
  const k = ['src', 'build.mjs', 'tools', 'package-lock.json'].map((p) => tryGit('rev-parse', `${c}:${p}`) || '-').join('|');
  if (seen.has(k)) continue; seen.add(k); cands.push(c);
}
console.log(`후보 커밋 ${cands.length}개 (빌드 입력이 다른 것만)`);

// esbuild 를 감싸 소스맵을 켜는 머리말: 코드는 같고 끝의 sourceMappingURL 주석만 떼어 원래 해시가 그대로 나오게
const WRAP = `import * as esbuild0 from 'esbuild';
import __fs from 'fs'; import __crypto from 'crypto';
const __maps = [];
const esbuild = { ...esbuild0, build: async (o) => {
  const r = await esbuild0.build({ ...o, sourcemap: 'external', outfile: 'main.js', sourcesContent: true });
  const js = r.outputFiles.find((f) => f.path.endsWith('.js')), map = r.outputFiles.find((f) => f.path.endsWith('.map'));
  const text = js.text.replace(/\\/\\/# sourceMappingURL=\\S*\\n?$/, '');
  __maps.push({ h: __crypto.createHash('sha256').update(text).digest('hex').slice(0, 10), map: map.text });
  return { ...r, outputFiles: [{ text }] };
} };
process.on('exit', () => { __fs.mkdirSync('crashmap-maps', { recursive: true }); for (const m of __maps) __fs.writeFileSync('crashmap-maps/main-' + m.h + '.js.map', m.map); });
`;
function buildAt(c, env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oreum-crashmap-'));
  git('worktree', 'add', '--detach', '--force', dir, c);
  try {
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
    const b = fs.readFileSync(path.join(dir, 'build.mjs'), 'utf8');
    if (!b.includes("import * as esbuild from 'esbuild';")) return { err: 'build.mjs 모양이 달라 소스맵을 켤 수 없음' };
    fs.writeFileSync(path.join(dir, 'build.mjs'), b.replace("import * as esbuild from 'esbuild';", WRAP));
    try { execFileSync('node', ['build.mjs'], { cwd: dir, env: { ...process.env, DEV: '', PUBLIC: '', ...env }, stdio: 'ignore', timeout: 180e3 }); } catch (e) { return { err: '빌드 실패' }; }
    const mains = fs.readdirSync(path.join(dir, 'dist')).filter((f) => /^main-[0-9a-f]+\.js$/.test(f));
    const mapF = path.join(dir, 'crashmap-maps', mains[0] + '.map');
    return { main: mains[0], map: fs.existsSync(mapF) ? fs.readFileSync(mapF, 'utf8') : null };
  } finally {
    if (!KEEP) { tryGit('worktree', 'remove', '--force', dir); fs.rmSync(dir, { recursive: true, force: true }); } else console.log('  worktree 남김:', dir);
  }
}

const ENVS = [['dev', { DEV: '1' }], ['release', { PUBLIC: '1' }], ['local', {}]];
let hit = null, guess = null;
for (const c of cands) {
  for (const [name, env] of ENVS) {
    const r = buildAt(c, env);
    console.log(`  ${c.slice(0, 7)} ${name.padEnd(7)} → ${r.err || r.main}`);
    if (!guess && r.map) guess = { c, name, ...r };
    if (r.main === file && r.map) { hit = { c, name, ...r }; break; }
  }
  if (hit) break;
}
const use = hit || guess;
if (!use) die('어느 후보도 소스맵 빌드가 되지 않음');
if (!hit) console.log(`\n주의: ${file} 와 해시가 같은 빌드를 찾지 못함. 가장 최근 후보 ${use.c.slice(0, 7)} (${use.name}) 로 짐작 — 줄·칸이 어긋날 수 있음`);

// 3. 자리 → 원래 파일·줄
const mp = new SourceMap(JSON.parse(use.map));
const e = mp.findEntry(Number(line) - 1, Number(col) - 1);
if (!e || !e.originalSource) die(`소스맵에서 ${file}:${line}:${col} 자리를 찾지 못함`);
const src = String(e.originalSource).replace(/^.*?(src\/|node_modules\/)/, '$1');
const content = (() => { const m = JSON.parse(use.map); const i = m.sources.indexOf(e.originalSource); return i >= 0 && m.sourcesContent ? m.sourcesContent[i] : tryGit('show', `${use.c}:${src}`); })() || '';
const lines = content.split('\n'), L = e.originalLine; // 0 기준
// 감싼 함수 이름: 위로 올라가며 함수 머리 찾기
let fn = '?';
for (let i = L; i >= 0 && i > L - 400; i--) {
  const m = lines[i] && (lines[i].match(/function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/) || lines[i].match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/) || lines[i].match(/^\s{0,4}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/));
  if (m && !/^(if|for|while|switch|catch|return)$/.test(m[1])) { fn = m[1]; break; }
}
console.log(`\n${hit ? '찾음' : '짐작'}: 커밋 ${use.c.slice(0, 7)} (${use.name} 빌드, ${use.main})`);
console.log(`자리: ${src}:${L + 1}:${e.originalColumn + 1}${e.name ? `  이름 ${e.name}` : ''}  함수 ${fn}`);
for (let i = Math.max(0, L - 2); i <= Math.min(lines.length - 1, L + 2); i++) console.log(`${i === L ? '>' : ' '} ${String(i + 1).padStart(5)} | ${lines[i].slice(0, 160)}`);
