import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Zap, Download, Calendar, CheckCircle, Circle, Clock,
  TrendingUp, BarChart3, RefreshCw, FileJson,
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, isWithinInterval, parseISO, differenceInDays } from 'date-fns';
import { generatePlan } from '@/lib/planGenerator';
import { exportSessionsToJSON, exportSessionsToFITStub, downloadFile } from '@/lib/exportUtils';
import { SESSION_TYPE_LABELS, secPerKmToDisplay } from '@/lib/paceUtils';
import AICoachPanel from '@/components/dashboard/AICoachPanel';
import type { Tables } from '@/integrations/supabase/types';

type Session = Tables<'sessions'>;
type Plan = Tables<'plans'>;

const SESSION_COLORS: Record<string, string> = {
  easy: 'bg-session-easy/20 text-session-easy border-session-easy/30',
  interval: 'bg-session-interval/20 text-session-interval border-session-interval/30',
  tempo: 'bg-session-tempo/20 text-session-tempo border-session-tempo/30',
  long: 'bg-session-long/20 text-session-long border-session-long/30',
  recovery: 'bg-session-recovery/20 text-session-recovery border-session-recovery/30',
  race_sim: 'bg-session-race-sim/20 text-session-race-sim border-session-race-sim/30',
  strength: 'bg-session-strength/20 text-session-strength border-session-strength/30',
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: plans } = await supabase
      .from('plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (plans && plans.length > 0) {
      setPlan(plans[0]);
      const { data: sess } = await supabase
        .from('sessions')
        .select('*')
        .eq('plan_id', plans[0].id)
        .order('session_date', { ascending: true });
      setSessions(sess || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const weekSessions = sessions.filter(s => {
    const d = parseISO(s.session_date);
    return isWithinInterval(d, { start: weekStart, end: weekEnd });
  });

  const completedThisWeek = weekSessions.filter(s => s.completed).length;
  const totalThisWeek = weekSessions.length;

  const upcomingSessions = sessions
    .filter(s => !s.completed && parseISO(s.session_date) >= today)
    .slice(0, 5);

  const raceDate = plan ? parseISO(plan.end_date) : parseISO('2026-09-26');
  const daysToRace = differenceInDays(raceDate, today);

  async function handleGenerate() {
    if (!user) return;
    setGenerating(true);
    try {
      // Load profile + availability + goal
      const [profileRes, availRes, goalRes] = await Promise.all([
        supabase.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('availability_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('training_goals').select('*').eq('user_id', user.id).maybeSingle(),
      ]);

      if (!profileRes.data || !availRes.data) {
        toast.error('Complete your profile and availability first');
        navigate('/onboarding');
        return;
      }

      const profile = profileRes.data;
      const avail = availRes.data;
      const goal = goalRes.data;
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
      });

      // Create or update plan
      let planId: string;
      if (plan) {
        // Delete old sessions
        await supabase.from('sessions').delete().eq('plan_id', plan.id);
        await supabase.from('plans').update({
          start_date: format(today, 'yyyy-MM-dd'),
          end_date: raceDateVal,
          status: 'active',
          athlete_profile_id: profile.id,
          availability_profile_id: avail.id,
          training_goal_id: goal?.id || null,
        }).eq('id', plan.id);
        planId = plan.id;
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

      // Insert sessions + steps
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
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Generation failed');
    }
    setGenerating(false);
  }

  async function handleExport(type: 'json' | 'fit', range: 'week' | 'month' = 'week') {
    if (!plan) return;
    setExporting(true);
    try {
      const rangeEnd = range === 'month' ? addDays(today, 30) : addDays(today, 7);
      const exportSessions = sessions.filter(s => {
        const d = parseISO(s.session_date);
        return d >= today && d <= rangeEnd;
      });

      // Load steps for each session
      const sessionsWithSteps = await Promise.all(
        exportSessions.map(async (s) => {
          const { data: steps } = await supabase
            .from('session_steps')
            .select('*')
            .eq('session_id', s.id)
            .order('step_order', { ascending: true });
          return { ...s, steps: steps || [] };
        })
      );

      if (sessionsWithSteps.length === 0) {
        toast.info('No sessions in the next 7 days to export');
        setExporting(false);
        return;
      }

      const content = type === 'json'
        ? exportSessionsToJSON(sessionsWithSteps)
        : exportSessionsToFITStub(sessionsWithSteps);

      const rangeLabel = range === 'month' ? 'month' : 'week';
      const filename = type === 'json'
        ? `spartan-plan-${rangeLabel}-${format(today, 'yyyy-MM-dd')}.json`
        : `spartan-workouts-${rangeLabel}-${format(today, 'yyyy-MM-dd')}.fit.json`;

      downloadFile(content, filename);

      // Log export job
      await supabase.from('export_jobs').insert({
        user_id: user!.id,
        plan_id: plan.id,
        range_start: format(today, 'yyyy-MM-dd'),
        range_end: format(rangeEnd, 'yyyy-MM-dd'),
        export_type: type === 'json' ? 'JSON' : 'FIT',
        status: 'done',
      });

      toast.success(`Exported ${sessionsWithSteps.length} sessions`);
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    }
    setExporting(false);
  }

  async function toggleComplete(session: Session) {
    await supabase.from('sessions').update({ completed: !session.completed }).eq('id', session.id);
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, completed: !s.completed } : s));
  }

  if (loading) return <AppLayout><div className="text-center py-20 text-muted-foreground font-mono text-sm">LOADING MISSION DATA...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mission Control</h1>
            <p className="text-sm text-muted-foreground font-mono">
              {daysToRace > 0 ? `T-${daysToRace} DAYS TO RACE` : 'RACE DAY'}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleGenerate} disabled={generating} className="glow-primary">
              {generating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              {plan ? 'Regenerate Plan' : 'Generate Plan'}
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Calendar className="h-3.5 w-3.5" />This Week
                </div>
                <p className="text-2xl font-bold font-mono">{completedThisWeek}/{totalThisWeek}</p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3.5 w-3.5" />Total Sessions
                </div>
                <p className="text-2xl font-bold font-mono">{sessions.length}</p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <BarChart3 className="h-3.5 w-3.5" />Compliance
                </div>
                <p className="text-2xl font-bold font-mono">
                  {sessions.filter(s => parseISO(s.session_date) < today).length > 0
                    ? `${Math.round(sessions.filter(s => s.completed && parseISO(s.session_date) < today).length / sessions.filter(s => parseISO(s.session_date) < today).length * 100)}%`
                    : '—'}
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Clock className="h-3.5 w-3.5" />Race Countdown
                </div>
                <p className="text-2xl font-bold font-mono text-primary">{daysToRace}d</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Upcoming Sessions */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Upcoming Sessions</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/calendar')} className="text-xs text-muted-foreground">
                View Calendar →
              </Button>
            </div>
            {upcomingSessions.length === 0 ? (
              <Card className="border-border/50 border-dashed">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground text-sm">No upcoming sessions.</p>
                  <p className="text-muted-foreground text-xs mt-1">Generate a plan to get started.</p>
                </CardContent>
              </Card>
            ) : (
              upcomingSessions.map((s, i) => (
                <motion.div key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card
                    className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/session/${s.id}`)}
                  >
                    <CardContent className="py-3 px-4 flex items-center gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleComplete(s); }}
                        className="shrink-0"
                      >
                        {s.completed
                          ? <CheckCircle className="h-5 w-5 text-success" />
                          : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                        }
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{s.title}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${SESSION_COLORS[s.session_type] || ''}`}>
                            {SESSION_TYPE_LABELS[s.session_type] || s.session_type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          {format(parseISO(s.session_date), 'EEE, MMM d')}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>

          {/* Export Panel */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Export</h2>
            <Card className="border-border/50">
              <CardContent className="py-4 px-4 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Next 7 days</p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 justify-start"
                      onClick={() => handleExport('fit', 'week')}
                      disabled={exporting || !plan}
                    >
                      <Download className="h-3.5 w-3.5 mr-2" />
                      FIT
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 justify-start"
                      onClick={() => handleExport('json', 'week')}
                      disabled={exporting || !plan}
                    >
                      <FileJson className="h-3.5 w-3.5 mr-2" />
                      JSON
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Next 30 days</p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 justify-start"
                      onClick={() => handleExport('fit', 'month')}
                      disabled={exporting || !plan}
                    >
                      <Download className="h-3.5 w-3.5 mr-2" />
                      FIT
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 justify-start"
                      onClick={() => handleExport('json', 'month')}
                      disabled={exporting || !plan}
                    >
                      <FileJson className="h-3.5 w-3.5 mr-2" />
                      JSON
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <AICoachPanel plan={plan} sessions={sessions} />

            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground pt-2">Plan Status</h2>
            <Card className="border-border/50">
              <CardContent className="py-4 px-4">
                {plan ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-mono">{plan.plan_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">{plan.status}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Period</span>
                      <span className="font-mono">{format(parseISO(plan.start_date), 'MMM d')} → {format(parseISO(plan.end_date), 'MMM d')}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center">No plan yet</p>
                )}
              </CardContent>
            </Card>
        </div>

      </div>
      </div>
    </AppLayout>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
