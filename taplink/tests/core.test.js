import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseProfile,writeProfile,verifyProfile,nfcError} from '../dist/core.js';
test('normalizes usernames and strips tracking from Instagram profile URLs',()=>{
 for(const raw of ['@Example.Name','example.name','https://www.instagram.com/example.name/?igsh=tracking','instagram.com/example.name','http://instagram.com/example.name/'])assert.equal(parseProfile(raw).url,'https://www.instagram.com/example.name/');
});
test('rejects malicious hosts, credentials, non-profile links and malformed names',()=>{
 for(const raw of ['',null,'https://instagram.com.evil.com/user','https://evil.com/user','https://user@instagram.com/example','https://instagram.com:444/user','https://instagram.com/p/abc','https://instagram.com/reel/abc','https://instagram.com/accounts/','javascript:alert(1)','a'.repeat(31),'a..b','.abc','abc.','abc/def','hello world'])assert.throws(()=>parseProfile(raw),String(raw));
});
test('writes a URL record, with cancellation and overwrite, and awaits actual completion',async()=>{
 let complete,record,opts;
 class Reader{write(message,options){record=message;opts=options;return new Promise(resolve=>{complete=resolve;});}}
 const controller=new AbortController();let done=false;
 const result=writeProfile(Reader,'https://www.instagram.com/test/',controller.signal).then(()=>{done=true;});
 await Promise.resolve();assert.equal(done,false);assert.equal(record.records[0].recordType,'url');assert.equal(record.records[0].data,'https://www.instagram.com/test/');assert.equal(opts.signal,controller.signal);assert.equal(opts.overwrite,true);complete();await result;assert.equal(done,true);
});
test('propagates hardware failure rather than reporting success',async()=>{
 class Reader{async write(){throw new DOMException('Denied','NotAllowedError');}}
 await assert.rejects(writeProfile(Reader,'https://www.instagram.com/test/',new AbortController().signal),{name:'NotAllowedError'});
 assert.match(nfcError({name:'NotAllowedError'}),/denied/);
});
test('verification matches actual URL records and rejects other destinations',async()=>{
 for(const [read,expected] of [['https://www.instagram.com/test/',true],['https://www.instagram.com/other/',false]]){
  class Reader{async scan(){queueMicrotask(()=>this.onreading({message:{records:[{recordType:'url',data:new DataView(new TextEncoder().encode(read).buffer)}]}}));}}
  assert.equal(await verifyProfile(Reader,'https://www.instagram.com/test/',new AbortController().signal),expected);
 }
});
test('verification can be cancelled while waiting for a tag',async()=>{
 class Reader{async scan(){}}
 const c=new AbortController();const pending=verifyProfile(Reader,'https://www.instagram.com/test/',c.signal);c.abort();await assert.rejects(pending,{name:'AbortError'});
});
