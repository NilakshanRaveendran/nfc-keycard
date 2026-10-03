import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseLink,ndefSize,writeLink,verifyLink,nfcError} from '../dist/core.js';
const tag=(...records)=>({message:{records:records.map(([recordType,text])=>({recordType,data:new DataView(new TextEncoder().encode(text).buffer)}))}});
test('strips tracking from Instagram profile links',()=>{
 for(const raw of ['https://www.instagram.com/Example.Name/?igsh=tracking','instagram.com/example.name','http://instagram.com/example.name/','https://m.instagram.com/example.name','https://www.instagram.com/example.name/reels/']){
  const link=parseLink(raw);assert.equal(link.url,'https://www.instagram.com/example.name/',raw);assert.equal(link.platform,'instagram');assert.equal(link.kind,'profile');assert.equal(link.display,'@example.name');
 }
});
test('recognises profile links on every platform and drops tracking',()=>{
 for(const [raw,platform,url] of [['https://www.tiktok.com/@some.one?_t=abc&_r=1','tiktok','https://www.tiktok.com/@some.one'],['youtube.com/@SomeChannel/videos','youtube','https://www.youtube.com/@SomeChannel'],['https://twitter.com/some_one?s=21','x','https://x.com/some_one'],['https://m.facebook.com/some.one','facebook','https://www.facebook.com/some.one'],['https://www.linkedin.com/in/some-one?utm_source=share','linkedin','https://www.linkedin.com/in/some-one/'],['snapchat.com/add/some.one','snapchat','https://www.snapchat.com/add/some.one'],['https://www.threads.net/@some.one','threads','https://www.threads.com/@some.one'],['wa.me/94771234567','whatsapp','https://wa.me/94771234567'],['t.me/some_one','telegram','https://t.me/some_one'],['https://github.com/Some-One?tab=repositories','github','https://github.com/Some-One']]){
  const link=parseLink(raw);assert.equal(link.platform,platform,raw);assert.equal(link.kind,'profile',raw);assert.equal(link.url,url,raw);
  assert.deepEqual(parseLink(url),link,raw);
 }
});
test('keeps non-profile platform links intact',()=>{
 for(const [raw,platform] of [['https://www.youtube.com/watch?v=abc123','youtube'],['https://youtu.be/abc123','youtube'],['https://www.facebook.com/profile.php?id=100000000000001','facebook'],['https://www.instagram.com/p/abc/','instagram'],['https://instagram.com/tv/','instagram'],['https://instagram.com/explore/','instagram'],['https://www.tiktok.com/@some.one/video/123','tiktok'],['https://x.com/home','x'],['https://github.com/some-one/some-repo','github'],['https://github.com/settings','github']]){
  const link=parseLink(raw);assert.equal(link.platform,platform,raw);assert.equal(link.kind,'link',raw);assert.equal(link.url,new URL(raw).href,raw);
 }
});
test('accepts any http or https link and labels it by its real host',()=>{
 assert.equal(parseLink('example.com/page?x=1#top').url,'https://example.com/page?x=1#top');
 assert.equal(parseLink(' example.com ').url,'https://example.com/');
 assert.equal(parseLink('http://example.com:8080/a').url,'http://example.com:8080/a');
 assert.equal(parseLink('www.example.com').display,'example.com');
 for(const raw of ['https://instagram.com.evil.com/user','https://evil.com/instagram.com/user','https://instagram.com:444/user']){const link=parseLink(raw);assert.equal(link.platform,'link',raw);assert.equal(link.label,'WEBSITE LINK');assert.equal(link.display,new URL(raw).host+new URL(raw).pathname);}
 assert.equal(parseLink('https://github.com/some-one/some-repo/').display,'github.com/some-one/some-repo');
 assert.equal(parseLink('https://youtu.be/abc123?t=5').display,'youtu.be/abc123');
 assert.equal(parseLink(`example.com/${'a'.repeat(80)}`).display.length,48);
});
test('rejects unsafe schemes, credentials and malformed input',()=>{
 for(const raw of ['',null,'   ','@someone','someone','https://user@instagram.com/example','https://user:pw@example.com/','abc/def','hello world','https://exa mple.com','https://localhost/x','javascript:alert(1)','data:text/html,x','mailto:a@example.com','ftp://example.com/x','tel:+123',`https://example.com/${'a'.repeat(2100)}`])assert.throws(()=>parseLink(raw),String(raw).slice(0,40));
});
test('estimates the NDEF size using the URI prefix abbreviation',()=>{
 assert.equal(ndefSize('https://www.instagram.com/test/'),5+'instagram.com/test/'.length);
 assert.equal(ndefSize('https://t.me/abcde'),5+'t.me/abcde'.length);
 assert.equal(parseLink('https://example.com/é').bytes,5+'example.com/%C3%A9'.length);
});
test('writes a URL record, with cancellation and overwrite, and awaits actual completion',async()=>{
 let complete,record,opts;
 class Reader{write(message,options){record=message;opts=options;return new Promise(resolve=>{complete=resolve;});}}
 const controller=new AbortController();let done=false;
 const result=writeLink(Reader,'https://www.youtube.com/@test',controller.signal).then(()=>{done=true;});
 await Promise.resolve();assert.equal(done,false);assert.equal(record.records.length,1);assert.equal(record.records[0].recordType,'url');assert.equal(record.records[0].data,'https://www.youtube.com/@test');assert.equal(opts.signal,controller.signal);assert.equal(opts.overwrite,true);complete();await result;assert.equal(done,true);
});
test('propagates hardware failure rather than reporting success',async()=>{
 class Reader{async write(){throw new DOMException('Denied','NotAllowedError');}}
 await assert.rejects(writeLink(Reader,'https://www.instagram.com/test/',new AbortController().signal),{name:'NotAllowedError'});
 assert.match(nfcError({name:'NotAllowedError'}),/denied/);
});
test('verification matches actual URL records and rejects other destinations',async()=>{
 const expected='https://www.instagram.com/test/';
 for(const [records,matches] of [[[['url',expected]],true],[[['text','hello'],['url',expected]],true],[[['url','https://www.instagram.com/other/']],false],[[['text',expected]],false],[[],false]]){
  class Reader{async scan(){queueMicrotask(()=>this.onreading(tag(...records)));}}
  assert.equal(await verifyLink(Reader,expected,new AbortController().signal),matches);
 }
});
test('verification reports unreadable tags and scan failures',async()=>{
 class Unreadable{async scan(){queueMicrotask(()=>this.onreadingerror());}}
 await assert.rejects(verifyLink(Unreadable,'https://example.com/',new AbortController().signal),{name:'NotReadableError'});
 class Denied{async scan(){throw new DOMException('Denied','NotAllowedError');}}
 await assert.rejects(verifyLink(Denied,'https://example.com/',new AbortController().signal),{name:'NotAllowedError'});
});
test('verification can be cancelled while waiting for a tag',async()=>{
 class Reader{async scan(){}}
 const c=new AbortController();const pending=verifyLink(Reader,'https://www.instagram.com/test/',c.signal);c.abort();await assert.rejects(pending,{name:'AbortError'});
});
