#!/usr/bin/env python3
"""Winston spec IDs — FEAT-N, ARCH-N, BUG-N, NOTE-N — allocated from INDEX.md at the repo root.

    spec-id.py next FEAT                      # the next free ID for a prefix
    spec-id.py add FEAT workspaces/x/y/DESIGN-SPEC.md [--title "..."] [--status draft]
                                              # allocate, write `**ID:** FEAT-N` under the H1, append the INDEX row
    spec-id.py resolve FEAT-4                 # print the path (and title) for an ID
    spec-id.py list [--kind feature] [--status draft] [--grep word]
    spec-id.py set-status FEAT-4 shipped      # update the INDEX row (and the file's **Status:** line if it has one)
    spec-id.py check                          # every row's file exists + header matches; every spec has a row; no dup IDs

INDEX.md is the registry and the collision guard: two boxes allocating the same number collide
on `git pull --rebase` of INDEX.md, and the loser re-runs `add`. Numbers are per prefix and never
reused. Kind is implied by the prefix (FEAT=feature, ARCH=architecture, BUG=bug, NOTE=note);
reports are not in winston (IG catalog).
"""
import sys, re, pathlib, argparse, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / 'INDEX.md'
PREFIX_KIND = {'FEAT': 'feature', 'ARCH': 'architecture', 'BUG': 'bug', 'NOTE': 'note'}
ROW = re.compile(r'^\| (FEAT|ARCH|BUG|NOTE)-(\d+) \| ([^|]*) \| ([^|]*) \| (.*?) \| ([^|]*) \| ([^|]*) \|$')
HEADER = """# Winston spec index

Every spec, bug writeup and note in this repo has an ID: `FEAT-N` (feature spec),
`ARCH-N` (architecture spec), `BUG-N` (bug writeup), `NOTE-N` (note). Say the ID to a
session — "look at FEAT-4" — and it resolves here. Allocate with `tools/spec-id.py add`,
never by hand; numbers are per prefix and never reused. Rows sorted by prefix then number.

| ID | Kind | Status | Title | Path | Created |
|---|---|---|---|---|---|
"""

def load():
    rows = []
    if INDEX.exists():
        for line in INDEX.read_text().splitlines():
            m = ROW.match(line)
            if m:
                rows.append(dict(prefix=m[1], num=int(m[2]), kind=m[3].strip(), status=m[4].strip(),
                                 title=m[5].strip(), path=m[6].strip().strip('`'), created=m[7].strip()))
    return rows

def save(rows):
    order = ['FEAT', 'ARCH', 'BUG', 'NOTE']
    rows.sort(key=lambda r: (order.index(r['prefix']), r['num']))
    body = ''.join(f"| {r['prefix']}-{r['num']} | {r['kind']} | {r['status']} | {r['title'].replace('|','/')} | `{r['path']}` | {r['created']} |\n" for r in rows)
    INDEX.write_text(HEADER + body)

def ident(r): return f"{r['prefix']}-{r['num']}"

def parse_id(s):
    m = re.fullmatch(r'(feat|arch|bug|note)-(\d+)', s.strip(), re.I)
    if not m: sys.exit(f"not an ID: {s!r} (want FEAT-4, ARCH-2, BUG-7, NOTE-1)")
    return m[1].upper(), int(m[2])

def next_num(rows, prefix):
    return 1 + max([r['num'] for r in rows if r['prefix'] == prefix], default=0)

def h1_of(text, fallback):
    return next((l[2:].strip() for l in text.splitlines() if l.startswith('# ')), fallback)

def file_id(text):
    m = re.search(r'^\*\*ID:\*\*\s*([A-Z]+-\d+)', text, re.M)
    return m[1] if m else None

def write_id_header(path: pathlib.Path, id_: str):
    """Insert `**ID:** X` as the first header line under the H1. No-op if an ID line exists."""
    text = path.read_text()
    if file_id(text):
        if file_id(text) != id_: sys.exit(f"{path} already carries {file_id(text)}, not {id_}")
        return
    lines = text.splitlines(keepends=True)
    i = next((k for k, l in enumerate(lines) if l.startswith('# ')), None)
    if i is None: sys.exit(f"{path}: no H1 to anchor the ID header under")
    j = i + 1
    while j < len(lines) and lines[j].strip() == '': j += 1
    nxt = lines[j] if j < len(lines) else ''
    if nxt.startswith('**'):
        lines.insert(j, f"**ID:** {id_}  \n")           # joins the existing header block
    else:
        lines.insert(i + 1, f"\n**ID:** {id_}\n")        # own paragraph
    path.write_text(''.join(lines))

