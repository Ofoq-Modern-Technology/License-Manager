import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  FileText, Wallet, ExternalLink, Copy, Eye, EyeOff,
  CheckCircle2, XCircle, Clock, RefreshCw, AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Session = {
  id: string;
  email: string;
  name: string;
  plan: string;
  currency: string;
  productId: number | null;
  productName: string | null;
  expectedAmountSol: number | null;
  expectedAmountUsdc: number | null;
  amountReceivedSol: number | null;
  amountReceivedUsdc: number | null;
  walletAddress: string;
  walletPrivateKey: string;
  status: string;
  licenseKey: string | null;
  sweepStatus: string;
  txSignature: string | null;
  expiresAt: string;
  createdAt: string;
};

const SESSION_STATUS_STYLE: Record<string, string> = {
  paid:             "text-green-400 bg-green-950/30 border-green-700/30",
  awaiting_payment: "text-yellow-400 bg-yellow-950/30 border-yellow-700/30",
  expired:          "text-muted-foreground bg-muted/10 border-border/30",
};
const SESSION_STATUS_ICON: Record<string, React.ReactNode> = {
  paid:             <CheckCircle2 className="w-3 h-3" />,
  awaiting_payment: <Clock className="w-3 h-3" />,
  expired:          <XCircle className="w-3 h-3" />,
};

const SWEEP_STATUS_STYLE: Record<string, string> = {
  done:    "text-green-400 bg-green-950/30 border-green-700/30",
  pending: "text-yellow-400 bg-yellow-950/30 border-yellow-700/30",
  failed:  "text-red-400 bg-red-950/30 border-red-700/30",
  skipped: "text-muted-foreground bg-muted/10 border-border/30",
};

const B58_CHARS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base64ToBase58(b64: string): string {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  let leadingZeros = 0;
  for (const byte of bytes) { if (byte === 0) leadingZeros++; else break; }
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] * 256;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) { digits.push(carry % 58); carry = Math.floor(carry / 58); }
  }
  return "1".repeat(leadingZeros) + digits.reverse().map(d => B58_CHARS[d]).join("");
}

function isBase64Key(key: string): boolean {
  return /^[A-Za-z0-9+/]+=*$/.test(key) && key.length > 60;
}

function displayKey(key: string): string {
  try { return isBase64Key(key) ? base64ToBase58(key) : key; } catch { return key; }
}

function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.style.cssText = "position:fixed;opacity:0;top:0;left:0;";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

function CopyButton({ text }: { text: string }) {
  const { toast } = useToast();
  return (
    <button
      onClick={() => { copyText(text); toast({ title: "Copied" }); }}
      className="text-muted-foreground hover:text-primary transition-colors p-0.5 rounded"
    >
      <Copy className="w-3 h-3" />
    </button>
  );
}

