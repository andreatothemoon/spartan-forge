import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import type { Tables } from '@/integrations/supabase/types';

type Session = Tables<'sessions'>;
type Plan = Tables<'plans'>;

const COACH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`;

interface AICoachPanelProps {
  plan: Plan | null;
  sessions: Session[];
}

export default function AICoachPanel({ plan, sessions }: AICoachPanelProps) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);

  async function runAnalysis() {
    if (!plan || sessions.length === 0) {
      toast.info('Generate a plan first to get AI coaching insights');
      return;
    }

    setLoading(true);
    setAnalysis('');

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.access_token) {
        toast.error('Please sign in to use AI coaching');
        setLoading(false);
        return;
      }

      const resp = await fetch(COACH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({ sessions, plan }),
      });

      if (resp.status === 429) {
        toast.error('Rate limit exceeded. Try again in a moment.');
        setLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast.error('AI credits exhausted. Add credits in Settings → Workspace → Usage.');
        setLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error('Failed to start AI analysis');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              result += content;
              setAnalysis(result);
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'AI analysis failed');
    }
    setLoading(false);
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          AI Training Coach
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!analysis && !loading && (
          <div className="text-center py-4">
            <Sparkles className="h-8 w-8 text-primary/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground mb-3">
              Get AI-powered analysis of your training load, recovery patterns, and personalized recommendations.
            </p>
            <Button onClick={runAnalysis} size="sm" className="glow-primary" disabled={!plan}>
              <Brain className="h-3.5 w-3.5 mr-2" />
              Analyze My Plan
            </Button>
          </div>
        )}

        {loading && !analysis && (
          <div className="text-center py-6">
            <Loader2 className="h-6 w-6 text-primary animate-spin mx-auto mb-2" />
            <p className="text-xs text-muted-foreground font-mono">ANALYZING TRAINING DATA...</p>
          </div>
        )}

        {analysis && (
          <div className="space-y-3">
            <div className="prose prose-sm prose-invert max-w-none text-sm [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-medium [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_strong]:text-foreground">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
            <div className="pt-2 border-t border-border/50">
              <Button onClick={runAnalysis} variant="ghost" size="sm" disabled={loading} className="text-xs">
                {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Brain className="h-3 w-3 mr-1" />}
                Re-analyze
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
