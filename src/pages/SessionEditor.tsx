import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Plus, Trash2, GripVertical } from 'lucide-react';
import { SESSION_TYPES, SESSION_TYPE_LABELS, STEP_TYPES, secPerKmToDisplay, displayToSecPerKm, secondsToDisplay } from '@/lib/paceUtils';
import type { Tables } from '@/integrations/supabase/types';

type SessionRow = Tables<'sessions'>;
type StepRow = Tables<'session_steps'>;

export default function SessionEditor() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState('easy');
  const [primaryTarget, setPrimaryTarget] = useState('pace');
  const [notes, setNotes] = useState('');
  const [sessionDate, setSessionDate] = useState('');

  useEffect(() => {
    if (!id) return;
    loadSession();
  }, [id]);

  async function loadSession() {
    setLoading(true);
    const { data: s } = await supabase.from('sessions').select('*').eq('id', id!).single();
    if (s) {
      setSession(s);
      setTitle(s.title);
      setSessionType(s.session_type);
      setPrimaryTarget(s.primary_target);
      setNotes(s.notes || '');
      setSessionDate(s.session_date);
    }
    const { data: st } = await supabase.from('session_steps').select('*').eq('session_id', id!).order('step_order', { ascending: true });
    setSteps(st || []);
    setLoading(false);
  }

  async function handleSave() {
    if (!session) return;
    setSaving(true);
    try {
      await supabase.from('sessions').update({
        title,
        session_type: sessionType,
        primary_target: primaryTarget,
        notes,
        session_date: sessionDate,
      }).eq('id', session.id);

      // Delete old steps and re-insert
      await supabase.from('session_steps').delete().eq('session_id', session.id);
      if (steps.length > 0) {
        await supabase.from('session_steps').insert(
          steps.map((st, i) => ({
            session_id: session.id,
            step_order: i,
            step_type: st.step_type,
            duration_type: st.duration_type,
            duration_value: st.duration_value,
            target_pace_low_sec_per_km: st.target_pace_low_sec_per_km,
            target_pace_high_sec_per_km: st.target_pace_high_sec_per_km,
            target_hr_low_bpm: st.target_hr_low_bpm,
            target_hr_high_bpm: st.target_hr_high_bpm,
            step_notes: st.step_notes,
          }))
        );
      }
      toast.success('Session saved');
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    }
    setSaving(false);
  }

  function addStep() {
    const newStep: StepRow = {
      id: crypto.randomUUID(),
      session_id: id!,
      step_order: steps.length,
      step_type: 'work',
      duration_type: 'time',
      duration_value: 300,
      target_pace_low_sec_per_km: null,
      target_pace_high_sec_per_km: null,
      target_hr_low_bpm: null,
      target_hr_high_bpm: null,
      step_notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setSteps(prev => [...prev, newStep]);
  }

  function removeStep(index: number) {
    setSteps(prev => prev.filter((_, i) => i !== index));
  }

  function updateStep(index: number, updates: Partial<StepRow>) {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  }

  if (loading) return <AppLayout><div className="text-center py-20 text-muted-foreground font-mono text-sm">LOADING SESSION...</div></AppLayout>;
  if (!session) return <AppLayout><div className="text-center py-20 text-muted-foreground">Session not found</div></AppLayout>;

  return (
    <AppLayout>
      <motion.div
        className="max-w-3xl mx-auto space-y-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Session Editor</p>
            <h1 className="text-xl font-bold tracking-tight">{title || 'Untitled Session'}</h1>
          </div>
          <Button onClick={handleSave} disabled={saving} className="glow-primary font-semibold">
            <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save'}
          </Button>
        </div>

        {/* Session Meta */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass-card">
            <CardContent className="pt-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Title</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} className="font-medium bg-muted/50 border-border/50 focus:border-primary/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Date</Label>
                  <Input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} className="font-mono bg-muted/50 border-border/50 focus:border-primary/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Type</Label>
                  <Select value={sessionType} onValueChange={setSessionType}>
                    <SelectTrigger className="bg-muted/50 border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SESSION_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{SESSION_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Primary Target</Label>
                  <Select value={primaryTarget} onValueChange={setPrimaryTarget}>
                    <SelectTrigger className="bg-muted/50 border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pace">Pace</SelectItem>
                      <SelectItem value="hr">Heart Rate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Notes</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Session notes..." className="bg-muted/50 border-border/50 focus:border-primary/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Steps */}
        <motion.div className="space-y-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground">Workout Steps</h2>
            <Button variant="secondary" size="sm" onClick={addStep} className="border-border/50 hover:border-primary/30">
              <Plus className="h-3.5 w-3.5 mr-1" />Add Step
            </Button>
          </div>

          {steps.length === 0 ? (
            <Card className="glass-card border-dashed">
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">No steps yet. Add steps to define the workout structure.</p>
              </CardContent>
            </Card>
          ) : (
            steps.map((step, i) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.03 }}
              >
                <Card className="glass-card hover:border-primary/20 transition-colors">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-1 pt-2 text-muted-foreground">
                        <GripVertical className="h-4 w-4" />
                        <span className="font-mono text-[10px] text-primary/70 w-4">{i + 1}</span>
                      </div>
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Type</Label>
                          <Select value={step.step_type} onValueChange={v => updateStep(i, { step_type: v })}>
                            <SelectTrigger className="h-8 text-xs bg-muted/50 border-border/50"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STEP_TYPES.map(t => (
                                <SelectItem key={t} value={t} className="text-xs capitalize">{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Duration</Label>
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              value={step.duration_type === 'time' ? Math.round(step.duration_value / 60) : step.duration_value}
                              onChange={e => updateStep(i, {
                                duration_value: step.duration_type === 'time'
                                  ? parseInt(e.target.value) * 60
                                  : parseInt(e.target.value),
                              })}
                              className="h-8 text-xs font-mono w-16 bg-muted/50 border-border/50"
                            />
                            <Select value={step.duration_type} onValueChange={v => updateStep(i, { duration_type: v })}>
                              <SelectTrigger className="h-8 text-xs w-16 bg-muted/50 border-border/50"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="time" className="text-xs">min</SelectItem>
                                <SelectItem value="distance" className="text-xs">m</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Pace (/km)</Label>
                          <div className="flex gap-1">
                            <Input
                              value={step.target_pace_low_sec_per_km ? secPerKmToDisplay(step.target_pace_low_sec_per_km) : ''}
                              onChange={e => updateStep(i, { target_pace_low_sec_per_km: displayToSecPerKm(e.target.value) || null })}
                              placeholder="5:00"
                              className="h-8 text-xs font-mono w-14 bg-muted/50 border-border/50"
                            />
                            <Input
                              value={step.target_pace_high_sec_per_km ? secPerKmToDisplay(step.target_pace_high_sec_per_km) : ''}
                              onChange={e => updateStep(i, { target_pace_high_sec_per_km: displayToSecPerKm(e.target.value) || null })}
                              placeholder="6:00"
                              className="h-8 text-xs font-mono w-14 bg-muted/50 border-border/50"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">HR (bpm)</Label>
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              value={step.target_hr_low_bpm || ''}
                              onChange={e => updateStep(i, { target_hr_low_bpm: parseInt(e.target.value) || null })}
                              placeholder="140"
                              className="h-8 text-xs font-mono w-14 bg-muted/50 border-border/50"
                            />
                            <Input
                              type="number"
                              value={step.target_hr_high_bpm || ''}
                              onChange={e => updateStep(i, { target_hr_high_bpm: parseInt(e.target.value) || null })}
                              placeholder="160"
                              className="h-8 text-xs font-mono w-14 bg-muted/50 border-border/50"
                            />
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeStep(i)} className="text-destructive/70 hover:text-destructive shrink-0 mt-4">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="mt-2 ml-9">
                      <Input
                        value={step.step_notes || ''}
                        onChange={e => updateStep(i, { step_notes: e.target.value || null })}
                        placeholder="Step notes..."
                        className="h-7 text-xs bg-muted/50 border-border/50"
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
