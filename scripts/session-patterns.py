#!/usr/bin/env python3
"""Claude Code 로그에서 '어떻게 쓸 때 결과가 남았나'를 재는 분석기.

  scripts/session-patterns.py [분석...] [--month YYYY-MM] [--base DIR]

  분석: shape rhythm undo verbosity context parallel practices  (기본: 전부)
  예:   scripts/session-patterns.py rhythm undo --month 2026-08

블로그 글 두 편(leverage-per-turn · supervision-density)의 숫자가 여기서 나온다.
탐색용 일회성 스크립트 7개를 하나로 합친 것이라, 다음 달 데이터로 그냥 다시 돌리면 된다.

── 왜 이런 모양인가 ──────────────────────────────────────────────────
결과 지표는 '세션당 커밋'이 아니라 **커밋/턴**이다. 세션당으로 재면 긴 세션이
전부 이긴다 — 무슨 표식이든(되돌림·이모지·MCP·이미지) 세션이 길수록 나올 확률이
올라가기 때문이다. 실제로 말투·이모지 지표는 세션당으로는 유의해 보였지만
길이를 통제하니 전부 사라졌다.

그래서 이 스크립트는 **세션 길이대 안에서만 비교한다**(band()). 밴드를 가로질러
비교하지 마라. 그건 이미 한 번 틀린 방법이다.

세션 분할·사람 발화 판정은 usage-report 의 sess.py 와 같은 규칙을 쓴다.
어긋나면 리포트에 뜨는 숫자와 여기 숫자가 달라진다:
  · GAP(1시간) 공백이면 새 작업 세션. 파일=세션이 아니다(--continue 착시 방지)
  · isSidechain(서브에이전트) 레코드의 user 는 사람이 아니라 부모가 던진 프롬프트다.
    사람 턴에 넣으면 '얼마나 쳤나'가 부풀려진다. 도구 호출은 별도 파일에서 따로 센다
  · tool_result 만 담긴 user 메시지는 사람 발화가 아니다
"""
import argparse, glob, json, os, re, statistics, sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

GAP = 3600                      # 이 이상 공백이면 새 작업 세션
TZ_HOURS = float(os.environ.get("USAGE_REPORT_TZ", "9"))
LOCAL = timezone(timedelta(hours=TZ_HOURS))

COMMIT = re.compile(r"\bgit\s+commit\b")
UNDO = re.compile(r"\bgit\s+(reset|checkout\s+--|revert|stash|restore)\b")
TEST = re.compile(r"\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b|\b(pytest|vitest|jest|go test|cargo test)\b")
WORKTREE = re.compile(r"\bgit\s+worktree\b|\borca\b")
THINK = re.compile(r"(ultrathink|think hard|깊게 생각|한번 더 생각|신중히)", re.I)
# 정정 신호. 정규식 근사라 절대값은 못 믿는다 — 같은 기준의 추이로만 읽어라.
FRUSTR = re.compile(r"(아니|틀렸|다시|왜 안|안돼|안 돼|not work|wrong|undo|되돌|그게 아니|잘못)", re.I)

EDIT_TOOLS = {"Edit", "Write", "NotebookEdit", "MultiEdit"}
SEEK_TOOLS = {"Read", "Grep", "Glob"}          # 에이전트가 맥락을 찾아 헤맨 양

# 길이 밴드. 비교는 항상 이 안에서만.
BANDS = [(1, 5, "1-5턴"), (6, 15, "6-15턴"), (16, 40, "16-40턴"), (41, 10**9, "41턴+")]
MIN_GROUP = 8                   # 이보다 작은 칸은 숫자를 내지 않는다


# ── 로그 읽기 ────────────────────────────────────────────────────────
def parse_ts(o):
    ts = o.get("timestamp")
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(LOCAL)
    except Exception:
        return None


def is_human(o):
    """사람이 실제로 텍스트를 친 메시지인가. tool_result 만 담긴 건 아니다."""
    c = o.get("message", {}).get("content")
    if isinstance(c, str):
        return c.strip() != ""
    if isinstance(c, list):
        has_text = any(isinstance(b, dict) and b.get("type") == "text"
                       and b.get("text", "").strip() for b in c)
        only_result = bool(c) and all(isinstance(b, dict) and b.get("type") == "tool_result" for b in c)
        return has_text and not only_result
    return False


def human_text(o):
    c = o.get("message", {}).get("content")
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return " ".join(b.get("text", "") for b in c
                        if isinstance(b, dict) and b.get("type") == "text")
    return ""


