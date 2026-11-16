"""Offline texture baking. Reproducible high-detail parametric fabric -> tangent normal/AO.
Floor: orthographic UV projection of static table/bench occlusion and warm pools.
This is an actual sampled texture bake; Unity lightmap export is validated separately.
"""
from PIL import Image
from pathlib import Path
import math,json
root=Path(__file__).resolve().parents[1]
out=root/'web/src/assets';out.mkdir(parents=True,exist_ok=True)
n=1024
normal=Image.new('RGB',(n,n));ao=Image.new('RGB',(n,n));floor=Image.new('RGB',(n,n))
def height(u,v):
    seam=math.exp(-((min(u,1-u)-.045)/.012)**2)+math.exp(-((min(v,1-v)-.045)/.012)**2)
    weave=.00018*math.sin(u*math.pi*360)*math.cos(v*math.pi*360)
    stitch=.0015*math.exp(-((min(u,1-u)-.045)/.003)**2)*max(0,math.sin(v*math.pi*100))
    fold=.002*math.sin(v*90)*math.exp(-min(u,1-u)*22)
    return -.006*seam+weave+stitch+fold
for j in range(n):
 for i in range(n):
    u=(i+.5)/n;v=(j+.5)/n;d=1/n
    dx=(height(u+d,v)-height(u-d,v))/(2*d);dy=(height(u,v+d)-height(u,v-d))/(2*d)
    q=math.sqrt(dx*dx+dy*dy+1);normal.putpixel((i,j),(int(127.5-127.5*dx/q),int(127.5-127.5*dy/q),int(127.5+127.5/q)))
    occ=int(255*(1-min(.3,max(0,-height(u,v)*35))));ao.putpixel((i,j),(occ,occ,occ))
    x=(u-.5)*5;z=(v-.5)*7
    # Penumbra from a broad area source over the static table and bench.
    dist=math.hypot(max(abs(x)-.79,0),max(abs(z)-1.40,0));shadow=.33*math.exp(-dist*dist/.065)
    bench=math.exp(-((x+1.67)/.3)**2-((z-1.2)/.8)**6)*.2
    warm=sum(math.exp(-((x-s*1.9)**2+(z-t*2.5)**2)/.35)*.20 for s in [-1,1] for t in [-1,1])
    noise=.018*math.sin(x*42+math.sin(z*17))*math.cos(z*37)
    grout=.07 if min(abs((x+.23)% .72),abs((z+.16)% .72))<.012 else 0
    c=[.35,.35,.43];value=1-shadow-bench+noise-grout
    floor.putpixel((i,j),tuple(int(max(0,min(255,255*(a*value+warm*b)))) for a,b in zip(c,[1,.58,.20])))
normal.save(out/'fabric-normal.png',optimize=True);ao.save(out/'fabric-ao.png',optimize=True);floor.save(out/'court-baked.png',optimize=True)
(root/'evidencias/bake-manifest.json').write_text(json.dumps({'method':'Offline sampling, parametric detailed fabric to tangent-space normal and cavity AO; static projected floor occlusion','resolution':n,'maps':['fabric-normal.png','fabric-ao.png','court-baked.png'],'unityLightmap':'separate pending verification','source':'tools/bake.py'},indent=2))
print('Bake 1024 px: normal, AO y suelo guardados.')
