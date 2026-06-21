import { all } from "../lib/store";
import Link from "next/link";

export const dynamic = "force-dynamic";

function won(krw: number) {
  const man = krw / 1_0000;
  return man >= 10000 ? `₩${(man / 10000).toFixed(2)}억` : `₩${Math.round(man).toLocaleString()}만`;
}

export default async function Home() {
  const entries = (await all()).sort((a, b) => b.ratio - a.ratio);
  return (
    <div className="wrap">
      <h1>Claude 구독 가성비 랭킹 🏆</h1>
      <p className="sub">
        누가 월 구독 본전을 제일 뽑나. <code>/usage-report</code>로 만든 JSON을 제출하면 등록됩니다.
      </p>

      <div style={{ marginBottom: 18 }}>
        <Link className="btn" href="/submit">+ 내 기록 제출하기</Link>
      </div>

      <div className="card">
        {entries.length === 0 ? (
          <p style={{ color: "#9a9389" }}>아직 제출된 기록이 없습니다. 첫 주자가 되어보세요!</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>닉네임</th>
                <th className="num">본전배율</th>
                <th className="num">정가환산</th>
                <th className="num">채팅</th>
                <th className="num">커밋</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.id}>
                  <td className="rank">{i + 1}</td>
                  <td>
                    <Link href={`/u/${e.id}`} className="nick">{e.nick}</Link>
                    <span className="plan">${e.plan}/월</span>
                  </td>
                  <td className="num ratio">{e.ratio}×</td>
                  <td className="num">{won(e.cost_krw)}</td>
                  <td className="num">{e.chats.toLocaleString()}</td>
                  <td className="num">{e.commits.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="note">
        본전배율 = (API 정가 환산 ÷ 실제 구독료). 플랜($200/$100)이 다르면 배율 기준도 달라지니 플랜 배지를 함께 봅니다.
        금액은 “같은 양을 API로 썼다면”의 가상 환산값입니다.
      </div>
      <div className="foot">m1kapp · usage-report</div>
    </div>
  );
}
