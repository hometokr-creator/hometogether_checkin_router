import { describe, expect, it } from "vitest";
import { interpretConversationDeterministically } from "@/modules/orchestration/interpret-conversation";
import { decideMessageAccess } from "./message-access";

describe("message access policy", () => {
  it("keeps ordinary messages at A", () => {
    expect(decideMessageAccess(interpretConversationDeterministically("안녕하세요"))).toBe("A");
  });

  it.each(["허락 없이 제 방에 들어왔어요", "지금 죽고 싶어요", "계속 소음 때문에 잠을 못 자요"])("restricts sensitive S2/S3 text: %s", (utterance) => {
    expect(decideMessageAccess(interpretConversationDeterministically(utterance))).toBe("C");
  });
});
