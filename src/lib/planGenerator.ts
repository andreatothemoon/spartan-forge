import { addDays, differenceInWeeks, format, startOfWeek, getDay } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

type DaysAvailable = Record<string, boolean>;
type MaxMinutes = Record<string, number>;

interface GenerateInput {
  startDate: Date;
  raceDate: Date;
  daysAvailable: DaysAvailable;
  maxMinutes: MaxMinutes;
  preferredLongRunDay: string;
  weekendLongRunAvoid: boolean;
  thresholdPace?: number;
  thresholdHr?: number;
}

interface GeneratedSession {
  session_date: string;
  title: string;
  session_type: string;
  primary_target: string;
  notes: string;
  steps: GeneratedStep[];
}

interface GeneratedStep {
  step_order: number;
  step_type: string;
  duration_type: string;
  duration_value: number;
  target_pace_low_sec_per_km: number | null;
  target_pace_high_sec_per_km: number | null;
  target_hr_low_bpm: number | null;
  target_hr_high_bpm: number | null;
  step_notes: string | null;
}

const DAY_MAP: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function getDayKey(date: Date): string {
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return keys[getDay(date)];
}

export function generatePlan(input: GenerateInput): GeneratedSession[] {
  const { startDate, raceDate, daysAvailable, maxMinutes, preferredLongRunDay, weekendLongRunAvoid } = input;
  const totalWeeks = Math.max(1, differenceInWeeks(raceDate, startDate));
  const sessions: GeneratedSession[] = [];

  // Get available days sorted
  const availableDays = Object.entries(daysAvailable)
    .filter(([_, v]) => v)
    .map(([k]) => k);

  if (availableDays.length === 0) return sessions;

  // Determine long run day
  let longRunDay = preferredLongRunDay;
  if (!availableDays.includes(longRunDay)) {
    longRunDay = availableDays[availableDays.length - 1];
  }
  if (weekendLongRunAvoid && (longRunDay === 'sat' || longRunDay === 'sun')) {
    const nonWeekend = availableDays.filter(d => d !== 'sat' && d !== 'sun');
    if (nonWeekend.length > 0) longRunDay = nonWeekend[nonWeekend.length - 1];
  }

  // Classify days
  const qualityDays: string[] = [];
  const easyDays: string[] = [];
  
  for (const day of availableDays) {
    if (day === longRunDay) continue;
    const mins = maxMinutes[day] || 45;
    if (mins >= 45 && qualityDays.length < 2) {
      qualityDays.push(day);
    } else {
      easyDays.push(day);
    }
  }

  const tp = input.thresholdPace || 330; // 5:30/km default
  const thr = input.thresholdHr || 165;

  for (let week = 0; week < totalWeeks; week++) {
    const weekStart = addDays(startDate, week * 7);
    const phase = week / totalWeeks;
    const isRecoveryWeek = week % 4 === 3;

    // Long run
    const longRunDate = getDateForDay(weekStart, longRunDay);
    if (longRunDate <= raceDate) {
      const maxMins = maxMinutes[longRunDay] || 90;
      const duration = isRecoveryWeek ? Math.round(maxMins * 0.6) : maxMins;
      sessions.push(createLongRun(longRunDate, duration, tp, thr, phase));
    }

    // Quality sessions
    const qualityTypes = phase < 0.3 ? ['tempo'] : phase < 0.7 ? ['interval', 'tempo'] : ['interval', 'race_sim'];
    for (let i = 0; i < qualityDays.length; i++) {
      const day = qualityDays[i];
      const date = getDateForDay(weekStart, day);
      if (date > raceDate) continue;
      const maxMins = maxMinutes[day] || 45;
      const dur = isRecoveryWeek ? Math.round(maxMins * 0.7) : maxMins;
      const type = qualityTypes[i % qualityTypes.length];
      if (type === 'interval') {
        sessions.push(createIntervalSession(date, dur, tp, thr));
      } else if (type === 'race_sim') {
        sessions.push(createRaceSimSession(date, dur, tp, thr));
      } else {
        sessions.push(createTempoSession(date, dur, tp, thr));
      }
    }

    // Easy days
    for (const day of easyDays) {
      const date = getDateForDay(weekStart, day);
      if (date > raceDate) continue;
      const maxMins = maxMinutes[day] || 30;
      const dur = isRecoveryWeek ? Math.round(maxMins * 0.6) : Math.round(maxMins * 0.8);
      sessions.push(createEasyRun(date, dur, tp, thr));
    }
  }

  return sessions.sort((a, b) => a.session_date.localeCompare(b.session_date));
}

function getDateForDay(weekStart: Date, dayKey: string): Date {
  const mondayStart = startOfWeek(weekStart, { weekStartsOn: 1 });
  const dayIndex = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(dayKey);
  return addDays(mondayStart, dayIndex);
}

function createEasyRun(date: Date, mins: number, tp: number, thr: number): GeneratedSession {
  const warmup = Math.min(300, mins * 60 * 0.15);
  const cooldown = Math.min(300, mins * 60 * 0.15);
  const main = mins * 60 - warmup - cooldown;
  return {
    session_date: format(date, 'yyyy-MM-dd'),
    title: 'Easy Run',
    session_type: 'easy',
    primary_target: 'hr',
    notes: 'Keep it conversational. Zone 2 effort.',
    steps: [
      makeStep(0, 'warmup', 'time', warmup, null, null, Math.round(thr * 0.65), Math.round(thr * 0.75), 'Easy warmup'),
      makeStep(1, 'work', 'time', main, Math.round(tp * 1.15), Math.round(tp * 1.25), Math.round(thr * 0.75), Math.round(thr * 0.85), 'Easy pace, Zone 2'),
      makeStep(2, 'cooldown', 'time', cooldown, null, null, null, null, 'Walk/easy jog'),
    ],
  };
}

