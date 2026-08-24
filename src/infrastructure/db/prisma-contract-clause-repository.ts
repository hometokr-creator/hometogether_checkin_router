import type { PrismaClient } from "@/generated/prisma/client";
import type { AgreementStatus, ClassificationResult } from "@/modules/classification/schema";

export type GroundedClause = { id: string; clauseNumber: string; text: string; documentTitle: string; isSynthetic: boolean };

export class PrismaContractClauseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findGrounding(contractCycleId: string, domain: ClassificationResult["domain"], now = new Date()): Promise<{ agreementStatus: AgreementStatus; clause: GroundedClause | null }> {
    const clauses = await this.prisma.contractClause.findMany({
      where: {
        domain,
        status: "ACTIVE",
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        contractDocument: { contractCycleId, status: "ACTIVE", isSynthetic: true },
      },
      select: { id: true, clauseNumber: true, text: true, contractDocument: { select: { title: true, isSynthetic: true } } },
      take: 2,
    });
    if (clauses.length === 0) return { agreementStatus: "NO_CLAUSE", clause: null };
    if (clauses.length > 1) return { agreementStatus: "CONFLICTING_CLAUSES", clause: null };
    const found = clauses[0];
    return { agreementStatus: "CLAUSE_EXISTS", clause: { id: found.id, clauseNumber: found.clauseNumber, text: found.text, documentTitle: found.contractDocument.title, isSynthetic: found.contractDocument.isSynthetic } };
  }
}
