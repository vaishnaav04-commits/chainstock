
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCheck,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldAlert,
} from "lucide-react";

import { Link } from "react-router-dom";
import { explainError } from "../services/blockchain";

import {
  DEFAULT_SETTINGS,
  generateAlerts,
  loadWarehouseSnapshot,
} from "../services/warehouseInsights";

const SETTINGS_KEY = "chainstock-alert-settings-v1";
const READ_KEY = "chainstock-read-alerts-v1";

function readStorage(key, fallback) {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(key) || "null",
    );
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

const severityStyles = {
  critical: "border-rose-500/30 bg-rose-500/5 text-rose-500",
  warning: "border-amber-500/30 bg-amber-500/5 text-amber-500",
  info: "border-sky-500/30 bg-sky-500/5 text-sky-500",
};

export default function Alerts() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [settings, setSettings] = useState(() =>
    readStorage(SETTINGS_KEY, DEFAULT_SETTINGS),
  );

  const [readAlerts, setReadAlerts] = useState(() =>
    readStorage(READ_KEY, []),
  );

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
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify(settings),
    );
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(
      READ_KEY,
      JSON.stringify(readAlerts),
    );
  }, [readAlerts]);

  const alerts = useMemo(
    () => snapshot
      ? generateAlerts(snapshot, settings)
      : [],
    [snapshot, settings],
  );

  const unread = alerts.filter(
    (alert) => !readAlerts.includes(alert.id),
  ).length;

  const critical = alerts.filter(
    (alert) => alert.severity === "critical",
  ).length;

  const warning = alerts.filter(
    (alert) => alert.severity === "warning",
  ).length;

  function updateSetting(field, value) {
    const number = Number(value);

    if (!Number.isFinite(number) || number < 1) return;

    setSettings((previous) => ({
      ...previous,
      [field]: number,
    }));
  }

  function markAllRead() {
    setReadAlerts((previous) => [
      ...new Set([
        ...previous,
        ...alerts.map((alert) => alert.id),
      ]),
    ]);
  }

  function toggleRead(id) {
    setReadAlerts((previous) =>
      previous.includes(id)
        ? previous.filter((entry) => entry !== id)
        : [...previous, id],
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Operational Monitoring</p>
          <h2 className="mt-2 text-3xl font-extrabold">
            Alerts & Exceptions
          </h2>
          <p className="mt-2 text-sm muted">
            Identify inventory risks using on-chain movement
            history and configurable thresholds.
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
          Refresh Alerts
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-500">
          Unable to read warehouse alerts: {error}
        </div>
      )}

      {loading && !snapshot ? (
        <div className="panel flex items-center gap-3 p-10">
          <Loader2 className="animate-spin text-teal-500" />
          Evaluating warehouse conditions...
        </div>
      ) : snapshot && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Unread Alerts",
                value: unread,
                icon: Bell,
                color: "text-teal-500",
              },
              {
                label: "Critical Exceptions",
                value: critical,
                icon: ShieldAlert,
                color: "text-rose-500",
              },
              {
                label: "Warnings",
                value: warning,
                icon: AlertTriangle,
                color: "text-amber-500",
              },
            ].map((entry) => {
              const Icon = entry.icon;
              return (
                <div key={entry.label} className="panel p-5">
                  <Icon size={23} className={entry.color} />
                  <p className="mt-4 text-sm muted">
                    {entry.label}
                  </p>
                  <p className="mt-2 text-3xl font-extrabold">
                    {entry.value}
                  </p>
                </div>
              );
            })}
          </div>

          <section className="panel p-6">
            <div className="flex items-center gap-2">
              <Settings2 size={20} className="text-teal-500" />
              <h3 className="font-bold">Alert Configuration</h3>
            </div>

            <p className="mt-2 text-xs muted">
              These thresholds are stored in this browser,
              not in the Solidity contract.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-semibold">
                  Maximum Zone Dwell (hours)
                </span>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-transparent px-4 py-3 dark:border-white/10"
                  type="number"
                  min="1"
                  step="1"
                  value={settings.stuckHours}
                  onChange={(e) =>
                    updateSetting("stuckHours", e.target.value)
                  }
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">
                  Low Tracked Quantity Threshold
                </span>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-transparent px-4 py-3 dark:border-white/10"
                  type="number"
                  min="1"
                  step="1"
                  value={settings.lowQuantity}
                  onChange={(e) =>
                    updateSetting("lowQuantity", e.target.value)
                  }
                />
              </label>
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5 dark:border-white/10">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  <Bell size={20} className="text-teal-500" />
                  Notification Center
                  {unread > 0 && (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">
                      {unread}
                    </span>
                  )}
                </h3>
                <p className="mt-1 text-xs muted">
                  {alerts.length} active exception(s)
                </p>
              </div>

              <button
                onClick={markAllRead}
                className="btn-secondary"
                disabled={unread === 0}
              >
                <CheckCheck size={16} />
                Mark All Read
              </button>
            </div>

            {alerts.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCheck
                  size={40}
                  className="mx-auto text-teal-500"
                />
                <h3 className="mt-4 text-lg font-bold">
                  No active exceptions
                </h3>
                <p className="mt-2 text-sm muted">
                  No current conditions exceed your
                  configured thresholds.
                </p>
              </div>
            ) : (
              <div className="space-y-3 p-5">
                {alerts.map((alert) => {
                  const isRead = readAlerts.includes(alert.id);

                  return (
                    <article
                      key={alert.id}
                      className={`rounded-xl border p-5 ${
                        severityStyles[alert.severity]
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {alert.severity === "critical" ? (
                            <AlertCircle size={22} className="shrink-0" />
                          ) : alert.severity === "warning" ? (
                            <Clock3 size={22} className="shrink-0" />
                          ) : (
                            <AlertTriangle size={22} className="shrink-0" />
                          )}

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold">
                                {alert.title}
                              </h4>
                              {!isRead && (
                                <span className="rounded-full bg-current/10 px-2 py-0.5 text-xs font-semibold">
                                  Unread
                                </span>
                              )}
                            </div>

                            <p className="mt-2 text-sm leading-6 muted">
                              {alert.description}
                            </p>
                            <p className="mt-2 text-xs font-bold uppercase tracking-wide">
                              {alert.type} · {alert.severity}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => toggleRead(alert.id)}
                          className="btn-secondary"
                        >
                          {isRead ? "Mark Unread" : "Mark Read"}
                        </button>
                      </div>

                      {alert.itemId && (
                        <Link
                          to={`/inventory/${encodeURIComponent(alert.itemId)}`}
                          className="mt-4 inline-flex items-center gap-2 text-sm font-bold underline"
                        >
                          Inspect Item History
                          <ExternalLink size={14} />
                        </Link>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <p className="text-xs leading-6 muted">
            The notification center is a browser-side
            operational tool. Marking an alert as read does
            not resolve the underlying blockchain condition.
            Category thresholds combine registered quantities
            of items not currently marked Shipped or Delivered.
            Different units are not converted, so configure
            and interpret category thresholds carefully.
            Alerts are evaluated when the page is open and
            refreshed, not by a 24/7 server.
          </p>
        </>
      )}
    </div>
  );
}
