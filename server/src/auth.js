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
  const [h, p, s] = String(cred).split('.');
  if (!h || !p || !s) throw new Error('bad token');
  const head = jparse(unb64u(h)), body = jparse(unb64u(p));
  if (head.alg !== 'RS256') throw new Error('alg');
  const jwk = (await googleKeys()).find((k) => k.kid === head.kid);
  if (!jwk) throw new Error('kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(s), enc.encode(h + '.' + p));
  if (!ok) throw new Error('sig');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(body.iss)) throw new Error('iss');
  if (body.aud !== clientId) throw new Error('aud');
  if (!(body.exp * 1000 > Date.now())) throw new Error('exp');
  if (typeof body.sub !== 'string' || !body.sub) throw new Error('sub');
  return body.sub;
}

const hkey = (secret) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
export const SESSION_DAYS = 30;
export async function signSession(secret, sub) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const pl = b64u(enc.encode(JSON.stringify({ s: sub, e: exp })));
  const sig = b64u(await crypto.subtle.sign('HMAC', await hkey(secret), enc.encode(pl)));
  return { token: 'v1.' + pl + '.' + sig, exp };
}
export async function readSession(secret, token) {
  if (typeof token !== 'string') return null;
  const [v, pl, sig] = token.split('.');
  if (v !== 'v1' || !pl || !sig) return null;
  try {
    if (!(await crypto.subtle.verify('HMAC', await hkey(secret), unb64u(sig), enc.encode(pl)))) return null;
    const o = jparse(unb64u(pl));
    if (!(o.e > Date.now()) || typeof o.s !== 'string') return null;
    return o.s;
  } catch (e) { return null; }
}
