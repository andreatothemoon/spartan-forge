import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Shield, TrendingUp, Calendar } from 'lucide-react';
import { format, parseISO, differenceInWeeks } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

type Session = Tables<'sessions'>;
type Plan = Tables<'plans'>;

interface PlanOverviewWidgetProps {
  plan: Plan;
  sessions: Session[];
}

export default function PlanOverviewWidget({ plan, sessions }: PlanOverviewWidgetProps) {
  const totalWeeks = differenceInWeeks(parseISO(plan.end_date), parseISO(plan.start_date));
  const weeksCompleted = differenceInWeeks(new Date(), parseISO(plan.start_date));
  const clampedWeeks = Math.max(0, Math.min(weeksCompleted, totalWeeks));
  const weekProgress = totalWeeks > 0 ? Math.round((clampedWeeks / totalWeeks) * 100) : 0;

  const completedSessions = sessions.filter(s => s.completed).length;
  const totalSessions = sessions.length;
  const compliancePct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
      <Card className="border-border/30 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary/80 via-primary/40 to-transparent" />
        <CardContent className="pt-5 pb-5 px-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{plan.plan_name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your race: <span className="text-foreground font-medium">{format(parseISO(plan.end_date), 'MMM d, yyyy')}</span>
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
          </div>

          {/* Week progress bar */}
          <div className="flex items-center gap-1.5 mb-5">
            {Array.from({ length: Math.min(totalWeeks, 20) }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < clampedWeeks ? 'bg-primary' : 'bg-border/50'
                }`}
              />
            ))}
            {totalWeeks > 20 && (
              <span className="text-[10px] text-muted-foreground ml-1">+{totalWeeks - 20}</span>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Weeks completed
              </p>
              <p className="text-2xl font-bold text-foreground tracking-tight">
                {clampedWeeks}<span className="text-muted-foreground text-lg font-normal">/{totalWeeks}</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Sessions done
              </p>
              <p className="text-2xl font-bold text-foreground tracking-tight">
                {completedSessions}<span className="text-muted-foreground text-lg font-normal">/{totalSessions}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
