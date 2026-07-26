#!/usr/bin/env python3
"""ccusage --json -> 원화 월별 가성비 보고서(HTML). 월 탭 + 가격/질적 위젯 분할.
사용: python build.py <ccusage.json> <out.html> [plan_usd] [krw] [rtk.json] [sessions.json]
Claude 모델만 집계(구독 가성비 기준). 비-Claude(codex 등)는 제외."""
import json, sys, os
from collections import defaultdict
from datetime import date as _date

VIEWS = [("day","일별 기준"),("sess","세션 기준"),("eff","효율"),("hour","시간대"),("commit","커밋")]
_WD = ["월","화","수","목","금","토","일"]
def wlabel(ds):  # "YYYY-MM-DD" -> 요일 약어(주말 색 구분)
    try:
        wd = _date.fromisoformat(ds).weekday()
    except Exception:
        return ""
    col = "#c15f3c" if wd == 6 else ("#6a9bcc" if wd == 5 else "#b3aa9c")  # 일=빨강, 토=파랑
    return f'<span class="cw" style="color:{col}">{_WD[wd]}</span>'

src   = sys.argv[1]
out   = sys.argv[2]
PLAN  = float(sys.argv[3]) if len(sys.argv) > 3 else 200.0
KRW   = float(sys.argv[4]) if len(sys.argv) > 4 else 1500.0
RTK_SRC  = sys.argv[5] if len(sys.argv) > 5 and sys.argv[5] else None
SESS_SRC = sys.argv[6] if len(sys.argv) > 6 and sys.argv[6] else None

# 월별 플랜 오버라이드: USAGE_REPORT_PLANS="2026-05=100,2026-06=200"
PLANS = {}
for part in os.environ.get("USAGE_REPORT_PLANS", "").split(","):
    if "=" in part:
        k, v = part.split("=", 1)
        try: PLANS[k.strip()] = float(v)
        except Exception: pass
def plan_for(m): return PLANS.get(m, PLAN)

sess = {}
if SESS_SRC:
    try: sess = json.load(open(SESS_SRC))
    except Exception: sess = {}

OPUS_IN_RATE = 5.0  # $/1M input tokens (RTK 절감 환산용)
rtk_saved, rtk_total_saved = {}, 0
if RTK_SRC:
    try:
        rj = json.load(open(RTK_SRC))
        for row in rj.get("monthly", []):
            rtk_saved[row["month"]] = row.get("saved_tokens", 0)
        rtk_total_saved = rj.get("summary", {}).get("total_saved") or sum(rtk_saved.values())
    except Exception:
        rtk_saved, rtk_total_saved = {}, 0

d = json.load(open(src))
colors = {"opus-4-8":"#d97757","opus-4-6":"#c15f3c","sonnet-4-6":"#6a9bcc",
          "fable-5":"#8b6db5","haiku-4-5":"#5fa563","opus-4-8-fast":"#b08050",
          "opus-4-6-fast":"#e0a060"}
def color(m): return colors.get(m, "#999")
def avgline(vals, scale_max, fmt):
    """막대 차트용 평균 점선 + 라벨. scale_max = 막대 높이 환산 기준."""
    if not vals or not scale_max: return ""
    av = sum(vals)/len(vals)
    return (f'<div class="avgline" style="bottom:{min(av/scale_max*100,100):.1f}%">'
            f'<span>평균 {fmt(av)}</span></div>')
def short(m): return m.replace("claude-","").replace("-20251001","")
def won(usd):
    man = usd*KRW/1_0000
    return f"{man/10000:.2f}억" if man >= 10000 else f"{man:,.0f}만"
def rtk_won(tokens): return won(tokens / 1_000_000 * OPUS_IN_RATE)

