"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { nativeRunner } = require("../bin/native");

test("Python discovery skips broken aliases and uses the Windows launcher", () => {
  const calls = [];
  const run = nativeRunner("scripts", {}, (bin, args) => {
    calls.push([bin, ...args]);
    return { status: bin === "py" ? 0 : 1 };
  });
  assert.ok(run);
  run("run.sh");
  assert.equal(calls[1][0], "py");
  assert.equal(calls[1][1], "-3");
  assert.ok(calls[1].includes(path.join("scripts", "native.py")));
  const fallbacks = [];
  assert.ok(nativeRunner("scripts", {}, (bin) => {
    fallbacks.push(bin);
    return { status: bin === "python" ? 0 : 1 };
  }));
  assert.deepEqual(fallbacks, ["py", "python3", "python"]);
});

test("Windows CLI collects and submits from a Unicode home without WSL or Bash", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "runmaxing-한글 공백-"));
  const received = [];
  let reject = false;
  const server = http.createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      assert.equal(req.url, "/api/submit");
      received.push(JSON.parse(body));
      res.writeHead(reject ? 400 : 200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(reject ? { error: "거절 테스트" } : {
        ok: true, entry: { id: "claude_test" }, profile_id: "runner_test",
      }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = path.join(root, "사용자 폴더");
    const bin = path.join(root, "bin");
    fs.mkdirSync(path.join(home, ".claude", "projects", "project"), { recursive: true });
    fs.mkdirSync(path.join(home, ".codex"), { recursive: true });
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(home, ".claude.json"), JSON.stringify({ oauthAccount: {
      accountUuid: "test-account", emailAddress: "runner@example.com", organizationRateLimitTier: "default_claude_pro",
    } }));
    fs.writeFileSync(path.join(home, ".claude", "settings.json"), JSON.stringify({ language: "한국어" }));
    fs.writeFileSync(path.join(home, ".claude", "projects", "project", "log.jsonl"), JSON.stringify({
      type: "user", timestamp: "2026-08-10T00:00:00Z", message: { content: "한글 테스트" },
    }));
    const token = Buffer.from(JSON.stringify({ "https://api.openai.com/auth": { chatgpt_plan_type: "plus" } })).toString("base64url");
    fs.writeFileSync(path.join(home, ".codex", "auth.json"), JSON.stringify({
      tokens: { account_id: "codex-test-account", id_token: `header.${token}.sig` },
    }));
    // Only ccusage's external data is stubbed. The CLI, Python collectors, HTML/JSON
    // builder, identity persistence, and HTTP submission execute as shipped.
    const mock = path.join(bin, "ccusage.js");
    fs.writeFileSync(mock, `
if (process.env.FAKE_CCUSAGE_FAIL) process.exit(9);
const codex = process.argv.includes("codex");
console.log(JSON.stringify({ daily: [codex ? {
  date: "2026-08-10", costUSD: process.argv.includes("standard") ? 2 : 3,
  totalTokens: 1000, inputTokens: 600, outputTokens: 400,
  models: { "gpt-test": { totalTokens: 1000 } }
} : {
  period: "2026-08-10", totalCost: 10,
  modelBreakdowns: [{ modelName: "claude-sonnet-4-6", cost: 10 }]
}] }));
`);
    const windows = process.platform === "win32";
    fs.writeFileSync(path.join(bin, windows ? "npx.cmd" : "npx"), windows
      ? `@echo off\r\n"${process.execPath}" "${mock}" %*\r\n`
      : `#!/bin/sh\nexec '${process.execPath.replace(/'/g, "'\\''")}' '${mock.replace(/'/g, "'\\''")}' "$@"\n`,
    { mode: 0o755 });
    const preload = path.join(root, "windows.cjs");
    fs.writeFileSync(preload, 'Object.defineProperty(process, "platform", { value: "win32" });');
    const env = { ...process.env, HOME: home, USERPROFILE: home,
      USAGE_REPORT_ENDPOINT: endpoint, USAGE_REPORT_NO_OPEN: "1",
      RUNMAXING_IDENTITY: path.join(home, ".runmaxing", "identity.json"),
      USAGE_REPORT_OUT: path.join(home, "리포트 공백.html"),
    };
    const pathKey = Object.keys(env).find((key) => key.toUpperCase() === "PATH") || "PATH";
    env[pathKey] = bin + path.delimiter + env[pathKey];
    const cli = (args = [], extraEnv = {}) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [
        ...(!windows ? ["--require", preload] : []), path.join(__dirname, "..", "bin", "cli.js"), ...args,
      ], { env: { ...env, ...extraEnv }, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "", stderr = "";
      child.stdout.setEncoding("utf8").on("data", (s) => { stdout += s; });
      child.stderr.setEncoding("utf8").on("data", (s) => { stderr += s; });
      child.on("error", reject);
      child.on("close", (status) => resolve({ status, stdout, stderr }));
    });
    const nick = "한글 & 닉네임";
    let result = await cli([nick]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(received.length, 1);
    assert.equal(received[0].nick, nick);
    assert.equal(received[0].report.months["2026-08"].chats, 1);
    assert.equal(received[0].report.months["2026-08"].cost_usd, 10);
    assert.equal(received[0].report.codex.months["2026-08"].cost_usd, 3);
    assert.equal(received[0].report.codex.months["2026-08"].fast_premium_usd, 1);
    assert.match(received[0].report.codex.account_id, /^codex_/);
    assert.match(result.stdout, /갱신 완료/);
    assert.match(result.stdout, /\/u\/runner_test/);
    assert.ok(fs.readFileSync(env.USAGE_REPORT_OUT, "utf8").includes("</html>"));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home, ".claude", "settings.json"))),
      { language: "한국어", cleanupPeriodDays: 365 });
    const identity = fs.readFileSync(env.RUNMAXING_IDENTITY, "utf8");
    result = await cli();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(received[1].nick, nick);
    assert.deepEqual(received[1].runner, received[0].runner);
    assert.equal(received[1].report.device_id, received[0].report.device_id);
    assert.equal(fs.readFileSync(env.RUNMAXING_IDENTITY, "utf8"), identity);

    result = await cli(["--report"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(received.length, 2);
    result = await cli([], { FAKE_CCUSAGE_FAIL: "1" });
    assert.equal(result.status, 9);
    assert.match(result.stderr, /ACTION_REQUIRED=COLLECTION_FAILED/);
    assert.equal(received.length, 2);

    reject = true;
    result = await cli();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /거절 테스트/);
    assert.match(result.stderr, /ACTION_REQUIRED=SUBMISSION_FAILED/);
    assert.doesNotMatch(result.stdout, /갱신 완료/);
    fs.writeFileSync(env.RUNMAXING_IDENTITY, "broken identity");
    result = await cli();
    assert.equal(result.status, 1);
    assert.equal(received.length, 3);
    assert.equal(fs.readFileSync(env.RUNMAXING_IDENTITY, "utf8"), "broken identity");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
