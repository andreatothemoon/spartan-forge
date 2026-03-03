

# Progressive Overload for Plan Generator

## Problem
Currently, `maxMinutes` is treated as a flat ceiling for every week. A runner who says "90 min max on Saturdays" gets 90-minute long runs from week 1 to the final week (minus recovery weeks). Real training plans start lower and build up.

## Approach
Introduce a **volume scaling curve** so that `maxMinutes` represents the **peak** value, and early weeks start at a fraction of that peak, ramping up over the training block.

### Volume Scaling Formula

A `getWeeklyVolumeFactor(week, totalWeeks, isRecoveryWeek)` helper will return a multiplier between 0 and 1:

- **Starting factor**: 0.6 (week 0 uses 60% of max)
- **Peak factor**: 1.0 (reached around week `totalWeeks - 2`, the penultimate week)
- **Taper**: Final 1-2 weeks drop to ~0.7 for race freshness
- **Recovery weeks**: Override to 0.55-0.65 (lower than current 0.6-0.7 flat cut)

The ramp uses linear interpolation across the build phase, giving a smooth increase.

```text
Volume
  |          ___
  |        /    \
  |      /   R   \  <- taper
  |    / R        |
  |  /            |
  |/_R____________|___
  Week 0        Race
  (R = recovery dips)
```

### Changes to `planGenerator.ts`

1. **Add `getWeeklyVolumeFactor` function**
   - Inputs: `week`, `totalWeeks`, `isRecoveryWeek`
   - Returns a multiplier (0.55 to 1.0)
   - Logic:
     - If recovery week: return `baseFactor * 0.65`
     - If in taper (last 2 weeks): lerp down to 0.7
     - Otherwise: lerp from 0.6 to 1.0 across the build phase

2. **Update the main loop in `generatePlan`**
   - Compute `volumeFactor` at the start of each week iteration
   - Replace the current flat/recovery duration calculations:
     - **Long run** (line 94): `maxMins * volumeFactor` instead of `isRecoveryWeek ? maxMins * 0.6 : maxMins`
     - **Quality sessions** (line 105): `maxMins * volumeFactor` instead of `isRecoveryWeek ? maxMins * 0.7 : maxMins`
     - **Easy days** (line 121): `maxMins * volumeFactor` instead of the current ternary

3. **Add taper annotation to session notes**
   - During taper weeks, append a note like "Taper week -- reduced volume" to session notes so users understand the drop

### Example Progression (16-week plan, 90-min max long run)

| Week | Factor | Long Run | Notes |
|------|--------|----------|-------|
| 1    | 0.60   | 54 min   | Build |
| 2    | 0.63   | 57 min   | Build |
| 3    | 0.66   | 59 min   | Build |
| 4    | 0.42   | 38 min   | Recovery |
| ...  | ...    | ...      | ... |
| 13   | 0.94   | 85 min   | Build |
| 14   | 1.00   | 90 min   | Peak |
| 15   | 0.85   | 77 min   | Taper |
| 16   | 0.70   | 63 min   | Taper |

### File touched
- `src/lib/planGenerator.ts` -- only file modified

No database changes, no new dependencies required.
