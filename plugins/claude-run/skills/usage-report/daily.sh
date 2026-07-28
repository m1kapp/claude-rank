#!/bin/bash
# 하루 1회 자동 갱신 설치/해제. 사용: bash daily.sh [on|off|status]
#
# on  : 실행기(~/.usage-report-daily.sh) + 스케줄러(macOS launchd / 그 외 cron) 등록 후 즉시 1회 실행
# off : 스케줄러 해제 + 실행기 삭제 (기록·랭킹은 그대로 남음 — 랭킹에서 빼려면 /claude-run-out)
# status: 등록 여부 + 마지막 실행 로그
set -e
ACTION="${1:-status}"
RUNNER="$HOME/.usage-report-daily.sh"
LOG="$HOME/.usage-report-auto.log"
LABEL="app.m1k.clauderun.daily"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
IS_MAC=0; [ "$(uname)" = "Darwin" ] && IS_MAC=1

# ── 실행기: 스케줄러가 매일 부르는 스크립트 ──
# 플러그인 경로를 실행 시점에 다시 찾는다(버전이 올라가도 안 깨지게).
write_runner() {
  cat > "$RUNNER" <<'RUNNER_EOF'
#!/bin/bash
# clauderank 하루 1회 자동 갱신 — /claude-run-daily 가 설치. 끄려면 /claude-run-daily off
STAMP="$HOME/.usage-report-lastrun"
LOCK="$HOME/.usage-report.lock"
LOG="$HOME/.usage-report-auto.log"
TODAY=$(date +%F)

# 오늘 이미 올렸으면 끝 (스케줄러가 하루 두 번 깨워도 1회만)
[ "$(cat "$STAMP" 2>/dev/null)" = "$TODAY" ] && exit 0

# 죽은 프로세스가 남긴 락(2시간 초과)은 치운다 — 안 그러면 자동 갱신이 영영 멈춤
[ -d "$LOCK" ] && find "$LOCK" -maxdepth 0 -mmin +120 -exec rmdir {} \; 2>/dev/null
mkdir "$LOCK" 2>/dev/null || exit 0
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

# 설치된 플러그인 중 최신 버전의 usage-report 를 쓴다.
# 마켓플레이스 이름은 고정하지 않는다 — 어느 마켓으로 깔았든(claude-rank/m1kapp/…) 찾아낸다.
RP=""; BEST=""
for d in "$HOME"/.claude/plugins/cache/*/claude-run/*/skills/usage-report; do
  [ -d "$d" ] || continue
  v="${d%/skills/usage-report}"; v="${v##*/}"
  if [ -z "$BEST" ] || [ "$(printf '%s\n%s\n' "$BEST" "$v" | sort -V | tail -1)" = "$v" ]; then
    BEST="$v"; RP="$d"
  fi
done
[ -n "$RP" ] || RP="$HOME/.claude/skills/usage-report"
if [ ! -d "$RP" ]; then
  echo "$(date '+%F %T') ✗ usage-report 스킬을 못 찾음" >> "$LOG"; exit 1
fi

# 실패하면 스탬프를 안 찍는다 → 다음 실행에 재시도.
# submit.sh 는 서버가 거절해도 종료코드가 0이라, 성공 표시(✅)까지 확인한다.
OUT=""
if nice -n 10 bash "$RP/run.sh" >/dev/null 2>&1; then
  OUT=$(USAGE_REPORT_NO_OPEN=1 nice -n 10 bash "$RP/submit.sh" 2>&1) || OUT="$OUT"
fi
if printf '%s' "$OUT" | grep -q '✅'; then
  echo "$TODAY" > "$STAMP"
  echo "$(date '+%F %T') ✓ $(printf '%s' "$OUT" | grep '✅' | head -1)" >> "$LOG"
else
  echo "$(date '+%F %T') ✗ 실패 — 다음 실행에 재시도 $(printf '%s' "$OUT" | tail -1)" >> "$LOG"
fi
tail -n 200 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
RUNNER_EOF
  chmod +x "$RUNNER"
}

# ── macOS: launchd (12:30·23:30 두 번 깨우고, 실행기가 하루 1회로 걸러줌) ──
write_plist() {
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$RUNNER</string></array>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>23</integer><key>Minute</key><integer>30</integer></dict>
  </array>
  <key>LowPriorityIO</key><true/>
  <key>Nice</key><integer>10</integer>
</dict>
</plist>
PLIST_EOF
}

