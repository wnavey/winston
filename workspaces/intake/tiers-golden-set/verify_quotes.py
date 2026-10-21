"""Check every quote in golden-set.json against the evidence file it cites.

A quote is checked when its object also names a local file (`file`, `local_file` or `cite`) under
evidence/. Whitespace, ligatures, curly quotes, bullets and "Page N of M" are normalised;
nothing else is. A quote with elisions ("...", "…") or table/bullet separators (" | ", " / ")
is checked fragment by fragment. Run from this directory:

    python3 -I verify_quotes.py            # summary per jurisdiction
    python3 -I verify_quotes.py --misses   # also print each quote that was not found
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
LIG = str.maketrans({'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', '’': "'", '‘': "'",
                     '“': '"', '”': '"', '•': ' ', '­': ''})


def norm(s):
    s = re.sub(r'Page \d+ of \d+', ' ', s.translate(LIG))
    return re.sub(r'\s+', ' ', s).strip()


def in_order(frag, text):
    """Fallback for PDF layouts that interleave two columns: the fragment's words appear in
    order within a window of three times its length."""
    words = frag.split()
    i = text.find(words[0])
    while i >= 0:
        j, end = i, i + 3 * len(frag)
        for w in words:
            j = text.find(w, j)
            if j < 0 or j > end:
                break
            j += len(w)
        else:
            return True
        i = text.find(words[0], i + 1)
    return False


def quotes(v):
    if isinstance(v, dict):
        f = v.get('local_file') or v.get('file') or v.get('cite')
        m = re.search(r'evidence/[^\s:;,)]+', f) if isinstance(f, str) else None
        if isinstance(v.get('quote'), str) and m:
            yield v['quote'], m.group(0)
        for x in v.values():
            yield from quotes(x)
    elif isinstance(v, list):
        for x in v:
            yield from quotes(x)


gs = json.load(open(os.path.join(HERE, 'golden-set.json')))
total = bad = layout = 0
for j in gs['jurisdictions']:
    ok = miss = 0
    for q, f in quotes(j['research']):
        text = norm(open(os.path.join(HERE, f), errors='ignore').read())
        parts = [norm(p) for p in re.split(r'\s*(?:\.\.\.|…| \| | / )\s*', q) if len(norm(p)) > 12]
        if parts and all(p in text for p in parts):
            ok += 1
        elif parts and all(p in text or in_order(p, text) for p in parts):
            ok += 1
            layout += 1
        else:
            miss += 1
            if '--misses' in sys.argv:
                print(f'  MISS {j["id"]}: {q[:120]!r} in {f}')
    total += ok + miss
    bad += miss
    print(f'{j["id"]:24} tier {j["tier"]!s:5} {j["set"]:8} checked {ok + miss:3}  missing {miss}')
print(f'total checked {total}, missing {bad} ({layout} matched only word-in-order: PDF column layout)')
