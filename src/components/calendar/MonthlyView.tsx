import { useNavigate } from 'react-router-dom';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay, parseISO,
} from 'date-fns';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
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
  obstacle: 'bg-session-obstacle',
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
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {dayNames.map(n => (
          <div key={n} className="text-[10px] font-mono text-muted-foreground text-center py-1.5 font-semibold uppercase tracking-wider">
            {n}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <motion.div
          key={wi}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: wi * 0.03 }}
          className="grid grid-cols-7 gap-1.5 mb-1.5"
        >
          {week.map(day => {
            const inMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, today);
            const daySessions = sessions.filter(s => isSameDay(parseISO(s.session_date), day));

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[90px] rounded-lg border p-2 transition-all ${
                  !inMonth ? 'border-border/10 opacity-20' : 'border-border/30 hover:border-border/50'
                } ${isToday ? 'ring-1 ring-primary/40 bg-primary/5 border-primary/20' : ''}`}
              >
                <div className={`text-[10px] font-mono mb-1.5 ${
                  isToday ? 'text-primary font-bold' : 'text-muted-foreground'
                }`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {daySessions.slice(0, 2).map(s => (
                    <div
                      key={s.id}
                      className={`flex items-center gap-1.5 px-1.5 py-1 rounded-md cursor-pointer hover:bg-primary/10 transition-colors group ${
                        s.completed ? 'opacity-40' : ''
                      }`}
                      onClick={() => navigate(`/session/${s.id}`)}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${SESSION_DOT_COLORS[s.session_type] || 'bg-muted-foreground'}`} />
                      <span className="text-[9px] font-medium truncate text-foreground/80 group-hover:text-primary transition-colors">
                        {s.title}
                      </span>
                      {s.completed && <CheckCircle2 className="h-2.5 w-2.5 text-success shrink-0 ml-auto" />}
                    </div>
                  ))}
                  {daySessions.length > 2 && (
                    <span className="text-[8px] text-muted-foreground/60 px-1.5">+{daySessions.length - 2} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </motion.div>
      ))}
    </div>
  );
}
