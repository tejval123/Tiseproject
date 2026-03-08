import {
  TIME_BANK_CAP_PER_TASK_MINUTES,
  TIME_BANK_MAX_PER_TASK_RATIO,
  TimeBankState,
} from "./types";

export interface TimeBankDepositResult {
  deposited: number;
  newBalance: number;
  message: string;
}

export interface TimeBankWithdrawResult {
  withdrawn: number;
  newBalance: number;
  overflow: number;   // minutes that couldn't be covered — triggers slip detection
  message: string;
}

/**
 * Deposit earned minutes when a task session finishes early.
 * Deposit = min(25% of budgeted, 15 min).
 * Minimum 5 actual minutes required.
 */
export function depositTimeBank(
  bank: TimeBankState,
  actualMinutes: number,
  budgetedMinutes: number
): TimeBankDepositResult {
  if (actualMinutes >= budgetedMinutes) {
    return { deposited: 0, newBalance: bank.balanceMinutes, message: "No early finish — nothing deposited" };
  }
  if (actualMinutes < 5) {
    return { deposited: 0, newBalance: bank.balanceMinutes, message: "Session too short to count" };
  }

  const cap = Math.min(
    budgetedMinutes * TIME_BANK_MAX_PER_TASK_RATIO,
    TIME_BANK_CAP_PER_TASK_MINUTES
  );
  const deposit = Math.min(budgetedMinutes - actualMinutes, cap);
  const rounded = Math.floor(deposit);
  const newBalance = bank.balanceMinutes + rounded;

  return {
    deposited: rounded,
    newBalance,
    message: `+${rounded} min added to Time Bank`,
  };
}

/**
 * Withdraw from Time Bank when a session overruns.
 * Returns overflow > 0 if bank couldn't fully cover — triggers slip detection.
 */
export function withdrawTimeBank(
  bank: TimeBankState,
  actualMinutes: number,
  budgetedMinutes: number
): TimeBankWithdrawResult {
  if (actualMinutes <= budgetedMinutes) {
    return { withdrawn: 0, newBalance: bank.balanceMinutes, overflow: 0, message: "No overrun" };
  }

  const overrun = actualMinutes - budgetedMinutes;
  const withdrawn = Math.min(overrun, bank.balanceMinutes);
  const overflow = overrun - withdrawn;
  const newBalance = bank.balanceMinutes - withdrawn;

  const message =
    withdrawn > 0
      ? `Used ${withdrawn} bank min to keep today on track`
      : "Time Bank empty — slip detection triggered";

  return { withdrawn, newBalance, overflow, message };
}

/**
 * Reset Time Bank at midnight. Optionally carry over up to 10 min (future config).
 */
export function rolloverTimeBank(bank: TimeBankState, nextDate: string): TimeBankState {
  return {
    userId: bank.userId,
    date: nextDate,
    balanceMinutes: 0,
  };
}
