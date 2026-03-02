import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Zap, Download, Calendar, CheckCircle, Circle, Clock,
  TrendingUp, BarChart3, RefreshCw, FileJson, ArrowRight,
  Target, Play,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO, differenceInDays } from 'date-fns';
import { generatePlan } from '@/lib/planGenerator';
import { downloadFile } from '@/lib/exportUtils';
import { SESSION_TYPE_LABELS } from '@/lib/paceUtils';
import AICoachPanel from '@/components/dashboard/AICoachPanel';
import type { Tables } from '@/integrations/supabase/types';

type Session = Tables<'sessions'>;
type Plan = Tables<'plans'>;

const SESSION_COLORS: Record<string, string> = {
  easy: 'bg-session-easy/15 text-session-easy border-session-easy/25',
  interval: 'bg-session-interval/15 text-session-interval border-session-interval/25',
  tempo: 'bg-session-tempo/15 text-session-tempo border-session-tempo/25',
  long: 'bg-session-long/15 text-session-long border-session-long/25',
  recovery: 'bg-session-recovery/15 text-session-recovery border-session-recovery/25',
  race_sim: 'bg-session-race-sim/15 text-session-race-sim border-session-race-sim/25',
  strength: 'bg-session-strength/15 text-session-strength border-session-strength/25',
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

  const pastSessions = sessions.filter(s => parseISO(s.session_date) < today);
  const completedPast = pastSessions.filter(s => s.completed).length;
  const compliancePct = pastSessions.length > 0 ? Math.round(completedPast / pastSessions.length * 100) : 0;

  const raceDate = plan ? parseISO(plan.end_date) : parseISO('2026-09-26');
  const daysToRace = differenceInDays(raceDate, today);

  async function handleGenerate() {
    if (!user) return;
    setGenerating(true);
    try {
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

      let planId: string;
      if (plan) {
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
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        toast.error('You must be logged in to export');
        setExporting(false);
        return;
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-workouts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ planId: plan.id, range, exportType: type }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(err.error || 'Export failed');
      }

      const content = await resp.text();
      const disposition = resp.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const rangeLabel = range === 'month' ? 'month' : 'week';
      const filename = filenameMatch?.[1] ||
        (type === 'json'
          ? `spartan-plan-${rangeLabel}-${format(today, 'yyyy-MM-dd')}.json`
          : `spartan-workouts-${rangeLabel}-${format(today, 'yyyy-MM-dd')}.fit.json`);

      downloadFile(content, filename);
      toast.success('Export complete');
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    }
    setExporting(false);
  }

  async function toggleComplete(session: Session) {
    await supabase.from('sessions').update({ completed: !session.completed }).eq('id', session.id);
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, completed: !s.completed } : s));
  }

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-5 w-5 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading your plan...</p>
        </div>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-6"
        >
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">Welcome back</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              {daysToRace > 0 ? (
                <>
                  <span className="text-primary">{daysToRace}</span> days to race
                </>
              ) : 'Race Day 🔥'}
            </h1>
            {plan && (
              <p className="text-sm text-muted-foreground">
                {plan.plan_name} · {format(parseISO(plan.start_date), 'MMM d')} → {format(parseISO(plan.end_date), 'MMM d, yyyy')}
              </p>
            )}
          </div>
          <Button onClick={handleGenerate} disabled={generating} size="lg" className="glow-primary rounded-xl px-6">
            {generating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
            {plan ? 'Regenerate Plan' : 'Generate Plan'}
          </Button>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Calendar className="h-4 w-4" />}
            label="This Week"
            value={`${completedThisWeek}/${totalThisWeek}`}
            detail={totalThisWeek > 0 ? `${Math.round(completedThisWeek / totalThisWeek * 100)}% done` : 'No sessions'}
            delay={0}
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Total Sessions"
            value={sessions.length.toString()}
            detail={`${completedPast} completed`}
            delay={0.05}
          />
          <StatCard
            icon={<Target className="h-4 w-4" />}
            label="Compliance"
            value={pastSessions.length > 0 ? `${compliancePct}%` : '—'}
            detail={pastSessions.length > 0 ? `${completedPast}/${pastSessions.length} sessions` : 'No data yet'}
            delay={0.1}
            progress={pastSessions.length > 0 ? compliancePct : undefined}
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="Race Countdown"
            value={`${daysToRace}d`}
            detail={format(raceDate, 'EEEE, MMM d')}
            delay={0.15}
            highlight
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Upcoming Sessions - takes 3 cols */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Upcoming Workouts</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/calendar')} className="text-muted-foreground hover:text-primary gap-1">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            {upcomingSessions.length === 0 ? (
              <Card className="border-dashed border-border/50">
                <CardContent className="py-16 text-center space-y-3">
                  <Play className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                  <div>
                    <p className="text-muted-foreground font-medium">No upcoming sessions</p>
                    <p className="text-muted-foreground/60 text-sm mt-1">Generate a plan to get started</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {upcomingSessions.map((s, i) => (
                  <motion.div key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <Card
                      className="border-border/30 hover:border-primary/20 hover:bg-card/80 transition-all cursor-pointer group"
                      onClick={() => navigate(`/session/${s.id}`)}
                    >
                      <CardContent className="py-4 px-5 flex items-center gap-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleComplete(s); }}
                          className="shrink-0"
                        >
                          {s.completed
                            ? <CheckCircle className="h-5 w-5 text-success" />
                            : <Circle className="h-5 w-5 text-border hover:text-primary transition-colors" />
                          }
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-1">
                            <span className="font-medium text-sm text-foreground truncate">{s.title}</span>
                            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${SESSION_COLORS[s.session_type] || ''}`}>
                              {SESSION_TYPE_LABELS[s.session_type] || s.session_type}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(s.session_date), 'EEEE, MMM d')}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 group-hover:translate-x-0.5 transition-all" />
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Right Sidebar - takes 2 cols */}
          <div className="lg:col-span-2 space-y-4">
            {/* Quick Export */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Export Workouts</h2>
              <Card className="border-border/30">
                <CardContent className="py-5 px-5 space-y-5">
                  <ExportRow
                    label="Next 7 days"
                    onFit={() => handleExport('fit', 'week')}
                    onJson={() => handleExport('json', 'week')}
                    disabled={exporting || !plan}
                  />
                  <ExportRow
                    label="Next 30 days"
                    onFit={() => handleExport('fit', 'month')}
                    onJson={() => handleExport('json', 'month')}
                    disabled={exporting || !plan}
                  />
                </CardContent>
              </Card>
            </div>

            <AICoachPanel plan={plan} sessions={sessions} />

            {/* Plan Info */}
            {plan && (
              <Card className="border-border/30 overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-primary/60 to-primary/20" />
                <CardContent className="py-5 px-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">Plan Status</h3>
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-medium">
                      {plan.status}
                    </Badge>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Plan</span>
                      <span className="text-foreground font-medium">{plan.plan_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Period</span>
                      <span className="text-foreground font-mono text-[11px]">
                        {format(parseISO(plan.start_date), 'MMM d')} → {format(parseISO(plan.end_date), 'MMM d')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sessions</span>
                      <span className="text-foreground font-mono text-[11px]">{sessions.length} total</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

/* ─── Sub-components ─── */

function StatCard({ icon, label, value, detail, delay, highlight, progress }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  delay: number;
  highlight?: boolean;
  progress?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="border-border/30 hover:border-border/50 transition-colors">
        <CardContent className="pt-5 pb-4 px-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-3">
            {icon}
            <span className="font-medium">{label}</span>
          </div>
          <p className={`text-2xl font-bold tracking-tight ${highlight ? 'text-primary' : 'text-foreground'}`}>
            {value}
          </p>
          {progress !== undefined && (
            <Progress value={progress} className="h-1.5 mt-3 mb-1" />
          )}
          <p className="text-[11px] text-muted-foreground mt-1">{detail}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ExportRow({ label, onFit, onJson, disabled }: {
  label: string;
  onFit: () => void;
  onJson: () => void;
  disabled: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2 font-medium">{label}</p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 rounded-lg"
          onClick={onFit}
          disabled={disabled}
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          FIT
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 rounded-lg"
          onClick={onJson}
          disabled={disabled}
        >
          <FileJson className="h-3.5 w-3.5 mr-1.5" />
          JSON
        </Button>
      </div>
    </div>
  );
}
