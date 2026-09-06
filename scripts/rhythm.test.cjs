// Run: node --test scripts/rhythm.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

function load(name) {
  const filename = path.resolve(__dirname, `../lib/${name}.ts`);
  const module = new Module(filename, moduleParent);
  module.require = (id) => id === "./month" ? load("month") : require(id);
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  return module.exports;
}
const moduleParent = module;
const { activityRhythm } = load("rhythm");

test("rhythm uses calendar coverage, deduplicates providers, and handles missing hours", () => {
  const daily = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`2026-08-${String(i + 1).padStart(2, "0")}`, 1]));
  let r = activityRhythm("2026-08", { series: { daily_chats: daily } }, { series: { daily_cost_usd: daily } }, "ko", "2026-09-06");
  assert.equal(r.active, 31);
  assert.equal(r.weekendActive, 10);
  assert.equal(r.title, "주말도 달리는 꾸준러");
  assert.equal(r.stats[2].value, "—");
  r = activityRhythm("2026-08", { series: { daily_chats: daily, hourly: { 23: 80, 10: 20 } } }, {}, "en", "2026-09-06");
  assert.equal(r.title, "A steady night runner");
  assert.equal(r.nightShare, 0.8);
  r = activityRhythm("2026-08", { series: { daily_chats: daily } }, {}, "ko", "2026-08-03");
  assert.equal(r.elapsed, 3);
  assert.equal(r.active, 3);
  assert.equal(r.title, "리듬을 쌓아가는 사람");
  assert.equal(r.stats[1].value, "2 / 2");
  r = activityRhythm("2026-08", {}, {}, "ko", "2026-09-06");
  assert.deepEqual(r.stats.map((s) => s.value), ["—", "—", "—"]);
  assert.equal(activityRhythm("2026-13", {}, {}, "ko", "2026-09-06").days.length, 0);
  assert.equal(activityRhythm("2026-10", {}, {}, "ko", "2026-09-06").elapsed, 0);
});
