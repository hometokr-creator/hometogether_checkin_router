ALTER TABLE "households" ADD COLUMN "canonical_home_id" UUID;
ALTER TABLE "members" ADD COLUMN "canonical_profile_id" UUID;
ALTER TABLE "contract_cycles" ADD COLUMN "canonical_match_id" UUID;

CREATE UNIQUE INDEX "households_canonical_home_id_key" ON "households"("canonical_home_id");
CREATE UNIQUE INDEX "members_canonical_profile_id_household_id_key" ON "members"("canonical_profile_id", "household_id");
CREATE UNIQUE INDEX "contract_cycles_canonical_match_id_key" ON "contract_cycles"("canonical_match_id");

ALTER TABLE "households" ADD CONSTRAINT "households_canonical_home_id_fkey" FOREIGN KEY ("canonical_home_id") REFERENCES "homes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "members" ADD CONSTRAINT "members_canonical_profile_id_fkey" FOREIGN KEY ("canonical_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_cycles" ADD CONSTRAINT "contract_cycles_canonical_match_id_fkey" FOREIGN KEY ("canonical_match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
