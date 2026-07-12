import {
  caseStatusSchema,
  riskLevelSchema,
  type CaseStatus,
  type RiskLevel,
} from "@repo/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { FilePlus2, LayoutGrid, List, Search } from "lucide-react";
import { useState } from "react";
import { ClosureBadge, RiskBadge, StatusBadge } from "@/components/case-badges";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
} from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fetchCases, type CaseView } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toApiError } from "@/lib/graphql";

export const Route = createFileRoute("/cases/")({ component: CasesPage });

const ANY = "any";

function CasesPage() {
  const { user } = useAuth();
  const [view, setView] = useState<"list" | "grid">("list");
  const [status, setStatus] = useState<CaseStatus | typeof ANY>(ANY);
  const [riskLevel, setRiskLevel] = useState<RiskLevel | typeof ANY>(ANY);
  const [search, setSearch] = useState("");

  // Filters are sent to the server rather than applied to a cached list, so
  // the Reporter's scoping stays the backend's decision.
  const filter = {
    ...(status !== ANY ? { status } : {}),
    ...(riskLevel !== ANY ? { riskLevel } : {}),
    ...(search.trim() ? { q: search.trim() } : {}),
  };

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["cases", filter],
    queryFn: () => fetchCases(filter),
  });

  if (!user) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            {user.role === "Reporter" ? "My Cases" : "Cases"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {user.role === "Auditor"
              ? "Read-only view of every case."
              : "Filter, open, and work a case."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user.role === "Reporter" && (
            <Button render={<Link to="/cases/new" />}>
              <FilePlus2 />
              Report a Case
            </Button>
          )}
          {/* Base UI's ToggleGroup is array-valued; we keep it to one entry. */}
          <ToggleGroup
            value={[view]}
            onValueChange={(value) => {
              const next = value[0];
              if (next === "list" || next === "grid") setView(next);
            }}
            variant="outline"
          >
            <ToggleGroupItem value="list" aria-label="List view">
              <List className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <LayoutGrid className="size-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search title and description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <FilterSelect
          label="Status"
          value={status}
          options={caseStatusSchema.options}
          onChange={(value) => setStatus(value as CaseStatus | typeof ANY)}
        />
        <FilterSelect
          label="Risk"
          value={riskLevel}
          options={riskLevelSchema.options}
          onChange={(value) => setRiskLevel(value as RiskLevel | typeof ANY)}
        />
      </div>

      {isPending ? (
        <LoadingRows rows={5} />
      ) : isError ? (
        <ErrorState
          title="Could not load cases"
          message={toApiError(error).message}
          onRetry={() => void refetch()}
        />
      ) : data.length === 0 ? (
        <EmptyState message="No cases match these filters." />
      ) : view === "list" ? (
        <CaseTable cases={data} />
      ) : (
        <CaseGrid cases={data} />
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    // Base UI's Select can emit null when cleared; treat that as "no filter".
    <Select value={value} onValueChange={(next) => onChange(next ?? ANY)}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>All {label.toLowerCase()}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CaseTable({ cases }: { cases: CaseView[] }) {
  const navigate = useNavigate();

  return (
    <Card size="sm">
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Closure</TableHead>
              <TableHead className="text-right">Reported</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((complianceCase) => (
              <TableRow
                key={complianceCase.id}
                className="cursor-pointer"
                onClick={() =>
                  navigate({
                    to: "/cases/$caseId",
                    params: { caseId: complianceCase.id },
                  })
                }
              >
                <TableCell className="font-medium">
                  {complianceCase.title}
                </TableCell>
                <TableCell>
                  <RiskBadge risk={complianceCase.riskLevel} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={complianceCase.status} />
                </TableCell>
                <TableCell>
                  <ClosureBadge
                    status={complianceCase.status}
                    closureStatus={complianceCase.closureStatus}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground text-right text-sm">
                  {new Date(complianceCase.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CaseGrid({ cases }: { cases: CaseView[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cases.map((complianceCase) => (
        <Link
          key={complianceCase.id}
          to="/cases/$caseId"
          params={{ caseId: complianceCase.id }}
        >
          <Card
            size="sm"
            className="hover:ring-foreground/20 h-full transition-shadow"
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-snug">
                  {complianceCase.title}
                </CardTitle>
                <RiskBadge risk={complianceCase.riskLevel} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground line-clamp-2 text-sm">
                {complianceCase.description}
              </p>
              <div className="flex items-center justify-between">
                <StatusBadge status={complianceCase.status} />
                <ClosureBadge
                  status={complianceCase.status}
                  closureStatus={complianceCase.closureStatus}
                />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
