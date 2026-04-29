#!/usr/bin/env python3
"""pull-run.py — download inspect-drawing artifacts from a completeness-check run.

Pulls the `output/inspect-drawing-calls/` tree from Supabase Storage
into `runs/<datetime>/inspect-drawing-calls/` under this workspace, so the
debug viewer can pick it up.

USAGE
    # most recent cc run for 1700 S. Lamar (default project)
    ./scripts/pull-run.py --latest

    # specific run by datetime dir
    ./scripts/pull-run.py --datetime=2026-04-29-180000

    # different project
    ./scripts/pull-run.py --project-id=<uuid> --latest

    # list candidate runs without downloading
    ./scripts/pull-run.py --list

ENVIRONMENT
    PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — required.
    Loaded from ~/workspace/conductor/.env if not already in the shell env.

NOTES
    - Stdlib only (urllib, concurrent.futures). No pip install required.
    - Storage layout assumed:
          workflow-runs/completeness-check/<projectId>/<datetime>/
              output/inspect-drawing-calls/<callId>/{metadata.json,
                                                     prompt.txt,
                                                     cropped.jpg,
                                                     response.txt,
                                                     events.jsonl}
    - Output layout (matches viewer/build-manifest.py expectations):
          runs/<datetime>/output/inspect-drawing-calls/<callId>/...
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib import error, parse, request

DEFAULT_PROJECT_ID = "23301a8a-4cdb-4751-ac0c-93b97f0f5c12"  # 1700 S. Lamar
BUCKET = "workflow-runs"
WORKFLOW_PREFIX = "completeness-check"
SUBPATH = "output/inspect-drawing-calls"
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
RUNS_DIR = WORKSPACE_ROOT / "runs"
CONCURRENCY = 10


def load_env_from_conductor() -> None:
    """Populate PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from
    conductor/.env if the shell didn't already export them."""
    needed = ("PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    if all(os.environ.get(k) for k in needed):
        return
    candidates = [
        Path.home() / "workspace" / "conductor" / ".env",
        Path.home() / "code" / "controlroom" / "conductor" / ".env",
    ]
    for env_path in candidates:
        if not env_path.exists():
            continue
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            v = v.strip().strip('"').strip("'")
            if k in needed and not os.environ.get(k):
                os.environ[k] = v
        if all(os.environ.get(k) for k in needed):
            return
    missing = [k for k in needed if not os.environ.get(k)]
    if missing:
        raise SystemExit(
            f"Missing env vars: {', '.join(missing)}. Set them in your shell or in "
            f"~/workspace/conductor/.env."
        )


def supabase_request(method: str, path: str, body: dict | None = None) -> bytes:
    base = os.environ["PUBLIC_SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    url = f"{base}{path}"
    data = None
    headers = {"Authorization": f"Bearer {key}", "apikey": key}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = request.Request(url, data=data, method=method, headers=headers)
    try:
        with request.urlopen(req, timeout=60) as resp:
            return resp.read()
    except error.HTTPError as e:
        msg = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP {e.code} on {method} {path}: {msg}") from e


def storage_list(prefix: str, limit: int = 1000) -> list[dict]:
    """Single-level list of items under `prefix` in BUCKET. Items with id=null are folders."""
    body = {"prefix": prefix, "limit": limit, "offset": 0,
            "sortBy": {"column": "name", "order": "asc"}}
    raw = supabase_request("POST", f"/storage/v1/object/list/{BUCKET}", body)
    return json.loads(raw)


def storage_list_recursive(prefix: str) -> list[str]:
    """Recurse into folders to produce a flat list of file paths under `prefix`."""
    out: list[str] = []
    items = storage_list(prefix)
    for item in items:
        name = item.get("name")
        if not name:
            continue
        full = f"{prefix}/{name}"
        if item.get("id") is None:
            out.extend(storage_list_recursive(full))
        else:
            out.append(full)
    return out


def storage_download(remote_path: str, local_path: Path) -> int:
    quoted = parse.quote(remote_path, safe="/")
    raw = supabase_request("GET", f"/storage/v1/object/{BUCKET}/{quoted}")
    local_path.parent.mkdir(parents=True, exist_ok=True)
    local_path.write_bytes(raw)
    return len(raw)


def list_run_datetimes(project_id: str) -> list[str]:
    """Return run-datetime directory names under workflow-runs/completeness-check/<project>/, newest first."""
    prefix = f"{WORKFLOW_PREFIX}/{project_id}"
    items = storage_list(prefix)
    dirs = [it["name"] for it in items if it.get("id") is None and it.get("name")]
    return sorted(dirs, reverse=True)


def pull_run(project_id: str, datetime_dir: str, dest_root: Path) -> None:
    remote_root = f"{WORKFLOW_PREFIX}/{project_id}/{datetime_dir}/{SUBPATH}"
    print(f"  listing  {BUCKET}/{remote_root}/", file=sys.stderr)
    files = storage_list_recursive(remote_root)
    if not files:
        print(f"  no files found under {remote_root} — was the experiment flag set?",
              file=sys.stderr)
        return
    print(f"  found {len(files)} file(s); downloading to {dest_root}/", file=sys.stderr)
    dest_root.mkdir(parents=True, exist_ok=True)
    completed = 0
    total_bytes = 0

    def _job(remote: str) -> int:
        rel = Path(remote[len(f"{WORKFLOW_PREFIX}/{project_id}/{datetime_dir}/"):])
        local = dest_root / rel
        return storage_download(remote, local)

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futures = [pool.submit(_job, f) for f in files]
        for fut in as_completed(futures):
            try:
                n = fut.result()
            except Exception as e:
                print(f"  ERROR: {e}", file=sys.stderr)
                continue
            total_bytes += n
            completed += 1
            if completed % 10 == 0 or completed == len(files):
                print(f"    {completed}/{len(files)} files ({total_bytes/1024:.0f} KB)",
                      file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--project-id", default=DEFAULT_PROJECT_ID,
                        help=f"Project UUID (default: {DEFAULT_PROJECT_ID} — 1700 S. Lamar)")
    parser.add_argument("--datetime", help="Specific run datetime dir, e.g. 2026-04-29-180000")
    parser.add_argument("--latest", action="store_true",
                        help="Pull the most recent run for the project")
    parser.add_argument("--list", action="store_true",
                        help="List candidate run datetimes; do not download")
    args = parser.parse_args()

    load_env_from_conductor()

    if args.list:
        dts = list_run_datetimes(args.project_id)
        for dt in dts:
            print(dt)
        return 0

    datetime_dir = args.datetime
    if not datetime_dir:
        if not args.latest:
            print("error: pass --latest, --datetime=<dir>, or --list", file=sys.stderr)
            return 2
        dts = list_run_datetimes(args.project_id)
        if not dts:
            print(f"no runs found for project {args.project_id}", file=sys.stderr)
            return 1
        datetime_dir = dts[0]
        print(f"latest: {datetime_dir}", file=sys.stderr)

    dest = RUNS_DIR / datetime_dir
    pull_run(args.project_id, datetime_dir, dest)
    print(f"\ndone — runs/{datetime_dir}/", file=sys.stderr)
    print(f"next: cd ../viewer && ./serve.sh", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
