import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Product, type CreateProductBody } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Pencil, Trash2, Loader2, X, Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-400 bg-green-950/30 border-green-700/30",
  inactive: "text-zinc-400 bg-zinc-900/30 border-zinc-700/30",
};

const EMPTY_FORM: CreateProductBody = {
  name: "",
  description: "",
  status: "active",
  monthlyPriceSol: null,
  annualPriceSol: null,
  lifetimePriceSol: null,
  monthlyPriceUsdc: null,
  annualPriceUsdc: null,
  lifetimePriceUsdc: null,
  vaultWalletAddress: null,
};

function PricingFields({
  values,
  onChange,
}: {
  values: CreateProductBody;
  onChange: (key: keyof CreateProductBody, val: string) => void;
}) {
  const field = (label: string, k: keyof CreateProductBody, placeholder: string) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</label>
      <input
        type="number"
        step="any"
        min="0"
        value={(values[k] as number | null) ?? ""}
        onChange={e => onChange(k, e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 bg-background border border-border/50 rounded-md text-xs font-mono focus:outline-none focus:border-primary"
      />
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider">
        Pricing (leave blank to inherit global defaults)
      </p>
      <div className="grid grid-cols-3 gap-3">
        {field("Monthly SOL", "monthlyPriceSol", "e.g. 0.5")}
        {field("Annual SOL", "annualPriceSol", "e.g. 1.5")}
        {field("Lifetime SOL", "lifetimePriceSol", "e.g. 3")}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {field("Monthly USDC", "monthlyPriceUsdc", "e.g. 49")}
        {field("Annual USDC", "annualPriceUsdc", "e.g. 149")}
        {field("Lifetime USDC", "lifetimePriceUsdc", "e.g. 299")}
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Vault Wallet (leave blank to use global)
        </label>
        <input
          type="text"
          value={values.vaultWalletAddress ?? ""}
          onChange={e => onChange("vaultWalletAddress", e.target.value)}
          placeholder="Solana wallet address (optional)"
          className="mt-1 w-full px-2 py-1.5 bg-background border border-border/50 rounded-md text-xs font-mono focus:outline-none focus:border-primary"
        />
      </div>
    </div>
  );
}

function parseNum(v: string): number | null {
  const n = parseFloat(v);
  return isNaN(n) || v === "" ? null : n;
}

export default function Products() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateProductBody>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CreateProductBody>(EMPTY_FORM);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => api.getProducts(),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteProduct(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["products"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: "Product deleted" });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<CreateProductBody> }) =>
      api.updateProduct(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["products"] });
      setEditId(null);
      toast({ title: "Product updated" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    },
  });

  function setFormField(key: keyof CreateProductBody, val: string) {
    const numKeys: (keyof CreateProductBody)[] = [
      "monthlyPriceSol","annualPriceSol","lifetimePriceSol",
      "monthlyPriceUsdc","annualPriceUsdc","lifetimePriceUsdc",
    ];
    if (numKeys.includes(key)) {
      setForm(f => ({ ...f, [key]: parseNum(val) }));
    } else {
      setForm(f => ({ ...f, [key]: val || null }));
    }
  }

  function setEditField(key: keyof CreateProductBody, val: string) {
    const numKeys: (keyof CreateProductBody)[] = [
      "monthlyPriceSol","annualPriceSol","lifetimePriceSol",
      "monthlyPriceUsdc","annualPriceUsdc","lifetimePriceUsdc",
    ];
    if (numKeys.includes(key)) {
      setEditForm(f => ({ ...f, [key]: parseNum(val) }));
    } else {
      setEditForm(f => ({ ...f, [key]: val || null }));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setAdding(true);
    try {
      await api.createProduct(form);
      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["stats"] });
      setForm(EMPTY_FORM);
      setShowForm(false);
      toast({ title: "Product created" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  function startEdit(p: Product) {
    setEditId(p.id);
    setEditForm({
      name: p.name,
      description: p.description ?? "",
      status: p.status as "active" | "inactive",
      monthlyPriceSol:  p.monthlyPriceSol  ?? null,
      annualPriceSol:   p.annualPriceSol   ?? null,
      lifetimePriceSol: p.lifetimePriceSol ?? null,
      monthlyPriceUsdc:  p.monthlyPriceUsdc  ?? null,
      annualPriceUsdc:   p.annualPriceUsdc   ?? null,
      lifetimePriceUsdc: p.lifetimePriceUsdc ?? null,
      vaultWalletAddress: p.vaultWalletAddress ?? null,
    });
  }

  function saveEdit() {
    if (!editId) return;
    updateMut.mutate({ id: editId, body: editForm });
  }

  const pricingLabel = (p: Product) => {
    const parts: string[] = [];
    if (p.monthlyPriceSol) parts.push(`${p.monthlyPriceSol} SOL/mo`);
    else if (p.monthlyPriceUsdc) parts.push(`$${p.monthlyPriceUsdc}/mo`);
    if (p.lifetimePriceSol) parts.push(`${p.lifetimePriceSol} SOL lifetime`);
    else if (p.lifetimePriceUsdc) parts.push(`$${p.lifetimePriceUsdc} lifetime`);
    return parts.length ? parts.join(" · ") : "global pricing";
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-primary" />
        <h1 className="font-mono text-lg font-bold tracking-wider">Products</h1>
        <span className="ml-auto text-xs text-muted-foreground font-mono">{products.length} total</span>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-md hover:opacity-90 transition-opacity"
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? "Cancel" : "New Product"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-card border border-primary/20 rounded-xl p-5 space-y-4">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">New Product</p>

          <div className="flex gap-3">
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Product name *"
              className="flex-1 px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary"
            />
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as "active" | "inactive" }))}
              className="px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary text-foreground"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <input
            value={form.description ?? ""}
            onChange={e => setForm(f => ({ ...f, description: e.target.value || undefined }))}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary"
          />

          <PricingFields values={form} onChange={setFormField} />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={adding || !form.name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create Product
            </button>
          </div>
        </form>
      )}

      {/* Product list */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground text-xs font-mono py-12">Loading…</div>
        ) : products.length === 0 ? (
          <div className="text-center text-muted-foreground text-xs font-mono py-12 bg-card border border-border/40 rounded-xl">
            No products yet — create one to start issuing licenses
          </div>
        ) : products.map(p => (
          <div key={p.id} className="bg-card border border-border/40 rounded-xl overflow-hidden">
            {editId === p.id ? (
              /* ── Inline edit ── */
              <div className="p-5 space-y-4">
                <div className="flex gap-3">
                  <input
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Product name"
                    className="flex-1 px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary"
                  />
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value as "active" | "inactive" }))}
                    className="px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary text-foreground"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <input
                  value={editForm.description ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value || null }))}
                  placeholder="Description (optional)"
                  className="w-full px-3 py-2 bg-background border border-border/50 rounded-md text-sm font-mono focus:outline-none focus:border-primary"
                />

                <PricingFields values={editForm} onChange={setEditField} />

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditId(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground border border-border/40 rounded-md transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={updateMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
                  >
                    {updateMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Save
                  </button>
                </div>
              </div>
            ) : (
              /* ── Card view ── */
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-foreground truncate">{p.name}</span>
                    <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-mono", STATUS_COLORS[p.status] ?? "text-muted-foreground")}>
                      {p.status}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground font-mono truncate">{p.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                    <span>{p.licenseCount ?? 0} license{(p.licenseCount ?? 0) !== 1 ? "s" : ""}</span>
                    <span className="text-border">|</span>
                    <span>{pricingLabel(p)}</span>
                    {p.vaultWalletAddress && (
                      <>
                        <span className="text-border">|</span>
                        <span className="text-primary/70">custom vault</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(p)}
                    title="Edit"
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${p.name}"?`)) deleteMut.mutate(p.id); }}
                    title="Delete"
                    className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
