"""Merge the research findings into one golden-set.json and copy every quoted source text.

Kept as the record of how golden-set.json was assembled (which research record each entry
came from, and the one quote fix). Its inputs lived in the 2026-10-20/21 session scratchpad
(`intake-golden/`), which is gone, so it cannot be re-run as is. To change the set, edit
golden-set.json directly, add evidence under evidence/<id>/, and re-run verify_quotes.py.

Usage (historical): python3 -I build_golden.py <intake-golden root> <out dir>
"""
import json, os, re, shutil, sys

ROOT, OUT = sys.argv[1], sys.argv[2]
SCRATCH = os.path.dirname(ROOT.rstrip('/'))

# (findings file, list key, name substring, id, state, tier, set, note)
PICK = [
    # Tier 1, core
    ('class1/findings.json', 'entries', 'Austin', 'austin-tx', 'TX', 1, 'core', None),
    ('class1/findings.json', 'entries', 'Fairfax', 'fairfax-county-va', 'VA', 1, 'core', None),
    ('class1/findings.json', 'entries', 'San Diego', 'san-diego-ca', 'CA', 1, 'core', None),
    ('class1/findings.json', 'entries', 'Georgetown', 'georgetown-tx', 'TX', 1, 'core', None),
    ('class1/findings.json', 'entries', 'Round Rock', 'round-rock-tx', 'TX', 1, 'core', None),
    ('class1/findings.json', 'entries', 'Montgomery County', 'montgomery-county-md', 'MD', 1, 'core', None),
    ('class1/findings.json', 'entries', 'El Paso', 'el-paso-tx', 'TX', 1, 'core',
     'Name the application: El Paso commercial building permits also bounce missing site plans inside formal review ("NO REVIEW PERFORMED 1. Missing site plan"); the gate is the DSDP/site plan Accela "Pre-Application Review".'),
    ('class2/findings.json', 'jurisdictions', 'Cedar Park', 'cedar-park-tx', 'TX', 1, 'core', None),
    # Tier 1, extended: thin or code-only lists (tests "any city-written list = Tier 1")
    ('class1/findings.json', 'entries', 'San Antonio', 'san-antonio-tx', 'TX', 1, 'extended',
     'No standalone site plan application; ~35k "Completeness Review" comments in Library historic_comments.'),
    ('step1/resort/findings.json', 'jurisdictions', 'Katy', 'katy-tx', 'TX', 1, 'extended',
     'Site plan reviewed inside the commercial building permit.'),
    ('step1/resort/findings.json', 'jurisdictions', 'Sunset Valley', 'sunset-valley-tx', 'TX', 1, 'extended', 'List is in the code only.'),
    ('step1/resort/findings.json', 'jurisdictions', 'Rockdale', 'rockdale-tx', 'TX', 1, 'extended', 'List is in the code only; no form, no practice evidence.'),
    ('step1/resort/findings.json', 'jurisdictions', 'Winchester', 'winchester-mo', 'MO', 1, 'extended', 'List is in the code only; no form, no practice evidence.'),
    ('step1/resort/findings.json', 'jurisdictions', 'Papillion', 'papillion-ne', 'NE', 1, 'extended', 'Hold only implied (clock runs on a complete application).'),
    ('step1/resort/findings.json', 'jurisdictions', 'West Sacramento', 'west-sacramento-ca', 'CA', 1, 'extended',
     'Moved from Tier 2: the CUP packet (2010) carries a 13-item site plan checklist and Design Review files inside the CUP.'),
    ('step1/resort/findings.json', 'jurisdictions', 'Heppner', 'heppner-or', 'OR', 1, 'extended', None),
    ('step1/resort/findings.json', 'jurisdictions', 'Kenansville', 'kenansville-nc', 'NC', 1, 'extended', None),
    # Tier 2
    ('step1/resort/findings.json', 'jurisdictions', 'Fremont', 'fremont-ne', 'NE', 2, 'core', None),
    ('step1/resort/findings.json', 'jurisdictions', 'Wallace', 'wallace-nc', 'NC', 2, 'extended',
     'Tier 1 with item_count 1 if the Zoning Verification form ("plat map or other suitable diagram") counts as the site plan list.'),
    ('step1/resort/findings.json', 'jurisdictions', 'Union County', 'union-county-nc', 'NC', 2, 'extended',
     'Unread county doc 1280 ("Commercial Development Plan Application", with a checklist) - every unioncountync.gov URL returned Akamai 403. If it is the site plan application, Tier 1.'),
    ('step1/t3mid/findings.json', 'jurisdictions', 'Dardenne Prairie', 'dardenne-prairie-mo', 'MO', 2, 'extended',
     'Provisional: code says "forthwith transmit", but a 2025 P&Z packet shows staff reviewing for completeness before distribution.'),
    ('step1/resort/findings.json', 'jurisdictions', 'Clinton', 'clinton-nc', 'NC', 2, 'extended', 'Low: may really be Tier 3.'),
    # Tier 3, core
    ('class3/findings.json', 'jurisdictions', 'Lenox', 'lenox-twp-mi', 'MI', 3, 'core', None),
    ('class3/findings.json', 'jurisdictions', 'Conway', 'conway-twp-mi', 'MI', 3, 'core',
     'The "proper documents" tabling motion is in the 2024-09-09 minutes (not 08-12).'),
    ('class3/findings.json', 'jurisdictions', 'Bangor', 'bangor-twp-mi', 'MI', 3, 'core', None),
    ('step1/t3firm/findings.json', 'jurisdictions', 'Decorah', 'decorah-ia', 'IA', 3, 'core',
     'Publishes a site plan checklist but has no hold: a list without a hold is still Tier 3. Hard test for any "checklist published" classifier.'),
    ('step1/t3south/findings.json', 'jurisdictions', 'Greencastle', 'greencastle-pa', 'PA', 3, 'core',
     'Risks: the form needs copies + fee "before the application will be accepted"; the PC "accepts the submission" at its own meeting.'),
    ('step1/t3mid/findings.json', 'jurisdictions', 'Watertown', 'watertown-wi', 'WI', 3, 'core',
     'Contrast inside one code: rezonings/CUPs must be "certified as complete"; site plans are not.'),
    # Tier 3, extended
    ('class3/findings.json', 'jurisdictions', 'Cohoctah', 'cohoctah-twp-mi', 'MI', 3, 'extended', None),
    ('step1/t3mid/findings.json', 'jurisdictions', 'Saukville', 'saukville-wi', 'WI', 3, 'extended', None),
    ('step1/t3mid/findings.json', 'jurisdictions', 'Southern View', 'southern-view-il', 'IL', 3, 'extended', None),
    ('step1/t3south/findings.json', 'jurisdictions', 'Carthage', 'carthage-tn', 'TN', 3, 'extended',
     'Tennessee Public Chapter 1044 mandates written incomplete-submittal notice for plans submitted from 2027-01-01.'),
    ('step1/t3firm/findings.json', 'jurisdictions', 'Paris', 'paris-tn', 'TN', 3, 'extended',
     'Tier 3 as of 2026 only (TN Public Chapter 1044 from 2027-01-01).'),
    ('step1/t3firm/findings.json', 'jurisdictions', 'Antis', 'antis-twp-pa', 'PA', 'open', 'extended',
     'Open question Q1: page and form wording reads as a hold + 5-item list (Tier 1), but 57 sets of minutes show no refusal and gaps are tabled (Tier 3 in practice).'),
]

