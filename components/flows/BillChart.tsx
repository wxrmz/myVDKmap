"use client";

// The bill's monthly totals; a module of its own so recharts loads only once a receipt is shown.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { rub } from "@/lib/utils";

export default function BillChart({ data }: { data: { month: string; label: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
        <YAxis width={48} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          formatter={(v) => [rub(Number(v)), "Сумма"]}
          labelFormatter={(_, p) => p[0]?.payload.label ?? ""}
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }}
        />
        <Bar dataKey="total" fill="var(--foreground)" radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}
