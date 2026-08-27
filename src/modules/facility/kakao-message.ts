import type { FacilityTriagePresentation } from "./presentation";

export function kakaoFacilityTriageMessage(presentation: FacilityTriagePresentation) {
  return {
    version: "2.0" as const,
    template: {
      outputs: [{ simpleText: { text: presentation.text } }],
      ...(presentation.choices.length > 0
        ? { quickReplies: presentation.choices.map((choice) => ({ label: choice.label, action: "message" as const, messageText: choice.value })) }
        : {}),
    },
  };
}
