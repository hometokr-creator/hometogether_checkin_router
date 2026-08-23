import { OperatorConsole } from "@/app/_components/operator-console";
import { hh002Classification, hh002Evidence } from "@/modules/demo/hh002";
import { decideRoute } from "@/modules/routing/decide-route";
export default function Home() { return <OperatorConsole classification={hh002Classification} evidence={hh002Evidence} decision={decideRoute(hh002Classification, "NO_CLAUSE")} />; }
