import {SMALL_TAG_BYTES, parseLink, writeLink, verifyLink, nfcError} from './core.js';
const $ = id => document.getElementById(id);
const supported = window.isSecureContext && 'NDEFReader' in window;
const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
let link = null, active = null, lastWritten = null, installPrompt = null;
function status(text,state='info') { $('operation').dataset.state=state; $('operation-text').textContent=text; }
// The status region stays rendered while idle so screen readers announce the next message.
function clearStatus() { status('','idle'); }
function render() {
  let error='';
  try { link = parseLink($('profile').value); } catch(e) { link=null; if($('profile').value.trim()) error=e.message; }
  $('input-error').textContent=error; $('profile').setAttribute('aria-invalid',String(Boolean(error)));
  const large=Boolean(link) && link.bytes>SMALL_TAG_BYTES;
  $('size-note').hidden=!large;
  $('size-note').textContent=large ? `This link needs about ${link.bytes} bytes. NTAG213 tags hold about ${SMALL_TAG_BYTES}, so use an NTAG215 or NTAG216.` : '';
  $('destination-empty').hidden=Boolean(link); $('destination-link').hidden=!link;
  if(link) { $('destination-link').href=$('preview').href=link.url; $('destination-link').textContent=link.url; } else { $('destination-link').removeAttribute('href'); $('preview').removeAttribute('href'); }
  $('preview-name').textContent=link ? link.display : 'your-link.com';
  $('preview-text').textContent=!link || link.platform==='link' ? 'Opens your link.' : link.kind==='profile' ? `Meet you on ${link.platformName}.` : `Opens on ${link.platformName}.`;
  $('preview-kind').textContent=link ? link.label : 'YOUR LINK';
  $('write').disabled=!supported || !link || Boolean(active); $('copy').disabled=!link || Boolean(active);
  $('profile').disabled=Boolean(active); $('cancel').hidden=!active;
  $('verify').hidden=!lastWritten || Boolean(active) || !supported;
}
$('device-title').textContent=supported ? 'Browser supports NFC writing' : 'Prepare here. Write with an NFC app.';
$('device-detail').textContent=supported ? 'An NFC-enabled Android phone and a writable tag are required. Allow NFC when asked and keep this screen open.' : !window.isSecureContext ? 'Open this app over HTTPS to use NFC and installation features.' : ios ? 'iPhone and iPad browsers cannot write NFC tags. Copy your link and use NFC Tools → Write → Add a record → URL / URI.' : 'This browser cannot write NFC tags. Use Chrome on an NFC-enabled Android phone, or copy the link to a native NFC writer.';
function edited() { lastWritten=null; clearStatus(); render(); }
$('profile').addEventListener('input',edited);
async function operate(mode) {
  if(active || !supported) return;
  const url=mode==='write' ? link?.url : lastWritten;
  if(!url) return;
  const controller=new AbortController(); active=controller; render();
  status(mode==='write' ? 'Ready to write. Hold one tag against the back of your phone. Keep it still until writing completes.' : 'Move the tag away, then hold it against your phone again to verify the saved link.');
  let timedOut=false;
  const timeout=setTimeout(()=>{timedOut=true; controller.abort();},60000);
  try {
    if(mode==='write') { await writeLink(window.NDEFReader,url,controller.signal); lastWritten=url; status('Written successfully. Your phone confirmed the write. Remove the tag, then read it back to verify.','success'); }
    else { const matches=await verifyLink(window.NDEFReader,url,controller.signal); status(matches ? 'Verified! The tag contains your link. It is ready for your keychain.' : 'This tag does not contain the expected link. Check that you scanned the same tag, or write it again.',matches?'success':'error'); }
  } catch(e) { status(timedOut ? 'No completed operation after 60 seconds. Check NFC and your tag, then try again. If a write started, read the tag to check its contents.' : nfcError(e),'error'); }
  finally { clearTimeout(timeout); controller.abort(); active=null; render(); }
}
$('tag-form').addEventListener('submit',e=>{e.preventDefault(); render(); if(link) operate('write');});
$('verify').addEventListener('click',()=>operate('verify'));
$('cancel').addEventListener('click',()=>active?.abort());
document.addEventListener('visibilitychange',()=>{if(document.hidden) active?.abort();});
$('copy').addEventListener('click',async()=>{if(!link)return;try { await navigator.clipboard.writeText(link.url); status('Link copied. Paste it as a URL / URI record in your NFC writer.'); } catch { status('Clipboard access is unavailable. Select and copy the link shown above.','error'); }});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault(); installPrompt=e;});
window.addEventListener('appinstalled',()=>{$('install').textContent='App installed';installPrompt=null;});
$('install').addEventListener('click',async()=>{
  if(installPrompt){try {await installPrompt.prompt(); await installPrompt.userChoice;}finally{installPrompt=null;}return;}
  $('install-instructions').textContent=window.matchMedia('(display-mode: standalone)').matches ? 'You are already using the installed app.' : ios ? 'In Safari, tap Share, then Add to Home Screen, and confirm Add. If this page is inside another app, open it in Safari first.' : 'In Chrome or Edge, open the browser menu and choose Install app (or Add to Home screen). If the option is missing, you can still use Taplink in this browser.';
  $('install-dialog').showModal();
});
$('close-install').addEventListener('click',()=>$('install-dialog').close());
if('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('./sw.js').catch(()=>{ /* Online writing remains available if installation is restricted. */ });
render();
// WebMCP has been exposed on navigator in some drafts and on document in others.
const modelContext=navigator.modelContext ?? document.modelContext;
if(modelContext?.registerTool) {
 const lifecycle=new AbortController(); window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
 try { Promise.resolve(modelContext.registerTool({name:'prepare_link',title:'Prepare link',description:'Validate any http/https link, such as a social media profile, and prepare the visible link. Does not write an NFC tag.',inputSchema:{type:'object',properties:{link:{type:'string'}},required:['link'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(active)throw new Error('Wait for the NFC operation to finish.');const next=parseLink(input?.link);$('profile').value=next.url;lastWritten=null;clearStatus();render();return {...next,nfcWritingSupported:supported};}},{signal:lifecycle.signal})).catch(()=>{}); }catch{}
}
