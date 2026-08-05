# runmaxing collector

Claude Code와 Codex 사용량을 한 runner 프로필에 연결하고, provider별 runmaxing 리그를 갱신합니다.
공개 패키지는 `@m1kapp/runmaxing`이며, 실행 파일에는 기존 `clauderank` 별칭도 남겨둡니다.

```bash
npx @m1kapp/runmaxing
```

설치도, 재시작도 없습니다.

## 사용법

```bash
npx @m1kapp/runmaxing              # 집계 후 랭킹 갱신 (닉네임 자동)
npx @m1kapp/runmaxing <닉네임>     # 닉네임 지정 — 다음부턴 생략 가능
npx @m1kapp/runmaxing --codex-plan 200  # Codex Pro 종목 지정($100/$200)
npx @m1kapp/runmaxing --report     # 리포트만 만들고 제출하지 않음
npx @m1kapp/runmaxing --no-open    # 브라우저를 열지 않음
```

- **요금제**는 `~/.claude.json` 의 구독 티어로 자동 판별됩니다($200/$100/$20 종목).
- **신원**은 `~/.runmaxing/identity.json`에 최초 한 번 생성되며 기존 파일을 덮어쓰지 않습니다.
- Claude UUID와 Codex account ID는 서로 다른 provider 해시로 저장되고 한 runner 아래 연결됩니다.
- **Codex(ChatGPT)** Plus는 `$20`으로 자동 계산합니다. `pro` 인증 정보는 5x/20x를
  구분하지 못해 최초 실행에서 `$100` 또는 `$200`을 한 번 선택합니다. 선택 이력은
  `~/.runmaxing/codex-plan`에 append-only로 보존되며 이후 실행에서 자동 재사용합니다.
  team/business처럼 단가가 고정되지 않는 요금제만 배율 대신 사용량으로 표시합니다.

## 필요 조건

`bash`, `python3`, `npx`. macOS·Linux에서 바로 동작합니다. Windows PowerShell에서도
WSL 배포판 안에 `python3`와 `npx`가 준비되어 있으면 같은 명령을 실행할 수 있으며,
runmaxing이 기존 POSIX 수집기를 WSL로 자동 연결합니다. `--force` 설치는 필요하지 않습니다.

전송되는 것은 집계된 사용량(일별 비용·토큰·모델·세션 통계)뿐입니다. 프롬프트·코드·파일
경로는 포함되지 않습니다.

## 플러그인 (선택)

슬래시 명령과 하루 1회 자동 갱신을 원하면:

```
/plugin marketplace add m1kapp/runmaxing
/plugin install claude-run@claude-rank
```

`/claude-run`(갱신) · `/claude-run-daily`(자동 갱신 on/off) · `/claude-run-out`(내 기록 삭제) ·
`/claude-run-viberank`(viberank 연동)

## 빠지기

```bash
npx @m1kapp/runmaxing --report   # 제출 없이 로컬 리포트만
```

이미 올라간 기록을 지우려면 플러그인의 `/claude-run-out` 을 쓰거나
[runmaxing](https://runmaxing.m1k.app) 프로필에서 삭제하세요.

MIT © m1kapp
