---
description: viberank(viberank.app) 연동을 켜고 끈다. 켜면 /claude-run 한 번에 runmaxing·viberank 양쪽이 갱신되고, 내 viberank 순위가 리포트에 함께 표시된다. Usage - /claude-run-viberank [on|off|status] [깃헙유저명]. "viberank 연동", "바이브랭크", "둘 다 올려줘", "다른 리더보드도" 요청 시 사용.
disable-model-invocation: false
allowed-tools: Bash(*)
arguments:
  - action
---

## 목적

사용량 리더보드를 두 군데 쓰는 사람을 위해 **명령 한 번으로 양쪽을 갱신**한다.
viberank 는 절대 금액 누적 랭킹이고 runmaxing 은 구독료 대비 배율이라, 축이 달라 같이 보면 서로를 보완한다.

## 실행

```bash
RP="${CLAUDE_PLUGIN_ROOT:+$CLAUDE_PLUGIN_ROOT/skills/usage-report}"
[ -d "$RP" ] || RP="$HOME/.claude/skills/usage-report"
bash "$RP/viberank.sh" "$ARGUMENTS"   # on [유저명] | off | status (생략 시 status)
```

## 동작

- **on** — 연동을 켠다. GitHub 유저명은 `gh api user` 로 자동 판별하며, 인자로 직접 줄 수도 있다.
  - 이후 `/claude-run` 때 **viberank 에도 같이 제출**된다(`ccusage daily --json` 그대로).
  - 내 **viberank 순위**를 읽어 runmaxing 리포트 상단에 뱃지로 표시한다.
- **off** — 연동 해제. viberank 에 이미 올라간 기록은 남는다(삭제는 viberank 쪽에 요청).
- **status** — 켜짐/꺼짐과 연결된 유저명·프로필 링크.

## 안내

- **기본은 꺼져 있다.** 제3자 서비스에 사용량을 보내는 성격이라 본인이 명시적으로 켤 때만 동작한다.
- 보내는 것은 `ccusage daily --json`(일별 비용·토큰·모델)뿐이다. 프롬프트·코드·파일 경로는 포함되지 않는다.
- **GitHub 로그인 이름을 써야 한다.** `git config user.name` 과 다른 경우가 흔한데(예: `yoo-minho` vs `yoominho91`), 로그인 이름이 아니면 나중에 프로필을 claim 할 수 없다.
- 순위 조회는 **이 기기에서** 한다. runmaxing 서버가 viberank 를 대신 긁지 않는다.
- viberank 쪽이 느리거나 실패해도 **runmaxing 제출은 그대로 진행**된다.
