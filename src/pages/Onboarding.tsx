import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { User, Clock, Target, ChevronRight, ChevronLeft, Check, Download, FileJson, Watch, Zap, RefreshCw } from 'lucide-react';
import { DAYS, DAY_LABELS, secPerKmToDisplay, displayToSecPerKm, defaultPaceZones, defaultHrZones } from '@/lib/paceUtils';
import { generatePlan } from '@/lib/planGenerator';
import { format, parseISO } from 'date-fns';

const STEPS = ['Athlete Profile', 'Availability', 'Race Goal'];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Athlete profile
  const [displayName, setDisplayName] = useState('');
  const [maxHr, setMaxHr] = useState('');
  const [thresholdHr, setThresholdHr] = useState('');
  const [thresholdPace, setThresholdPace] = useState('5:30');

  // Availability
  const [daysAvailable, setDaysAvailable] = useState<Record<string, boolean>>({
    mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false,
  });
  const [maxMinutes, setMaxMinutes] = useState<Record<string, number>>({
    mon: 45, tue: 45, wed: 45, thu: 45, fri: 90, sat: 0, sun: 0,
  });
  const [longRunDay, setLongRunDay] = useState('fri');
  const [avoidWeekend, setAvoidWeekend] = useState(true);
  const [obstacleSessionsPerWeek, setObstacleSessionsPerWeek] = useState(2);

  // Goal
  const [raceDate, setRaceDate] = useState('2026-09-26');
  const [notes, setNotes] = useState('');

  // Existing IDs for update
  const [profileId, setProfileId] = useState<string | null>(null);
  const [availabilityId, setAvailabilityId] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadExisting();
  }, [user]);

  async function loadExisting() {
    if (!user) return;
    setLoading(true);
    const [profileRes, availRes, goalRes] = await Promise.all([
      supabase.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('availability_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('training_goals').select('*').eq('user_id', user.id).maybeSingle(),
    ]);

    if (profileRes.data) {
      const p = profileRes.data;
      setProfileId(p.id);
      setDisplayName(p.display_name || '');
      setMaxHr(p.max_hr?.toString() || '');
      setThresholdHr(p.threshold_hr?.toString() || '');
      setThresholdPace(p.threshold_pace_sec_per_km ? secPerKmToDisplay(p.threshold_pace_sec_per_km) : '5:30');
    }
    if (availRes.data) {
      const a = availRes.data;
      setAvailabilityId(a.id);
      setDaysAvailable(a.days_available_json as Record<string, boolean>);
      setMaxMinutes(a.max_minutes_by_day_json as Record<string, number>);
      setLongRunDay(a.preferred_long_run_day);
      setAvoidWeekend(a.weekend_long_run_avoid);
      setObstacleSessionsPerWeek(a.obstacle_sessions_per_week ?? 2);
    }
    if (goalRes.data) {
      const g = goalRes.data;
      setGoalId(g.id);
      setRaceDate(g.race_date);
      setNotes(g.notes || '');
    }
    setLoading(false);
  }

  async function saveAll() {
    if (!user) return;
    setSaving(true);
    try {
      const paceSecPerKm = displayToSecPerKm(thresholdPace);
      const paceZones = paceSecPerKm > 0 ? defaultPaceZones(paceSecPerKm) : [];
      const hrZones = thresholdHr ? defaultHrZones(parseInt(thresholdHr)) : [];

      const profileData = {
        user_id: user.id,
        display_name: displayName || user.email?.split('@')[0] || 'Athlete',
        max_hr: maxHr ? parseInt(maxHr) : null,
        threshold_hr: thresholdHr ? parseInt(thresholdHr) : null,
        threshold_pace_sec_per_km: paceSecPerKm || null,
        pace_zones_json: paceZones,
        hr_zones_json: hrZones,
      };

      if (profileId) {
        await supabase.from('athlete_profiles').update(profileData).eq('id', profileId);
      } else {
        const { data } = await supabase.from('athlete_profiles').insert(profileData).select('id').single();
        if (data) setProfileId(data.id);
      }

      const availData = {
        user_id: user.id,
        days_available_json: daysAvailable,
        max_minutes_by_day_json: maxMinutes,
        preferred_long_run_day: longRunDay,
        weekend_long_run_avoid: avoidWeekend,
        obstacle_sessions_per_week: obstacleSessionsPerWeek,
      };

      if (availabilityId) {
        await supabase.from('availability_profiles').update(availData).eq('id', availabilityId);
      } else {
        const { data } = await supabase.from('availability_profiles').insert(availData).select('id').single();
        if (data) setAvailabilityId(data.id);
      }

      const goalData = {
        user_id: user.id,
        goal_type: 'SPARTAN_ULTRA' as string,
        race_date: raceDate,
        notes,
      };

      if (goalId) {
        await supabase.from('training_goals').update(goalData).eq('id', goalId);
      } else {
        const { data } = await supabase.from('training_goals').insert(goalData).select('id').single();
        if (data) setGoalId(data.id);
      }

      toast.success('Configuration saved');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
    setSaving(false);
  }

  if (loading) return <AppLayout><div className="text-center py-20 text-muted-foreground font-mono text-sm">LOADING CONFIG...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => setStep(i)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  i === step ? 'bg-primary/10 text-primary glow-primary' : i < step ? 'text-primary/60' : 'text-muted-foreground'
                }`}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : <span className="font-mono">{i + 1}</span>}
                <span className="hidden sm:inline">{s}</span>
              </button>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
            </div>
          ))}
        </div>

        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          {step === 0 && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" />Athlete Profile</CardTitle>
                <CardDescription>Your physiological data for zone-based training</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Heart Rate (bpm)</Label>
                    <Input type="number" value={maxHr} onChange={e => setMaxHr(e.target.value)} placeholder="190" />
                  </div>
                  <div className="space-y-2">
                    <Label>Threshold HR (bpm)</Label>
                    <Input type="number" value={thresholdHr} onChange={e => setThresholdHr(e.target.value)} placeholder="165" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Threshold Pace (min:sec /km)</Label>
                  <Input value={thresholdPace} onChange={e => setThresholdPace(e.target.value)} placeholder="5:30" className="font-mono" />
                  <p className="text-xs text-muted-foreground">Your lactate threshold or recent race pace</p>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" />Weekly Availability</CardTitle>
                <CardDescription>Which days can you train and for how long?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {DAYS.map(day => (
                    <div key={day} className="flex items-center gap-3">
                      <Switch
                        checked={daysAvailable[day]}
                        onCheckedChange={v => setDaysAvailable(prev => ({ ...prev, [day]: v }))}
                      />
                      <span className="w-20 text-sm font-medium">{DAY_LABELS[day]}</span>
                      <Input
                        type="number"
                        value={maxMinutes[day]}
                        onChange={e => setMaxMinutes(prev => ({ ...prev, [day]: parseInt(e.target.value) || 0 }))}
                        className="w-20 font-mono text-sm"
                        disabled={!daysAvailable[day]}
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                  <div className="space-y-2">
                    <Label>Preferred Long Run Day</Label>
                    <Select value={longRunDay} onValueChange={setLongRunDay}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAYS.filter(d => daysAvailable[d]).map(d => (
                          <SelectItem key={d} value={d}>{DAY_LABELS[d]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Avoid Weekend Long Runs</Label>
                    <div className="flex items-center gap-2 pt-1">
                      <Switch checked={avoidWeekend} onCheckedChange={setAvoidWeekend} />
                      <span className="text-sm text-muted-foreground">{avoidWeekend ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-border/50">
                  <div className="space-y-2">
                    <Label>Obstacle Training Sessions per Week</Label>
                    <Input
                      type="number"
                      min={0}
                      max={4}
                      value={obstacleSessionsPerWeek}
                      onChange={e => setObstacleSessionsPerWeek(Math.max(0, Math.min(4, parseInt(e.target.value) || 0)))}
                      className="w-20 font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Spartan-specific obstacle prep (grip, carry, burpees, walls). Uses easy day slots.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Race Goal</CardTitle>
                <CardDescription>Spartan Ultra — September 26, 2026 (UK)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Race Date</Label>
                  <Input type="date" value={raceDate} onChange={e => setRaceDate(e.target.value)} className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any specific goals or constraints..." />
                </div>
              </CardContent>
            </Card>
          )}

        </motion.div>

        <div className="flex justify-between mt-6">
          <Button variant="ghost" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" />Back
          </Button>
          {step < 2 ? (
            <Button onClick={() => setStep(s => s + 1)}>
              Next<ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={saveAll} disabled={saving} className="glow-primary">
              {saving ? 'Saving...' : 'Save & Continue'}
            </Button>
          )}
        </div>

        {/* Regenerate Plan */}
        <div className="mt-10 pt-8 border-t border-border/30">
          <RegeneratePlanSection />
        </div>

        {/* Export Workouts */}
        <div className="mt-6 pt-6 border-t border-border/30">
          <ExportWorkoutsSection />
        </div>
      </div>
    </AppLayout>
  );
}

/* ─── Regenerate Plan Section ─── */
function RegeneratePlanSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    if (!user) return;
    setGenerating(true);
    try {
      const [profileRes, availRes, goalRes, planRes] = await Promise.all([
        supabase.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('availability_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('training_goals').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('plans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
      ]);

      if (!profileRes.data || !availRes.data) {
        toast.error('Complete your profile and availability first');
        return;
      }

      const profile = profileRes.data;
      const avail = availRes.data;
      const goal = goalRes.data;
      const existingPlan = planRes.data?.[0] || null;
      const today = new Date();
      const raceDateVal = goal?.race_date || '2026-09-26';

      const generated = generatePlan({
        startDate: today,
        raceDate: parseISO(raceDateVal),
        daysAvailable: avail.days_available_json as Record<string, boolean>,
        maxMinutes: avail.max_minutes_by_day_json as Record<string, number>,
        preferredLongRunDay: avail.preferred_long_run_day,
        weekendLongRunAvoid: avail.weekend_long_run_avoid,
        thresholdPace: profile.threshold_pace_sec_per_km || undefined,
        thresholdHr: profile.threshold_hr || undefined,
        obstacleSessionsPerWeek: (avail as any).obstacle_sessions_per_week ?? 2,
      });

      let planId: string;
      if (existingPlan) {
        await supabase.from('sessions').delete().eq('plan_id', existingPlan.id);
        await supabase.from('plans').update({
          start_date: format(today, 'yyyy-MM-dd'),
          end_date: raceDateVal,
          status: 'active',
          athlete_profile_id: profile.id,
          availability_profile_id: avail.id,
          training_goal_id: goal?.id || null,
        }).eq('id', existingPlan.id);
        planId = existingPlan.id;
      } else {
        const { data: newPlan } = await supabase.from('plans').insert({
          user_id: user.id,
          plan_name: 'Spartan Ultra Plan',
          start_date: format(today, 'yyyy-MM-dd'),
          end_date: raceDateVal,
          status: 'active',
          athlete_profile_id: profile.id,
          availability_profile_id: avail.id,
          training_goal_id: goal?.id || null,
        }).select('id').single();
        if (!newPlan) throw new Error('Failed to create plan');
        planId = newPlan.id;
      }

      for (const gs of generated) {
        const { data: session } = await supabase.from('sessions').insert({
          plan_id: planId,
          session_date: gs.session_date,
          title: gs.title,
          session_type: gs.session_type,
          primary_target: gs.primary_target,
          notes: gs.notes,
        }).select('id').single();

        if (session && gs.steps.length > 0) {
          await supabase.from('session_steps').insert(
            gs.steps.map(st => ({ ...st, session_id: session.id }))
          );
        }
      }

      toast.success(`Generated ${generated.length} sessions`);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Generation failed');
    }
    setGenerating(false);
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" />Generate Plan</CardTitle>
        <CardDescription>Create or regenerate your training plan based on current settings</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleGenerate} disabled={generating} className="glow-primary w-full">
          {generating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
          {generating ? 'Generating...' : 'Generate Training Plan'}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">This will replace your current plan with a new one based on your profile, availability, and race goal.</p>
      </CardContent>
    </Card>
  );
}

/* ─── Export Workouts Section ─── */
function ExportWorkoutsSection() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);

  async function handleExport(exportType: 'json' | 'fit', range: 'week' | 'month') {
    if (!user) return;
    setExporting(true);
    try {
      const { data: plans } = await supabase
        .from('plans')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!plans || plans.length === 0) {
        toast.error('No plan found. Generate a plan first.');
        setExporting(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast.error('Authentication error');
        setExporting(false);
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-workouts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ planId: plans[0].id, range, exportType }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Export failed');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || `export-${range}.${exportType === 'json' ? 'json' : 'fit.json'}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    }
    setExporting(false);
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5 text-primary" />Export Workouts</CardTitle>
        <CardDescription>Download your training plan for Garmin, COROS, or offline use</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">JSON Format</Label>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" disabled={exporting} onClick={() => handleExport('json', 'week')} className="justify-start gap-2">
              <FileJson className="h-4 w-4 text-primary" /> Next 7 Days
            </Button>
            <Button variant="outline" disabled={exporting} onClick={() => handleExport('json', 'month')} className="justify-start gap-2">
              <FileJson className="h-4 w-4 text-primary" /> Next 30 Days
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">FIT Format (Garmin / COROS)</Label>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" disabled={exporting} onClick={() => handleExport('fit', 'week')} className="justify-start gap-2">
              <Watch className="h-4 w-4 text-primary" /> Next 7 Days
            </Button>
            <Button variant="outline" disabled={exporting} onClick={() => handleExport('fit', 'month')} className="justify-start gap-2">
              <Watch className="h-4 w-4 text-primary" /> Next 30 Days
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">FIT export generates a structured JSON that can be converted to binary FIT format for watch upload.</p>
      </CardContent>
    </Card>
  );
}
