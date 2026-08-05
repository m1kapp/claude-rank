#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DATA = path.join(ROOT, ".data", "experiments", "cross-model-review.json");
const DATA_FILE = process.env.RUNMAX_EXPERIMENT_DATA || DEFAULT_DATA;
const ALLOW_EARLY = process.env.RUNMAX_EXPERIMENT_ALLOW_EARLY === "1";
const ASSIGNMENTS = ["A", "B", "B", "A", "B", "A", "A", "B", "A", "B", "B", "A"];

const EXPERIMENT = {
  id: "cross-model-review-2026-08",
  timezone: "Asia/Seoul",
  collection_start: "2026-08-06T00:00:00+09:00",
  collection_end: "2026-08-12T23:59:59+09:00",
  minimum_completed_tasks: 8,
  hypothesis: "Codex independent review after Claude Code implementation reduces material human rework enough to justify its added time.",
  primary_metric: "material_rework",
  assignment_sequence: ASSIGNMENTS,
};

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) throw new Error(`알 수 없는 인자: ${token}`);
    const key = token.slice(2);
    const value = rest[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`--${key} 값이 필요합니다.`);
    options[key] = value;
    i += 1;
  }
  return { command, options };
}

function usage() {
  console.log(`사용법:
  npm run experiment:review -- init
  npm run experiment:review -- start --title "작업명" --done-when "완료 조건" [--repo "저장소"]
  npm run experiment:review -- finish --id T01 --material-rework yes|no --corrections N --ci-failures N --oversight-min N --review-findings N --merged yes|no [--notes "메모"]
  npm run experiment:review -- followup --id T01 --post-merge-fix yes|no [--notes "메모"]
  npm run experiment:review -- status`);
}

function load() {
  if (!fs.existsSync(DATA_FILE)) return null;
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function save(state) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const temp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, DATA_FILE);
}

function required(options, name) {
  const value = options[name];
  if (!value) throw new Error(`--${name} 값이 필요합니다.`);
  return value;
}

function integer(options, name, fallback) {
  const raw = options[name];
  if (raw == null && fallback != null) return fallback;
  if (!/^\d+$/.test(raw || "")) throw new Error(`--${name}은 0 이상의 정수여야 합니다.`);
  return Number(raw);
}

function yesNo(options, name) {
  const raw = required(options, name).toLowerCase();
  if (raw !== "yes" && raw !== "no") throw new Error(`--${name}은 yes 또는 no여야 합니다.`);
  return raw === "yes";
}

