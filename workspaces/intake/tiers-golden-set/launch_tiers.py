"""Set up and start the classify loop's runs (CLASSIFY-LOOP-SPEC.md D7, D9, D10, §3.4).

A pass is one group of runs at one bureau head: every run is set up at once (conductor snapshots
the runbook's prompts at setup, so all of them carry that head), then started in batches.

    launch_tiers.py setup  --set core|extended|<id,id> --bureau <worktree> --out <pass dir>
    launch_tiers.py replay --corpus <run dir>... --bureau <worktree> --out <pass dir>
    launch_tiers.py start  --out <pass dir> --ids <id,id> --batch <n>
    launch_tiers.py wait   --out <pass dir> --batch <n>       # blocks; run it as a background task
    launch_tiers.py resume --out <pass dir> --ids <id,id> --batch <n>
    launch_tiers.py status --out <pass dir>
    launch_tiers.py usage

setup: a full (F) run per city: a request with only slug, name and state (no application-type
hint, no seeds: either could leak the answer), `gates: human` (the run parks at 1.5-scope, exit
75) and `publish: false`. `conductor setup` is offline: nothing is registered with the control
plane and no gate reaches the console. Each run's .env pins CONDUCTOR_SEAT=personal (D9).

replay: a replay (R) of 1.4-classify on a finished run. A fresh offline `conductor setup` at this
head gets the original's 0-request … 1.3-capture folders and their session logs, cloned
copy-on-write (APFS `cp -c`), and every path in them that names the original is rewritten.
`start` then runs `conductor run-step 1.4-classify` on it.

start records `muni usage --refresh` for the personal seat in usage.jsonl before the batch
starts; wait records it again once every run in the batch has parked, failed or been cut off.
resume restarts a cut-off run in place with `conductor advance` (it keeps the pass's prompts).
"""
import argparse, json, os, re, shutil, subprocess, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tiers  # noqa: E402

HOME = os.path.expanduser('~')
NOETIC = os.path.join(HOME, 'noetic')
SEAT = 'personal'
ENV = {
    'SURVEYOR': os.path.join(NOETIC, 'surveyor'),
    'DSD': os.path.join(NOETIC, 'dsd'),
    'NOETIC_SKILLS_DIR': os.path.join(NOETIC, 'claude-plugins/plugins/noetic-tools/skills'),
    'CONDUCTOR_SEAT': SEAT,
    'CCS_PLAYWRIGHT_FROM': os.path.join(NOETIC, 'surveyor/package.json'),
}
# The front half reads no credential (only 4.2-publish does); with-secrets needs at least one name,
# so the runs get the two public URLs and no key.
SECRET_NAMES = ['PUBLIC_SUPABASE_URL', 'SUPABASE_URL']
LANE = ['--billing', 'subscription']
RUNBOOK = 'runbooks/intake-prospecting'
BEFORE_14 = ('0-request', '1.0-worktree', '1.1-inputs', '1.2-discover', '1.3-capture')


def sh(cmd, **kw):
    return subprocess.run(cmd, check=True, text=True, capture_output=True, **kw).stdout.strip()


def say(msg):
    print(msg, flush=True)


def bureau_head(bureau):
    """The worktree's head, refusing a dirty tree or a head that is not pushed: a pass always starts
    after its commit lands (§3.4 step 1)."""
    if sh(['git', '-C', bureau, 'status', '--porcelain', '--untracked-files=no']):
        raise SystemExit(f'{bureau} has uncommitted changes: commit and push before a pass')
    head = sh(['git', '-C', bureau, 'rev-parse', 'HEAD'])
    branch = sh(['git', '-C', bureau, 'rev-parse', '--abbrev-ref', 'HEAD'])
    sh(['git', '-C', bureau, 'fetch', '-q', 'origin', branch])
    if sh(['git', '-C', bureau, 'rev-parse', f'origin/{branch}']) != head:
        raise SystemExit(f'{branch} head {head[:10]} is not pushed')
    return head, branch


def load(out):
    p = tiers.pass_info(out)
    if not p:
        raise SystemExit(f'no pass.json in {out}: run setup or replay first')
    return p


