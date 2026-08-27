CREATE TYPE "ConversationChannel" AS ENUM ('KAKAO', 'WEB_DEMO');
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'CLOSED');
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'QUICK_REPLY', 'SYSTEM', 'STATUS_CARD');
CREATE TYPE "InformationAccessLevel" AS ENUM ('A', 'B', 'C');

CREATE TABLE "conversations" (
  "id" TEXT NOT NULL,
  "household_id" TEXT NOT NULL,
  "contract_cycle_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "channel_identity_link_id" TEXT,
  "channel" "ConversationChannel" NOT NULL,
  "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
  "last_message_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_messages" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "direction" "MessageDirection" NOT NULL,
  "kind" "MessageKind" NOT NULL DEFAULT 'TEXT',
  "body" TEXT NOT NULL,
  "access_level" "InformationAccessLevel" NOT NULL DEFAULT 'A',
  "provider_message_id" TEXT,
  "reply_to_message_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "issues" ADD COLUMN "reporter_message_id" TEXT;

CREATE UNIQUE INDEX "conversations_channel_identity_link_id_key" ON "conversations"("channel_identity_link_id");
CREATE INDEX "conversations_household_id_last_message_at_idx" ON "conversations"("household_id", "last_message_at");
CREATE INDEX "conversations_contract_cycle_id_status_idx" ON "conversations"("contract_cycle_id", "status");
CREATE INDEX "conversations_member_id_last_message_at_idx" ON "conversations"("member_id", "last_message_at");
CREATE UNIQUE INDEX "conversation_messages_conversation_id_provider_message_id_key" ON "conversation_messages"("conversation_id", "provider_message_id");
CREATE INDEX "conversation_messages_conversation_id_created_at_idx" ON "conversation_messages"("conversation_id", "created_at");
CREATE INDEX "conversation_messages_reply_to_message_id_idx" ON "conversation_messages"("reply_to_message_id");
CREATE UNIQUE INDEX "issues_reporter_message_id_key" ON "issues"("reporter_message_id");

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contract_cycle_id_fkey" FOREIGN KEY ("contract_cycle_id") REFERENCES "contract_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_channel_identity_link_id_fkey" FOREIGN KEY ("channel_identity_link_id") REFERENCES "channel_identity_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "conversation_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "issues" ADD CONSTRAINT "issues_reporter_message_id_fkey" FOREIGN KEY ("reporter_message_id") REFERENCES "conversation_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_messages" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "conversations", "conversation_messages" FROM anon, authenticated;