def cmd_next(a):
    print(f"{a.prefix}-{next_num(load(), a.prefix)}")

def cmd_add(a):
    rows = load()
    p = pathlib.Path(a.path)
    rel = str(p.resolve().relative_to(ROOT)) if p.is_absolute() or p.exists() else a.path
    if not (ROOT / rel).exists(): sys.exit(f"no such file: {rel}")
    for r in rows:
        if r['path'] == rel: sys.exit(f"{rel} is already {ident(r)}")
    text = (ROOT / rel).read_text()
    existing = file_id(text)
    if existing: sys.exit(f"{rel} already has a header ID {existing} but no INDEX row — fix INDEX.md by hand")
    n = next_num(rows, a.prefix)
    r = dict(prefix=a.prefix, num=n, kind=PREFIX_KIND[a.prefix], status=a.status,
             title=a.title or h1_of(text, pathlib.Path(rel).stem), path=rel,
             created=a.created or datetime.date.today().isoformat())
    write_id_header(ROOT / rel, ident(r))
    rows.append(r); save(rows); print(ident(r))

def cmd_resolve(a):
    prefix, num = parse_id(a.id)
    for r in load():
        if r['prefix'] == prefix and r['num'] == num:
            print(f"{r['path']}\t{r['kind']}\t{r['status']}\t{r['title']}"); return
    sys.exit(f"{prefix}-{num}: not in INDEX.md")

def cmd_list(a):
    for r in load():
        if a.kind and r['kind'] != a.kind: continue
        if a.status and r['status'] != a.status: continue
        if a.grep and a.grep.lower() not in (r['title'] + ' ' + r['path']).lower(): continue
        print(f"{ident(r):9} {r['status']:11} {r['created']}  {r['title'][:70]:70}  {r['path']}")

def cmd_set_status(a):
    prefix, num = parse_id(a.id); rows = load()
    r = next((r for r in rows if r['prefix'] == prefix and r['num'] == num), None)
    if not r: sys.exit(f"{a.id}: not in INDEX.md")
    r['status'] = a.status; save(rows)
    p = ROOT / r['path']; text = p.read_text()
    new, n = re.subn(r'^\*\*Status:\*\*.*$', f"**Status:** {a.status}", text, count=1, flags=re.M)
    if n: p.write_text(new)
    print(f"{ident(r)} -> {a.status}" + ("" if n else "  (no **Status:** line in the file; INDEX only)"))

def cmd_check(a):
    rows = load(); bad = 0
    seen = {}
    for r in rows:
        if ident(r) in seen: print(f"DUP   {ident(r)}"); bad += 1
        seen[ident(r)] = r
        p = ROOT / r['path']
        if not p.exists(): print(f"GONE  {ident(r)}  {r['path']}"); bad += 1; continue
        fid = file_id(p.read_text())
        if fid != ident(r): print(f"HDR   {ident(r)}  file says {fid}  {r['path']}"); bad += 1
    indexed = {r['path'] for r in rows}
    import subprocess
    tracked = set(subprocess.run(['git', 'ls-files', 'workspaces'], capture_output=True, text=True, cwd=ROOT).stdout.split('\n'))
    specs = [p for p in ROOT.glob('workspaces/**/DESIGN-SPEC.md')] + [p for p in ROOT.glob('workspaces/**/bugs/**/*.md')]
    for p in sorted(specs):
        rel = str(p.relative_to(ROOT))
        if rel not in indexed and rel in tracked: print(f"NOID  {rel}"); bad += 1   # untracked drafts are not yet specs
    print("ok" if not bad else f"{bad} problem(s)"); sys.exit(1 if bad else 0)

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
sp = ap.add_subparsers(dest='cmd', required=True)
s = sp.add_parser('next'); s.add_argument('prefix', choices=PREFIX_KIND); s.set_defaults(f=cmd_next)
s = sp.add_parser('add'); s.add_argument('prefix', choices=PREFIX_KIND); s.add_argument('path'); s.add_argument('--title'); s.add_argument('--status', default='draft'); s.add_argument('--created'); s.set_defaults(f=cmd_add)
s = sp.add_parser('resolve'); s.add_argument('id'); s.set_defaults(f=cmd_resolve)
s = sp.add_parser('list'); s.add_argument('--kind'); s.add_argument('--status'); s.add_argument('--grep'); s.set_defaults(f=cmd_list)
s = sp.add_parser('set-status'); s.add_argument('id'); s.add_argument('status'); s.set_defaults(f=cmd_set_status)
s = sp.add_parser('check'); s.set_defaults(f=cmd_check)
a = ap.parse_args(); a.f(a)
