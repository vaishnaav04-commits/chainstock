
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock3,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { explainError } from "../services/blockchain";
import {
  getAnalytics,
  loadWarehouseSnapshot,
  STATUS_COLORS,
  formatHours,
} from "../services/warehouseInsights";

const PALETTE = [
  "#14b8a6",
  "#38bdf8",
  "#a78bfa",
  "#f59e0b",
  "#fb7185",
  "#818cf8",
];

function ChartCard({ title, subtitle, children }) {
  return (
    <section className="panel min-w-0 p-5 sm:p-6">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1 text-xs muted">{subtitle}</p>
      <div className="mt-6 h-[270px] w-full">
        {children}
      </div>
    </section>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm muted dark:border-white/10">
      {message}
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "#152239",
  border: "1px solid #334155",
  borderRadius: 12,
  color: "#f8fafc",
};

export default function Analytics() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot(await loadWarehouseSnapshot());
      setError("");
    } catch (err) {
      setError(explainError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const analytics = useMemo(
    () => snapshot ? getAnalytics(snapshot) : null,
    [snapshot],
  );

  const avgCompletedDwell = useMemo(() => {
    if (!analytics) return null;

    const values = analytics.zoneStats
      .filter((z) => z.averageDwellHours !== null)
      .map((z) => z.averageDwellHours);

    return values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
  }, [analytics]);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Warehouse Intelligence</p>
          <h2 className="mt-2 text-3xl font-extrabold">
            Analytics
          </h2>
          <p className="mt-2 text-sm muted">
            Operational insights derived from verified inventory history.
          </p>
        </div>
        <button
          className="btn-secondary"
          disabled={loading}
          onClick={refresh}
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh Analytics
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-500">
          Failed to load analytics: {error}
        </div>
      )}

      {loading && !snapshot ? (
        <div className="panel flex items-center gap-3 p-10">
          <Loader2 className="animate-spin text-teal-500" />
          Reading on-chain movements...
        </div>
      ) : analytics && (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {[
              {
                label: "Registered Pallets",
                value: snapshot.items.length,
                icon: BarChart3,
              },
              {
                label: "Recorded Movements",
                value: analytics.movements.length,
                icon: Activity,
              },
              {
                label: "Average Zone Dwell",
                value: avgCompletedDwell === null
                  ? "—"
                  : formatHours(avgCompletedDwell),
                icon: Clock3,
              },
              {
                label: "Damage / Return Incidence",
                value: `${analytics.exceptionRate.toFixed(1)}%`,
                icon: AlertTriangle,
              },
            ].map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="panel p-5">
                  <Icon size={22} className="text-teal-500" />
                  <p className="mt-4 text-sm muted">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-2xl font-extrabold">
                    {metric.value}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <ChartCard
              title="Movements Per Day"
              subtitle="Completed movement records, excluding original registrations"
            >
              {analytics.movementsPerDay.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.movementsPerDay}>
                    <CartesianGrid
                      stroke="#64748b"
                      strokeOpacity={0.15}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="Movements"
                      stroke="#14b8a6"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="Movement history will appear after your first QR transaction." />
              )}
            </ChartCard>

            <ChartCard
              title="Zone Throughput"
              subtitle="Movements arriving into each destination zone"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.zoneStats}
                  margin={{ bottom: 15 }}
                >
                  <CartesianGrid
                    stroke="#64748b"
                    strokeOpacity={0.15}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={55}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="throughput"
                    name="Arrivals"
                    fill="#14b8a6"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Current Status Distribution"
              subtitle="Registered pallets grouped by their latest on-chain status"
            >
              {analytics.distribution.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.distribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="48%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      label={({ name, value }) =>
                        `${name}: ${value}`
                      }
                    >
                      {analytics.distribution.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={STATUS_COLORS[entry.name]}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="Register inventory to populate status distribution." />
              )}
            </ChartCard>

            <ChartCard
              title="Top Active Operators"
              subtitle="Wallets ranked by number of recorded movement submissions"
            >
              {analytics.operators.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.operators}
                    layout="vertical"
                    margin={{ left: 15 }}
                  >
                    <CartesianGrid
                      stroke="#64748b"
                      strokeOpacity={0.15}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={95}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar
                      dataKey="count"
                      name="Movements"
                      radius={[0, 5, 5, 0]}
                    >
                      {analytics.operators.map((entry, index) => (
                        <Cell
                          key={entry.address}
                          fill={PALETTE[index % PALETTE.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="Operator activity appears after movements are recorded." />
              )}
            </ChartCard>
          </div>

          <section className="panel p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <Users size={20} className="text-teal-500" />
              Zone Dwell-Time Analysis
            </h3>
            <p className="mt-2 text-xs leading-5 muted">
              Mean duration of completed stays in each zone.
              An active stay is not yet included. Averages are
              calculated from recorded zone changes.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {analytics.zoneStats.map((zone) => (
                <div
                  key={zone.name}
                  className="rounded-xl border border-slate-200 p-4 dark:border-white/10"
                >
                  <p className="text-sm font-bold">{zone.name}</p>
                  <p className="mt-2 text-2xl font-extrabold text-teal-500">
                    {zone.averageDwellHours === null
                      ? "—"
                      : formatHours(zone.averageDwellHours)}
                  </p>
                  <p className="mt-1 text-xs muted">
                    {zone.averageDwellHours === null
                      ? "No completed stays"
                      : `${zone.throughput} recorded arrival(s)`}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <p className="text-xs leading-6 muted">
            Methodology: all registered items and movements
            are read from the current deployed contract.
            Movement dates use UTC calendar days.
            The damage/return incidence measures items that
            have ever entered either status, not the percentage
            of units damaged. Dwell times assume movements
            are recorded when physical zone changes occur.
            Analytics reflect this local network only.
          </p>
        </>
      )}
    </div>
  );
}
