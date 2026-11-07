/**
 * TeamOS Risk Engine — Pure Work Calendar
 *
 * Rules:
 * - Monday through Friday are working days.
 * - Saturday and Sunday are non-working weekend days.
 * - Zero network, database, or library dependencies.
 * - High performance O(1) integer arithmetic for all date operations.
 */

const MS_PER_DAY = 86_400_000;

/**
 * Parses an ISO date string (YYYY-MM-DD) into integer epoch days.
 * Timezone-agnostic: uses pure UTC date parts.
 */
export function parseIsoDate(isoDate: string): number {
  const parts = isoDate.split("-");
  if (parts.length !== 3) {
    throw new Error(
      `Invalid ISO date format: "${isoDate}". Expected YYYY-MM-DD.`,
    );
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid ISO date components in: "${isoDate}".`);
  }

  return Math.floor(Date.UTC(year, month, day) / MS_PER_DAY);
}

/**
 * Formats integer epoch days into an ISO date string (YYYY-MM-DD).
 */
export function formatEpochDay(epochDay: number): string {
  const date = new Date(epochDay * MS_PER_DAY);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns the day of the week for an epoch day:
 * 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday.
 * (Epoch day 0, 1970-01-01, was a Thursday = 4).
 */
export function getDayOfWeek(epochDay: number): number {
  return (((epochDay + 4) % 7) + 7) % 7;
}

/**
 * Returns true if the given epoch day is a Monday-Friday workday.
 */
export function isWorkday(epochDay: number): boolean {
  const dow = getDayOfWeek(epochDay);
  return dow >= 1 && dow <= 5;
}

/**
 * Returns true if the ISO date string falls on a Monday-Friday workday.
 */
export function isIsoWorkday(isoDate: string): boolean {
  return isWorkday(parseIsoDate(isoDate));
}

/**
 * If the given epoch day is a weekend, advances to the next Monday (direction = +1)
 * or rolls back to the previous Friday (direction = -1).
 * If already a workday, returns the epoch day unchanged.
 */
export function snapToWorkday(epochDay: number, direction: 1 | -1 = 1): number {
  const dow = getDayOfWeek(epochDay);
  if (dow >= 1 && dow <= 5) {
    return epochDay;
  }
  if (direction === 1) {
    // Saturday (6) -> +2 days to Monday
    // Sunday (0) -> +1 day to Monday
    return dow === 6 ? epochDay + 2 : epochDay + 1;
  } else {
    // Saturday (6) -> -1 day to Friday
    // Sunday (0) -> -2 days to Friday
    return dow === 6 ? epochDay - 1 : epochDay - 2;
  }
}

/**
 * Returns the immediate next workday strictly AFTER the given epoch day.
 */
export function nextWorkday(epochDay: number): number {
  const next = epochDay + 1;
  return snapToWorkday(next, 1);
}

/**
 * Returns the immediate previous workday strictly BEFORE the given epoch day.
 */
export function previousWorkday(epochDay: number): number {
  const prev = epochDay - 1;
  return snapToWorkday(prev, -1);
}

/**
 * Calculates Early Finish date for a task starting on `startEpochDay` with `durationWorkdays`.
 *
 * Convention (CPM Finish-to-Start):
 * - If duration is 0 workdays: finishes on start day (milestone).
 * - If duration is 1 workday (e.g. Monday): finishes on Monday.
 * - If duration is 2 workdays (e.g. Monday): finishes on Tuesday.
 *
 * Automatically snaps startEpochDay to a valid workday if it falls on a weekend.
 */
export function computeEarlyFinish(
  startEpochDay: number,
  durationWorkdays: number,
): number {
  const validStart = snapToWorkday(startEpochDay, 1);
  if (durationWorkdays <= 0) {
    return validStart;
  }

  // A task of N days starting on validStart occupies validStart and N - 1 subsequent workdays.
  let current = validStart;
  for (let i = 1; i < durationWorkdays; i++) {
    current = nextWorkday(current);
  }
  return current;
}

/**
 * Calculates Late Start date for a task finishing on `finishEpochDay` with `durationWorkdays`.
 *
 * Convention (CPM Backward Pass):
 * - If duration is 0: starts on finish day.
 * - If duration is 1 (e.g. Friday): starts on Friday.
 * - If duration is 2 (e.g. Friday): starts on Thursday.
 */
export function computeLateStart(
  finishEpochDay: number,
  durationWorkdays: number,
): number {
  const validFinish = snapToWorkday(finishEpochDay, -1);
  if (durationWorkdays <= 0) {
    return validFinish;
  }

  let current = validFinish;
  for (let i = 1; i < durationWorkdays; i++) {
    current = previousWorkday(current);
  }
  return current;
}

/**
 * Computes the signed number of working days between two dates:
 * positive if finish > start, negative if finish < start, 0 if finish === start.
 *
 * Counting logic:
 * Count of working days strictly between the two dates (exclusive of start, inclusive of finish),
 * with correct sign.
 */
export function workdaysDifference(
  startEpochDay: number,
  finishEpochDay: number,
): number {
  if (startEpochDay === finishEpochDay) {
    return 0;
  }

  if (finishEpochDay > startEpochDay) {
    let count = 0;
    let curr = startEpochDay + 1;
    while (curr <= finishEpochDay) {
      if (isWorkday(curr)) {
        count++;
      }
      curr++;
    }
    return count;
  } else {
    let count = 0;
    let curr = startEpochDay;
    while (curr > finishEpochDay) {
      if (isWorkday(curr)) {
        count++;
      }
      curr--;
    }
    return -count;
  }
}

/**
 * Adds N working days to an epoch day (advances by N workdays).
 */
export function addWorkdays(epochDay: number, workdays: number): number {
  if (workdays === 0) {
    return snapToWorkday(epochDay, 1);
  }

  let current = epochDay;
  if (workdays > 0) {
    current = snapToWorkday(current, 1);
    for (let i = 0; i < workdays; i++) {
      current = nextWorkday(current);
    }
    return current;
  } else {
    current = snapToWorkday(current, -1);
    const abs = Math.abs(workdays);
    for (let i = 0; i < abs; i++) {
      current = previousWorkday(current);
    }
    return current;
  }
}
