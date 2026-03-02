import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import TrainingVolumeChart from '@/components/calendar/TrainingVolumeChart';
import SessionTypeChart from '@/components/calendar/SessionTypeChart';
import ComplianceTrendChart from '@/components/calendar/ComplianceTrendChart';
import type { Tables } from '@/integrations/supabase/types';

type Session = Tables<'sessions'>;

export default function Analytics() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Performance</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Analytics
          </h1>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary animate-pulse" />
              <p className="text-sm text-muted-foreground">Loading insights...</p>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24"
          >
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <p className="text-foreground font-medium">No training data yet</p>
            <p className="text-xs text-muted-foreground mt-1">Generate a plan to see your analytics</p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              <TrainingVolumeChart sessions={sessions} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <SessionTypeChart sessions={sessions} />
              <ComplianceTrendChart sessions={sessions} />
            </motion.div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
