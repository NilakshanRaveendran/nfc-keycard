const IG_RESERVED = new Set(['p','reel','reels','stories','explore','accounts','direct','about','developer','legal','privacy','terms','share','tv','web','api','graphql','challenge','emails','oauth','session','invites','create','tags','locations','ar','your_activity']);
const IG_TABS = new Set(['reels','tagged','feed','guides']);
const FB_RESERVED = new Set(['watch','groups','events','marketplace','pages','share','people','photo','photos','reel','reels','stories','login','gaming','help','settings','messages','notifications','friends','bookmarks','profile']);
const X_RESERVED = new Set(['home','i','explore','search','settings','notifications','messages','intent','share','hashtag','login','signup','compose','tos','privacy']);
const IG_NAME = /^[a-zA-Z0-9_](?:[a-zA-Z0-9_.]{0,28}[a-zA-Z0-9_])?$/;
const igHandle = h => IG_NAME.test(h) && !h.includes('..') && !IG_RESERVED.has(h.toLowerCase()) ? h.toLowerCase() : null;
const match = (pattern, h) => pattern.test(h) ? h : null;
const single = parts => parts.length === 1 ? parts[0] : null;
const at = parts => parts[0]?.startsWith('@') ? parts[0].slice(1) : null;
// hosts are compared after stripHost(). fromPath() picks the handle out of a profile URL; handle() validates it.
const PLATFORMS = [
  { id:'instagram', name:'Instagram', noun:'profile', hosts:['instagram.com'], prefix:'@',
    handle: igHandle, build: h => `https://www.instagram.com/${h}/`,
    fromPath: parts => parts.length === 1 || (parts.length === 2 && IG_TABS.has(parts[1].toLowerCase())) ? parts[0] : null },
  { id:'youtube', name:'YouTube', noun:'channel', hosts:['youtube.com','youtu.be'], prefix:'@',
    handle: h => match(/^[a-zA-Z0-9_.-]{3,30}$/, h), build: h => `https://www.youtube.com/@${h}`, fromPath: at },
  { id:'tiktok', name:'TikTok', noun:'profile', hosts:['tiktok.com'], prefix:'@',
    handle: h => h.endsWith('.') ? null : match(/^[a-zA-Z0-9_.]{2,24}$/, h), build: h => `https://www.tiktok.com/@${h}`,
    fromPath: parts => parts.length === 1 ? at(parts) : null },
  { id:'facebook', name:'Facebook', noun:'profile', hosts:['facebook.com','fb.com'], prefix:'',
    handle: h => FB_RESERVED.has(h.toLowerCase()) || /\.php$/i.test(h) ? null : match(/^[a-zA-Z0-9.]{5,50}$/, h),
    build: h => `https://www.facebook.com/${h}`, fromPath: single },
  { id:'x', name:'X', noun:'profile', hosts:['x.com','twitter.com'], prefix:'@',
    handle: h => X_RESERVED.has(h.toLowerCase()) ? null : match(/^[a-zA-Z0-9_]{1,15}$/, h), build: h => `https://x.com/${h}`, fromPath: single },
  { id:'linkedin', name:'LinkedIn', noun:'profile', hosts:['linkedin.com'], prefix:'',
    handle: h => match(/^[a-zA-Z0-9-]{3,100}$/, h), build: h => `https://www.linkedin.com/in/${h}/`,
    fromPath: parts => parts.length === 2 && parts[0].toLowerCase() === 'in' ? parts[1] : null },
  { id:'snapchat', name:'Snapchat', noun:'profile', hosts:['snapchat.com'], prefix:'@',
    handle: h => match(/^[a-zA-Z][a-zA-Z0-9._-]{1,13}[a-zA-Z0-9]$/, h), build: h => `https://www.snapchat.com/add/${h}`,
    fromPath: parts => parts.length === 2 && parts[0].toLowerCase() === 'add' ? parts[1] : null },
  { id:'threads', name:'Threads', noun:'profile', hosts:['threads.com','threads.net'], prefix:'@',
    handle: igHandle, build: h => `https://www.threads.com/@${h}`, fromPath: parts => parts.length === 1 ? at(parts) : null },
  { id:'whatsapp', name:'WhatsApp', noun:'chat', hosts:['wa.me'], prefix:'+',
    handle: h => match(/^\d{7,15}$/, h), build: h => `https://wa.me/${h}`, fromPath: single },
  { id:'telegram', name:'Telegram', noun:'profile', hosts:['t.me','telegram.me'], prefix:'@',
    handle: h => match(/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/, h), build: h => `https://t.me/${h}`, fromPath: single }
];
const LINK = { id:'link', name:'Website' };
const URI_PREFIXES = ['https://www.','http://www.','https://','http://'];
export const SMALL_TAG_BYTES = 137;
const stripHost = host => host.toLowerCase().replace(/^(www|m|mobile)\./,'');
// Approximate NDEF message size of a single URI record (short-record header + abbreviated prefix code).
export function ndefSize(url) {
  const prefix = URI_PREFIXES.find(p => url.startsWith(p)) ?? '';
  return 5 + new TextEncoder().encode(url.slice(prefix.length)).length;
}
function result(platform, kind, handle, url) {
  const label = `${platform.name} ${kind === 'profile' ? platform.noun : 'link'}`.toUpperCase();
  return { platform: platform.id, platformName: platform.name, kind, handle, display: kind === 'profile' ? `${platform.prefix}${handle}` : handle, label, url, bytes: ndefSize(url) };
}
export function parseLink(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Enter a link.');
  const text = raw.trim();
  if (/\s/.test(text)) throw new Error('Links cannot contain spaces.');
  const explicit = /^https?:\/\//i.test(text);
  if (!explicit && /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(text)) throw new Error('Only http and https links can be written.');
  let url;
  try { url = new URL(explicit ? text : `https://${text}`); } catch { throw new Error('Enter a valid link, such as example.com/page.'); }
  if (url.username || url.password) throw new Error('Links with embedded sign-in details cannot be written.');
  if (!url.hostname.includes('.') || url.hostname.endsWith('.')) throw new Error('Enter a full link, such as instagram.com/yourname.');
  if (url.href.length > 2048) throw new Error('This link is too long to write to a tag.');
  const host = stripHost(url.hostname);
  const platform = url.port ? null : PLATFORMS.find(p => p.hosts.includes(host));
  if (!platform) return result(LINK, 'link', url.host.replace(/^www\./,''), url.href);
  const candidate = platform.fromPath(url.pathname.split('/').filter(Boolean));
  const handle = candidate && platform.handle(candidate);
  // Profile links are rebuilt in canonical form, which drops tracking parameters. Anything else is kept as given.
  return handle ? result(platform, 'profile', handle, platform.build(handle)) : result(platform, 'link', host, url.href);
}
export function createMessage(url) { return { records: [{ recordType: 'url', data: url }] }; }
export function nfcError(error) {
  switch(error?.name) {
    case 'NotAllowedError': return 'NFC permission was denied. Allow NFC for this site in Chrome settings, then try again.';
    case 'NotSupportedError': return 'NFC is unavailable on this device, or this tag is not supported. Use an NFC-enabled Android phone and a writable NDEF tag.';
    case 'NotReadableError': return 'The phone could not access NFC. Turn NFC on, remove nearby tags, and try again.';
    case 'NetworkError': return 'Could not finish communicating with the tag. It may be read-only, too small, or too far away. Hold one writable tag still and retry.';
    case 'AbortError': return 'Operation stopped. If writing had already started, the tag may have changed. Read it to check.';
    case 'InvalidStateError': return 'Keep this app visible and unlock your phone, then try again.';
    default: return 'The tag could not be processed. Check that NFC is on and the tag is writable with enough capacity, then try again.';
  }
}
export async function writeLink(Reader, url, signal) {
  const reader = new Reader();
  await reader.write(createMessage(url), { overwrite: true, signal });
}
function sameUrl(a, b) { try { return new URL(a).href === new URL(b).href; } catch { return a === b; } }
export async function verifyLink(Reader, url, signal) {
  const reader = new Reader();
  return new Promise((resolve, reject) => {
    const abort = () => finish(reject, new DOMException('Stopped','AbortError'));
    const finish = (fn, value) => { reader.onreading = null; reader.onreadingerror = null; signal.removeEventListener('abort',abort); fn(value); };
    if (signal.aborted) return abort();
    signal.addEventListener('abort',abort,{once:true});
    reader.onreadingerror = () => finish(reject,new DOMException('Unreadable tag','NotReadableError'));
    reader.onreading = ({message}) => {
      const urls = [...message.records].filter(r=>r.recordType==='url').map(r=>new TextDecoder().decode(r.data));
      finish(resolve, urls.some(read=>sameUrl(read,url)));
    };
    Promise.resolve().then(()=>reader.scan({signal})).catch(error=>finish(reject,error));
  });
}