# 월 -> 모델 -> cost, 월 -> 일 -> {total, models}
mm = defaultdict(lambda: defaultdict(float))
dd = defaultdict(lambda: defaultdict(lambda: {"total":0.0, "models":defaultdict(float)}))
for day in d.get("daily", []):
    date  = day["period"]; month = date[:7]
    for b in day.get("modelBreakdowns", []):
        name = b["modelName"]
        if not name.startswith("claude"): continue
        c = b.get("cost", 0); sm = short(name)
        mm[month][sm] += c
        dd[month][date]["total"] += c
        dd[month][date]["models"][sm] += c

months = sorted(m for m in mm if sum(mm[m].values()) >= 0.01)
grand  = sum(sum(mm[m].values()) for m in months)
DMAX = max((x["total"] for m in months for x in dd[m].values()), default=1) or 1


def price_panel(mo):
    models = mm[mo]; tot = sum(models.values()); pl = plan_for(mo); ratio = tot/pl
    stack=""; legend=""
    for m,c in sorted(models.items(), key=lambda x:-x[1]):
        pct = c/tot*100
        if pct < 0.3: continue
        stack  += f'<span style="width:{pct}%;background:{color(m)}"></span>'
        legend += (f'<div class="lr"><span class="dot" style="background:{color(m)}">'
                   f'</span><b>{m}</b><span class="lp">₩{won(c)} · {pct:.0f}%</span></div>')
    days = sorted(dd[mo]); bars=""
    for date in days:
        x = dd[mo][date]; h = x["total"]/DMAX*100; seg=""
        for m,c in sorted(x["models"].items(), key=lambda y:y[1]):
            seg = f'<span style="height:{c/x["total"]*100}%;background:{color(m)}"></span>' + seg
        bars += (f'<div class="col" title="{date} · ₩{won(x["total"])}">'
                 f'<div class="cb" style="height:{h:.1f}%">{seg}</div>'
                 f'<div class="cx">{int(date[8:])}{wlabel(date)}</div></div>')
    peak = max(days, key=lambda dt: dd[mo][dt]["total"])
    rtk_html = ""
    if rtk_saved.get(mo, 0) > 0:
        st = rtk_saved[mo]
        rtk_html = (f'<div class="rtk"><span class="rk">🔪 RTK 토큰 절감</span>'
                    f'<span class="rv">₩{rtk_won(st)} 아낌</span>'
                    f'<span class="rt">{st/1_000_000:.1f}M 토큰 컷</span></div>')
    return f'''<div class="w">
      <div class="ph">💰 가격</div>
      <div class="wt"><div><div class="wb">₩{won(tot)}</div><div class="ws">정가 환산 · {len(days)}일</div></div>
        <div class="wr"><div class="rx">{ratio:.0f}×</div><div class="rl">₩{won(pl)} 구독 대비</div></div></div>
      <div class="chart">{bars}{avgline([dd[mo][d]["total"] for d in days], DMAX, lambda a: "₩"+won(a))}</div>
      <div class="ccap">일별 정가 환산 · 최고일 {peak[5:]} ₩{won(dd[mo][peak]["total"])}</div>
      <div class="stk">{stack}</div><div class="lg">{legend}</div>
      <div class="cmp"><div class="c"><span class="ck">실제 지불</span><span class="cv">₩{won(pl)}</span></div>
        <span class="ar">→</span><div class="c"><span class="ck">API 정가</span><span class="cv hot">₩{won(tot)}</span></div>
        <span class="ar">=</span><div class="c"><span class="ck">순이득</span><span class="cv good">₩{won(tot-pl)}</span></div></div>
      {rtk_html}
    </div>'''


