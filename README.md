# runmaxing

Claude Code와 Codex를 한 러너 아래 연결하고, 각 에이전트를 얼마나 끝까지 돌렸는지 보여주는 월간 리그와 개인 리포트입니다.

서비스 주소와 내부 데이터 키는 마이그레이션 호환을 위해 유지합니다. 공개 수집기 이름은 runmaxing입니다.

```bash
npx @m1kapp/runmaxing
```

첫 제출에서 `~/.runmaxing/identity.json`에 공개 `runner_id`와 비공개 `device_token`을 한 번만 만듭니다. 기존 파일은 절대 자동 덮어쓰지 않습니다.

## 신원 모델

```text
runner_xxx
├─ Claude identity  (provider-scoped hash)
└─ Codex identity   (provider-scoped hash)
```

- 기존 `claude_<hash>` 엔트리는 저장 키와 원본 기록을 그대로 유지합니다.
- runner 연결 레코드만 추가해 공개 프로필을 하나로 묶습니다.
- Claude와 Codex는 별도 리그로 계산하며 합성 점수를 만들지 않습니다.
- 원본 계정 ID, 인증 토큰, 프롬프트, 코드, 파일 경로는 제출하지 않습니다.

## 사용법

```bash
npx @m1kapp/runmaxing              # 집계 + 러너 연결 + 리그 갱신
npx @m1kapp/runmaxing <닉네임>     # 닉네임 지정
npx @m1kapp/runmaxing --codex-plan 200  # Codex Pro 20x 종목 지정
npx @m1kapp/runmaxing --report     # 로컬 리포트만 생성
npx @m1kapp/runmaxing --no-open    # 브라우저를 열지 않음
```

Codex Plus는 `$20`으로 자동 계산합니다. Codex Pro는 인증 정보가 5x/20x를
구분하지 않으므로 최초 실행에서 `$100` 또는 `$200`을 한 번 선택하며,
`~/.runmaxing/codex-plan`의 append-only 이력을 다음 실행부터 재사용합니다.

Claude Code 플러그인은 호환을 위해 기존 설치 이름을 유지합니다.

```text
/plugin marketplace add m1kapp/runmaxing
/plugin install claude-run@claude-rank
/reload-plugins
/claude-run
```

## GitHub 활동 리듬 카드

프로필에서 월을 고른 뒤 **GitHub에 붙이기**를 누르고 README에 붙여넣습니다.
활동일은 Claude·Codex를 합쳐 하루 한 번만 세며, 야간 비율은 Claude 대화의
한국시간 22–06시 기록으로 계산합니다. 주말은 토·일 기준입니다.
카드는 선택한 달의 활동 패턴만 담고, 작업 내용·프로젝트명·완료물은 담지 않습니다.
GitHub 이미지 캐시 때문에 새 집계가 즉시 보이지 않을 수 있습니다.

## 로컬 실행

```bash
npm install
npm run dev
```

환경변수가 없으면 `.data/*.json`을 사용하고, 배포 환경에서는 Upstash Redis를 사용합니다.

## 호환성 원칙

- 기존 데이터 키(`claude-rank:*`)와 공개 레거시 URL은 삭제하거나 일괄 변경하지 않습니다.
- 새 runner 연결은 additive migration입니다.
- 기존 identity 파일이 손상되었거나 provider가 다른 runner에 연결되어 있으면 중단합니다.

MIT © m1kapp
