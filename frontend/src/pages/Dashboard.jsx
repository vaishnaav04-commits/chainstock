
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Activity,
  ArrowRight,
  Blocks,
  Box,
  CheckCircle2,
  Clock3,
  Package,
  RefreshCw,
  ShieldCheck,
  Warehouse,
} from "lucide-react";

import { Link } from "react-router-dom";

import {
  CHAIN,
  checkContractHealth,
  explainError,
  formatStatus,
  getReadContract,
  shortAddress,
} from "../services/blockchain";

import { useWallet } from "../contexts/WalletContext";
import deployment from "../config/contract.json";

function MetricCard({ label, value, detail, Icon, loading }) {
  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between">
        <div className="rounded-xl bg-teal-500/10 p-3 text-teal-500">
          <Icon size={23} />
        </div>
        <Activity size={16} className="muted" />
      </div>

      <p className="mt-5 text-sm font-medium muted">
        {label}
      </p>

      {loading ? (
        <div className="skeleton mt-3 h-9 w-24" />
      ) : (
        <p className="mt-2 text-3xl font-extrabold">
          {value}
        </p>
      )}

      <p className="mt-2 text-xs muted">{detail}</p>
    </div>
  );
}

export default function Dashboard() {
  const wallet = useWallet();

const address = wallet.address;
const role = wallet.role || (
  wallet.roles?.ADMIN
    ? "ADMIN"
    : wallet.roles?.MANAGER
      ? "MANAGER"
      : wallet.roles?.OPERATOR
        ? "OPERATOR"
        : "GUEST"
);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activityError, setActivityError] = useState("");

  const [data, setData] = useState({
    itemCount: 0,
    zoneCount: 0,
    occupiedZones: 0,
    blockNumber: 0,
    paused: false,
    zones: [],
  });

  const [activity, setActivity] = useState([]);

  const loadDashboard = useCallback(async () => {
    try {
      const contract = getReadContract();

      const [health, count, zones, paused] =
        await Promise.all([
          checkContractHealth(),
          contract.getItemCount(),
          contract.getZones(),
          contract.paused(),
        ]);

      const zoneCounts = await Promise.all(
        zones.map(async (name) => ({
          name,
          count: (
            await contract.getItemsByZone(name)
          ).length,
        })),
      );

      setData({
        itemCount: Number(count),
        zoneCount: zones.length,
        occupiedZones: zoneCounts.filter(
          (z) => z.count > 0,
        ).length,
        blockNumber: health.blockNumber,
        paused,
        zones: zoneCounts,
      });

      setError("");
    } catch (err) {
      setError(explainError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    try {
      const contract = getReadContract();
      const provider = contract.runner;

      const latestBlock = await provider.getBlockNumber();

      // Bound event queries for demo performance.
      // Earlier history remains accessible per item.
      const firstBlock = Math.max(
        Number(deployment.deploymentBlock ?? 0),
        latestBlock - 1500,
        0,
      );

      const events = await contract.queryFilter(
        contract.filters.MovementLogged(),
        firstBlock,
        latestBlock,
      );

      const latest = [...events]
        .sort(
          (a, b) =>
            b.blockNumber - a.blockNumber ||
            b.index - a.index,
        )
        .slice(0, 8);
        
const allIds = await contract.getAllItemIds();

const { id: hashId } = await import("ethers");

const itemIdsByHash = new Map(
  allIds.map((itemId) => [
    hashId(itemId).toLowerCase(),
    itemId,
  ]),
);


      const records = await Promise.all(
        latest.map(async (event) => {
          const block = await provider.getBlock(
            event.blockNumber,
          );

          
return {
  key: `${event.transactionHash}-${event.index}`,

  // Indexed Solidity string arguments are returned as
  // Indexed objects, not their original text.
  
itemId:
  typeof event.args.itemId === "string"
    ? event.args.itemId
    : itemIdsByHash.get(
        event.args.itemId.hash.toLowerCase(),
      ) || "Unknown Item",


  actor: event.args.actor,
  fromZone: event.args.fromZone,
  toZone: event.args.toZone,
  status: formatStatus(event.args.status),
  hash: event.transactionHash,
  blockNumber: event.blockNumber,
  timestamp: Number(block.timestamp),
};

        }),
      );

      setActivity(records);
      setActivityError("");
    } catch (err) {
      setActivityError(explainError(err));
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadDashboard(),
      loadActivity(),
    ]);
  }, [loadDashboard, loadActivity]);

  useEffect(() => {
    refresh();

    const contract = getReadContract();

    const onUpdate = () => {
      loadDashboard();
      loadActivity();
    };

    contract.on("ItemRegistered", onUpdate);
    contract.on("MovementLogged", onUpdate);

    // Polling provides a fallback for RPC event delays
    // and updates the latest observed block number.
    const timer = setInterval(onUpdate, 15000);

    return () => {
      contract.off("ItemRegistered", onUpdate);
      contract.off("MovementLogged", onUpdate);
      clearInterval(timer);
    };
  }, [refresh, loadDashboard, loadActivity]);

  const maxCount = Math.max(
    1,
    ...data.zones.map((zone) => zone.count),
  );

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            Operations Command Center
          </p>

          <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
            Warehouse Overview
          </h2>

          <p className="mt-2 text-sm muted">
            Real inventory. Verified movements. One ledger.
          </p>
        </div>

        <button
          onClick={refresh}
          disabled={loading}
          className="btn-secondary"
        >
          <RefreshCw
            size={17}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-teal-500/20 bg-[#10273a] p-7 text-white shadow-glow">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-teal-400/10 blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-400/10 px-3 py-1 text-xs font-bold text-teal-300">
            <ShieldCheck size={15} />
            Blockchain-powered traceability
          </div>

          <h3 className="mt-5 max-w-2xl text-2xl font-extrabold sm:text-3xl">
            Every movement has a story.
            <span className="block text-teal-400">
              Every story has proof.
            </span>
          </h3>

          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
            Monitor inventory, follow pallet journeys, and
            review blockchain-backed movements across
            your warehouse.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/inventory" className="btn-primary">
              Explore Inventory
              <ArrowRight size={17} />
            </Link>

            <Link
              to="/scan"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
            >
              Record Movement
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-500"
        >
          Blockchain connection error: {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard
          label="Tracked Items"
          value={error ? "—" : data.itemCount}
          detail="Items registered on-chain"
          Icon={Package}
          loading={loading}
        />

        <MetricCard
          label="Warehouse Zones"
          value={error ? "—" : data.zoneCount}
          detail="Configured warehouse locations"
          Icon={Warehouse}
          loading={loading}
        />

        <MetricCard
          label="Occupied Zones"
          value={error ? "—" : data.occupiedZones}
          detail="Zones currently holding items"
          Icon={Box}
          loading={loading}
        />

        <MetricCard
          label="Latest Block"
          value={
            error
              ? "—"
              : data.blockNumber.toLocaleString()
          }
          detail="Latest observed chain height"
          Icon={Blocks}
          loading={loading}
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1.2fr_1fr]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-white/10">
            <div>
              <h3 className="text-lg font-bold">
                Recent Blockchain Activity
              </h3>

              <p className="mt-1 text-xs muted">
                Latest recorded inventory movements
              </p>
            </div>

            <Activity
              size={21}
              className="text-teal-500"
            />
          </div>

          <div className="p-5">
            {activityError && (
              <p className="mb-4 text-xs text-amber-500">
                Activity feed unavailable: {activityError}
              </p>
            )}

            {activity.length === 0 ? (
              <div className="py-12 text-center">
                <Clock3
                  size={34}
                  className="mx-auto text-slate-400"
                />

                <h4 className="mt-4 font-semibold">
                  No recent movements
                </h4>

                <p className="mt-2 text-sm muted">
                  Register or scan inventory to populate
                  this activity feed.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activity.map((event) => (
                  <Link
                    key={event.key}
                    to={`/inventory/${encodeURIComponent(event.itemId)}`}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-teal-500/40 dark:border-white/10"
                  >
                    <div className="rounded-lg bg-teal-500/10 p-2.5 text-teal-500">
                      <Package size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap justify-between gap-2">
                        <p className="font-mono text-sm font-bold">
                          {event.itemId}
                        </p>

                        <span className="text-xs font-semibold text-teal-500">
                          {event.status}
                        </span>
                      </div>

                      <p className="mt-1 text-xs muted">
                        {event.fromZone || "Registered"}{" "}
                        → {event.toZone}
                      </p>

                      <p className="mt-2 text-xs muted">
                        {new Date(
                          event.timestamp * 1000,
                        ).toLocaleString("en-IN")}
                        {" · "}
                        {shortAddress(event.actor)}
                      </p>
                    </div>

                    <ArrowRight
                      size={16}
                      className="mt-1 shrink-0 text-slate-400"
                    />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="space-y-5">
          <section className="panel p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">
                Zone Distribution
              </h3>

              <Warehouse
                size={21}
                className="text-teal-500"
              />
            </div>

            <p className="mt-1 text-xs muted">
              Live item count by warehouse zone
            </p>

            <div className="mt-6 space-y-5">
              {data.zones.map((zone) => (
                <div key={zone.name}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium">
                      {zone.name}
                    </span>

                    <span className="font-bold tabular-nums">
                      {zone.count}
                    </span>
                  </div>

                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-600 to-cyan-400 transition-all duration-500"
                      style={{
                        width: `${zone.count / maxCount * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {!error && !loading && data.itemCount === 0 && (
              <p className="mt-6 rounded-xl bg-teal-500/5 p-4 text-xs muted">
                Register an item to populate these zones.
              </p>
            )}
          </section>

          <section className="panel p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <ShieldCheck
                size={20}
                className="text-teal-500"
              />
              System Health
            </h3>

            <div className="mt-5 space-y-4 text-sm">
              {[
                ["Network", CHAIN.name],
                ["Chain ID", String(CHAIN.id)],
                ["Contract", shortAddress(CHAIN.address)],
                ["Your Wallet", shortAddress(address)],
                ["Your Role", role],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-wrap justify-between gap-2"
                >
                  <span className="muted">{label}</span>
                  <span className="font-semibold">
                    {value}
                  </span>
                </div>
              ))}

              <div className="flex justify-between gap-2">
                <span className="muted">Operations</span>
                <span className={
                  error
                    ? "font-semibold text-rose-500"
                    : data.paused
                      ? "font-semibold text-amber-500"
                      : "font-semibold text-teal-500"
                }>
                  {error
                    ? "Unavailable"
                    : data.paused
                      ? "Paused"
                      : "Enabled"}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-start gap-2 rounded-xl bg-teal-500/5 p-4 text-xs leading-5 muted">
              <CheckCircle2
                size={18}
                className="shrink-0 text-teal-500"
              />

              <span>
                On-chain inventory data is read from the
                configured warehouse contract. Recent
                activity is refreshed on new events and
                approximately every 15 seconds.
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
