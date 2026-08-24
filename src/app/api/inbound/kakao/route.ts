import { getPrisma } from "@/infrastructure/db/client";
import { PrismaLinkingTokenRepository } from "@/infrastructure/db/prisma-linking-token-repository";
import { consumeLinkingToken, hashSecret } from "@/modules/kakao/linking-token";
import {
  extractLinkingToken,
  getKakaoProviderUserKey,
  kakaoSimpleText,
  kakaoSkillPayloadSchema,
} from "@/modules/kakao/skill";

const LINK_REQUIRED_MESSAGE =
  "가구별 계약·생활규칙을 확인하려면 홈투게더 회원 연결이 필요해요. 담당자가 보내드린 연결 안내를 이용해 주세요.";
const HUMAN_REVIEW_MESSAGE =
  "말씀해 주신 내용을 접수했어요. 현재는 담당자 확인 후 안내드리고 있습니다.";
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
      if (result.outcome === "LINKED") return Response.json(kakaoSimpleText(LINKED_MESSAGE));
      if (result.outcome === "ALREADY_USED") return Response.json(kakaoSimpleText(USED_TOKEN_MESSAGE));
      if (result.outcome === "CONFLICT") return Response.json(kakaoSimpleText(CONFLICT_TOKEN_MESSAGE));
      return Response.json(kakaoSimpleText(INVALID_TOKEN_MESSAGE));
    }

    const providerUserKeyHash = hashSecret(providerUserKey, pepper);
    const link = await prisma.channelIdentityLink.findFirst({
      where: {
        provider: "KAKAO",
        providerUserKeyHash,
        status: "ACTIVE",
        contractCycle: { status: "ACTIVE" },
      },
      select: { id: true, householdId: true, memberId: true, contractCycleId: true },
    });

    if (!link) return Response.json(kakaoSimpleText(LINK_REQUIRED_MESSAGE));

    await prisma.auditLog.create({
      data: {
        event: "KAKAO_INBOUND_RECEIVED",
        householdId: link.householdId,
        entityType: "ChannelIdentityLink",
        entityId: link.id,
        payload: {
          memberId: link.memberId,
          contractCycleId: link.contractCycleId,
          botId: payload.data.bot?.id ?? null,
          blockId: payload.data.userRequest.block?.id ?? null,
          utteranceLength: payload.data.userRequest.utterance.length,
          delivery: "BLOCKED_HUMAN_REVIEW",
        },
      },
    });

    return Response.json(kakaoSimpleText(HUMAN_REVIEW_MESSAGE));
  } catch (error) {
    console.error("KAKAO_INBOUND_FAILED", {
      error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    });
    return Response.json(kakaoSimpleText(TEMPORARY_ERROR_MESSAGE));
  }
}
