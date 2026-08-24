import type { ContractStatus, PrismaClient } from "@/generated/prisma/client";

type CanonicalMatch = {
  id: string; home_id: string; host_id: string; guest_id: string; status: string;
  move_in_date: Date; move_out_date: Date | null; contract_end_date: Date | null;
  home_active: boolean; host_active: boolean; guest_active: boolean;
};

export function mapCanonicalMatchStatus(status: string): ContractStatus | null {
  if (status === "ACTIVE" || status === "MOVE_OUT_SCHEDULED") return "ACTIVE";
  if (status === "PENDING") return "PENDING";
  if (status === "ENDED") return "ENDED";
  if (status === "CANCELLED") return "CANCELLED";
  return null;
}

export async function syncCanonicalMatch(prisma: PrismaClient, matchId: string) {
  const rows = await prisma.$queryRaw<CanonicalMatch[]>`
    select m.id, m.home_id, m.host_id, m.guest_id, m.status,
           m.move_in_date, m.move_out_date, m.contract_end_date,
           h.is_active as home_active,
           hp.is_active as host_active,
           gp.is_active as guest_active
    from public.matches m
    join public.homes h on h.id = m.home_id
    join public.profiles hp on hp.id = m.host_id and hp.profile_type = 'HOST'
    join public.profiles gp on gp.id = m.guest_id and gp.profile_type = 'GUEST'
    where m.id = ${matchId}::uuid
    limit 1
  `;
  const source = rows[0];
  const status = source ? mapCanonicalMatchStatus(source.status) : null;
  if (!source || !status || !source.home_active || !source.host_active || !source.guest_active) return null;

  return prisma.$transaction(async (tx) => {
    const household = await tx.household.upsert({
      where: { canonicalHomeId: source.home_id },
      update: {},
      create: { id: source.home_id, canonicalHomeId: source.home_id },
    });
    const cycle = await tx.contractCycle.upsert({
      where: { canonicalMatchId: source.id },
      update: { householdId: household.id, status, startsAt: source.move_in_date, endsAt: source.move_out_date ?? source.contract_end_date },
      create: { id: source.id, canonicalMatchId: source.id, householdId: household.id, status, startsAt: source.move_in_date, endsAt: source.move_out_date ?? source.contract_end_date },
    });
    const members = await Promise.all([
      tx.member.upsert({
        where: { canonicalProfileId_householdId: { canonicalProfileId: source.host_id, householdId: household.id } },
        update: { role: "HOST" },
        create: { id: `${source.id}:${source.host_id}`, canonicalProfileId: source.host_id, householdId: household.id, role: "HOST" },
      }),
      tx.member.upsert({
        where: { canonicalProfileId_householdId: { canonicalProfileId: source.guest_id, householdId: household.id } },
        update: { role: "GUEST" },
        create: { id: `${source.id}:${source.guest_id}`, canonicalProfileId: source.guest_id, householdId: household.id, role: "GUEST" },
      }),
    ]);
    await tx.auditLog.create({ data: { event: "CANONICAL_MATCH_SYNCED", householdId: household.id, entityType: "ContractCycle", entityId: cycle.id, payload: { canonicalMatchId: source.id, memberIds: members.map((member) => member.id) } } });
    return { householdId: household.id, contractCycleId: cycle.id, memberIds: members.map((member) => member.id), status };
  });
}