cron_line() { echo "30 23 * * * /bin/bash $RUNNER  # clauderank-daily"; }

# ── SessionStart 훅: 그날 클로드 코드를 처음 켜는 시점에 1회 ──
# 고정 시각만 쓰면 맥이 자거나 책상에 없던 날은 통째로 날아간다.
# 훅은 백그라운드로 던지고 즉시 빠져나온다(세션 시작을 절대 붙잡지 않음).
HOOK_CMD='(nohup bash "$HOME/.usage-report-daily.sh" >/dev/null 2>&1 &) ; exit 0  # clauderank-daily'
hook() {  # hook install|remove
  python3 - "$1" "$HOOK_CMD" <<'PY'
import json, os, sys
mode, cmd = sys.argv[1], sys.argv[2]
p = os.path.expanduser("~/.claude/settings.json")
try:
    d = json.load(open(p))
except Exception:
    d = {}
hooks = d.get("hooks") or {}
entries = [e for e in (hooks.get("SessionStart") or [])
           if "clauderank-daily" not in json.dumps(e)]      # 우리 것 먼저 제거(중복 방지)
if mode == "install":
    entries.append({"hooks": [{"type": "command", "command": cmd}]})
if entries:
    hooks["SessionStart"] = entries
else:
    hooks.pop("SessionStart", None)
if hooks:
    d["hooks"] = hooks
else:
    d.pop("hooks", None)
os.makedirs(os.path.dirname(p), exist_ok=True)
open(p, "w").write(json.dumps(d, ensure_ascii=False, indent=2))
PY
}
hook_on() { grep -q 'clauderank-daily' "$HOME/.claude/settings.json" 2>/dev/null; }

case "$ACTION" in
  on)
    write_runner
    hook install
    if [ "$IS_MAC" = 1 ]; then
      write_plist
      launchctl unload "$PLIST" 2>/dev/null || true
      launchctl load "$PLIST"
      echo "✅ 자동 갱신 켜짐 — 그날 클로드 코드 처음 켤 때 1회 (못 켠 날 대비 23:30 백스톱)"
    else
      ( crontab -l 2>/dev/null | grep -v 'clauderank-daily'; cron_line ) | crontab -
      echo "✅ 자동 갱신 켜짐 — 그날 클로드 코드 처음 켤 때 1회 (백스톱 cron 23:30)"
    fi
    echo "   설치 위치: $RUNNER"
    echo "   로그: $LOG · 끄기: /claude-run-daily off"
    echo "지금 1회 실행해 볼게요…"
    bash "$RUNNER" || true
    tail -n 1 "$LOG" 2>/dev/null || echo "(로그 없음 — 오늘 이미 갱신했으면 건너뜁니다)"
    ;;
  off)
    hook remove
    if [ "$IS_MAC" = 1 ]; then
      launchctl unload "$PLIST" 2>/dev/null || true
      rm -f "$PLIST"
    else
      crontab -l 2>/dev/null | grep -v 'clauderank-daily' | crontab - 2>/dev/null || true
    fi
    rm -f "$RUNNER"
    echo "🛑 자동 갱신 껐어요. (랭킹 기록은 그대로 — 빼려면 /claude-run-out)"
    ;;
  status)
    if [ "$IS_MAC" = 1 ]; then
      SCHED=0; [ -f "$PLIST" ] && launchctl list 2>/dev/null | grep -q "$LABEL" && SCHED=1
      SNAME="launchd 23:30 백스톱"
    else
      SCHED=0; crontab -l 2>/dev/null | grep -q 'clauderank-daily' && SCHED=1
      SNAME="cron 23:30 백스톱"
    fi
    if hook_on || [ "$SCHED" = 1 ]; then
      echo "🟢 자동 갱신 켜져 있음"
      echo "   · 세션시작 훅(그날 처음 켤 때 1회): $(hook_on && echo 등록됨 || echo '없음')"
      echo "   · $SNAME: $([ "$SCHED" = 1 ] && echo 등록됨 || echo '없음')"
    else
      echo "⚪ 꺼져 있음 — 켜려면 /claude-run-daily on"
    fi
    echo "   마지막 갱신일: $(cat "$HOME/.usage-report-lastrun" 2>/dev/null || echo '없음')"
    [ -f "$LOG" ] && { echo "   최근 로그:"; tail -n 3 "$LOG" | sed 's/^/     /'; } || true
    ;;
  *)
    echo "사용: bash daily.sh [on|off|status]"; exit 1 ;;
esac
