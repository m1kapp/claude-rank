// 블로그 인덱스. 글 본문은 app/blog/<slug>/page.tsx 에 각각 있고,
// 목록·사이트맵·메타데이터가 여기 한 곳을 본다(슬러그가 갈라지지 않게).
//
// 방침: 범용 키워드 글("Claude Code 비용은 얼마?")은 쓰지 않는다. 먼저 쓴 쪽이
// 이미 10편을 깔아둔 자리라 0에서 붙으면 진다. 대신 직접 측정해야만 알 수 있는
// 것만 쓴다 — 복사가 안 되고, 그게 우리 유일한 우위다.
// 표본은 아직 작으므로 "분석 결과"가 아니라 "내 기록을 뜯어봤다"로 쓴다.
//
// POSTS = 목록에 뜨는 글. ARCHIVED = 목록에서 내렸지만 URL 은 살려둔 글.
// 블로그를 "잘 쓰는 법" 한 갈래로 좁히면서 측정 기록 3편을 목록에서 뺐다. 지우지는
// 않는다 — 색인된 URL 이 404 가 되고, 남은 글이 근거로 링크하고 있다.

export type Post = {
  slug: string;
  title: string;
  description: string;
  date: string;      // YYYY-MM-DD
  minutes: number;
};

export const POSTS: Post[] = [
  {
    slug: "parallel-two-to-four",
    title: "병렬은 2~4개가 맞았다 — 조언을 안 보고 내 로그로 먼저 재봤더니",
    description:
      "319시간 중 85%를 2개 이상 동시에 굴렸다. 겹친 세션 수로 결과를 갈라보니 2~4개에서 정점이고 5개를 넘으면 떨어졌다. 그다음에 찾아본 공식 권장이 3~5개, 커뮤니티 통설이 2~4개였다.",
    date: "2026-08-03",
    minutes: 6,
  },
  {
    slug: "supervision-density",
    title: "되돌린 세션이 더 많이 남겼다 — 한 달 로그에서 나온 반직관 셋",
    description:
      "세션 845개를 갈라보니 통념과 반대인 게 셋 나왔다. git으로 되돌린 세션이 커밋을 더 냈고, 에이전트 답변이 길어지면 결과가 사라졌고, 3~10분마다 답할 때가 제일 좋았다. 셋 다 같은 곳을 가리킨다.",
    date: "2026-08-02",
    minutes: 7,
  },
  {
    slug: "leverage-per-turn",
    title: "사람 한 마디에 도구가 6.74번 돌았다 — 마디당 레버리지를 재봤다",
    description:
      "사람이 친 마디 수로 도구 호출·서브에이전트·커밋을 나눠보니 습관이 그대로 숫자로 나왔다. 긴 세션일수록 마디당 레버리지는 오히려 떨어졌다. 그리고 6월과 비교하려다 기록이 이미 지워진 걸 알았다.",
    date: "2026-08-01",
    minutes: 6,
  },
];

export const ARCHIVED: Post[] = [
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

export const ALL_POSTS: Post[] = [...POSTS, ...ARCHIVED];

// 개별 글 페이지의 metadata 가 쓴다 — 목록에서 내렸어도 찾을 수 있어야 한다.
export const bySlug = (slug: string) => ALL_POSTS.find((p) => p.slug === slug);