function taskById(state, id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) throw new Error(`작업을 찾을 수 없습니다: ${id}`);
  return task;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatNumber(value) {
  return value == null ? "-" : Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatPercent(value) {
  return value == null ? "-" : `${formatNumber(value)}%`;
}

function armSummary(tasks, arm) {
  const completed = tasks.filter((task) => task.arm === arm && task.finished_at);
  const followed = completed.filter((task) => typeof task.post_merge_fix_48h === "boolean");
  const rework = completed.filter((task) => task.material_rework).length;
  const postMergeFix = followed.filter((task) => task.post_merge_fix_48h).length;
  return {
    arm,
    completed: completed.length,
    rework,
    reworkRate: completed.length ? (rework / completed.length) * 100 : null,
    correctionRounds: completed.reduce((sum, task) => sum + task.correction_rounds, 0),
    ciFailures: completed.reduce((sum, task) => sum + task.ci_failures, 0),
    reviewFindings: completed.reduce((sum, task) => sum + task.review_findings, 0),
    medianElapsed: median(completed.map((task) => task.elapsed_min)),
    medianOversight: median(completed.map((task) => task.oversight_min)),
    followed: followed.length,
    postMergeFix,
    postMergeFixRate: followed.length ? (postMergeFix / followed.length) * 100 : null,
  };
}

function printArm(summary) {
  console.log(`\n${summary.arm}군 · 완료 ${summary.completed}`);
  console.log(`  실질 재작업: ${summary.rework}/${summary.completed} (${formatPercent(summary.reworkRate)})`);
  console.log(`  수정 라운드 / CI 실패: ${summary.correctionRounds} / ${summary.ciFailures}`);
  console.log(`  경과·감독 중앙값: ${formatNumber(summary.medianElapsed)}분 / ${formatNumber(summary.medianOversight)}분`);
  if (summary.arm === "B") console.log(`  반영한 Codex 발견: ${summary.reviewFindings}`);
  console.log(`  48시간 후속 수정: ${summary.postMergeFix}/${summary.followed} (${formatPercent(summary.postMergeFixRate)})`);
}

function ensureInitialized() {
  const state = load();
  if (!state) throw new Error("먼저 init을 실행하세요.");
  if (state.experiment.id !== EXPERIMENT.id) throw new Error("데이터 파일의 실험 ID가 현재 설정과 다릅니다.");
  return state;
}

function init() {
  const existing = load();
  if (existing) {
    if (existing.experiment.id !== EXPERIMENT.id) throw new Error("다른 실험 데이터가 이미 있습니다.");
    console.log(`이미 초기화됨: ${DATA_FILE}`);
    return;
  }
  save({ schema_version: 1, experiment: EXPERIMENT, initialized_at: new Date().toISOString(), tasks: [] });
  console.log(`초기화 완료: ${DATA_FILE}`);
  console.log("수집 기간: 2026-08-06 00:00 ~ 2026-08-12 23:59 KST");
}

function start(options) {
  const state = ensureInitialized();
  const now = new Date();
  const collectionStart = new Date(state.experiment.collection_start);
  const collectionEnd = new Date(state.experiment.collection_end);
  if (!ALLOW_EARLY && (now < collectionStart || now > collectionEnd)) {
    throw new Error("현재 시각은 사전 등록한 작업 수집 기간 밖입니다.");
  }
  const index = state.tasks.length;
  const id = `T${String(index + 1).padStart(2, "0")}`;
  const sequence = state.experiment.assignment_sequence;
  const arm = sequence[index % sequence.length];
  const task = {
    id,
    arm,
    title: required(options, "title"),
    done_when: required(options, "done-when"),
    repo: options.repo || path.basename(process.cwd()),
    started_at: new Date().toISOString(),
  };
  state.tasks.push(task);
  save(state);
  console.log(`${id} 시작 · ${arm}군 · ${task.title}`);
  console.log(arm === "A"
    ? "현재 Claude Code 구현·자체 검증 흐름을 사용하고 독립 모델 리뷰는 추가하지 마세요."
    : "Claude Code 자체 검증 뒤 Codex 읽기 전용 독립 리뷰를 실행하고 발견 사항을 반영하세요.");
}

function finish(options) {
  const state = ensureInitialized();
  const task = taskById(state, required(options, "id"));
  if (task.finished_at) throw new Error(`${task.id}는 이미 완료 기록이 있습니다.`);
  const finishedAt = new Date();
  const elapsed = options["elapsed-min"] == null
    ? Math.max(0, Math.round((finishedAt.getTime() - new Date(task.started_at).getTime()) / 60000))
    : integer(options, "elapsed-min");
  Object.assign(task, {
    finished_at: finishedAt.toISOString(),
    material_rework: yesNo(options, "material-rework"),
    correction_rounds: integer(options, "corrections"),
    ci_failures: integer(options, "ci-failures"),
    oversight_min: integer(options, "oversight-min"),
    review_findings: integer(options, "review-findings", 0),
    merged: yesNo(options, "merged"),
    elapsed_min: elapsed,
    notes: options.notes || "",
  });
  if (task.arm === "A" && task.review_findings !== 0) throw new Error("A군의 --review-findings는 0이어야 합니다.");
  save(state);
  console.log(`${task.id} 완료 기록 · ${task.arm}군 · ${elapsed}분`);
  console.log("완료 또는 머지 48시간 뒤 followup을 기록하세요.");
}

function followup(options) {
  const state = ensureInitialized();
  const task = taskById(state, required(options, "id"));
  if (!task.finished_at) throw new Error(`${task.id}의 finish 기록이 먼저 필요합니다.`);
  if (typeof task.post_merge_fix_48h === "boolean") throw new Error(`${task.id}는 이미 후속 기록이 있습니다.`);
  const postMergeFix = yesNo(options, "post-merge-fix");
  const followupAge = Date.now() - new Date(task.finished_at).getTime();
  if (!postMergeFix && !ALLOW_EARLY && followupAge < 48 * 60 * 60 * 1000) {
    throw new Error("후속 수정 없음은 finish 기록 48시간 뒤에 확정할 수 있습니다.");
  }
  task.post_merge_fix_48h = postMergeFix;
  task.followup_at = new Date().toISOString();
  task.followup_notes = options.notes || "";
  save(state);
  console.log(`${task.id} 48시간 후속 기록 완료`);
}

function status() {
  const state = ensureInitialized();
  const completed = state.tasks.filter((task) => task.finished_at).length;
  console.log(`${state.experiment.id}`);
  console.log(`전체 ${state.tasks.length} · 완료 ${completed} · 진행 중 ${state.tasks.length - completed}`);
  console.log(`최소 표본 ${state.experiment.minimum_completed_tasks}: ${completed >= state.experiment.minimum_completed_tasks ? "충족" : "미충족"}`);
  printArm(armSummary(state.tasks, "A"));
  printArm(armSummary(state.tasks, "B"));
}

try {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!command || command === "help" || command === "--help") usage();
  else if (command === "init") init();
  else if (command === "start") start(options);
  else if (command === "finish") finish(options);
  else if (command === "followup") followup(options);
  else if (command === "status") status();
  else throw new Error(`알 수 없는 명령: ${command}`);
} catch (error) {
  console.error(`에러: ${error.message}`);
  process.exitCode = 1;
}
