#!/bin/bash
# viberank(viberank.app) 연동 on/off/status.
#
# 기본은 꺼짐. 켜면 두 가지가 붙는다:
#   1) /claude-run 때 viberank 에도 같이 제출 (ccusage daily --json 그대로)
#   2) 내 viberank 순위를 읽어 runmaxing 리포트에 함께 표시
#
# 제3자 서비스에 사용량을 보내는 성격이라 "명시적으로 켤 때만" 동작한다.
# 순위 조회도 우리 서버가 아니라 이 기기에서 한다 — 저쪽 인프라에 부담을 주지
# 않고, 파싱이 깨져도 그 사람 리포트에서 필드 하나가 빠질 뿐이다.
set -e
ACTION="${1:-status}"
ARG="$2"
CONF="$HOME/.usage-report-viberank"

resolve_user() {
  # GitHub 로그인 != git config user.name 인 경우가 흔하다.
  # 로그인 이름으로 넣어야 나중에 프로필 claim 이 된다.
  local u=""
  u=$(gh api user --jq '.login' 2>/dev/null || true)
  [ -n "$u" ] && { printf '%s' "$u"; return; }
  printf '%s' "$(git config user.name 2>/dev/null || true)"
}

# gh 에 여러 계정이 로그인돼 있으면 자동 선택이 위험하다 — active 계정은 언제든 바뀌고,
# 다른 이름으로 한 번 제출되면 viberank 에 두 번째 프로필이 생겨 기록이 쪼개진다.
multi_account_warn() {
  local n
  n=$(gh auth status 2>&1 | grep -c "Logged in to github.com account" || true)
  [ "${n:-0}" -gt 1 ] || return 0
  echo "⚠️  gh 에 GitHub 계정이 ${n}개 로그인돼 있습니다:"
  gh auth status 2>&1 | grep "Logged in to github.com account" | sed 's/^/     /'
  echo "   자동 선택은 active 계정을 따라가므로 나중에 바뀔 수 있습니다."
  echo "   viberank 에 이미 기록이 있다면 그 계정명을 인자로 직접 지정하세요:"
  echo "     /claude-run-viberank on <유저명>"
}

case "$ACTION" in
  on)
    USER="$ARG"
    if [ -z "$USER" ]; then
      multi_account_warn
      USER="$(resolve_user)"
      [ -z "$USER" ] && { echo "GitHub 유저명을 주세요: /claude-run-viberank on <유저명>"; exit 1; }
      echo "GitHub 유저명 자동 판별: $USER"
      echo "  (다르면 /claude-run-viberank on <유저명> 으로 다시 지정)"
    fi
    printf '%s' "$USER" > "$CONF"
    echo "✅ viberank 연동 켜짐 — $USER"
    echo "   · /claude-run 때 viberank 에도 같이 제출됩니다"
    echo "   · 내 viberank 순위가 runmaxing 리포트에 표시됩니다"
    echo "   · 끄기: /claude-run-viberank off"
    ;;
  off)
    rm -f "$CONF" /tmp/viberank.json
    echo "🛑 viberank 연동 껐어요. (viberank 에 이미 올라간 기록은 그대로 — 삭제는 viberank 쪽에 요청)"
    ;;
  status)
    if [ -s "$CONF" ]; then
      echo "🟢 viberank 연동 켜짐 — $(cat "$CONF")"
      echo "   프로필: https://viberank.app/profile/$(cat "$CONF")"
    else
      echo "⚪ 꺼져 있음 — 켜려면 /claude-run-viberank on"
    fi
    ;;
  fetch)
    # 순위만 조회해서 /tmp/viberank.json 에 남긴다(실패해도 조용히 통과).
    [ -s "$CONF" ] || exit 0
    U=$(cat "$CONF")
    HTML=$(curl -sL --max-time 12 -H "User-Agent: claude-run" "https://viberank.app/profile/$U" 2>/dev/null || true)
    printf '%s' "$HTML" | U="$U" python3 -c "
import sys, os, re, json, datetime
h = sys.stdin.read()
m = re.search(r'Global rank</p><p[^>]*>#(\d+)<', h)
if not m:
    sys.exit(0)                      # 파싱 실패는 에러가 아니라 '정보 없음'
# 티어는 파싱하지 않는다 — 비용에서 파생되는 값이라 이미 우리가 갖고 있고,
# 페이지의 티어 사다리 범례와 본인 뱃지를 구분하기 어려워 오탐이 났다.
out = {
    'username': os.environ['U'],
    'rank': int(m.group(1)),
    'fetched_at': datetime.datetime.now().astimezone().isoformat(timespec='seconds'),
}
open('/tmp/viberank.json', 'w').write(json.dumps(out, ensure_ascii=False))
print(f\"viberank 순위 {out['rank']}위\")
" 2>/dev/null || true
    ;;
  submit)
    # ccusage daily --json 을 viberank 에 제출. 실패해도 종료코드 0 — 우리 제출을 막지 않는다.
    [ -s "$CONF" ] || exit 0
    U=$(cat "$CONF")
    CC=$(mktemp -t ccjson)
    npx ccusage@latest daily --json > "$CC" 2>/dev/null || { rm -f "$CC"; exit 0; }
    # 기기 ID 는 viberank 공식 CLI 와 같은 파일을 쓴다 — 같이 쓰더라도 기기가 중복 등록되지 않게.
    MID_FILE="$HOME/.viberank/machine-id"
    if [ -s "$MID_FILE" ]; then MID=$(cat "$MID_FILE")
    else MID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo ""); \
         [ -n "$MID" ] && { mkdir -p "$HOME/.viberank" && printf '%s' "$MID" > "$MID_FILE"; }
    fi
    RESP=$(curl -s --max-time 30 -X POST https://www.viberank.app/api/submit \
      -H "Content-Type: application/json" -H "X-GitHub-User: $U" -H "X-Machine-Id: $MID" \
      -d @"$CC" 2>/dev/null || true)
    rm -f "$CC"
    if printf '%s' "$RESP" | grep -q '"success":true'; then
      echo "🏆 viberank 갱신: https://viberank.app/profile/$U"
    elif printf '%s' "$RESP" | grep -q 'Rate limit'; then
      # 저쪽은 유저당 제출 간격 제한이 있다. 실패가 아니라 '아직 이름' — 조용히 삼키면
      # 갱신이 안 된 줄 모르므로 한 줄만 알린다.
      WAIT=$(printf '%s' "$RESP" | grep -oE '"retryAfter":[0-9]+' | grep -oE '[0-9]+' || echo "")
      echo "⏳ viberank 는 건너뜀 (제출 간격 제한${WAIT:+ · ${WAIT}초 뒤 가능})"
    fi
    ;;
  *)
    echo "사용: bash viberank.sh [on <유저명>|off|status]"; exit 1 ;;
esac
