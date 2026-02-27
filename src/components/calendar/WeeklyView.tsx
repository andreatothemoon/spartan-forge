import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, addDays, parseISO, isSameDay } from 'date-fns';
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

interface WeeklyViewProps {
  sessions: Session[];
  weekStart: Date;
}

export default function WeeklyView({ sessions, weekStart }: WeeklyViewProps) {
  const navigate = useNavigate();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
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
  );
}
