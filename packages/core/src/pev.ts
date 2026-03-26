import {
  TimeSession,
  DEFAULT_PEV,
  PEV_ACTIVATION_MIN_DAYS,
  PEV_ACTIVATION_MIN_SESSIONS,
  PEV_ACTIVATION_MIN_TASKS,
} from "./types";

/**
 * Compute Personal Execution Velocity from completed time sessions.
 * PEV = weighted average of (actual / estimated) ratios.
 * Recent sessions are weighted more heavily.
 *
 * Returns DEFAULT_PEV (1.25) if activation threshold is not met.
 */
export function computePEV(
  sessions: TimeSession[],
  completedTaskCount: number,
  daysActive: number
): number {
  const valid = sessions.filter((s) => s.isValid && s.estimatedMinutes > 0);

  // PRD §5.4.3: activate when >=10 tasks OR (>=8 sessions AND >=2 days)
  const thresholdMet =
    completedTaskCount >= PEV_ACTIVATION_MIN_TASKS ||
    (valid.length >= PEV_ACTIVATION_MIN_SESSIONS &&
      daysActive >= PEV_ACTIVATION_MIN_DAYS);

  if (!thresholdMet || valid.length === 0) return DEFAULT_PEV;

  // Use last 20 sessions max, newer sessions get higher weight
  const recent = valid.slice(-20);
  let weightedSum = 0;
  let totalWeight = 0;

  recent.forEach((s, i) => {
    const weight = i + 1; // linear recency weight
    const ratio = s.actualMinutes / s.estimatedMinutes;
    weightedSum += ratio * weight;
    totalWeight += weight;
  });

  const pev = weightedSum / totalWeight;

  // Clamp: never below 0.5 (unrealistically fast) or above 3.0 (extreme underestimator)
  return Math.min(3.0, Math.max(0.5, pev));
}

export function isPEVCalibrated(
  completedTaskCount: number,
  sessionCount: number,
  daysActive: number
): boolean {
  return (
    completedTaskCount >= PEV_ACTIVATION_MIN_TASKS ||
    (sessionCount >= PEV_ACTIVATION_MIN_SESSIONS &&
      daysActive >= PEV_ACTIVATION_MIN_DAYS)
  );
}