def subagent_tool_times(base):
    """서브에이전트 도구 호출 시각을 부모 세션 파일별로 모은다.
    기록이 <세션>/subagents/*.jsonl 에 따로 쌓여서, 부모 파일만 훑으면 통째로 놓친다."""
    out = defaultdict(list)
    for f in glob.glob(os.path.join(base, "*", "*", "subagents", "*.jsonl")):
        parent = os.path.dirname(os.path.dirname(f)) + ".jsonl"
        try:
            fh = open(f)
        except OSError:
            continue
        with fh:
            for line in fh:
                try:
                    o = json.loads(line)
                except Exception:
                    continue
                if o.get("type") != "assistant":
                    continue
                dt = parse_ts(o)
                if not dt:
                    continue
                for b in o.get("message", {}).get("content", []) or []:
                    if isinstance(b, dict) and b.get("type") == "tool_use":
                        out[parent].append(dt)
    return out


def load_sessions(base, month):
    """월에 시작한 작업 세션 목록. 세션 하나가 dict 하나."""
    subs_by_parent = subagent_tool_times(base)
    sessions = []
    for f in glob.glob(os.path.join(base, "*", "*.jsonl")):
        events = []
        try:
            fh = open(f)
        except OSError:
            continue
        with fh:
            for line in fh:
                try:
                    o = json.loads(line)
                except Exception:
                    continue
                dt = parse_ts(o)
                if dt:
                    events.append((dt, o))
        if not events:
            continue
        events.sort(key=lambda x: x[0])
        subs = sorted(subs_by_parent.get(f, []))

        chunks, cur, last = [], [], None
        for dt, o in events:
            if last and (dt - last).total_seconds() > GAP and cur:
                chunks.append(cur)
                cur = []
            cur.append((dt, o))
            last = dt
        if cur:
            chunks.append(cur)

        project = os.path.basename(os.path.dirname(f))
        for ch in chunks:
            s = _summarize(ch, project, subs)
            if s["turns"] > 0 and s["start"].strftime("%Y-%m") == month:
                sessions.append(s)
    sessions.sort(key=lambda s: s["start"])
    return sessions


def _summarize(chunk, project, sub_times):
    t0, t1 = chunk[0][0], chunk[-1][0]
    s = {
        "project": project, "start": t0, "end": t1,
        "turns": 0, "commits": 0, "undo": 0, "edits": 0, "seek": 0, "mcp": 0,
        "tools": 0, "tests": 0, "worktree": 0, "corrections": 0,
        "sub": sum(1 for d in sub_times if t0 <= d <= t1),
        "first_text": "", "first_len": 0, "plan_mode": False, "think": False,
        "gaps": [],          # 사람 턴 사이 간격(초)
        "reply_lens": [],    # 에이전트 텍스트 응답 길이
        "tool_names": Counter(),
    }
    prev_human = None
    for dt, o in chunk:
        if o.get("permissionMode") == "plan":
            s["plan_mode"] = True
        kind, side = o.get("type"), bool(o.get("isSidechain"))

        if kind == "assistant" and not side:
            for b in o.get("message", {}).get("content", []) or []:
                if not isinstance(b, dict):
                    continue
                if b.get("type") == "text":
                    s["reply_lens"].append(len(b.get("text", "")))
                if b.get("type") != "tool_use":
                    continue
                name = b.get("name", "?")
                s["tools"] += 1
                s["tool_names"][name] += 1
                if name in EDIT_TOOLS:
                    s["edits"] += 1
                if name in SEEK_TOOLS:
                    s["seek"] += 1
                if name.startswith("mcp__"):
                    s["mcp"] += 1
                if name == "Bash":
                    cmd = b.get("input", {}).get("command", "") or ""
                    # --amend 는 새 커밋이 아니라 직전 커밋 고치기다
                    if COMMIT.search(cmd) and "--amend" not in cmd:
                        s["commits"] += 1
                    if UNDO.search(cmd):
                        s["undo"] += 1
                    if TEST.search(cmd):
                        s["tests"] += 1
                    if WORKTREE.search(cmd):
                        s["worktree"] += 1

        elif kind == "user" and not side and is_human(o):
            s["turns"] += 1
            text = human_text(o).strip()
            if s["turns"] == 1:
                s["first_text"], s["first_len"] = text[:400], len(text)
            if THINK.search(text):
                s["think"] = True
            if text and len(text) < 400 and FRUSTR.search(text):
                s["corrections"] += 1
            if prev_human is not None:
                gap = (dt - prev_human).total_seconds()
                if 0 < gap < GAP:
                    s["gaps"].append(gap)
            prev_human = dt
    return s


