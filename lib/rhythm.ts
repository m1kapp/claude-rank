import { todayKST } from "./month";

type Activity = { series?: {
  daily_chats?: Record<string, number>;
  daily_cost_usd?: Record<string, number>;
  hourly?: Record<string, number>;
} };

export function activityRhythm(month: string, claude: Activity = {}, codex: Activity = {},
  locale: "ko" | "en" = "ko", today = todayKST()) {
  const text = (ko: string, en: string) => locale === "ko" ? ko : en;
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const [year, mon] = month.split("-").map(Number);
  const totalDays = validMonth ? new Date(Date.UTC(year, mon, 0)).getUTCDate() : 0;
  const elapsed = month > today.slice(0, 7) ? 0
    : month === today.slice(0, 7) ? Number(today.slice(8, 10)) : totalDays;
  const daily = claude.series?.daily_chats;
  const codexDaily = codex.series?.daily_cost_usd;
  const hasDays = !!daily || !!codexDaily;
  const days = Array.from({ length: totalDays }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    return {
      active: i < elapsed && ((daily?.[date] || 0) > 0 || (codexDaily?.[date] || 0) > 0),
      weekend: [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay()),
      elapsed: i < elapsed,
    };
  });
  const active = days.filter((d) => d.active).length;
  const weekends = days.filter((d) => d.weekend && d.elapsed);
  const weekendActive = weekends.filter((d) => d.active).length;
  const hourly = Array.from({ length: 24 }, (_, h) => Math.max(0, Number(claude.series?.hourly?.[h]) || 0));
  const chats = hourly.reduce((a, b) => a + b, 0);
  const night = hourly.reduce((n, count, h) => n + (h >= 22 || h < 6 ? count : 0), 0);
  const nightShare = chats ? night / chats : null;
  const steady = elapsed > 0 && active / elapsed >= 0.8;
  const weekendRunner = weekendActive >= 2 && weekendActive / weekends.length >= 0.8;
  // ponytail: descriptive thresholds, not a personality score; revisit with user feedback.
  const title = active < 5 || elapsed < 7 ? text("리듬을 쌓아가는 사람", "Finding a rhythm")
    : nightShare !== null && nightShare >= 0.35
      ? steady ? text("밤에도 꾸준히 달리는 사람", "A steady night runner") : text("밤에 불이 켜지는 사람", "Comes alive at night")
    : weekendRunner
      ? steady ? text("주말도 달리는 꾸준러", "Weekends, too. Still running") : text("주말에도 달리는 사람", "Keeps running on weekends")
    : steady ? text("거의 매일 달리는 사람", "Shows up, day after day")
    : text("자기 페이스로 달리는 사람", "Runs at their own pace");
  const unit = text("일", " days");
  const stats = [
    { label: text("활동한 날", "ACTIVE DAYS"), value: hasDays ? `${active} / ${elapsed}` : "—", note: text(`이번 달 경과 ${elapsed}${unit}`, `${elapsed} days elapsed this month`) },
    { label: text("주말에도", "WEEKEND DAYS"), value: hasDays && weekends.length ? `${weekendActive} / ${weekends.length}` : "—", note: text("토·일 기준", "Saturdays & Sundays") },
    { label: text("야간 대화", "NIGHT CHATS"), value: nightShare === null ? "—" : `${Math.round(nightShare * 100)}%`, note: text("22–06시 · Claude", "22:00–06:00 · Claude") },
  ];
  return { title, stats, days, hourly, active, elapsed, weekendActive, nightShare,
    source: text("활동일 Claude + Codex · 시간대 Claude · 한국시간", "Active days: Claude + Codex · Hours: Claude · KST"),
  };
}
