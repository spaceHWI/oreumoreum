// 플레이어 글에 '장비 점수'·'권장 점수' 가 남았는지 (#251): 위 줄·구역·지도·징·사건 등은 레벨로 말한다. 장비 점수는 내 가방 안 '장비 힘' 으로만
//   node tools/lvword.js   (먼저 node build.mjs) 빌드 결과물(dist/test.html·dist/main-*.js) 글을 찾아 하나라도 있으면 실패
//   번들은 한글이 \uXXXX 로 들어가므로 풀어서 찾는다. 릴리스 노트(src/version.js)의 옛 글은 그대로 두므로 뺀다
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, '..', 'dist');
const files = ['test.html', ...fs.readdirSync(D).filter((f) => /^main-.*\.js$/.test(f))];
const BAD = ['장비 점수', '권장 점수', '점수'];
const unesc = (s) => s.replace(/\\u\{([0-9a-fA-F]+)\}/g, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
const notes = [...fs.readFileSync(path.join(__dirname, '..', 'src', 'version.js'), 'utf8').matchAll(/'([^'\n]*점수[^'\n]*)'/g)].map((m) => m[1]);
let bad = 0, hits = 0;
for (const f of files) {
  let s = unesc(fs.readFileSync(path.join(D, f), 'utf8'));
  for (const n of notes) s = s.split(n).join('');
  if (/권장 Lv|지금 Lv/.test(s)) hits++;
  for (const w of BAD) {
    let i = s.indexOf(w);
    while (i >= 0) { bad++; console.log(`${f}: '${w}' … ${s.slice(Math.max(0, i - 30), i + 40).replace(/\s+/g, ' ')}`); i = s.indexOf(w, i + w.length); }
  }
}
if (!hits) { console.log('실패: 번들에서 권장 Lv 글을 못 찾음 (읽기가 잘못됨)'); process.exit(1); }
console.log(bad ? `실패: ${bad}곳` : `통과: ${files.join(', ')} 에 ${BAD.join('·')} 없음 (릴리스 노트 ${notes.length}줄 뺌)`);
process.exit(bad ? 1 : 0);
