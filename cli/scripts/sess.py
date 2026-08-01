#!/usr/bin/env python3
"""트랜스크립트에서 월별 '작업 세션' 활동 통계 추출 -> JSON stdout.
사용: python sess.py [projects_dir]  (기본 ~/.claude/projects)
- 사람 발화(tool_result 제외)만 '대화'로 카운트.
- 세션은 시간 공백(GAP)으로 분할: --continue로 며칠간 이어쓴 한 파일도
  실제 '한 번 앉아서 한 작업'들로 쪼갬. (파일=세션 착시 방지)
- 서브에이전트(isSidechain) 기록도 읽되 '채팅/세션'에는 안 넣는다.
  그 user 레코드는 사람이 아니라 부모 에이전트가 던진 프롬프트다.
  대신 토큰·도구호출·도구에러·커밋은 실제로 쓴 양이므로 합산한다
  (비용은 ccusage가 서브에이전트까지 세므로 그래야 분모가 맞는다)."""
import json, glob, os, sys, statistics, re
from datetime import datetime, timezone, timedelta
from collections import defaultdict

base = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/.claude/projects")
GAP = 3600  # 초. 이 이상 공백이면 새 작업 세션으로 간주(기본 1시간)
# 로컬 시간대(기본 KST +9). 환경변수 USAGE_REPORT_TZ로 오프셋(시간) 변경 가능.
try: _TZH = float(os.environ.get("USAGE_REPORT_TZ", "9"))
except Exception: _TZH = 9.0
LOCAL = timezone(timedelta(hours=_TZH))
FRUSTR = re.compile(r"(아니|틀렸|다시|왜 안|안돼|안 돼|not work|wrong|undo|되돌|그게 아니|잘못)", re.I)
COMMIT_RE = re.compile(r"\bgit\s+commit\b")
PUSH_RE = re.compile(r"\bgit\s+push\b")

def is_human(o):
    c = o.get("message", {}).get("content")
    if isinstance(c, str): return c.strip() != ""
    if isinstance(c, list):
        has_text = any(isinstance(b, dict) and b.get("type") == "text"
                       and b.get("text", "").strip() for b in c)
        only_tr = bool(c) and all(isinstance(b, dict) and b.get("type") == "tool_result" for b in c)
        return has_text and not only_tr
    return False

def human_text(o):
    c = o.get("message", {}).get("content")
    if isinstance(c, str): return c
    if isinstance(c, list):
        return " ".join(b.get("text","") for b in c if isinstance(b, dict) and b.get("type")=="text")
    return ""

# 월별 효율/마찰 + 시간대 + git 누적기
eff = defaultdict(lambda: {"cr":0,"cw":0,"inp":0,"tcall":0,"terr":0,"corr":0,"human":0,"sub":0})
hourly = defaultdict(lambda: defaultdict(int))    # "YYYY-MM" -> {hour: 채팅수}
git = defaultdict(lambda: {"commit":0,"push":0})  # "YYYY-MM" -> 카운트
gitdaily = defaultdict(lambda: defaultdict(int))  # "YYYY-MM" -> {"YYYY-MM-DD": 커밋수}

# 파일별로 (시각, 사람발화여부) 모은 뒤 시간 공백으로 작업 세션 분할
mon = defaultdict(list)                       # "YYYY-MM" -> [세션별 채팅수, ...]
daily = defaultdict(lambda: defaultdict(int)) # "YYYY-MM" -> {"YYYY-MM-DD": 채팅수}
# 세션이 '살아 있던' 구간 [시작, 끝]. 여러 개를 동시에 굴렸는지 재려면 이게 필요하다.
# 한 파일 안의 세션끼리는 GAP 으로 갈려 정의상 안 겹치므로, 겹침은 곧 다른 프로젝트다.
spans = defaultdict(list)                     # "YYYY-MM" -> [(시작, 끝), ...]
for f in glob.glob(os.path.join(base, "*", "**", "*.jsonl"), recursive=True):
    evs = []
    alltimes = []      # 사람 발화만이 아니라 모든 레코드 시각(에이전트가 도는 동안도 '살아 있음')
    try:
        for line in open(f):
            o = json.loads(line)
            t = o.get("type")
            side = bool(o.get("isSidechain"))
            ts = o.get("timestamp")
            try: dt = datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(LOCAL) if ts else None
            except Exception: dt = None
            mk = dt.strftime("%Y-%m") if dt else None
            if dt and not side: alltimes.append(dt)
            if t == "assistant" and mk:
                u = o.get("message", {}).get("usage", {})
                e = eff[mk]
                e["cr"] += u.get("cache_read_input_tokens", 0)
                e["cw"] += u.get("cache_creation_input_tokens", 0)
                e["inp"] += u.get("input_tokens", 0)
                for b in o.get("message", {}).get("content", []) or []:
                    if isinstance(b, dict) and b.get("type") == "tool_use":
                        e["tcall"] += 1
                        if side: e["sub"] += 1
                        if b.get("name") == "Bash":
                            cmd = b.get("input", {}).get("command", "") or ""
                            if COMMIT_RE.search(cmd) and "--amend" not in cmd:
                                git[mk]["commit"] += 1
                                gitdaily[mk][dt.strftime("%Y-%m-%d")] += 1
                            if PUSH_RE.search(cmd): git[mk]["push"] += 1
            elif t == "user":
                if dt is None: continue
                # tool_result 에러
                c = o.get("message", {}).get("content")
                if isinstance(c, list) and mk:
                    for b in c:
                        if isinstance(b, dict) and b.get("type")=="tool_result" and b.get("is_error"):
                            eff[mk]["terr"] += 1
                # 서브에이전트의 user 레코드 = 부모가 던진 프롬프트. 사람 발화도 세션도 아니다.
                if side: continue
                h = is_human(o)
                evs.append((dt, h))
                if h:
                    ds = dt.strftime("%Y-%m-%d")
                    daily[ds[:7]][ds] += 1
                    hourly[ds[:7]][dt.hour] += 1
                    e = eff[ds[:7]]; e["human"] += 1
                    txt = human_text(o).strip()
                    if txt and len(txt) < 400 and FRUSTR.search(txt): e["corr"] += 1
    except Exception:
        pass
    evs.sort()
    alltimes.sort()
    # 세션 분할 규칙은 그대로 둔다(사람 발화 기준). 여기서 추가하는 건 구간뿐이라
    # sessions/median/buckets 같은 기존 수치는 값이 안 바뀐다.
    chunks = []
    cur, last = [], None
    for dt, h in evs:
        if last and (dt - last).total_seconds() > GAP and cur:
            chunks.append(cur); cur = []
        cur.append((dt, h)); last = dt
    if cur: chunks.append(cur)
    for i, ch in enumerate(chunks):
        ht = sum(1 for d, hh in ch if hh)
        if ht <= 0: continue
        mon[ch[0][0].strftime("%Y-%m")].append(ht)
        # 끝은 마지막 사람 발화가 아니라 그 뒤로 이어진 에이전트 활동까지다.
        # 다음 세션이 시작되기 전까지, GAP 안쪽만 인정한다.
        u0, u1 = ch[0][0], ch[-1][0]
        nxt = chunks[i + 1][0][0] if i + 1 < len(chunks) else None
        end = u1
        for t2 in alltimes:
            if t2 < u1: continue
            if nxt is not None and t2 >= nxt: break
            if (t2 - end).total_seconds() > GAP: break
            end = t2
        spans[u0.strftime("%Y-%m")].append((u0, end))

