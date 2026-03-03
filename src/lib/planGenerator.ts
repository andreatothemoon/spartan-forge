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
  obstacleSessionsPerWeek?: number;
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

/**
 * Returns a volume scaling factor (0.55–1.0) for progressive overload.
 */
export function getWeeklyVolumeFactor(week: number, totalWeeks: number, isRecoveryWeek: boolean): number {
  const taperWeeks = Math.min(2, Math.floor(totalWeeks * 0.12));
  const peakWeek = totalWeeks - taperWeeks - 1;

  let baseFactor: number;
  if (peakWeek <= 0) {
    baseFactor = 0.8;
  } else {
    const progress = Math.min(week / peakWeek, 1);
    baseFactor = 0.6 + progress * 0.4;
  }

  if (week >= totalWeeks - taperWeeks) {
    const taperIndex = week - (totalWeeks - taperWeeks);
    const taperFactor = 0.85 - taperIndex * 0.15;
    return Math.max(0.55, taperFactor);
  }

  if (isRecoveryWeek) {
    return Math.max(0.55, baseFactor * 0.65);
  }

  return baseFactor;
}

function getDayKey(date: Date): string {
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return keys[getDay(date)];
}

export function generatePlan(input: GenerateInput): GeneratedSession[] {
  const { startDate, raceDate, daysAvailable, maxMinutes, preferredLongRunDay, weekendLongRunAvoid } = input;
  const totalWeeks = Math.max(1, differenceInWeeks(raceDate, startDate));
  const sessions: GeneratedSession[] = [];
  const obstaclePerWeek = input.obstacleSessionsPerWeek ?? 0;

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

  // Pick obstacle days from easy days (or quality days if not enough easy days)
  const obstacleDays: string[] = [];
  const remainingEasy: string[] = [];
  for (const day of easyDays) {
    if (obstacleDays.length < obstaclePerWeek) {
      obstacleDays.push(day);
    } else {
      remainingEasy.push(day);
    }
  }

  const tp = input.thresholdPace || 330; // 5:30/km default
  const thr = input.thresholdHr || 165;

  for (let week = 0; week < totalWeeks; week++) {
    const weekStart = addDays(startDate, week * 7);
    const phase = week / totalWeeks;
    const isRecoveryWeek = week % 4 === 3;
    const volumeFactor = getWeeklyVolumeFactor(week, totalWeeks, isRecoveryWeek);

    // Determine week annotation for notes
    const taperWeeks = Math.min(2, Math.floor(totalWeeks * 0.12));
    const isTaperWeek = week >= totalWeeks - taperWeeks;
    const weekNote = isTaperWeek ? ' | Taper week – reduced volume.' : isRecoveryWeek ? ' | Recovery week – reduced volume.' : '';

    // Long run
    const longRunDate = getDateForDay(weekStart, longRunDay);
    if (longRunDate <= raceDate) {
      const maxMins = maxMinutes[longRunDay] || 90;
      const duration = Math.round(maxMins * volumeFactor);
      sessions.push(createLongRun(longRunDate, duration, tp, thr, phase, weekNote));
    }

    // Quality sessions
    const qualityTypes = phase < 0.3 ? ['tempo'] : phase < 0.7 ? ['interval', 'tempo'] : ['interval', 'race_sim'];
    for (let i = 0; i < qualityDays.length; i++) {
      const day = qualityDays[i];
      const date = getDateForDay(weekStart, day);
      if (date > raceDate) continue;
      const maxMins = maxMinutes[day] || 45;
      const dur = Math.round(maxMins * volumeFactor);
      const type = qualityTypes[i % qualityTypes.length];
      if (type === 'interval') {
        sessions.push(createIntervalSession(date, dur, tp, thr, phase, isTaperWeek, weekNote));
      } else if (type === 'race_sim') {
        sessions.push(createRaceSimSession(date, dur, tp, thr, weekNote));
      } else {
        sessions.push(createTempoSession(date, dur, tp, thr, weekNote));
      }
    }

    // Obstacle training sessions
    for (const day of obstacleDays) {
      const date = getDateForDay(weekStart, day);
      if (date > raceDate) continue;
      const maxMins = maxMinutes[day] || 45;
      const dur = Math.round(maxMins * volumeFactor);
      sessions.push(createObstacleSession(date, dur, thr, phase, weekNote));
    }

    // Easy days (remaining after obstacle allocation)
    for (const day of remainingEasy) {
      const date = getDateForDay(weekStart, day);
      if (date > raceDate) continue;
      const maxMins = maxMinutes[day] || 30;
      const dur = Math.round(maxMins * volumeFactor);
      sessions.push(createEasyRun(date, dur, tp, thr, weekNote));
    }
  }

  return sessions.sort((a, b) => a.session_date.localeCompare(b.session_date));
}

