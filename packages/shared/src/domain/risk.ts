import type { LikelihoodImpact, RiskLevel } from "../types/case";

const WEIGHT: Record<LikelihoodImpact, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
};

/**
 * Risk is always derived, never supplied (R7).
 *
 *            impact:  Low     Medium   High
 *   likelihood Low     Low     Low      Medium
 *              Medium  Low     Medium   High
 *              High    Medium  High     Critical
 *
 * Critical requires *both* inputs High. A single High can never drop below
 * Medium, and can never reach Critical on its own.
 */
export function calculateRiskLevel(
  likelihood: LikelihoodImpact,
  impact: LikelihoodImpact,
): RiskLevel {
  const score = WEIGHT[likelihood] * WEIGHT[impact];

  if (score >= 9) return "Critical";
  if (score >= 5) return "High";
  if (score >= 3) return "Medium";
  return "Low";
}
