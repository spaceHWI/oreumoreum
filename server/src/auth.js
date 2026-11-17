// 로그인 (#7): 구글 ID 토큰을 검증하고 우리 세션 토큰(HMAC 서명)을 돌려준다. 서버에는 sub 와 닉네임만 남김
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const jparse = (u) => JSON.parse(new TextDecoder().decode(u));

let jwks = null, jwksAt = 0;
async function googleKeys() {
  if (jwks && Date.now() - jwksAt < 3600e3) return jwks;
  const r = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!r.ok) throw new Error('jwks');
  jwks = (await r.json()).keys; jwksAt = Date.now();
  return jwks;
}

export async function verifyGoogle(cred, clientId) {
  if (typeof cred !== 'string' || cred.length > 4096 || !clientId) throw new Error('bad token');
  const [h, p, s, extra] = cred.split('.');
  if (!h || !p || !s || extra != null) throw new Error('bad token');
  const head = jparse(unb64u(h)), body = jparse(unb64u(p));
  if (head.alg !== 'RS256') throw new Error('alg');
  const jwk = (await googleKeys()).find((k) => k.kid === head.kid);
  if (!jwk) throw new Error('kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(s), enc.encode(h + '.' + p));
  if (!ok) throw new Error('sig');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(body.iss)) throw new Error('iss');
  if (body.aud !== clientId) throw new Error('aud');
  const now = Date.now(), skew = 5 * 60e3; // 시계 어긋남 5분까지
  if (!(body.exp * 1000 > now)) throw new Error('exp');
  if (typeof body.iat === 'number' && body.iat * 1000 > now + skew) throw new Error('iat');
  if (typeof body.nbf === 'number' && body.nbf * 1000 > now + skew) throw new Error('nbf');
  if (typeof body.sub !== 'string' || !/^[0-9A-Za-z_-]{1,64}$/.test(body.sub)) throw new Error('sub');
  return body.sub;
}

const hkey = (secret) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
// 세션 토큰 (#84): v2.<{s: sub, i: 만든 시각, e: 끝 시각, j: 토큰 번호}>.<HMAC>
// 서명이 맞아도 계정 DO 가 한 번 더 봄(accounts.js auth): 지운 계정·다시 만든 계정의 옛 토큰, 로그아웃으로 버린 토큰은 거절
export async function signSession(secret, sub, days) {
  const i = Date.now(), exp = i + days * 864e5, j = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const pl = b64u(enc.encode(JSON.stringify({ s: sub, i, e: exp, j })));
  const sig = b64u(await crypto.subtle.sign('HMAC', await hkey(secret), enc.encode(pl)));
  return { token: 'v2.' + pl + '.' + sig, exp, iat: i, jti: j };
}
// → { sub, iat, exp, jti } 또는 null (서명·모양·만료만 봄)
export async function readSession(secret, token) {
  if (typeof token !== 'string' || token.length > 600) return null;
  const [v, pl, sig, extra] = token.split('.');
  if (v !== 'v2' || !pl || !sig || extra != null) return null;
  try {
    if (!(await crypto.subtle.verify('HMAC', await hkey(secret), unb64u(sig), enc.encode(pl)))) return null;
    const o = jparse(unb64u(pl));
    if (!(o.e > Date.now()) || typeof o.s !== 'string' || typeof o.j !== 'string' || !(o.i > 0)) return null;
    return { sub: o.s, iat: o.i, exp: o.e, jti: o.j };
  } catch (e) { return null; }
}
// 주소(IP) → 짧은 해시. 원문은 어디에도 남기지 않음 (요청 수 제한·의견 도배 막기용)
export async function ipKey(secret, ip, salt = '') {
  const sig = await crypto.subtle.sign('HMAC', await hkey(secret + '|ip'), enc.encode(salt + '|' + (ip || 'none')));
  return [...new Uint8Array(sig)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}
