import type { Metadata } from "next";
import "./globals.css";
import "./system-fonts.css";
export const metadata: Metadata = { title: "Home Together · Residence Router", description: "가구별 원장 기반 거주 라우터 운영 콘솔" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html>; }