def quality_panel(mo):
    s = sess.get(mo)
    if not s:
        return '<div class="w"><div class="ph">📊 질적 · 활동</div><div class="ws">세션 데이터 없음</div></div>'
    persess, perday, med, mx = s["per_session"], s["per_day"], s["median"], s["max"]

    # === 세션 기준 view: 세션 크기 분포 히스토그램 ===
    bk = s.get("buckets", {})
    bmax = max(bk.values()) if bk else 1
    bbars = ""
    for label in ["1-5","6-10","11-20","21-50","50+"]:
        n = bk.get(label, 0); h = n/bmax*100 if bmax else 0
        bbars += (f'<div class="col" title="{label}채팅 세션: {n}개">'
                  f'<div class="cb" style="height:{h:.1f}%;background:#d97757;border-radius:3px 3px 0 0;min-height:{2 if n else 0}px"></div>'
                  f'<div class="cx2">{label}</div></div>')
    skew = "쏠림 큼 (소수 긴 세션)" if persess > med*2 else "고른 분포"
    view_sess = f'''<div class="qview" data-v="sess">
      <div class="act">
        <div class="ai"><span class="an">{s["sessions"]}</span><span class="al">작업세션</span></div>
        <div class="ai"><span class="an">{persess:.0f}</span><span class="al">세션당 채팅</span></div>
        <div class="ai"><span class="an">{med}</span><span class="al">중앙값</span></div>
        <div class="ai"><span class="an">{mx:,}</span><span class="al">최대 세션</span></div>
      </div>
      <div class="chart wide">{bbars}</div>
      <div class="ccap">세션 크기 분포 (가로축 = 세션당 채팅 수 구간)</div>
      <div class="qnote">세션당 평균 {persess:.0f}채팅 vs 중앙값 {med} → <b>{skew}</b>. 대부분 짧은 세션({med}채팅대)이고, 가끔 긴 세션({mx}채팅) 1~2건이 평균을 끌어올림.</div>
    </div>'''

    # === 일별 기준 view: 일별 채팅 추이 ===
    dmap = s.get("daily", {})
    dchart = ""
    if dmap:
        dmax = max(dmap.values()) or 1; dseries = sorted(dmap); bars = ""
        for date in dseries:
            v = dmap[date]; h = v/dmax*100
            bars += (f'<div class="col" title="{date} · {v}채팅">'
                     f'<div class="cb" style="height:{h:.1f}%;background:#6a9bcc;border-radius:3px 3px 0 0"></div>'
                     f'<div class="cx">{int(date[8:])}{wlabel(date)}</div></div>')
        peak = max(dseries, key=lambda d: dmap[d])
        dchart = (f'<div class="chart">{bars}{avgline(list(dmap.values()), dmax, lambda a: f"{a:.0f}")}</div>'
                  f'<div class="ccap">일별 채팅 수 · 최고일 {peak[5:]} {dmap[peak]}채팅</div>')
    view_day = f'''<div class="qview" data-v="day">
      <div class="act">
        <div class="ai"><span class="an">{s["active_days"]}</span><span class="al">활동일</span></div>
        <div class="ai"><span class="an">{perday:.0f}</span><span class="al">일평균 채팅</span></div>
        <div class="ai"><span class="an">{s["day_max"]:,}</span><span class="al">최고일</span></div>
      </div>
      {dchart}
      <div class="qnote">활동일 {s["active_days"]}일 · 하루 평균 {perday:.0f}채팅. 채팅 = 사람이 친 메시지 수.</div>
    </div>'''

    # === 효율(마찰) view ===
    ef = s.get("eff", {})
    ch, te, co = ef.get("cache_hit",0), ef.get("tool_err",0), ef.get("correction",0)
    def gauge(label, val, good_high, suffix="%"):
        # good_high=True면 높을수록 초록, False면 낮을수록 초록
        ok = (val >= 80) if good_high else (val <= 10)
        col = "#5fa563" if ok else "#c15f3c"
        w = min(val, 100)
        return (f'<div class="qstat"><span class="ql">{label}</span>'
                f'<div class="qbar"><span style="width:{w:.0f}%;background:{col}"></span></div>'
                f'<span class="qv">{val:.1f}{suffix}</span></div>')
    verdict = "매끄럽게 쓰는 중 ✅" if (ch>=90 and te<=5 and co<=15) else "마찰 다소 있음"
    view_eff = f'''<div class="qview" data-v="eff">
      <div class="act">
        <div class="ai"><span class="an">{ch:.0f}%</span><span class="al">캐시 적중</span></div>
        <div class="ai"><span class="an">{te:.1f}%</span><span class="al">도구 에러</span></div>
        <div class="ai"><span class="an">{co:.1f}%</span><span class="al">정정율</span></div>
      </div>
      {gauge("캐시적중", ch, True)}
      {gauge("도구에러", te, False)}
      {gauge("정정('아니/다시')", co, False)}
      <div class="qnote"><b>{verdict}</b> · 캐시적중 높을수록·도구에러/정정율 낮을수록 매끄러움. 정정율 = 사람 메시지 중 정정/불만 신호 비율(근사). 도구호출 {ef.get("tool_calls",0):,}회 기준.</div>
    </div>'''

    # === 시간대 view ===
    hh = s.get("hourly", {})
    hvals = [hh.get(str(i), 0) for i in range(24)]
    hmax = max(hvals) or 1
    htot = sum(hvals) or 1
    hbars = ""
    for i in range(24):
        v = hvals[i]; bh = v/hmax*100
        night = (0 <= i <= 5)
        col = "#8b6db5" if night else "#6a9bcc"
        hbars += (f'<div class="col" title="{i}시 · {v}채팅">'
                  f'<div class="cb" style="height:{bh:.1f}%;background:{col};border-radius:3px 3px 0 0;min-height:{1 if v else 0}px"></div>'
                  f'<div class="cx">{i}</div></div>')
    peak_h = max(range(24), key=lambda i: hvals[i])
    night_ratio = sum(hvals[0:6])/htot*100
    # 시간블록별 비중으로 패턴 판정
    blocks = {"새벽 0-5시": sum(hvals[0:6]), "아침 6-11시": sum(hvals[6:12]),
              "오후 12-17시": sum(hvals[12:18]), "저녁 18-23시": sum(hvals[18:24])}
    dom = max(blocks, key=blocks.get)
    icon = "🌙" if dom.startswith("새벽") or dom.startswith("저녁") else "☀️"
    view_hour = f'''<div class="qview" data-v="hour">
      <div class="act">
        <div class="ai"><span class="an">{peak_h}시</span><span class="al">피크 시간</span></div>
        <div class="ai"><span class="an">{hvals[peak_h]:,}</span><span class="al">피크 채팅</span></div>
        <div class="ai"><span class="an">{night_ratio:.0f}%</span><span class="al">새벽(0-5시)</span></div>
      </div>
      <div class="chart">{hbars}{avgline(hvals, hmax, lambda a: f"{a:.0f}")}</div>
      <div class="ccap">시간대별 채팅 수 (KST 0~23시) · 보라=새벽 0-5시</div>
      <div class="qnote">피크 {peak_h}시 · 가장 활발한 시간대는 <b>{dom}</b>({blocks[dom]/htot*100:.0f}%). {icon} 새벽 비중 {night_ratio:.0f}%.</div>
    </div>'''

    # === 커밋 view ===
    g = s.get("git", {})
    gc, gp, gdaily = g.get("commit",0), g.get("push",0), g.get("daily",{})
    gchart = ""
    if gdaily:
        gmax = max(gdaily.values()) or 1; gser = sorted(gdaily)
        gbars = ""
        for date in gser:
            v = gdaily[date]; bh = v/gmax*100
            gbars += (f'<div class="col" title="{date} · {v}커밋">'
                      f'<div class="cb" style="height:{bh:.1f}%;background:#5fa563;border-radius:3px 3px 0 0"></div>'
                      f'<div class="cx">{int(date[8:])}{wlabel(date)}</div></div>')
        gpeak = max(gser, key=lambda d: gdaily[d])
        gavg = avgline(list(gdaily.values()), gmax, lambda a: f"{a:.0f}")
        gchart = (f'<div class="chart">{gbars}{gavg}</div>'
                  f'<div class="ccap">일별 커밋 수 · 최고일 {gpeak[5:]} {gdaily[gpeak]}커밋</div>')
    gactive = len(gdaily)
    gper = gc/gactive if gactive else 0
    view_commit = f'''<div class="qview" data-v="commit">
      <div class="act">
        <div class="ai"><span class="an">{gc:,}</span><span class="al">커밋</span></div>
        <div class="ai"><span class="an">{gp:,}</span><span class="al">푸시</span></div>
        <div class="ai"><span class="an">{gper:.0f}</span><span class="al">일평균 커밋</span></div>
      </div>
      {gchart}
      <div class="qnote">세션 중 친 <code>git commit</code> 횟수 — <b>스쿼시 머지와 무관</b>(당시 활동량). 실패한 커밋도 일부 포함될 수 있는 근사치.</div>
    </div>'''

    rid = mo.replace("-", "")
    radios = "".join(
        f'<input type="radio" name="q-{rid}" id="q-{rid}-{v}" class="qradio"{" checked" if i==0 else ""}>'
        for i,(v,_) in enumerate(VIEWS))
    chips = "".join(
        f'<label for="q-{rid}-{v}" class="chip" data-v="{v}">{lbl}</label>'
        for v,lbl in VIEWS)
    return f'''<div class="w">
      <div class="ph">📊 질적 · 활동</div>
      <div class="qtop"><span class="qtn">{s["chats"]:,}</span><span class="qtl">총 채팅 (사람이 친 메시지)</span></div>
      {radios}
      <div class="chips">{chips}</div>
      {view_sess}{view_day}{view_eff}{view_hour}{view_commit}
    </div>'''


