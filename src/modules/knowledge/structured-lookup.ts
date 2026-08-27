export type StructuredLookupRequest =
  | { type: "MONTHLY_PAYMENT" }
  | { type: "NEXT_PAYMENT" }
  | { type: "CONTRACT_END" }
  | { type: "KNOWLEDGE"; category: string; key?: string };

export type FinancialTerms = {
  id: string;
  monthlyRentKrw: number;
  serviceFeeKrw: number;
  utilityFixedKrw: number;
  regularTotalKrw: number;
  sourceLocator: string;
};

export type PaymentDue = {
  id: string;
  dueDate: Date;
  amountKrw: number;
  sourceLocator: string;
};

export type KnowledgeAnswer = {
  id: string;
  answerText: string;
  sourceLocator: string;
};

export interface StructuredLookupRepository {
  findActiveFinancialTerms(contractCycleId: string, onDate: Date): Promise<FinancialTerms | null>;
  findNextPayment(contractCycleId: string, onDate: Date): Promise<PaymentDue | null>;
  findContractEnd(contractCycleId: string): Promise<Date | null>;
  findActiveKnowledge(input: {
    householdId: string;
    contractCycleId: string;
    category: string;
    key?: string;
    onDate: Date;
  }): Promise<KnowledgeAnswer | null>;
}

export type StructuredLookupScope = { householdId: string; contractCycleId: string };
export type StructuredLookupAnswer = { text: string; sourceRecordIds: string[]; sourceLocators: string[] };

const won = new Intl.NumberFormat("ko-KR");

function formatDate(date: Date) {
  return `${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`;
}

export async function answerStructuredLookup(
  request: StructuredLookupRequest,
  scope: StructuredLookupScope,
  repository: StructuredLookupRepository,
  now = new Date(),
): Promise<StructuredLookupAnswer | null> {
  if (request.type === "MONTHLY_PAYMENT") {
    const terms = await repository.findActiveFinancialTerms(scope.contractCycleId, now);
    if (!terms) return null;
    const calculatedTotal = terms.monthlyRentKrw + terms.serviceFeeKrw + terms.utilityFixedKrw;
    if (calculatedTotal !== terms.regularTotalKrw) throw new Error("FINANCIAL_TERMS_TOTAL_MISMATCH");
    return {
      text: `월세는 ${won.format(terms.monthlyRentKrw)}원입니다. 관리 수수료 ${won.format(terms.serviceFeeKrw)}원과 고정 공과금 ${won.format(terms.utilityFixedKrw)}원을 포함한 월 정기 납부액은 총 ${won.format(terms.regularTotalKrw)}원입니다.`,
      sourceRecordIds: [terms.id],
      sourceLocators: [terms.sourceLocator],
    };
  }

  if (request.type === "NEXT_PAYMENT") {
    const payment = await repository.findNextPayment(scope.contractCycleId, now);
    if (!payment) return null;
    return {
      text: `다음 납부일은 ${formatDate(payment.dueDate)}이며, 납부 예정액은 ${won.format(payment.amountKrw)}원입니다.`,
      sourceRecordIds: [payment.id],
      sourceLocators: [payment.sourceLocator],
    };
  }

  if (request.type === "CONTRACT_END") {
    const end = await repository.findContractEnd(scope.contractCycleId);
    if (!end) return null;
    return { text: `현재 계약 종료일은 ${formatDate(end)}입니다.`, sourceRecordIds: [], sourceLocators: [] };
  }

  const knowledge = await repository.findActiveKnowledge({ ...scope, category: request.category, key: request.key, onDate: now });
  if (!knowledge) return null;
  return {
    text: knowledge.answerText,
    sourceRecordIds: [knowledge.id],
    sourceLocators: [knowledge.sourceLocator],
  };
}
