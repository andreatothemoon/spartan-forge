import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  if (data.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Weekly Training Volume
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'hsl(215 12% 50%)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(215 12% 50%)' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(220 18% 12%)',
                  border: '1px solid hsl(220 15% 18%)',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: 'hsl(210 15% 85%)',
                }}
                labelStyle={{ color: 'hsl(210 15% 85%)' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '10px' }}
              />
              <Bar
                dataKey="planned"
                name="Planned"
                fill="hsl(175 70% 42% / 0.3)"
                stroke="hsl(175 70% 42%)"
                strokeWidth={1}
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="completed"
                name="Completed"
                fill="hsl(145 60% 42%)"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
