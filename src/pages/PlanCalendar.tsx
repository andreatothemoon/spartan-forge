import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addWeeks, subWeeks, startOfWeek, addDays, parseISO, isSameDay } from 'date-fns';
import { SESSION_TYPE_LABELS } from '@/lib/paceUtils';
import type { Tables } from '@/integrations/supabase/types';

type Session = Tables<'sessions'>;

const SESSION_DOT_COLORS: Record<string, string> = {
  easy: 'bg-session-easy',
  interval: 'bg-session-interval',
  tempo: 'bg-session-tempo',
  long: 'bg-session-long',
  recovery: 'bg-session-recovery',
  race_sim: 'bg-session-race-sim',
  strength: 'bg-session-strength',
};

export default function PlanCalendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const currentWeekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset);

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

  const days = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Plan Calendar</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(w => w - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="font-mono text-xs">
              Today
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(w => w + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground font-mono">
          {format(currentWeekStart, 'MMM d')} — {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
        </p>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground font-mono text-sm">LOADING...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
            {days.map(day => {
              const daySessions = sessions.filter(s => isSameDay(parseISO(s.session_date), day));
              const isToday = isSameDay(day, new Date());

              return (
                <div key={day.toISOString()} className="space-y-1">
                  <div className={`text-xs font-mono text-center py-1 rounded-t ${isToday ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
                    <div className="font-semibold">{format(day, 'EEE')}</div>
                    <div>{format(day, 'd')}</div>
                  </div>
                  <div className="min-h-[120px] space-y-1">
                    {daySessions.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <span className="text-[10px] text-muted-foreground/40">REST</span>
                      </div>
                    ) : (
                      daySessions.map(s => (
                        <Card
                          key={s.id}
                          className={`border-border/50 cursor-pointer hover:border-primary/40 transition-all ${s.completed ? 'opacity-60' : ''}`}
                          onClick={() => navigate(`/session/${s.id}`)}
                        >
                          <CardContent className="p-2">
                            <div className="flex items-center gap-1 mb-1">
                              <div className={`w-1.5 h-1.5 rounded-full ${SESSION_DOT_COLORS[s.session_type] || 'bg-muted-foreground'}`} />
                              <span className="text-[10px] font-medium truncate">{s.title}</span>
                            </div>
                            <Badge variant="outline" className="text-[8px] px-1 py-0">
                              {SESSION_TYPE_LABELS[s.session_type] || s.session_type}
                            </Badge>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
