import "server-only";
import { cookies } from "next/headers";
import { DEMO_SESSION_COOKIE, verifyDemoSession } from "./session";

export function isDemoEnabled() {
  return process.env.DEMO_MODE === "true";
}

export async function readDemoSession() {
  if (!isDemoEnabled()) return null;
  const secret = process.env.DEMO_SESSION_SECRET ?? "";
  const token = (await cookies()).get(DEMO_SESSION_COOKIE)?.value;
  return token ? verifyDemoSession(token, secret) : null;
}
