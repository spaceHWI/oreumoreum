// 의견 보내기 (#77): 게임에서 온 글을 확인해 계정 DO 의 표 fb 에 저장하고 개발자 메일로 보냄
// 받는 주소는 시크릿 FEEDBACK_TO, 보내는 주소는 FEEDBACK_FROM (Email Routing 을 켠 도메인의 주소)
// 메일은 Cloudflare Email Routing 의 Workers send_email 바인딩(이름 FEEDBACK_MAIL)으로. 바인딩·주소가 없으면 저장만
import { FEEDBACK } from '../../src/balance.js';
import { cleanText } from '../../src/safetext.js';

const str = (v, n) => cleanText(v, n);
const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
// 받은 글 묶음 → 확인한 글들 (정해진 칸만, 길이 자름)
export function cleanItems(items) {
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const it of items.slice(0, FEEDBACK.batch)) {
    if (!it || typeof it !== 'object') continue;
    const text = cleanText(it.text, FEEDBACK.max, { lines: true }); if (!text) continue; // 메일은 글자(text/plain)로만 보냄
    out.push({
      at: Math.min(Date.now(), Math.max(0, num(it.at) || 0)) || Date.now(), text,
      ver: str(it.ver, 20), srv: str(it.srv, 12), map: str(it.map, 24), dev: str(it.dev, 10),
      w: num(it.w), h: num(it.h), x: num(it.x), z: num(it.z), nick: str(it.nick, 24),
    });
  }
  return out;
}

const b64 = (s) => { const u = new TextEncoder().encode(s); let bin = ''; for (const c of u) bin += String.fromCharCode(c); return btoa(bin); };
const wrap = (s) => s.replace(/.{1,76}/g, '$&\r\n');
// 글 묶음 → 메일 원문(MIME, UTF-8)
export function mailRaw(from, to, items, who) {
  const subj = `[오름오름 의견] ${items[0].text.replace(/\s+/g, ' ').slice(0, 40)}${items.length > 1 ? ` 외 ${items.length - 1}건` : ''}`;
  const body = items.map((it) => [
    it.text, '',
    `— ${it.nick || '?'} · v${it.ver || '?'} · ${it.srv || '?'} · ${it.map || '?'} · ${it.dev || '?'} ${it.w || '?'}x${it.h || '?'} · 좌표 ${it.x},${it.z} · ${new Date(it.at).toISOString()}${who ? ' · 로그인' : ''}`,
  ].join('\n')).join('\n\n----\n\n');
  const id = `<${crypto.randomUUID()}@${from.split('@')[1] || 'oreumoreum'}>`;
  return [
    `From: 오름오름 <${from}>`.replace('오름오름', `=?UTF-8?B?${b64('오름오름')}?=`),
    `To: ${to}`,
    `Subject: =?UTF-8?B?${b64(subj)}?=`,
    `Message-ID: ${id}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '', wrap(b64(body)),
  ].join('\r\n');
}

export async function sendMail(env, items, who) {
  if (!env.FEEDBACK_MAIL || !env.FEEDBACK_TO || !env.FEEDBACK_FROM) return false;
  const { EmailMessage } = await import('cloudflare:email');
  await env.FEEDBACK_MAIL.send(new EmailMessage(env.FEEDBACK_FROM, env.FEEDBACK_TO, mailRaw(env.FEEDBACK_FROM, env.FEEDBACK_TO, items, who)));
  return true;
}
