"""Shared by score_tiers.py and launch_tiers.py (CLASSIFY-LOOP-SPEC.md D7).

JURISDICTIONS maps each golden-set id to the request the launcher writes: the bureau slug, the
jurisdiction's name and its state. A slug that bureau already has a `jurisdictions/<slug>/` folder
for is reused (prospector trained it); every other slug is new, `<name>-<state>` style, and
1.0-worktree handles a jurisdiction bureau does not have yet. A name carries its county only where
the state has two places of that name.

A pass dir holds one run dir per golden id, plus pass.json (written by the launcher), usage.jsonl,
diagnoses.json (written by hand after scoring) and the scorecard.
"""
import json, os, re
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
GOLDEN = os.path.join(HERE, 'golden-set.json')

# The front half of intake-prospecting: nothing past 1.4-classify runs in the loop.
FRONT = ('0-request', '1.0-worktree', '1.1-inputs', '1.2-discover', '1.3-capture', '1.4-classify')

JURISDICTIONS = {
    # core, Tier 1
    'austin-tx':            ('austin', 'Austin', 'TX'),
    'fairfax-county-va':    ('fairfax-county', 'Fairfax County', 'VA'),
    'san-diego-ca':         ('san-diego', 'San Diego', 'CA'),
    'georgetown-tx':        ('georgetown', 'Georgetown', 'TX'),
    'round-rock-tx':        ('round-rock', 'Round Rock', 'TX'),
    'montgomery-county-md': ('montgomery-county', 'Montgomery County', 'MD'),
    'el-paso-tx':           ('el-paso', 'El Paso', 'TX'),
    'cedar-park-tx':        ('cedar-park', 'Cedar Park', 'TX'),
    # core, Tier 2
    'fremont-ne':           ('fremont', 'Fremont', 'NE'),
    # core, Tier 3
    'lenox-twp-mi':         ('lenox-township-mi', 'Lenox Charter Township', 'MI'),
    'conway-twp-mi':        ('conway-township-mi', 'Conway Township (Livingston County)', 'MI'),
    'bangor-twp-mi':        ('bangor-township-mi', 'Charter Township of Bangor (Bay County)', 'MI'),
    'decorah-ia':           ('decorah-ia', 'Decorah', 'IA'),
    'greencastle-pa':       ('greencastle-pa', 'Borough of Greencastle', 'PA'),
    'watertown-wi':         ('watertown-wi', 'Watertown', 'WI'),
    # extended (held out)
    'san-antonio-tx':       ('san-antonio', 'San Antonio', 'TX'),
    'katy-tx':              ('katy', 'Katy', 'TX'),
    'sunset-valley-tx':     ('sunset-valley-tx', 'Sunset Valley', 'TX'),
    'rockdale-tx':          ('rockdale', 'Rockdale', 'TX'),
    'winchester-mo':        ('winchester-mo', 'Winchester', 'MO'),
    'papillion-ne':         ('papillion-ne', 'Papillion', 'NE'),
    'west-sacramento-ca':   ('west-sacramento', 'West Sacramento', 'CA'),
    'heppner-or':           ('heppner-or', 'Heppner', 'OR'),
    'kenansville-nc':       ('kenansville-nc', 'Kenansville', 'NC'),
    'wallace-nc':           ('wallace-nc', 'Wallace', 'NC'),
    'union-county-nc':      ('union-county', 'Union County', 'NC'),
    'dardenne-prairie-mo':  ('dardenne-prairie-mo', 'Dardenne Prairie', 'MO'),
    'clinton-nc':           ('clinton-nc', 'Clinton', 'NC'),
    'cohoctah-twp-mi':      ('cohoctah-township-mi', 'Cohoctah Township', 'MI'),
    'saukville-wi':         ('saukville-wi', 'Village of Saukville', 'WI'),
    'southern-view-il':     ('southern-view-il', 'Village of Southern View', 'IL'),
    'carthage-tn':          ('carthage-tn', 'Carthage', 'TN'),
    'paris-tn':             ('paris-tn', 'Paris', 'TN'),
    'antis-twp-pa':         ('antis-township-pa', 'Antis Township', 'PA'),
}


def golden():
    """{id: entry} from golden-set.json; every id must be in JURISDICTIONS."""
    with open(GOLDEN) as f:
        entries = {e['id']: e for e in json.load(f)['jurisdictions']}
    missing = sorted(set(entries) - set(JURISDICTIONS))
    if missing:
        raise SystemExit(f'golden ids with no request in tiers.JURISDICTIONS: {missing}')
    return entries


def select(spec):
    """'core' | 'extended' | 'all' | 'id,id,...' -> golden ids, in golden-set order."""
    g = golden()
    if spec in ('core', 'extended'):
        return [i for i, e in g.items() if e['set'] == spec]
    if spec == 'all':
        return list(g)
    ids = [s.strip() for s in spec.split(',') if s.strip()]
    bad = [i for i in ids if i not in g]
    if bad:
        raise SystemExit(f'not golden-set ids: {bad}')
    return ids


