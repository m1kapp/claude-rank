# clauderank

Claude Code / Codex 사용량을 [clauderank.m1k.app](https://clauderank.m1k.app) 가성비 랭킹에 갱신합니다.
**"API 정가로 환산하면 구독료의 몇 배를 뽑았나(본전배율)"** 를 겨루는 리더보드입니다.

```bash
npx @m1kapp/clauderank
```

설치도, 재시작도 없습니다.

## 사용법

```bash
npx @m1kapp/clauderank              # 집계 후 랭킹 갱신 (닉네임 자동)
npx @m1kapp/clauderank <닉네임>     # 닉네임 지정 — 다음부턴 생략 가능
npx @m1kapp/clauderank --report     # 리포트만 만들고 제출하지 않음
npx @m1kapp/clauderank --no-open    # 브라우저를 열지 않음
```

- **요금제**는 `~/.claude.json` 의 구독 티어로 자동 판별됩니다($200/$100/$20 종목).
- **신원**은 Claude 계정 UUID 해시 기준이라 깃헙·기기를 바꿔도 한 줄로 갱신됩니다.
- **Codex(ChatGPT)** 사용량도 함께 집계됩니다. 다만 ChatGPT 는 요금제와 가격이 1:1 이
  아니라(`pro` 가 $100/$200 둘 다, `team` 은 좌석·연납별) 가격이 확정되는 요금제에서만
  배율을 냅니다. 랭킹에는 Claude 만 들어갑니다.

## 필요 조건

`bash`, `python3`, `npx`. macOS·Linux 에서 동작하며 Windows 는 WSL 이 필요합니다.

전송되는 것은 집계된 사용량(일별 비용·토큰·모델·세션 통계)뿐입니다. 프롬프트·코드·파일
경로는 포함되지 않습니다.

## 플러그인 (선택)

슬래시 명령과 하루 1회 자동 갱신을 원하면:

```
/plugin marketplace add m1kapp/claude-rank
/plugin install claude-run@claude-rank
```

`/claude-run`(갱신) · `/claude-run-daily`(자동 갱신 on/off) · `/claude-run-out`(내 기록 삭제) ·
`/claude-run-viberank`(viberank 연동)

## 빠지기

```bash
npx @m1kapp/clauderank --report   # 제출 없이 로컬 리포트만
```

이미 올라간 기록을 지우려면 플러그인의 `/claude-run-out` 을 쓰거나
[clauderank.m1k.app](https://clauderank.m1k.app) 에서 삭제하세요.

MIT © m1kapp
