---
description: Claude Code와 Codex 사용량을 runmaxing 리그에 갱신한다. 로컬 runner ID 하나에 provider별 identity를 연결하며 기존 기록과 identity 파일은 덮어쓰지 않는다. Usage - /claude-run [닉네임]. "랭킹 등록", "랭크 올려", "내 기록 갱신", "얼마나 썼나" 요청 시 사용.
disable-model-invocation: false
allowed-tools: Bash(*)
arguments:
  - nickname
---

## 목적

내 사용량을 **최신으로 생성 + runmaxing 리그에 갱신**까지 한 번에. (별도 리포트 단계 없이 항상 이 한 명령.)
**추가 확인 없이 바로 갱신한다**(이 명령을 부른 것 자체가 동의 · 무조건 올리는 방향).

## 실행

```bash
RP="${CLAUDE_PLUGIN_ROOT:+$CLAUDE_PLUGIN_ROOT/skills/usage-report}"
[ -d "$RP" ] || RP="$HOME/.claude/skills/usage-report"
bash "$RP/run.sh"                  # 최신 데이터 생성 + 요금제·기기ID 자동 판별 (로컬 HTML 자동열기 없음)
bash "$RP/submit.sh" "$ARGUMENTS"  # 랭킹 갱신 + 내 웹 리포트 자동 열림 (닉네임 인자, 생략 가능)
```

- **닉네임**: 생략하면 **Claude 계정 이메일 앞부분으로 자동**. 바꾸려면 닉네임을 인자로 주면 `~/.usage-report-nick`에 저장돼 다음부턴 생략해도 같은 이름.
- **종목(요금제)**: 실제 구독 티어(`~/.claude.json`)로 **자동 판별**(200·100·20달러 종목). 수동 지정 불필요.
- 첫 제출에서 `~/.runmaxing/identity.json`을 한 번만 만들고, Claude UUID와 Codex account ID를 provider별 해시로 연결한다. 기존 파일은 자동 덮어쓰지 않는다.

## 안내

- 출력의 "✅ 갱신 완료! N월 본전배율 N×"(이번 달 기준), "🏅 종목 N위 / M명"(같은 요금제·이번 달), "📈 페이스"(전달 활동일 대비 · 전달 활동일이 3일 미만이면 생략됨), "🔮 이대로면 이번 달 ×N 예상", "🔗 내 리포트", "🏃 같이 달리기" 링크를 사용자에게 전달한다(제출 성공 시 내 리포트가 브라우저로 자동 열림).
- 닉네임은 이메일 앞부분으로 자동 등록되니, 다른 이름을 원하면 `/claude-run <닉네임>`으로 한 번 지정하라고 안내한다.
- 종목·닉 모두 자동이라 **그냥 `/claude-run`** 한 줄이면 된다(별도 종목 명령 불필요).
- 매번 치기 귀찮다면 **`/claude-run-daily on`** 으로 하루 1회 자동 갱신을 켤 수 있다고 안내한다(끄기는 `off`).
- 랭킹에서 빠지려면 **`/claude-run-out`** 로 본인 기록을 삭제할 수 있다고 안내한다.