function RevealKey({ privateKey }: { privateKey: string }) {
  const [visible, setVisible] = useState(false);
  const { toast } = useToast();
  return (
    <div className="flex items-center gap-1">
      {visible ? (
        <code className="text-xs font-mono text-yellow-400 break-all max-w-xs select-all">
          {displayKey(privateKey)}
        </code>
      ) : (
        <code className="text-xs font-mono text-muted-foreground/40">
          {"•".repeat(20)}
        </code>
      )}
      <button
        onClick={() => setVisible(v => !v)}
        className="text-muted-foreground hover:text-primary transition-colors p-0.5 rounded flex-shrink-0"
        title={visible ? "Hide key" : "Reveal key"}
      >
        {visible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      </button>
      <button
        onClick={() => { copyText(displayKey(privateKey)); toast({ title: "Private key copied (base58)" }); }}
        className="text-muted-foreground hover:text-yellow-400 transition-colors p-0.5 rounded flex-shrink-0"
        title="Copy key"
      >
        <Copy className="w-3 h-3" />
      </button>
    </div>
  );
}

type Tab = "invoices" | "wallets";

export default function Invoices() {
  const [tab, setTab] = useState<Tab>("invoices");
  const [filter, setFilter] = useState<string>("all");

  const { data: sessions = [], isLoading, refetch, isFetching } = useQuery<Session[]>({
    queryKey: ["purchase-sessions"],
    queryFn: () => api.getPurchaseSessions(),
    refetchInterval: 30_000,
  });

  const filtered = filter === "all" ? sessions : sessions.filter(s => s.status === filter || s.sweepStatus === filter);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="w-4 h-4 text-primary" />
        <h1 className="font-mono text-lg font-bold tracking-wider">Invoices</h1>
        <span className="ml-auto text-xs text-muted-foreground font-mono">{sessions.length} sessions</span>
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded border border-border/30 hover:border-primary/30"
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/30">
        {(["invoices", "wallets"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-mono uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "invoices" ? <FileText className="w-3 h-3" /> : <Wallet className="w-3 h-3" />}
            {t}
          </button>
        ))}
      </div>

      {tab === "invoices" && (
        <>
          {/* Filter bar */}
          <div className="flex gap-2 flex-wrap">
            {["all", "paid", "awaiting_payment", "expired"].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-xs font-mono border transition-colors ${
                  filter === f
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border/30 text-muted-foreground hover:border-border"
                }`}
              >
                {f.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="bg-card border border-border/40 rounded-xl overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border/40 bg-muted/10">
                  <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Customer</th>
                  <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Product / Plan</th>
                  <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Sweep</th>
                  <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">License</th>
                  <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">TX</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No sessions found</td></tr>
                ) : filtered.map(s => (
                  <tr key={s.id} className="border-b border-border/20 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleDateString()}<br />
                      <span className="text-muted-foreground/50">{new Date(s.createdAt).toLocaleTimeString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-foreground">{s.name}</div>
                      <div className="text-muted-foreground/60">{s.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-foreground">{s.productName ?? `#${s.productId}`}</div>
                      <div className="text-muted-foreground/60">{s.plan} / {s.currency}</div>
                    </td>
                    <td className="px-4 py-3 text-foreground font-semibold">
                      {s.currency === "USDC"
                        ? `$${(s.amountReceivedUsdc ?? s.expectedAmountUsdc ?? 0).toFixed(2)}`
                        : `${(s.amountReceivedSol ?? s.expectedAmountSol ?? 0).toFixed(4)} SOL`}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded border ${SESSION_STATUS_STYLE[s.status] ?? "text-muted-foreground"}`}>
                        {SESSION_STATUS_ICON[s.status]} {s.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded border ${SWEEP_STATUS_STYLE[s.sweepStatus] ?? "text-muted-foreground"}`}>
                        {s.sweepStatus === "done" ? <CheckCircle2 className="w-3 h-3" /> :
                         s.sweepStatus === "failed" ? <AlertCircle className="w-3 h-3" /> :
                         s.sweepStatus === "pending" ? <Clock className="w-3 h-3" /> : null}
                        {s.sweepStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.licenseKey ? (
                        <div className="flex items-center gap-1">
                          <code className="text-primary">{s.licenseKey.slice(0, 9)}…</code>
                          <CopyButton text={s.licenseKey} />
                        </div>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {s.txSignature ? (
                        <div className="flex items-center gap-1">
                          <code className="text-muted-foreground">{s.txSignature.slice(0, 8)}…</code>
                          <a href={`https://solscan.io/tx/${s.txSignature}`} target="_blank" rel="noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <CopyButton text={s.txSignature} />
                        </div>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "wallets" && (
        <div className="bg-card border border-border/40 rounded-xl overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border/40 bg-muted/10">
                <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Customer</th>
                <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Wallet Address</th>
                <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Private Key</th>
                <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Currency / Amount</th>
                <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider">Sweep</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : sessions.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No wallets yet</td></tr>
              ) : sessions.map(s => (
                <tr key={s.id} className="border-b border-border/20 hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{s.name}</div>
                    <div className="text-muted-foreground/60">{s.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <a
                        href={`https://solscan.io/account/${s.walletAddress}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                        title={s.walletAddress}
                      >
                        <code>{s.walletAddress.slice(0, 12)}…{s.walletAddress.slice(-6)}</code>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <CopyButton text={s.walletAddress} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RevealKey privateKey={s.walletPrivateKey} />
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    <span className="text-muted-foreground">{s.currency}</span>{" "}
                    {s.currency === "USDC"
                      ? `$${(s.amountReceivedUsdc ?? s.expectedAmountUsdc ?? 0).toFixed(2)}`
                      : `${(s.amountReceivedSol ?? s.expectedAmountSol ?? 0).toFixed(4)}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded border ${SWEEP_STATUS_STYLE[s.sweepStatus] ?? "text-muted-foreground"}`}>
                      {s.sweepStatus === "done" ? <CheckCircle2 className="w-3 h-3" /> :
                       s.sweepStatus === "failed" ? <AlertCircle className="w-3 h-3" /> :
                       s.sweepStatus === "pending" ? <Clock className="w-3 h-3" /> : null}
                      {s.sweepStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
