"use client";

import { useState } from "react";
import { useI18n } from "../../../lib/i18n";

type Habit = {
  key: string;
  active: boolean;
  ko: string;
  en: string;
  koDetail: string;
  enDetail: string;
};

const HABITS: Habit[] = [
  { key: "goal", active: false, ko: "원하는 결과", en: "Outcome", koDetail: "할 일은 빠르게 말하지만, 원하는 결과는 대화하면서 선명해지는 편이에요.", enDetail: "You state the task quickly, while the desired outcome becomes clearer during the conversation." },
  { key: "material", active: true, ko: "실제 자료", en: "Real material", koDetail: "이미지·코드·로그로 현재 상태를 직접 보여줘 AI가 추측할 부분을 줄여요.", enDetail: "You share images, code, and logs so the AI has less to guess." },
  { key: "context", active: true, ko: "관련 맥락", en: "Context", koDetail: "현재 화면에서 주변 파일·레포·브랜치까지 연결해 문제의 영향 범위를 보여줘요.", enDetail: "You connect the current state to related files, repos, and branches." },
  { key: "difference", active: false, ko: "기대 차이", en: "Expected gap", koDetail: "현재 상태는 잘 보여주지만 기대 결과는 ‘이거·그거’ 같은 후속 표현으로 드러날 때가 많아요.", enDetail: "You show the current state well, but the expected difference often appears later." },
  { key: "constraints", active: true, ko: "지킬 조건", en: "Constraints", koDetail: "기존 기록 유지와 덮어쓰기 방지처럼 바뀌면 안 되는 조건을 분명히 해요.", enDetail: "You clearly state what must be preserved and what must not be overwritten." },
  { key: "summary", active: false, ko: "질문 요약", en: "Question first", koDetail: "원자료는 풍부하지만 긴 자료보다 앞에 핵심 질문 한 줄을 두는 습관은 아직 드물어요.", enDetail: "Your source material is rich, but the one-line question rarely comes first." },
  { key: "scope", active: false, ko: "범위 나누기", en: "Scope", koDetail: "작은 문제에서 더 큰 가능성을 잘 찾는 대신, 이번 수정과 다음 아이디어가 섞이기도 해요.", enDetail: "You spot larger possibilities quickly, though the current fix and the next idea can blend together." },
  { key: "challenge", active: true, ko: "첫 답 의심", en: "Challenge", koDetail: "첫 답을 그대로 받지 않고 왜 그런지 되물으며 더 단단한 근거를 끌어내요.", enDetail: "You challenge the first answer and ask for stronger evidence." },
  { key: "feedback", active: true, ko: "반복 피드백", en: "Feedback", koDetail: "결과를 보고 느낀 차이를 바로 알려주며 원하는 상태로 빠르게 수렴시켜요.", enDetail: "You react to the result immediately and converge through feedback." },
  { key: "reframe", active: true, ko: "관점 전환", en: "Reframe", koDetail: "한 해결책에 고정되지 않고 관점을 비틀거나 전체 구조를 다시 봐요.", enDetail: "You reframe the problem instead of staying locked to one solution." },
  { key: "verify", active: true, ko: "실제 확인", en: "Verify", koDetail: "답변에서 멈추지 않고 화면·실행 결과·리로드로 실제 변화를 확인해요.", enDetail: "You verify the real result through the screen, runtime, and reloads." },
  { key: "done", active: false, ko: "완료 기준", en: "Done", koDetail: "만족스러운 상태는 잘 알아보지만 시작 전에 끝나는 조건을 말로 정하는 경우는 적어요.", enDetail: "You recognize a satisfying result well, but rarely define done before starting." },
];

export default function QuestionProfilePreview({ nick }: { nick: string }) {
  const { locale } = useI18n();
  const [selected, setSelected] = useState("material");
  const habit = HABITS.find((item) => item.key === selected) || HABITS[1];
  const label = (item: Habit) => locale === "en" ? item.en : item.ko;
  const detail = locale === "en" ? habit.enDetail : habit.koDetail;

  return (
    <section className="form-profile rise" aria-labelledby="form-profile-title">
      <div className="form-profile-top">
        <div>
          <div className="kicker">{locale === "en" ? "MY RUN · LAST 35 DAYS" : "나의 러닝 · 최근 35일"}</div>
          <h2 id="form-profile-title">
            {locale === "en" ? <>Show it. Challenge it.<br />Verify it.</> : <>보여주고, 의심하고,<br />끝까지 확인하는 러너.</>}
          </h2>
          <p>
            {locale === "en"
              ? `${nick} gets to better answers by sharing the real state, challenging the first response, and iterating until it works.`
              : `${nick}님은 실제 상태를 보여주고 첫 답을 의심하며, 될 때까지 조율해서 더 좋은 답을 끌어내요.`}
          </p>
        </div>
        <div className="form-profile-tags" aria-label={locale === "en" ? "Personal style" : "개인 사용 스타일"}>
          <span>{locale === "en" ? "visual" : "시각형"}</span>
          <span>{locale === "en" ? "skeptical" : "반증형"}</span>
          <span>{locale === "en" ? "iterative" : "반복형"}</span>
        </div>
      </div>

      <div className="form-habits-head">
        <div>
          <div className="kicker">12 UNIVERSAL QUESTION HABITS</div>
          <h3>{locale === "en" ? "How you ask" : "나는 어떻게 질문하고 있을까"}</h3>
        </div>
        <div className="form-habits-count"><strong>7</strong><span>/ 12</span></div>
      </div>

      <div className="form-habits" role="list" aria-label={locale === "en" ? "Question habits" : "질문 습관"}>
        {HABITS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`form-habit${selected === item.key ? " selected" : ""}${item.active ? " active" : ""}`}
            onClick={() => setSelected(item.key)}
            aria-pressed={selected === item.key}
          >
            <i aria-hidden="true">{item.active ? "✓" : ""}</i>
            <span>{label(item)}</span>
          </button>
        ))}
      </div>

      <div className="form-habit-detail" aria-live="polite">
        <span>{habit.active ? (locale === "en" ? "SEEN OFTEN" : "자주 보이는 습관") : (locale === "en" ? "NOT SEEN OFTEN YET" : "아직 잘 보이지 않음")}</span>
        <strong>{label(habit)}</strong>
        <p>{detail}</p>
      </div>

      <div className="form-next">
        <i aria-hidden="true" />
        <div>
          <span>{locale === "en" ? "TURN ON NEXT" : "다음에 켤 습관"}</span>
          <strong>{locale === "en" ? "Define what done looks like." : "어디까지 되면 충분한지 정하기"}</strong>
          <p>{locale === "en" ? "“Keep the existing content. Done when the three essentials fit on the first screen.”" : "“기존 내용은 유지하고, 첫 화면에서 핵심 3개가 보이면 끝.”"}</p>
        </div>
      </div>
    </section>
  );
}