function getDateForDay(weekStart: Date, dayKey: string): Date {
  const mondayStart = startOfWeek(weekStart, { weekStartsOn: 1 });
  const dayIndex = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(dayKey);
  return addDays(mondayStart, dayIndex);
}

function createEasyRun(date: Date, mins: number, tp: number, thr: number, weekNote: string = ''): GeneratedSession {
  const warmup = Math.min(300, mins * 60 * 0.15);
  const cooldown = Math.min(300, mins * 60 * 0.15);
  const main = mins * 60 - warmup - cooldown;
  return {
    session_date: format(date, 'yyyy-MM-dd'),
    title: 'Easy Run',
    session_type: 'easy',
    primary_target: 'hr',
    notes: 'Keep it conversational. Zone 2 effort.' + weekNote,
    steps: [
      makeStep(0, 'warmup', 'time', warmup, null, null, Math.round(thr * 0.65), Math.round(thr * 0.75), 'Easy warmup'),
      makeStep(1, 'work', 'time', main, Math.round(tp * 1.15), Math.round(tp * 1.25), Math.round(thr * 0.75), Math.round(thr * 0.85), 'Easy pace, Zone 2'),
      makeStep(2, 'cooldown', 'time', cooldown, null, null, null, null, 'Walk/easy jog'),
    ],
  };
}

function createLongRun(date: Date, mins: number, tp: number, thr: number, phase: number, weekNote: string = ''): GeneratedSession {
  const warmup = 600;
  const cooldown = 600;
  const main = mins * 60 - warmup - cooldown;
  return {
    session_date: format(date, 'yyyy-MM-dd'),
    title: 'Long Run',
    session_type: 'long',
    primary_target: 'hr',
    notes: `Build endurance. ${phase > 0.5 ? 'Include some tempo segments in the last third.' : 'Stay in Zone 2 throughout.'}` + weekNote,
    steps: [
      makeStep(0, 'warmup', 'time', warmup, null, null, Math.round(thr * 0.65), Math.round(thr * 0.75), 'Easy warmup'),
      makeStep(1, 'work', 'time', main, Math.round(tp * 1.1), Math.round(tp * 1.25), Math.round(thr * 0.75), Math.round(thr * 0.85), 'Steady, Zone 2'),
      makeStep(2, 'cooldown', 'time', cooldown, null, null, null, null, 'Easy cooldown'),
    ],
  };
}

/**
 * Tempo session: continuous intervals without rest.
 * Structure: 1km at race pace, 500m hard pace, 500m recovery pace — repeating.
 */
