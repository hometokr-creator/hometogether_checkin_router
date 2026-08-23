import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { homeTogetherPrisma?: PrismaClient };

export function getPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL_REQUIRED");
  if (!globalForPrisma.homeTogetherPrisma) {
    globalForPrisma.homeTogetherPrisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }
  return globalForPrisma.homeTogetherPrisma;
}
