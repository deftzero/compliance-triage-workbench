import { AUDIT_ACTION_LABELS, ROLE_LABELS, type Role } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
} from "@/components/query-states";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchAuditTrail } from "@/lib/api";
import { toApiError } from "@/lib/graphql";

export const Route = createFileRoute("/cases/$caseId/activity")({
  component: ActivityTab,
});

function ActivityTab() {
  const { caseId } = Route.useParams();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["audit", caseId],
    queryFn: () => fetchAuditTrail(caseId),
  });

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Activity Logs</CardTitle>
        <CardDescription>
          Append-only, newest first. Entries cannot be edited or deleted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <LoadingRows rows={4} />
        ) : isError ? (
          <ErrorState
            message={toApiError(error).message}
            onRetry={() => void refetch()}
          />
        ) : data.length === 0 ? (
          <EmptyState message="No activity recorded yet." />
        ) : (
          <ol className="space-y-4">
            {data.map((entry) => (
              <li
                key={entry.id}
                className="border-muted relative border-l pl-5"
              >
                <span className="bg-foreground absolute top-1.5 -left-[3px] size-1.5 rounded-full" />

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <time className="text-muted-foreground text-xs tabular-nums">
                    {new Date(entry.timestamp).toLocaleString()}
                  </time>
                  <span className="font-medium">{entry.actorName}</span>
                  <span className="text-muted-foreground text-xs">
                    ({ROLE_LABELS[entry.actorRole as Role] ?? entry.actorRole})
                  </span>
                  <Badge variant="secondary">
                    {AUDIT_ACTION_LABELS[entry.action]}
                  </Badge>
                </div>

                {entry.changes.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {entry.changes.map((change) => (
                      <li
                        key={change.field}
                        className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs"
                      >
                        <span className="font-mono">{change.field}</span>
                        <span className="text-foreground/70">
                          {change.oldValue ?? "—"}
                        </span>
                        <ArrowRight className="size-3" />
                        <span className="text-foreground font-medium">
                          {change.newValue ?? "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
