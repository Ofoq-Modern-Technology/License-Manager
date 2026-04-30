import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Customer } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Users, Loader2, Mail, User } from "lucide-react";

export default function Customers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => api.getCustomers(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteCustomer(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["customers"] }); void qc.invalidateQueries({ queryKey: ["stats"] }); },
    onError: (e) => toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" }),
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await api.createCustomer({ name, email, notes: notes || undefined });
      await qc.invalidateQueries({ queryKey: ["customers"] });
      await qc.invalidateQueries({ queryKey: ["stats"] });
      setName(""); setEmail(""); setNotes("");
      toast({ title: "Customer added" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <h1 className="font-mono text-lg font-bold tracking-wider">Customers</h1>
        <span className="ml-auto text-xs text-muted-foreground font-mono">{customers.length} total</span>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="bg-card border border-border/40 rounded-xl p-5 space-y-3">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Add Customer</p>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" required
              className="w-full pl-8 pr-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary" />
          </div>
          <div className="relative flex-1">
            <Mail className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" type="email" required
              className="w-full pl-8 pr-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary" />
          </div>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
            className="flex-1 px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary" />
          <button type="submit" disabled={adding}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-md hover:opacity-90 disabled:opacity-50">
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add
          </button>
        </div>
      </form>

      {/* Table */}
      <div className="bg-card border border-border/40 rounded-xl overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border/40 bg-muted/10">
              <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Notes</th>
              <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Added</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No customers yet</td></tr>
            ) : customers.map((c) => (
              <tr key={c.id} className="border-b border-border/20 hover:bg-accent/30 transition-colors">
                <td className="px-4 py-3 text-foreground font-semibold">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.notes ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => deleteMutation.mutate(c.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
