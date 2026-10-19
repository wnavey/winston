import fitz, math, collections
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import linemerge, unary_union
PDF="/Users/wnavey/noetic/tmp/White-Water-Carwash/Whitewater Car Wash SP-2026-0216C/White Water Express Car Wash 071326.pdf"
doc=fitz.open(PDF); page=doc[11]
FT=20/72.0  # 1"=20' -> ft per pt
d=page.get_drawings()
def items(layer):
    out=[]
    for dr in d:
        if (dr.get('layer') or '')==layer: out+= [(it, dr) for it in dr['items']]
    return out
def bez_pts(it):
    p0,p1,p2,p3=it[1],it[2],it[3],it[4]
    return [(p0.x,p0.y),(p1.x,p1.y),(p2.x,p2.y),(p3.x,p3.y)]
def circle_from_3(a,b,c):
    ax,ay=a;bx,by=b;cx,cy=c
    D=2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by))
    if abs(D)<1e-9: return None
    ux=((ax*ax+ay*ay)*(by-cy)+(bx*bx+by*by)*(cy-ay)+(cx*cx+cy*cy)*(ay-by))/D
    uy=((ax*ax+ay*ay)*(cx-bx)+(bx*bx+by*by)*(ax-cx)+(cx*cx+cy*cy)*(bx-ax))/D
    return (ux,uy), math.hypot(ax-ux,ay-uy)
def bez_eval(P,t):
    x=(1-t)**3*P[0][0]+3*(1-t)**2*t*P[1][0]+3*(1-t)*t*t*P[2][0]+t**3*P[3][0]
    y=(1-t)**3*P[0][1]+3*(1-t)**2*t*P[1][1]+3*(1-t)*t*t*P[2][1]+t**3*P[3][1]
    return (x,y)
bnd=[it for it,dr in items('JCE BASE|C-BNDY LINE') if it[0]=='l']
bx=[p.x for it in bnd for p in (it[1],it[2])]; by=[p.y for it in bnd for p in (it[1],it[2])]
print("boundary bbox pt", min(bx),min(by),max(bx),max(by), "size ft", (max(bx)-min(bx))*FT, (max(by)-min(by))*FT)
for layer in ('JCE BASE|C-CURB FOC','JCE BASE|C-CURB BOC','JCE BASE|C-SIDEWALK','JCE BASE|C-EXIST CONC'):
    its=items(layer)
    lines=[LineString([(it[1].x,it[1].y),(it[2].x,it[2].y)]) for it,dr in its if it[0]=='l']
    curves=[it for it,dr in its if it[0]=='c']
    print(f"\n=== {layer}: {len(lines)} lines, {len(curves)} curves")
    # arc fit per bezier
    radii=[]
    for it in curves:
        P=bez_pts(it); a=P[0]; c=P[3]; b=bez_eval(P,0.5)
        r=circle_from_3(a,b,c)
        if r:
            ctr,R=r; chord=math.hypot(a[0]-c[0],a[1]-c[1])
            # sweep angle
            ang=2*math.asin(min(1,chord/(2*R)))
            radii.append((R*FT, math.degrees(ang), a, c, ctr))
    # group curves into arcs by shared centre
    groups=collections.defaultdict(list)
    for R,ang,a,c,ctr in radii: groups[(round(ctr[0]/2),round(ctr[1]/2),round(R,1))].append((R,ang,a,c))
    for k,g in sorted(groups.items(), key=lambda kv:-len(kv[1]))[:30]:
        print(f"  R={g[0][0]:7.2f} ft  sweep={sum(x[1] for x in g):6.1f}°  pieces={len(g)}  at pt({k[0]*2:.0f},{k[1]*2:.0f})")
    # chain lines + flattened curves
    segs=lines+[LineString([bez_eval(bez_pts(it),t/8) for t in range(9)]) for it in curves]
    merged=linemerge(unary_union(segs))
    parts=list(merged.geoms) if merged.geom_type=='MultiLineString' else [merged]
    parts.sort(key=lambda g:-g.length)
    print(f"  chains: {len(parts)}; longest ft:", [round(g.length*FT,1) for g in parts[:12]])
    print(f"  closed rings:", sum(1 for g in parts if g.is_ring))
