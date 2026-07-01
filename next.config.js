/** @type {import('next').NextConfig} */
module.exports = {
  // OG 카드 폰트(assets/fonts)를 서버리스 번들에 포함 (Vercel 배포)
  outputFileTracingIncludes: {
    "/u/[id]/opengraph-image": ["./assets/fonts/**"],
  },
};
