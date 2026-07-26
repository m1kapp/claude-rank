#!/bin/bash
# 랭킹에서 내 기록 삭제. 사용: bash remove.sh [endpoint]
# 신원 = 내 Claude 계정 UUID 해시(claude_…) — 본인 세션에서만 파생되므로 self-auth.
set -e
ENDPOINT="${1:-${USAGE_REPORT_ENDPOINT:-https://clauderank.m1k.app}}"

ID="$(python3 - <<'PY'
import json, hashlib, os
home = os.path.expanduser("~")
try:
    d = json.load(open(os.path.join(home, ".claude.json")))
    acc = (d.get("oauthAccount") or {}).get("accountUuid")
    if acc:
        print("claude_" + hashlib.sha256(acc.encode()).hexdigest()[:32])
except Exception:
    pass
PY
)"

if [ -z "$ID" ]; then
  echo "⚠️ Claude 계정 세션을 찾을 수 없어요(~/.claude.json). 로그인 후 다시 시도하세요."
  exit 1
fi

echo "삭제 요청: $ID → $ENDPOINT"
RESP=$(curl -s -X POST "$ENDPOINT/api/remove" -H "Content-Type: application/json" -d "{\"id\":\"$ID\"}")
printf '%s' "$RESP" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print('🗑️ 랭킹에서 내 기록을 삭제했어요.' if d.get('removed') else 'ℹ️ 삭제할 기록이 없어요(이미 없거나 미등록).')
except Exception:
    print('⚠️ 응답 파싱 실패 — 엔드포인트 확인: $ENDPOINT')
"