function createLongRun(date: Date, mins: number, tp: number, thr: number, phase: number): GeneratedSession {
  const warmup = 600;
  const cooldown = 600;
  const main = mins * 60 - warmup - cooldown;
  return {
    session_date: format(date, 'yyyy-MM-dd'),
    title: 'Long Run',
    session_type: 'long',
    primary_target: 'hr',
    notes: `Build endurance. ${phase > 0.5 ? 'Include some tempo segments in the last third.' : 'Stay in Zone 2 throughout.'}`,
    steps: [
      makeStep(0, 'warmup', 'time', warmup, null, null, Math.round(thr * 0.65), Math.round(thr * 0.75), 'Easy warmup'),
      makeStep(1, 'work', 'time', main, Math.round(tp * 1.1), Math.round(tp * 1.25), Math.round(thr * 0.75), Math.round(thr * 0.85), 'Steady, Zone 2'),
      makeStep(2, 'cooldown', 'time', cooldown, null, null, null, null, 'Easy cooldown'),
    ],
  };
}

function createTempoSession(date: Date, mins: number, tp: number, thr: number): GeneratedSession {
  const warmup = 600;
  const cooldown = 300;
  const tempoTime = Math.round((mins * 60 - warmup - cooldown) * 0.7);
  const easyBefore = Math.round((mins * 60 - warmup - cooldown - tempoTime) / 2);
  return {
    session_date: format(date, 'yyyy-MM-dd'),
    title: 'Tempo Run',
    session_type: 'tempo',
    primary_target: 'pace',
    notes: 'Comfortably hard. Zone 3-4 effort.',
    steps: [
      makeStep(0, 'warmup', 'time', warmup, null, null, null, null, 'Easy warmup with strides'),
      makeStep(1, 'work', 'time', easyBefore, Math.round(tp * 1.1), Math.round(tp * 1.2), null, null, 'Easy transition'),
      makeStep(2, 'work', 'time', tempoTime, Math.round(tp * 0.98), Math.round(tp * 1.05), Math.round(thr * 0.88), Math.round(thr * 0.95), 'Tempo effort'),
      makeStep(3, 'cooldown', 'time', cooldown, null, null, null, null, 'Cool down'),
    ],
  };
}

function createIntervalSession(date: Date, mins: number, tp: number, thr: number): GeneratedSession {
  const warmup = 600;
  const cooldown = 300;
  const remaining = mins * 60 - warmup - cooldown;
  const reps = Math.max(3, Math.min(8, Math.floor(remaining / 240)));
  const workTime = 120;
  const recoveryTime = Math.round((remaining - reps * workTime) / (reps - 1));

  const steps: GeneratedStep[] = [
    makeStep(0, 'warmup', 'time', warmup, null, null, null, null, 'Easy warmup with 4 strides'),
  ];

  let order = 1;
  for (let i = 0; i < reps; i++) {
    steps.push(makeStep(order++, 'work', 'time', workTime, Math.round(tp * 0.85), Math.round(tp * 0.92), Math.round(thr * 0.92), Math.round(thr * 1.02), `Rep ${i + 1}/${reps}`));
    if (i < reps - 1) {
      steps.push(makeStep(order++, 'recover', 'time', recoveryTime, null, null, null, null, 'Easy jog recovery'));
    }
  }
  steps.push(makeStep(order, 'cooldown', 'time', cooldown, null, null, null, null, 'Cool down'));

  return {
    session_date: format(date, 'yyyy-MM-dd'),
    title: `${reps}x${workTime / 60}min Intervals`,
    session_type: 'interval',
    primary_target: 'pace',
    notes: 'Hard intervals with jog recovery. Push Zone 4-5.',
    steps,
  };
}

function createRaceSimSession(date: Date, mins: number, tp: number, thr: number): GeneratedSession {
  const warmup = 600;
  const cooldown = 300;
  const main = mins * 60 - warmup - cooldown;
  return {
    session_date: format(date, 'yyyy-MM-dd'),
    title: 'Race Simulation',
    session_type: 'race_sim',
    primary_target: 'pace',
    notes: 'Practice race pace and nutrition strategy.',
    steps: [
      makeStep(0, 'warmup', 'time', warmup, null, null, null, null, 'Easy warmup'),
      makeStep(1, 'work', 'time', Math.round(main * 0.4), Math.round(tp * 1.05), Math.round(tp * 1.15), null, null, 'Easy start'),
      makeStep(2, 'work', 'time', Math.round(main * 0.4), Math.round(tp * 0.95), Math.round(tp * 1.05), null, null, 'Race pace'),
      makeStep(3, 'work', 'time', Math.round(main * 0.2), Math.round(tp * 0.88), Math.round(tp * 0.95), null, null, 'Push finish'),
      makeStep(4, 'cooldown', 'time', cooldown, null, null, null, null, 'Cool down'),
    ],
  };
}

function makeStep(
  order: number, type: string, durType: string, durValue: number,
  paceLow: number | null, paceHigh: number | null,
  hrLow: number | null, hrHigh: number | null,
  notes: string | null
): GeneratedStep {
  return {
    step_order: order,
    step_type: type,
    duration_type: durType,
    duration_value: Math.round(durValue),
    target_pace_low_sec_per_km: paceLow,
    target_pace_high_sec_per_km: paceHigh,
    target_hr_low_bpm: hrLow,
    target_hr_high_bpm: hrHigh,
    step_notes: notes,
  };
}
