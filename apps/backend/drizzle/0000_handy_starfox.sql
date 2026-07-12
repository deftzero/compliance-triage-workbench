CREATE TYPE "public"."audit_action" AS ENUM('Reported', 'Triaged', 'ReviewNoteUpdated', 'InvestigationOutcomeRecorded', 'CorrectiveActionUpdated', 'RiskInputsUpdated', 'Closed');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('Reported', 'Triaged', 'Closed');--> statement-breakpoint
CREATE TYPE "public"."corrective_action_status" AS ENUM('Open', 'Closed');--> statement-breakpoint
CREATE TYPE "public"."likelihood_impact" AS ENUM('Low', 'Medium', 'High');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('Low', 'Medium', 'High', 'Critical');--> statement-breakpoint
CREATE TYPE "public"."triage_decision" AS ENUM('Accepted', 'Escalated', 'Dismissed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ComplianceManager', 'Auditor', 'Reporter');--> statement-breakpoint
CREATE TABLE "audit_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" integer GENERATED ALWAYS AS IDENTITY (sequence name "audit_entries_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"case_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_name" text NOT NULL,
	"actor_role" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"likelihood" "likelihood_impact" NOT NULL,
	"impact" "likelihood_impact" NOT NULL,
	"risk_level" "risk_level" NOT NULL,
	"status" "case_status" DEFAULT 'Reported' NOT NULL,
	"reporter_id" uuid NOT NULL,
	"triage_decision" "triage_decision",
	"triaged_at" timestamp with time zone,
	"triaged_by" uuid,
	"investigation_required" boolean,
	"corrective_action_required" boolean,
	"review_note" text,
	"investigation_outcome" text,
	"corrective_action_status" "corrective_action_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" uuid
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'Reporter' NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
