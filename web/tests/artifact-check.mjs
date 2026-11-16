import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({executablePath:'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',headless:true});
const page = await browser.newPage({viewport:{width:1440,height:900}});
const errors=[],failed=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
const url=process.env.GAME_URL||'http://localhost:4173/';
await page.goto(url);await page.waitForFunction(()=>window.clubGame);await page.waitForTimeout(2500);
const result=await page.evaluate(()=>{
 const g=window.clubGame;let lightmapped=0,staticMeshes=0;
 g.baked?.traverse(o=>{if(o.isMesh)staticMeshes++;for(const c of o.userData.components||[])if(c.hasLightmap)lightmapped++;});
 return {baked:!!g.baked,environment:!!g.bakedEnvironment,staticMeshes,lightmapped,components: g.baked.children.flatMap(c=>c.children).slice(0,3).map(o=>({name:o.name,components:o.userData.components?.map(c=>({type:c.constructor.name,lightmapIndex:c.lightmapIndex,hasLightmap:c.hasLightmap}))})),proceduralArchitecture:g.world.architecture.visible,authoringEquipment:g.ctx.scene.getObjectByName('Equipo_visualizacion')?.visible,render:g.ctx.renderer.info.render,vr:document.querySelector('#vr').textContent,ar:document.querySelector('#ar').textContent};
});
await page.screenshot({path:'../evidencias/08-build-final.png'});
await writeFile('../evidencias/artefacto-web.json',JSON.stringify({date:new Date().toISOString(),url,result,errors,failed},null,2));
console.log({result,errors,failed});await browser.close();
if(errors.length||failed.length||!result.baked||!result.environment||!result.lightmapped||result.proceduralArchitecture||result.authoringEquipment)process.exitCode=1;

