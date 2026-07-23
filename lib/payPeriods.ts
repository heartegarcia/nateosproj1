import { endOfMonth, format, parseISO } from "date-fns";

export interface PayPeriod {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD, inclusive
}

/** Semi-monthly periods: the 1st–15th, and the 16th–end of month (28/29/30/31
 * depending on the month). `month` is 1-indexed. */
function periodForHalf(year: number, month: number, isFirstHalf: boolean): PayPeriod {
  const start = new Date(year, month - 1, isFirstHalf ? 1 : 16);
  const end = isFirstHalf ? new Date(year, month - 1, 15) : endOfMonth(new Date(year, month - 1, 16));
  return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd") };
}

export function getPeriodForDate(dateStr: string): PayPeriod {
  const date = parseISO(dateStr);
  return periodForHalf(date.getFullYear(), date.getMonth() + 1, date.getDate() <= 15);
}

export function getCurrentPeriod(today: string): PayPeriod {
  return getPeriodForDate(today);
}

/** Most recent `count` semi-monthly pay periods, newest first, including the current one. */
export function listRecentPeriods(today: string, count: number): PayPeriod[] {
  const current = getPeriodForDate(today);
  const currentStart = parseISO(current.start);
  let year = currentStart.getFullYear();
  let month = currentStart.getMonth() + 1;
  let isFirstHalf = currentStart.getDate() === 1;

  const periods: PayPeriod[] = [];
  for (let i = 0; i < count; i++) {
    periods.push(periodForHalf(year, month, isFirstHalf));
    if (isFirstHalf) {
      // Previous period is the second half of the prior month.
      month -= 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
      isFirstHalf = false;
    } else {
      // Previous period is the first half of the same month.
      isFirstHalf = true;
    }
  }
  return periods;
}
