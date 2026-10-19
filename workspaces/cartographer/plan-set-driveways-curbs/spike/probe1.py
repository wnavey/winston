import fitz, re, collections, sys
PDF="/Users/wnavey/noetic/tmp/White-Water-Carwash/Whitewater Car Wash SP-2026-0216C/White Water Express Car Wash 071326.pdf"
doc=fitz.open(PDF)
# sheet titles via text
for i in range(len(doc)):
    p=doc[i]; words=[w[4] for w in p.get_text("words")]
    t=" ".join(words)
    m=re.findall(r'(SITE PLAN|PAVING PLAN|EXISTING CONDITIONS|DEMOLITION|GRADING|DRAINAGE|UTILITY|EROSION|LANDSCAPE|DETAILS?|DRIVEWAY|CURB|TRAFFIC|SIGHT|FIRE|TREE|OVERALL|DIMENSION)',t.upper())
    print(i+1, sorted(set(m)), len(words))
for pg in (7,12,13):
    p=doc[pg-1]; d=p.get_drawings()
    by=collections.defaultdict(lambda: collections.Counter())
    for dr in d:
        lay=dr.get('layer') or '(none)'
        for it in dr['items']: by[lay][it[0]]+=1
    print("\n=== sheet",pg, "paths",len(d))
    for lay,c in sorted(by.items()):
        if re.search(r'CURB|DRIVE|DRWY|PAV|ROW|R\.O\.W|SIDEWALK|SWLK|ROAD|STREET|EDGE|EOP|DIM|RADIUS|EXIST|DEMO|X-|E-|BNDY|CL\b|CENTER',lay,re.I):
            print(f"  {lay:40s} {dict(c)}")
