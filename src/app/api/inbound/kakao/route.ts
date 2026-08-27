import { getPrisma } from "@/infrastructure/db/client";
import { PrismaLinkingTokenRepository } from "@/infrastructure/db/prisma-linking-token-repository";
import { PrismaInboundRepository } from "@/infrastructure/db/prisma-inbound-repository";
import { PrismaFacilityTriageService } from "@/infrastructure/db/prisma-facility-triage-service";
import { PrismaKakaoDemoLinkService } from "@/infrastructure/db/prisma-kakao-demo-link-service";
import { PrismaKakaoCheckinService } from "@/infrastructure/db/prisma-kakao-checkin-service";
import { PrismaStructuredLookupRepository } from "@/infrastructure/db/prisma-structured-lookup-repository";
import { consumeLinkingToken, hashSecret } from "@/modules/kakao/linking-token";
import { detectStructuredLookup } from "@/modules/knowledge/detect-structured-lookup";
import { answerStructuredLookup } from "@/modules/knowledge/structured-lookup";
import { classifyStructuredLookup } from "@/modules/knowledge/structured-lookup-classification";
import { interpretConversationWithFallback } from "@/modules/orchestration/interpret-conversation-with-fallback";
import { toLegacyClassification } from "@/modules/orchestration/legacy-adapter";
import { buildActionResponse } from "@/modules/orchestration/response-copy";
import { decideAction } from "@/modules/policy/decide-action";
import { decideMessageAccess } from "@/modules/policy/message-access";
import { safetyPrecheck } from "@/modules/orchestration/safety-precheck";
import { kakaoFacilityTriageMessage } from "@/modules/facility/kakao-message";
import { canUseKakaoDemoAlias } from "@/modules/kakao/demo-alias";
import { kakaoLinkedMenuMessage, kakaoSelectedMenuMessage } from "@/modules/kakao/menu-message";
import { isKakaoCheckinStart, isKakaoMainMenuStart } from "@/modules/kakao/commands";
import { kakaoCheckinFlowMessage } from "@/modules/checkin/kakao-flow-message";
import {
  extractLinkingToken,
  getKakaoProviderUserKey,
  kakaoSimpleText,
  kakaoSkillPayloadSchema,
} from "@/modules/kakao/skill";

const LINK_REQUIRED_MESSAGE =
  "가구별 계약·생활규칙을 확인하려면 홈투게더 회원 연결이 필요해요. 담당자가 보내드린 연결 안내를 이용해 주세요.";
const TEMPORARY_ERROR_MESSAGE =
  "지금 바로 확인할 수 있는 정보가 부족해 담당자에게 넘겼어요. 확인되는 대로 안내드릴게요.";
const LINKED_MESSAGE =
  "홈투게더 회원 연결이 완료됐어요. 이제 이 채팅에서 가구별 계약·생활 문의를 남길 수 있어요.";
const INVALID_TOKEN_MESSAGE =
  "연결 코드가 만료되었거나 올바르지 않아요. 담당자에게 새 연결 코드를 요청해 주세요.";
const USED_TOKEN_MESSAGE =
  "이미 사용된 연결 코드예요. 연결이 되지 않았다면 담당자에게 새 코드를 요청해 주세요.";
