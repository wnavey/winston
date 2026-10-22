"""Check every gate quote in the backfilled intake.yaml files (DESIGN-SPEC D9) against a copy we still hold.

p03's 1.3-capture/snapshots were deleted, and 1.4's contract checks a quote's source key, never its text
(bureau runbooks/intake-prospecting/lib/intake.ts), so before P3 merges each committed quote is checked against:

- bureau's own code copy, for a Municode section bureau holds (Austin's LDC, El Paso's zoning code);
- the bucket snapshot whose URL matches, read from a local copy of the same capture (the 10-15 El Paso run's
  1.3-capture/snapshots/<sid>, byte-identical to cc-source-snapshots/el-paso/<sid>/text/); when the quote names a
  word range (`words: p2w21-p2w65`) the words in that range must also read as the quote;
- else the live page, fetched for the check.

Normalized as ../tiers-golden-set/verify_quotes.py does (whitespace, ligatures, curly quotes, bullets, "Page N of M").
Exits 1 on any miss. Needs PyYAML. Run with the files P3 commits:

    python3 check_backfill_quotes.py --root <dir holding jurisdictions/> --bureau ~/noetic/bureau \
        --snapshots ~/noetic/working/intake-prospecting/el-paso/1.3-capture/snapshots
"""
import argparse, glob, html, json, os, re, sys, urllib.request

import yaml

LIG = str.maketrans({'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', '’': "'", '‘': "'",
                     '“': '"', '”': '"', '•': ' ', '­': ''})

# where bureau keeps the code sections the backfilled quotes cite (relative to the bureau checkout)
BUREAU_CODES = {
    'code-20-04-150-dsdp-procedure': 'jurisdictions/el-paso/codes/zoning/contents/Chapter 20.04 - ADMINISTRATIVE PROVISIONS/Article III. - Detailed Site Development Plan Approval Process/20.04.150 - Procedure.md',
    'code-20-04-260-special-permits': 'jurisdictions/el-paso/codes/zoning/contents/Chapter 20.04 - ADMINISTRATIVE PROVISIONS/Article V. - Special Permit Approval Process/20.04.260 - Special permits generally.md',
    'ldc-25-1-82': 'jurisdictions/austin/codes/ldc/contents/Title 25. - Land Development./Chapter 25-1. - General Requirements and Procedures./Article 4. - Application and Approval./Division 2. - Filing; Review./§ 25-1-82 - Non-Subdivision Application Requirements and Expiration..md',
}


def norm(s):
    s = re.sub(r'Page \d+ of \d+', ' ', s.translate(LIG))
    return re.sub(r'\s+', ' ', s).strip()


def snapshot_for(bureau, slug, url):
    """The bucket snapshot of this exact URL, per the jurisdiction's manifest on bureau main (D4's join)."""
    p = os.path.join(bureau, 'jurisdictions', slug, 'completeness-check', 'sources', 'manifest.json')
    if not os.path.exists(p):
        return None
    for sid, s in json.load(open(p))['snapshots'].items():
        if url in (s.get('url'), s.get('source_key')):
            return sid
    return None


def tokens(snapdir, sid):
    """{word id: word} over the snapshot's pages, from text/NNN.tokens.txt (`p2w21:Each p2w22:item …`)."""
    out = {}
    for f in sorted(glob.glob(os.path.join(snapdir, sid, 'text', '*.tokens.txt'))):
        for m in re.finditer(r'(p\d+w\d+):(\S+)', open(f).read()):
            out[m.group(1)] = m.group(2)
    return out


def live_text(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (noetic quote check)'})
    body = urllib.request.urlopen(req, timeout=60).read().decode('utf-8', 'ignore')
    body = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', body)
    return html.unescape(re.sub(r'<[^>]+>', ' ', body))


def check(q, bureau, snapdir, slug):
    quote, src, url = norm(q['quote']), q['source'], q['url']
    if src in BUREAU_CODES:
        return 'bureau code copy', quote in norm(open(os.path.join(bureau, BUREAU_CODES[src])).read())
    sid = snapshot_for(bureau, slug, url)
    if sid and snapdir and os.path.isdir(os.path.join(snapdir, sid)):
        words = tokens(snapdir, sid)
        found = quote in norm(' '.join(words.values()))
        if found and q.get('words'):
            first, last = q['words'].split('-')
            ids = list(words)
            found = norm(' '.join(words[i] for i in ids[ids.index(first):ids.index(last) + 1])) == quote
        return f'bucket snapshot {sid}' + (f' {q["words"]}' if q.get('words') else ''), found
    return 'live page', quote in norm(live_text(url))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', required=True, help='a directory holding jurisdictions/<slug>/intake.yaml (the files P3 commits)')
    ap.add_argument('--bureau', required=True, help='a bureau checkout on main: the code copies and the manifests')
    ap.add_argument('--snapshots', help='a local copy of the bucket snapshots, one <sid>/ folder each')
    a = ap.parse_args()
    misses = 0
    for p in sorted(glob.glob(os.path.join(a.root, 'jurisdictions', '*', 'intake.yaml'))):
        slug = p.split(os.sep)[-2]
        y = yaml.safe_load(open(p))
        for i, q in enumerate((y.get('classification') or {}).get('gate_evidence', [])):
            where, ok = check(q, a.bureau, a.snapshots, slug)
            misses += not ok
            print(f'{"ok  " if ok else "MISS"} {slug} #{i + 1} {q["kind"]:12} {q["source"]:32} {where}')
            if not ok:
                print(f'       {q["quote"][:160]!r}')
    print(f'{misses} missing')
    return 1 if misses else 0


if __name__ == '__main__':
    sys.exit(main())
