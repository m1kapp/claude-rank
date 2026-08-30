"use strict";

const PROBE_SCRIPT = `
claude_auth=0; claude_logs=0; codex_auth=0; codex_logs=0
grep -q '"accountUuid"' "$HOME/.claude.json" 2>/dev/null && claude_auth=1
find "$HOME/.claude/projects" -type f -name '*.jsonl' -print -quit 2>/dev/null | grep -q . && claude_logs=1
test -s "$HOME/.codex/auth.json" && codex_auth=1
find "$HOME/.codex/sessions" -type f -name '*.jsonl' -print -quit 2>/dev/null | grep -q . && codex_logs=1
printf '%s,%s,%s,%s' "$claude_auth" "$claude_logs" "$codex_auth" "$codex_logs"
`;

function decodeWslOutput(value) {
  if (!value) return "";
  if (typeof value === "string") return value.replace(/\0/g, "");
  let zeroes = 0;
  for (const byte of value) if (byte === 0) zeroes++;
  const encoding = zeroes > value.length / 8 ? "utf16le" : "utf8";
  return value.toString(encoding).replace(/\0/g, "");
}

function wslArgs(distro, args) {
  return distro ? ["-d", distro, "--", ...args] : args;
}

function runWsl(spawn, distro, args, options = {}) {
  return spawn("wsl.exe", wslArgs(distro, args), {
    windowsHide: true,
    ...options,
  });
}

function listDistros(spawn) {
  const result = spawn("wsl.exe", ["--list", "--quiet"], {
    windowsHide: true,
  });
  if (result.error || result.status !== 0) return [];
  return [...new Set(decodeWslOutput(result.stdout)
    .split(/\r?\n/)
    .map((line) => line.replace(/^\*\s*/, "").trim())
    .filter(Boolean)
    .filter((name) => !/^(docker-desktop(?:-data)?|podman-machine-default)$/i.test(name)))];
}

function probeDistro(spawn, distro) {
  const result = runWsl(spawn, distro, ["bash", "-lc", PROBE_SCRIPT], {
    encoding: "utf8",
  });
  const values = decodeWslOutput(result.stdout).trim().split(",");
  const reachable = !result.error && result.status === 0 && values.length === 4;
  return {
    distro,
    reachable,
    claudeAuth: reachable && values[0] === "1",
    claudeLogs: reachable && values[1] === "1",
    codexAuth: reachable && values[2] === "1",
    codexLogs: reachable && values[3] === "1",
  };
}

function usable(probe, requireClaude) {
  const hasLogs = probe.claudeLogs || probe.codexLogs;
  return probe.reachable && hasLogs && (!requireClaude || probe.claudeAuth);
}

function resolveWslDistro(spawn, { requested = "", requireClaude = true } = {}) {
  if (requested) {
    const probe = probeDistro(spawn, requested);
    if (!probe.reachable) return { error: "WSL_DISTRO_UNAVAILABLE", probes: [probe] };
    if (requireClaude && !probe.claudeAuth) return { error: "CLAUDE_LOGIN_REQUIRED", probes: [probe] };
    if (!probe.claudeLogs && !probe.codexLogs) return { error: "USAGE_NOT_FOUND", probes: [probe] };
    return { distro: requested, source: "requested", probe };
  }

  const defaultProbe = probeDistro(spawn, "");
  if (!defaultProbe.reachable) return { error: "WSL_UNAVAILABLE", probes: [defaultProbe] };
  if (usable(defaultProbe, requireClaude)) {
    return { distro: "", source: "default", probe: defaultProbe };
  }

  const probes = listDistros(spawn).map((distro) => probeDistro(spawn, distro));
  const candidates = probes.filter((probe) => usable(probe, requireClaude));
  if (candidates.length === 1) {
    return { distro: candidates[0].distro, source: "auto", probe: candidates[0] };
  }
  if (candidates.length > 1) return { error: "WSL_DISTRO_AMBIGUOUS", probes: candidates };

  const all = [defaultProbe, ...probes];
  if (requireClaude && !all.some((probe) => probe.claudeAuth)) {
    return { error: "CLAUDE_LOGIN_REQUIRED", probes: all };
  }
  return { error: "USAGE_NOT_FOUND", probes: all };
}

module.exports = {
  decodeWslOutput,
  listDistros,
  probeDistro,
  resolveWslDistro,
  runWsl,
  wslArgs,
};
