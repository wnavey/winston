import fitz, math
from shapely.geometry import LineString, MultiLineString, Point
from shapely.ops import linemerge, unary_union
PDF='/Users/wnavey/noetic/tmp/White-Water-Carwash/Whitewater Car Wash SP-2026-0216C/White Water Express Car Wash 071326.pdf'
FT=0.27778
doc=fitz.open(PDF)
def segs(pg, want):
    out={}
    for dr in doc[pg-1].get_drawings():
        lay=(dr.get('layer') or '(none)'); suf=lay.split('|')[-1]
        if suf not in want: continue
        for it in dr['items']:
            if it[0]=='l': out.setdefault(suf,[]).append(LineString([(it[1].x,it[1].y),(it[2].x,it[2].y)]))
            elif it[0]=='c':
                pts=[it[1],it[2],it[3],it[4]]
                out.setdefault(suf,[]).append(LineString([(q.x,q.y) for q in pts]))
            elif it[0]=='re':
                r=it[1]; out.setdefault(suf,[]).append(LineString([(r.x0,r.y0),(r.x1,r.y0),(r.x1,r.y1),(r.x0,r.y1),(r.x0,r.y0)]))
            elif it[0]=='qu':
                q=it[1]; out.setdefault(suf,[]).append(LineString([(q.ul.x,q.ul.y),(q.ur.x,q.ur.y),(q.lr.x,q.lr.y),(q.ll.x,q.ll.y),(q.ul.x,q.ul.y)]))
    return out
for pg in (7,12):
    print(f'=== sheet {pg}')
    L=segs(pg, {'C-DEMO CONC','C-EXIST CONC','V-CONC-LINE','C-SAWCUT','C-IC EXIST PAVING','C-CURB FOC','C-CURB BOC'})
    for k,v in L.items(): print(f'  {k:20s} {len(v):4d} items  {sum(x.length for x in v)*FT:8.1f} ft')
    if 'C-DEMO CONC' not in L: continue
    demo=unary_union(L['C-DEMO CONC']); dm=linemerge(demo) if demo.geom_type!='LineString' else demo
    chains=list(dm.geoms) if hasattr(dm,'geoms') else [dm]
    chains=sorted(chains,key=lambda c:-c.length)
    print('  demo chains (ft):',[round(c.length*FT,1) for c in chains][:6])
    for other in ('C-EXIST CONC','V-CONC-LINE','C-CURB FOC','C-CURB BOC'):
        if other not in L: continue
        U=unary_union(L[other])
        for tol_ft in (0.25, 0.75, 1.5):
            tol=tol_ft/FT
            buf=U.buffer(tol)
            covered=sum(c.intersection(buf).length for c in chains[:2])
            tot=sum(c.length for c in chains[:2])
            # reverse: how much of other lies within tol of demo
            rev=U.intersection(demo.buffer(tol)).length
            print(f'  {other:14s} tol {tol_ft:4.2f} ft: {covered/tot*100:5.1f}% of the two demo chains ({covered*FT:5.1f}/{tot*FT:5.1f} ft) lie within tol of it; {rev*FT:6.1f} ft of it lies within tol of the demo chains')
