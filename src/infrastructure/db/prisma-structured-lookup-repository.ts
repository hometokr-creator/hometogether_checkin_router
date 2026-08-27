import type { PrismaClient } from "@/generated/prisma/client";
import type { StructuredLookupRepository } from "@/modules/knowledge/structured-lookup";

export class PrismaStructuredLookupRepository implements StructuredLookupRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActiveFinancialTerms(contractCycleId: string, onDate: Date) {
    return this.prisma.contractFinancialTerms.findFirst({
      where: {
        contractCycleId,
        status: "ACTIVE",
        effectiveFrom: { lte: onDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: onDate } }],
      },
      orderBy: { effectiveFrom: "desc" },
      select: {
        id: true,
        monthlyRentKrw: true,
        serviceFeeKrw: true,
        utilityFixedKrw: true,
        regularTotalKrw: true,
        sourceLocator: true,
      },
    });
  }

  async findNextPayment(contractCycleId: string, onDate: Date) {
    const payment = await this.prisma.paymentSchedule.findFirst({
      where: { contractCycleId, status: "SCHEDULED", dueDate: { gte: onDate } },
      orderBy: { dueDate: "asc" },
      select: { id: true, dueDate: true, amountKrw: true },
    });
    if (!payment) return null;
    return { ...payment, sourceLocator: "구조화 납부 일정" };
  }

  async findContractEnd(contractCycleId: string) {
    const cycle = await this.prisma.contractCycle.findUnique({ where: { id: contractCycleId }, select: { endsAt: true } });
    return cycle?.endsAt ?? null;
  }

  async findActiveKnowledge(input: {
    householdId: string;
    contractCycleId: string;
    category: string;
    key?: string;
    onDate: Date;
  }) {
    return this.prisma.knowledgeRecord.findFirst({
      where: {
        householdId: input.householdId,
        contractCycleId: input.contractCycleId,
        category: input.category,
        key: input.key,
        accessLevel: "A",
        status: "ACTIVE",
        effectiveFrom: { lte: input.onDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.onDate } }],
      },
      orderBy: { effectiveFrom: "desc" },
      select: { id: true, answerText: true, sourceLocator: true },
    });
  }
}
