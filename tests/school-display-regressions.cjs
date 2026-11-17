const assert=require('node:assert/strict');

async function inspectDisplay(page){
  // ResizeObserver and the reduced-motion renderer may run in separate frames.
  await page.waitForFunction(()=>{
    const canvas=document.getElementById('battle'),r=canvas.getBoundingClientRect();
    const painted=Math.min(r.width,r.height*12/7),physical=Math.min(painted*Math.min(devicePixelRatio,2),2880);
    return painted>0&&Math.abs(canvas.width-physical)<=1&&Math.abs(canvas.height-canvas.width*7/12)<=1;
  });
  return page.evaluate(()=>{
    const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const canvas=document.getElementById('battle'),c=canvas.getContext('2d'),r=canvas.getBoundingClientRect();
    const alpha=[];for(const x of[.01,.5,.99])for(const y of[.01,.5,.99])alpha.push(c.getImageData(Math.floor(canvas.width*x),Math.floor(canvas.height*y),1,1).data[3]);
    const portraits=[...document.querySelectorAll('#party img')].map(image=>({natural:image.naturalWidth,display:image.getBoundingClientRect().width}));
    return{viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},scroll:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},header:rect('.topbar'),panel:rect('.battle-panel'),heading:rect('.battle-heading'),battle:rect('#battle'),party:rect('.party-panel'),nav:rect('.bottom-nav'),backing:{width:canvas.width,height:canvas.height},paintedWidth:Math.min(r.width,r.height*12/7),alpha,portraits};
  });
}

function assertDisplay(result,width,height,dpr){
  const detail=JSON.stringify(result);
  assert.equal(result.viewport.dpr,dpr);
  assert.ok(result.scroll.width<=width+1&&result.scroll.height<=height+1,'Desktop must fit without outer scrolling: '+detail);
  assert.ok(result.panel.y>=result.header.bottom-1&&result.panel.y-result.header.bottom<=40,'Battle must start near the header: '+detail);
  assert.ok(Math.abs(result.party.y-result.panel.y)<=4,'Party and battle must align at the top: '+detail);
  assert.ok(result.battle.y-result.heading.bottom<=8,'No empty spacer above the battlefield: '+detail);
  assert.ok(result.paintedWidth>width*.6,'Battlefield must use the desktop instead of a small centered canvas: '+detail);
  assert.ok(result.battle.bottom<=height+1&&result.party.bottom<=height+1&&result.nav.bottom<=height+1,'Panels and navigation must remain visible: '+detail);
  assert.ok(result.battle.right<=result.party.x,'Party must not overlap the battlefield: '+detail);
  assert.ok(result.backing.width>480,'Desktop must not enlarge the old 480px backing bitmap: '+detail);
  assert.ok(Math.abs(result.backing.width-Math.min(result.paintedWidth*dpr,2880))<=1,'Backing pixels must follow the painted size and DPR: '+detail);
  assert.ok(Math.abs(result.backing.height-result.backing.width*7/12)<=1,'Physical canvas must retain the 12:7 artwork ratio: '+detail);
  assert.ok(result.alpha.every(value=>value===255),'Artwork must fill the backing canvas, including its distant corners: '+detail);
  assert.ok(result.portraits.every(p=>p.natural>=p.display*dpr),'Party portraits need enough source pixels for this display: '+detail);
}

async function runDisplayRegressions({pageFor,tab}){
  for(const [width,height,dpr]of[[2560,1440,1],[1920,1080,1],[1440,900,2]]){
    const page=await pageFor(`display-${width}-${dpr}`,width,height,dpr);
    try{
      const initial=await inspectDisplay(page);assertDisplay(initial,width,height,dpr);
      await page.screenshot({path:`/tmp/school-display-${width}x${height}-dpr${dpr}.png`});
      assert.equal(await page.locator('.bottom-nav button').count(),3);
      await page.click('#party [data-hero="harin"]');
      assert.ok(await page.locator('#train-hero').isVisible());
      assert.ok(await page.locator('#change-hero').isVisible());
      await page.click('#modal-close');
      for(const name of['recruit','supplies']){
        await tab(page,name);
        const content=await page.locator('.content-panel').boundingBox();
        await page.screenshot({path:`/tmp/school-display-${width}x${height}-dpr${dpr}-${name}.png`});
        assert.ok(content.y-initial.header.bottom<=40,'Other panels also begin near the header');
        assert.ok(content.y+content.height<=height+1,'Other panels fit within the viewport: '+JSON.stringify({width,height,dpr,name,content}));
        assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'Content must scroll inside its panel, not move the page navigation');
      }
      await tab(page,'adventure');
      if(width===2560){
        await page.setViewportSize({width:1280,height:800});
        const small=await inspectDisplay(page);assertDisplay(small,1280,800,dpr);
        assert.ok(small.backing.width<initial.backing.width,'Resizing down must reduce the backing bitmap');
        await page.setViewportSize({width,height});
        const restored=await inspectDisplay(page);assertDisplay(restored,width,height,dpr);
        assert.deepEqual(restored.backing,initial.backing,'Resize must settle back to the original resolution');
      }
      console.log(`PASS ${width}×${height} DPR${dpr}: ${initial.backing.width}×${initial.backing.height} backing, top-aligned HUD, complete artwork, readable portraits and no outer overflow`);
    }finally{await page.context().close();}
  }
}

module.exports={runDisplayRegressions};
