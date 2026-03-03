import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Shield, Zap, ChevronRight } from 'lucide-react';

export default function Auth() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-primary/3 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo & branding */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-5 glow-accent"
          >
            <Shield className="h-8 w-8 text-primary" />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">SPARTAN OPS</h1>
          <p className="text-muted-foreground text-sm font-mono tracking-wider uppercase">Training mission control</p>
        </div>

        {/* Auth card */}
        <Card className="glass-card border-border/30 shadow-2xl shadow-primary/5">
          <CardHeader className="pb-2 pt-6 px-6">
            <CardTitle className="text-base font-semibold">Access Terminal</CardTitle>
            <CardDescription className="text-xs font-mono tracking-wide uppercase text-muted-foreground/70">
              Sign in or create your operator account
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <Tabs defaultValue="signin" className="space-y-5">
              <TabsList className="grid w-full grid-cols-2 bg-muted/50 border border-border/30 p-1 rounded-lg">
                <TabsTrigger
                  value="signin"
                  className="rounded-md text-xs font-mono uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="rounded-md text-xs font-mono uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>
              <TabsContent value="signin"><SignInForm /></TabsContent>
              <TabsContent value="signup"><SignUpForm /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-[10px] font-mono text-muted-foreground/40 mt-6 tracking-widest uppercase">
          Secure • Encrypted • Mission-Ready
        </p>
      </motion.div>
    </div>
  );
}

function SignInForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) toast.error(error.message);
    setSubmitting(false);
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="signin-email" className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">Email</Label>
        <Input id="signin-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="operator@spartan.com" required className="bg-muted/50 border-border/40 focus:border-primary/50 h-11" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signin-password" className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">Password</Label>
        <Input id="signin-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required className="bg-muted/50 border-border/40 focus:border-primary/50 h-11" />
      </div>
      <Button type="submit" className="w-full h-11 font-mono uppercase tracking-wider text-xs glow-primary" disabled={submitting}>
        {submitting ? (
          <span className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 animate-pulse" />Authenticating...</span>
        ) : (
          <span className="flex items-center gap-2"><Zap className="h-3.5 w-3.5" />Sign In<ChevronRight className="h-3.5 w-3.5" /></span>
        )}
      </Button>
    </motion.form>
  );
}

function SignUpForm() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signUp(email, password);
    if (error) toast.error(error.message);
    else toast.success('Check your email to confirm your account.');
    setSubmitting(false);
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="signup-email" className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">Email</Label>
        <Input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="operator@spartan.com" required className="bg-muted/50 border-border/40 focus:border-primary/50 h-11" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-password" className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">Password</Label>
        <Input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" minLength={6} required className="bg-muted/50 border-border/40 focus:border-primary/50 h-11" />
      </div>
      <Button type="submit" className="w-full h-11 font-mono uppercase tracking-wider text-xs glow-primary" disabled={submitting}>
        {submitting ? (
          <span className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 animate-pulse" />Creating Account...</span>
        ) : (
          <span className="flex items-center gap-2">Create Account<ChevronRight className="h-3.5 w-3.5" /></span>
        )}
      </Button>
    </motion.form>
  );
}

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="text-center relative z-10"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-5 animate-pulse-glow">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <p className="text-muted-foreground font-mono text-[10px] tracking-[0.3em] uppercase">Initializing...</p>
      </motion.div>
    </div>
  );
}
