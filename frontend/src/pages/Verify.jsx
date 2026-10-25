
import { useCallback, useEffect, useState } from "react";

import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Fingerprint,
  Loader2,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";

import {
  compareHistories,
  fetchVerification,
  getExplorerTxUrl,
  getVerificationUrl,
  validItemId,
} from "../services/verification";

import {
  CHAIN,
  explainError,
  formatStatus,
  shortAddress,
} from "../services/blockchain";

function dateTime(seconds) {
  return new Date(Number(seconds) * 1000)
    .toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "medium",
    });
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-all text-sm font-semibold">
        {value}
      </p>
    </div>
  );
}

export default function Verify() {
  const { itemId } = useParams();
  const navigate = useNavigate();

  const [search, setSearch] = useState(itemId || "");
  const [data, setData] = useState(null);
  const [displayedHistory, setDisplayedHistory] = useState([]);

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [check, setCheck] = useState(null);

  useEffect(() => {
    setSearch(itemId || "");
  }, [itemId]);

  const load = useCallback(async () => {
    if (!itemId) {
      setData(null);
      setDisplayedHistory([]);
      setCheck(null);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    setCheck(null);

    try {
      const result = await fetchVerification(itemId);
      setData(result);
      setDisplayedHistory(result.history);
    } catch (err) {
      setData(null);
      setDisplayedHistory([]);
      setError(explainError(err));
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    load();
  }, [load]);

  function submitSearch(event) {
    event.preventDefault();

    const normalized = search.trim();

    if (!validItemId(normalized)) {
      toast.error("Enter a valid ChainStock item ID.");
      return;
    }

    navigate(`/verify/${encodeURIComponent(normalized)}`);
  }

  async function runCheck() {
    if (!itemId || !data) return;

    setChecking(true);
    setCheck(null);

    try {
      const fresh = await fetchVerification(itemId);
      const comparison = compareHistories(
        displayedHistory,
        fresh.history,
      );

      setCheck({
        ...comparison,
        eventMatch: fresh.eventMatch,
        eventError: fresh.eventError,
        blockNumber: fresh.snapshotBlock,
      });

      if (comparison.matched) {
        toast.success("Displayed history matches the blockchain.");
      } else {
        toast.error("History mismatch detected.");
      }
    } catch (err) {
      toast.error(explainError(err));
    } finally {
      setChecking(false);
    }
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Clipboard access unavailable.");
    }
  }

  const verifyUrl = itemId
    ? getVerificationUrl(itemId)
    : "";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#080f1d] dark:text-white">
      <header className="border-b border-slate-200 bg-white dark:border-white/10 dark:bg-[#0c1728]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
          <Link
            to="/"
            className="flex items-center gap-3 text-xl font-extrabold"
          >
            <div className="rounded-xl bg-teal-500 p-2 text-white">
              <ShieldCheck size={22} />
            </div>
            <span>
              Chain<span className="text-teal-500">Stock</span>
            </span>
          </Link>

          <span className="rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1.5 text-xs font-bold text-teal-500">
            Public Verification Portal
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-7 px-4 py-9 sm:py-12">
        <div className="text-center">
          <p className="eyebrow">
            Independent Asset Verification
          </p>

          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            Verify an item's journey
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 muted">
            Check registration, warehouse movement history,
            transaction references and recorded actor wallets
            directly from ChainStock's blockchain contract.
            No MetaMask connection required.
          </p>
        </div>

        <form
          onSubmit={submitSearch}
          className="panel mx-auto flex max-w-2xl flex-col gap-3 p-4 sm:flex-row"
        >
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm dark:border-white/10 dark:bg-white/5"
            placeholder="Enter PALLET001 or PLT-..."
            aria-label="Item ID"
          />

          <button type="submit" className="btn-primary">
            <Search size={17} />
            Verify Item
          </button>
        </form>

        {!itemId && (
          <div className="panel mx-auto max-w-2xl p-9 text-center">
            <Fingerprint
              size={42}
              className="mx-auto text-teal-500"
            />
            <h2 className="mt-4 text-lg font-bold">
              Enter an item ID to begin
            </h2>
            <p className="mt-2 text-sm muted">
              Try PALLET001 if you've registered it on
              your current ChainStock blockchain.
            </p>
          </div>
        )}

        {loading && (
          <div className="panel flex items-center justify-center gap-3 p-12">
            <Loader2 className="animate-spin text-teal-500" />
            <span className="text-sm muted">
              Checking blockchain records...
            </span>
          </div>
        )}

        {error && !loading && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-500"
          >
            <div className="flex items-center gap-2 font-bold">
              <XCircle size={20} />
              Verification unavailable
            </div>
            <p className="mt-2">{error}</p>
            <p className="mt-2 text-xs">
              Check the item ID, current network, and
              contract deployment.
            </p>
          </div>
        )}

        {data && !loading && (
          <>
            <div className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    size={36}
                    className="shrink-0 text-teal-500"
                  />
                  <div>
                    <p className="text-sm font-bold text-teal-500">
                      Record found on blockchain
                    </p>
                    <h2 className="mt-2 break-all font-mono text-2xl font-extrabold">
                      {data.item.itemId}
                    </h2>
                    <p className="mt-2 text-sm muted">
                      {data.item.name} · {data.item.sku}
                    </p>
                  </div>
                </div>

                <div className="rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-xs font-bold text-teal-500">
                  <CheckCircle2 size={14} className="mr-1 inline" />
                  On-chain record retrieved
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-5 border-t border-teal-500/20 pt-6 md:grid-cols-4">
                <Detail label="Current Zone" value={data.item.currentZone} />
                <Detail
                  label="Status"
                  value={formatStatus(data.item.status)}
                />
                <Detail
                  label="Quantity"
                  value={`${data.item.quantity} ${data.item.unit}`}
                />
                <Detail
                  label="History Entries"
                  value={data.history.length}
                />
              </div>
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
              <section className="panel p-5 sm:p-7">
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  <Package size={20} className="text-teal-500" />
                  Authenticated Movement History
                </h3>

                <p className="mt-2 text-xs muted">
                  Historical movements recorded by the contract,
                  shown in chronological order.
                </p>

                <div className="mt-7">
                  {data.history.map((movement, index) => {
                    const event = data.events[index];
                    const explorer = event
                      ? getExplorerTxUrl(event.transactionHash)
                      : null;

                    return (
                      <div
                        key={index}
                        className="relative border-l-2 border-teal-500/30 pb-8 pl-6 last:pb-0"
                      >
                        <span className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-teal-500 ring-4 ring-white dark:ring-[#111c2e]" />

                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="rounded-full bg-teal-500/10 px-3 py-1 text-xs font-bold text-teal-500">
                            {formatStatus(movement.status)}
                          </span>
                          <span className="text-xs muted">
                            {dateTime(movement.timestamp)}
                          </span>
                        </div>

                        <h4 className="mt-3 font-bold">
                          {movement.toZone}
                        </h4>

                        <p className="mt-2 text-sm muted">
                          {movement.note}
                        </p>

                        <div className="mt-4 space-y-2 rounded-xl bg-slate-100 p-4 text-xs dark:bg-white/5">
                          <Detail
                            label="Actor wallet"
                            value={movement.actor}
                          />
                          <Detail
                            label="Quantity"
                            value={movement.quantity}
                          />

                          {data.eventMatch && event && (
                            <>
                              <Detail
                                label="Block"
                                value={event.blockNumber}
                              />

                              <div>
                                <p className="text-xs muted">
                                  Transaction hash
                                </p>
                                {explorer ? (
                                  <a
                                    href={explorer}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-1 inline-flex break-all font-mono text-xs text-teal-500 hover:underline"
                                  >
                                    {event.transactionHash}
                                    <ExternalLink size={13} className="ml-1 shrink-0" />
                                  </a>
                                ) : (
                                  <button
                                    onClick={() => copyText(event.transactionHash)}
                                    className="mt-1 break-all text-left font-mono text-xs text-teal-500 hover:underline"
                                  >
                                    {event.transactionHash}
                                    <Copy size={12} className="ml-1 inline" />
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className="space-y-5">
                <section className="panel p-6">
                  <h3 className="flex items-center gap-2 font-bold">
                    <Fingerprint size={20} className="text-teal-500" />
                    Integrity Verification
                  </h3>

                  <p className="mt-3 text-xs leading-6 muted">
                    Compare the displayed record with a fresh
                    blockchain read and recalculate its
                    cryptographic history fingerprint.
                  </p>

                  <button
                    onClick={runCheck}
                    disabled={checking}
                    className="btn-primary mt-5 w-full"
                  >
                    {checking ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <ClipboardCheck size={17} />
                    )}
                    Run Integrity Check
                  </button>

                  {check && (
                    <div className="mt-5 space-y-4">
                      <div className={`rounded-xl p-4 text-sm font-bold ${
                        check.matched
                          ? "bg-teal-500/10 text-teal-500"
                          : "bg-rose-500/10 text-rose-500"
                      }`}>
                        {check.matched
                          ? "History matches fresh on-chain data"
                          : "History mismatch detected"}
                      </div>

                      <Detail
                        label="Displayed history digest"
                        value={check.displayedHash}
                      />
                      <Detail
                        label="Fresh on-chain digest"
                        value={check.authoritativeHash}
                      />
                      <Detail
                        label="Checked through block"
                        value={check.blockNumber}
                      />

                      <p className="text-xs muted">
                        Event corroboration:{" "}
                        {check.eventError
                          ? "Unavailable"
                          : check.eventMatch
                            ? "Matching"
                            : "Not fully matched"}
                      </p>
                    </div>
                  )}
                </section>

                <section className="panel p-6">
                  <h3 className="font-bold">
                    Verification QR Code
                  </h3>

                  <p className="mt-2 text-xs muted">
                    This QR contains the public verification URL,
                    not merely the item ID.
                  </p>

                  <div className="mt-5 flex justify-center rounded-xl bg-white p-5">
                    <QRCodeSVG
                      value={verifyUrl}
                      size={190}
                      level="M"
                      marginSize={2}
                    />
                  </div>

                  <button
                    onClick={() => copyText(verifyUrl)}
                    className="btn-secondary mt-4 w-full"
                  >
                    <Copy size={16} />
                    Copy Verification URL
                  </button>
                </section>

                <section className="panel p-6">
                  <h3 className="font-bold">
                    Blockchain Reference
                  </h3>
                  <div className="mt-5 space-y-4">
                    <Detail label="Network" value={CHAIN.name} />
                    <Detail label="Chain ID" value={CHAIN.id} />
                    <Detail
                      label="Contract"
                      value={shortAddress(CHAIN.address)}
                    />
                    <Detail
                      label="Snapshot block"
                      value={data.snapshotBlock}
                    />
                    <Detail
                      label="Item metadata hash"
                      value={data.item.metadataHash}
                    />
                  </div>
                </section>

                <Link to="/tamper-demo" className="btn-secondary w-full">
                  <ShieldAlert size={16} />
                  Open Tamper Demonstration
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>

            <p className="text-center text-xs leading-6 muted">
              Blockchain provenance does not itself authenticate
              a physical product or prevent copying its QR label.
              Verification is only as trustworthy as the selected
              contract, network, RPC, and the accuracy of the
              originally recorded warehouse information.
            </p>
          </>
        )}

        <div className="flex justify-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-teal-500"
          >
            <ArrowLeft size={16} />
            Return to ChainStock
          </Link>
        </div>
      </main>
    </div>
  );
}
