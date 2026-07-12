import {
  likelihoodImpactSchema,
  triageDecisionSchema,
  type LikelihoodImpact,
  type TriageDecision,
} from "@repo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Lock, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { ErrorState, LoadingRows } from "@/components/query-states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  closeCase,
  fetchCase,
  triageCase,
  updateCase,
  type CaseView,
} from "@/lib/api";
import { can, useAuth } from "@/lib/auth";
import { toApiError } from "@/lib/graphql";

export const Route = createFileRoute("/cases/$caseId/")({
  component: ProgressTab,
});

function ProgressTab() {
  const { caseId } = Route.useParams();
  const { user } = useAuth();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => fetchCase(caseId),
  });

  if (isPending) return <LoadingRows rows={3} />;
  if (isError) {
    return (
      <ErrorState
        message={toApiError(error).message}
        onRetry={() => void refetch()}
      />
    );
  }
  if (!user) return null;

  // An Auditor, a Reporter, or anyone looking at a closed case gets the
  // read-only surface. The backend rejects their mutations regardless — this
  // just avoids offering controls that would fail.
  const canAct = can.editWorkflow(user.role) && data.status !== "Closed";

  return (
    <div className="space-y-4">
      {!canAct && <ReadOnlyNotice complianceCase={data} role={user.role} />}

      {canAct && data.status === "Reported" && (
        <TriageForm complianceCase={data} />
      )}
      {canAct && data.status === "Triaged" && (
        <WorkflowForm complianceCase={data} />
      )}

      {!canAct && <WorkflowSummary complianceCase={data} />}

      {/* Read-only viewers see closure readiness in the details rail instead. */}
      {canAct && <ClosurePanel complianceCase={data} />}
    </div>
  );
}

function ReadOnlyNotice({
  complianceCase,
  role,
}: {
  complianceCase: CaseView;
  role: "ComplianceManager" | "Auditor" | "Reporter";
}) {
  const reason =
    complianceCase.status === "Closed"
      ? "This case is closed. It is immutable and accepts no further changes."
      : role === "Auditor"
        ? "Auditors have read-only access to every case."
        : "Only a Compliance Manager can triage, update, or close a case.";

  return (
    <Alert>
      <Lock />
      <AlertTitle>Read-only</AlertTitle>
      <AlertDescription>{reason}</AlertDescription>
    </Alert>
  );
}

