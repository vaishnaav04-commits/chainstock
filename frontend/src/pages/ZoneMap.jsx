
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Boxes,
  Loader2,
  MapPinned,
  RefreshCw,
  Warehouse,
} from "lucide-react";
import { Link } from "react-router-dom";
import { explainError } from "../services/blockchain";
import {
  getZoneStatistics,
  loadWarehouseSnapshot,
  formatHours,
  ZONE_ICONS,
} from "../services/warehouseInsights";

export default function ZoneMap() {
  const [snapshot, setSnapshot] = useState(null);
  const [selected, setSelected] = useState("Receiving");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadWarehouseSnapshot();
      setSnapshot(result);
      setError("");
      setSelected((previous) =>
        result.zones.includes(previous)
          ? previous
          : result.zones[0] || "",
      );
    } catch (err) {
      setError(explainError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 20000);
    return () => clearInterval(timer);
  }, [refresh]);

  const stats = useMemo(
    () => snapshot ? getZoneStatistics(snapshot) : [],
    [snapshot],
  );

  const selectedZone = stats.find(
    (entry) => entry.name === selected,
  );

  const maxCount = Math.max(
    1,
    ...stats.map((entry) => entry.count),
  );

  const total = snapshot?.items.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Warehouse Operations</p>
          <h2 className="mt-2 text-3xl font-extrabold">
            Warehouse Zone Map
          </h2>
          <p className="mt-2 text-sm muted">
            Explore pallet locations and movement activity
            by zone.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="btn-secondary"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-500">
          Blockchain unavailable: {error}
        </div>
      )}

      {loading && !snapshot ? (
        <div className="panel flex items-center gap-3 p-10">
          <Loader2 className="animate-spin text-teal-500" />
          Loading warehouse zones...
        </div>
      ) : snapshot && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Tracked pallets", total],
              ["Configured zones", stats.length],
              ["Occupied zones", stats.filter((z) => z.count > 0).length],
            ].map(([label, value]) => (
              <div className="panel p-5" key={label}>
                <p className="text-sm muted">{label}</p>
                <p className="mt-2 text-3xl font-extrabold">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid items-start gap-5 xl:grid-cols-[1.5fr_1fr]">
            <section className="panel p-5 sm:p-7">
              <div className="mb-5 flex items-center gap-2">
                <MapPinned size={20} className="text-teal-500" />
                <h3 className="font-bold">Warehouse Floor</h3>
              </div>

              <p className="mb-5 text-xs muted">
                Click a zone to inspect its current inventory.
                Layout is schematic, not a physical-scale drawing.
              </p>

              <div className="rounded-2xl border-2 border-slate-300 bg-slate-100 p-3 dark:border-slate-600 dark:bg-[#0b1525] sm:p-5">
                <div className="mb-4 rounded-lg border border-dashed border-slate-300 py-2 text-center text-xs font-bold uppercase tracking-widest muted dark:border-slate-600">
                  Receiving / Loading Bay Entrance
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {stats.map((zone) => {
                    const intensity = zone.count / maxCount;
                    const isSelected = selected === zone.name;

                    return (
                      <button
                        key={zone.name}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelected(zone.name)}
                        className={`relative min-h-[145px] rounded-xl border-2 p-4 text-left transition focus-visible:ring-2 focus-visible:ring-teal-400 ${
                          isSelected
                            ? "border-teal-400 shadow-glow"
                            : "border-slate-300 dark:border-white/10"
                        }`}
                        style={{
                          background:
                            `rgba(20,184,166,${0.07 + intensity * 0.36})`,
                        }}
                      >
                        <div className="text-2xl">
                          {ZONE_ICONS[zone.name] || "🏭"}
                        </div>
                        <p className="mt-3 text-sm font-bold">
                          {zone.name}
                        </p>
                        <p className="mt-1 text-xs muted">
                          {zone.count} pallet(s)
                        </p>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-400/20">
                          <div
                            className="h-full rounded-full bg-teal-500"
                            style={{
                              width: `${intensity * 100}%`,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-lg border border-dashed border-slate-300 py-2 text-center text-xs font-bold uppercase tracking-widest muted dark:border-slate-600">
                  Internal Warehouse Access
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2 text-xs muted">
                <span>Low occupancy</span>
                <div className="h-3 w-24 rounded-full bg-gradient-to-r from-teal-500/10 to-teal-500/60" />
                <span>High occupancy</span>
              </div>
            </section>

            <section className="panel p-6">
              <div className="flex items-center gap-2">
                <Warehouse size={21} className="text-teal-500" />
                <h3 className="text-lg font-bold">
                  {selectedZone?.name || "Select a zone"}
                </h3>
              </div>

              {selectedZone && (
                <>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-teal-500/10 p-4">
                      <p className="text-xs muted">Current pallets</p>
                      <p className="mt-2 text-2xl font-extrabold">
                        {selectedZone.count}
                      </p>
                    </div>
                    <div className="rounded-xl bg-teal-500/10 p-4">
                      <p className="text-xs muted">Recorded arrivals</p>
                      <p className="mt-2 text-2xl font-extrabold">
                        {selectedZone.throughput}
                      </p>
                    </div>
                  </div>

                  <p className="mt-5 text-sm muted">
                    Average completed dwell:{" "}
                    <span className="font-bold text-teal-500">
                      {selectedZone.averageDwellHours === null
                        ? "No completed dwell yet"
                        : formatHours(selectedZone.averageDwellHours)}
                    </span>
                  </p>

                  <h4 className="mt-7 font-bold">
                    Items currently here
                  </h4>

                  {selectedZone.items.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-white/10">
                      <Boxes size={30} className="mx-auto muted" />
                      <p className="mt-3 text-sm muted">
                        No registered items in this zone.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 max-h-[380px] space-y-2 overflow-y-auto">
                      {selectedZone.items.map((item) => (
                        <Link
                          key={item.id}
                          to={`/inventory/${encodeURIComponent(item.id)}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-teal-500 dark:border-white/10"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-mono text-sm font-bold">
                              {item.id}
                            </p>
                            <p className="truncate text-xs muted">
                              {item.name} · {item.status}
                            </p>
                          </div>
                          <ArrowRight size={17} className="shrink-0 text-teal-500" />
                        </Link>
                      ))}
                    </div>
                  )}

                  <Link
                    to="/inventory"
                    className="btn-secondary mt-6 w-full"
                  >
                    <Boxes size={16} />
                    Open Inventory Explorer
                  </Link>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
