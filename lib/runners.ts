import { createHash, timingSafeEqual } from "crypto";
import { dataFile, readJson, upstash, useUpstash, writeJson } from "./db";

export type Provider = "claude" | "codex";

export type RunnerRecord = {
  id: string;
  token_hash: string;
  entry_id: string;
  nick: string;
  identities: Partial<Record<Provider, string>>;
  created: string;
  updated: string;
};

const RUNNERS_KEY = "runmaxing:runners";
const IDENTITIES_KEY = "runmaxing:identities";
const RUNNERS_FILE = dataFile("runners.json");
const IDENTITIES_FILE = dataFile("runner-identities.json");

const RUNNER_RE = /^runner_[0-9a-f]{24}$/;
const TOKEN_RE = /^[0-9a-f]{64}$/;
const PROVIDER_ID_RE: Record<Provider, RegExp> = {
  claude: /^claude_[0-9a-f]{32}$/,
  codex: /^codex_[0-9a-f]{32}$/,
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const safeParse = (value: string | null): any => {
  try { return value ? JSON.parse(value) : null; } catch { return null; }
};
const identityKey = (provider: Provider, accountId: string) => `${provider}:${accountId}`;

export const runnerIdForToken = (token: string) => `runner_${sha256(token).slice(0, 24)}`;

function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

async function getRunnerRaw(id: string): Promise<RunnerRecord | null> {
  if (useUpstash) return safeParse(await upstash(["HGET", RUNNERS_KEY, id]));
  return (await readJson<Record<string, RunnerRecord>>(RUNNERS_FILE, {}))[id] || null;
}

async function identityOwner(provider: Provider, accountId: string): Promise<string | null> {
  const key = identityKey(provider, accountId);
  if (useUpstash) return (await upstash(["HGET", IDENTITIES_KEY, key])) || null;
  return (await readJson<Record<string, string>>(IDENTITIES_FILE, {}))[key] || null;
}

export class RunnerIdentityConflict extends Error {
  constructor() {
    super("이 계정은 이미 다른 runner에 연결되어 있어요. 기존 runner 연결을 먼저 복구하세요.");
  }
}

export class RunnerCredentialError extends Error {
  constructor() {
    super("runner 신분증이 올바르지 않아요. 로컬 identity 파일을 확인하세요.");
  }
}

// 기존 엔트리를 옮기거나 복사하지 않는다. runner 레코드와 identity 인덱스만 추가하고,
// 이미 연결된 provider 는 같은 값일 때만 그대로 둔다.
export async function claimRunner(input: {
  runnerId: string;
  token: string;
  entryId: string;
  nick: string;
  identities: Partial<Record<Provider, string>>;
}): Promise<RunnerRecord> {
  const { runnerId, token, entryId } = input;
  if (!RUNNER_RE.test(runnerId) || !TOKEN_RE.test(token) || runnerIdForToken(token) !== runnerId) {
    throw new RunnerCredentialError();
  }
  if (!PROVIDER_ID_RE.claude.test(entryId)) throw new RunnerCredentialError();

  const identities = Object.fromEntries(
    (Object.entries(input.identities) as [Provider, string][])
      .filter(([provider, value]) => PROVIDER_ID_RE[provider]?.test(value)),
  ) as Partial<Record<Provider, string>>;
  identities.claude = entryId;

  for (const [provider, accountId] of Object.entries(identities) as [Provider, string][]) {
    const owner = await identityOwner(provider, accountId);
    if (owner && owner !== runnerId) throw new RunnerIdentityConflict();
  }

  const now = new Date().toISOString();
  const tokenHash = sha256(token);
  const existing = await getRunnerRaw(runnerId);
  if (existing && (!sameHash(existing.token_hash, tokenHash) || existing.entry_id !== entryId)) {
    throw new RunnerCredentialError();
  }
  for (const [provider, accountId] of Object.entries(identities) as [Provider, string][]) {
    const linked = existing?.identities?.[provider];
    if (linked && linked !== accountId) throw new RunnerIdentityConflict();
  }

  const runner: RunnerRecord = {
    id: runnerId,
    token_hash: tokenHash,
    entry_id: existing?.entry_id || entryId,
    nick: input.nick || existing?.nick || "runner",
    identities: { ...(existing?.identities || {}), ...identities },
    created: existing?.created || now,
    updated: now,
  };

  if (useUpstash) {
    await upstash(["HSET", RUNNERS_KEY, runnerId, JSON.stringify(runner)]);
    for (const [provider, accountId] of Object.entries(identities) as [Provider, string][]) {
      await upstash(["HSET", IDENTITIES_KEY, identityKey(provider, accountId), runnerId]);
    }
  } else {
    const runners = await readJson<Record<string, RunnerRecord>>(RUNNERS_FILE, {});
    const index = await readJson<Record<string, string>>(IDENTITIES_FILE, {});
    runners[runnerId] = runner;
    for (const [provider, accountId] of Object.entries(identities) as [Provider, string][]) {
      index[identityKey(provider, accountId)] = runnerId;
    }
    await writeJson(RUNNERS_FILE, runners, 2);
    await writeJson(IDENTITIES_FILE, index, 2);
  }
  return runner;
}

export async function getRunner(id: string): Promise<Omit<RunnerRecord, "token_hash"> | null> {
  const runner = await getRunnerRaw(id);
  if (!runner) return null;
  const { token_hash: _tokenHash, ...safe } = runner;
  return safe;
}

export async function runnerForEntry(entryId: string): Promise<Omit<RunnerRecord, "token_hash"> | null> {
  const runnerId = await identityOwner("claude", entryId);
  return runnerId ? getRunner(runnerId) : null;
}

export async function resolveEntryId(profileId: string): Promise<string> {
  if (!RUNNER_RE.test(profileId)) return profileId;
  return (await getRunner(profileId))?.entry_id || profileId;
}

export async function publicIdsForEntries(entryIds: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!entryIds.length) return out;
  if (useUpstash) {
    const flat: string[] = (await upstash(["HGETALL", IDENTITIES_KEY])) || [];
    const wanted = new Set(entryIds.map((id) => identityKey("claude", id)));
    for (let i = 0; i + 1 < flat.length; i += 2) {
      if (wanted.has(flat[i])) out[flat[i].slice("claude:".length)] = flat[i + 1];
    }
    return out;
  }
  const index = await readJson<Record<string, string>>(IDENTITIES_FILE, {});
  for (const entryId of entryIds) out[entryId] = index[identityKey("claude", entryId)] || entryId;
  return out;
}

