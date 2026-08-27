import type { PrismaClient } from "@/generated/prisma/client";
import type { CheckinFlowState } from "@/modules/checkin/flow";
import { presentCheckin } from "@/modules/checkin/presentation";
import { checkinTemplateSchema } from "@/modules/checkin/template-schema";

export async function loadCheckinPresentation(prisma: PrismaClient, state: CheckinFlowState) {
  const record = await prisma.checkinTemplate.findUnique({
    where: { id: state.templateId },
    select: { id: true, questions: true },
  });
  if (!record) throw new Error("CHECKIN_TEMPLATE_NOT_FOUND");
  const template = checkinTemplateSchema.parse({ id: record.id, questions: record.questions });
  return presentCheckin(template, state);
}
