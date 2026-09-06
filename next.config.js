/** @type {import('next').NextConfig} */
module.exports = {
  // 로컬 미리보기는 RUNMAXING_DIST_DIR=.next-preview 로 격리한다.
  // dev 서버가 켜진 채 npm run build를 해도 서로의 청크를 덮어쓰지 않게 한다.
  distDir: process.env.RUNMAXING_DIST_DIR || ".next",
  // OG 카드 폰트(assets/fonts)를 서버리스 번들에 포함 (Vercel 배포)
  outputFileTracingIncludes: {
    "/u/[id]/opengraph-image": ["./assets/fonts/**"],
    "/api/card/*": ["./assets/fonts/**", "./public/logo.svg"],
  },
  // 구도메인은 제거하지 않고 runmaxing으로 영구 이동한다.
  // 기존 npx 수집기의 POST도 308로 메서드와 본문을 보존한다.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "clauderun.m1k.app" }],
        destination: "https://runmaxing.m1k.app/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "clauderank.m1k.app" }],
        destination: "https://runmaxing.m1k.app/:path*",
        permanent: true,
      },
    ];
  },
};
