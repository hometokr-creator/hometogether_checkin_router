"use client";

import { type FormEvent, useState } from "react";

type IssuedToken = { token: string; expiresAt: string };
type ApiError = { error?: { message?: string } };

export function ChannelLinkTokenPanel() {
  const [internalApiKey, setInternalApiKey] = useState("");
  // TODO(production-auth): Replace these demo IDs with an authenticated operator
  // member search/selection flow. Member and active contract-cycle IDs must come
  // from the Home Together membership/contract backend, never from operator input.
  const [memberId, setMemberId] = useState("codex-checkin-member-guest-001");
  const [contractCycleId, setContractCycleId] = useState("codex-checkin-cycle-001");
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function issueToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError(""); setIssued(null); setCopied(false);
    try {
      const response = await fetch("/api/channel-links/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Api-Key": internalApiKey },
        body: JSON.stringify({ memberId, contractCycleId }),
      });
      const body: IssuedToken | ApiError = await response.json();
      if (!response.ok || !("token" in body)) throw new Error("error" in body ? body.error?.message : "연결 코드 발급에 실패했습니다.");
      setIssued(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "연결 코드 발급에 실패했습니다.");
    } finally { setPending(false); }
  }

  async function copyToken() {
    if (!issued) return;
    await navigator.clipboard.writeText(`연결코드: ${issued.token}`);
    setCopied(true);
  }

  return <article className="card linkTokenCard">
    <div className="cardHead"><b>카카오 연결 코드</b><small>15분 · 1회 사용</small></div>
    <form onSubmit={issueToken} className="linkTokenForm">
      <label><span>운영자 API 키</span><input type="password" autoComplete="off" required value={internalApiKey} onChange={(event) => setInternalApiKey(event.target.value)} placeholder="INTERNAL_API_KEY" /></label>
      <label><span>회원 ID</span><input required value={memberId} onChange={(event) => setMemberId(event.target.value)} /></label>
      <label><span>계약 회차 ID</span><input required value={contractCycleId} onChange={(event) => setContractCycleId(event.target.value)} /></label>
      <button className="primary" type="submit" disabled={pending}>{pending ? "발급 중…" : "연결 코드 발급"}</button>
    </form>
    {error ? <p className="tokenError" role="alert">{error}</p> : null}
    {issued ? <div className="issuedToken" aria-live="polite"><p>카카오 채팅에 아래 문구를 그대로 보내세요.</p><code>{`연결코드: ${issued.token}`}</code><small>만료: {new Date(issued.expiresAt).toLocaleString("ko-KR")}</small><button className="secondary" type="button" onClick={copyToken}>{copied ? "복사 완료" : "코드 복사"}</button></div> : null}
    <p className="tokenSafety">API 키와 발급 코드는 브라우저에 저장하지 않습니다.</p>
  </article>;
}
