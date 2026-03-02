import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { parseISO, startOfWeek, differenceInWeeks, format } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

type Session = Tables<'sessions'>;

export default function ComplianceTrendChart({ sessions }: { sessions: Session[] }) {
  const data = useMemo(() => {
    if (sessions.length === 0) return [];

    const dates = sessions.map(s => parseISO(s.session_date));
    const minDate = startOfWeek(new Date(Math.min(...dates.map(d => d.getTime()))), { weekStartsOn: 1 });

    const weekMap = new Map<number, { planned: number; completed: number; label: string }>();

    sessions.forEach(s => {
      const d = parseISO(s.session_date);
      const wk = differenceInWeeks(startOfWeek(d, { weekStartsOn: 1 }), minDate);
      if (!weekMap.has(wk)) {
        weekMap.set(wk, { planned: 0, completed: 0, label: format(startOfWeek(d, { weekStartsOn: 1 }), 'MMM d') });
      }
      const w = weekMap.get(wk)!;
      w.planned += 1;
      if (s.completed) w.completed += 1;
    });

    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([_, v]) => ({
        label: v.label,
        compliance: v.planned > 0 ? Math.round((v.completed / v.planned) * 100) : 0,
      }));
  }, [sessions]);

  if (data.length === 0) return null;

  return (
    <Card className="border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Compliance Trend
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground/60">Weekly completion rate over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
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
                domain={[0, 100]}
                tickFormatter={v => `${v}%`}
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
                formatter={(value: number) => [`${value}%`, 'Compliance']}
              />
              <Line
                type="monotone"
                dataKey="compliance"
                stroke="hsl(12 70% 62%)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'hsl(12 70% 62%)', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: 'hsl(12 70% 62%)', stroke: 'hsl(12 70% 62% / 0.3)', strokeWidth: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
