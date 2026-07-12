import type { CaseStatus, ClosureStatus, RiskLevel } from "@repo/shared";
import { CheckCircle2, CircleDashed, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const RISK_STYLES: Record<RiskLevel, string> = {
  Low: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Medium: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
  High: "border-transparent bg-orange-500/15 text-orange-700 dark:text-orange-400",
  Critical: "border-transparent bg-red-500/15 text-red-700 dark:text-red-400",
};

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <Badge variant="outline" className={cn(RISK_STYLES[risk])}>
      {risk}
    </Badge>
  );
}

const STATUS_VARIANT: Record<
  CaseStatus,
  "default" | "secondary" | "outline"
> = {
  Reported: "outline",
  Triaged: "secondary",
  Closed: "default",
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;
}

/**
 * A closed case is neither ready nor blocked — it's done. Showing "N blockers"
 * on it would be nonsense, so it gets its own state.
 */
export function ClosureBadge({
  status,
  closureStatus,
}: {
  status: CaseStatus;
  closureStatus: ClosureStatus;
}) {
  if (status === "Closed") {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <Lock className="size-3" />
        Closed
      </span>
    );
  }

  if (closureStatus.ready) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3" />
        Ready to close
      </span>
    );
  }

  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
      <CircleDashed className="size-3" />
      {closureStatus.blockers.length} blocker
      {closureStatus.blockers.length === 1 ? "" : "s"}
    </span>
  );
}
