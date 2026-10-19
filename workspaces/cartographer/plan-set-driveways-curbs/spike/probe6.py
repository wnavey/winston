import fitz, math
from shapely.geometry import LineString, Point, MultiPoint
from shapely.ops import linemerge, unary_union
PDF="/Users/wnavey/noetic/tmp/White-Water-Carwash/Whitewater Car Wash SP-2026-0216C/White Water Express Car Wash 071326.pdf"
doc=fitz.open(PDF); FT=20/72.0
def bez(P,t): return ((1-t)**3*P[0][0]+3*(1-t)**2*t*P[1][0]+3*(1-t)*t*t*P[2][0]+t**3*P[3][0],(1-t)**3*P[0][1]+3*(1-t)**2*t*P[1][1]+3*(1-t)*t*t*P[2][1]+t**3*P[3][1])
def lines(page, layer):
    out=[]
    for dr in page.get_drawings():
        if (dr.get('layer') or '')!=layer: continue
        for it in dr['items']:
            if it[0]=='l': out.append(LineString([(it[1].x,it[1].y),(it[2].x,it[2].y)]))
            elif it[0]=='c': P=[(it[k].x,it[k].y) for k in (1,2,3,4)]; out.append(LineString([bez(P,t/8) for t in range(9)]))
    return out
p12,p7=doc[11],doc[6]
bnd=lines(p12,'JCE BASE|C-BNDY LINE'); hull=MultiPoint([c for l in bnd for c in l.coords]).convex_hull.simplify(2.0)
edges=[LineString([hull.exterior.coords[i],hull.exterior.coords[i+1]]) for i in range(len(hull.exterior.coords)-1)]
F=edges[1]  # Brezza frontage (verified in probe5)
def chains(page,layer):
    m=linemerge(unary_union(lines(page,layer))); return list(m.geoms) if m.geom_type=='MultiLineString' else [m]
demo=chains(p7,'JCE BASE|C-DEMO CONC'); foc=chains(p12,'JCE BASE|C-CURB FOC'); vconc=chains(p7,'JCE BASE|V-CONC-LINE')
print("DEMO chains: length ft, min dist to Brezza line ft, station of nearest point:")
for g in demo: np_=g.interpolate(g.project(Point(F.interpolate(F.project(Point(g.coords[0]))))));
for g in demo:
    d=g.distance(F)*FT; st=F.project(Point(min(g.coords,key=lambda c:Point(c).distance(F))))*FT
    print(f"  {g.length*FT:6.1f} ft  nearest {d:5.1f} ft off the line at station {st:6.1f}")
print("\nproposed FOC chains nearest the Brezza line (top 6):")
for g in sorted(foc,key=lambda g:g.distance(F))[:6]:
    c=min(g.coords,key=lambda c:Point(c).distance(F)); print(f"  len {g.length*FT:6.1f} ft  ends {g.distance(F)*FT:5.1f} ft off the line at station {F.project(Point(c))*FT:6.1f}")
print("\nexisting V-CONC-LINE chains crossing the Brezza line (station, length):")
for g in vconc:
    X=g.intersection(F)
    if X.is_empty: continue
    pts=[X] if X.geom_type=='Point' else list(X.geoms)
    for p in pts: print(f"  station {F.project(p)*FT:6.1f}  chain {g.length*FT:6.1f} ft")
# does the DEMO chain coincide with the east edge (station ~111) chain?
east=[g for g in vconc if not g.intersection(F).is_empty and abs(F.project(g.intersection(F) if g.intersection(F).geom_type=='Point' else list(g.intersection(F).geoms)[0])*FT-111)<1]
if east and demo:
    e=east[0]; d=max(demo,key=lambda g:g.length); print(f"\nHausdorff(east edge chain, longest DEMO chain) = {e.hausdorff_distance(d)*FT:.1f} ft; DEMO chain end nearest the line: {d.distance(F)*FT:.1f} ft off; east chain extends {e.length*FT:.0f} ft")
