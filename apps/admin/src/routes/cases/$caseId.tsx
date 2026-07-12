import { useQuery } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, CircleDashed, Lock } from "lucide-react";
import { RiskBadge, StatusBadge } from "@/components/case-badges";
import { ErrorState, LoadingRows } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCase, type CaseView } from "@/lib/api";
import { toApiError } from "@/lib/graphql";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cases/$caseId")({
  component: CaseDetailLayout,
});

function CaseDetailLayout() {
  const { caseId } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => fetchCase(caseId),
  });

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <LoadingRows rows={3} />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Could not load this case"
        message={toApiError(error).message}
        onRetry={() => void refetch()}
      />
    );
  }

  const onActivity = pathname.endsWith("/activity");

  return (
    <div className="space-y-4">
      {/* Compact header: everything identifying the case on one line. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back to cases"
          render={<Link to="/cases" />}
        >
          <ArrowLeft />
        </Button>
        <h1 className="font-heading min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
          {data.title}
        </h1>
        <RiskBadge risk={data.riskLevel} />
        <StatusBadge status={data.status} />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Work surface: tabbed sub-pages. */}
        <div className="min-w-0 flex-1 space-y-3">
          <nav className="bg-muted text-muted-foreground inline-flex h-8 items-center rounded-lg p-[3px]">
            <TabLink to="/cases/$caseId" caseId={caseId} active={!onActivity}>
              Progress
            </TabLink>
            <TabLink
              to="/cases/$caseId/activity"
              caseId={caseId}
              active={onActivity}
            >
              Activity Logs
            </TabLink>
          </nav>

          <Outlet />
        </div>

        {/* Details rail: the facts of the case, always in view. */}
        <aside className="w-full shrink-0 lg:sticky lg:top-4 lg:w-80">
          <DetailsPanel complianceCase={data} />
        </aside>
      </div>
    </div>
  );
}

function TabLink({
  to,
  caseId,
  active,
  children,
}: {
  to: "/cases/$caseId" | "/cases/$caseId/activity";
  caseId: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      params={{ caseId }}
      className={cn(
        "inline-flex h-full items-center rounded-md px-3 text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function DetailsPanel({ complianceCase }: { complianceCase: CaseView }) {
  const { closureStatus, status } = complianceCase;

  return (
    <Card size="sm">
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {complianceCase.description}
        </p>

        <dl className="space-y-2 border-t pt-3 text-sm">
          <DetailRow label="Likelihood" value={complianceCase.likelihood} />
          <DetailRow label="Impact" value={complianceCase.impact} />
          {complianceCase.category && (
            <DetailRow label="Category" value={complianceCase.category} />
          )}
          {complianceCase.triageDecision && (
            <DetailRow label="Decision" value={complianceCase.triageDecision} />
          )}
          <DetailRow
            label="Reported"
            value={new Date(complianceCase.createdAt).toLocaleString()}
          />
          {complianceCase.triagedAt && (
            <DetailRow
              label="Triaged"
              value={new Date(complianceCase.triagedAt).toLocaleString()}
            />
          )}
          {complianceCase.closedAt && (
            <DetailRow
              label="Closed"
              value={new Date(complianceCase.closedAt).toLocaleString()}
            />
          )}
        </dl>

        <div className="border-t pt-3">
          {status === "Closed" ? (
            <div className="text-muted-foreground flex items-start gap-2 text-xs">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              Closed and immutable — no further changes are accepted.
            </div>
          ) : closureStatus.ready ? (
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
              Ready to close
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
                <CircleDashed className="size-3.5" />
                Blocking closure
              </div>
              <ul className="text-muted-foreground list-inside list-disc space-y-1 text-xs">
                {closureStatus.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground shrink-0 text-xs">{label}</dt>
      <dd className="text-right text-sm">{value}</dd>
    </div>
  );
}