EMBEDDED = re.compile(r'(?:/private/tmp/[^\s"),;]+|\b(?:class\d|step1|notes|web|db2?)/[^\s"),;]+)\.(?:txt|pdf|html?|json|md|tsv)(?::[~\d,-]+)?')
TEXTY = ('.txt', '.md', '.json', '.tsv', '.csv')
PATHLIKE = re.compile(r'^(/private/tmp/\S+?|[\w./~-]+/[\w.()%-]+\.(?:txt|pdf|html?|json|md|tsv|bin|png))(:[~\d,-]+)?$')


def resolve(p, base):
    p = re.sub(r':[~\d,-]+$', '', p)
    for b in ('', base, ROOT, SCRATCH, os.path.join(ROOT, 'class3'), os.path.join(ROOT, 'step1')):
        q = os.path.join(b, p) if b else p
        if os.path.isfile(q):
            return q
    return None


def textify(path):
    if path.endswith(TEXTY):
        return path
    stem = os.path.splitext(path)[0]
    for ext in ('.txt', '_norm.txt'):
        if os.path.isfile(stem + ext):
            return stem + ext
    return None


out = {'generated': '2026-10-21', 'jurisdictions': []}
missing = []
for f, key, needle, jid, st, tier, sset, note in PICK:
    recs = [r for r in json.load(open(os.path.join(ROOT, f)))[key] if needle in (r.get('jurisdiction') or r.get('name'))]
    assert len(recs) == 1, (f, needle, len(recs))
    rec = recs[0]
    base = os.path.dirname(os.path.join(ROOT, f))
    edir = os.path.join(OUT, 'evidence', jid)
    copied = {}

    def copy(path, suffix):
        """Copy one cited file's text into evidence/<id>/; return its new path or None."""
        src = resolve(path, base)
        txt = textify(src) if src else None
        if not txt:
            return None
        name = os.path.basename(txt)
        if name in copied and copied[name] != txt:
            name = f'{len(copied)}-{name}'
        copied.setdefault(name, txt)
        os.makedirs(edir, exist_ok=True)
        shutil.copyfile(txt, os.path.join(edir, name))
        return f'evidence/{jid}/{name}' + (suffix or '')

    def walk(v):
        if isinstance(v, dict):
            return {k: walk(x) for k, x in v.items()}
        if isinstance(v, list):
            return [walk(x) for x in v]
        if not isinstance(v, str):
            return v
        m = PATHLIKE.match(v.strip())
        if m:
            new = copy(m.group(1), m.group(2))
            if new is None:
                missing.append((jid, v))
                return v + '  [not copied]'
            return new
        for m in reversed(list(EMBEDDED.finditer(v))):
            p = re.sub(r':[~\d,-]+$', '', m.group(0))
            new = copy(p, m.group(0)[len(p):])
            if new is not None:
                v = v[:m.start()] + new + v[m.end():]
        return v

    research = walk(rec)
    out['jurisdictions'].append({
        'id': jid,
        'jurisdiction': rec.get('jurisdiction') or rec.get('name'),
        'state': st,
        'tier': tier,
        'gate': {1: 'yes', 2: 'yes', 3: 'no'}.get(tier, 'open'),
        'confidence': rec.get('confidence'),
        'set': sset,
        'application': rec.get('application') or rec.get('scope_application'),
        'as_of': rec.get('accessed') or rec.get('generated') or '2026-10-20/21',
        'note': note,
        'research': research,
    })

# quote corrections found by verify_quotes.py against the saved text
FIXES = {('georgetown-tx', '(no greater than five working days)'): '(not greater than five working days)'}
blob = json.dumps(out, ensure_ascii=False)
for (jid, wrong), right in FIXES.items():
    assert wrong in blob, wrong
    blob = blob.replace(wrong, right)
out = json.loads(blob)
json.dump(out, open(os.path.join(OUT, 'golden-set.json'), 'w'), indent=1, ensure_ascii=False)
print(len(out['jurisdictions']), 'entries;', len(missing), 'paths not copied')
for m in missing:
    print('  not copied:', m)
