import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { Tables } from '@/integrations/supabase/types';

type Session = Tables<'sessions'>;

const TYPE_COLORS: Record<string, string> = {
  easy: 'hsl(175, 70%, 42%)',
  tempo: 'hsl(35, 85%, 55%)',
  interval: 'hsl(0, 65%, 48%)',
  long: 'hsl(260, 50%, 55%)',
  recovery: 'hsl(215, 12%, 50%)',
  race: 'hsl(45, 90%, 55%)',
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
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Session Type Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
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
                  backgroundColor: 'hsl(220, 18%, 12%)',
                  border: '1px solid hsl(220, 15%, 18%)',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: 'hsl(210, 15%, 85%)',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '10px' }}
                formatter={(value: string) => <span style={{ color: 'hsl(210, 15%, 85%)' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
