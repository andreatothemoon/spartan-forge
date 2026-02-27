import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, startOfMonth } from 'date-fns';
import WeeklyView from '@/components/calendar/WeeklyView';
import MonthlyView from '@/components/calendar/MonthlyView';
import TrainingVolumeChart from '@/components/calendar/TrainingVolumeChart';
import type { Tables } from '@/integrations/supabase/types';

type Session = Tables<'sessions'>;

export default function PlanCalendar() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const monthStart = startOfMonth(currentDate);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: plans } = await supabase
      .from('plans')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (plans && plans.length > 0) {
      const { data: sess } = await supabase
        .from('sessions')
        .select('*')
        .eq('plan_id', plans[0].id)
        .order('session_date', { ascending: true });
      setSessions(sess || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  function navigatePrev() {
    setCurrentDate(d => view === 'week' ? subWeeks(d, 1) : subMonths(d, 1));
  }

  function navigateNext() {
    setCurrentDate(d => view === 'week' ? addWeeks(d, 1) : addMonths(d, 1));
  }

  function navigateToday() {
    setCurrentDate(new Date());
  }

  const headerLabel = view === 'week'
    ? `${format(weekStart, 'MMM d')} — ${format(addWeeks(weekStart, 1), 'MMM d, yyyy')}`
    : format(monthStart, 'MMMM yyyy');

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Plan Calendar</h1>
          <Tabs value={view} onValueChange={(v) => setView(v as 'week' | 'month')}>
            <TabsList className="h-8">
              <TabsTrigger value="week" className="text-xs px-3 h-6">Week</TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-3 h-6">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={navigateToday} className="font-mono text-xs">
            Today
          </Button>
          <Button variant="ghost" size="sm" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground font-mono ml-2">{headerLabel}</span>
        </div>

        {/* Calendar */}
        {loading ? (
          <div className="text-center py-20 text-muted-foreground font-mono text-sm">LOADING...</div>
        ) : view === 'week' ? (
          <WeeklyView sessions={sessions} weekStart={weekStart} />
        ) : (
          <MonthlyView sessions={sessions} currentMonth={monthStart} />
        )}

        {/* Analytics */}
        {!loading && sessions.length > 0 && (
          <TrainingVolumeChart sessions={sessions} />
        )}
      </div>
    </AppLayout>
  );
}
