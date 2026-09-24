import {parseProfile, writeProfile, verifyProfile, nfcError} from './core.js';
const $ = id => document.getElementById(id);
const supported = window.isSecureContext && 'NDEFReader' in window;
const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
let profile = null, active = null, lastWritten = null, installPrompt = null;
function status(text,state='info') { $('operation').hidden=false; $('operation').dataset.state=state; $('operation-text').textContent=text; }
function render() {
  let error='';
  try { profile = parseProfile($('profile').value); } catch(e) { profile=null; if($('profile').value.trim()) error=e.message; }
  $('input-error').textContent=error; $('profile').setAttribute('aria-invalid',String(Boolean(error)));
  $('destination-empty').hidden=Boolean(profile); $('destination-link').hidden=!profile;
  if(profile) { $('destination-link').href=profile.url; $('destination-link').textContent=profile.url; } else { $('destination-link').removeAttribute('href'); }
  $('preview-name').textContent=profile ? `@${profile.username}` : '@yourusername';
  $('write').disabled=!supported || !profile || Boolean(active); $('copy').disabled=!profile || Boolean(active);
  $('profile').disabled=Boolean(active); $('cancel').hidden=!active;
  $('verify').hidden=!lastWritten || Boolean(active) || !supported;
}
$('device-title').textContent=supported ? 'Browser supports NFC writing' : 'Prepare here. Write with an NFC app.';
$('device-detail').textContent=supported ? 'An NFC-enabled Android phone and a writable tag are required. Allow NFC when asked and keep this screen open.' : !window.isSecureContext ? 'Open this app over HTTPS to use NFC and installation features.' : ios ? 'iPhone and iPad browsers cannot write NFC tags. Copy your link and use NFC Tools → Write → Add a record → URL / URI.' : 'This browser cannot write NFC tags. Use Chrome on an NFC-enabled Android phone, or copy the link to a native NFC writer.';
$('profile').addEventListener('input',()=>{lastWritten=null; $('operation').hidden=true; render();});
async function operate(mode) {
  if(active || !supported) return;
  const url=mode==='write' ? profile?.url : lastWritten;
  if(!url) return;
  const controller=new AbortController(); active=controller; render();
  status(mode==='write' ? 'Ready to write. Hold one tag against the back of your phone. Keep it still until writing completes.' : 'Move the tag away, then hold it against your phone again to verify the saved link.');
  let timedOut=false;
  const timeout=setTimeout(()=>{timedOut=true; controller.abort();},60000);
  try {
    if(mode==='write') { await writeProfile(window.NDEFReader,url,controller.signal); lastWritten=url; status('Written successfully. Your phone confirmed the write. Remove the tag, then read it back to verify.','success'); }
    else { const matches=await verifyProfile(window.NDEFReader,url,controller.signal); status(matches ? 'Verified! The tag contains your Instagram profile link. It is ready for your keychain.' : 'This tag does not contain the expected link. Check that you scanned the same tag, or write it again.',matches?'success':'error'); }
  } catch(e) { status(timedOut ? 'No completed operation after 60 seconds. Check NFC and your tag, then try again. If a write started, read the tag to check its contents.' : nfcError(e),'error'); }
  finally { clearTimeout(timeout); controller.abort(); active=null; render(); }
}
$('tag-form').addEventListener('submit',e=>{e.preventDefault(); render(); if(!profile){$('input-error').textContent='Enter an Instagram username or profile URL.'; $('profile').focus(); return;} operate('write');});
$('verify').addEventListener('click',()=>operate('verify'));
$('cancel').addEventListener('click',()=>active?.abort());
document.addEventListener('visibilitychange',()=>{if(document.hidden) active?.abort();});
$('copy').addEventListener('click',async()=>{if(!profile)return;try { await navigator.clipboard.writeText(profile.url); status('Profile link copied. Paste it as a URL / URI record in your NFC writer.'); } catch { status('Clipboard access is unavailable. Select and copy the profile link shown above.','error'); }});
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
if(document.modelContext?.registerTool) {
 const lifecycle=new AbortController(); window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
 try { Promise.resolve(document.modelContext.registerTool({name:'prepare_instagram_link',title:'Prepare Instagram link',description:'Validate an Instagram username or profile URL and prepare the visible link. Does not write an NFC tag.',inputSchema:{type:'object',properties:{profile:{type:'string'}},required:['profile'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(active)throw new Error('Wait for the NFC operation to finish.');const next=parseProfile(input?.profile);$('profile').value=next.url;lastWritten=null;$('operation').hidden=true;render();return {...next,nfcWritingSupported:supported};}},{signal:lifecycle.signal})).catch(()=>{}); }catch{}
}