# 월 라디오(패널 형제로 최상단), 탭 라벨, 패널 — 전부 CSS :checked로 토글(JS 불필요)
last = len(months)-1
mon_radios = "".join(
    f'<input type="radio" name="mon" id="m-{m.replace("-","")}" class="mradio"{" checked" if i==last else ""}>'
    for i,m in enumerate(months))
tabs = '<div class="tabs">' + "".join(
    f'<label for="m-{m.replace("-","")}" class="tab" data-m="{m}">{m.split("-")[0]}.{int(m.split("-")[1])}월</label>'
    for m in months) + '</div>'
panels = "".join(
    f'<div class="month" data-m="{m}"><div class="grid">{price_panel(m)}{quality_panel(m)}</div></div>'
    for m in months)

# 동적 CSS: 월 전환 + 칩(질적) 전환 규칙
css_rules = []
for m in months:
    mid = m.replace("-","")
    css_rules.append(f'#m-{mid}:checked~.tabs label[data-m="{m}"]{{background:#2a2622;color:#f4f1ea;border-color:#2a2622}}')
    css_rules.append(f'#m-{mid}:checked~.month[data-m="{m}"]{{display:block}}')
    # 질적 칩(패널 내부 스코프) — 모든 뷰
    for v,_ in VIEWS:
        css_rules.append(f'#q-{mid}-{v}:checked~.qview[data-v="{v}"]{{display:block}}')
        css_rules.append(f'#q-{mid}-{v}:checked~.chips label[for="q-{mid}-{v}"]{{background:#d97757;color:#fff;border-color:#d97757}}')
