# Q1 spike: on sheet 12, pretend the layers are unknown. Pair FOC/BOC chains geometrically, then test rules
# for "which member is the face" against the layer truth.
import fitz, math, collections
from shapely.geometry import LineString, Point
from shapely.ops import linemerge, unary_union
PDF="/Users/wnavey/noetic/tmp/White-Water-Carwash/Whitewater Car Wash SP-2026-0216C/White Water Express Car Wash 071326.pdf"
doc=fitz.open(PDF); p=doc[11]; FT=20/72.0
def bez(P,t): return ((1-t)**3*P[0][0]+3*(1-t)**2*t*P[1][0]+3*(1-t)*t*t*P[2][0]+t**3*P[3][0],(1-t)**3*P[0][1]+3*(1-t)**2*t*P[1][1]+3*(1-t)*t*t*P[2][1]+t**3*P[3][1])
def lines(layer):
    out=[]
    for dr in p.get_drawings():
        if (dr.get('layer') or '')!=layer: continue
        for it in dr['items']:
            if it[0]=='l': out.append(LineString([(it[1].x,it[1].y),(it[2].x,it[2].y)]))
            elif it[0]=='c': P=[(it[k].x,it[k].y) for k in (1,2,3,4)]; out.append(LineString([bez(P,t/8) for t in range(9)]))
    return out
def chains(layer):
    m=linemerge(unary_union(lines(layer))); return list(m.geoms) if m.geom_type=='MultiLineString' else [m]
foc=chains('JCE BASE|C-CURB FOC'); boc=chains('JCE BASE|C-CURB BOC')
pav=unary_union(lines('JCE BASE|C-STRIPING')+lines('C-FIRELANE')+lines('JCE BASE|C-ADA PATH'))   # pavement markers
bldg=unary_union(lines('JCE BASE|C-BLDG')); walk=unary_union(lines('JCE BASE|C-SIDEWALK')+lines('JCE BASE|C-SIDEWALK HATCH')+lines('JCE BASE|C-SIDEWALK-HATCH'))
# pair: for each FOC chain >= 5 ft, find the BOC chain 0.33-1.0 ft away over >=80% of samples
pairs=[]
for f in foc:
    if f.length*FT<5: continue
    best=None
    for b in boc:
        n=20; ok=0; offs=[]
        for i in range(n):
            q=f.interpolate(i/(n-1),normalized=True); d=q.distance(b)*FT
            if 0.33<=d<=1.0: ok+=1; offs.append(d)
        if ok>=0.8*n and (best is None or ok>best[1]): best=(b,ok,sum(offs)/len(offs))
    if best: pairs.append((f,best[0],best[2]))
print(len(pairs),'pairs (truth known: first=face)')
def side_score(a,b,target):
    """+1 if a is nearer `target` than b is, measured along the a→b normal at sampled points."""
    n=12; votes=0
    for i in range(1,n):
        q=a.interpolate(i/n,normalized=True); r=b.interpolate(b.project(q)); 
        # normal from a toward b
        nx,ny=r.x-q.x, r.y-q.y; L=math.hypot(nx,ny) or 1; nx,ny=nx/L,ny/L
        # sample points 8 ft (29 pt) on each side of the pair's midline
        m=((q.x+r.x)/2,(q.y+r.y)/2); far=29
        pa=Point(m[0]-nx*far,m[1]-ny*far); pb=Point(m[0]+nx*far,m[1]+ny*far)   # pa on a's side, pb on b's side
        da,db=pa.distance(target)*FT, pb.distance(target)*FT
        if abs(da-db)>1: votes+= 1 if da<db else -1
    return votes
rules={'nearer striping/firelane/ADA (pavement markers)':pav,'nearer the building':bldg,'nearer the sidewalk':walk}
for name,t in rules.items():
    hit=miss=tie=0
    for f,b,w in pairs:
        s=side_score(f,b,t)
        if s>0: hit+=1
        elif s<0: miss+=1
        else: tie+=1
    print(f"rule: face = member {name:52s} → correct {hit:2d}  wrong {miss:2d}  undecided {tie:2d}")
# radius rule: at shared-centre arcs, face has the larger radius?
print("\nradius rule (face = larger radius at the return): see §1.4 — 16 of 17 centres yes, the R15 return no")
# curb-cut rule: the face chain is the one broken by 2-3 ft gaps (FOC 170 chains vs BOC 43)
print("chain-count rule: FOC chains",len(foc),"BOC chains",len(boc), "— the member with more breaks (curb cuts, ramps) is the face on this sheet")
