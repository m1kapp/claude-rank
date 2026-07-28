# claude-rank

Claude 구독 가성비 랭킹 — "API 정가로 환산하면 몇 배 뽑았나(본전배율)"를 겨루는 리더보드.
서비스([clauderank.m1k.app](https://clauderank.m1k.app))와 제출용 **Claude Code 플러그인**이 같이 있습니다.

## 설치 (플러그인)

```
/plugin marketplace add m1kapp/claude-rank
/plugin install claude-run@claude-rank
/reload-plugins
/claude-run
```

> 예전에 `m1kapp` 이나 `m1kskills` 마켓플레이스로 설치했다면 먼저 제거하세요:
> `/plugin marketplace remove m1kapp` · `/plugin marketplace remove m1kskills`
>
> **마켓플레이스부터 지우세요.** 옛 설치는 `local` 스코프로 박혀 있어서 `/plugin uninstall` 을 먼저 치면
> `installed in local scope, not user` 로 막힙니다. 마켓플레이스를 제거하면 딸린 설치도 같이 걷힙니다.
> 자세한 안내: [clauderank.m1k.app/start](https://clauderank.m1k.app/start)

## 동작
- `/claude-run` → 로컬 사용량(ccusage) 집계 후 랭킹에 자동 제출
- Claude 계정 UUID 해시로 신원 확인 → 기기·깃헙 바꿔도 한 줄로 갱신, 중복·허수 차단
- 플랜($200/$100) 배지 표시, `/claude-run-out` 으로 내 기록만 삭제

## 로컬 실행
```bash
npm install
npm run dev   # http://localhost:3000
```
저장소는 기본 로컬 파일(`.data/db.json`). Vercel 배포 시 Upstash Redis 사용.

## 배포 (Vercel)
1. 이 repo를 Vercel에 import
2. Upstash Redis 생성 후 환경변수 설정:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. 배포 → (선택) 도메인 `rank.m1k.app` 연결

env가 없으면 로컬 파일로 폴백한다(서버리스에선 영구 저장 안 되니 배포 시 Upstash 필수).

## 라이선스
MIT © m1kapp