# ── 출력 ─────────────────────────────────────────────────────────────
def band(turns):
    for lo, hi, label in BANDS:
        if lo <= turns <= hi:
            return label
    return BANDS[-1][2]


def rate(group, field):
    turns = sum(s["turns"] for s in group)
    return sum(s[field] for s in group) / turns if turns else 0.0


def by_band(sessions, keyfn, order, title, note=None):
    """길이 밴드 안에서만 커밋/턴을 비교한다. 밴드를 가로질러 읽지 마라."""
    print(f"\n=== {title} ===")
    if note:
        print(f"  {note}")
    for lo, hi, label in BANDS:
        pool = [s for s in sessions if lo <= s["turns"] <= hi]
        if len(pool) < MIN_GROUP * 2:
            continue
        groups = defaultdict(list)
        for s in pool:
            k = keyfn(s)
            if k is not None:
                groups[k].append(s)
        cells = []
        for k in order:
            g = groups.get(k, [])
            cells.append(f"{k} {rate(g, 'commits'):.3f} (n={len(g)})" if len(g) >= MIN_GROUP
                         else f"{k} 표본부족 (n={len(g)})")
        print(f"  [{label:>7}] " + " | ".join(cells))


def overall(sessions, label="전체"):
    turns = sum(s["turns"] for s in sessions)
    print(f"{label}: 세션 {len(sessions):,} · 사람 턴 {turns:,} · "
          f"커밋/턴 {rate(sessions,'commits'):.3f} · 되돌림/턴 {rate(sessions,'undo'):.4f} · "
          f"읽기/턴 {rate(sessions,'seek'):.2f} · 서브에이전트/턴 {rate(sessions,'sub'):.2f}")


# ── 분석들 ───────────────────────────────────────────────────────────
def a_shape(S):
    print("\n=== 세션 모양 — 길이대별 (밴드 간 비교이므로 참고용) ===")
    print(f"  {'구간':>8} {'세션':>5} {'커밋/턴':>8} {'커밋있는%':>9} {'서브/턴':>8} {'읽기/턴':>8} {'첫마디중앙':>10}")
    for lo, hi, label in BANDS:
        g = [s for s in S if lo <= s["turns"] <= hi]
        if len(g) < MIN_GROUP:
            continue
        with_commit = sum(1 for s in g if s["commits"] > 0) / len(g) * 100
        print(f"  {label:>8} {len(g):>5} {rate(g,'commits'):>8.3f} {with_commit:>8.0f}% "
              f"{rate(g,'sub'):>8.2f} {rate(g,'seek'):>8.2f} "
              f"{statistics.median(s['first_len'] for s in g):>10.0f}")

    def first_kind(s):
        t = s["first_text"]
        if "<command-name>" in t or t.startswith("/"):
            return "슬래시"
        if "[Image #" in t:
            return "이미지"
        if "Attached" in t or "```" in t or ("\n" in t and len(t) > 200):
            return "붙여넣기"
        return "맨손 짧게" if s["first_len"] < 80 else "맨손 길게"
    by_band(S, first_kind, ["맨손 짧게", "맨손 길게", "이미지", "붙여넣기", "슬래시"],
            "첫 마디 성격 → 커밋/턴",
            "짧게 던지고 대화로 좁히는 쪽이 길게 써서 시작하는 쪽보다 낫다.")


def a_rhythm(S):
    pool = [s for s in S if len(s["gaps"]) >= 3]

    def key(s):
        m = statistics.median(s["gaps"])
        return "<3분" if m < 180 else "3-10분" if m < 600 else "10분+"
    by_band(pool, key, ["<3분", "3-10분", "10분+"], "대화 리듬(사람 턴 간격 중앙값) → 커밋/턴",
            "연타는 에이전트가 끝내기 전에 말을 얹는 것, 10분+ 는 그사이 엉뚱한 데를 뒤진다.")
    print("\n  리듬별 읽기/턴 (헤맨 양):")
    groups = defaultdict(list)
    for s in pool:
        groups[key(s)].append(s)
    for k in ["<3분", "3-10분", "10분+"]:
        g = groups.get(k, [])
        if len(g) >= MIN_GROUP:
            print(f"    {k:>7} {rate(g,'seek'):.2f}  (n={len(g)})")


