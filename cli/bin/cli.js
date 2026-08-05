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

const SCRIPTS = path.join(__dirname, "..", "scripts");
const args = process.argv.slice(2);
const isWindows = process.platform === "win32";

if (args.includes("-h") || args.includes("--help")) {
  console.log(`runmaxing — one runner, two agent lanes

  npx @m1kapp/runmaxing              내 사용량 집계 후 랭킹 갱신 (닉네임 자동)
  npx @m1kapp/runmaxing <닉네임>     닉네임을 지정해서 갱신 (다음부터 생략 가능)
  npx @m1kapp/runmaxing --codex-plan 200  Codex Pro 종목 지정 ($100 또는 $200)
  npx @m1kapp/runmaxing --no-open    브라우저를 열지 않음
  npx @m1kapp/runmaxing --report     리포트만 만들고 제출하지 않음

요금제·닉네임은 자동 판별됩니다. 첫 제출에서 로컬 runner 신분증을 한 번 만들고
Claude와 Codex를 따로 인식해 연결합니다. 기존 신분증은 덮어쓰지 않습니다.
필요 조건: bash, python3, 그리고 npx(ccusage 집계용).
Windows PowerShell에서는 설치된 WSL로 자동 연결합니다.

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
const positional = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--codex-plan") {
    codexPlan = args[++i] || "";
  } else if (arg.startsWith("--codex-plan=")) {
    codexPlan = arg.slice("--codex-plan=".length);
  } else if (!arg.startsWith("-")) {
    positional.push(arg);
  }
}
if (codexPlan && !["100", "200"].includes(codexPlan)) {
  console.error("runmaxing: --codex-plan은 100 또는 200만 가능합니다.");
  process.exit(1);
}
const nick = positional[0] || "";
const env = { ...process.env };
if (args.includes("--no-open")) env.USAGE_REPORT_NO_OPEN = "1";
if (codexPlan) env.RUNMAXING_CODEX_PLAN = codexPlan;

let run;
if (isWindows) {
  // npm 은 Windows에서 실행하되, 기존 POSIX 수집기는 사용자의 기본 WSL 배포판 안에서
  // 그대로 돌린다. 패키지 경로만 wslpath로 바꾸므로 별도 전역 설치나 --force가 없다.
  const converted = spawnSync("wsl.exe", ["wslpath", "-a", SCRIPTS], {
    encoding: "utf8",
    windowsHide: true,
  });
  const wslScripts = (converted.stdout || "").trim();
  if (converted.error || converted.status !== 0 || !wslScripts) {
    console.error("runmaxing: Windows에서는 WSL이 필요합니다. WSL 배포판을 설치한 뒤 같은 명령을 다시 실행해 주세요.");
    process.exit(1);
  }

  const ready = spawnSync(
    "wsl.exe",
    ["bash", "-lc", "command -v python3 >/dev/null && command -v npx >/dev/null"],
    { stdio: "ignore", windowsHide: true },
  );
  if (ready.status !== 0) {
    console.error("runmaxing: WSL 안에 python3와 npx(Node.js)가 필요합니다.");
    console.error("WSL 터미널에서 설치한 뒤 npx @m1kapp/runmaxing을 다시 실행해 주세요.");
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
    spawnSync(
      "wsl.exe",
      ["env", ...forwarded, "bash", path.posix.join(wslScripts, script), ...scriptArgs],
      { stdio: "inherit", windowsHide: true },
    );
} else {
  // bash / python3 는 스크립트가 직접 쓰므로 없으면 먼저 알려준다(중간에 죽는 것보다 낫다).
  for (const bin of ["bash", "python3"]) {
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
if (built.status !== 0) process.exit(built.status || 1);

if (args.includes("--report")) {
  console.log("\n리포트만 생성했습니다(제출 안 함). 제출하려면 --report 없이 다시 실행하세요.");
  process.exit(0);
}

const sent = run("submit.sh", [nick]);
process.exit(sent.status || 0);
