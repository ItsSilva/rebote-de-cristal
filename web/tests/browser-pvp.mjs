import {chromium} from 'playwright';import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',headless:true});
const contexts=await Promise.all([browser.newContext({viewport:{width:1280,height:800}}),browser.newContext({viewport:{width:1280,height:800}}),browser.newContext({viewport:{width:1280,height:800}})]);
const pages=await Promise.all(contexts.map(c=>c.newPage()));const errors=[];pages.forEach(p=>p.on('pageerror',e=>errors.push(e.message)));
const code='QA-'+Date.now().toString(36).toUpperCase();const target=new URL(process.env.GAME_URL||'http://localhost:3100');target.searchParams.set('room',code);const url=target.href;
await pages[0].goto(url);await pages[0].waitForFunction(()=>window.clubGame?.net.online);
await pages[1].goto(url);await pages[1].waitForFunction(()=>window.clubGame?.net.online);
await pages[2].goto(url);await pages[2].waitForFunction(()=>document.querySelector('#message')?.textContent.includes('Sala llena'));
for(let i=0;i<2;i++)await pages[i].evaluate(()=>window.clubGame.action('ready'));
await pages[0].waitForFunction(()=>window.clubGame.net.club.mode==='pvp');await pages[1].waitForFunction(()=>window.clubGame.sim.cpu===false);
const log=[];const ready=await Promise.all(pages.slice(0,2).map(p=>p.evaluate(()=>({side:window.clubGame.side,club:window.clubGame.net.club,score:window.clubGame.sim.rules.score}))));
// Inputs go through the desktop handler. No score/ball assignment.
for(const p of pages.slice(0,2)){await p.mouse.move(640,380);await p.keyboard.press('g');}
await pages[0].waitForTimeout(500);await pages[0].keyboard.press('Space');await pages[0].waitForTimeout(130);await pages[0].keyboard.press('Enter');
const end=Date.now()+17000;let returned=false;
while(Date.now()<end){
 const states=await Promise.all(pages.slice(0,2).map(p=>p.evaluate(()=>{const g=window.clubGame,r=g.sim.rules;return {side:g.side,score:r.score,phase:r.phase,last:r.last,bounces:r.bounces,stage:r.serveStage,p:g.visualBall,swing:g.swing,hits:r.hits,latency:g.ctx.connection.currentLatency,lateContacts:g.lateContacts,remoteAge:g.sim.time-g.remoteTime,time:g.sim.time,paddle:g.sim.paddles[1]};})));
 const a=states[0],b=states[1];if(!log.length||log.at(-1).a.hits!==a.hits||String(log.at(-1).a.score)!==String(a.score)){log.push({a,b});console.log(JSON.stringify({a,b}));}
 if(b.phase==='juego'&&b.last===0&&b.bounces===1&&b.stage===0){await pages[1].mouse.move(Math.max(350,Math.min(1200,640+b.p.x/.9*640)),Math.max(130,Math.min(740,400-(b.p.y-1.02)*800)));if(b.p.z<-.78&&b.p.z>-1.3&&!b.swing){await pages[1].keyboard.press('Enter');returned=true;}}
 if(a.score[0]+a.score[1]>0)break;await pages[0].waitForTimeout(15);
}
await pages[0].waitForTimeout(800);const final=await Promise.all(pages.slice(0,2).map(p=>p.evaluate(()=>({score:window.clubGame.sim.rules.score,hits:window.clubGame.sim.rules.hits,phase:window.clubGame.sim.rules.phase,reason:window.clubGame.sim.rules.reason}))));
await pages[0].screenshot({path:'../evidencias/06-pvp-anfitrion.png'});await pages[1].screenshot({path:'../evidencias/07-pvp-invitado.png'});
await contexts[1].close();await pages[0].waitForFunction(()=>window.clubGame.net.club?.seats[1]===null,{timeout:10000});const departure=await pages[0].evaluate(()=>window.clubGame.net.club);
await writeFile('../evidencias/'+((target.searchParams.get('transport')==='needle'||target.hostname!=='localhost')?'pvp-needle':'pvp-browser')+'.json',JSON.stringify({method:'Dos contextos Brave independientes; entradas de teclado y ratón. Tercero rechazado.',url,code,ready,returned,log,final,departure,errors},null,2));console.log({final,returned,departure,errors});await browser.close();
if(errors.length||!returned||final[0].hits<2||final[1].hits<2||JSON.stringify(final[0].score)!==JSON.stringify(final[1].score)||!final[0].score.some(x=>x>0))process.exitCode=1;