def save(out, p):
    tiers.write_json(os.path.join(out, 'pass.json'), p)


def new_pass(out, kind, set_, head, branch, bureau):
    os.makedirs(out, exist_ok=True)
    p = tiers.pass_info(out)
    if p:
        if p['head'] != head or p['kind'] != kind:
            raise SystemExit(f"{out} is pass {p['kind']} at {p['head'][:10]}; a pass has one head and one kind")
        return p
    return {'pass': os.path.basename(out), 'kind': kind, 'set': set_, 'head': head, 'branch': branch,
            'bureau': bureau, 'created': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'runs': {}}


def write_env(run, bureau):
    """Append the run's roots to the .env conductor setup wrote (never overwrite it)."""
    with open(os.path.join(run, '.env'), 'a') as f:
        for k, v in {'RUN': run, 'BUREAU': bureau, **ENV}.items():
            f.write(f'{k}={v}\n')
    with open(os.path.join(run, '.secret-names'), 'w') as f:
        f.write('\n'.join(SECRET_NAMES) + '\n')


def conductor(run, *args):
    """A conductor verb under the run's .env and secrets, as the conductor skill runs it."""
    cmd = f'set -a; . "{run}/.env" || exit 1; set +a; with-secrets $(cat "{run}/.secret-names") -- conductor ' + \
          ' '.join(f"'{a}'" for a in args)
    return subprocess.run(['sh', '-c', cmd], text=True, capture_output=True)


def cmd_setup(a):
    head, branch = bureau_head(a.bureau)
    out = os.path.abspath(a.out)
    p = new_pass(out, 'F', a.set, head, branch, a.bureau)
    G = tiers.golden()
    for gid in tiers.select(a.set):
        run = os.path.join(out, gid)
        if gid in p['runs']:
            say(f'{gid}: already set up')
            continue
        if os.path.exists(run):
            raise SystemExit(f'{run} exists but pass.json does not list it')
        slug, name, state = tiers.JURISDICTIONS[gid]
        sh(['conductor', 'setup', os.path.join(a.bureau, RUNBOOK), run])
        write_env(run, a.bureau)
        os.makedirs(os.path.join(run, '0-request'), exist_ok=True)
        tiers.write_json(os.path.join(run, '0-request', 'request.json'), {
            'schema_version': 1, 'jurisdiction': {'slug': slug, 'name': name, 'state': state},
            'gates': 'human', 'publish': False, 'requested_by': 'intake-classify-loop (Will Navey)'})
        chk = conductor(run, 'check', '0-request', '--run', run)
        if chk.returncode != 0:
            raise SystemExit(f'{gid}: 0-request check failed\n{chk.stdout}\n{chk.stderr}')
        p['runs'][gid] = {'dir': run, 'slug': slug, 'tier': G[gid]['tier'], 'state': 'set-up'}
        save(out, p)
        say(f'{gid}: set up at {head[:10]} ({slug})')
    save(out, p)


