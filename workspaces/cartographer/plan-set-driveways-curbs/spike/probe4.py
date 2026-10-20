import fitz, math, collections
from shapely.geometry import LineString, Polygon, Point, box
from shapely.ops import linemerge, unary_union
PDF="/Users/wnavey/noetic/tmp/White-Water-Carwash/Whitewater Car Wash SP-2026-0216C/White Water Express Car Wash 071326.pdf"
doc=fitz.open(PDF); FT=20/72.0
def bez_eval(P,t):
    return ((1-t)**3*P[0][0]+3*(1-t)**2*t*P[1][0]+3*(1-t)*t*t*P[2][0]+t**3*P[3][0],(1-t)**3*P[0][1]+3*(1-t)**2*t*P[1][1]+3*(1-t)*t*t*P[2][1]+t**3*P[3][1])
def layer_lines(page, layer):
    out=[]
    for dr in page.get_drawings():
        if (dr.get('layer') or '')!=layer: continue
        for it in dr['items']:
            if it[0]=='l': out.append(LineString([(it[1].x,it[1].y),(it[2].x,it[2].y)]))
            elif it[0]=='c':
                P=[(it[k].x,it[k].y) for k in (1,2,3,4)]; out.append(LineString([bez_eval(P,t/8) for t in range(9)]))
            elif it[0]=='re':
                r=it[1]; out.append(box(r.x0,r.y0,r.x1,r.y1).exterior)
            elif it[0]=='qu':
                q=it[1]; out.append(Polygon([(q.ul.x,q.ul.y),(q.ur.x,q.ur.y),(q.lr.x,q.lr.y),(q.ll.x,q.ll.y)]).exterior)
    return out
p12=doc[11]; p7=doc[6]
bnd=layer_lines(p12,'JCE BASE|C-BNDY LINE'); B=unary_union(bnd).bounds
lot=box(*B); print("lot bbox pt",[round(v) for v in B])
# the lot is rotated; build the convex hull of dash endpoints as the lot polygon
pts=[c for l in bnd for c in l.coords]; from shapely.geometry import MultiPoint
lotpoly=MultiPoint(pts).convex_hull; print("lot hull area ft2", round(lotpoly.area*FT*FT))
for pg,page in ((12,p12),(7,p7)):
    print(f"\n=== sheet {pg}: extent beyond the lot, ft (neg = inside) [left, top, right, bottom in page space]")
    for lay in ('JCE BASE|V-ASPHALT-LINE','JCE BASE|V-CONC-LINE','JCE BASE|V-BNDY-ADJ-LINE','JCE BASE|C-EXIST CONC','JCE BASE|C-SAWCUT','JCE BASE|C-DEMO CONC','C-IC EXIST PAVING','JCE BASE|V-ESMT-LINE','JCE BASE|V-ROAD-TEXT','JCE BASE|C-CURB FOC','JCE BASE|C-SIDEWALK','JCE BASE|V-FENCE-METAL'):
        ls=layer_lines(page,lay)
        if not ls: continue
        b=unary_union(ls).bounds
        ext=[(B[0]-b[0])*FT,(B[1]-b[1])*FT,(b[2]-B[2])*FT,(b[3]-B[3])*FT]
        outside=sum(l.length for l in ls if not l.within(lotpoly))*FT; total=sum(l.length for l in ls)*FT
        print(f"  {lay:32s} n={len(ls):4d} total {total:7.0f} ft, outside lot {outside:6.0f} ft; extent beyond lot {[round(e) for e in ext]}")
# which edge is the street: V-ROAD-TEXT centroid vs lot
rt=unary_union(layer_lines(p12,'JCE BASE|V-ROAD-TEXT')); c=rt.centroid; lc=lotpoly.centroid
print("\nroad text centroid rel. to lot centroid (pt):", round(c.x-lc.x), round(c.y-lc.y), " lot centroid", round(lc.x), round(lc.y))
asp=unary_union(layer_lines(p12,'JCE BASE|V-ASPHALT-LINE')); print("asphalt line bounds", [round(v) for v in asp.bounds], "centroid", round(asp.centroid.x), round(asp.centroid.y))
# closed rings in V-CONC-LINE on sheet 7 (existing driveways/pads) and their sizes
for pg,page,lay in ((7,p7,'JCE BASE|V-CONC-LINE'),(7,p7,'JCE BASE|C-DEMO CONC'),(7,p7,'C-IC EXIST PAVING'),(12,p12,'JCE BASE|C-SAWCUT')):
    m=linemerge(unary_union(layer_lines(page,lay))); parts=list(m.geoms) if m.geom_type=='MultiLineString' else [m]
    rings=[g for g in parts if g.is_ring]; print(f"\nsheet {pg} {lay}: {len(parts)} chains, {len(rings)} rings; chain lengths ft:", sorted([round(g.length*FT) for g in parts],reverse=True)[:12])
    for g in rings:
        P=Polygon(g); mb=P.minimum_rotated_rectangle; e=list(mb.exterior.coords); d1=math.dist(e[0],e[1])*FT; d2=math.dist(e[1],e[2])*FT
        print(f"   ring area {P.area*FT*FT:7.0f} ft2, {d1:.1f} x {d2:.1f} ft, centroid rel lot ({(P.centroid.x-lc.x)*FT:.0f},{(P.centroid.y-lc.y)*FT:.0f}) ft, inside lot: {P.centroid.within(lotpoly)}")
