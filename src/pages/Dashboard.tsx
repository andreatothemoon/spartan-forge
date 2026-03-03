import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Zap, Calendar, TrendingUp, RefreshCw, ArrowRight,
  Target, Play, ChevronRight,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO, differenceInDays } from 'date-fns';
import { generatePlan } from '@/lib/planGenerator';
import { SESSION_TYPE_LABELS } from '@/lib/paceUtils';
import AICoachPanel from '@/components/dashboard/AICoachPanel';
import PlanOverviewWidget from '@/components/dashboard/PlanOverviewWidget';
import WorkoutOfTheDay from '@/components/dashboard/WorkoutOfTheDay';
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
  obstacle: 'bg-session-obstacle/15 text-session-obstacle border-session-obstacle/25',
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

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

  const pastSessions = sessions.filter(s => parseISO(s.session_date) < today);
  const completedPast = pastSessions.filter(s => s.completed).length;
  const compliancePct = pastSessions.length > 0 ? Math.round(completedPast / pastSessions.length * 100) : 0;

  const raceDate = plan ? parseISO(plan.end_date) : parseISO('2026-09-26');
  const daysToRace = differenceInDays(raceDate, today);

  const upcomingSessions = sessions
    .filter(s => !s.completed && parseISO(s.session_date) >= today)
    .slice(0, 4);

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
        obstacleSessionsPerWeek: (avail as any).obstacle_sessions_per_week ?? 2,
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
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-end justify-between gap-4"
        >
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Mission Control</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              {daysToRace > 0 ? (
                <><span className="text-primary">{daysToRace}</span> days to race</>
              ) : 'Race Day 🔥'}
            </h1>
            {plan && (
              <p className="text-sm text-muted-foreground">
                {format(parseISO(plan.start_date), 'MMM d')} → {format(parseISO(plan.end_date), 'MMM d, yyyy')}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            {generating ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1.5" />}
            {plan ? 'Regenerate' : 'Generate'}
          </Button>
        </motion.div>

        {/* Plan Overview Widget */}
        {plan && <PlanOverviewWidget plan={plan} sessions={sessions} />}

        {/* Week Stats Strip */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="grid grid-cols-3 gap-3">
          <MiniStat icon={<Calendar className="h-3.5 w-3.5" />} label="This Week" value={`${completedThisWeek}/${totalThisWeek}`} />
          <MiniStat icon={<TrendingUp className="h-3.5 w-3.5" />} label="Compliance" value={pastSessions.length > 0 ? `${compliancePct}%` : '—'} />
          <MiniStat icon={<Target className="h-3.5 w-3.5" />} label="Completed" value={`${completedPast}`} />
        </motion.div>

        {/* Workout of the Day */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Workout of the Day</h2>
          <WorkoutOfTheDay sessions={sessions} onToggleComplete={toggleComplete} />
        </div>

        {/* AI Coach */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">AI Coach</h2>
          <AICoachPanel plan={plan} sessions={sessions} />
        </div>

        {/* Upcoming Sessions */}
        {upcomingSessions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Coming Up</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/calendar')} className="text-xs text-muted-foreground hover:text-primary gap-1 h-7">
                View Plan <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1.5">
              {upcomingSessions.map((s, i) => (
                <motion.div key={s.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.03 }}>
                  <Card
                    className="border-border/20 hover:border-primary/20 transition-all cursor-pointer group"
                    onClick={() => navigate(`/session/${s.id}`)}
                  >
                    <CardContent className="py-3 px-4 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-sm text-foreground truncate">{s.title}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 rounded font-medium ${SESSION_COLORS[s.session_type] || ''}`}>
                            {SESSION_TYPE_LABELS[s.session_type] || s.session_type}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{format(parseISO(s.session_date), 'EEE, MMM d')}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 transition-colors" />
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="grid grid-cols-2 gap-3">
          <Card
            className="border-border/20 hover:border-primary/20 transition-all cursor-pointer group"
            onClick={() => navigate('/calendar')}
          >
            <CardContent className="py-4 px-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Plan Calendar</p>
                <p className="text-[11px] text-muted-foreground">View full schedule</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 transition-colors" />
            </CardContent>
          </Card>
          <Card
            className="border-border/20 hover:border-primary/20 transition-all cursor-pointer group"
            onClick={() => navigate('/analytics')}
          >
            <CardContent className="py-4 px-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Analytics</p>
                <p className="text-[11px] text-muted-foreground">Training insights</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 transition-colors" />
            </CardContent>
          </Card>
        </motion.div>

        {/* Plan Status footer */}
        {plan && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <Card className="border-border/20">
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    <span className="text-xs text-muted-foreground">Plan Active</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{plan.plan_name}</span>
                    <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/15">
                      {plan.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}

/* ─── Mini Stat ─── */
function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="border-border/20">
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wider mb-1">
          {icon}
          <span>{label}</span>
        </div>
        <p className="text-lg font-bold text-foreground tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
