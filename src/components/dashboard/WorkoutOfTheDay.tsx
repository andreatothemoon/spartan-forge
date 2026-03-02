import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { CheckCircle, Circle, ArrowRight, Flame, Clock } from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isYesterday } from 'date-fns';
import { useNavigate } from 'react-router-dom';
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

interface WorkoutOfTheDayProps {
  sessions: Session[];
  onToggleComplete: (session: Session) => void;
}

export default function WorkoutOfTheDay({ sessions, onToggleComplete }: WorkoutOfTheDayProps) {
  const navigate = useNavigate();
  const today = new Date();

  // Find today's session, or next upcoming
  const todaySession = sessions.find(s => isToday(parseISO(s.session_date)));
  const nextSession = !todaySession
    ? sessions.find(s => !s.completed && parseISO(s.session_date) >= today)
    : null;
  const session = todaySession || nextSession;

  function getDateLabel(dateStr: string) {
    const d = parseISO(dateStr);
    if (isToday(d)) return "Today's Workout";
    if (isTomorrow(d)) return "Tomorrow's Workout";
    if (isYesterday(d)) return "Yesterday's Workout";
    return format(d, 'EEEE, MMM d');
  }

  if (!session) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-border/30 border-dashed">
          <CardContent className="py-10 text-center">
            <Flame className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No workout scheduled</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Rest day — you've earned it 💤</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <Card className={`border-border/30 overflow-hidden ${todaySession ? 'ring-1 ring-primary/20' : ''}`}>
        {todaySession && <div className="h-0.5 bg-primary" />}
        <CardContent className="pt-5 pb-5 px-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-primary" />
              {getDateLabel(session.session_date)}
            </p>
            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${SESSION_COLORS[session.session_type] || ''}`}>
              {SESSION_TYPE_LABELS[session.session_type] || session.session_type}
            </Badge>
          </div>

          <h3 className="text-lg font-semibold text-foreground mb-1">{session.title}</h3>

          {session.primary_target && (
            <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {session.primary_target}
            </p>
          )}

          {session.notes && (
            <p className="text-xs text-muted-foreground/80 mb-4 line-clamp-2">{session.notes}</p>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant={session.completed ? "secondary" : "default"}
              size="sm"
              className="flex-1 rounded-lg"
              onClick={() => onToggleComplete(session)}
            >
              {session.completed ? (
                <><CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Completed</>
              ) : (
                <><Circle className="h-3.5 w-3.5 mr-1.5" /> Mark Complete</>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg text-muted-foreground hover:text-primary"
              onClick={() => navigate(`/session/${session.id}`)}
            >
              Details <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
