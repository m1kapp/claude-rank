#!/usr/bin/env python3
"""Run the shared collectors on Windows without Bash, WSL, or curl."""
import getpass
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import uuid
import webbrowser

from identity import create_once, identity_path

DIR = Path(__file__).resolve().parent
HOME_DIR = Path.home()
OUT = Path(os.environ.get("USAGE_REPORT_OUT") or HOME_DIR / "claude-usage-report.html")
JSON_OUT = Path(str(OUT)[:-5] + ".json" if str(OUT).endswith(".html") else str(OUT) + ".json")


def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}


def read_text(path):
    try:
        return path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return ""


def collect():
    account = read_json(HOME_DIR / ".claude.json").get("oauthAccount") or {}
    tier = (account.get("organizationRateLimitTier") or account.get("userRateLimitTier") or "").lower()
    plan = 200 if "20x" in tier else 100 if "5x" in tier else 20 if "pro" in tier else int(
        read_text(HOME_DIR / ".usage-report-plan") or "200")
    raw_id = account.get("accountUuid")
    device_path = HOME_DIR / ".usage-report-device"
    # Exclusive creation preserves the device slot across repeated/concurrent runs.
    try:
        with device_path.open("x", encoding="utf-8") as f:
            f.write(uuid.uuid4().hex)
    except FileExistsError:
        pass
    env = {**os.environ,
           "USAGE_REPORT_ID": "claude_" + hashlib.sha256(raw_id.encode()).hexdigest()[:32] if raw_id else "",
           "USAGE_REPORT_PLAN_TIER": tier,
           "USAGE_REPORT_DEVICE": "dev_" + read_text(device_path)}
    settings_path = HOME_DIR / ".claude" / "settings.json"
    if settings_path.exists():
        settings = read_json(settings_path)
        if settings.get("cleanupPeriodDays") != 365:
            settings["cleanupPeriodDays"] = 365
            settings_path.write_text(json.dumps(settings, ensure_ascii=False, indent=2), encoding="utf-8")

    # Each run gets its own temp directory; build.py reads the same sidecar files.
    with tempfile.TemporaryDirectory(prefix="runmaxing-") as tmp:
        tmp = Path(tmp)
        env["USAGE_REPORT_TMP"] = str(tmp)
        npx = shutil.which("npx")
        if not npx:
            raise RuntimeError("npx를 찾을 수 없습니다. Node.js 설치와 PATH를 확인해 주세요.")
        print("ccusage 집계 중...", flush=True)
        with (tmp / "ccusage.json").open("w", encoding="utf-8") as f:
            subprocess.run([npx, "--yes", "ccusage@latest", "--json"], stdout=f, env=env, check=True)
        print("세션 활동 분석 중...", flush=True)
        for name in ("sess", "codex"):
            with (tmp / f"{name}.json").open("w", encoding="utf-8") as f:
                subprocess.run([sys.executable, "-X", "utf8", str(DIR / f"{name}.py")],
                               stdout=f, env=env, check=True)
        rtk = shutil.which("rtk")
        if rtk:
            with (tmp / "rtk.json").open("w", encoding="utf-8") as f:
                subprocess.run([rtk, "gain", "-f", "json", "-m"], stdout=f, env=env, check=False)
        OUT.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([sys.executable, "-X", "utf8", str(DIR / "build.py"),
                        str(tmp / "ccusage.json"), str(OUT), str(plan),
                        env.get("USAGE_REPORT_KRW", "1500"), str(tmp / "rtk.json"), str(tmp / "sess.json")],
                       env=env, check=True)
    print(f"리포트 데이터 생성 완료: {OUT}")


def submit(nick):
    report = read_json(JSON_OUT)
    if not report.get("id", "").startswith("claude_"):
        raise RuntimeError("Claude 계정 세션이 필요합니다. Windows의 Claude Code에 로그인 후 다시 실행하세요.")
    nick_path = HOME_DIR / ".usage-report-nick"
    if nick:
        nick_path.write_text(nick, encoding="utf-8")
    else:
        nick = read_text(nick_path)
        if not nick:
            account = read_json(HOME_DIR / ".claude.json").get("oauthAccount") or {}
            email = account.get("emailAddress") or ""
            nick = email.split("@")[0] if "@" in email else ""
        if not nick and shutil.which("git"):
            result = subprocess.run(["git", "config", "user.name"], capture_output=True, text=True, encoding="utf-8")
            nick = result.stdout.strip()
        nick = nick or getpass.getuser()
    identity = create_once(identity_path())
    endpoint = os.environ.get("USAGE_REPORT_ENDPOINT", "https://runmaxing.m1k.app").rstrip("/")
    if urllib.parse.urlparse(endpoint).scheme not in {"http", "https"}:
        raise RuntimeError("엔드포인트는 http 또는 https URL이어야 합니다.")
    payload = {"nick": nick, "report": report,
               "runner": {"id": identity["runner_id"], "token": identity["device_token"]}}
    request = urllib.request.Request(endpoint + "/api/submit", data=json.dumps(payload).encode("utf-8"),
                                     headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.load(response)
    except urllib.error.HTTPError as exc:
        try:
            message = json.load(exc).get("error")
        except (ValueError, AttributeError):
            message = None
        raise RuntimeError(message or f"제출 실패 (HTTP {exc.code})") from None
    if not data.get("ok"):
        raise RuntimeError(data.get("error") or "제출 실패")
    profile = data.get("profile_id") or data.get("entry", {}).get("id")
    print("✅ 갱신 완료!")
    if profile:
        url = endpoint + "/u/" + urllib.parse.quote(profile, safe="")
        print(f"🔗 내 runmaxing 프로필: {url}")
        if not os.environ.get("USAGE_REPORT_NO_OPEN"):
            webbrowser.open(url)


if __name__ == "__main__":
    try:
        if sys.argv[1] == "run.sh":
            collect()
        elif sys.argv[1] == "submit.sh":
            submit(sys.argv[2] if len(sys.argv) > 2 else "")
        else:
            raise RuntimeError("지원하지 않는 실행 명령")
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as exc:
        print(f"runmaxing: {exc}", file=sys.stderr)
        sys.exit(exc.returncode if isinstance(exc, subprocess.CalledProcessError) and exc.returncode > 0 else 1)