def a_undo(S):
    by_band(S, lambda s: "되돌림" if s["undo"] > 0 else "없음", ["되돌림", "없음"],
            "git 되돌림(reset/revert/stash) → 커밋/턴",
            "되돌릴 게 있다는 건 되돌릴 만큼 들어갔다는 뜻이다.")
    u = [s for s in S if s["undo"] > 0]
    commits = sum(s["commits"] for s in S)
    if u and commits:
        landed = sum(1 for s in u if s["commits"] > 0)
        print(f"\n  되돌린 세션 {len(u)}개 중 커밋까지 간 것 {landed}개 ({landed/len(u)*100:.0f}%)")
        print(f"  되돌림 {sum(s['undo'] for s in S)}회 / 커밋 {commits}회 = {sum(s['undo'] for s in S)/commits*100:.1f}%")
        print(f"  읽기/턴: 되돌린 {rate(u,'seek'):.2f} vs 안 되돌린 {rate([s for s in S if s['undo']==0],'seek'):.2f}")


def a_verbosity(S):
    pool = [s for s in S if s["reply_lens"]]
    by_band(pool, lambda s: "<200자" if statistics.median(s["reply_lens"]) < 200 else "200자+",
            ["<200자", "200자+"], "에이전트 답변 길이(중앙값) → 커밋/턴",
            "설명이 길어진다 = 뭘 할지 모른다. 개입 신호로 읽어라.")
    long_ones = [s for s in pool if statistics.median(s["reply_lens"]) >= 1500]
    if long_ones:
        print(f"\n  답변 중앙값 1,500자 이상 세션 {len(long_ones)}개 · 그중 커밋 있는 것 "
              f"{sum(1 for s in long_ones if s['commits']>0)}개")


def a_context(S):
    def key(s):
        r = s["seek"] / s["turns"]
        return "0" if r == 0 else "0-0.5" if r < 0.5 else "0.5-1.5" if r < 1.5 else "1.5+"
    by_band(S, key, ["0", "0-0.5", "0.5-1.5", "1.5+"], "읽기/턴(맥락 찾아 헤맨 양) → 커밋/턴",
            "0-0.5 이 최적인 건 긴 밴드(16턴+)에서만 뚜렷하다. 짧은 세션에서는 뒤집힌다 —\n"
            "  커밋/세션으로 재면 전 구간 역U자로 보이지만 커밋/턴으로는 그만큼 안 나온다.")
    edited = [s for s in S if s["edits"] > 0]
    if edited:
        landed = [s for s in edited if s["commits"] > 0]
        stuck = [s for s in edited if s["commits"] == 0]
        print(f"\n  파일을 고친 세션만:")
        print(f"    커밋까지 감 {len(landed):>4}개 · 읽기/턴 {rate(landed,'seek'):.2f} · 수정/턴 {rate(landed,'edits'):.2f}")
        print(f"    커밋 없음   {len(stuck):>4}개 · 읽기/턴 {rate(stuck,'seek'):.2f} · 수정/턴 {rate(stuck,'edits'):.2f}")
    m = [s for s in S if s["mcp"] > 0]
    if len(m) >= MIN_GROUP:
        n = [s for s in S if s["mcp"] == 0]
        print(f"\n  MCP(외부 맥락) 쓴 세션 {len(m)}개: 커밋/턴 {rate(m,'commits'):.3f} · 읽기/턴 {rate(m,'seek'):.2f}")
        print(f"  안 쓴 세션    {len(n)}개: 커밋/턴 {rate(n,'commits'):.3f} · 읽기/턴 {rate(n,'seek'):.2f}")
        print("  (n 이 작고 자기선택 편향이 있다 — MCP 를 부르는 작업이 원래 큰 작업일 수 있다)")


