import type { RoutingDecision } from "@/modules/routing/decide-route";

export function shouldOpenIssue(decision: RoutingDecision) {
  return decision.route !== "A";
}
