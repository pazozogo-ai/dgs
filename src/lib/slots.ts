export type AvailabilityBlock = {
  weekday: number; // 0=Mon ... 6=Sun
  start_min: number;
  end_min: number;
};

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function weekdayMon0(date: Date): number {
  const js = date.getDay(); // 0..6, 0 is Sun
  return (js + 6) % 7;
}

export function buildSlotsForNextDays(params: {
  now: Date;
  days: number;
  slotMinutes: number;
  availability: AvailabilityBlock[];
}) {
  const { now, days, slotMinutes, availability } = params;
  const slots: { startAt: Date; endAt: Date }[] = [];

  for (let di = 0; di < days; di++) {
    const day = addDays(now, di);
    const wd = weekdayMon0(day);
    const blocks = availability.filter((a) => a.weekday === wd);

    for (const b of blocks) {
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const base = start.getTime();

      for (let t = b.start_min; t + slotMinutes <= b.end_min; t += slotMinutes) {
        const s = new Date(base + t * 60_000);
        const e = new Date(base + (t + slotMinutes) * 60_000);
        if (e.getTime() <= now.getTime()) continue;
        slots.push({ startAt: s, endAt: e });
      }
    }
  }

  return slots;
}
