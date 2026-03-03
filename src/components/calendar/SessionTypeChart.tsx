import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { Tables } from '@/integrations/supabase/types';

type Session = Tables<'sessions'>;

const TYPE_COLORS: Record<string, string> = {
  easy: 'hsl(152, 55%, 46%)',
  tempo: 'hsl(38, 85%, 55%)',
  interval: 'hsl(348, 70%, 50%)',
  long: 'hsl(260, 55%, 58%)',
  recovery: 'hsl(175, 55%, 45%)',
  race_sim: 'hsl(330, 65%, 55%)',
  strength: 'hsl(215, 45%, 55%)',
  obstacle: 'hsl(28, 80%, 50%)',
};

export default function SessionTypeChart({ sessions }: { sessions: Session[] }) {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    sessions.forEach(s => {
      const t = s.session_type || 'other';
      counts.set(t, (counts.get(t) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
      .sort((a, b) => b.value - a.value);
  }, [sessions]);

  if (data.length === 0) return null;

  return (
    <Card className="border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Session Distribution
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground/60">Breakdown by workout type</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={TYPE_COLORS[entry.name.toLowerCase()] || `hsl(${i * 60}, 50%, 50%)`}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(225, 16%, 9%)',
                  border: '1px solid hsl(225, 14%, 15%)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: 'hsl(220, 10%, 90%)',
                  boxShadow: '0 8px 24px hsl(0 0% 0% / 0.3)',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '10px' }}
                formatter={(value: string) => <span style={{ color: 'hsl(220, 10%, 60%)' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
