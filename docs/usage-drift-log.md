# Usage drift log — a tiny spec for submitters

Trackers that recompute totals from live Claude Code JSONL files can report a
**month-to-date total that goes down**. The files are rewritten in place by
resume/compact, so a later scan legitimately sees less than an earlier one
([viberank#83](https://github.com/sculptdotfun/viberank/issues/83),
[splitrail#200](https://github.com/Piebald-AI/splitrail/issues/200)).

The fix at the leaderboard layer is to stop trusting recomputation. The fix at
the *submitter* layer — cheaper, and useful even without server changes — is to
keep a per-run log so drift is **visible instead of silent**, and so the cause
can be told apart.

This is the format `clauderank` writes. It is deliberately small. If other
submitters emit the same fields with the same drop semantics, drift becomes
comparable across tools instead of being rediscovered in each one.

## File

One JSON object per line, appended once per run, never rewritten.

```
~/.usage-report-history.jsonl
```

## Record

```json
{
  "at": "2026-07-31T02:07:03+09:00",
  "month": "2026-07",
  "cost_usd": 19105.20,
  "messages": 9538,
  "corpus": { "files": 1055, "bytes": 1796481718 }
}
```

| field | type | meaning |
|---|---|---|
| `at` | ISO 8601 **with offset** | when the run happened. Local offset, not UTC-normalized — drift often correlates with local working hours. |
| `month` | `YYYY-MM` | the month the totals cover. Local month boundary. |
| `cost_usd` | number | month-to-date cost in USD. Currency-neutral field so tools with other display currencies stay comparable. |
| `messages` | integer | month-to-date count of **human-authored** messages. Exclude agent-authored turns (in Claude Code, records with `isSidechain: true` are prompts a parent agent sent, not a person). |
| `corpus.files` | integer | number of source transcript files scanned, **recursively** (subagent transcripts live in `<session>/subagents/`). |
| `corpus.bytes` | integer | total bytes of those files. |

Extra fields are fine; the six above are the contract.

How much the `isSidechain` exclusion moves `messages` depends on the workload,
so don't calibrate a threshold against someone else's ratio. On a corpus driven
mostly by hand it is a modest correction — 11,872 of 84,314 user records, 14.1%,
across 1,120 files here. On agent-heavy workflows subagent transcripts can carry
**over half** of all message volume, so the same exclusion changes the number by
a different order. The drop semantics below are unaffected either way: they
compare a metric against its own earlier value, never across implementations.

## Drop semantics

Compare against the most recent prior record **with the same `month`**. Warn
when

```
prior.cost_usd > current.cost_usd * 1.02
```

The 2% band absorbs pricing-table refreshes and rounding. Cumulative totals for
a month cannot legitimately fall, so anything past that band is a signal.

## The discriminator

`corpus` is what makes the warning actionable. Given a drop:

| corpus.files | reading |
|---|---|
| **decreased** | transcripts were removed — retention policy, cleanup, a deleted project |
| **same or increased** | files were **rewritten in place** — the resume/compact case |

The second case is the one that matters for a leaderboard: it is not the user's
doing, so treating it as a suspicious submission would be wrong.

Ruling out the accounting layer is worth doing before blaming the corpus. When a
new version of the upstream cost tool lands between two runs, re-run the *old*
version against the *current* corpus — if both versions agree, the change is in
the data, not the arithmetic.

## What this does not do

It records; it does not prevent. Freezing totals at submission time
(append-only, keyed on a stable message identity) is the stronger fix — see
splitrail's ingest log keyed by message uuid. The log above is the cheap layer
that works before any of that lands, and it stays useful afterwards as a
cross-tool signal.

## Reference implementation

`plugins/claude-run/skills/usage-report/build.py` in this repository — the
history block near the end. MIT.
