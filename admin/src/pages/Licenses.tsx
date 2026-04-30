import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type License, type Customer } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Key, Plus, ShieldOff, ShieldCheck, Trash2, Copy, Loader2, CheckCircle2, Monitor } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-400 bg-green-950/30 border-green-700/30",
  expired: "text-yellow-400 bg-yellow-950/30 border-yellow-700/30",
  revoked: "text-red-400 bg-red-950/30 border-red-700/30",
};

const PLAN_LABELS: Record<string, string> = {
  monthly: "Monthly",
  annual: "Annual",
  lifetime: "Lifetime",
};

export default function Licenses() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ customerId: "", plan: "monthly", expiresAt: "", notes: "" });
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const { data: licenses = [], isLoading } = useQuery<License[]>({
    queryKey: ["licenses"],
    queryFn: () => api.getLicenses(),
  });
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => api.getCustomers(),
  });

  const revokeMut = useMutation({
    mutationFn: (id: number) => api.revokeLicense(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["licenses"] }); void qc.invalidateQueries({ queryKey: ["stats"] }); toast({ title: "License revoked" }); },
  });
  const restoreMut = useMutation({
    mutationFn: (id: number) => api.restoreLicense(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["licenses"] }); void qc.invalidateQueries({ queryKey: ["stats"] }); toast({ title: "License restored" }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteLicense(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["licenses"] }); void qc.invalidateQueries({ queryKey: ["stats"] }); },
  });

  function copyKey(id: number, key: string) {
    navigator.clipboard.writeText(key).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await api.createLicense({
        customerId: form.customerId ? Number(form.customerId) : undefined,
        plan: form.plan as "monthly" | "annual" | "lifetime",
        expiresAt: form.expiresAt || undefined,
        notes: form.notes || undefined,
      });
      await qc.invalidateQueries({ queryKey: ["licenses"] });
      await qc.invalidateQueries({ queryKey: ["stats"] });
      setForm({ customerId: "", plan: "monthly", expiresAt: "", notes: "" });
      toast({ title: "License key generated" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-2">
        <Key className="w-4 h-4 text-primary" />
        <h1 className="font-mono text-lg font-bold tracking-wider">Licenses</h1>
        <span className="ml-auto text-xs text-muted-foreground font-mono">{licenses.length} total</span>
      </div>

      {/* Generate form */}
      <form onSubmit={handleAdd} className="bg-card border border-border/40 rounded-xl p-5 space-y-3">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Generate License Key</p>
        <div className="flex gap-3 flex-wrap">
          <select value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
            className="flex-1 min-w-36 px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary text-foreground">
            <option value="">No customer</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
          </select>
          <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
            className="px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary text-foreground">
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
            <option value="lifetime">Lifetime</option>
          </select>
          <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
            placeholder="Custom expiry (optional)"
            className="px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary text-foreground" />
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)"
            className="flex-1 px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary" />
          <button type="submit" disabled={adding}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-md hover:opacity-90 disabled:opacity-50">
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Generate
          </button>
        </div>
      </form>

      {/* Table */}
      <div className="bg-card border border-border/40 rounded-xl overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border/40 bg-muted/10">
              <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Key</th>
              <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Customer</th>
              <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Plan</th>
              <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Instance</th>
              <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Expires</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : licenses.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No license keys yet</td></tr>
            ) : licenses.map((l) => (
              <tr key={l.id} className="border-b border-border/20 hover:bg-accent/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <code className="text-primary tracking-widest">{l.key}</code>
                    <button onClick={() => copyKey(l.id, l.key)} className="text-muted-foreground hover:text-primary transition-colors">
                      {copied === l.id ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {l.customerName ? <><div>{l.customerName}</div><div className="text-muted-foreground/60">{l.customerEmail}</div></> : "—"}
                </td>
                <td className="px-4 py-3"><span className="text-foreground">{PLAN_LABELS[l.plan] ?? l.plan}</span></td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded border text-xs ${STATUS_COLORS[l.status] ?? "text-muted-foreground"}`}>{l.status}</span>
                </td>
                <td className="px-4 py-3">
                  {l.instanceName ? (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Monitor className="w-3 h-3" /> {l.instanceName}
                    </div>
                  ) : <span className="text-muted-foreground/40">not activated</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {l.expiresAt ? new Date(l.expiresAt).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {l.status === "active" ? (
                      <button onClick={() => revokeMut.mutate(l.id)} title="Revoke"
                        className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded">
                        <ShieldOff className="w-3.5 h-3.5" />
                      </button>
                    ) : l.status === "revoked" ? (
                      <button onClick={() => restoreMut.mutate(l.id)} title="Restore"
                        className="text-muted-foreground hover:text-green-400 transition-colors p-1 rounded">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                    <button onClick={() => deleteMut.mutate(l.id)} title="Delete"
                      className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
