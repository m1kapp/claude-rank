# claude-rank

Claude 구독 가성비 랭킹 — [usage-report](https://github.com/m1kapp/claude-plugins) 스킬로 만든 JSON을 제출해 본전배율을 겨루는 리더보드.

## 동작
- `/usage-report` → `~/claude-usage-report.json` 생성
- 제출 페이지에서 닉네임 + JSON 붙여넣기 → 등록
- 익명 고유 ID로 중복 제출 자동 갱신, 플랜($200/$100) 배지 표시

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
