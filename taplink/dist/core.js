const RESERVED = new Set(['p','reel','reels','stories','explore','accounts','direct','about','developer','legal','privacy','terms','share']);
export function parseProfile(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Enter an Instagram username or profile URL.');
  let name = raw.trim();
  if (/^(https?:\/\/|(?:www\.)?instagram\.com\/)/i.test(name)) {
    let url;
    try { url = new URL(/^https?:/i.test(name) ? name : `https://${name}`); } catch { throw new Error('Enter a valid Instagram profile URL.'); }
    if (!['instagram.com','www.instagram.com'].includes(url.hostname.toLowerCase()) || url.username || url.password || url.port || !['http:','https:'].includes(url.protocol)) throw new Error('Use a profile link from instagram.com.');
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 1) throw new Error('Use a profile link, not a post, reel, or story link.');
    name = parts[0];
  } else { name = name.replace(/^@/,''); }
  if (!/^[a-zA-Z0-9_](?:[a-zA-Z0-9_.]{0,28}[a-zA-Z0-9_])?$/.test(name) || name.includes('..') || RESERVED.has(name.toLowerCase())) throw new Error('Use a valid Instagram username: up to 30 letters, numbers, underscores, or dots.');
  name = name.toLowerCase();
  return { username: name, url: `https://www.instagram.com/${name}/` };
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
export async function writeProfile(Reader, url, signal) {
  const reader = new Reader();
  await reader.write(createMessage(url), { overwrite: true, signal });
}
export async function verifyProfile(Reader, url, signal) {
  const reader = new Reader();
  return new Promise((resolve, reject) => {
    const abort = () => finish(reject, new DOMException('Stopped','AbortError'));
    const finish = (fn, value) => { reader.onreading = null; reader.onreadingerror = null; signal.removeEventListener('abort',abort); fn(value); };
    if (signal.aborted) return abort();
    signal.addEventListener('abort',abort,{once:true});
    reader.onreadingerror = () => finish(reject,new DOMException('Unreadable tag','NotReadableError'));
    reader.onreading = ({message}) => {
      const urls = [...message.records].filter(r=>r.recordType==='url').map(r=>new TextDecoder().decode(r.data));
      finish(resolve, urls.includes(url));
    };
    Promise.resolve().then(()=>reader.scan({signal})).catch(error=>finish(reject,error));
  });
}
