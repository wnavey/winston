import fitz, math, collections
from shapely.geometry import LineString, Polygon, Point, MultiPoint, box
from shapely.ops import linemerge, unary_union, nearest_points
PDF="/Users/wnavey/noetic/tmp/White-Water-Carwash/Whitewater Car Wash SP-2026-0216C/White Water Express Car Wash 071326.pdf"
doc=fitz.open(PDF); FT=20/72.0
def bez_eval(P,t):
    return ((1-t)**3*P[0][0]+3*(1-t)**2*t*P[1][0]+3*(1-t)*t*t*P[2][0]+t**3*P[3][0],(1-t)**3*P[0][1]+3*(1-t)**2*t*P[1][1]+3*(1-t)*t*t*P[2][1]+t**3*P[3][1])
def circle_from_3(a,b,c):
    ax,ay=a;bx,by=b;cx,cy=c
    D=2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by))
    if abs(D)<1e-9: return None
    ux=((ax*ax+ay*ay)*(by-cy)+(bx*bx+by*by)*(cy-ay)+(cx*cx+cy*cy)*(ay-by))/D
    uy=((ax*ax+ay*ay)*(cx-bx)+(bx*bx+by*by)*(ax-cx)+(cx*cx+cy*cy)*(bx-ax))/D
    return (ux,uy), math.hypot(ax-ux,ay-uy)
def layer_items(page, layer):
    lines=[];arcs=[]
    for dr in page.get_drawings():
        if (dr.get('layer') or '')!=layer: continue
        for it in dr['items']:
            if it[0]=='l': lines.append(LineString([(it[1].x,it[1].y),(it[2].x,it[2].y)]))
            elif it[0]=='c':
                P=[(it[k].x,it[k].y) for k in (1,2,3,4)]
                r=circle_from_3(P[0],bez_eval(P,0.5),P[3]); arcs.append((P,r)); lines.append(LineString([bez_eval(P,t/8) for t in range(9)]))
    return lines,arcs
page=doc[11]
bnd,_=layer_items(page,'JCE BASE|C-BNDY LINE')
hull=MultiPoint([c for l in bnd for c in l.coords]).convex_hull
hull=hull.simplify(2.0)  # pentagon
print("lot hull vertices:", len(hull.exterior.coords)-1, "area ft2", round(hull.area*FT*FT))
edges=[LineString([hull.exterior.coords[i],hull.exterior.coords[i+1]]) for i in range(len(hull.exterior.coords)-1)]
asp,_=layer_items(page,'JCE BASE|V-ASPHALT-LINE'); aspU=unary_union(asp)
for i,e in enumerate(edges):
    print(f"  edge {i}: len {e.length*FT:6.1f} ft, mid {tuple(round(v) for v in e.interpolate(0.5,normalized=True).coords[0])}, dist to asphalt edge {e.distance(aspU)*FT:5.1f} ft")
front=min(range(len(edges)), key=lambda i: edges[i].distance(aspU)); F=edges[front]
print("frontage = edge", front, "length", round(F.length*FT,2),"ft")
# asphalt line offset from the frontage: sample
d=[F.interpolate(t,normalized=True).distance(aspU)*FT for t in (0.1,0.3,0.5,0.7,0.9)]; print("P/L to edge of pavement, ft:", [round(x,1) for x in d])
# adjacent lot lines across the street? V-BNDY-ADJ-LINE
adj,_=layer_items(page,'JCE BASE|V-BNDY-ADJ-LINE')
print("adj lot lines: dist from frontage edge, ft:", sorted(set(round(l.distance(F)*FT) for l in adj)))
# curb FOC chains crossing the frontage
for lay in ('JCE BASE|C-CURB FOC','JCE BASE|C-CURB BOC','JCE BASE|C-SIDEWALK'):
    ls,arcs=layer_items(page,lay)
    m=linemerge(unary_union(ls)); parts=list(m.geoms) if m.geom_type=='MultiLineString' else [m]
    xs=[]
    for g in parts:
        X=g.intersection(F)
        if X.is_empty: continue
        pts=[X] if X.geom_type=='Point' else list(getattr(X,'geoms',[]))
        for p in pts: xs.append(F.project(p)*FT)
    xs.sort(); print(f"\n{lay}: crosses the P/L at station(s) ft along frontage: {[round(x,2) for x in xs]}")
    if len(xs)>=2: print("   gaps between successive crossings (driveway width at P/L?):", [round(xs[i+1]-xs[i],2) for i in range(len(xs)-1)])
    # arcs near the frontage (centre within 40 ft)
    near=collections.defaultdict(list)
    for P,r in arcs:
        if not r: continue
        ctr,R=r; dist=Point(ctr).distance(F)*FT
        if dist<45: near[(round(ctr[0]),round(ctr[1]),round(R*FT,1))].append(P)
    for k,v in sorted(near.items()):
        print(f"   return arc R={k[2]:5.1f} ft, centre at station {F.project(Point(k[0],k[1]))*FT:6.1f} ft, {Point(k[0],k[1]).distance(F)*FT:5.1f} ft off the P/L, {len(v)} bezier piece(s)")
# existing driveway: sheet 7 C-IC EXIST PAVING ring vs frontage, C-DEMO CONC
p7=doc[6]
for lay in ('C-IC EXIST PAVING','JCE BASE|C-DEMO CONC','JCE BASE|V-CONC-LINE'):
    ls,_=layer_items(p7,lay); m=linemerge(unary_union(ls)); parts=list(m.geoms) if m.geom_type=='MultiLineString' else [m]
    xs=[]
    for g in parts:
        X=g.intersection(F)
        if X.is_empty: continue
        pts=[X] if X.geom_type=='Point' else list(getattr(X,'geoms',[]))
        for p in pts: xs.append(round(F.project(p)*FT,1))
    print(f"\nsheet 7 {lay}: crosses the P/L at stations {sorted(xs)}")
# sheet 12 C-SAWCUT: where is it?
ls,_=layer_items(page,'JCE BASE|C-SAWCUT'); U=unary_union(ls); print("\nsawcut dist to P/L ft:", round(U.distance(F)*FT,1), "station range", round(F.project(nearest_points(F,U)[0])*FT,1))
