import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import TrainingVolumeChart from '@/components/calendar/TrainingVolumeChart';
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">TRAINING INSIGHTS</p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground font-mono text-sm">LOADING ANALYTICS...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground text-sm">
            <p>No training data yet.</p>
            <p className="text-xs mt-1">Generate a plan to see analytics.</p>
          </div>
        ) : (
          <TrainingVolumeChart sessions={sessions} />
        )}
      </div>
    </AppLayout>
  );
}