def cmd_replay(a):
    head, branch = bureau_head(a.bureau)
    out = os.path.abspath(a.out)
    p = new_pass(out, 'R', 'replay', head, branch, a.bureau)
    G = tiers.golden()
    for src in a.corpus:
        src = os.path.abspath(src).rstrip('/')
        req = tiers.read_json(os.path.join(src, '0-request', 'request.json'), {}) or {}
        jur = req.get('jurisdiction', {})
        gid = tiers.id_for(jur.get('slug'), jur.get('state'))
        if not gid:
            raise SystemExit(f'{src}: no golden id for {jur}')
        if gid in p['runs']:
            say(f'{gid}: already set up')
            continue
        if not tiers.classify_output(src) and not os.path.exists(os.path.join(src, '1.3-capture', 'manifest.json')):
            raise SystemExit(f'{src}: not a finished front half (no 1.3-capture manifest)')
        run = os.path.join(out, gid)
        # A fresh offline setup gives the replay this head's runbook copy (and its generated graph),
        # its own conductor state, and no control-plane id or callback token from the original.
        sh(['conductor', 'setup', os.path.join(a.bureau, RUNBOOK), run])
        write_env(run, a.bureau)
        # The front half's outputs up to 1.3-capture, and their session logs (rule 19 reads them),
        # cloned copy-on-write: free until a file changes, and a change never reaches the original.
        for name in BEFORE_14:
            if os.path.exists(os.path.join(src, name)):
                sh(['cp', '-cRp', os.path.join(src, name), os.path.join(run, name)])
        os.makedirs(os.path.join(run, '.logs'), exist_ok=True)
        for name in os.listdir(os.path.join(src, '.logs')) if os.path.isdir(os.path.join(src, '.logs')) else []:
            if name.startswith(BEFORE_14[1:]):
                sh(['cp', '-cRp', os.path.join(src, '.logs', name), os.path.join(run, '.logs', name)])
        rewritten = repoint(run, src)
        left = leaks(run, src)
        if left:
            raise SystemExit(f'{gid}: paths still name the original run:\n  ' + '\n  '.join(left[:20]))
        p['runs'][gid] = {'dir': run, 'slug': jur['slug'], 'tier': G[gid]['tier'], 'state': 'set-up', 'source': src,
                          'rewritten': rewritten}
        save(out, p)
        say(f'{gid}: replay set up from {src} ({rewritten} files repointed)')
    save(out, p)


def _text_files(run):
    """Every small text file in the run, outside git object stores and page images."""
    for root, dirs, files in os.walk(run):
        dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules')]
        for f in files:
            path = os.path.join(root, f)
            if f.endswith(('.png', '.jpg', '.jpeg', '.pdf', '.webp', '.gif', '.zip', '.woff', '.woff2')):
                continue
            try:
                if os.path.getsize(path) > 20_000_000 or os.path.islink(path):
                    continue
            except OSError:
                continue
            yield path


def repoint(run, src):
    n = 0
    for path in _text_files(run):
        try:
            with open(path, 'rb') as f:
                data = f.read()
        except OSError:
            continue
        if src.encode() in data:
            os.remove(path)   # break the clone before writing, so the original is never touched
            with open(path, 'wb') as f:
                f.write(data.replace(src.encode(), run.encode()))
            n += 1
    return n


def leaks(run, src):
    out = []
    for path in _text_files(run):
        try:
            with open(path, 'rb') as f:
                if src.encode() in f.read():
                    out.append(path)
        except OSError:
            pass
    return out


def usage():
    """The personal seat's snapshot after a fresh probe: used % and reset time per window."""
    subprocess.run(['muni', 'usage', '--refresh', SEAT], capture_output=True, text=True)
    raw = sh(['muni', 'usage', SEAT, '--json'])
    acct = next(x for x in json.loads(raw)['accounts'] if x['account'] == SEAT)
    return {'five_hour': acct['five_hour']['used_pct'], 'five_hour_resets_at': acct['five_hour']['resets_at'],
            'seven_day': acct['seven_day']['used_pct'], 'seven_day_resets_at': acct['seven_day']['resets_at'],
            'usable': acct.get('usable'), 'unusable_reason': acct.get('unusable_reason')}


def record_usage(out, batch, phase, ids):
    u = {'ts': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'batch': batch, 'phase': phase, 'runs': ids, **usage()}
    with open(os.path.join(out, 'usage.jsonl'), 'a') as f:
        f.write(json.dumps(u) + '\n')
    return u