const CONFLICT_TOKEN_MESSAGE =
  "이 카카오 계정에는 다른 회원 연결 정보가 있어 자동으로 연결할 수 없어요. 담당자에게 확인을 요청해 주세요.";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const payload = kakaoSkillPayloadSchema.safeParse(body);
  if (!payload.success) {
    console.warn("KAKAO_PAYLOAD_REJECTED", {
      issuePaths: payload.error.issues.map((issue) => issue.path.join(".")).slice(0, 10),
    });
    return Response.json(kakaoSimpleText("요청 형식을 확인할 수 없어요. 잠시 후 다시 말씀해 주세요."));
  }

  try {
    const pepper = process.env.PROVIDER_USER_KEY_PEPPER ?? "";
    const providerUserKey = getKakaoProviderUserKey(payload.data);
    const token = extractLinkingToken(payload.data.userRequest.utterance);
    const prisma = getPrisma();

    if (token) {
      const result = await consumeLinkingToken(
        { token, providerUserKey, pepper },
        new PrismaLinkingTokenRepository(prisma),
      );
      console.info("KAKAO_LINK_ATTEMPT", { outcome: result.outcome });
      if (result.outcome === "LINKED") return Response.json(kakaoSimpleText(LINKED_MESSAGE));
      if (result.outcome === "ALREADY_USED") return Response.json(kakaoSimpleText(USED_TOKEN_MESSAGE));
      if (result.outcome === "CONFLICT") return Response.json(kakaoSimpleText(CONFLICT_TOKEN_MESSAGE));
      return Response.json(kakaoSimpleText(INVALID_TOKEN_MESSAGE));
    }

    const providerUserKeyHash = hashSecret(providerUserKey, pepper);
    const utterance = payload.data.userRequest.utterance;
    if (canUseKakaoDemoAlias({
      utterance,
      botId: payload.data.bot?.id,
      enabled: process.env.KAKAO_DEMO_MODE,
      allowedBotIds: process.env.KAKAO_DEMO_BOT_IDS,
    })) {
      const result = await new PrismaKakaoDemoLinkService(prisma).link({ providerUserKeyHash, utterance });
      if (result.outcome === "CONFLICT") return Response.json(kakaoSimpleText(CONFLICT_TOKEN_MESSAGE));
      return Response.json(kakaoLinkedMenuMessage());
    }

    const link = await prisma.channelIdentityLink.findFirst({
      where: {
        provider: "KAKAO",
        providerUserKeyHash,
        status: "ACTIVE",
        contractCycle: { status: "ACTIVE" },
      },
      select: { id: true, householdId: true, memberId: true, contractCycleId: true },
    });

    if (!link) {
      const utterance = payload.data.userRequest.utterance;
      const normalizedUtterance = utterance.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").trim();
      const diagnostic = {
        tokenDetected: false,
        utteranceLength: utterance.length,
        normalizedLength: normalizedUtterance.length,
        containsLinkLabel: /연결\s*(?:코드|토큰)/i.test(normalizedUtterance),
        containsTokenShapedText: /(?:^|[^A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/.test(normalizedUtterance),
        blockId: payload.data.userRequest.block?.id ?? null,
        actionId: payload.data.action?.id ?? null,
        userType: payload.data.userRequest.user.type ?? null,
        hasChannelUserKey: Boolean(payload.data.userRequest.user.properties?.plusfriendUserKey),
      };
      console.info("KAKAO_LINK_REQUIRED", diagnostic);
      await prisma.auditLog.create({
        data: {
          event: "KAKAO_UNLINKED_DIAGNOSTIC",
          entityType: "KakaoRequest",
          entityId: payload.data.userRequest.block?.id ?? "UNRESOLVED",
          payload: diagnostic,
        },
      });
      return Response.json(kakaoSimpleText(LINK_REQUIRED_MESSAGE));
    }

    if (isKakaoMainMenuStart(payload.data)) {
      return Response.json(kakaoLinkedMenuMessage());
    }

    const selectedMenu = kakaoSelectedMenuMessage(utterance);
    if (selectedMenu) return Response.json(selectedMenu);

    const facilityService = new PrismaFacilityTriageService(prisma);
    const checkinService = new PrismaKakaoCheckinService(prisma);
    const safety = safetyPrecheck(utterance);

    if (!safety) {
      const activeCheckin = await checkinService.consumeActiveReply({
        householdId: link.householdId,
        contractCycleId: link.contractCycleId,
        memberId: link.memberId,
        channelIdentityLinkId: link.id,
        utterance,
      });
      if (activeCheckin) return Response.json(kakaoCheckinFlowMessage({ checkin: activeCheckin.checkin, correction: activeCheckin.correction }));

      const activeFacilityFlow = await facilityService.consumeActiveReply({
        householdId: link.householdId,
        contractCycleId: link.contractCycleId,
        memberId: link.memberId,
        channelIdentityLinkId: link.id,
        utterance,
      });
      if (activeFacilityFlow) return Response.json(kakaoFacilityTriageMessage(activeFacilityFlow.presentation));
    }

    if (!safety && isKakaoCheckinStart(payload.data)) {
      try {
        const started = await checkinService.start({
          householdId: link.householdId,
          contractCycleId: link.contractCycleId,
          memberId: link.memberId,
          channelIdentityLinkId: link.id,
        });
        return Response.json(kakaoCheckinFlowMessage({ checkin: started.checkin, prefix: "김하늘님, 입주 3일차 체크인을 시작할게요." }));
      } catch (error) {
        if (error instanceof Error && error.message === "ACTIVE_FLOW_CONFLICT") {
          return Response.json(kakaoSimpleText("이미 진행 중인 확인 절차가 있어요. 먼저 현재 질문에 답해 주세요."));
        }
        if (error instanceof Error && error.message === "CHECKIN_SCHEDULE_NOT_FOUND") {
          return Response.json(kakaoSimpleText("현재 진행할 수 있는 정기 체크인 일정이 없어요."));
        }
        throw error;
      }
    }

    const structuredRequest = safety ? null : detectStructuredLookup(utterance);
    if (structuredRequest) {
      const structuredAnswer = await answerStructuredLookup(
        structuredRequest,
        { householdId: link.householdId, contractCycleId: link.contractCycleId },
        new PrismaStructuredLookupRepository(prisma),
      );
      if (structuredAnswer) {
        const classification = classifyStructuredLookup(structuredRequest);
        await new PrismaInboundRepository(prisma).record({
          householdId: link.householdId,
          contractCycleId: link.contractCycleId,
          memberId: link.memberId,
          channelIdentityLinkId: link.id,
          utterance,
          classification,
          decision: { route: "A", reasonCodes: ["STRUCTURED_LOOKUP"], immediateAlert: false },
          sourceClauseIds: structuredAnswer.sourceRecordIds,
          classificationSource: "RULES",
        });
        return Response.json(kakaoSimpleText(structuredAnswer.text));
      }
    }

    const routed = safety
      ? { interpretation: safety, source: "RULES" as const, modelRun: null }
      : await interpretConversationWithFallback(utterance);
    const { interpretation, source: classificationSource, modelRun } = routed;
    const decision = decideAction(interpretation);
    const classification = toLegacyClassification(interpretation);

    if (decision.action === "START_FACILITY_TRIAGE") {
      try {
        const result = await facilityService.start({
          householdId: link.householdId,
          contractCycleId: link.contractCycleId,
          memberId: link.memberId,
          channelIdentityLinkId: link.id,
          utterance,
        });
        if (modelRun) await prisma.modelRun.create({ data: modelRun });
        return Response.json(kakaoFacilityTriageMessage(result.presentation));
      } catch (error) {
        if (error instanceof Error && error.message === "ACTIVE_FLOW_CONFLICT") {
          return Response.json(kakaoSimpleText("이미 진행 중인 확인 절차가 있어요. 먼저 현재 질문에 답하거나 담당자에게 취소를 요청해 주세요."));
        }
        throw error;
      }
    }

    if (decision.action === "EMERGENCY_GUIDANCE") {
      await Promise.all([
        facilityService.cancelActiveForEmergency({ householdId: link.householdId, contractCycleId: link.contractCycleId, memberId: link.memberId }),
        checkinService.cancelActiveForEmergency({ householdId: link.householdId, contractCycleId: link.contractCycleId, memberId: link.memberId }),
      ]);
    }
    const noIssueEventType = decision.action === "ANSWER"
      ? "SMALL_TALK_ANSWERED"
      : decision.action === "CLARIFY"
        ? "CLARIFICATION_REQUESTED"
        : decision.action === "RECORD"
          ? "SCHEDULE_RECORD_REQUESTED"
          : "LOOKUP_SERVED";
    await new PrismaInboundRepository(prisma).record({
      householdId: link.householdId,
      contractCycleId: link.contractCycleId,
      memberId: link.memberId,
      channelIdentityLinkId: link.id,
      utterance,
      classification,
      decision,
      sourceClauseIds: [],
      classificationSource,
      modelRun,
      openIssue: decision.openIssue,
      noIssueEventType,
      messageAccessLevel: decideMessageAccess(interpretation),
    });

    return Response.json(kakaoSimpleText(buildActionResponse(interpretation, decision)));
  } catch (error) {
    console.error("KAKAO_INBOUND_FAILED", {
      error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    });
    return Response.json(kakaoSimpleText(TEMPORARY_ERROR_MESSAGE));
  }
}