dyn_css = "\n".join(css_rules)

nmon  = len(months)
total_plan = sum(plan_for(m) for m in months)
ratio = grand/total_plan if total_plan else 0
rtk_banner = ""
if rtk_total_saved > 0:
    rtk_banner = (f'<div class="rtkbar"><div><div class="tk">🔪 RTK 누적 토큰 절감 (역추적)</div>'
                  f'<div class="rtkv">₩{rtk_won(rtk_total_saved)} 아낌</div></div>'
                  f'<div class="tr"><div class="tk">잘라낸 토큰</div><b>{rtk_total_saved/1_000_000:.1f}M</b></div></div>')

html = f'''<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Claude 구독 가성비</title>
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:-apple-system,'Segoe UI','Apple SD Gothic Neo',sans-serif;background:#f4f1ea;color:#2a2622;padding:30px 16px;line-height:1.5}}
.wrap{{max-width:900px;margin:0 auto}}
h1{{font-family:Georgia,serif;font-size:26px;letter-spacing:-.5px}}
.sub{{color:#7a7268;font-size:13px;margin:6px 0 22px}}
.tot{{background:#2a2622;color:#f4f1ea;border-radius:14px;padding:20px 24px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}}
.tk{{font-size:12px;color:#9a9389;text-transform:uppercase;letter-spacing:.5px}}
.tv{{font-size:32px;font-weight:800;font-family:Georgia,serif;color:#d97757}}
.tr{{text-align:right}} .tr b{{font-size:22px;color:#5fa563}}
.tabs{{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}}
.tab{{display:inline-block;cursor:pointer;border:1px solid #e6e0d6;background:#fff;color:#7a7268;border-radius:999px;padding:8px 18px;font-size:14px;font-weight:600;transition:.15s;user-select:none}}
.tab:hover{{border-color:#d97757}}
.mradio{{display:none}}
.month{{display:none}}
.grid{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}
@media(max-width:680px){{.grid{{grid-template-columns:1fr}}}}
.w{{background:#fff;border:1px solid #e6e0d6;border-radius:16px;padding:20px}}
.ph{{font-size:12px;font-weight:700;color:#9a9389;letter-spacing:.5px;margin-bottom:12px;padding-bottom:9px;border-bottom:1px solid #f0ebe2}}
.wt{{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:13px}}
.wb{{font-size:30px;font-weight:800;font-family:Georgia,serif;margin:2px 0;letter-spacing:-1px}}
.ws{{font-size:12px;color:#9a9389}} .wr{{text-align:right;flex:none}}
.rx{{font-size:28px;font-weight:800;color:#5fa563;font-family:Georgia,serif;line-height:1}}
.rl{{font-size:11px;color:#9a9389;margin-top:2px}}
.chart{{position:relative;display:flex;align-items:flex-end;gap:2px;height:120px;padding-top:6px;border-bottom:2px solid #e6e0d6;margin-bottom:6px}}
.avgline{{position:absolute;left:0;right:0;height:0;border-top:1.5px dashed #c15f3c;pointer-events:none;z-index:2}}
.avgline span{{position:absolute;right:0;top:-14px;font-size:9px;font-weight:700;color:#c15f3c;background:rgba(255,255,255,.85);padding:0 3px;border-radius:3px}}
.col{{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%}}
.cb{{width:76%;display:flex;flex-direction:column;border-radius:3px 3px 0 0;overflow:hidden;min-height:1px}} .cb span{{width:100%}}
.col:hover .cb{{outline:2px solid #2a2622;outline-offset:1px}}
.cx{{font-size:8px;color:#b3aa9c;margin-top:2px;font-variant-numeric:tabular-nums;text-align:center;line-height:1.25}}
.cw{{display:block;font-size:8px}}
.ccap{{font-size:11px;color:#9a9389;margin-bottom:13px}}
.stk{{display:flex;height:15px;border-radius:8px;overflow:hidden;background:#eee;margin-bottom:13px}} .stk span{{height:100%}}
.lg{{border-top:1px solid #f0ebe2;padding-top:11px;margin-bottom:13px}}
.lr{{display:flex;align-items:center;gap:8px;font-size:13px;margin:5px 0}}
.lr b{{font-weight:600;min-width:108px}} .lp{{color:#9a9389;font-size:12px}}
.dot{{width:10px;height:10px;border-radius:3px;flex:none}}
.cmp{{display:flex;align-items:stretch;gap:8px;flex-wrap:wrap;background:#fbf4ee;border-radius:10px;padding:13px 14px}}
.c{{display:flex;flex-direction:column;justify-content:space-between;min-height:44px}}
.ck{{font-size:11px;color:#9a9389}} .cv{{font-size:15px;font-weight:700;margin-top:auto}}
.cv.hot{{color:#d97757}} .cv.good{{color:#5fa563}} .ar{{color:#c9c0b3;font-weight:700;display:flex;align-items:center}}
.rtk{{display:flex;align-items:center;gap:10px;background:#2a2622;color:#f4f1ea;border-radius:10px;padding:10px 14px;margin-top:8px;font-size:13px}}
.rk{{color:#e0a060;font-weight:600}} .rv{{font-weight:800;color:#5fa563}} .rt{{color:#9a9389;font-size:11px;margin-left:auto;font-variant-numeric:tabular-nums}}
.rtkbar{{background:#322b22;border:1px solid #4a4030;border-radius:14px;padding:16px 24px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;color:#f4f1ea}}
.rtkv{{font-size:26px;font-weight:800;font-family:Georgia,serif;color:#e0a060}} .rtkbar b{{font-size:20px;color:#e0a060;font-family:Georgia,serif}}
.qtop{{display:flex;align-items:baseline;gap:9px;padding:12px 14px;margin-bottom:13px;background:#2a2622;border-radius:11px;color:#f4f1ea}}
.qtn{{font-size:26px;font-weight:800;font-family:Georgia,serif;color:#6a9bcc;line-height:1}}
.qtl{{font-size:12px;color:#9a9389}}
.act{{display:flex;gap:6px;margin-bottom:12px}}
.ai{{flex:1;background:#faf7f0;border:1px solid #efe9dd;border-radius:9px;padding:10px 4px;text-align:center}}
.an{{display:block;font-size:20px;font-weight:800;font-family:Georgia,serif;color:#2a2622;font-variant-numeric:tabular-nums}}
.al{{display:block;font-size:10px;color:#9a9389;margin-top:1px}}
.chips{{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}}
.chips.bottom{{margin-bottom:0;margin-top:14px;padding-top:13px;border-top:1px solid #f0ebe2;justify-content:center}}
.chip{{display:inline-block;cursor:pointer;border:1px solid #e6e0d6;background:#faf7f0;color:#7a7268;border-radius:999px;padding:5px 14px;font-size:12px;font-weight:600;transition:.15s;user-select:none}}
.chip:hover{{border-color:#d97757}}
.qradio{{display:none}}
.qview{{display:none}}
{dyn_css}
.chart.wide .col{{gap:0}} .chart.wide .cb{{width:60%}}
.cx2{{font-size:10px;color:#9a9389;margin-top:3px;white-space:nowrap}}
.qstat{{display:flex;align-items:center;gap:10px;margin:9px 0}}
.ql{{font-size:12px;color:#7a7268;width:54px;flex:none}}
.qbar{{flex:1;height:14px;background:#f0ebe2;border-radius:7px;overflow:hidden}} .qbar span{{display:block;height:100%;border-radius:7px}}
.qv{{font-size:15px;font-weight:800;font-family:Georgia,serif;width:38px;text-align:right;flex:none}}
.qnote{{font-size:12px;color:#5a534a;background:#faf7f0;border-radius:9px;padding:11px 13px;margin-top:14px}}
.note{{background:#fff;border:1px solid #e6e0d6;border-left:4px solid #d97757;border-radius:10px;padding:14px 18px;font-size:13px;color:#5a534a;margin-top:20px}}
.foot{{text-align:center;color:#9a9389;font-size:11.5px;margin-top:22px}}
</style></head><body><div class="wrap">
<h1>Claude 구독 가성비 보고서</h1>
<p class="sub">ccusage 로컬 데이터 · ₩{KRW:,.0f}/$ 환산 · Max 20x ₩{won(PLAN)}/월 · Claude 모델만 집계</p>
{mon_radios}{tabs}
{panels}
<div class="note">⚠️ 가격은 "같은 양을 API 정가로 썼다면"의 <b>가상 환산값</b>이며 실제 청구는 정액입니다.
질적 위젯의 세션은 1시간 공백으로 분할한 '작업 세션'(사람 발화만 카운트)입니다.
{'<br>🔪 <b>RTK 절감</b>은 <code>rtk gain</code> 절감 토큰을 Opus 4.8 입력단가($5/1M)로 환산한 <b>보수적 추정</b>입니다.' if rtk_total_saved > 0 else ''}</div>
<div class="foot">월 탭을 눌러 전환 · usage-report 스킬 생성</div>
</div>
</body></html>'''
open(out, "w").write(html)

