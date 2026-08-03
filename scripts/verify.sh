#!/bin/bash
# runmaxing 검증 어드민 CLI
#   ADMIN_SECRET=... [CLAUDERANK_ENDPOINT=https://runmaxing.m1k.app] scripts/verify.sh <명령>
# 명령:
#   list                이상탐지 포함 상위 제출 목록 (검증 후보 + 위조 의심 플래그)
#   on  <claude_id>     검증 뱃지 부여
#   off <claude_id>     검증 뱃지 해제
set -e
export CLAUDERANK_ENDPOINT="${CLAUDERANK_ENDPOINT:-https://runmaxing.m1k.app}"
if [ -z "$ADMIN_SECRET" ]; then echo "ADMIN_SECRET 환경변수가 필요해요."; exit 1; fi
export CR_CMD="${1:-list}"
export CR_ID="${2:-}"

python3 <<'PY'
import json, os, sys, urllib.request, urllib.error
EP = os.environ["CLAUDERANK_ENDPOINT"]; SEC = os.environ["ADMIN_SECRET"]
cmd = os.environ["CR_CMD"]; cid = os.environ.get("CR_ID", "")

def post(path, body):
    req = urllib.request.Request(EP + path, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        try: return json.load(e)
        except Exception: return {"error": f"HTTP {e.code}"}
    except Exception as e:
        return {"error": str(e)}

if cmd == "list":
    d = post("/api/admin/anomalies", {"secret": SEC})
    if not d.get("ok"):
        print("에러:", d.get("error")); sys.exit(1)
    print(f'총 {d["count"]}명 · 의심 플래그 {d["flagged"]}명\n')
    for i, r in enumerate(d["rows"], 1):
        v = "✓" if r["verified"] else " "
        fl = ", ".join(f'{f["key"]}({f["detail"]})' for f in r["flags"]) or "-"
        print(f'{i:2} [{v}] {r["nick"][:16]:<16} {r["ratio"]:>5}x  {fl}')
        print(f'     {r["id"]}')
elif cmd in ("on", "off"):
    if not cid:
        print(f"사용법: verify.sh {cmd} <claude_id>"); sys.exit(1)
    d = post("/api/admin/verify", {"secret": SEC, "id": cid, "verified": cmd == "on"})
    if d.get("ok"):
        print(("✅ 검증됨: " if d["verified"] else "⬜ 해제됨: ") + d["id"])
    else:
        print("에러:", d.get("error"))
else:
    print("명령: list | on <id> | off <id>"); sys.exit(1)
PY
