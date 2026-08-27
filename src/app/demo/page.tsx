import type { Metadata } from "next";
import { DemoChat } from "./demo-chat";
import styles from "./demo.module.css";

export const metadata: Metadata = {
  title: "HOMETO 거주 체크인 데모",
  description: "입주 3일차 거주 체크인 플로우 데모",
};

export default function DemoPage() {
  return (
    <main className={styles.page}>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>HOMETO · RESIDENCE CARE</p>
        <h1>새 집에서의 첫 며칠,<br />가볍게 안부를 확인해요.</h1>
        <p>계약이나 납부처럼 확정된 정보는 등록된 데이터에서 조회하고, 정기 체크인은 정해진 문항과 판정 규칙으로 안전하게 진행합니다.</p>
        <div className={styles.principles}>
          <span>구조화 정보 우선</span>
          <span>답변별 단계 저장</span>
          <span>필요한 경우만 검토</span>
        </div>
      </section>
      <DemoChat />
    </main>
  );
}