def id_for(slug, state):
    """The golden id a run's request names, by slug and state."""
    for gid, (s, _, st) in JURISDICTIONS.items():
        if s == slug and st.upper() == (state or '').upper():
            return gid
    return None


def read_json(path, default=None):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def write_json(path, data):
    tmp = path + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')
    os.replace(tmp, path)


def jsonl(path):
    """Complete JSON lines only: a half-written last line is skipped, never read as a failure."""
    rows = []
    try:
        with open(path) as f:
            for line in f:
                if not line.endswith('\n'):
                    break
                try:
                    rows.append(json.loads(line))
                except ValueError:
                    pass
    except OSError:
        pass
    return rows


def ts(s):
    """An ISO timestamp (Z or offset) as epoch seconds."""
    if not s:
        return None
    return datetime.fromisoformat(re.sub(r'Z$', '+00:00', s)).timestamp()


def pass_info(pass_dir):
    return read_json(os.path.join(pass_dir, 'pass.json'), {}) or {}


def run_state(run, info=None):
    """Where a run is: running | parked | done | failed | cutoff | set-up.

    parked = the run waits at 1.5-scope (a full run's end in this loop); done = a replay's
    run-step exited 0; failed = a step failed before 1.4 produced its output (a tool failure);
    cutoff = the seat's usage limit stopped it (resume in place, never set up again)."""
    info = info or {}
    pid = info.get('pid')
    if pid and _alive(pid):
        return 'running'
    events = jsonl(os.path.join(run, 'events.jsonl'))
    since = info.get('started_epoch') or 0
    parks = [e for e in events if e.get('kind') == 'park' and e.get('step_path') == '1.5-scope'
             and (ts(e.get('ts')) or 0) >= since]
    out = classify_output(run)
    log_exit, tail = _log_tail(info.get('log'))
    if parks and out:
        return 'parked'
    if info.get('kind') == 'R' and log_exit == 0 and out:
        return 'done'
    if not pid:
        return 'set-up'
    if _cut_off(tail):
        return 'cutoff'
    return 'failed' if log_exit not in (None, 0, 75) or not out else 'parked' if out else 'failed'


def _alive(pid):
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    # A zombie is not alive: reap it when it is our child, else ask ps.
    try:
        done, _ = os.waitpid(pid, os.WNOHANG)
        if done:
            return False
    except ChildProcessError:
        pass
    stat = os.popen(f'ps -o stat= -p {int(pid)}').read().strip()
    return bool(stat) and not stat.startswith('Z')


def _log_tail(log):
    if not log or not os.path.exists(log):
        return None, ''
    with open(log, errors='replace') as f:
        tail = f.read()[-20000:]
    m = re.findall(r'^exit=(\d+)\s*$', tail, re.M)
    return (int(m[-1]) if m else None), tail


def _cut_off(tail):
    return bool(re.search(r'usage limit|rate.?limit|no seat|seat pick.*(timed out|wait)|five_hour.*(full|exhaust)', tail, re.I))


def classify_output(run):
    """1.4-classify's answer as {schema, gate, tier, basis, ...}, or None when it wrote nothing.

    A schema 2 run writes classification.json (gate + tier). A schema 1 run wrote basis.json,
    which can only say Tier 1 (formal) or not: none_found is Tier 2 or 3, so its gate is not
    measured ('n/a')."""
    d = os.path.join(run, '1.4-classify')
    c = read_json(os.path.join(d, 'classification.json'))
    if c:
        return {'schema': 2, 'gate': c.get('gate'), 'tier': c.get('tier'), 'basis': c.get('basis'),
                'content_items': c.get('content_items'), 'why_no_list': c.get('why_no_list'),
                'application_type': c.get('application_type'), 'rationale': c.get('rationale', ''),
                'gate_evidence': c.get('gate_evidence', []), 'scope_sources': c.get('scope_sources', [])}
    b = read_json(os.path.join(d, 'basis.json'))
    if b:
        basis = b.get('basis')
        gate, tier = {'formal': ('yes', 1), 'none_found': ('n/a', None), 'inconclusive': ('unknown', None)}.get(basis, ('unknown', None))
        return {'schema': 1, 'gate': gate, 'tier': tier, 'basis': basis, 'content_items': None, 'why_no_list': None,
                'application_type': b.get('application_type'), 'rationale': b.get('rationale', ''),
                'gate_evidence': [{'source': e.get('source'), 'quote': e.get('quote'), 'kind': e.get('role')} for e in b.get('evidence', [])],
                'scope_sources': b.get('scope_sources', [])}
    return None
