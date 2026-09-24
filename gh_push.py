#!/usr/bin/env python3
"""Push the working tree to GitHub main via the REST API.

The sandbox can't git-push over https://github.com (the credential surrogate is
only swapped on api.github.com), so this recreates the push with the git
database API: blobs -> tree -> commit -> ref update. Called by deploy.py after
every successful Cloudflare deploy. Never fails the deploy: errors are warnings.
"""
import base64
import datetime
import json
import subprocess
import sys
import urllib.request

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import dynamic_credential_entry

REPO_DIR = "/home/hatch/workspace/loot-radar"
IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))


def sh(*args):
    return subprocess.check_output(args, text=True, cwd=REPO_DIR).strip()


def api(surr, method, path, data=None):
    req = urllib.request.Request(
        "https://api.github.com" + path, method=method,
        data=json.dumps(data).encode() if data is not None else None)
    req.add_header("Authorization", "Bearer " + surr)
    req.add_header("User-Agent", "LootRadar-push")
    req.add_header("Accept", "application/vnd.github+json")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main():
    if sh("git", "status", "--porcelain"):
        sh("git", "add", "-A")
        msg = "deploy: " + datetime.datetime.now(IST).strftime("%Y-%m-%d %H:%M IST")
        sh("git", "commit", "-m", msg)
        print("committed:", msg)
    else:
        print("no local changes")

    url = sh("git", "remote", "get-url", "origin")
    owner, repo = url.rstrip("/").removesuffix(".git").split("/")[-2:]
    surr = dynamic_credential_entry("custom.github")["surrogate"].strip()

    files = sh("git", "ls-files").split("\n")
    tree = []
    for f in files:
        with open(f"{REPO_DIR}/{f}", "rb") as fh:
            content = base64.b64encode(fh.read()).decode()
        b = api(surr, "POST", f"/repos/{owner}/{repo}/git/blobs",
                {"content": content, "encoding": "base64"})
        tree.append({"path": f, "mode": "100644", "type": "blob", "sha": b["sha"]})
    t = api(surr, "POST", f"/repos/{owner}/{repo}/git/trees", {"tree": tree})

    ref = api(surr, "GET", f"/repos/{owner}/{repo}/git/refs/heads/main")
    remote_sha = ref["object"]["sha"]
    remote_tree = api(surr, "GET", f"/repos/{owner}/{repo}/git/commits/{remote_sha}")["tree"]["sha"]
    if remote_tree == t["sha"]:
        print("GitHub already up to date")
        return

    c = api(surr, "POST", f"/repos/{owner}/{repo}/git/commits", {
        "message": sh("git", "log", "-1", "--format=%s"),
        "tree": t["sha"],
        "parents": [remote_sha],
        "author": {"name": "Darlin", "email": "lootradar@codemeoww.com"},
    })
    api(surr, "PATCH", f"/repos/{owner}/{repo}/git/refs/heads/main", {"sha": c["sha"]})
    print("pushed to GitHub:", c["sha"][:8])


if __name__ == "__main__":
    main()
