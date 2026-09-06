"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  decodeWslOutput,
  listDistros,
  resolveWslDistro,
  wslArgs,
} = require("../bin/wsl");

function fakeSpawn({ defaultProbe = "0,0,0,0", distros = [], probes = {} } = {}) {
  return (_command, args) => {
    if (args[0] === "--list") {
      return { status: 0, stdout: Buffer.from(distros.join("\r\n"), "utf16le") };
    }
    const distro = args[0] === "-d" ? args[1] : "";
    const value = distro ? probes[distro] : defaultProbe;
    if (value == null) return { status: 1, stdout: "" };
    return { status: 0, stdout: value };
  };
}

test("decodes UTF-16 WSL distribution output", () => {
  assert.equal(decodeWslOutput(Buffer.from("Ubuntu\r\n", "utf16le")), "Ubuntu\r\n");
});

test("filters utility distributions", () => {
  const spawn = fakeSpawn({ distros: ["Ubuntu", "docker-desktop", "podman-machine-default"] });
  assert.deepEqual(listDistros(spawn), ["Ubuntu"]);
});

test("uses the default WSL when it has Claude identity and logs", () => {
  const result = resolveWslDistro(fakeSpawn({ defaultProbe: "1,1,1,1" }));
  assert.deepEqual({ distro: result.distro, source: result.source }, { distro: "", source: "default" });
});

test("automatically selects the only WSL with identity and logs", () => {
  const spawn = fakeSpawn({
    distros: ["Ubuntu", "Debian"],
    probes: { Ubuntu: "1,1,0,0", Debian: "0,0,0,0" },
  });
  const result = resolveWslDistro(spawn);
  assert.deepEqual({ distro: result.distro, source: result.source }, { distro: "Ubuntu", source: "auto" });
});

test("finds a usable distro even when the default WSL cannot run bash", () => {
  const result = resolveWslDistro(fakeSpawn({
    defaultProbe: null,
    distros: ["docker-desktop", "Ubuntu"],
    probes: { Ubuntu: "1,1,0,0" },
  }));
  assert.equal(result.distro, "Ubuntu");
  assert.equal(result.source, "auto");
});

test("reports unavailable only when no WSL distro is reachable", () => {
  const result = resolveWslDistro(fakeSpawn({ defaultProbe: null }));
  assert.equal(result.error, "WSL_UNAVAILABLE");
});

test("reports missing login when another distro is reachable", () => {
  const result = resolveWslDistro(fakeSpawn({
    defaultProbe: null,
    distros: ["Ubuntu"],
    probes: { Ubuntu: "0,0,0,0" },
  }));
  assert.equal(result.error, "CLAUDE_LOGIN_REQUIRED");
});

test("requires an explicit choice when multiple WSLs contain usable records", () => {
  const spawn = fakeSpawn({
    distros: ["Ubuntu", "Debian"],
    probes: { Ubuntu: "1,1,0,0", Debian: "1,0,1,1" },
  });
  const result = resolveWslDistro(spawn);
  assert.equal(result.error, "WSL_DISTRO_AMBIGUOUS");
  assert.deepEqual(result.probes.map((probe) => probe.distro), ["Ubuntu", "Debian"]);
});

test("reports a missing Claude login before service submission", () => {
  const spawn = fakeSpawn({ distros: ["Ubuntu"], probes: { Ubuntu: "0,0,1,1" } });
  assert.equal(resolveWslDistro(spawn).error, "CLAUDE_LOGIN_REQUIRED");
});

test("allows a Codex-only environment for local report mode", () => {
  const spawn = fakeSpawn({ defaultProbe: "0,0,1,1" });
  const result = resolveWslDistro(spawn, { requireClaude: false });
  assert.equal(result.source, "default");
});

test("keeps a WSL name with spaces as one process argument", () => {
  assert.deepEqual(wslArgs("Ubuntu Dev", ["bash", "-lc", "true"]),
    ["-d", "Ubuntu Dev", "--", "bash", "-lc", "true"]);
});
