#!/usr/bin/env python3
"""Codex(ChatGPT) 사용량 + 요금제 → JSON stdout.

Claude 와 같은 원리로 "구독료 대비 배율"을 내려는 것이지만, Codex 는 요금제와
가격이 1:1 이 아니다. Claude 는 20x→$200 처럼 티어가 곧 가격인데, ChatGPT 는
`pro` 하나가 Pro Codex($100) 와 Pro Max($200) 둘 다이고 team/business 는
좌석수·연납 여부로 달라진다. 그래서 **가격이 확정되는 요금제에서만 배율을 내고**,
나머지는 비용만 싣는다 — 모르는 분모를 추측해 배율을 지어내지 않는다.
"""
import json, os, base64, subprocess, sys, hashlib

# 월 단가(USD). None = 가격이 하나로 정해지지 않음 → 배율 계산 안 함.
PLAN_USD = {
    "free": 0,        # 분모 0 — 배율 불가
    "go": 8,
    "plus": 20,
    "pro": None,      # Pro Codex $100 / Pro Max $200 — 구분 불가
    "team": None,     # 좌석당 $20(연납)~$30(월납)
    "business": None,
    "enterprise": None,
}


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
    usd = PLAN_USD.get(pt, None)
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
