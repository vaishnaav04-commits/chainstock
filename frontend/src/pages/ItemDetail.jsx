
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ArrowLeft,
  ArrowRight,
  Blocks,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  History,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";

import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import {
  CHAIN,
  explainError,
  formatStatus,
  getReadContract,
  shortAddress,
} from "../services/blockchain";

import deployment from "../config/contract.json";

function formatDate(value) {
  return new Date(Number(value) * 1000).toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}

function explorerTransaction(hash) {
  if (CHAIN.id === 11155111 && hash) {
    return `https://sepolia.etherscan.io/tx/${hash}`;
  }
  return null;
}

function InfoCard({ label, value, icon: Icon }) {
  return (
    <div className="panel p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-500">
        <Icon size={19} />
      </div>

      <p className="text-xs font-semibold muted">{label}</p>

      <p className="mt-2 break-words text-base font-bold">
        {value}
      </p>
    </div>
  );
}

export default function ItemDetail() {
  const { itemId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [item, setItem] = useState(null);
  const [history, setHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const loadItem = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (!itemId || itemId.length > 64) {
        throw new Error("Invalid item ID.");
      }

      const contract = getReadContract();

      const [record, entries] = await Promise.all([
        contract.getItem(itemId),
        contract.getHistory(itemId),
      ]);

      const mappedItem = {
        itemId: record.itemId,
        name: record.name,
        category: record.category,
        sku: record.sku,
        quantity: record.quantity.toString(),
        unit: record.unit,
        currentZone: record.currentZone,
        status: formatStatus(record.status),
        metadataHash: record.metadataHash,
        createdAt: Number(record.createdAt),
        updatedAt: Number(record.updatedAt),
      };

      const mappedHistory = entries.map(
        (entry, index) => ({
          index,
          toZone: entry.toZone,
          status: formatStatus(entry.status),
          quantity: entry.quantity.toString(),
          timestamp: Number(entry.timestamp),
          actor: entry.actor,
          note: entry.note,
        }),
      );

      setItem(mappedItem);
      setHistory(mappedHistory);

      // Query emitted logs to identify transaction hashes.
      // The contract's Movement struct doesn't store tx hashes.
      try {
        const fromBlock = Number(
          deployment.deploymentBlock ?? 0,
        );

        const filter = contract.filters.MovementLogged(itemId);

        const events = await contract.queryFilter(
          filter,
          fromBlock,
          "latest",
        );

        const sortedEvents = [...events].sort(
          (a, b) =>
            a.blockNumber - b.blockNumber ||
            a.index - b.index,
        );

        // There should be one MovementLogged event for each
        // stored movement, including initial registration.
        // Only attach hashes if their counts match.
        const hashes =
          sortedEvents.length === mappedHistory.length
            ? sortedEvents.map((event) => ({
                hash: event.transactionHash,
                blockNumber: event.blockNumber,
              }))
            : [];

        setTransactions(hashes);
      } catch (logError) {
        console.warn(
          "Historical event lookup unavailable:",
          logError,
        );
        setTransactions([]);
      }
    } catch (err) {
      setItem(null);
      setHistory([]);
      setTransactions([]);
      setError(explainError(err));
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    loadItem();

    let contract;

    try {
      contract = getReadContract();

      const onMovement = () => loadItem();

      contract.on(
        contract.filters.MovementLogged(itemId),
        onMovement,
      );

      return () => {
        contract.off(
          contract.filters.MovementLogged(itemId),
          onMovement,
        );
      };
    } catch {
      return undefined;
    }
  }, [itemId, loadItem]);

  async function copy(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Clipboard unavailable.");
    }
  }

  if (loading && !item) {
    return (
      <div className="panel flex items-center justify-center gap-3 p-16">
        <Loader2
          size={22}
          className="animate-spin text-teal-500"
        />
        <span className="text-sm muted">
          Reading blockchain history...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel p-8">
        <h2 className="text-xl font-bold">
          Unable to load this item
        </h2>

        <p role="alert" className="mt-3 text-sm text-rose-500">
          {error}
        </p>

        <Link
          to="/inventory"
          className="btn-secondary mt-6"
        >
          <ArrowLeft size={17} />
          Back to Inventory
        </Link>
      </div>
    );
  }

  if (!item) return null;

  const chronological = [...history].reverse();

  return (
    <div className="space-y-7">
      <div>
        <Link
          to="/inventory"
          className="inline-flex items-center gap-2 text-sm font-semibold text-teal-500 hover:underline"
        >
          <ArrowLeft size={17} />
          Back to Inventory
        </Link>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Asset Traceability</p>

            <h2 className="mt-2 break-all font-mono text-2xl font-extrabold sm:text-3xl">
              {item.itemId}
            </h2>

            <p className="mt-2 text-sm muted">
              {item.name} · {item.sku}
            </p>
          </div>

          <button
            onClick={loadItem}
            disabled={loading}
            className="btn-secondary"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
            Refresh History
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          label="Current Zone"
          value={item.currentZone}
          icon={MapPin}
        />

        <InfoCard
          label="Current Status"
          value={item.status}
          icon={Package}
        />

        <InfoCard
          label="Registered Quantity"
          value={`${item.quantity} ${item.unit}`}
          icon={Blocks}
        />

        <InfoCard
          label="History Entries"
          value={history.length}
          icon={History}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.45fr_1fr]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-white/10">
            <div>
              <h3 className="text-lg font-bold">
                Blockchain Movement Timeline
              </h3>
              <p className="mt-1 text-xs muted">
                Newest entries first · On-chain history
              </p>
            </div>

            <ShieldCheck size={22} className="text-teal-500" />
          </div>

          <div className="p-6">
            {chronological.length === 0 ? (
              <p className="text-sm muted">
                No movements recorded.
              </p>
            ) : (
              <div className="space-y-0">
                {chronological.map((movement) => {
                  const tx = transactions[movement.index];
                  const explorer = explorerTransaction(tx?.hash);

                  return (
                    <div
                      key={movement.index}
                      className="relative border-l-2 border-teal-500/20 pb-8 pl-7 last:pb-0"
                    >
                      <div className="absolute -left-[9px] top-0 flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 ring-4 ring-white dark:ring-[#111c2e]" />

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-full bg-teal-500/10 px-3 py-1 text-xs font-bold text-teal-500">
                          {movement.status}
                        </span>

                        <span className="flex items-center gap-1 text-xs muted">
                          <Clock3 size={13} />
                          {formatDate(movement.timestamp)}
                        </span>
                      </div>

                      <h4 className="mt-3 font-bold">
                        {movement.toZone}
                      </h4>

                      <p className="mt-2 text-sm muted">
                        {movement.note || "Movement recorded"}
                      </p>

                      <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-xs dark:bg-white/5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="muted">Quantity</span>
                          <span className="font-semibold">
                            {movement.quantity} {item.unit}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="muted">Actor wallet</span>
                          <button
                            onClick={() =>
                              copy(movement.actor, "Wallet address")
                            }
                            className="flex items-center gap-1 font-mono text-teal-500 hover:underline"
                          >
                            {shortAddress(movement.actor)}
                            <Copy size={12} />
                          </button>
                        </div>

                        {tx?.hash && (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="muted">
                              Transaction
                            </span>

                            {explorer ? (
                              <a
                                href={explorer}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 font-mono text-teal-500"
                              >
                                {shortAddress(tx.hash)}
                                <ExternalLink size={12} />
                              </a>
                            ) : (
                              <button
                                onClick={() =>
                                  copy(tx.hash, "Transaction hash")
                                }
                                className="flex items-center gap-1 font-mono text-teal-500 hover:underline"
                              >
                                {shortAddress(tx.hash)}
                                <Copy size={12} />
                              </button>
                            )}
                          </div>
                        )}

                        {tx && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="muted">
                              Block number
                            </span>
                            <span className="font-semibold">
                              {tx.blockNumber}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <div className="space-y-5">
          <section className="panel p-6">
            <h3 className="flex items-center gap-2 font-bold">
              <Package size={19} className="text-teal-500" />
              Product Information
            </h3>

            <div className="mt-5 space-y-4 text-sm">
              {[
                ["Name", item.name],
                ["Category", item.category],
                ["SKU", item.sku],
                ["Quantity", `${item.quantity} ${item.unit}`],
                ["Created", formatDate(item.createdAt)],
                ["Updated", formatDate(item.updatedAt)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-wrap justify-between gap-2"
                >
                  <span className="muted">{label}</span>
                  <span className="text-right font-semibold">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-6">
            <h3 className="flex items-center gap-2 font-bold">
              <ShieldCheck
                size={19}
                className="text-teal-500"
              />
              Blockchain Evidence
            </h3>

            <p className="mt-3 text-xs leading-6 muted">
              The record and movement history are read
              directly from the deployed smart contract.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <p className="mb-2 text-xs muted">
                  Contract Address
                </p>

                <button
                  onClick={() =>
                    copy(CHAIN.address, "Contract address")
                  }
                  className="flex items-center gap-2 font-mono text-xs text-teal-500"
                >
                  {shortAddress(CHAIN.address)}
                  <Copy size={13} />
                </button>
              </div>

              <div>
                <p className="mb-2 text-xs muted">
                  Metadata Hash
                </p>

                <p className="break-all font-mono text-xs">
                  {item.metadataHash}
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-teal-500/10 p-3 text-xs font-semibold text-teal-500">
                <CheckCircle2 size={17} />
                On-chain record retrieved
              </div>
            </div>
          </section>

          <Link
            to="/scan"
            className="btn-primary w-full"
          >
            <Wallet size={17} />
            Record Another Movement
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
