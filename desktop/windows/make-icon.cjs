// Optional: regenerate the checked-in ICO from the game's original SVG crest.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:256,height:256},deviceScaleFactor:1});
    const svg = fs.readFileSync(path.join(__dirname, '../../school/assets/app-icon.svg'),'utf8');
    const entries = [];
    for (const size of [16,32,48,64,128,256]) {
      await page.setViewportSize({width:size,height:size});
      await page.setContent(`<style>html,body{margin:0;padding:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
      entries.push({size,data:await page.screenshot({type:'png'})});
    }
    const header = Buffer.alloc(6 + 16 * entries.length);
    header.writeUInt16LE(1,2); header.writeUInt16LE(entries.length,4);
    let offset = header.length;
    entries.forEach(({size,data},i) => {
      const at = 6 + 16 * i;
      header[at] = size === 256 ? 0 : size; header[at+1] = header[at];
      header.writeUInt16LE(1,at+4); header.writeUInt16LE(32,at+6);
      header.writeUInt32LE(data.length,at+8); header.writeUInt32LE(offset,at+12);
      offset += data.length;
    });
    fs.writeFileSync(path.join(__dirname,'app.ico'),Buffer.concat([header,...entries.map(e => e.data)]));
    console.log('Created six-resolution school crest ICO.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
