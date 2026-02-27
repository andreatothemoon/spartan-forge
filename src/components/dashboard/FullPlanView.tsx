import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Circle } from 'lucide-react';
import { format, parseISO, startOfWeek, differenceInWeeks } from 'date-fns';
import { SESSION_TYPE_LABELS } from '@/lib/paceUtils';
import type { Tables } from '@/integrations/supabase/types';

type Session = Tables<'sessions'>;

const SESSION_COLORS: Record<string, string> = {
  easy: 'bg-session-easy/20 text-session-easy border-session-easy/30',
  interval: 'bg-session-interval/20 text-session-interval border-session-interval/30',
  tempo: 'bg-session-tempo/20 text-session-tempo border-session-tempo/30',
  long: 'bg-session-long/20 text-session-long border-session-long/30',
  recovery: 'bg-session-recovery/20 text-session-recovery border-session-recovery/30',
  race_sim: 'bg-session-race-sim/20 text-session-race-sim border-session-race-sim/30',
  strength: 'bg-session-strength/20 text-session-strength border-session-strength/30',
};

interface FullPlanViewProps {
  sessions: Session[];
  planStartDate: string;
  onToggleComplete: (session: Session) => void;
}

export default function FullPlanView({ sessions, planStartDate, onToggleComplete }: FullPlanViewProps) {
  const navigate = useNavigate();
  const today = new Date();

  // Group sessions by week number relative to plan start
  const planStart = startOfWeek(parseISO(planStartDate), { weekStartsOn: 1 });
  const weeks = new Map<number, Session[]>();

  sessions.forEach(s => {
    const sessionDate = parseISO(s.session_date);
    const weekNum = differenceInWeeks(startOfWeek(sessionDate, { weekStartsOn: 1 }), planStart) + 1;
    if (!weeks.has(weekNum)) weeks.set(weekNum, []);
    weeks.get(weekNum)!.push(s);
  });

  const sortedWeeks = Array.from(weeks.entries()).sort(([a], [b]) => a - b);

  return (
    <div className="space-y-4">
      {sortedWeeks.map(([weekNum, weekSessions]) => {
        const completed = weekSessions.filter(s => s.completed).length;
        const firstDate = parseISO(weekSessions[0].session_date);
        const isPast = firstDate < today && differenceInWeeks(today, firstDate) > 0;

        return (
          <div key={weekNum} className="space-y-1.5">
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Week {weekNum}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {format(firstDate, 'MMM d')}
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">
                {completed}/{weekSessions.length}
              </Badge>
            </div>

            <div className="grid gap-1">
              {weekSessions.map(s => {
                const sessionDate = parseISO(s.session_date);
                const isToday = format(sessionDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                const isPastSession = sessionDate < today && !isToday;

                return (
                  <Card
                    key={s.id}
                    className={`border-border/50 hover:border-primary/30 transition-colors cursor-pointer group ${
                      isToday ? 'ring-1 ring-primary/40' : ''
                    } ${isPastSession && !s.completed ? 'opacity-50' : ''}`}
                    onClick={() => navigate(`/session/${s.id}`)}
                  >
                    <CardContent className="py-2 px-3 flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleComplete(s); }}
                        className="shrink-0"
                      >
                        {s.completed
                          ? <CheckCircle className="h-4 w-4 text-success" />
                          : <Circle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                        }
                      </button>
                      <span className="text-[11px] text-muted-foreground font-mono w-16 shrink-0">
                        {format(sessionDate, 'EEE d')}
                      </span>
                      <span className="text-xs font-medium truncate flex-1">{s.title}</span>
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 ${SESSION_COLORS[s.session_type] || ''}`}>
                        {SESSION_TYPE_LABELS[s.session_type] || s.session_type}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {sortedWeeks.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-8">No sessions in this plan.</p>
      )}
    </div>
  );
}
