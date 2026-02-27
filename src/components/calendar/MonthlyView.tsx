import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay, parseISO,
} from 'date-fns';
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

interface MonthlyViewProps {
  sessions: Session[];
  currentMonth: Date;
}

export default function MonthlyView({ sessions, currentMonth }: MonthlyViewProps) {
  const navigate = useNavigate();
  const today = new Date();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div>
      {/* Day name headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayNames.map(n => (
          <div key={n} className="text-[10px] font-mono text-muted-foreground text-center py-1 font-semibold uppercase tracking-wider">
            {n}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
          {week.map(day => {
            const inMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, today);
            const daySessions = sessions.filter(s => isSameDay(parseISO(s.session_date), day));

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[80px] rounded-md border p-1.5 transition-colors ${
                  !inMonth ? 'border-border/20 opacity-30' : 'border-border/50'
                } ${isToday ? 'ring-1 ring-primary/50 bg-primary/5' : ''}`}
              >
                <div className={`text-[10px] font-mono mb-1 ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {daySessions.slice(0, 2).map(s => (
                    <div
                      key={s.id}
                      className={`flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer hover:bg-primary/10 transition-colors ${s.completed ? 'opacity-50' : ''}`}
                      onClick={() => navigate(`/session/${s.id}`)}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${SESSION_DOT_COLORS[s.session_type] || 'bg-muted-foreground'}`} />
                      <span className="text-[9px] font-medium truncate">{s.title}</span>
                    </div>
                  ))}
                  {daySessions.length > 2 && (
                    <span className="text-[8px] text-muted-foreground px-1">+{daySessions.length - 2} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
