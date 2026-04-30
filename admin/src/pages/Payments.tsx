import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Payment, type Customer, type License } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Plus, CheckCircle2, XCircle, Clock, Loader2, Trash2, ExternalLink } from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  verified: "text-green-400 bg-green-950/30 border-green-700/30",
  pending:  "text-yellow-400 bg-yellow-950/30 border-yellow-700/30",
  failed:   "text-red-400 bg-red-950/30 border-red-700/30",
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  verified: <CheckCircle2 className="w-3 h-3" />,
  pending:  <Clock className="w-3 h-3" />,
  failed:   <XCircle className="w-3 h-3" />,
};

export default function Payments() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ customerId: "", licenseId: "", txSignature: "", amountUsdc: "", amountSol: "", currency: "USDC", notes: "" });
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState<number | null>(null);

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["payments"],
    queryFn: () => api.getPayments(),
  });
  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ["customers"], queryFn: () => api.getCustomers() });
  const { data: licenses = [] } = useQuery<License[]>({ queryKey: ["licenses"], queryFn: () => api.getLicenses() });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deletePayment(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["payments"] }); void qc.invalidateQueries({ queryKey: ["stats"] }); },
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await api.createPayment({
        customerId: form.customerId ? Number(form.customerId) : undefined,
        licenseId: form.licenseId ? Number(form.licenseId) : undefined,
        txSignature: form.txSignature || undefined,
        amountUsdc: form.amountUsdc ? Number(form.amountUsdc) : undefined,
        amountSol: form.amountSol ? Number(form.amountSol) : undefined,
        currency: form.currency as "SOL" | "USDC",
        notes: form.notes || undefined,
      });
      await qc.invalidateQueries({ queryKey: ["payments"] });
      await qc.invalidateQueries({ queryKey: ["stats"] });
      setForm({ customerId: "", licenseId: "", txSignature: "", amountUsdc: "", amountSol: "", currency: "USDC", notes: "" });
      toast({ title: "Payment logged" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  async function handleVerify(id: number) {
    setVerifying(id);
    try {
      const result = await api.verifyPayment(id);
      await qc.invalidateQueries({ queryKey: ["payments"] });
      await qc.invalidateQueries({ queryKey: ["stats"] });
      if (result.verified) {
        toast({ title: "Payment verified on-chain", description: `${result.currency}: ${result.amountUsdc ?? result.amountSol}` });
      } else {
        toast({ title: "Verification failed", description: result.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setVerifying(null);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-primary" />
        <h1 className="font-mono text-lg font-bold tracking-wider">Payments</h1>
        <span className="ml-auto text-xs text-muted-foreground font-mono">{payments.length} total</span>
      </div>

      {/* Add payment */}
      <form onSubmit={handleAdd} className="bg-card border border-border/40 rounded-xl p-5 space-y-3">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Log Payment</p>
        <div className="flex gap-3 flex-wrap">
          <select value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
            className="flex-1 min-w-36 px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary text-foreground">
            <option value="">No customer</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={form.licenseId} onChange={e => setForm(f => ({ ...f, licenseId: e.target.value }))}
            className="flex-1 min-w-36 px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary text-foreground">
            <option value="">No license</option>
            {licenses.map(l => <option key={l.id} value={l.id}>{l.key.slice(0, 9)}… ({l.plan})</option>)}
          </select>
          <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
            className="px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary text-foreground">
            <option>USDC</option>
            <option>SOL</option>
          </select>
          {form.currency === "USDC" ? (
            <input value={form.amountUsdc} onChange={e => setForm(f => ({ ...f, amountUsdc: e.target.value }))}
              placeholder="Amount USDC" type="number" step="0.01"
              className="w-32 px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary" />
          ) : (
            <input value={form.amountSol} onChange={e => setForm(f => ({ ...f, amountSol: e.target.value }))}
              placeholder="Amount SOL" type="number" step="0.001"
              className="w-32 px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary" />
          )}
        </div>
        <div className="flex gap-3">
          <input value={form.txSignature} onChange={e => setForm(f => ({ ...f, txSignature: e.target.value }))}
            placeholder="Solana TX signature (paste to verify on-chain)"
            className="flex-1 px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary" />
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes"
            className="flex-1 px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary" />
          <button type="submit" disabled={adding}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-md hover:opacity-90 disabled:opacity-50">
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Log
          </button>
        </div>
      </form>

      {/* Table */}
      <div className="bg-card border border-border/40 rounded-xl overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border/40 bg-muted/10">
              <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Customer</th>
              <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">License</th>
              <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Amount</th>
              <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">TX Signature</th>
              <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No payments logged yet</td></tr>
            ) : payments.map((p) => (
              <tr key={p.id} className="border-b border-border/20 hover:bg-accent/30 transition-colors">
                <td className="px-4 py-3 text-foreground">{p.customerName ?? "—"}</td>
                <td className="px-4 py-3 text-primary">{p.licenseKey ? `${p.licenseKey.slice(0, 9)}…` : "—"}</td>
                <td className="px-4 py-3 text-foreground font-semibold">
                  {p.currency === "USDC" && p.amountUsdc ? `$${p.amountUsdc} USDC` :
                   p.currency === "SOL" && p.amountSol ? `${p.amountSol} SOL` : "—"}
                </td>
                <td className="px-4 py-3">
                  {p.txSignature ? (
                    <div className="flex items-center gap-1">
                      <code className="text-muted-foreground">{p.txSignature.slice(0, 12)}…</code>
                      <a href={`https://solscan.io/tx/${p.txSignature}`} target="_blank" rel="noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded border ${STATUS_STYLE[p.status] ?? "text-muted-foreground"}`}>
                    {STATUS_ICON[p.status]} {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {p.status === "pending" && p.txSignature && (
                      <button onClick={() => handleVerify(p.id)} disabled={verifying === p.id}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-green-400 border border-green-700/30 bg-green-950/20 hover:bg-green-950/40 disabled:opacity-50">
                        {verifying === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Verify
                      </button>
                    )}
                    <button onClick={() => deleteMut.mutate(p.id)}
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
