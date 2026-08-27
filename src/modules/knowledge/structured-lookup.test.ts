import { describe, expect, it } from "vitest";
import { detectStructuredLookup } from "./detect-structured-lookup";
import { answerStructuredLookup, type StructuredLookupRepository } from "./structured-lookup";

const repository: StructuredLookupRepository = {
  async findActiveFinancialTerms() {
    return { id: "terms-1", monthlyRentKrw: 450000, serviceFeeKrw: 50000, utilityFixedKrw: 40000, regularTotalKrw: 540000, sourceLocator: "PDF p.5" };
  },
  async findNextPayment() {
    return { id: "payment-1", dueDate: new Date("2026-09-25T00:00:00.000Z"), amountKrw: 540000, sourceLocator: "schedule" };
  },
  async findContractEnd() {
    return new Date("2026-11-29T00:00:00.000Z");
  },
  async findActiveKnowledge(input) {
    return { id: `rule-${input.category}`, answerText: "세탁은 화·목·토 08:00부터 21:00까지 가능합니다.", sourceLocator: "PDF p.6" };
  },
};

const scope = { householdId: "HT-NW-TEST-001", contractCycleId: "CONTRACT-HOMETO-2026-01" };

describe("structured lookup", () => {
  it("detects precise lookup requests without an LLM", () => {
    expect(detectStructuredLookup("내 월세 얼마야?")).toEqual({ type: "MONTHLY_PAYMENT" });
    expect(detectStructuredLookup("다음 납부일은 언제야?")).toEqual({ type: "NEXT_PAYMENT" });
    expect(detectStructuredLookup("세탁 언제 가능해?")).toEqual({ type: "KNOWLEDGE", category: "laundry", key: "allowed_window" });
    expect(detectStructuredLookup("주방에서 어디 써?")).toEqual({ type: "KNOWLEDGE", category: "storage", key: "kitchen" });
  });

  it("formats monthly payment from validated numeric fields", async () => {
    const answer = await answerStructuredLookup({ type: "MONTHLY_PAYMENT" }, scope, repository);
    expect(answer?.text).toContain("월세는 450,000원");
    expect(answer?.text).toContain("총 540,000원");
    expect(answer?.sourceRecordIds).toEqual(["terms-1"]);
  });

  it("formats the next payment and contract end dates deterministically", async () => {
    const payment = await answerStructuredLookup({ type: "NEXT_PAYMENT" }, scope, repository);
    const contract = await answerStructuredLookup({ type: "CONTRACT_END" }, scope, repository);
    expect(payment?.text).toBe("다음 납부일은 2026년 9월 25일이며, 납부 예정액은 540,000원입니다.");
    expect(contract?.text).toBe("현재 계약 종료일은 2026년 11월 29일입니다.");
  });

  it("rejects inconsistent financial totals instead of answering", async () => {
    const inconsistent: StructuredLookupRepository = {
      ...repository,
      async findActiveFinancialTerms() {
        return { id: "bad", monthlyRentKrw: 450000, serviceFeeKrw: 50000, utilityFixedKrw: 40000, regularTotalKrw: 530000, sourceLocator: "bad" };
      },
    };
    await expect(answerStructuredLookup({ type: "MONTHLY_PAYMENT" }, scope, inconsistent)).rejects.toThrow("FINANCIAL_TERMS_TOTAL_MISMATCH");
  });
});
