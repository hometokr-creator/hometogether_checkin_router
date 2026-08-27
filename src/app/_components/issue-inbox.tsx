"use client";

import { useState } from "react";
import { ChannelLinkTokenPanel } from "./channel-link-token-panel";

type Issue = {
  id: string; householdId: string; memberId: string | null; memberRole: string | null;
  status: string; route: "A" | "B" | "C"; intent: string; domain: string; severity: string; urgency: string;
  classification: Record<string, unknown>; utterance: unknown; openedAt: string;
  ticket: { id: string; status: string; queue: string; dueAt: string } | null;
  modelRun: { status: string; model: string | null; latencyMs: number | null } | null;
};

const statuses = ["REPORTED", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "FOLLOWUP", "CLOSED", "REOPENED"];
const routeLabel = { A: "자동 근거 답변", B: "운영자 확인", C: "파트너 처리" };

export function IssueInbox() {
  const [apiKey, setApiKey] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const selected = issues.find((issue) => issue.id === selectedId) ?? issues[0] ?? null;

  async function loadIssues() {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/issues", { headers: { "X-Internal-Api-Key": apiKey }, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "문의 목록을 불러오지 못했습니다.");
      setIssues(body.issues); setSelectedId((current) => current ?? body.issues[0]?.id ?? null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "문의 목록을 불러오지 못했습니다."); }
    finally { setPending(false); }
  }

  async function updateStatus(status: string) {
    if (!selected) return;
    setPending(true); setError("");
    try {
      const response = await fetch("/api/issues", { method: "PATCH", headers: { "Content-Type": "application/json", "X-Internal-Api-Key": apiKey }, body: JSON.stringify({ issueId: selected.id, status }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "상태를 변경하지 못했습니다.");
      setIssues((items) => items.map((item) => item.id === selected.id ? { ...item, status: body.status } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "상태를 변경하지 못했습니다."); }
    finally { setPending(false); }
  }

  return <div className="shell inboxShell">
    <aside className="sidebar"><div className="brand"><span>HT</span><b>HOME<br />TOGETHER</b></div><p className="sideLabel">OPERATIONS</p><nav><button className="active">⌁　이슈 큐<i>{issues.length}</i></button><button>▣　정기 체크인</button><button>≡　가구 원장</button></nav><div className="safety"><em /><p><b>Human review on</b><small>운영자 승인 기반 처리</small></p></div></aside>
    <main><header><p><span>거주 라우터　/　</span><b>운영자 문의함</b></p><em>LIVE · SUPABASE</em></header>
      <section className="inboxAuth"><div><h1>카카오 문의함</h1><p>실제 접수된 문의와 AI·라우팅 결과를 확인합니다.</p></div><div className="authControls"><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="INTERNAL_API_KEY" /><button className="primary" disabled={!apiKey || pending} onClick={loadIssues}>{pending ? "처리 중…" : "문의 불러오기"}</button></div></section>
      {error ? <p className="inboxError" role="alert">{error}</p> : null}
      <section className="inboxGrid">
        <div className="issueList card"><div className="cardHead"><b>최근 문의</b><small>{issues.length} ISSUES</small></div>{issues.length === 0 ? <p className="emptyState">운영자 API 키를 입력하고 문의를 불러오세요.</p> : issues.map((issue) => <button key={issue.id} className={selected?.id === issue.id ? "issueRow selected" : "issueRow"} onClick={() => setSelectedId(issue.id)}><span className={`routeBadge route${issue.route}`}>{issue.route}</span><span><b>{typeof issue.utterance === "string" ? issue.utterance : `${issue.domain} 문의`}</b><small>{issue.householdId} · {new Date(issue.openedAt).toLocaleString("ko-KR")}</small></span><em>{issue.status}</em></button>)}</div>
        <div className="issueDetail">{selected ? <>
          <article className="card detailHero"><div><p className="kicker">ISSUE / {selected.id}</p><h2>{typeof selected.utterance === "string" ? selected.utterance : "원문을 확인할 수 없습니다."}</h2><p>{selected.householdId} · {selected.memberRole ?? "UNKNOWN"}</p></div><span className={`routeBadge route${selected.route}`}>{selected.route}</span></article>
          <article className="card"><div className="cardHead"><b>라우팅 및 분류</b><small>{routeLabel[selected.route]}</small></div><div className="detailStats"><div><small>상태</small><b>{selected.status}</b></div><div><small>영역</small><b>{selected.domain}</b></div><div><small>의도</small><b>{selected.intent}</b></div><div><small>위험도</small><b>{selected.severity}</b></div><div><small>긴급도</small><b>{selected.urgency}</b></div><div><small>처리 큐</small><b>{selected.ticket?.queue ?? "자동 답변"}</b></div></div></article>
          <article className="card"><div className="cardHead"><b>AI 실행</b><small>{selected.modelRun?.status ?? "RULES FAST PATH"}</small></div><div className="runSummary"><p><small>모델</small><b>{selected.modelRun?.model ?? "규칙 분류기"}</b></p><p><small>응답 시간</small><b>{selected.modelRun?.latencyMs != null ? `${selected.modelRun.latencyMs}ms` : "즉시"}</b></p></div></article>
          <article className="card"><div className="cardHead"><b>처리 상태 변경</b><small>감사 로그 자동 기록</small></div><div className="statusActions">{statuses.map((status) => <button key={status} disabled={pending || selected.status === status} className={selected.status === status ? "primary" : "secondary"} onClick={() => updateStatus(status)}>{status}</button>)}</div></article>
        </> : <article className="card emptyState">선택된 문의가 없습니다.</article>}</div>
        <aside className="inboxTools"><ChannelLinkTokenPanel /></aside>
      </section>
    </main>
  </div>;
}
