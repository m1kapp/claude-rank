"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const CLI = path.join(__dirname, "..", "bin", "cli.js");

function withTempBin(name, body, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "runmaxing-cli-test-"));
  try {
    const executable = path.join(dir, name);
    fs.writeFileSync(executable, body, { mode: 0o755 });
    return run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("turns collector failures into an actionable agent instruction", { skip: process.platform === "win32" }, () => {
  withTempBin("npx", `#!/bin/sh
if [ "$1" = "--version" ]; then echo 10.0.0; exit 0; fi
exit 9
`, (bin) => {
    const result = spawnSync(process.execPath, [CLI, "--report", "--no-open"], {
      encoding: "utf8",
      env: { ...process.env, HOME: bin, PATH: `${bin}:${process.env.PATH}` },
    });
    assert.equal(result.status, 9);
    assert.match(result.stderr, /ACTION_REQUIRED=COLLECTION_FAILED/);
    assert.match(result.stderr, /Claude Code 또는 Codex/);
  });
});

test("turns submit failures into an actionable agent instruction", { skip: process.platform === "win32" }, () => {
  withTempBin("bash", `#!/bin/sh
if [ "$1" = "--version" ]; then exec /bin/bash --version; fi
case "$1" in
  */run.sh) exit 0 ;;
  */submit.sh) echo "simulated submit failure" >&2; exit 7 ;;
esac
exit 2
`, (bin) => {
    const result = spawnSync(process.execPath, [CLI, "--no-open"], {
      encoding: "utf8",
      env: { ...process.env, HOME: bin, PATH: `${bin}:${process.env.PATH}` },
    });
    assert.equal(result.status, 7);
    assert.match(result.stderr, /simulated submit failure/);
    assert.match(result.stderr, /ACTION_REQUIRED=SUBMISSION_FAILED/);
    assert.match(result.stderr, /Claude Code 또는 Codex/);
  });
});
