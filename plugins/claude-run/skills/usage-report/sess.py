#!/usr/bin/env python3
"""트랜스크립트에서 월별 '작업 세션' 활동 통계 추출 -> JSON stdout.
사용: python sess.py [projects_dir]  (기본 ~/.claude/projects)
- 사람 발화(tool_result 제외)만 '대화'로 카운트.
- 세션은 시간 공백(GAP)으로 분할: --continue로 며칠간 이어쓴 한 파일도
  실제 '한 번 앉아서 한 작업'들로 쪼갬. (파일=세션 착시 방지)"""
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
eff = defaultdict(lambda: {"cr":0,"cw":0,"inp":0,"tcall":0,"terr":0,"corr":0,"human":0})
hourly = defaultdict(lambda: defaultdict(int))    # "YYYY-MM" -> {hour: 채팅수}
git = defaultdict(lambda: {"commit":0,"push":0})  # "YYYY-MM" -> 카운트
gitdaily = defaultdict(lambda: defaultdict(int))  # "YYYY-MM" -> {"YYYY-MM-DD": 커밋수}

# 파일별로 (시각, 사람발화여부) 모은 뒤 시간 공백으로 작업 세션 분할
mon = defaultdict(list)                       # "YYYY-MM" -> [세션별 채팅수, ...]
daily = defaultdict(lambda: defaultdict(int)) # "YYYY-MM" -> {"YYYY-MM-DD": 채팅수}
for f in glob.glob(os.path.join(base, "*", "*.jsonl")):
    evs = []
    try:
        for line in open(f):
            o = json.loads(line)
            t = o.get("type")
            ts = o.get("timestamp")
            try: dt = datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(LOCAL) if ts else None
            except Exception: dt = None
            mk = dt.strftime("%Y-%m") if dt else None
            if t == "assistant" and mk:
                u = o.get("message", {}).get("usage", {})
                e = eff[mk]
                e["cr"] += u.get("cache_read_input_tokens", 0)
                e["cw"] += u.get("cache_creation_input_tokens", 0)
                e["inp"] += u.get("input_tokens", 0)
                for b in o.get("message", {}).get("content", []) or []:
                    if isinstance(b, dict) and b.get("type") == "tool_use":
                        e["tcall"] += 1
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
    cur, last = [], None
    for dt, h in evs:
        if last and (dt - last).total_seconds() > GAP and cur:
            ht = sum(1 for d, hh in cur if hh)
            if ht > 0: mon[cur[0][0].strftime("%Y-%m")].append(ht)
            cur = []
        cur.append((dt, h)); last = dt
    if cur:
        ht = sum(1 for d, hh in cur if hh)
        if ht > 0: mon[cur[0][0].strftime("%Y-%m")].append(ht)

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
    out[m] = {
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
