import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Save, Loader2, DollarSign, Wallet, RefreshCw, ShoppingCart } from "lucide-react";
import { api } from "@/lib/api";

interface Pricing {
  monthly_price_sol: number;
  annual_price_sol: number;
  lifetime_price_sol: number;
  monthly_price_usdc: number;
  annual_price_usdc: number;
  lifetime_price_usdc: number;
  vault_wallet_address: string;
  session_ttl_minutes?: number;
}

interface PurchaseSession {
  id: string;
  email: string;
  name: string;
  plan: string;
  currency: string;
  expectedAmountSol: number | null;
  expectedAmountUsdc: number | null;
  walletAddress: string;
  status: string;
  licenseKey: string | null;
  sweepStatus: string;
  expiresAt: string;
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  awaiting_payment: "text-yellow-400 bg-yellow-950/30 border-yellow-700/30",
  paid:             "text-green-400 bg-green-950/30 border-green-700/30",
  expired:          "text-muted-foreground bg-muted/10 border-border/30",
  failed:           "text-red-400 bg-red-950/30 border-red-700/30",
};

export default function Pricing() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: pricing, isLoading } = useQuery<Pricing>({
    queryKey: ["pricing"],
    queryFn: () => api.getPricing(),
  });

  const { data: sessions = [], isLoading: sessionsLoading, refetch: refetchSessions } = useQuery<PurchaseSession[]>({
    queryKey: ["purchase-sessions"],
    queryFn: () => api.getPurchaseSessions(),
    refetchInterval: 10_000,
  });

  const [form, setForm] = useState<Partial<Pricing>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pricing) setForm(pricing);
  }, [pricing]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updatePricing(form as Pricing);
      await qc.invalidateQueries({ queryKey: ["pricing"] });
      toast({ title: "Pricing saved" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function field(key: keyof Pricing, label: string, suffix?: string) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</label>
        <div className="relative">
          <input
            type="number"
            step="0.01"
            value={String(form[key] ?? "")}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            className="w-full px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary"
          />
          {suffix && (
            <span className="absolute right-3 top-2 text-xs font-mono text-muted-foreground">{suffix}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center gap-2">
        <Settings2 className="w-4 h-4 text-primary" />
        <h1 className="font-mono text-lg font-bold tracking-wider">Pricing & Settings</h1>
      </div>

      {/* Pricing config */}
      <form onSubmit={handleSave} className="bg-card border border-border/40 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" />
          <span className="font-mono text-sm font-semibold">Subscription Prices</span>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-3">
                <p className="text-xs font-mono text-primary uppercase tracking-widest font-bold">Monthly</p>
                {field("monthly_price_usdc", "USDC Price", "USDC")}
                {field("monthly_price_sol", "SOL Price", "SOL")}
              </div>
              <div className="space-y-3">
                <p className="text-xs font-mono text-primary uppercase tracking-widest font-bold">Annual</p>
                {field("annual_price_usdc", "USDC Price", "USDC")}
                {field("annual_price_sol", "SOL Price", "SOL")}
              </div>
              <div className="space-y-3">
                <p className="text-xs font-mono text-primary uppercase tracking-widest font-bold">Lifetime</p>
                {field("lifetime_price_usdc", "USDC Price", "USDC")}
                {field("lifetime_price_sol", "SOL Price", "SOL")}
              </div>
            </div>

            <div className="border-t border-border/30 pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="font-mono text-sm font-semibold">Vault Wallet</span>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  Vault Address (funds are swept here after payment)
                </label>
                <input
                  type="text"
                  value={String(form.vault_wallet_address ?? "")}
                  onChange={e => setForm(f => ({ ...f, vault_wallet_address: e.target.value }))}
                  placeholder="Solana wallet address"
                  className="w-full px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary"
                />
              </div>
              <p className="text-xs font-mono text-muted-foreground/60">
                Set <code className="text-yellow-400">VAULT_WALLET_PRIVATE_KEY</code> env var on the server to enable automatic USDC sweeping.
              </p>
              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  Payment Session TTL (minutes)
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={String(form.session_ttl_minutes ?? 30)}
                  onChange={e => setForm(f => ({ ...f, session_ttl_minutes: parseInt(e.target.value) }))}
                  className="w-24 px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-md hover:opacity-90 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Settings
            </button>
          </>
        )}
      </form>

      {/* Purchase Sessions */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" />
          <span className="font-mono text-sm font-semibold">Purchase Sessions</span>
          <span className="ml-auto text-xs text-muted-foreground font-mono">{sessions.length} total</span>
          <button onClick={() => void refetchSessions()} className="text-muted-foreground hover:text-primary">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="bg-card border border-border/40 rounded-xl overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border/40 bg-muted/10">
                <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Customer</th>
                <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Plan</th>
                <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Amount</th>
                <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Sweep</th>
                <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">License Key</th>
                <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Expires</th>
              </tr>
            </thead>
            <tbody>
              {sessionsLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : sessions.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No purchase sessions yet</td></tr>
              ) : sessions.map(s => (
                <tr key={s.id} className="border-b border-border/20 hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{s.name}</div>
                    <div className="text-muted-foreground/70">{s.email}</div>
                  </td>
                  <td className="px-4 py-3 text-foreground capitalize">{s.plan} / {s.currency}</td>
                  <td className="px-4 py-3 text-foreground">
                    {s.currency === "USDC" ? `$${s.expectedAmountUsdc}` : `${s.expectedAmountSol} SOL`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded border ${STATUS_STYLE[s.status] ?? "text-muted-foreground"}`}>
                      {s.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={s.sweepStatus === "done" ? "text-green-400" : s.sweepStatus === "failed" ? "text-red-400" : "text-muted-foreground"}>
                      {s.sweepStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {s.licenseKey ? <code className="text-primary">{s.licenseKey.slice(0, 9)}…</code> : <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(s.expiresAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
