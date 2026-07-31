// 블로그 인덱스. 글 본문은 app/blog/<slug>/page.tsx 에 각각 있고,
// 목록·사이트맵·메타데이터가 여기 한 곳을 본다(슬러그가 갈라지지 않게).
//
// 방침: 범용 키워드 글("Claude Code 비용은 얼마?")은 쓰지 않는다. 먼저 쓴 쪽이
// 이미 10편을 깔아둔 자리라 0에서 붙으면 진다. 대신 직접 측정해야만 알 수 있는
// 것만 쓴다 — 복사가 안 되고, 그게 우리 유일한 우위다.
// 표본은 아직 작으므로 "분석 결과"가 아니라 "내 기록을 뜯어봤다"로 쓴다.

export type Post = {
  slug: string;
  title: string;
  description: string;
  date: string;      // YYYY-MM-DD
  minutes: number;
};

export const POSTS: Post[] = [
  {
    slug: "cumulative-rank",
    title: "누적 랭킹은 실력이 아니라 근속을 잰다 — 같은 사람이 100위이자 13위였다",
    description:
      "같은 계정, 같은 데이터인데 누적 100위·30일 13위였다. 87계단 차이는 사용량이 아니라 시작 시점에서 왔다. 자기신고 신원이 만드는 중복 계정 문제와, 비율 지표가 그걸 어떻게 피하는지.",
    date: "2026-07-31",
    minutes: 6,
  },
  {
    slug: "weekly-limit",
    title: "주간 한도는 문서보다 위에 있다 — 28.9시간에 걸렸는데 52.1시간은 안 걸렸다",
    description:
      "Max 20x 주간 한도를 한 번 찍고 나서 주 단위로 기록을 갈라봤다. 더 많이 쓴 주가 안 걸렸고, 갈린 건 시간이 아니라 모델 구성이었다. 달러와 한도가 비례하지 않는 이유.",
    date: "2026-07-31",
    minutes: 6,
  },
  {
    slug: "where-the-money-goes",
    title: "Claude Code 한 달 치를 뜯어봤다 — 비용의 71%는 캐시 읽기였다",
    description:
      "토큰 203억 개, API 정가 환산 $15,514. 어디에 쓰였는지 모델별로 갈라보니 캐시 읽기가 비용의 71%였다. 프롬프트 캐시 TTL을 역산하는 방법과, 서브에이전트가 실제로 얼마나 먹는지까지.",
    date: "2026-07-30",
    minutes: 7,
  },
];

export const bySlug = (slug: string) => POSTS.find((p) => p.slug === slug);
