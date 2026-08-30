import { handler, ok, badRequest } from "@m1kapp/kit/server";
import { upsert, saveReport, getReport, saveDeviceReport, slotReports, mergeReports, DeviceIdentityConflict, all, rankIn, type Entry } from "../../../lib/store";
import { claimRunner, runnerForEntry, RunnerCredentialError, RunnerIdentityConflict } from "../../../lib/runners";

const num = (v: any) => Number(v) || 0;

// 리포트(build.py 스키마) → 랭킹 Entry 로 환산. (병합된 리포트에 대해 호출)
function entryFromReport(id: string, nick: string, report: any, runnerId?: string): Entry {
  const t = report.totals || {};
  let chats = 0, commits = 0, active = 0;
  const months: Record<string, any> = {};
  for (const [mk, m] of Object.entries<any>(report.months || {})) {
    const c = num(m.git?.commit);
    chats += num(m.chats);
    commits += c;
    active += num(m.active_days);
    months[mk] = {
      ratio: num(m.ratio),
      chats: num(m.chats),
      commits: c,
      cost_krw: num(m.cost_krw),
      plan: num(m.plan_usd) || num(report.plan_usd_per_month) || 200,
    };
  }
  return {
    id, nick, runner_id: runnerId,
    plan: num(report.plan_usd_per_month) || 200,
    ratio: num(t.ratio),
    chats, commits, active_days: active,
    cost_krw: num(t.cost_krw),
    months,
    devices: num(report.merged_devices) || 1,
    updated: new Date().toISOString(),
  };
}

// 구독 rate-limit 티어 문자열 → 종목($/월). 판별 불가면 0.
function planForTier(tier: string): number {
  const t = (tier || "").toLowerCase();
  if (!t) return 0;
  if (t.includes("20x")) return 200;
  if (t.includes("5x")) return 100;
  if (t.includes("pro")) return 20;
  return 0;
}

// ── 허수 방지 ④ : 요금제 자동판별 대조 ──
// 클라이언트가 실제 구독 티어(plan_tier)를 보내면, 신고한 종목과 대조해 스푸핑 차단.
// 구버전(미전송)은 스킵 → 하위호환. 문제 없으면 null, 있으면 에러 메시지 반환.
function planTierMismatch(report: any): string | null {
  const tierPlan = planForTier(String(report.plan_tier || ""));
  if (!tierPlan) return null;
  const declared = num(report.plan_usd_per_month);
  if (declared && declared !== tierPlan) {
    return `구독 요금제(${report.plan_tier})는 $${tierPlan} 종목이에요. 등록 종목($${declared})과 안 맞습니다 — 자동 판별로 다시 실행하세요.`;
  }
  return null;
}

// ── 이번에 올라온(=이 기기의) 리포트에 대해서만 허수 방지 검증 ──
// 문제 없으면 null, 있으면 에러 메시지 반환.
function monthsValidationError(report: any): string | null {
  const krwPerUsd = num(report.currency_krw_per_usd) || 1500;
  for (const [mk, m] of Object.entries<any>(report.months || {})) {
    const cost_krw = num(m.cost_krw);
    const plan = num(m.plan_usd) || num(report.plan_usd_per_month) || 200;
    const ratio = num(m.ratio);
    const mChats = num(m.chats);
    // ── 허수 방지 ② : 배율 정합성 (배율 = 정가환산 ÷ 구독료). 조작하면 거부 ──
    if (cost_krw > 0 && plan > 0) {
      const expected = cost_krw / (krwPerUsd * plan);
      const rel = Math.abs(ratio - expected) / Math.max(expected, 1);
      if (rel > 0.08) return `리포트 정합성 오류(${mk}): 배율이 비용과 맞지 않아요. 원본 리포트로 다시 시도하세요.`;
    }
    // ── 허수 방지 ③ : 상식 범위 ──
    if (ratio < 0 || ratio > 10000 || mChats < 0 || mChats > 2_000_000) {
      return `리포트 값이 범위를 벗어났어요(${mk}).`;
    }
  }
  return null;
}

// Codex도 별도 리그의 배율 산식을 서버에서 다시 확인한다.
// Pro의 5x/20x는 인증 토큰만으로 구분할 수 없지만 허용 종목은 $100/$200으로 제한한다.
function codexValidationError(report: any): string | null {
  const codex = report?.codex;
  if (!codex) return null;
  const type = String(codex.plan_type || "").toLowerCase();
  const plan = num(codex.plan_usd);
  const allowed = type === "plus" ? [20] : type === "pro" ? [100, 200] : [];
  if (plan && !allowed.includes(plan)) {
    return `Codex 요금제(${type || "unknown"})와 $${plan} 종목이 맞지 않아요.`;
  }
  // team/business 등 고정 단가가 없는 요금제는 임의의 분모를 허용하지 않는다.
  if (plan && !allowed.length) return "이 Codex 요금제는 고정 구독료 배율을 지원하지 않아요.";
  for (const [mk, month] of Object.entries<any>(codex.months || {})) {
    const cost = num(month.cost_usd);
    if (!plan || !cost) continue;  // 구버전·미확정 요금제는 사용량만 보존
    const ratio = num(month.ratio);
    const expected = cost / plan;
    const rel = Math.abs(ratio - expected) / Math.max(expected, 1);
    if (rel > 0.08) return `Codex 리포트 정합성 오류(${mk}): 배율이 비용과 맞지 않아요.`;
    const hasStandard = typeof month.standard_cost_usd === "number";
    const hasFast = typeof month.fast_premium_usd === "number";
    if (hasStandard !== hasFast) return `Codex 리포트 정합성 오류(${mk}): Fast 비용 필드가 불완전해요.`;
    if (hasStandard) {
      const standard = num(month.standard_cost_usd);
      const premium = num(month.fast_premium_usd);
      if (standard < 0 || premium < 0) return `Codex 리포트 정합성 오류(${mk}): Fast 비용이 음수예요.`;
      const splitRel = Math.abs(standard + premium - cost) / Math.max(cost, 1);
      if (splitRel > 0.02) return `Codex 리포트 정합성 오류(${mk}): Standard와 Fast 비용 합계가 맞지 않아요.`;
    }
  }
  return null;
}