# === JSON 출력 (제출/리더보드용 머신리더블 요약) ===
import os as _os
summary = {
    "generated_for": "claude-usage-report",
    "id": _os.environ.get("USAGE_REPORT_ID", ""),   # 익명 고유 ID(제출 갱신용)
    "device_id": _os.environ.get("USAGE_REPORT_DEVICE", ""),   # 기기 슬롯 키(기기별 합산용)
    "plan_tier": _os.environ.get("USAGE_REPORT_PLAN_TIER", ""), # 실제 구독 티어(서버 종목 검증용)
    "currency_krw_per_usd": KRW,
    "plan_usd_per_month": PLAN,                       # 기본 플랜
    "plans_by_month": {m: plan_for(m) for m in months},  # 월별 플랜($200/$100 등)
    "totals": {
        "months": nmon,
        "plan_usd_total": total_plan,
        "cost_usd": round(grand, 2),
        "cost_krw": round(grand * KRW),
        "net_benefit_krw": round((grand - total_plan) * KRW),
        "ratio": round(ratio, 1),
    },
    "months": {},
}
for m in months:
    tot = sum(mm[m].values())
    s = sess.get(m, {})
    summary["months"][m] = {
        "plan_usd": plan_for(m),
        "cost_usd": round(tot, 2),
        "cost_krw": round(tot * KRW),
        "ratio": round(tot / plan_for(m), 1),
        "models": {k: round(v, 2) for k, v in sorted(mm[m].items(), key=lambda x: -x[1])},
        "sessions": s.get("sessions"),
        "chats": s.get("chats"),
        "per_session": s.get("per_session"),
        "median_session": s.get("median"),
        "max_session": s.get("max"),
        "active_days": s.get("active_days"),
        "per_day": s.get("per_day"),
        "efficiency": s.get("eff"),
        "git": {"commit": s.get("git", {}).get("commit"), "push": s.get("git", {}).get("push")},
        # 시계열(상세 차트 렌더용)
        "series": {
            "daily_cost_krw": {d: round(dd[m][d]["total"] * KRW) for d in sorted(dd[m])},
            "daily_chats": s.get("daily", {}),
            "daily_commits": s.get("git", {}).get("daily", {}),
            "hourly": s.get("hourly", {}),
            "buckets": s.get("buckets", {}),
        },
    }
out_json = out[:-5] + ".json" if out.endswith(".html") else out + ".json"
open(out_json, "w").write(json.dumps(summary, ensure_ascii=False, indent=2))

_rtk_msg = f"  | 🔪RTK ₩{rtk_won(rtk_total_saved)} 아낌 ({rtk_total_saved/1_000_000:.1f}M컷)" if rtk_total_saved > 0 else ""
print(f"OK  {nmon}개월  정가 ₩{won(grand)}  순이득 ₩{won(grand-PLAN*nmon)}  ({ratio:.0f}배){_rtk_msg}")
print(f"    HTML: {out}")
print(f"    JSON: {out_json}")
