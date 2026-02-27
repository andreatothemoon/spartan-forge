import { secPerKmToDisplay, secondsToDisplay, metersToDisplay } from './paceUtils';

interface ExportStep {
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

interface ExportSession {
  id: string;
  session_date: string;
  title: string;
  session_type: string;
  primary_target: string;
  notes: string | null;
  steps: ExportStep[];
}

/** Export sessions as a canonical JSON file */
export function exportSessionsToJSON(sessions: ExportSession[]): string {
  const data = {
    exportedAt: new Date().toISOString(),
    format: 'spartan-trainer-v1',
    sessions: sessions.map(s => ({
      date: s.session_date,
      title: s.title,
      type: s.session_type,
      primaryTarget: s.primary_target,
      notes: s.notes,
      steps: s.steps.map(st => ({
        order: st.step_order,
        type: st.step_type,
        duration: {
          type: st.duration_type,
          value: st.duration_value,
          display: st.duration_type === 'time'
            ? secondsToDisplay(st.duration_value)
            : metersToDisplay(st.duration_value),
        },
        paceTarget: st.target_pace_low_sec_per_km ? {
          low: secPerKmToDisplay(st.target_pace_low_sec_per_km),
          high: st.target_pace_high_sec_per_km ? secPerKmToDisplay(st.target_pace_high_sec_per_km) : null,
          lowSec: st.target_pace_low_sec_per_km,
          highSec: st.target_pace_high_sec_per_km,
        } : null,
        hrTarget: st.target_hr_low_bpm ? {
          low: st.target_hr_low_bpm,
          high: st.target_hr_high_bpm,
        } : null,
        notes: st.step_notes,
      })),
    })),
  };
  return JSON.stringify(data, null, 2);
}

/** Trigger download of a text file */
export function downloadFile(content: string, filename: string, mimeType = 'application/json') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export as FIT-structured JSON (stub — real FIT binary would require a FIT SDK) */
export function exportSessionsToFITStub(sessions: ExportSession[]): string {
  // FIT file generation is complex and requires a binary encoder.
  // This stub produces a JSON file structured like FIT workout definitions
  // that can later be converted to actual FIT binary format.
  const fitWorkouts = sessions.map(s => ({
    fileType: 'WORKOUT',
    workoutName: `${s.session_date}_${s.title.replace(/\s+/g, '_')}`,
    sport: 'RUNNING',
    subSport: s.session_type === 'interval' ? 'TRACK' : 'STREET',
    numValidSteps: s.steps.length,
    steps: s.steps.map(st => ({
      messageIndex: st.step_order,
      workoutStepName: st.step_notes || st.step_type,
      durationType: st.duration_type === 'time' ? 'TIME' : 'DISTANCE',
      durationValue: st.duration_type === 'time' ? st.duration_value * 1000 : st.duration_value * 100,
      targetType: st.target_pace_low_sec_per_km ? 'SPEED' : st.target_hr_low_bpm ? 'HEART_RATE' : 'OPEN',
      targetValue: 0,
      customTargetLow: st.target_pace_low_sec_per_km
        ? Math.round(1000 / st.target_pace_high_sec_per_km! * 1000)
        : st.target_hr_low_bpm || 0,
      customTargetHigh: st.target_pace_high_sec_per_km
        ? Math.round(1000 / st.target_pace_low_sec_per_km! * 1000)
        : st.target_hr_high_bpm || 0,
      intensity: st.step_type === 'warmup' || st.step_type === 'cooldown' ? 'WARMUP'
        : st.step_type === 'recover' ? 'REST' : 'ACTIVE',
    })),
  }));
  return JSON.stringify(fitWorkouts, null, 2);
}
