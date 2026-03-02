import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, addDays, parseISO, isSameDay } from 'date-fns';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { SESSION_TYPE_LABELS } from '@/lib/paceUtils';
import type { Tables } from '@/integrations/supabase/types';

type Session = Tables<'sessions'>;

const SESSION_COLORS: Record<string, string> = {
  easy: 'bg-session-easy/15 text-session-easy border-session-easy/25',
  interval: 'bg-session-interval/15 text-session-interval border-session-interval/25',
  tempo: 'bg-session-tempo/15 text-session-tempo border-session-tempo/25',
  long: 'bg-session-long/15 text-session-long border-session-long/25',
  recovery: 'bg-session-recovery/15 text-session-recovery border-session-recovery/25',
  race_sim: 'bg-session-race-sim/15 text-session-race-sim border-session-race-sim/25',
  strength: 'bg-session-strength/15 text-session-strength border-session-strength/25',
};

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
      {days.map((day, di) => {
        const daySessions = sessions.filter(s => isSameDay(parseISO(s.session_date), day));
        const isToday = isSameDay(day, new Date());

        return (
          <motion.div
            key={day.toISOString()}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: di * 0.03 }}
            className="space-y-1.5"
          >
            <div className={`text-xs font-mono text-center py-1.5 rounded-lg transition-colors ${
              isToday ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground'
            }`}>
              <div className="font-semibold">{format(day, 'EEE')}</div>
              <div className={isToday ? 'font-bold' : ''}>{format(day, 'd')}</div>
            </div>
            <div className="min-h-[120px] space-y-1.5">
              {daySessions.length === 0 ? (
                <div className="h-full flex items-center justify-center min-h-[80px]">
                  <span className="text-[10px] text-muted-foreground/30 uppercase tracking-widest">Rest</span>
                </div>
              ) : (
                daySessions.map(s => (
                  <Card
                    key={s.id}
                    className={`border-border/30 cursor-pointer hover:border-primary/30 transition-all group ${
                      s.completed ? 'opacity-50' : ''
                    }`}
                    onClick={() => navigate(`/session/${s.id}`)}
                  >
                    <CardContent className="p-2.5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${SESSION_DOT_COLORS[s.session_type] || 'bg-muted-foreground'}`} />
                        <span className="text-[11px] font-medium truncate text-foreground group-hover:text-primary transition-colors">
                          {s.title}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 rounded font-medium ${SESSION_COLORS[s.session_type] || ''}`}>
                          {SESSION_TYPE_LABELS[s.session_type] || s.session_type}
                        </Badge>
                        {s.completed && <CheckCircle2 className="h-3 w-3 text-success" />}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
