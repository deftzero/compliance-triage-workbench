import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, FilePlus2, Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ClosureBadge, RiskBadge, StatusBadge } from "@/components/case-badges";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
} from "@/components/query-states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCases, type CaseView } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toApiError } from "@/lib/graphql";

export const Route = createFileRoute("/")({ component: DashboardPage });

function DashboardPage() {
  const { user } = useAuth();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["cases", {}],
    queryFn: () => fetchCases({}),
  });

  if (!user) return null;
  const isReporter = user.role === "Reporter";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">
            {isReporter
              ? "The cases you have reported."
              : "Every case across the organisation."}
          </p>
        </div>

        {isReporter && (
          <Button render={<Link to="/cases/new" />}>
            <FilePlus2 />
            Report a Case
          </Button>
        )}
      </div>

      {isPending ? (
        <DashboardSkeleton />
      ) : isError ? (
        <ErrorState
          title="Could not load cases"
          message={toApiError(error).message}
          onRetry={() => void refetch()}
        />
      ) : (
        <DashboardContent cases={data} isReporter={isReporter} />
      )}
    </div>
  );
}

function DashboardContent({
  cases,
  isReporter,
}: {
  cases: CaseView[];
  isReporter: boolean;
}) {
  const open = cases.filter((c) => c.status !== "Closed");
  const awaitingTriage = cases.filter((c) => c.status === "Reported").length;
  const readyToClose = open.filter((c) => c.closureStatus.ready).length;
  const highRisk = open.filter(
    (c) => c.riskLevel === "High" || c.riskLevel === "Critical",
  ).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Awaiting triage" value={awaitingTriage} icon={Inbox} />
        <StatCard
          label="Open, high or critical"
          value={highRisk}
          icon={AlertTriangle}
        />
        <StatCard
          label="Ready to close"
          value={readyToClose}
          icon={CheckCircle2}
        />
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>{isReporter ? "My cases" : "Recent cases"}</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {cases.length === 0 ? (
            <EmptyState
              message={
                isReporter
                  ? "You haven't reported any cases yet."
                  : "No cases have been reported yet."
              }
            />
          ) : (
            <ul className="divide-y">
              {cases.slice(0, 6).map((complianceCase) => (
                <li key={complianceCase.id}>
                  <Link
                    to="/cases/$caseId"
                    params={{ caseId: complianceCase.id }}
                    className="hover:bg-accent/50 -mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-3 transition-colors"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {complianceCase.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <RiskBadge risk={complianceCase.riskLevel} />
                      <StatusBadge status={complianceCase.status} />
                      <ClosureBadge
                        status={complianceCase.status}
                        closureStatus={complianceCase.closureStatus}
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center justify-between gap-3">
        <div>
          <div className="text-muted-foreground text-xs">{label}</div>
          <div className="font-heading text-2xl leading-tight font-semibold">
            {value}
          </div>
        </div>
        <Icon className="text-muted-foreground size-4 shrink-0" />
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} size="sm">
            <CardContent className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-10" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card size="sm">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <LoadingRows />
        </CardContent>
      </Card>
    </div>
  );
}
