import {
  calculateRiskLevel,
  likelihoodImpactSchema,
  type LikelihoodImpact,
} from "@repo/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { RiskBadge } from "@/components/case-badges";
import { ErrorState } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { reportCase } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toApiError } from "@/lib/graphql";

export const Route = createFileRoute("/cases/new")({ component: ReportCasePage });

function ReportCasePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [likelihood, setLikelihood] = useState<LikelihoodImpact>("Medium");
  const [impact, setImpact] = useState<LikelihoodImpact>("Medium");

  const mutation = useMutation({
    mutationFn: () =>
      reportCase({
        title,
        description,
        likelihood,
        impact,
        ...(category.trim() ? { category: category.trim() } : {}),
      }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
      await navigate({ to: "/cases/$caseId", params: { caseId: created.id } });
    },
  });

  // Previewed with the same function the server uses to compute it, so what the
  // reporter sees here is what the case will actually be filed as.
  const previewRisk = calculateRiskLevel(likelihood, impact);

  if (!user || user.role === "Auditor") {
    return <ErrorState message="Auditors have read-only access." />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Report a Case
        </h1>
        <p className="text-muted-foreground text-sm">
          Describe what happened and how serious it looks. Risk is calculated
          for you.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary of the concern"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened, who was involved, and when?"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category (optional)</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Procurement"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <RiskSelect
                id="likelihood"
                label="Likelihood"
                value={likelihood}
                onChange={setLikelihood}
              />
              <RiskSelect
                id="impact"
                label="Impact"
                value={impact}
                onChange={setImpact}
              />
            </div>

            <div className="bg-muted/40 flex items-center justify-between rounded-lg border p-4">
              <div>
                <div className="text-sm font-medium">Calculated risk</div>
                <div className="text-muted-foreground text-xs">
                  Derived from likelihood and impact &mdash; it cannot be set by
                  hand.
                </div>
              </div>
              <RiskBadge risk={previewRisk} />
            </div>

            {mutation.isError && (
              <ErrorState
                title="Could not file the case"
                message={toApiError(mutation.error).message}
              />
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Filing…" : "Submit report"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function RiskSelect({
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
