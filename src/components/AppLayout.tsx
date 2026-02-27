import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Shield, LayoutDashboard, Calendar, Settings, LogOut, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Mission Control', icon: LayoutDashboard },
  { to: '/calendar', label: 'Plan Calendar', icon: Calendar },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/onboarding', label: 'Settings', icon: Settings },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Nav */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14 px-4">
          <Link to="/dashboard" className="flex items-center gap-2 group">
            <Shield className="h-5 w-5 text-primary group-hover:animate-pulse-glow transition-all" />
            <span className="font-bold tracking-tight text-sm">SPARTAN OPS</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5',
                  location.pathname === item.to
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono hidden sm:block">
              {user?.email?.split('@')[0]}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { signOut(); navigate('/'); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="sm:hidden flex items-center justify-around border-b border-border/50 bg-card/30 py-1">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-1 rounded text-xs transition-colors',
              location.pathname === item.to ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <item.icon className="h-4 w-4" />
            <span className="text-[10px]">{item.label.split(' ')[0]}</span>
          </Link>
        ))}
      </nav>

      <main className="flex-1 container px-4 py-6">
        {children}
      </main>
    </div>
  );
}
