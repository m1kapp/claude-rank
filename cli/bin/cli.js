#!/usr/bin/env node
// runmaxing collector — 플러그인 설치 없이 한 줄로 에이전트 리그 갱신.
//
// 플러그인(/claude-run)은 슬래시 명령과 하루 1회 자동 갱신을 얹어주는 편의 래퍼이고,
// 제출 자체에는 필요하지 않다. 마켓플레이스 등록 → 설치 → 리로드 3단계가 첫 유입의
// 가장 큰 마찰이라, 같은 스크립트를 npx 로도 돌 수 있게 한다.
"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { resolveWslDistro, runWsl } = require("./wsl");
const { nativeRunner } = require("./native");

const SCRIPTS = path.join(__dirname, "..", "scripts");
const args = process.argv.slice(2);
const isWindows = process.platform === "win32";

if (args.includes("-h") || args.includes("--help")) {
  console.log(`runmaxing — one runner, two agent lanes

  npx @m1kapp/runmaxing              내 사용량 집계 후 랭킹 갱신 (닉네임 자동)
  npx @m1kapp/runmaxing <닉네임>     닉네임을 지정해서 갱신 (다음부터 생략 가능)
  npx @m1kapp/runmaxing --codex-plan 200  Codex Pro 종목 지정 ($100 또는 $200)
  npx @m1kapp/runmaxing --wsl-distro Ubuntu  Windows WSL 배포판 직접 지정
  npx @m1kapp/runmaxing --no-open    브라우저를 열지 않음
  npx @m1kapp/runmaxing --report     리포트만 만들고 제출하지 않음

요금제·닉네임은 자동 판별됩니다. 첫 제출에서 로컬 runner 신분증을 한 번 만들고
Claude와 Codex를 따로 인식해 연결합니다. 기존 신분증은 덮어쓰지 않습니다.
필요 조건: Node.js와 Python 3.9 이상. macOS·Linux는 bash, curl도 필요합니다.
Windows PowerShell에서 바로 실행됩니다. WSL은 필수가 아닙니다.

슬래시 명령과 하루 1회 자동 갱신을 원하면 플러그인도 있다:
  /plugin marketplace add m1kapp/runmaxing
  /plugin install claude-run@claude-rank
`);
  process.exit(0);
}

if (!fs.existsSync(path.join(SCRIPTS, "run.sh"))) {
  console.error("runmaxing: 스크립트를 찾을 수 없습니다. 패키지가 손상된 것 같습니다.");
  process.exit(1);
}

let codexPlan = "";
let requestedWslDistro = "";
const positional = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--codex-plan") {
    codexPlan = args[++i] || "";
  } else if (arg.startsWith("--codex-plan=")) {
    codexPlan = arg.slice("--codex-plan=".length);
  } else if (arg === "--wsl-distro") {
    requestedWslDistro = args[++i] || "";
  } else if (arg.startsWith("--wsl-distro=")) {
    requestedWslDistro = arg.slice("--wsl-distro=".length);
  } else if (!arg.startsWith("-")) {
    positional.push(arg);
  }
}
if (codexPlan && !["100", "200"].includes(codexPlan)) {
  console.error("runmaxing: --codex-plan은 100 또는 200만 가능합니다.");
  process.exit(1);
}
if (requestedWslDistro && !isWindows) {
  console.error("runmaxing: --wsl-distro는 Windows에서만 사용합니다.");
  process.exit(1);
}
const nick = positional[0] || "";
const env = { ...process.env };
if (args.includes("--no-open")) env.USAGE_REPORT_NO_OPEN = "1";
if (codexPlan) env.RUNMAXING_CODEX_PLAN = codexPlan;

let run;
const nativeData = isWindows && [".claude.json", ".claude/projects", ".codex/auth.json", ".codex/sessions"]
  .some((name) => fs.existsSync(path.join(os.homedir(), name)));
const resolved = isWindows && (requestedWslDistro || !nativeData)
  ? resolveWslDistro(spawnSync, {
    requested: requestedWslDistro,
    requireClaude: !args.includes("--report"),
  }) : null;
