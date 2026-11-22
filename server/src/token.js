// 징표 확인 (#255): 클라이언트가 적은 징표를 그대로 믿지 않는다 (셈은 src/token.js, 수치 balance.js TOKEN)
// - 얻음: save.tok.rec[구역] = { at, n, win } 의 at 이 지난 저장보다 새로우면 그 판의 n (구역 상한 runMax). 버틴 판(win)은 구역마다 쉬는 시간 × restK 안에 두 번 인정하지 않음(서버 시계, cred.tz)
//   모든 판은 통(cred.tk: 초당 perSec 씩 차고 burst 에서 멈춤) 안에서만
// - 씀: 새로 산 무기 단계·옷(tokSpent)의 값. 가진 징표 + 인정한 징표로 모자라면 산 것을 되돌림 ('tokItems')
// - 남은 징표: 지난 징표 + 인정 - 씀 을 넘으면 깎음 ('tok'). 얻은 누적(got)도 지난 것 + 인정까지
// 귤과는 따로라 귤 몫(credit·bank)에 닿지 않음. 남에게 주는 길은 없음
import { TOKEN, SWARM } from '../../src/balance.js';
import { tokSpent, TOK_CLOTHES } from '../../src/token.js';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const V = TOKEN.server;
export const normTkCred = (o) => ({ tk: Number.isFinite(Number(o?.tk)) ? Number(o.tk) : V.burst, tz: isObj(o?.tz) ? o.tz : {}, tkAt: Number(o?.tkAt) || 0 });

// P·S: norm 한 저장(normTok 거침), cred: normCred 결과(tk·tz·tkAt 를 씀), t: 지금(ms), dt: 지난 저장 뒤 초 → { got 인정한 징표, cred, fixed: [] }
export function tokenCheck(P, S, cred, t, dt) {
  const C = { ...cred, ...normTkCred(cred) }, fixed = [];
  C.tk = Math.min(V.burst, C.tk + Math.max(0, dt) * V.perSec);
  let got = 0;
  const PR = P.tok.rec, SR = S.tok.rec;
  for (let z = 1; z <= 5; z++) {
    if (PR[z] && !(SR[z]?.at >= PR[z].at)) SR[z] = { ...PR[z] }; /* 기록은 되돌릴 수 없음 (지웠다 옛 기록으로 두 번 받기 막음) */
    const r = SR[z]; if (!r || !(r.at > (PR[z]?.at || 0)) || !r.n) continue;
    if (r.win && t - (Number(C.tz[z]) || 0) < SWARM.run.rest * 1000 * V.restK) continue;
    const g = Math.max(0, Math.min(r.n, Math.floor(C.tk)));
    if (r.win) C.tz = { ...C.tz, [z]: t };
    C.tk -= g; got += g;
  }
  let spent = tokSpent(P, S);
  if (spent > P.tok.n + got) { // 못 산 것: 되돌림
    S.tok.own = { ...P.tok.own }; if (!S.tok.own[S.tok.arm]) S.tok.arm = P.tok.own[P.tok.arm] ? P.tok.arm : null;
    for (const c of TOK_CLOTHES) if (S.clothes.own[c.id] && !P.clothes.own[c.id]) delete S.clothes.own[c.id];
    for (const [k, id] of Object.entries(S.clothes.wear)) if (id && !S.clothes.own[id] && TOK_CLOTHES.some((c) => c.id === id)) delete S.clothes.wear[k];
    spent = 0; fixed.push('tokItems');
  }
  const cap = P.tok.n + got - spent;
  if (S.tok.n > cap) { S.tok.n = Math.max(0, cap); fixed.push('tok'); }
  if (S.tok.got > P.tok.got + got) S.tok.got = P.tok.got + got;
  if (S.tok.got < P.tok.got) S.tok.got = P.tok.got;
  return { got, cred: C, fixed };
}