function createTempoSession(date: Date, mins: number, tp: number, thr: number, weekNote: string = ''): GeneratedSession {
  const warmup = 600;
  const cooldown = 300;
  const mainTime = mins * 60 - warmup - cooldown;

  // Each set is 2km total: 1km race pace + 500m hard + 500m recovery
  // Estimate time per set based on threshold pace
  const raceKmTime = tp; // sec per km at race pace
  const hardKmTime = Math.round(tp * 0.88); // hard pace (faster)
  const recoveryKmTime = Math.round(tp * 1.2); // recovery pace (slower)
  const setTimeSec = raceKmTime + hardKmTime * 0.5 + recoveryKmTime * 0.5;

  const sets = Math.max(2, Math.min(8, Math.floor(mainTime / setTimeSec)));

  const steps: GeneratedStep[] = [
    makeStep(0, 'warmup', 'time', warmup, null, null, null, null, 'Easy warmup with strides'),
  ];

  let order = 1;
  for (let i = 0; i < sets; i++) {
    // 1km at race pace
    steps.push(makeStep(order++, 'work', 'distance', 1000,
      Math.round(tp * 0.97), Math.round(tp * 1.03),
      Math.round(thr * 0.88), Math.round(thr * 0.95),
      `Set ${i + 1}/${sets} — 1km race pace`));
    // 500m hard
    steps.push(makeStep(order++, 'work', 'distance', 500,
      Math.round(tp * 0.85), Math.round(tp * 0.92),
      Math.round(thr * 0.93), Math.round(thr * 1.0),
      `Set ${i + 1}/${sets} — 500m hard`));
    // 500m recovery pace (no rest, just slower running)
    steps.push(makeStep(order++, 'work', 'distance', 500,
      Math.round(tp * 1.15), Math.round(tp * 1.25),
      Math.round(thr * 0.72), Math.round(thr * 0.82),
      `Set ${i + 1}/${sets} — 500m recovery pace`));
  }

  steps.push(makeStep(order, 'cooldown', 'time', cooldown, null, null, null, null, 'Cool down'));

  return {
    session_date: format(date, 'yyyy-MM-dd'),
    title: `${sets}x2km Tempo Intervals`,
    session_type: 'tempo',
    primary_target: 'pace',
    notes: `Continuous tempo: 1km race pace / 500m hard / 500m recovery pace. No stopping.` + weekNote,
    steps,
  };
}

/**
 * Interval session: distance-based reps.
 * - Rep distance: 2km normally, 1km during taper
 * - Reps: 4 early → 8-10 late
 * - Recovery: 60s early → 50s late, standing/walking recovery (no jog)
 */
function createIntervalSession(date: Date, mins: number, tp: number, thr: number, phase: number, isTaper: boolean, weekNote: string = ''): GeneratedSession {
  const warmup = 600;
  const cooldown = 300;

  const repDistance = isTaper ? 1000 : 2000; // meters
  const repLabel = isTaper ? '1km' : '2km';

  // Reps: lerp from 4 to 10 based on phase, cap at 8 during taper
  let reps: number;
  if (isTaper) {
    reps = 4;
  } else {
    reps = Math.round(4 + phase * 6); // 4 → 10
    reps = Math.max(4, Math.min(10, reps));
  }

  // Recovery: 60s early → 50s late
  const recoveryTime = Math.round(60 - phase * 10); // 60 → 50

  const steps: GeneratedStep[] = [
    makeStep(0, 'warmup', 'time', warmup, null, null, null, null, 'Easy warmup with 4 strides'),
  ];

  let order = 1;
  for (let i = 0; i < reps; i++) {
    steps.push(makeStep(order++, 'work', 'distance', repDistance,
      Math.round(tp * 0.85), Math.round(tp * 0.92),
      Math.round(thr * 0.92), Math.round(thr * 1.02),
      `Rep ${i + 1}/${reps} — ${repLabel}`));
    if (i < reps - 1) {
      steps.push(makeStep(order++, 'recover', 'time', recoveryTime,
        null, null, null, null, `${recoveryTime}s recovery`));
    }
  }
  steps.push(makeStep(order, 'cooldown', 'time', cooldown, null, null, null, null, 'Cool down'));

  return {
    session_date: format(date, 'yyyy-MM-dd'),
    title: `${reps}x${repLabel} Intervals`,
    session_type: 'interval',
    primary_target: 'pace',
    notes: `Hard ${repLabel} reps with ${recoveryTime}s standing recovery. Zone 4-5.` + weekNote,
    steps,
  };
}

function createRaceSimSession(date: Date, mins: number, tp: number, thr: number, weekNote: string = ''): GeneratedSession {
  const warmup = 600;
  const cooldown = 300;
  const main = mins * 60 - warmup - cooldown;
  return {
    session_date: format(date, 'yyyy-MM-dd'),
    title: 'Race Simulation',
    session_type: 'race_sim',
    primary_target: 'pace',
    notes: 'Practice race pace and nutrition strategy.' + weekNote,
    steps: [
      makeStep(0, 'warmup', 'time', warmup, null, null, null, null, 'Easy warmup'),
      makeStep(1, 'work', 'time', Math.round(main * 0.4), Math.round(tp * 1.05), Math.round(tp * 1.15), null, null, 'Easy start'),
      makeStep(2, 'work', 'time', Math.round(main * 0.4), Math.round(tp * 0.95), Math.round(tp * 1.05), null, null, 'Race pace'),
      makeStep(3, 'work', 'time', Math.round(main * 0.2), Math.round(tp * 0.88), Math.round(tp * 0.95), null, null, 'Push finish'),
      makeStep(4, 'cooldown', 'time', cooldown, null, null, null, null, 'Cool down'),
    ],
  };
}

