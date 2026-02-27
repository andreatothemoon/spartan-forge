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
import { Shield, Zap } from 'lucide-react';

export default function Auth() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">SPARTAN OPS</h1>
          </div>
          <p className="text-muted-foreground">Training mission control for Spartan Ultra</p>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Access Terminal</CardTitle>
            <CardDescription>Sign in or create your operator account</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 bg-muted">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              <TabsContent value="signin"><SignInForm /></TabsContent>
              <TabsContent value="signup"><SignUpForm /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input id="signin-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="operator@spartan.com" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-password">Password</Label>
        <Input id="signin-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        <Zap className="h-4 w-4 mr-2" />{submitting ? 'Authenticating...' : 'Sign In'}
      </Button>
    </form>
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="operator@spartan.com" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" minLength={6} required />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Creating Account...' : 'Create Account'}
      </Button>
    </form>
  );
}

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Shield className="h-12 w-12 text-primary animate-pulse mx-auto mb-4" />
        <p className="text-muted-foreground font-mono text-sm">INITIALIZING...</p>
      </div>
    </div>
  );
}
