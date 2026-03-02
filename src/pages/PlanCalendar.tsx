import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { format, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, startOfMonth } from 'date-fns';
import { motion } from 'framer-motion';
import WeeklyView from '@/components/calendar/WeeklyView';
import MonthlyView from '@/components/calendar/MonthlyView';
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
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
        >
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Training Schedule</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Plan Calendar
            </h1>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as 'week' | 'month')}>
            <TabsList className="h-9 bg-secondary/50 border border-border/30">
              <TabsTrigger value="week" className="text-xs px-4 h-7 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Week</TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-4 h-7 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex items-center gap-2"
        >
          <Button variant="ghost" size="icon" onClick={navigatePrev} className="h-8 w-8 text-muted-foreground hover:text-primary">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={navigateToday} className="text-xs text-muted-foreground hover:text-primary h-8 px-3">
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={navigateNext} className="h-8 w-8 text-muted-foreground hover:text-primary">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground font-mono ml-2">{headerLabel}</span>
        </motion.div>

        {/* Calendar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="flex flex-col items-center gap-3">
                <CalendarDays className="h-5 w-5 text-primary animate-pulse" />
                <p className="text-sm text-muted-foreground">Loading schedule...</p>
              </div>
            </div>
          ) : view === 'week' ? (
            <WeeklyView sessions={sessions} weekStart={weekStart} />
          ) : (
            <MonthlyView sessions={sessions} currentMonth={monthStart} />
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
