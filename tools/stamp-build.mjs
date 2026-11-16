import {execFileSync} from 'node:child_process';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');let revision='sin-commit';
try{revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
const pkg=JSON.parse(readFileSync(resolve(root,'web/package.json'),'utf8').replace(/^\uFEFF/,''));
mkdirSync(resolve(root,'web/include'),{recursive:true});
writeFileSync(resolve(root,'web/include/build-info.json'),JSON.stringify({name:'Rebote de Cristal',version:pkg.version,revision,builtAt:new Date().toISOString(),engine:pkg.dependencies['@needle-tools/engine'],hosting:'Needle Cloud'},null,2));
console.log('Build '+pkg.version+' · '+revision.slice(0,12));
