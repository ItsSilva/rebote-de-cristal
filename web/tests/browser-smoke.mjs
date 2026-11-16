import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',headless:true,args:['--enable-webgl']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.on('pageerror',e=>console.log('ERROR',e.message));
await page.goto('http://localhost:3100');await page.waitForFunction(()=>window.clubGame);
await page.mouse.move(720,430);await page.keyboard.press('g');await page.waitForTimeout(600);await page.keyboard.press('Space');await page.waitForTimeout(120);await page.keyboard.press('Enter');
for(let i=0;i<24;i++){await page.waitForTimeout(180);console.log(JSON.stringify(await page.evaluate(()=>{const s=window.clubGame.sim;return {phase:s.rules.phase,p:s.p,v:s.velocity,score:s.rules.score,why:s.rules.reason,stage:s.rules.serveStage,bounces:s.rules.bounces,last:s.rules.last,paddle:s.paddles[0].p,bot:s.paddles[1].p,hits:s.rules.hits};})));}
await page.screenshot({path:'../evidencias/02-saque-cpu.png'});await browser.close();

