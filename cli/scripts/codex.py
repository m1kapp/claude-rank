#!/usr/bin/env python3
"""Codex(ChatGPT) 사용량 + 요금제 → JSON stdout.

Plus($20)는 인증 정보로 확정한다. `pro` 인증 정보만으로는 Pro 5x($100)와
Pro 20x($200)를 구분할 수 없어 최초 한 번 사용자에게 묻고 로컬에 기억한다.
선택 이력은 append-only 파일에 남겨 기존 값을 조용히 덮어쓰지 않는다.
team/business처럼 단가가 고정되지 않는 요금제는 배율을 만들지 않는다.
"""
import json, os, base64, subprocess, sys, hashlib

# 월 단가(USD). None = 가격이 하나로 정해지지 않음 → 배율 계산 안 함.
PLAN_USD = {
    "free": 0,        # 분모 0 — 배율 불가
    "go": 8,
    "plus": 20,
    "pro": None,      # Pro 5x $100 / Pro 20x $200 — 아래에서 로컬 선택
    "team": None,     # 좌석당 $20(연납)~$30(월납)
    "business": None,
    "enterprise": None,
}
PRO_PLANS = {100, 200}
PRO_PLAN_FILE = os.path.expanduser("~/.runmaxing/codex-plan")


def _valid_pro_plan(value):
    try:
        plan = int(str(value).strip())
        return plan if plan in PRO_PLANS else None
    except Exception:
        return None


def saved_pro_plan(path=PRO_PLAN_FILE):
    """append-only 선택 이력의 마지막 유효값. 옛 값은 파일 안에 그대로 남는다."""
    try:
        values = [_valid_pro_plan(line) for line in open(path, encoding="utf-8")]
        return next((v for v in reversed(values) if v), None)
    except Exception:
        return None


def remember_pro_plan(plan, path=PRO_PLAN_FILE):
    """새 선택만 append. 같은 값은 다시 쓰지 않고 기존 파일은 truncate하지 않는다."""
    plan = _valid_pro_plan(plan)
    if not plan or saved_pro_plan(path) == plan:
        return plan
    try:
        parent = os.path.dirname(path)
        os.makedirs(parent, mode=0o700, exist_ok=True)
        with open(path, "a", encoding="utf-8") as f:
            f.write(f"{plan}\n")
        os.chmod(path, 0o600)
    except Exception:
        pass
    return plan


def prompt_pro_plan():
    """대화형 실행에서만 묻는다. cron/CI처럼 tty가 없으면 조용히 미확정으로 둔다."""
    try:
        with open("/dev/tty", "r+", encoding="utf-8", buffering=1) as tty:
            tty.write("\nCodex Pro 종목을 최초 한 번 선택해 주세요.\n")
            tty.write("  1) $100 · Pro 5x\n  2) $200 · Pro 20x\n선택 [1/2]: ")
            answer = tty.readline().strip().lower()
            return 100 if answer in {"1", "100", "5x"} else 200 if answer in {"2", "200", "20x"} else None
    except Exception:
        return None


def resolved_plan_usd(plan_name):
    if plan_name != "pro":
        return PLAN_USD.get(plan_name, None)
    explicit = _valid_pro_plan(os.environ.get("RUNMAXING_CODEX_PLAN", ""))
    if explicit:
        return remember_pro_plan(explicit)
    saved = saved_pro_plan()
    if saved:
        return saved
    selected = prompt_pro_plan()
    return remember_pro_plan(selected) if selected else None


def plan_type():
    """~/.codex/auth.json 의 id_token 클레임에서 요금제를 읽는다(값은 서명된 토큰 안)."""
    try:
        d = json.load(open(os.path.expanduser("~/.codex/auth.json")))
        tok = (d.get("tokens") or {}).get("id_token") or ""
        pl = json.loads(base64.urlsafe_b64decode(tok.split(".")[1] + "=="))
        # 클레임은 네임스페이스 객체 안에 중첩돼 있다:
        #   {"https://api.openai.com/auth": {"chatgpt_plan_type": "team", ...}}
        stack = [pl]
        while stack:
            o = stack.pop()
            if not isinstance(o, dict):
                continue
            for k, v in o.items():
                if k.endswith("chatgpt_plan_type") and isinstance(v, str):
                    return v.lower()
                if isinstance(v, dict):
                    stack.append(v)
    except Exception:
        pass
    return ""


def account_id():
    """Codex account UUID 를 provider-scoped 해시로 만든다. 원문은 리포트에 싣지 않는다."""
    try:
        d = json.load(open(os.path.expanduser("~/.codex/auth.json")))
        raw = (d.get("tokens") or {}).get("account_id") or ""
        if raw:
            return "codex_" + hashlib.sha256(raw.encode()).hexdigest()[:32]
    except Exception:
        pass
    return ""


def monthly():
    """ccusage codex daily --json → {YYYY-MM: {cost_usd, tokens}}.
    Codex 쪽 스키마는 Claude 쪽과 다르다(date/costUSD/models)."""
    try:
        out = subprocess.run(["npx", "ccusage@latest", "codex", "daily", "--json"],
                             capture_output=True, text=True, timeout=180)
        d = json.loads(out.stdout)
    except Exception:
        return {}
    acc = {}
    for r in d.get("daily", []):
        ds = r.get("date") or ""
        if len(ds) < 7:
            continue
        a = acc.setdefault(ds[:7], {"cost_usd": 0.0, "tokens": 0, "days": 0})
        a["cost_usd"] += r.get("costUSD", 0) or 0
        a["tokens"] += r.get("totalTokens", 0) or 0
        a["days"] += 1
    for a in acc.values():
        a["cost_usd"] = round(a["cost_usd"], 2)
    return acc


def main():
    months = monthly()
    if not months:
        return                      # Codex 를 안 쓰면 필드 자체를 만들지 않는다
    pt = plan_type()
    usd = resolved_plan_usd(pt)
    aid = account_id()
    out = {"plan_type": pt or None, "plan_usd": usd, "months": {}}
    if aid:
        out["account_id"] = aid
    for mk, a in sorted(months.items()):
        row = {"cost_usd": a["cost_usd"], "tokens": a["tokens"], "active_days": a["days"]}
        # 배율은 가격이 확정되고 0 이 아닐 때만.
        if usd:
            row["ratio"] = round(a["cost_usd"] / usd, 1)
        out["months"][mk] = row
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
