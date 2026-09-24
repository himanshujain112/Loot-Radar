#!/usr/bin/env python3
"""Build src/ with esbuild and deploy dist/worker.js to the game-radar worker
via multipart script upload. The uploaded module keeps the name "worker.js"."""
import json
import subprocess
import sys
import urllib.request
import uuid

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response

ACCOUNT = "938e4392e316bd7f716cb3d07fbebb50"
SCRIPT = "game-radar"

build = subprocess.run(["npm", "run", "build"], capture_output=True, text=True)
if build.returncode != 0:
    print("BUILD FAILED")
    print(build.stdout[-2000:])
    print(build.stderr[-2000:])
    sys.exit(1)
print("build ok")

with open("dist/worker.js", "r", encoding="utf-8") as f:
    script = f.read()

boundary = uuid.uuid4().hex
metadata = json.dumps({
    "main_module": "worker.js",
    "compatibility_date": "2026-09-21",
    "bindings": [
        {"type": "d1", "name": "DB", "id": "ca922f36-fa2e-4e85-9075-f599fbfe0aa4"},
        {"type": "kv_namespace", "name": "KV", "namespace_id": "112f820516d943c990761847702cd2d4"},
    ],
    "triggers": {"crons": ["*/20 * * * *", "30 3 * * *"]},
})

body = (
    ("--" + boundary + '\r\nContent-Disposition: form-data; name="metadata"\r\n'
     "Content-Type: application/json\r\n\r\n" + metadata + "\r\n").encode()
    + ("--" + boundary + '\r\nContent-Disposition: form-data; name="worker.js"; filename="worker.js"\r\n'
       "Content-Type: application/javascript+module\r\n\r\n").encode()
    + script.encode()
    + ("\r\n--" + boundary + "--\r\n").encode()
)

req = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/workers/scripts/{SCRIPT}",
    data=body,
    method="PUT",
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
)
add_surrogate_to_request(req, "custom.cloudflare", allowed_hosts=["api.cloudflare.com"])

try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = read_json_response(resp)
        print("HTTP", resp.status)
        print(json.dumps(data, indent=2)[:1500])
except urllib.error.HTTPError as e:
    print("HTTP", e.code)
    print(e.read().decode()[:1500])
    sys.exit(1)

# Every deploy also pushes to GitHub (never fails the deploy itself).
print("--- pushing to GitHub ---")
import subprocess as _sp
try:
    r = _sp.run([sys.executable, "gh_push.py"], cwd="/home/hatch/workspace/loot-radar", timeout=180)
    if r.returncode != 0:
        print("GitHub push failed (deploy itself succeeded)")
except Exception as e:
    print("GitHub push skipped:", e)