def concurrency(month_spans):
    """동시에 굴린 세션 수 → 그 상태로 흐른 시간(시). 구간 스윕으로 잰다.

    '그 시간에 걸친 세션 수'를 세면 앞뒤로 스쳐 간 것까지 더해져 부풀려진다.
    분모는 하루 24시간이 아니라 '세션이 하나라도 살아 있던 시간'이다 — 24로
    나누면 자는 시간이 섞여 전부 1 아래로 눌린다.
    """
    marks = sorted([(a, 1) for a, _ in month_spans] + [(b, -1) for _, b in month_spans])
    hours, active, prev, peak = defaultdict(float), 0, None, 0
    for t, delta in marks:
        if prev is not None and active > 0:
            hours[active] += (t - prev).total_seconds() / 3600
        active += delta
        peak = max(peak, active)
        prev = t
    busy = sum(hours.values())
    if not busy: return {}, 0, 0, 0
    solo = hours.get(1, 0.0)
    mean = sum(k * v for k, v in hours.items()) / busy
    # 6개 이상은 꼬리가 길어 칸이 잘게 쪼개진다 — 하나로 묶는다
    dist = {}
    for k, v in hours.items():
        key = str(k) if k <= 5 else "6+"
        dist[key] = round(dist.get(key, 0) + v, 1)
    return dist, peak, round(100 - solo / busy * 100), round(mean, 1)


def bucketize(turns):  # 세션 크기 분포
    edges = [(1,5),(6,10),(11,20),(21,50),(51,10**9)]
    labels = ["1-5","6-10","11-20","21-50","50+"]
    b = {l:0 for l in labels}
    for n in turns:
        for (lo,hi),l in zip(edges,labels):
            if lo <= n <= hi: b[l]+=1; break
    return b

out = {}
for m, t in mon.items():
    dmap = dict(daily.get(m, {}))
    active = len(dmap)
    e = eff.get(m, {})
    tin = e.get("cr",0)+e.get("cw",0)+e.get("inp",0)
    conc, conc_peak, conc_par, conc_mean = concurrency(spans.get(m, []))
    out[m] = {
        "conc": conc,                 # {"1": 시간, ..., "6+": 시간}
        "conc_peak": conc_peak,       # 순간 최대 동시 세션 수
        "conc_parallel": conc_par,    # 2개 이상 겹친 시간 비율(%)
        "conc_mean": conc_mean,       # 시간 가중 평균 동시 세션 수
        "sessions": len(t),
        "chats": sum(t),
        "per_session": round(sum(t) / len(t), 1),
        "median": int(statistics.median(t)),
        "max": max(t),
        "buckets": bucketize(t),
        "active_days": active,
        "per_day": round(sum(dmap.values()) / active, 1) if active else 0,
        "day_max": max(dmap.values()) if dmap else 0,
        "daily": dmap,
        "hourly": {str(h): hourly.get(m, {}).get(h, 0) for h in range(24)},
        "eff": {
            "cache_hit": round(e.get("cr",0)/tin*100, 1) if tin else 0,
            "tool_calls": e.get("tcall",0),
            "subagent_calls": e.get("sub",0),
            "tool_err": round(e.get("terr",0)/e["tcall"]*100, 1) if e.get("tcall") else 0,
            "human": e.get("human",0),
            "correction": round(e.get("corr",0)/e["human"]*100, 1) if e.get("human") else 0,
        },
        "git": {
            "commit": git.get(m, {}).get("commit", 0),
            "push": git.get(m, {}).get("push", 0),
            "daily": dict(gitdaily.get(m, {})),
        },
    }
print(json.dumps(out, ensure_ascii=False))
