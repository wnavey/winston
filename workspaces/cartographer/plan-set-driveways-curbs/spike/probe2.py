import fitz, re, collections
PDF="/Users/wnavey/noetic/tmp/White-Water-Carwash/Whitewater Car Wash SP-2026-0216C/White Water Express Car Wash 071326.pdf"
doc=fitz.open(PDF)
p1=doc[0]; t=p1.get_text()
i=t.upper().find("SHEET INDEX"); print(t[i:i+1800] if i>=0 else t[:1500])
print("\n=== words on sheet 12"); print(" | ".join(w[4] for w in doc[11].get_text("words")))
print("\n=== words on sheet 7"); print(" | ".join(w[4] for w in doc[6].get_text("words")))
for pg in (7,12):
    d=doc[pg-1].get_drawings(); by=collections.defaultdict(lambda: collections.Counter())
    for dr in d:
        for it in dr['items']: by[dr.get('layer') or '(none)'][it[0]]+=1
    print(f"\n=== ALL layers sheet {pg}")
    for lay,c in sorted(by.items()): print(f"  {lay:40s} {dict(c)}")
