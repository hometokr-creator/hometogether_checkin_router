CREATE TYPE "MemberRole" AS ENUM ('GUEST', 'HOST');
CREATE TYPE "ContractStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "IdentityLinkStatus" AS ENUM ('ACTIVE', 'REVOKED', 'CONFLICT');
CREATE TYPE "KakaoReachability" AS ENUM ('NOT_LINKED', 'LINKED_NOT_FRIEND', 'FRIEND_ACTIVE', 'BLOCKED', 'DELIVERY_FAILED', 'UNKNOWN');
CREATE TYPE "LinkingTokenStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED');

CREATE TABLE "households" ("id" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "households_pkey" PRIMARY KEY ("id"));
CREATE TABLE "members" ("id" TEXT NOT NULL, "household_id" TEXT NOT NULL, "role" "MemberRole" NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "members_pkey" PRIMARY KEY ("id"));
CREATE TABLE "contract_cycles" ("id" TEXT NOT NULL, "household_id" TEXT NOT NULL, "status" "ContractStatus" NOT NULL, "starts_at" TIMESTAMP(3) NOT NULL, "ends_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "contract_cycles_pkey" PRIMARY KEY ("id"));
CREATE TABLE "channel_identity_links" ("id" TEXT NOT NULL, "provider" TEXT NOT NULL DEFAULT 'KAKAO', "provider_user_key_hash" TEXT NOT NULL, "member_id" TEXT NOT NULL, "household_id" TEXT NOT NULL, "contract_cycle_id" TEXT NOT NULL, "role" "MemberRole" NOT NULL, "status" "IdentityLinkStatus" NOT NULL DEFAULT 'ACTIVE', "reachability" "KakaoReachability" NOT NULL DEFAULT 'UNKNOWN', "verified_at" TIMESTAMP(3) NOT NULL, "revoked_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "channel_identity_links_pkey" PRIMARY KEY ("id"));
CREATE TABLE "channel_linking_tokens" ("id" TEXT NOT NULL, "token_hash" TEXT NOT NULL, "member_id" TEXT NOT NULL, "contract_cycle_id" TEXT NOT NULL, "status" "LinkingTokenStatus" NOT NULL DEFAULT 'ACTIVE', "expires_at" TIMESTAMP(3) NOT NULL, "used_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "channel_linking_tokens_pkey" PRIMARY KEY ("id"));
CREATE TABLE "provider_event_receipts" ("id" TEXT NOT NULL, "provider" TEXT NOT NULL, "provider_event_id" TEXT NOT NULL, "household_id" TEXT, "event_type" TEXT NOT NULL, "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "provider_event_receipts_pkey" PRIMARY KEY ("id"));
CREATE TABLE "checkin_router_audit_logs" ("id" TEXT NOT NULL, "event" TEXT NOT NULL, "actor_id" TEXT, "household_id" TEXT, "entity_type" TEXT NOT NULL, "entity_id" TEXT NOT NULL, "payload" JSONB NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "checkin_router_audit_logs_pkey" PRIMARY KEY ("id"));

CREATE INDEX "members_household_id_idx" ON "members"("household_id");
CREATE INDEX "contract_cycles_household_id_status_idx" ON "contract_cycles"("household_id", "status");
CREATE INDEX "channel_identity_links_member_id_status_idx" ON "channel_identity_links"("member_id", "status");
CREATE INDEX "channel_identity_links_household_id_contract_cycle_id_statu_idx" ON "channel_identity_links"("household_id", "contract_cycle_id", "status");
CREATE UNIQUE INDEX "channel_identity_links_provider_provider_user_key_hash_cont_key" ON "channel_identity_links"("provider", "provider_user_key_hash", "contract_cycle_id");
CREATE UNIQUE INDEX "channel_linking_tokens_token_hash_key" ON "channel_linking_tokens"("token_hash");
CREATE INDEX "channel_linking_tokens_member_id_status_expires_at_idx" ON "channel_linking_tokens"("member_id", "status", "expires_at");
CREATE UNIQUE INDEX "provider_event_receipts_provider_provider_event_id_event_ty_key" ON "provider_event_receipts"("provider", "provider_event_id", "event_type");
CREATE INDEX "checkin_router_audit_logs_household_id_created_at_idx" ON "checkin_router_audit_logs"("household_id", "created_at");
CREATE INDEX "checkin_router_audit_logs_entity_type_entity_id_idx" ON "checkin_router_audit_logs"("entity_type", "entity_id");

ALTER TABLE "members" ADD CONSTRAINT "members_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_cycles" ADD CONSTRAINT "contract_cycles_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_identity_links" ADD CONSTRAINT "channel_identity_links_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_identity_links" ADD CONSTRAINT "channel_identity_links_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_identity_links" ADD CONSTRAINT "channel_identity_links_contract_cycle_id_fkey" FOREIGN KEY ("contract_cycle_id") REFERENCES "contract_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_linking_tokens" ADD CONSTRAINT "channel_linking_tokens_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_linking_tokens" ADD CONSTRAINT "channel_linking_tokens_contract_cycle_id_fkey" FOREIGN KEY ("contract_cycle_id") REFERENCES "contract_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "households" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contract_cycles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "channel_identity_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "channel_linking_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_event_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checkin_router_audit_logs" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "households", "members", "contract_cycles", "channel_identity_links", "channel_linking_tokens", "provider_event_receipts", "checkin_router_audit_logs" FROM anon, authenticated;
