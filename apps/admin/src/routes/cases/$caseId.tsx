import { useQuery } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router";
import { ArrowLeft, Lock } from "lucide-react";
import { ClosureBadge, RiskBadge, StatusBadge } from "@/components/case-badges";
import { ErrorState, LoadingRows } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCase } from "@/lib/api";
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
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-72" />
        <LoadingRows rows={3} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorState
          title="Could not load this case"
          message={toApiError(error).message}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const isClosed = data.status === "Closed";
  const onActivity = pathname.endsWith("/activity");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        render={<Link to="/cases" />}
      >
        <ArrowLeft />
        Back to cases
      </Button>

      {/* Summary header — persists across both sub-pages. */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {data.title}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <RiskBadge risk={data.riskLevel} />
            <StatusBadge status={data.status} />
          </div>
        </div>

        <p className="text-muted-foreground text-sm">{data.description}</p>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
          <span>
            Likelihood <strong>{data.likelihood}</strong> · Impact{" "}
            <strong>{data.impact}</strong>
          </span>
          {data.category && <span>Category: {data.category}</span>}
          <span>Reported {new Date(data.createdAt).toLocaleString()}</span>
          {data.triagedAt && (
            <span>Triaged {new Date(data.triagedAt).toLocaleString()}</span>
          )}
          {data.closedAt && (
            <span>Closed {new Date(data.closedAt).toLocaleString()}</span>
          )}
          <ClosureBadge
            status={data.status}
            closureStatus={data.closureStatus}
          />
        </div>

        {isClosed && (
          <div className="text-muted-foreground flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs">
            <Lock className="size-3.5" />
            This case is closed and immutable. No further changes are accepted.
          </div>
        )}
      </div>

      <nav className="flex gap-1 border-b">
        <SubNavLink to="/cases/$caseId" caseId={caseId} active={!onActivity}>
          Progress
        </SubNavLink>
        <SubNavLink
          to="/cases/$caseId/activity"
          caseId={caseId}
          active={onActivity}
        >
          Activity Logs
        </SubNavLink>
      </nav>

      <Outlet />
    </div>
  );
}

function SubNavLink({
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
        "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
        active
          ? "border-foreground font-medium"
          : "text-muted-foreground hover:text-foreground border-transparent",
      )}
    >
      {children}
    </Link>
  );
}
