import type { IdentityStatus } from "./schema";
export type InboundAccess = "HOUSEHOLD_LEDGER" | "PUBLIC_FAQ_ONLY" | "HUMAN_REVIEW";
export function decideInboundAccess(status: IdentityStatus): InboundAccess {
  if (status === "LINKED") return "HOUSEHOLD_LEDGER";
  if (status === "UNLINKED") return "PUBLIC_FAQ_ONLY";
  return "HUMAN_REVIEW";
}
