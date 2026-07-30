#!/usr/bin/env node
// 플러그인 스킬의 스크립트를 npm 패키지로 복사한다.
// 원본은 plugins/claude-run/skills/usage-report 한 곳뿐 — 여기서 갈라지면
// 플러그인과 npx 가 다르게 동작하게 되므로, 손으로 편집하지 말고 이걸 돌린다.
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "..", "plugins", "claude-run", "skills", "usage-report");
const DST = path.join(__dirname, "scripts");

// daily.sh 는 제외 — 자동 갱신은 스케줄러 등록이 필요해 플러그인 전용이다.
const SKIP = new Set(["daily.sh"]);

fs.mkdirSync(DST, { recursive: true });
for (const f of fs.readdirSync(DST)) fs.rmSync(path.join(DST, f), { force: true });

let n = 0;
for (const f of fs.readdirSync(SRC)) {
  if (SKIP.has(f) || fs.statSync(path.join(SRC, f)).isDirectory()) continue;
  fs.copyFileSync(path.join(SRC, f), path.join(DST, f));
  if (f.endsWith(".sh")) fs.chmodSync(path.join(DST, f), 0o755);
  n++;
}
console.log(`synced ${n} scripts → cli/scripts`);
