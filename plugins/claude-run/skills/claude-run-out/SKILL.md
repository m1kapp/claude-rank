---
description: runmaxing에서 내 runner 연결과 공개 기록을 삭제한다(탈퇴). 로컬 runner 신분증으로 본인 기록만 지우며 identity 파일은 보존한다. "랭킹에서 빼줘", "내 기록 삭제", "랭킹 탈퇴", "내려줘" 요청 시 사용. Usage - /claude-run-out
disable-model-invocation: false
allowed-tools: Bash(*)
---

## 목적

runmaxing에서 **내 runner 연결과 공개 기록을 삭제**한다.
기본 인증은 로컬 `~/.runmaxing/identity.json`의 비공개 device token이며, 구버전은 Claude 계정 해시로 하위호환한다.

## 실행

usage-report 스킬의 remove 스크립트를 실행한다:

```bash
RP="${CLAUDE_PLUGIN_ROOT:+$CLAUDE_PLUGIN_ROOT/skills/usage-report}"
[ -d "$RP" ] || RP="$HOME/.claude/skills/usage-report"
bash "$RP/remove.sh"
```

## 안내

- 결과("🗑️ 삭제했어요" / "ℹ️ 삭제할 기록이 없어요")를 사용자에게 그대로 전달한다.
- 삭제는 공개 기록 기준 **완전 삭제**다(리그 줄·리포트·기기 슬롯·검증 뱃지·provider 연결). 로컬 identity 파일은 덮어쓰거나 지우지 않는다.
- 다시 올리고 싶으면 `/claude-run` 한 번이면 재등록된다고 안내한다.
- 기본은 **무조건 올리는 방향**이라, 이 명령은 명시적으로 빠지고 싶을 때만 쓴다.