export async function authenticateRunner(runnerId: string, token: string): Promise<RunnerRecord | null> {
  if (!RUNNER_RE.test(runnerId) || !TOKEN_RE.test(token) || runnerIdForToken(token) !== runnerId) return null;
  const runner = await getRunnerRaw(runnerId);
  return runner && sameHash(runner.token_hash, sha256(token)) ? runner : null;
}

export async function removeRunner(runnerId: string, token: string): Promise<string | null> {
  const runner = await authenticateRunner(runnerId, token);
  if (!runner) return null;
  const keys = Object.entries(runner.identities).map(([provider, id]) => identityKey(provider as Provider, id!));
  if (useUpstash) {
    await upstash(["HDEL", RUNNERS_KEY, runnerId]);
    if (keys.length) await upstash(["HDEL", IDENTITIES_KEY, ...keys]);
  } else {
    const runners = await readJson<Record<string, RunnerRecord>>(RUNNERS_FILE, {});
    const index = await readJson<Record<string, string>>(IDENTITIES_FILE, {});
    delete runners[runnerId];
    for (const key of keys) if (index[key] === runnerId) delete index[key];
    await writeJson(RUNNERS_FILE, runners, 2);
    await writeJson(IDENTITIES_FILE, index, 2);
  }
  return runner.entry_id;
}
