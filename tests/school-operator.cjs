const assert=require('node:assert/strict'),{createHash}=require('node:crypto'),G=require('../school/engine.js'),{fixture}=require('./account-fixture.cjs');
(async()=>{
 const t=await fixture(),code='test-only-operator-fixture-credential-0123456789';
 assert.equal((await t.call('/api/account/test-login',{code})).status,503);
 t.env.SCHOOL_TEST_LOGIN_HASH=createHash('sha256').update(code).digest('hex');
 for(let i=0;i<5;i++)assert.equal((await t.call('/api/account/test-login',{code:'wrong'},null,{'CF-Connecting-IP':'192.0.2.1'})).status,401);
 assert.equal((await t.call('/api/account/test-login',{code},null,{'CF-Connecting-IP':'192.0.2.1'})).status,429);
 const login=await t.call('/api/account/test-login',{code},null,{'CF-Connecting-IP':'192.0.2.2'});assert.equal(login.status,200,JSON.stringify(login.data));const user=login.data;assert.equal(user.profile.isTest,true);assert(login.data.expires<Date.now()+13*3600000);
 const call=(path,data={})=>t.call(path,{catalogVersion:G.CATALOG_VERSION,...data},null,{'X-Account-Session':user.token});
 const state=await call('/api/school/state');assert.equal(state.status,200,JSON.stringify(state.data));assert(G.validate({...state.data.state,receipts:[]}));assert.equal(Object.keys(state.data.state.units).length,G.HEROES.length);assert(state.data.state.gems>=1000000);
 assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM school_names WHERE account_id=?').get(user.profile.id).n,0);
 for(const mode of ['level','tower']){const board=await call('/api/school/rankings',{mode});assert.equal(board.status,200);assert.equal(board.data.me,null);assert.equal(board.data.entries.length,0);}
 for(const path of ['social','guild','raid','yeti','coop'])assert.equal((await call('/api/school/'+path)).status,403,path);
 assert.equal((await t.call('/api/create',{name:'Hidden tester'},null,{'X-Account-Session':user.token})).status,403);
 const google=(await t.login('normal-after-operator')).data;assert.equal(google.profile.isTest,undefined);assert.equal((await t.call('/api/school/state',{catalogVersion:G.CATALOG_VERSION},null,{'X-Account-Session':google.token})).status,200);
 assert.equal((await t.call('/api/account/delete',{confirm:'DELETE'},user.token)).status,200);assert.equal((await call('/api/school/state')).status,401);assert.equal(t.sqlite.prepare('SELECT COUNT(*) n FROM school_saves WHERE account_id=?').get(user.profile.id).n,0);
 assert.equal((await t.call('/api/account/me',{},google.token)).status,200,'normal account remains intact');
 console.log('PASS isolated operator login: hashed credential, rate limit, 12h session, valid seeded save, no public identity/ranking/social, deletion isolation');t.sqlite.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