/**
 * Spartan obstacle training session.
 * Phases shift focus: early = grip/carry foundations, mid = race simulation, late = speed + obstacles.
 */
function createObstacleSession(date: Date, mins: number, thr: number, phase: number, weekNote: string = ''): GeneratedSession {
  const totalSec = mins * 60;
  const warmup = Math.min(600, Math.round(totalSec * 0.15));
  const cooldown = Math.min(300, Math.round(totalSec * 0.1));
  const mainTime = totalSec - warmup - cooldown;

  // Rotate between obstacle focus areas based on phase
  const steps: GeneratedStep[] = [
    makeStep(0, 'warmup', 'time', warmup, null, null, Math.round(thr * 0.6), Math.round(thr * 0.75), 'Dynamic warmup: arm circles, leg swings, bear crawls'),
  ];

  let order = 1;

  if (phase < 0.4) {
    // Early phase: grip & carry foundations
    const blockTime = Math.round(mainTime / 4);
    steps.push(makeStep(order++, 'work', 'time', blockTime, null, null, null, null, 'Dead hangs & farmers carry – build grip endurance'));
    steps.push(makeStep(order++, 'work', 'time', blockTime, null, null, null, null, 'Bucket carry simulation – heavy pack walk'));
    steps.push(makeStep(order++, 'work', 'time', blockTime, null, null, null, null, 'Burpee sets: 5 burpees EMOM'));
    steps.push(makeStep(order++, 'work', 'time', blockTime, null, null, Math.round(thr * 0.8), Math.round(thr * 0.9), 'Trail run with elevation changes'));
  } else if (phase < 0.7) {
    // Mid phase: race simulation circuits
    const rounds = Math.max(3, Math.min(6, Math.floor(mainTime / 300)));
    const roundTime = Math.round(mainTime / rounds);
    for (let i = 0; i < rounds; i++) {
      steps.push(makeStep(order++, 'work', 'time', roundTime, null, null, Math.round(thr * 0.82), Math.round(thr * 0.95),
        `Circuit ${i + 1}/${rounds}: Run 400m → 10 burpees → carry → rope climb simulation`));
    }
  } else {
    // Late phase: speed + obstacle transitions
    const blockTime = Math.round(mainTime / 5);
    steps.push(makeStep(order++, 'work', 'time', blockTime, null, null, null, null, 'Wall climb practice – technique focus'));
    steps.push(makeStep(order++, 'work', 'time', blockTime, null, null, Math.round(thr * 0.9), Math.round(thr * 1.0), 'Sprint → burpee penalty sets'));
    steps.push(makeStep(order++, 'work', 'time', blockTime, null, null, null, null, 'Rope & monkey bar grip work'));
    steps.push(makeStep(order++, 'work', 'time', blockTime, null, null, Math.round(thr * 0.85), Math.round(thr * 0.95), 'Sandbag carry intervals'));
    steps.push(makeStep(order++, 'work', 'time', blockTime, null, null, null, null, 'Spear throw practice & atlas stone simulation'));
  }

  steps.push(makeStep(order, 'cooldown', 'time', cooldown, null, null, null, null, 'Stretch & mobility: shoulders, forearms, hips'));

  return {
    session_date: format(date, 'yyyy-MM-dd'),
    title: 'Obstacle Training',
    session_type: 'obstacle',
    primary_target: 'hr',
    notes: `Spartan-specific obstacle preparation. ${phase < 0.4 ? 'Foundation phase: grip & carry.' : phase < 0.7 ? 'Race simulation circuits.' : 'Speed & transition drills.'}` + weekNote,
    steps,
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