def launch(run, verb):
    """Start one conductor pass detached in its own session (nohup and setsid fail on macOS)."""
    log = os.path.join(run, '.logs', f'loop-{int(time.time())}.log')
    os.makedirs(os.path.dirname(log), exist_ok=True)
    inner = f'with-secrets $(cat "{run}/.secret-names") -- conductor {verb} --run "{run}" {" ".join(LANE)}; echo "exit=$?"'
    cmd = f'set -a; . "{run}/.env" || exit 1; set +a; {inner}'
    pid = os.fork()
    if pid == 0:
        os.setsid()
        fd = os.open(log, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
        nul = os.open(os.devnull, os.O_RDONLY)
        os.dup2(nul, 0)
        os.dup2(fd, 1)
        os.dup2(fd, 2)
        os.chdir(run)
        os.execvp('sh', ['sh', '-c', cmd])
    return pid, log


def _start(a, resume):
    out = os.path.abspath(a.out)
    p = load(out)
    ids = [i.strip() for i in a.ids.split(',') if i.strip()]
    for gid in ids:
        r = p['runs'].get(gid)
        if not r:
            raise SystemExit(f'{gid} is not set up in this pass')
        st = tiers.run_state(r['dir'], dict(r, kind=p['kind']))
        if st == 'running':
            raise SystemExit(f'{gid} is already running')
        if not resume and r.get('pid'):
            raise SystemExit(f'{gid} was started already: resume it in place instead')
    u = record_usage(out, a.batch, 'before', ids)
    if not u['usable']:
        raise SystemExit(f"seat {SEAT} is not usable: {u['unusable_reason']}")
    verb = 'run-step 1.4-classify' if p['kind'] == 'R' else 'advance'
    for gid in ids:
        r = p['runs'][gid]
        pid, log = launch(r['dir'], verb)
        r.update(pid=pid, log=log, batch=a.batch, started=time.strftime('%Y-%m-%dT%H:%M:%S%z'),
                 started_epoch=r.get('started_epoch') or time.time(), state='running')
        if resume:
            r['resumed'] = r.get('resumed', 0) + 1
        say(f'{gid}: {verb} pid {pid} log {log}')
    save(out, p)


def cmd_start(a):
    _start(a, resume=False)


def cmd_resume(a):
    _start(a, resume=True)


def states(p):
    return {gid: tiers.run_state(r['dir'], dict(r, kind=p['kind'])) for gid, r in p['runs'].items()}


def cmd_wait(a):
    out = os.path.abspath(a.out)
    while True:
        p = load(out)
        batch = [g for g, r in p['runs'].items() if str(r.get('batch')) == str(a.batch)]
        st = {g: tiers.run_state(p['runs'][g]['dir'], dict(p['runs'][g], kind=p['kind'])) for g in batch}
        if batch and all(s != 'running' for s in st.values()):
            break
        time.sleep(a.every)
    for g, s in st.items():
        p['runs'][g]['state'] = s
    save(out, p)
    u = record_usage(out, a.batch, 'after', batch)
    say(json.dumps({'batch': a.batch, 'states': st, 'usage': u}))


def cmd_status(a):
    out = os.path.abspath(a.out)
    p = load(out)
    st = states(p)
    say(f"{p['pass']} {p['kind']} at {p['head'][:10]} ({p['branch']})")
    for gid, s in st.items():
        r = p['runs'][gid]
        say(f"  {gid:22} T{r['tier']}  {s:8} batch {r.get('batch', '–')}{'  resumed ' + str(r['resumed']) if r.get('resumed') else ''}")


def cmd_usage(a):
    say(json.dumps(usage()))


ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
sub = ap.add_subparsers(dest='cmd', required=True)
s = sub.add_parser('setup'); s.add_argument('--set', required=True); s.add_argument('--bureau', required=True); s.add_argument('--out', required=True)
s = sub.add_parser('replay'); s.add_argument('--corpus', nargs='+', required=True); s.add_argument('--bureau', required=True); s.add_argument('--out', required=True)
for name in ('start', 'resume'):
    s = sub.add_parser(name); s.add_argument('--out', required=True); s.add_argument('--ids', required=True); s.add_argument('--batch', required=True)
s = sub.add_parser('wait'); s.add_argument('--out', required=True); s.add_argument('--batch', required=True); s.add_argument('--every', type=int, default=30)
s = sub.add_parser('status'); s.add_argument('--out', required=True)
sub.add_parser('usage')
a = ap.parse_args()
if getattr(a, 'bureau', None):
    a.bureau = os.path.abspath(os.path.expanduser(a.bureau))
{'setup': cmd_setup, 'replay': cmd_replay, 'start': cmd_start, 'resume': cmd_resume, 'wait': cmd_wait,
 'status': cmd_status, 'usage': cmd_usage}[a.cmd](a)
