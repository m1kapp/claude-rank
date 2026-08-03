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

슬래시 명령과 하루 1회 자동 갱신을 원하면 플러그인도 있다:
  /plugin marketplace add m1kapp/runmaxing
  /plugin install claude-run@claude-rank
`);
  process.exit(0);
}

// bash / python3 는 스크립트가 직접 쓰므로 없으면 먼저 알려준다(중간에 죽는 것보다 낫다).
for (const [bin, hint] of [["bash", ""], ["python3", " (macOS/Linux 는 기본 포함, Windows 는 WSL 필요)"]]) {
  const r = spawnSync(bin, ["--version"], { stdio: "ignore" });
  if (r.error) {
    console.error(`runmaxing: '${bin}' 이 필요합니다${hint}.`);
    process.exit(1);
  }
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

const run = (script, scriptArgs = []) =>
  spawnSync("bash", [path.join(SCRIPTS, script), ...scriptArgs], { stdio: "inherit", env });

const built = run("run.sh");
if (built.status !== 0) process.exit(built.status || 1);

if (args.includes("--report")) {
  console.log("\n리포트만 생성했습니다(제출 안 함). 제출하려면 --report 없이 다시 실행하세요.");
  process.exit(0);
}

const sent = run("submit.sh", [nick]);
process.exit(sent.status || 0);