def a_practices(S):
    print("\n=== 알려진 프랙티스를 실제로 쓰고 있나 ===")
    base = rate(S, "commits")
    checks = [
        ("테스트 실행", lambda s: s["tests"] > 0),
        ("worktree", lambda s: s["worktree"] > 0),
        ("서브에이전트", lambda s: s["sub"] > 0),
        ("첫마디 이미지", lambda s: "[Image #" in s["first_text"]),
        ("think 트리거", lambda s: s["think"]),
        ("Plan mode", lambda s: s["plan_mode"]),
    ]
    print(f"  {'프랙티스':>14} {'세션':>5} {'비율':>6} {'커밋/턴':>8} {'기준선대비':>10}")
    for label, fn in checks:
        g = [s for s in S if fn(s)]
        if not g:
            print(f"  {label:>14} {0:>5} {'0%':>6} {'—':>8} {'안 씀':>10}")
            continue
        r = rate(g, "commits")
        delta = (r / base - 1) * 100 if base else 0
        print(f"  {label:>14} {len(g):>5} {len(g)/len(S)*100:>5.0f}% {r:>8.3f} {delta:>+9.0f}%")
    print(f"\n  기준선 커밋/턴 {base:.3f}")
    print("  ※ 인과가 아니다. 큰 작업일수록 테스트도 하고 되돌리기도 한다 —")
    print("     세션 길이는 통제했지만 작업 성격까지 맞추지는 못했다.")


def a_parallel(S):
    """동시에 몇 개를 굴렸나. 세션 구간 [start, end] 이 겹치면 병렬로 본다.

    한 파일 안의 세션들은 GAP 으로 갈린 것이라 절대 안 겹친다. 즉 겹침은
    거의 전부 '다른 프로젝트를 동시에' 다.
    """
    print("\n=== 병렬 작업 ===")
    live = [s for s in S if (s["end"] - s["start"]).total_seconds() > 0]
    if len(live) < MIN_GROUP:
        print("  표본 부족")
        return

    # 구간 스윕으로 동시 활성 수를 시간 가중해서 잰다
    marks = []
    for s in live:
        marks.append((s["start"], 1))
        marks.append((s["end"], -1))
    marks.sort()
    active, prev, peak = 0, None, 0
    time_at = defaultdict(float)     # 동시 세션 수 -> 그 상태로 흐른 초
    for t, delta in marks:
        if prev is not None and active > 0:
            time_at[active] += (t - prev).total_seconds()
        active += delta
        peak = max(peak, active)
        prev = t
    total = sum(time_at.values())
    solo = time_at.get(1, 0.0)
    print(f"  활성 시간 {total/3600:,.0f}시간 · 최대 동시 {peak}개")
    print(f"  단독 {solo/total*100:.0f}% · 2개 이상 겹친 시간 {(total-solo)/total*100:.0f}%")
    for n in sorted(time_at):
        if time_at[n] / total >= 0.01:
            print(f"    동시 {n}개: {time_at[n]/3600:>6,.0f}시간 ({time_at[n]/total*100:>4.0f}%)")

    # 세션마다 '겹쳤던 상대 수' 를 붙이고 결과를 비교한다
    for s in live:
        s["_overlap"] = sum(1 for o in live
                            if o is not s and o["start"] < s["end"] and s["start"] < o["end"])
    def key(s):
        n = s.get("_overlap", 0)
        return "단독" if n == 0 else "1개와 겹침" if n == 1 else "2개+ 와 겹침"
    by_band(live, key, ["단독", "1개와 겹침", "2개+ 와 겹침"], "겹친 세션 수 → 커밋/턴",
            "병렬로 굴릴수록 결과가 나은지, 주의가 갈려서 나쁜지.")

    groups = defaultdict(list)
    for s in live:
        groups[key(s)].append(s)
    print("\n  겹침별 다른 지표:")
    print(f"    {'':>12} {'세션':>5} {'읽기/턴':>8} {'서브/턴':>8} {'되돌림/턴':>9} {'정정/턴':>8}")
    for k in ["단독", "1개와 겹침", "2개+ 와 겹침"]:
        g = groups.get(k, [])
        if len(g) < MIN_GROUP:
            continue
        print(f"    {k:>12} {len(g):>5} {rate(g,'seek'):>8.2f} {rate(g,'sub'):>8.2f} "
              f"{rate(g,'undo'):>9.4f} {rate(g,'corrections'):>8.3f}")

    # 하루에 몇 개 프로젝트를 건드렸나
    by_day = defaultdict(set)
    for s in S:
        by_day[s["start"].strftime("%Y-%m-%d")].add(s["project"])
    counts = sorted(len(v) for v in by_day.values())
    print(f"\n  하루에 건드린 프로젝트 수: 중앙 {statistics.median(counts):.0f}개 · "
          f"최대 {counts[-1]}개 · 활동일 {len(counts)}일")

    _hourly_grid(live)


