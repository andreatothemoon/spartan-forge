import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { parseISO, startOfWeek, differenceInWeeks, format } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

type Session = Tables<'sessions'>;

interface TrainingVolumeChartProps {
  sessions: Session[];
}

export default function TrainingVolumeChart({ sessions }: TrainingVolumeChartProps) {
  const data = useMemo(() => {
    if (sessions.length === 0) return [];

    const dates = sessions.map(s => parseISO(s.session_date));
    const minDate = startOfWeek(new Date(Math.min(...dates.map(d => d.getTime()))), { weekStartsOn: 1 });

    const weekMap = new Map<number, { planned: number; completed: number; label: string }>();

    sessions.forEach(s => {
      const sessionDate = parseISO(s.session_date);
      const weekNum = differenceInWeeks(startOfWeek(sessionDate, { weekStartsOn: 1 }), minDate);
      if (!weekMap.has(weekNum)) {
        weekMap.set(weekNum, {
          planned: 0,
          completed: 0,
          label: format(startOfWeek(sessionDate, { weekStartsOn: 1 }), 'MMM d'),
        });
      }
      const w = weekMap.get(weekNum)!;
      w.planned += 1;
      if (s.completed) w.completed += 1;
    });

    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([_, v]) => v);
  }, [sessions]);

  if (data.length === 0) return null;

  return (
    <Card className="border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Weekly Training Volume
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground/60">Planned vs completed sessions per week</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'hsl(220 10% 48%)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(220 10% 48%)' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(225 16% 9%)',
                  border: '1px solid hsl(225 14% 15%)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: 'hsl(220 10% 90%)',
                  boxShadow: '0 8px 24px hsl(0 0% 0% / 0.3)',
                }}
                labelStyle={{ color: 'hsl(220 10% 90%)' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '10px' }}
                formatter={(value: string) => <span style={{ color: 'hsl(220 10% 60%)' }}>{value}</span>}
              />
              <Bar
                dataKey="planned"
                name="Planned"
                fill="hsl(12 70% 62% / 0.2)"
                stroke="hsl(12 70% 62% / 0.5)"
                strokeWidth={1}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="completed"
                name="Completed"
                fill="hsl(152 55% 46%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
