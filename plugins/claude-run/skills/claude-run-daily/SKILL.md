---
description: runmaxing 갱신을 하루 1회 자동으로 돌리도록 설정한다. 매번 /claude-run 을 치기 귀찮을 때. Usage - /claude-run-daily [on|off|status]. "매일 자동", "자동 갱신", "알아서 올라가게", "자동 등록 꺼줘" 요청 시 사용.
disable-model-invocation: false
allowed-tools: Bash(*)
arguments:
  - action
---

## 목적

`/claude-run` 을 매일 손으로 치는 대신, **하루 1회 자동 갱신**을 켜고 끈다.
자동 실행은 **이 명령으로 켤 때만** 동작한다(설치만으로는 절대 켜지지 않음).

## 실행

```bash
RP="${CLAUDE_PLUGIN_ROOT:+$CLAUDE_PLUGIN_ROOT/skills/usage-report}"
[ -d "$RP" ] || RP="$HOME/.claude/skills/usage-report"
bash "$RP/daily.sh" "$ARGUMENTS"   # on | off | status (생략 시 status)
```

## 동작

- **on** — 실행기(`~/.usage-report-daily.sh`)를 만들고 두 군데 등록한 뒤, **즉시 1회 실행**해서 되는지 보여준다.
  - **세션시작 훅** — 그날 클로드 코드를 **처음 켜는 시점**에 1회. `~/.claude/settings.json` 의 `SessionStart` 에 한 줄 추가되며, 백그라운드로 던지고 즉시 빠져서 세션 시작을 붙잡지 않는다.
  - **백스톱** — 그날 클로드 코드를 아예 안 켠 경우 대비. macOS launchd(`~/Library/LaunchAgents/app.m1k.clauderun.daily.plist`) / 그 외 cron, 매일 23:30.
- **off** — 훅·스케줄러 해제 + 실행기 삭제. 다른 훅은 건드리지 않는다. 랭킹 기록은 그대로 남는다(빼려면 `/claude-run-out`).
- **status** — 훅/백스톱 각각의 등록 여부, 마지막 갱신일, 최근 로그 3줄.

## 안내

- 자동 실행은 **브라우저를 열지 않는다**(`USAGE_REPORT_NO_OPEN`). 결과는 `~/.usage-report-auto.log` 에 남는다.
- 하루 1회 가드(`~/.usage-report-lastrun`) + 락으로 **중복 제출이 안 된다**. 맥이 꺼져 있어 그 시각을 놓치면 다음 기회에 올라간다.
- 실패하면 스탬프를 안 찍으므로 **다음 실행에 자동 재시도**한다.
- CPU를 오래 쓰지 않게 `nice`로 낮은 우선순위·백그라운드로 돈다.
- 남의 기기에 자동 업로드를 켜는 성격이라, **본인이 명시적으로 켤 때만** 쓴다. 켜져 있는 게 부담되면 `/claude-run-daily off` 한 줄로 흔적 없이 걷힌다.
- 갱신할 때마다 `~/.usage-report-history.jsonl` 에 수치와 트랜스크립트 개수·용량을 남긴다. 누적이 지난번보다 줄면 경고하고, **파일이 사라진 것인지 집계가 바뀐 것인지**까지 구분해서 알려준다.