if (isWindows && !requestedWslDistro && (!resolved || resolved.error === "WSL_UNAVAILABLE")) {
  run = nativeRunner(SCRIPTS, env);
  if (!run) process.exit(1);
} else if (isWindows) {
  if (resolved.error) {
    console.error(`runmaxing: ACTION_REQUIRED=${resolved.error}`);
    if (resolved.error === "WSL_UNAVAILABLE") {
      console.error("Windows에서는 WSL 배포판이 필요합니다.");
    } else if (resolved.error === "WSL_DISTRO_UNAVAILABLE") {
      console.error(`지정한 WSL 배포판을 열 수 없습니다: ${requestedWslDistro}`);
    } else if (resolved.error === "WSL_DISTRO_AMBIGUOUS") {
      console.error(`사용 기록이 여러 WSL에 있습니다: ${resolved.probes.map((p) => p.distro).join(", ")}`);
      console.error('하나를 지정하세요: npx @m1kapp/runmaxing --wsl-distro "<배포판>"');
    } else if (resolved.error === "CLAUDE_LOGIN_REQUIRED") {
      console.error("서비스 제출 신원에 필요한 Claude Code 로그인 기록을 찾지 못했습니다.");
    } else {
      console.error("Claude/Codex 사용 기록을 찾지 못했습니다.");
    }
    console.error("Claude Code 또는 Codex에 아래 문장을 그대로 보내세요:");
    console.error('"내가 실제 사용한 Windows/WSL 환경에서 npx @m1kapp/runmaxing을 실행하고, ACTION_REQUIRED 오류를 해결한 뒤 다시 실행해줘."');
    process.exit(1);
  }

  const wslDistro = resolved.distro;
  const wslLabel = wslDistro || "기본 WSL";
  if (resolved.source === "auto") console.log(`Windows 환경 자동선택: ${wslLabel}`);

  // npm 은 Windows에서 실행하고 POSIX 수집기는 기록이 있는 WSL에서 돌린다.
  // 패키지 경로는 선택한 배포판의 wslpath로 변환하므로 현재 폴더와 무관하다.
  const converted = runWsl(spawnSync, wslDistro, ["wslpath", "-a", SCRIPTS], {
    encoding: "utf8",
  });
  const wslScripts = (converted.stdout || "").trim();
  if (converted.error || converted.status !== 0 || !wslScripts) {
    console.error("runmaxing: ACTION_REQUIRED=WSL_PATH_UNAVAILABLE");
    console.error(`${wslLabel}에서 npm 패키지 경로를 열 수 없습니다.`);
    console.error("Claude Code 또는 Codex에 아래 문장을 그대로 보내세요:");
    console.error('"WSL에서 이 npm 패키지 경로를 열 수 없는 원인을 해결하고 npx @m1kapp/runmaxing을 다시 실행해줘."');
    process.exit(1);
  }

  const requiredWslBins = args.includes("--report") ? "python3 npx" : "python3 npx curl";
  const ready = runWsl(spawnSync, wslDistro,
    ["bash", "-lc", `missing=""; for cmd in ${requiredWslBins}; do command -v "$cmd" >/dev/null || missing="$missing $cmd"; done; printf "%s" "$missing"; test -z "$missing"`],
    { encoding: "utf8" });
  if (ready.status !== 0) {
    const missing = (ready.stdout || "").trim() || "python3 npx curl";
    console.error("runmaxing: ACTION_REQUIRED=WSL_DEPENDENCIES_MISSING");
    console.error(`${wslLabel}에 필요한 명령이 없습니다: ${missing}`);
    console.error("Claude Code 또는 Codex에 아래 문장을 그대로 보내세요:");
    console.error(`"${wslLabel}에 ${missing}을 설치하고 npx @m1kapp/runmaxing을 다시 실행해줘."`);
    process.exit(1);
  }

  // 동작을 바꾸는 공개 환경변수만 넘긴다. HOME은 WSL의 홈을 유지해 Claude/Codex
  // 계정과 최초 생성된 runner 신분증을 같은 환경에서 계속 찾게 한다.
  const forwarded = [
    "USAGE_REPORT_NO_OPEN",
    "USAGE_REPORT_ENDPOINT",
    "USAGE_REPORT_KRW",
    "RUNMAXING_CODEX_PLAN",
  ].flatMap((key) => (env[key] ? [`${key}=${env[key]}`] : []));

  run = (script, scriptArgs = []) =>
    runWsl(
      spawnSync,
      wslDistro,
      ["env", ...forwarded, "bash", path.posix.join(wslScripts, script), ...scriptArgs],
      { stdio: "inherit" },
    );
} else {
  // bash / python3 는 스크립트가 직접 쓰므로 없으면 먼저 알려준다(중간에 죽는 것보다 낫다).
  const requiredBins = ["bash", "python3", "npx", ...(args.includes("--report") ? [] : ["curl"])];
  for (const bin of requiredBins) {
    const found = spawnSync(bin, ["--version"], { stdio: "ignore" });
    if (found.error) {
      console.error(`runmaxing: '${bin}' 이 필요합니다.`);
      process.exit(1);
    }
  }
  run = (script, scriptArgs = []) =>
    spawnSync("bash", [path.join(SCRIPTS, script), ...scriptArgs], { stdio: "inherit", env });
}

const built = run("run.sh");
if (built.status !== 0) {
  console.error("runmaxing: ACTION_REQUIRED=COLLECTION_FAILED");
  console.error("Claude Code 또는 Codex에 아래 문장을 그대로 보내세요:");
  console.error('"위 runmaxing 수집 오류를 진단하고 필요한 CLI 조치를 한 뒤 npx @m1kapp/runmaxing을 다시 실행해줘."');
  process.exit(built.status || 1);
}

if (args.includes("--report")) {
  console.log("\n리포트만 생성했습니다(제출 안 함). 제출하려면 --report 없이 다시 실행하세요.");
  process.exit(0);
}

const sent = run("submit.sh", [nick]);
if (sent.status !== 0) {
  console.error("runmaxing: ACTION_REQUIRED=SUBMISSION_FAILED");
  console.error("Claude Code 또는 Codex에 아래 문장을 그대로 보내세요:");
  console.error('"위 runmaxing 제출 오류를 진단하고 필요한 CLI 조치를 한 뒤 npx @m1kapp/runmaxing을 다시 실행해줘."');
  process.exit(sent.status || 1);
}
process.exit(0);
