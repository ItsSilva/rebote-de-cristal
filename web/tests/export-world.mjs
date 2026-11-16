import {chromium} from 'playwright';import {writeFile,mkdir} from 'node:fs/promises';
const b=await chromium.launch({executablePath:'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',headless:true});const p=await b.newPage({viewport:{width:1440,height:900}});await p.goto('http://localhost:3100');await p.waitForFunction(()=>window.clubGame);await p.waitForTimeout(1000);
const source=await p.evaluate(()=>{
 const w=window.clubGame.world,meshes=[];w.root.updateMatrixWorld(true);
 w.root.traverse(o=>{if(!o.isMesh||o.userData.canvas)return;const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);const m=Array.isArray(o.material)?o.material[0]:o.material;const a=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv');let parent=o;let dynamic=false;while(parent){if(w.paddles.includes(parent)||[w.bot,w.ball,w.shadow,w.panel].includes(parent))dynamic=true;parent=parent.parent;}
 let zone='court';let ancestor=o;while(ancestor){if(ancestor===w.environment)zone='environment';ancestor=ancestor.parent;}
 meshes.push({name:o.name||'Malla',positions:Array.from(a.array),normals:n?Array.from(n.array):[],uv:uv?Array.from(uv.array):[],triangles:g.index?Array.from(g.index.array):Array.from({length:a.count},(_,i)=>i),color:'#'+m.color.getHexString(),roughness:m.roughness??1,texture:m.normalMap?'fabric':m.map?'floor':'',dynamic,zone});g.dispose();});
 return {unit:'meter',source:'web/src/world.ts',table:{length:2.74,width:1.525,height:.76},meshes};
});
await mkdir('../Unity/Assets/Source',{recursive:true});await writeFile('../Unity/Assets/Source/cancha.json',JSON.stringify(source));
await p.screenshot({path:'../evidencias/03-cancha-escritorio.png'});
const stats=await p.evaluate(()=>window.clubGame.ctx.renderer.info.render);console.log({meshes:source.meshes.length,stats});await b.close();