def hourly_concurrency(sessions):
    """(날짜, 시) -> 그 한 시간 안의 **순간 최대** 동시 세션 수.

    시간 칸에 '걸친' 세션을 그냥 세면 안 된다 — 앞뒤로 스쳐 지나간 것까지
    더해져 실제 동시성보다 두 배쯤 부풀려진다. 칸마다 따로 스윕해서 잰다.
    """
    buckets = defaultdict(list)          # (날짜,시) -> [(시각, ±1), ...]
    for s in sessions:
        h = s["start"].replace(minute=0, second=0, microsecond=0)
        while h <= s["end"]:
            nxt = h + timedelta(hours=1)
            key = (h.strftime("%Y-%m-%d"), h.hour)
            buckets[key].append((max(s["start"], h), 1))
            buckets[key].append((min(s["end"], nxt), -1))
            h = nxt
    grid = {}
    for key, marks in buckets.items():
        marks.sort()
        active = peak = 0
        for _, delta in marks:
            active += delta
            peak = max(peak, active)
        grid[key] = peak
    return grid


def _hourly_grid(sessions):
    """날짜×시간 히트맵. 한 칸 = 그 시간에 겹쳐 있던 세션 수."""
    grid = hourly_concurrency(sessions)
    if not grid:
        return
    days = sorted({d for d, _ in grid})
    peak = max(grid.values())
    # 0 / 1 / 2 / 3-4 / 5-6 / 7+ 여섯 단계
    def cell(n):
        if n == 0: return "·"
        if n == 1: return "░"
        if n == 2: return "▒"
        if n <= 4: return "▓"
        if n <= 6: return "█"
        return "▉"
    print(f"\n  시간별 동시 세션 (한 칸 = 1시간, 최대 {peak}개)")
    # 월말에 시작한 세션이 다음 달로 넘어가므로 날짜는 MM-DD 로 찍는다
    print("        " + "".join(str(h // 10) if h >= 10 else " " for h in range(24)))
    print("        " + "".join(str(h % 10) for h in range(24)))
    for d in days:
        row = "".join(cell(grid.get((d, h), 0)) for h in range(24))
        tot = sum(grid.get((d, h), 0) for h in range(24))
        mx = max((grid.get((d, h), 0) for h in range(24)), default=0)
        print(f"  {d[5:]} {row}  최대{mx:>3} 합{tot:>4}")
    print("     · 없음  ░1  ▒2  ▓3-4  █5-6  ▉7+")

    # 시간대별 집계
    by_hour = defaultdict(list)
    for (d, h), n in grid.items():
        by_hour[h].append(n)
    print("\n  시간대별 평균 동시 세션")
    for h in range(24):
        vals = by_hour.get(h, [])
        if not vals:
            continue
        avg = sum(vals) / len(days)      # 활동일 전체로 나눈다(빈 날 포함)
        bar = "█" * int(round(avg * 4))
        print(f"    {h:>2}시 {avg:>4.1f} {bar}")


ANALYSES = {
    "shape": a_shape, "rhythm": a_rhythm, "undo": a_undo,
    "verbosity": a_verbosity, "context": a_context,
    "parallel": a_parallel, "practices": a_practices,
}


def main():
    ap = argparse.ArgumentParser(description="Claude Code 로그 세션 패턴 분석")
    ap.add_argument("analyses", nargs="*", default=[], help=f"{' '.join(ANALYSES)} (기본: 전부)")
    ap.add_argument("--month", default=None, help="YYYY-MM (기본: 지난달)")
    ap.add_argument("--base", default=os.path.expanduser("~/.claude/projects"))
    args = ap.parse_args()

    month = args.month
    if not month:
        today = datetime.now(LOCAL).replace(day=1)
        month = (today - timedelta(days=1)).strftime("%Y-%m")

    picked = args.analyses or list(ANALYSES)
    unknown = [a for a in picked if a not in ANALYSES]
    if unknown:
        sys.exit(f"모르는 분석: {', '.join(unknown)} (가능: {', '.join(ANALYSES)})")

    if not os.path.isdir(args.base):
        sys.exit(f"로그 디렉터리가 없어요: {args.base}")

    sessions = load_sessions(args.base, month)
    if not sessions:
        sys.exit(f"{month} 에 시작한 세션이 없어요.")

    print(f"{month} · 결과 지표는 커밋/턴. 비교는 세션 길이 밴드 안에서만.")
    overall(sessions)
    for name in picked:
        ANALYSES[name](sessions)


if __name__ == "__main__":
    main()
