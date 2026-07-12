#!/usr/bin/env bash
# Exercises the GraphQL API against a running backend, covering the rules that
# matter: risk is derived, roles are enforced, a premature close returns every
# blocker, and a closed case is immutable.
#
#   pnpm --filter backend dev        # in one shell
#   ./apps/backend/scripts/smoke.sh  # in another
set -euo pipefail

ENDPOINT="${ENDPOINT:-http://localhost:3001/api/v1/graphql}"

gql() { # gql <query> [token]
  curl -s "$ENDPOINT" \
    -H 'content-type: application/json' \
    ${2:+-H "authorization: Bearer $2"} \
    -d "$(node -e 'process.stdout.write(JSON.stringify({query: process.argv[1]}))' "$1")"
}

show() {
  node -pe "const r=JSON.parse(require('fs').readFileSync(0,'utf8'));
    JSON.stringify(r.errors ? r.errors.map(e=>({message:e.message, ...e.extensions})) : r.data, null, 1)"
}

token_for() {
  gql "mutation{login(email:\"$1\",password:\"password123\"){token}}" |
    node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).data.login.token"
}

step() { printf '\n\033[1m--- %s\033[0m\n' "$1"; }

step "health (unversioned REST)"
curl -s "${ENDPOINT%/api/v1/graphql}/health"; echo

MANAGER=$(token_for manager@example.com)
AUDITOR=$(token_for auditor@example.com)
REPORTER=$(token_for reporter@example.com)

step "Reporter files a case: High x High must derive Critical (R7)"
CASE=$(gql 'mutation{reportCase(title:"Bribery allegation",description:"Cash offered to a tender official.",likelihood:High,impact:High){id riskLevel status}}' "$REPORTER")
echo "$CASE" | show
ID=$(echo "$CASE" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).data.reportCase.id")

step "Reporter cannot triage (R6)"
gql "mutation{triageCase(id:\"$ID\",decision:Accepted,investigationRequired:false,correctiveActionRequired:false){id}}" "$REPORTER" | show

step "Auditor cannot triage — read-only (R6)"
gql "mutation{triageCase(id:\"$ID\",decision:Accepted,investigationRequired:false,correctiveActionRequired:false){id}}" "$AUDITOR" | show

step "Anonymous cannot triage"
gql "mutation{triageCase(id:\"$ID\",decision:Accepted,investigationRequired:false,correctiveActionRequired:false){id}}" | show

step "Compliance Manager triages, requiring investigation + corrective action"
gql "mutation{triageCase(id:\"$ID\",decision:Escalated,investigationRequired:true,correctiveActionRequired:true){status riskLevel closureStatus{ready blockers}}}" "$MANAGER" | show

step "Closing too early returns EVERY blocker, not just the first (R1-R4)"
gql "mutation{closeCase(id:\"$ID\"){id}}" "$MANAGER" | show

step "Manager satisfies each blocker"
gql "mutation{updateCase(id:\"$ID\",reviewNote:\"Reviewed with legal counsel.\",investigationOutcome:\"Substantiated; contract cancelled.\",correctiveActionStatus:Closed){closureStatus{ready blockers}}}" "$MANAGER" | show

step "Close now succeeds"
gql "mutation{closeCase(id:\"$ID\"){status closedAt}}" "$MANAGER" | show

step "A closed case is immutable (R5) and closedAt is written once (R8)"
gql "mutation{updateCase(id:\"$ID\",reviewNote:\"tampering\"){reviewNote}}" "$MANAGER" | show
gql "mutation{closeCase(id:\"$ID\"){status}}" "$MANAGER" | show

step "Audit trail: append-only, newest first, field-level old -> new (R10)"
gql "query{case(id:\"$ID\"){auditTrail{action actorName actorRole changes{field oldValue newValue}}}}" "$MANAGER" | show
