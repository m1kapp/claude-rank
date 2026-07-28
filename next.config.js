/** @type {import('next').NextConfig} */
module.exports = {
  // OG 카드 폰트(assets/fonts)를 서버리스 번들에 포함 (Vercel 배포)
  outputFileTracingIncludes: {
    "/u/[id]/opengraph-image": ["./assets/fonts/**"],
  },
  // 옛 도메인(clauderun) 을 정식 도메인(clauderank) 으로 합친다.
  // 제출 엔드포인트·metadataBase 가 clauderank 기준이라 공유 링크·OG 가 갈라지지 않게.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "clauderun.m1k.app" }],
        destination: "https://clauderank.m1k.app/:path*",
        permanent: true,
      },
    ];
  },
};