export const POST = handler(async (req) => {
  const body: any = await req.json().catch(() => null);
  const nick = String(body?.nick || "").trim().slice(0, 24);
  const report = body?.report;
  if (!nick) return badRequest("닉네임을 입력하세요");
  if (!report || report.generated_for !== "claude-usage-report") return badRequest("usage-report JSON이 아닙니다");

  const id = String(report.id || "").trim();
  // ── 허수 방지 ① : Claude 계정 세션으로만 (claude_<sha256 32자>) ──
  if (!/^claude_[0-9a-f]{32}$/.test(id)) {
    return badRequest("Claude 계정 세션으로만 등록할 수 있어요. usage-report 플러그인을 최신으로 올리고 /claude-run 로 다시 실행하세요.");
  }

  const tierErr = planTierMismatch(report);
  if (tierErr) return badRequest(tierErr);

  const monthsErr = monthsValidationError(report);
  if (monthsErr) return badRequest(monthsErr);
  const codexErr = codexValidationError(report);
  if (codexErr) return badRequest(codexErr);

  // 같은 runner/provider 자리에 다른 Codex 계정을 조용히 덮어쓰거나 합산하지 않는다.
  const previousReport = await getReport(id);
  const previousCodexId = String(previousReport?.codex?.account_id || "");
  const incomingCodexId = String(report.codex?.account_id || "");
  if (previousCodexId && incomingCodexId && previousCodexId !== incomingCodexId) {
    return badRequest("이 Claude 기록에는 다른 Codex 계정이 이미 연결되어 있어요. 자동으로 덮어쓰지 않았습니다.");
  }

  // runmaxing 신원은 로컬에서 최초 한 번 만든 runner 신분증으로 증명한다.
  // 기존 claude_ 엔트리는 저장 키로 그대로 두고, runner 연결만 별도 저장한다.
  let runnerId = "";
  const localRunner = body?.runner;
  if (localRunner?.id || localRunner?.token) {
    try {
      const runner = await claimRunner({
        runnerId: String(localRunner.id || ""),
        token: String(localRunner.token || ""),
        entryId: id,
        nick,
        identities: {
          claude: id,
          ...(report.codex?.account_id ? { codex: String(report.codex.account_id) } : {}),
        },
      });
      runnerId = runner.id;
    } catch (err) {
      if (err instanceof RunnerCredentialError || err instanceof RunnerIdentityConflict) {
        return badRequest(err.message);
      }
      throw err;
    }
  } else {
    // 구버전 클라이언트도 기존 연결을 잃지 않게 한다.
    runnerId = (await runnerForEntry(id))?.id || "";
  }

  // ── 기기별 슬롯 저장 → 계정의 모든 기기 병합 → 합산 집계 ──
  // device_id 는 클라이언트(build.py)가 실어보냄. 없으면 "legacy" 단일 슬롯(구버전=기존 동작).
  const rawDev = String(report.device_id || "").trim();
  const deviceId = /^[A-Za-z0-9_-]{1,64}$/.test(rawDev) ? rawDev : "legacy";
  let deviceMap;
  try {
    deviceMap = await saveDeviceReport(id, deviceId, report);
  } catch (err) {
    if (err instanceof DeviceIdentityConflict) return badRequest(err.message);
    throw err;
  }
  const merged = mergeReports(slotReports(deviceMap)) || report;
  if (merged.codex?.account_conflict) {
    return badRequest("여러 Codex 계정 기록이 섞여 있어 병합을 중단했어요. 기존 기록은 유지됩니다.");
  }

  const e = entryFromReport(id, nick, merged, runnerId || undefined);
  await upsert(e);
  await saveReport(id, merged);   // 상세페이지도 합산 리포트를 보게 됨

  // 제출 직후 "지금 몇 위인지"를 돌려준다 — CLI가 다시 달릴 이유를 주는 유일한 신호.
  // 기준 달: 이번 달(KST) 기록이 있으면 이번 달, 없으면 가장 최근 달.
  const nowMonth = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7);
  const mks = Object.keys(e.months).sort();
  const month = e.months[nowMonth] ? nowMonth : (mks[mks.length - 1] || nowMonth);
  const { rank, total } = rankIn(await all(), id, month, e.plan);
  return ok({ ok: true, entry: e, profile_id: runnerId || id, month, rank, total });
});
