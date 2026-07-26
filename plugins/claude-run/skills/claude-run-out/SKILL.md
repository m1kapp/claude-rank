---
description: clauderank.m1k.app 가성비 랭킹에서 내 기록을 삭제한다(탈퇴). 내 Claude 계정 세션 기준으로 본인 줄만 지운다. "랭킹에서 빼줘", "내 기록 삭제", "랭킹 탈퇴", "내려줘" 요청 시 사용. Usage - /claude-run-out
disable-model-invocation: false
allowed-tools: Bash(*)
---

## 목적

가성비 랭킹(clauderank.m1k.app)에서 **내 기록을 삭제**한다.
신원은 내 Claude 계정 UUID 해시(`claude_…`)라, **본인 세션에서만** 자기 줄을 지울 수 있다(self-auth).

## 실행

usage-report 스킬의 remove 스크립트를 실행한다:

```bash
RP="${CLAUDE_PLUGIN_ROOT:+$CLAUDE_PLUGIN_ROOT/skills/usage-report}"
[ -d "$RP" ] || RP="$HOME/.claude/skills/usage-report"
bash "$RP/remove.sh"
```

## 안내

- 결과("🗑️ 삭제했어요" / "ℹ️ 삭제할 기록이 없어요")를 사용자에게 그대로 전달한다.
- 다시 올리고 싶으면 `/claude-run` 한 번이면 재등록된다고 안내한다.
- 기본은 **무조건 올리는 방향**이라, 이 명령은 명시적으로 빠지고 싶을 때만 쓴다.
