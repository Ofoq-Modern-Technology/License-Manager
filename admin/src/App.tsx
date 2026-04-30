import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from "react";
import { Terminal, Lock } from "lucide-react";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Customers from "@/pages/Customers";
import Licenses from "@/pages/Licenses";
import Payments from "@/pages/Payments";
import Pricing from "@/pages/Pricing";
import Layout from "@/components/Layout";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function AdminLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [token, setToken] = useState("");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="text-primary font-mono text-xl font-bold tracking-widest flex items-center justify-center gap-2">
            <Terminal className="w-5 h-5" /> LICENSE_SERVER
          </div>
          <p className="text-muted-foreground text-xs tracking-widest uppercase">Admin Access</p>
        </div>
        <form onSubmit={e => { e.preventDefault(); token && onLogin(token); }} className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Admin Token</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Enter admin token"
                className="w-full pl-9 pr-3 py-2 bg-background border border-border/60 rounded-md text-sm font-mono focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground font-mono text-sm font-bold py-2 rounded-md hover:opacity-90 transition-opacity"
          >
            Access Admin Panel
          </button>
        </form>
        <p className="text-center text-xs text-muted-foreground/50 font-mono">
          Set ADMIN_TOKEN env var on the license server
        </p>
      </div>
    </div>
  );
}

function App() {
  const [authed, setAuthed] = useState<boolean>(() => !!localStorage.getItem("ls_admin_token"));

  function login(token: string) {
    localStorage.setItem("ls_admin_token", token);
    setAuthed(true);
  }

  if (!authed) return <AdminLogin onLogin={login} />;

  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={BASE}>
        <Layout onLogout={() => { localStorage.removeItem("ls_admin_token"); setAuthed(false); }}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/products" component={Products} />
            <Route path="/customers" component={Customers} />
            <Route path="/licenses" component={Licenses} />
            <Route path="/payments" component={Payments} />
            <Route path="/pricing" component={Pricing} />
          </Switch>
        </Layout>
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
