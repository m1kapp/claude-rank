"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

function nativeRunner(scripts, env, spawn = spawnSync) {
  // py is the Windows launcher; skip Store aliases that do not run Python.
  const python = [["py", "-3"], ["python3"], ["python"]].find(([bin, ...args]) => {
    const result = spawn(bin, [...args, "-c", "import sys; assert sys.version_info >= (3, 9)"],
      { stdio: "ignore", windowsHide: true, env });
    return !result.error && result.status === 0;
  });
  if (!python) {
    console.error("runmaxing: ACTION_REQUIRED=PYTHON_REQUIRED");
    console.error("Python 3.9 이상이 필요합니다. PowerShell에서 설치 후 터미널을 다시 여세요:");
    console.error("winget install -e --id Python.Python.3.13");
    return null;
  }
  return (script, args = []) => spawn(python[0], [
    ...python.slice(1), "-X", "utf8", path.join(scripts, "native.py"), script, ...args,
  ], { stdio: "inherit", env: { ...env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" } });
}

module.exports = { nativeRunner };
