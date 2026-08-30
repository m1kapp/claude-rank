"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "sess.py");

function writeLog(root, project, name, rows) {
  const dir = path.join(root, project);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.jsonl`), rows.map((row) => JSON.stringify(row)).join("\n"));
}

const user = (timestamp, content = "work") => ({
  type: "user", timestamp, isSidechain: false, message: { content },
});
const assistant = (timestamp) => ({
  type: "assistant", timestamp, isSidechain: false,
  message: { usage: {}, content: [] },
});

test("stitches reset transcript files without collapsing overlapping work", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "runmaxing-sess-test-"));
  try {
    writeLog(root, "project-a", "first", [
      user("2026-08-10T00:00:00Z"),
      assistant("2026-08-10T00:10:00Z"),
      { type: "system", subtype: "compact_boundary", timestamp: "2026-08-10T00:11:00Z" },
    ]);
    writeLog(root, "project-a", "reset", [
      user("2026-08-10T00:20:00Z"), assistant("2026-08-10T00:25:00Z"),
    ]);
    writeLog(root, "project-a", "overlap", [
      user("2026-08-10T00:05:00Z"), assistant("2026-08-10T00:06:00Z"),
    ]);
    writeLog(root, "project-a", "later", [
      user("2026-08-10T02:00:00Z"),
    ]);
    writeLog(root, "project-b", "other-project", [
      user("2026-08-10T00:30:00Z"),
    ]);

    const result = spawnSync("python3", [SCRIPT, root], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const month = JSON.parse(result.stdout)["2026-08"];
    assert.equal(month.sessions, 4);
    assert.equal(month.chats, 5);
    assert.equal(month.transcript_files, 5);
    assert.equal(month.compact_count, 1);
    assert.equal(month.max, 2);
    assert.equal(month.conc_peak, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
