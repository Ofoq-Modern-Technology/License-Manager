import { useQuery } from "@tanstack/react-query";
import { api, type Stats } from "@/lib/api";
import { Users, Key, CreditCard, ShieldCheck, Clock, Activity } from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: () => api.getStats(),
    refetchInterval: 15_000,
  });

  const cards = [
    { label: "Total Customers", value: stats?.totalCustomers, icon: Users, color: "text-blue-400" },
    { label: "Active Licenses", value: stats?.activeLicenses, icon: ShieldCheck, color: "text-green-400" },
    { label: "Total Licenses", value: stats?.totalLicenses, icon: Key, color: "text-primary" },
    { label: "Pending Payments", value: stats?.pendingPayments, icon: Clock, color: "text-yellow-400" },
    { label: "Verified Payments", value: stats?.verifiedPayments, icon: CreditCard, color: "text-green-400" },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="font-mono text-lg font-bold text-foreground tracking-wider">Dashboard</h1>
        <p className="text-muted-foreground text-xs font-mono mt-0.5">License server overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border/40 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted/40 rounded animate-pulse" />
            ) : (
              <span className={`text-2xl font-bold font-mono ${color}`}>{value ?? 0}</span>
            )}
          </div>
        ))}
      </div>

      <div className="bg-card border border-border/40 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-primary" />
          <span className="font-mono text-sm font-semibold">Quick Guide</span>
        </div>
        <ol className="space-y-2 text-xs font-mono text-muted-foreground list-decimal list-inside">
          <li>Add a <span className="text-primary">Customer</span> — name + email</li>
          <li>Create a <span className="text-primary">License</span> key for that customer (monthly / annual / lifetime)</li>
          <li>Log a <span className="text-primary">Payment</span> — paste the Solana TX signature</li>
          <li>Click <span className="text-primary">Verify</span> on the payment to confirm it on-chain</li>
          <li>Copy the license key and send it to the customer</li>
        </ol>
        <div className="mt-4 p-3 bg-yellow-950/30 border border-yellow-800/30 rounded-lg text-xs font-mono text-yellow-300">
          <strong>ADMIN_TOKEN:</strong> set this env var on your deployed server. Never share it.
        </div>
      </div>
    </div>
  );
}
