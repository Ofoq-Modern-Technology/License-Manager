import { useLocation } from "wouter";
import { LayoutDashboard, Users, Key, CreditCard, LogOut, Terminal, Settings2, Package, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/products", label: "Products", icon: Package },
  { path: "/customers", label: "Customers", icon: Users },
  { path: "/licenses", label: "Licenses", icon: Key },
  { path: "/payments", label: "Payments", icon: CreditCard },
  { path: "/invoices", label: "Invoices", icon: FileText },
  { path: "/pricing", label: "Pricing", icon: Settings2 },
];

export default function Layout({ children, onLogout }: { children: React.ReactNode; onLogout: () => void }) {
  const [location, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-52 border-r border-border/30 bg-card/30 flex flex-col">
        <div className="px-5 py-4 border-b border-border/20">
          <div className="text-primary font-mono font-bold text-sm tracking-widest flex items-center gap-2">
            <Terminal className="w-4 h-4" /> LICENSE_SRV
          </div>
          <p className="text-muted-foreground text-xs font-mono mt-0.5">Admin Panel</p>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-0.5">
          {NAV.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-mono transition-colors",
                location === path
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </nav>
        <div className="px-2 py-3 border-t border-border/20">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-mono text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Log out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
