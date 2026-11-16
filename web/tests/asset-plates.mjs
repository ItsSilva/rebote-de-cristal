import {chromium} from 'playwright';
const b=await chromium.launch({executablePath:'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',headless:true});
const p=await b.newPage({viewport:{width:1600,height:1000}});await p.goto(process.env.GAME_URL||'http://localhost:4173/');await p.waitForFunction(()=>window.clubGame);
await p.evaluate(()=>{
 const g=window.clubGame,w=g.world;g.update=()=>{};
 w.root.visible=false;
 const stage=new w.root.constructor();g.ctx.scene.add(stage);
 for(const light of w.root.children.filter(o=>o.isLight))stage.add(light.clone());
 const specs=[[w.paddles[0],-1.25,.78],[w.dispenser,0,0],[w.bot,1.35,0]];
 for(const [source,x,y] of specs){const o=source.clone();o.visible=true;o.position.set(x,y,0);o.rotation.set(0,0,0);if(source===w.paddles[0]){o.scale.setScalar(2.1);o.rotation.z=-.25;}stage.add(o);}
 const camera=g.ctx.mainCamera;camera.position.set(0,1.55,5.5);camera.lookAt(0,.65,0);camera.fov=32;camera.updateProjectionMatrix();
 document.querySelectorAll('header,aside,footer,#hint').forEach(e=>e.style.display='none');
 const label=document.createElement('div');label.id='asset-label';label.style.cssText='position:fixed;inset:55px 70px auto;color:#fff1cb;font:16px system-ui;letter-spacing:.12em;pointer-events:none';label.innerHTML='<small style="color:#68cdb5">REBOTE DE CRISTAL / PROCESO</small><h1 style="font-size:45px">Piedra, aire y costura.</h1><p style="color:#abbcc8">Pala ampliada 2,1× para inspección · Dispensador · Autómata</p>';document.body.append(label);window.assetStage=stage;
});
await p.waitForTimeout(700);await p.screenshot({path:'../evidencias/09-assets-materiales.png'});
await p.evaluate(()=>{window.assetStage.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.wireframe=true;o.material.color.set('#68cdb5');}});document.querySelector('#asset-label h1').textContent='Geometría editable.';});
await p.waitForTimeout(300);await p.screenshot({path:'../evidencias/10-assets-alambre.png'});await b.close();

