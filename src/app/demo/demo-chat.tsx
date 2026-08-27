"use client";

import { FormEvent, useState } from "react";
import styles from "./demo.module.css";

type Question = {
  key: string;
  type: "SINGLE_CHOICE" | "FREE_TEXT";
  prompt: string;
  options?: Array<{ value: string; label: string }>;
};

type Checkin = {
  status: "WAITING_USER" | "COMPLETED";
  version: number;
  step: number;
  totalSteps: number;
  disposition: "OK" | "NEEDS_CLASSIFICATION" | "NEEDS_REVIEW" | "EMERGENCY";
  question: Question | null;
};

type ChatMessage = { id: number; side: "bot" | "user"; text: string };

const completionCopy: Record<Checkin["disposition"], string> = {
  OK: "체크인이 완료됐어요. 초기 적응 상태를 양호로 기록했습니다.",
  NEEDS_CLASSIFICATION: "체크인이 완료됐어요. 남겨주신 내용을 확인해 필요한 도움의 종류를 정리하겠습니다.",
  NEEDS_REVIEW: "체크인이 완료됐어요. 불편 사항은 운영팀 검토 대상으로 기록했습니다.",
  EMERGENCY: "안전 관련 응답을 확인했어요. 즉시 위험하다면 안전한 장소로 이동하고 112 또는 119에 연락해 주세요.",
};

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "요청을 처리하지 못했습니다.");
  return data;
}

export function DemoChat() {
  const [alias, setAlias] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [checkin, setCheckin] = useState<Checkin | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [freeText, setFreeText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMessage = (side: ChatMessage["side"], text: string) => {
    setMessages((current) => [...current, { id: Date.now() + current.length, side, text }]);
  };

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await postJson("/api/demo/sessions", { alias });
      setLoggedIn(true);
      setMessages([{ id: 1, side: "bot", text: "안녕하세요, 김하늘님. 입주 3일차예요. 새 집에서 지내는 건 어떠신지 짧게 확인해 볼게요." }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "로그인하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function startCheckin() {
    setPending(true);
    setError(null);
    try {
      const data = await postJson<{ flowId: string; checkin: Checkin }>("/api/demo/checkin/start");
      setFlowId(data.flowId);
      setCheckin(data.checkin);
      if (data.checkin.question) addMessage("bot", data.checkin.question.prompt);
      else addMessage("bot", completionCopy[data.checkin.disposition]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "체크인을 시작하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function reply(value: string, label = value) {
    if (!flowId || !checkin?.question || pending) return;
    const activeQuestion = checkin.question;
    setPending(true);
    setError(null);
    addMessage("user", label);
    try {
      const data = await postJson<{ flowId: string; checkin: Checkin }>("/api/demo/checkin/reply", {
        flowId,
        version: checkin.version,
        questionKey: activeQuestion.key,
        value,
      });
      setCheckin(data.checkin);
      if (data.checkin.question) addMessage("bot", data.checkin.question.prompt);
      else addMessage("bot", completionCopy[data.checkin.disposition]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "답변을 저장하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  function submitFreeText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = freeText.trim();
    if (!value) return;
    setFreeText("");
    void reply(value);
  }

  return (
    <section className={styles.phone} aria-label="HOMETO 체크인 데모">
      <header className={styles.phoneHeader}>
        <span className={styles.logo}>H</span>
        <div><strong>홈투게더 케어</strong><small>거주 지원 챗봇</small></div>
        <span className={styles.online}>운영 중</span>
      </header>

      {!loggedIn ? (
        <div className={styles.loginPanel}>
          <div className={styles.loginIcon}>H</div>
          <h2>테스트 게스트로 시작</h2>
          <p>데모 별칭을 입력하면 김하늘님의 입주 3일차 체크인을 체험할 수 있어요.</p>
          <form onSubmit={login}>
            <label htmlFor="demo-alias">테스트 별칭</label>
            <input id="demo-alias" value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="HOMETO" autoComplete="off" />
            <button disabled={pending}>{pending ? "확인 중…" : "데모 입장"}</button>
          </form>
          <small>힌트: HOMETO</small>
        </div>
      ) : (
        <>
          <div className={styles.profileBar}>
            <div><b>김하늘</b><span>게스트 · 정상 거주 중</span></div>
            <span>입주 3일차</span>
          </div>
          <div className={styles.chat} aria-live="polite">
            <div className={styles.day}>2026년 6월 2일</div>
            {messages.map((message) => (
              <div key={message.id} className={message.side === "bot" ? styles.botRow : styles.userRow}>
                {message.side === "bot" && <span className={styles.avatar}>H</span>}
                <p>{message.text}</p>
              </div>
            ))}
            {!flowId && (
              <button className={styles.startButton} onClick={startCheckin} disabled={pending}>
                {pending ? "불러오는 중…" : "정기 체크인 시작"}
              </button>
            )}
          </div>

          {checkin?.status === "WAITING_USER" && checkin.question && (
            <div className={styles.composer}>
              <div className={styles.progress}>
                <span style={{ width: `${(checkin.step / checkin.totalSteps) * 100}%` }} />
                <small>{checkin.step} / {checkin.totalSteps}</small>
              </div>
              {checkin.question.type === "SINGLE_CHOICE" ? (
                <div className={styles.choices}>
                  {checkin.question.options?.map((option) => (
                    <button key={option.value} onClick={() => void reply(option.value, option.label)} disabled={pending}>{option.label}</button>
                  ))}
                </div>
              ) : (
                <form className={styles.textForm} onSubmit={submitFreeText}>
                  <label htmlFor="checkin-free-text">자유 답변</label>
                  <textarea id="checkin-free-text" value={freeText} onChange={(event) => setFreeText(event.target.value)} maxLength={2000} placeholder="내용을 입력해 주세요" disabled={pending} />
                  <button disabled={pending || !freeText.trim()}>{pending ? "저장 중…" : "답변 보내기"}</button>
                </form>
              )}
            </div>
          )}
        </>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}
