import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Calendar, Settings, LogOut, BarChart3, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/calendar', label: 'Plan', icon: Calendar },
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
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16 px-4">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold tracking-tight text-foreground">Spartan Ops</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-0.5 bg-muted/50 rounded-xl p-1">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                  location.pathname === item.to
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-muted-foreground">
                {user?.email?.split('@')[0]}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { signOut(); navigate('/'); }}
              className="text-muted-foreground hover:text-foreground h-9 w-9"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="sm:hidden flex items-center justify-around border-b border-border/30 bg-card/50 backdrop-blur-sm py-1.5">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'flex flex-col items-center gap-1 px-4 py-1.5 rounded-lg text-xs transition-colors',
              location.pathname === item.to ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <item.icon className="h-4.5 w-4.5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

      <main className="flex-1 container px-4 py-8">
        {children}
      </main>
    </div>
  );
}