function TriageForm({ complianceCase }: { complianceCase: CaseView }) {
  const queryClient = useQueryClient();

  const [decision, setDecision] = useState<TriageDecision>("Accepted");
  const [likelihood, setLikelihood] = useState<LikelihoodImpact>(
    complianceCase.likelihood,
  );
  const [impact, setImpact] = useState<LikelihoodImpact>(complianceCase.impact);
  const [investigationRequired, setInvestigationRequired] = useState(false);
  const [correctiveActionRequired, setCorrectiveActionRequired] =
    useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      triageCase(complianceCase.id, {
        decision,
        investigationRequired,
        correctiveActionRequired,
        likelihood,
        impact,
      }),
    onSuccess: () => invalidateCase(queryClient, complianceCase.id),
  });

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Triage</CardTitle>
        <CardDescription>
          Record a decision. Adjusting likelihood or impact recomputes the risk
          level and is logged.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="decision">Decision</Label>
            <Select
              value={decision}
              onValueChange={(v) => setDecision(v as TriageDecision)}
            >
              <SelectTrigger id="decision" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {triageDecisionSchema.options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <EnumSelect
              id="likelihood"
              label="Likelihood"
              value={likelihood}
              onChange={setLikelihood}
            />
            <EnumSelect
              id="impact"
              label="Impact"
              value={impact}
              onChange={setImpact}
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={investigationRequired}
                onCheckedChange={(v) => setInvestigationRequired(v === true)}
              />
              Investigation required
            </label>
            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={correctiveActionRequired}
                onCheckedChange={(v) => setCorrectiveActionRequired(v === true)}
              />
              Corrective action required
            </label>
          </div>

          {mutation.isError && (
            <ErrorState
              title="Triage failed"
              message={toApiError(mutation.error).message}
            />
          )}

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Recording…" : "Record triage"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function WorkflowForm({ complianceCase }: { complianceCase: CaseView }) {
  const queryClient = useQueryClient();

  const [reviewNote, setReviewNote] = useState(complianceCase.reviewNote ?? "");
  const [investigationOutcome, setInvestigationOutcome] = useState(
    complianceCase.investigationOutcome ?? "",
  );

  const save = useMutation({
    mutationFn: (input: Parameters<typeof updateCase>[1]) =>
      updateCase(complianceCase.id, input),
    onSuccess: () => invalidateCase(queryClient, complianceCase.id),
  });

  const actionClosed = complianceCase.correctiveActionStatus === "Closed";

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Review</CardTitle>
        <CardDescription>
          Every change is recorded in the activity log with its old and new
          value.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reviewNote">Review note</Label>
          <Textarea
            id="reviewNote"
            rows={3}
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Required before closing a High or Critical case."
          />
          <Button
            size="sm"
            variant="outline"
            disabled={save.isPending || reviewNote === (complianceCase.reviewNote ?? "")}
            onClick={() => save.mutate({ reviewNote })}
          >
            Save review note
          </Button>
        </div>

        {complianceCase.investigationRequired && (
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="investigationOutcome">Investigation outcome</Label>
            <Textarea
              id="investigationOutcome"
              rows={3}
              value={investigationOutcome}
              onChange={(e) => setInvestigationOutcome(e.target.value)}
              placeholder="What did the investigation find?"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={
                save.isPending ||
                investigationOutcome ===
                  (complianceCase.investigationOutcome ?? "")
              }
              onClick={() => save.mutate({ investigationOutcome })}
            >
              Save outcome
            </Button>
          </div>
        )}

        {complianceCase.correctiveActionRequired && (
          <div className="flex items-center justify-between border-t pt-4">
            <div>
              <div className="text-sm font-medium">Corrective action</div>
              <div className="text-muted-foreground text-xs">
                Currently {complianceCase.correctiveActionStatus ?? "Open"}.
              </div>
            </div>
            <Button
              size="sm"
              variant={actionClosed ? "outline" : "default"}
              disabled={save.isPending}
              onClick={() =>
                save.mutate({
                  correctiveActionStatus: actionClosed ? "Open" : "Closed",
                })
              }
            >
              {actionClosed ? "Reopen action" : "Mark action closed"}
            </Button>
          </div>
        )}

        {save.isError && (
          <ErrorState
            title="Update failed"
            message={toApiError(save.error).message}
          />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * What a read-only viewer sees in place of the editable workflow fields.
 * Case facts (decision, dates, risk inputs) live in the details rail; this
 * card only carries the workflow text the rail doesn't show.
 */
function WorkflowSummary({ complianceCase }: { complianceCase: CaseView }) {
  const rows: [string, string][] = [
    [
      "Investigation",
      complianceCase.investigationRequired
        ? (complianceCase.investigationOutcome ?? "Required — no outcome yet")
        : "Not required",
    ],
    [
      "Corrective action",
      complianceCase.correctiveActionRequired
        ? (complianceCase.correctiveActionStatus ?? "Open")
        : "Not required",
    ],
    ["Review note", complianceCase.reviewNote ?? "—"],
  ];

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="grid gap-1 py-2 sm:grid-cols-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="sm:col-span-2">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function ClosurePanel({ complianceCase }: { complianceCase: CaseView }) {
  const queryClient = useQueryClient();
  const { closureStatus, status } = complianceCase;

  const mutation = useMutation({
    mutationFn: () => closeCase(complianceCase.id),
    onSuccess: () => invalidateCase(queryClient, complianceCase.id),
  });

  if (status === "Closed") return null;

  // If the server still rejects the close, it hands back the authoritative
  // blocker list — prefer that over the one we last rendered.
  const serverBlockers = mutation.isError
    ? toApiError(mutation.error).blockers
    : [];
  const blockers =
    serverBlockers.length > 0 ? serverBlockers : closureStatus.blockers;

  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          {closureStatus.ready ? (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-4" />
              Ready to close — nothing outstanding.
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">
              {blockers.length} requirement{blockers.length === 1 ? "" : "s"}{" "}
              outstanding before this case can close.
            </div>
          )}

          <Button
            disabled={!closureStatus.ready || mutation.isPending}
            title={
              closureStatus.ready ? undefined : `Blocked: ${blockers.join(" ")}`
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Closing…" : "Close case"}
          </Button>
        </div>

        {!closureStatus.ready && (
          <Alert variant="destructive">
            <ShieldAlert />
            <AlertTitle>Blocking closure</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc space-y-1">
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {mutation.isError && serverBlockers.length === 0 && (
          <ErrorState
            title="Close failed"
            message={toApiError(mutation.error).message}
          />
        )}
      </CardContent>
    </Card>
  );
}

function EnumSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: LikelihoodImpact;
  onChange: (value: LikelihoodImpact) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value}
        onValueChange={(next) => onChange(next as LikelihoodImpact)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {likelihoodImpactSchema.options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

async function invalidateCase(
  queryClient: ReturnType<typeof useQueryClient>,
  caseId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["case", caseId] }),
    queryClient.invalidateQueries({ queryKey: ["cases"] }),
    queryClient.invalidateQueries({ queryKey: ["audit", caseId] }),
  ]);
}
