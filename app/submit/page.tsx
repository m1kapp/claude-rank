"use client";
import { useState } from "react";
import Link from "next/link";

export default function Submit() {
  const [nick, setNick] = useState("");
  const [json, setJson] = useState("");
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setMsg(null);
    let report: any;
    try { report = JSON.parse(json); }
    catch { setMsg({ t: "JSON 형식이 아닙니다. ~/claude-usage-report.json 내용을 그대로 붙여넣으세요.", ok: false }); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nick, report }),
      });
      const d = await res.json();
      if (!res.ok) setMsg({ t: d.error || "제출 실패", ok: false });
      else setMsg({ t: `등록 완료! 본전배율 ${d.entry.ratio}× · 채팅 ${d.entry.chats.toLocaleString()}`, ok: true });
    } catch {
      setMsg({ t: "네트워크 오류", ok: false });
    } finally { setBusy(false); }
  }

  return (
    <div className="wrap">
      <h1>기록 제출 📤</h1>
      <p className="sub"><Link href="/">← 랭킹으로</Link></p>

      <div className="card">
        <label>닉네임</label>
        <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="표시될 이름 (예: 민호)" maxLength={24} />

        <label>리포트 파일 (권장)</label>
        <input type="file" accept=".json,application/json" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const txt = await f.text();
          setJson(txt);
          setMsg({ t: `파일 불러옴: ${f.name}`, ok: true });
        }} />

        <label>또는 JSON 붙여넣기</label>
        <textarea value={json} onChange={(e) => setJson(e.target.value)}
          placeholder='~/claude-usage-report.json 내용을 통째로 붙여넣기' />

        <div className="note">
          1) Claude Code에서 <code>/usage-report</code> 실행 →
          2) <code>~/claude-usage-report.json</code> 파일 선택(또는 내용 붙여넣기) →
          3) 닉네임 넣고 제출. 같은 기기는 ID로 자동 갱신됩니다(중복 안 쌓임).
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="btn" onClick={submit} disabled={busy}>{busy ? "제출 중..." : "제출"}</button>
        </div>
        {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.t}</div>}
      </div>
      <div className="foot">m1kapp · usage-report</div>
    </div>
  );
}
