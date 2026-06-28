import { handler, ok } from "@m1kapp/kit/server";

// m1k.app 방문자 카운트 same-origin 프록시.
// (kit이 클라에서 m1k.app 직접 fetch하면 apex→www 리다이렉트가 CORS로 깨지므로,
//  서버사이드에서 www 직결로 받아 PoweredByKit `counts` prop으로 넘긴다.)
export const GET = handler(async () => {
  try {
    const r = await fetch("https://www.m1k.app/api/sites/gs?view=count", { cache: "no-store" });
    const d: any = r.ok ? await r.json() : {};
    return ok({ today: Number(d.today ?? d.todayCount ?? 0), total: Number(d.total ?? 0) });
  } catch {
    return ok({ today: 0, total: 0 });
  }
});
