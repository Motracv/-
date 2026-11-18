const assert=require('node:assert/strict');
const G=require('../school/engine.js');
const {seedGuest}=require('./school-ui-regressions.cjs');

async function runCouponRegressions({pageFor,saved,tab,t,login,dropNextAction}){
  // Keep browser and fixture clocks aligned; the active codes have no expiry.
  const realNow=Date.now,now=Date.parse('2026-11-18T03:00:00Z'),pages=[];
  Date.now=()=>now;
  async function page(person,width=390,height=844){const p=await pageFor(person,width,height);pages.push(p);await p.clock.setFixedTime(now);return p;}
  async function submit(p,code){await p.fill('#coupon-code',code);await p.click('#redeem-code');}
  async function message(p,state,text){await p.waitForFunction(({state,text})=>{const el=document.getElementById('coupon-message');return el.dataset.state===state&&el.textContent.includes(text);},{state,text});}
  const wallet=s=>({gold:s.gold,gems:s.gems,redeemedCodes:s.redeemedCodes||[]});
  const initial=()=>G.create(now+60000,260);
  const readCloud=id=>JSON.parse(t.sqlite.prepare('SELECT payload FROM school_saves WHERE account_id=?').get(id).payload);
  try{
    const guest=await page('coupon-guest');await seedGuest(guest,initial());await tab(guest,'supplies');
    await guest.fill('#coupon-code','   ');assert.ok(await guest.locator('#redeem-code').isDisabled());
    await submit(guest,'NOT_A_CODE');await message(guest,'error','사용할 수 없는');assert.deepEqual(wallet(await saved(guest)),{gold:700,gems:1800,redeemedCodes:[]});
    await submit(guest,'  thanks_for_reporting  ');await message(guest,'success','THANKS_FOR_REPORTING');
    assert.deepEqual(wallet(await saved(guest)),{gold:1200,gems:2300,redeemedCodes:['THANKS_FOR_REPORTING']});
    assert.equal(await guest.locator('#gold').textContent(),'1,200');assert.equal(await guest.locator('#gems').textContent(),'2,300');
    await submit(guest,'HORAS_CELEBRATION');await message(guest,'success','HORAS_CELEBRATION');
    assert.deepEqual(wallet(await saved(guest)),{gold:3200,gems:4300,redeemedCodes:['THANKS_FOR_REPORTING','HORAS_CELEBRATION']});
    await guest.reload();await tab(guest,'supplies');
    for(const code of['THANKS_FOR_REPORTING',' horas_celebration ']){await submit(guest,code);await message(guest,'error','이미 사용');}
    assert.deepEqual(wallet(await saved(guest)),{gold:3200,gems:4300,redeemedCodes:['THANKS_FOR_REPORTING','HORAS_CELEBRATION']});
    console.log('PASS guest coupon form: blank/invalid rejection, lowercase/space normalization, both exact rewards and no duplicate after reload');

    // Test the real responsive scroll containers, including the feedback text
    // after a successful redemption, not an isolated static form.
    for(const [width,height]of[[2560,1440],[320,568]]){
      await guest.setViewportSize({width,height});await guest.locator('#coupon-form').scrollIntoViewIfNeeded();
      const box=await guest.evaluate(()=>{
        const r=sel=>{const x=document.querySelector(sel).getBoundingClientRect();return{left:x.left,top:x.top,right:x.right,bottom:x.bottom,width:x.width};};
        const clip=r(innerWidth<500?'.workspace':'.content-panel');return{clip,input:r('#coupon-code'),button:r('#redeem-code'),message:r('#coupon-message'),nav:r('.bottom-nav'),scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight};
      });
      for(const name of['input','button','message']){const r=box[name];assert.ok(r.left>=box.clip.left&&r.right<=box.clip.right+1&&r.top>=box.clip.top-1&&r.bottom<=Math.min(height,box.clip.bottom)+1,`Coupon ${name} must fit its visible scroll area: `+JSON.stringify({width,height,box}));}
      assert.ok(box.input.right<=box.button.left+1);assert.ok(box.input.width>=130);assert.ok(box.scrollWidth<=width+1&&box.scrollHeight<=height+1);
      await guest.screenshot({path:`/tmp/school-coupon-tested-${width}x${height}.png`});
    }
    console.log('PASS QHD and 320px coupon input, reward button and feedback fit their visible scroll panels');

    const identity=(await t.login('coupon-cloud')).data;
    await t.call('/api/school/state',{catalogVersion:G.CATALOG_VERSION},null,{'X-Account-Session':identity.token});
    t.sqlite.prepare('UPDATE school_saves SET payload=? WHERE account_id=?').run(JSON.stringify(initial()),identity.profile.id);
    const cloud=await page('coupon-cloud');await login(cloud);await tab(cloud,'supplies');
    await submit(cloud,'THANKS_FOR_REPORTING');await message(cloud,'success','THANKS_FOR_REPORTING');
    assert.deepEqual(wallet(readCloud(identity.profile.id)),{gold:1200,gems:2300,redeemedCodes:['THANKS_FOR_REPORTING']});
    await cloud.reload();await cloud.waitForFunction(()=>document.getElementById('account-label').textContent==='계정 저장');
    assert.equal(await cloud.locator('#gold').textContent(),'1,200');assert.equal(await cloud.locator('#gems').textContent(),'2,300');
    const other=await page('coupon-cloud',844,390);await login(other);await tab(other,'supplies');
    await submit(other,' thanks_for_reporting ');await message(other,'error','이미 사용');
    assert.deepEqual(wallet(readCloud(identity.profile.id)),{gold:1200,gems:2300,redeemedCodes:['THANKS_FOR_REPORTING']});
    console.log('PASS cloud coupon reward persists in real SQLite and the same account in another browser cannot claim twice');

    await tab(cloud,'supplies');dropNextAction();await submit(cloud,'HORAS_CELEBRATION');
    await message(cloud,'pending','확인');assert.ok(await cloud.locator('#redeem-code').isDisabled());
    assert.deepEqual(wallet(readCloud(identity.profile.id)),{gold:3200,gems:4300,redeemedCodes:['THANKS_FOR_REPORTING','HORAS_CELEBRATION']});
    await cloud.reload();await tab(cloud,'supplies');await message(cloud,'success','HORAS_CELEBRATION');
    assert.deepEqual(wallet(readCloud(identity.profile.id)),{gold:3200,gems:4300,redeemedCodes:['THANKS_FOR_REPORTING','HORAS_CELEBRATION']});
    assert.equal(await cloud.locator('#gold').textContent(),'3,200');assert.equal(await cloud.locator('#gems').textContent(),'4,300');
    assert.equal(await cloud.evaluate(()=>sessionStorage.getItem('school-pending-action')),null);
    await submit(cloud,'HORAS_CELEBRATION');await message(cloud,'error','이미 사용');
    assert.deepEqual(wallet(readCloud(identity.profile.id)),{gold:3200,gems:4300,redeemedCodes:['THANKS_FOR_REPORTING','HORAS_CELEBRATION']});
    console.log('PASS committed coupon with lost response resumes the same receipt after reload and never grants the reward twice');
  }finally{for(const p of pages)await p.context().close();Date.now=realNow;}
}

module.exports={runCouponRegressions};
