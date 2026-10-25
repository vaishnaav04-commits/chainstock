
import { useEffect, useState } from "react";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  Fingerprint,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import {
  compareHistories,
  fetchVerification,
  historyDigest,
  validItemId,
} from "../services/verification";

import { explainError, formatStatus } from "../services/blockchain";

function RecordCard({ title, subtitle, icon: Icon, history, altered }) {
  const latest = history.at(-1);

  return (
    <section className="panel min-w-0 p-6">
      <div className="flex items-center gap-3">
        <div className={`rounded-xl p-3 ${
          altered
            ? "bg-rose-500/10 text-rose-500"
            : "bg-teal-500/10 text-teal-500"
        }`}>
          <Icon size={24} />
        </div>
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="mt-1 text-xs muted">{subtitle}</p>
        </div>
      </div>

      {latest ? (
        <div className="mt-6 space-y-4">
          <div>
            <p className="text-xs muted">Latest zone</p>
            <p className="mt-1 text-xl font-extrabold">
              {latest.toZone}
            </p>
          </div>

          <div>
            <p className="text-xs muted">Latest status</p>
            <p className="mt-1 font-bold">
              {formatStatus(latest.status)}
            </p>
          </div>

          <div>
            <p className="text-xs muted">Movement note</p>
            <p className="mt-1 text-sm">{latest.note}</p>
          </div>

          <div>
            <p className="text-xs muted">History records</p>
            <p className="mt-1 font-bold">{history.length}</p>
          </div>

          <div className="rounded-xl bg-slate-100 p-4 dark:bg-white/5">
            <p className="text-xs font-bold muted">
              Computed history fingerprint
            </p>
            <p className="mt-2 break-all font-mono text-xs">
              {historyDigest(history)}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm muted">
          Select a registered item to load its history.
        </p>
      )}
    </section>
  );
}

export default function TamperDemo() {
  const [itemId, setItemId] = useState("PALLET001");
  const [loadedId, setLoadedId] = useState("");
  const [authoritative, setAuthoritative] = useState([]);
  const [localCopy, setLocalCopy] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [simulated, setSimulated] = useState(false);

  async function load(event) {
    event?.preventDefault();

    const id = itemId.trim();

    if (!validItemId(id)) {
      toast.error("Enter a valid registered item ID.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setSimulated(false);

    try {
      const data = await fetchVerification(id);

      setAuthoritative(data.history);

      // Copy individual objects to avoid mutating contract data.
      setLocalCopy(
        data.history.map((entry) => ({ ...entry })),
      );

      setLoadedId(data.item.itemId);
      toast.success("On-chain history loaded.");
    } catch (err) {
      setAuthoritative([]);
      setLocalCopy([]);
      setLoadedId("");
      setError(explainError(err));
    } finally {
      setLoading(false);
    }
  }

  function simulateTamper() {
    if (!localCopy.length) return;

    const modified = localCopy.map((entry) => ({
      ...entry,
    }));

    const last = modified.length - 1;

    // Intentionally corrupt only the local browser copy.
    modified[last] = {
      ...modified[last],
      toZone: "UNAUTHORIZED ZONE",
      note: "Modified without blockchain authorization",
    };

    setLocalCopy(modified);
    setSimulated(true);
    setResult(null);

    toast("Local record altered. Blockchain was not changed.");
  }

  async function verifyIntegrity() {
    if (!loadedId) return;

    setLoading(true);
    setError("");

    try {
      // Fetch the authoritative history again from the chain.
      const fresh = await fetchVerification(loadedId);

      const comparison = compareHistories(
        localCopy,
        fresh.history,
      );

      setAuthoritative(fresh.history);

      setResult({
        ...comparison,
        snapshotBlock: fresh.snapshotBlock,
      });

      if (comparison.matched) {
        toast.success("No discrepancy detected.");
      } else {
        toast.error("Tampering detected: hashes differ.");
      }
    } catch (err) {
      setError(explainError(err));
    } finally {
      setLoading(false);
    }
  }

  function resetCopy() {
    setLocalCopy(
      authoritative.map((entry) => ({ ...entry })),
    );
    setSimulated(false);
    setResult(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#080f1d] dark:text-white">
      <main className="mx-auto max-w-6xl space-y-7 px-4 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-teal-500"
        >
          <ArrowLeft size={17} />
          Back to ChainStock
        </Link>

        <div>
          <p className="eyebrow">Security Demonstration</p>
          <h1 className="mt-3 text-3xl font-extrabold">
            Blockchain Tamper Detection
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 muted">
            Compare a deliberately editable local database
            simulation against an authoritative blockchain record.
            See how a silent local modification creates
            inconsistent cryptographic fingerprints.
          </p>
        </div>

        <form
          onSubmit={load}
          className="panel flex flex-col gap-3 p-5 sm:flex-row"
        >
          <input
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-transparent px-4 py-3 font-mono text-sm dark:border-white/10"
            value={itemId}
            onChange={(e) =>
              setItemId(e.target.value)
            }
            placeholder="PALLET001"
          />

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading
              ? <Loader2 size={17} className="animate-spin" />
              : <Search size={17} />}
            Load Item History
          </button>
        </form>

        {error && (
          <div role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-500">
            {error}
          </div>
        )}

        {loadedId && (
          <>
            <div className="grid gap-5 md:grid-cols-2">
              <RecordCard
                title="Editable Local Database"
                subtitle="Simulated off-chain copy"
                icon={Database}
                history={localCopy}
                altered={simulated}
              />

              <RecordCard
                title="Blockchain Source of Truth"
                subtitle="Freshly retrieved contract history"
                icon={ShieldCheck}
                history={authoritative}
                altered={false}
              />
            </div>

            <div className="panel p-6">
              <h3 className="text-lg font-bold">
                Demonstration Controls
              </h3>
              <p className="mt-2 text-sm muted">
                Loaded item: <strong>{loadedId}</strong>
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={simulateTamper}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-50"
                >
                  <AlertTriangle size={17} />
                  Simulate Tampering
                </button>

                <button
                  onClick={verifyIntegrity}
                  disabled={loading}
                  className="btn-primary"
                >
                  <Fingerprint size={17} />
                  Run Integrity Check
                </button>

                <button
                  onClick={resetCopy}
                  disabled={loading}
                  className="btn-secondary"
                >
                  <RotateCcw size={17} />
                  Restore Local Copy
                </button>
              </div>
            </div>

            {result && (
              <div className={`rounded-2xl border p-6 ${
                result.matched
                  ? "border-teal-500/30 bg-teal-500/5"
                  : "border-rose-500/30 bg-rose-500/5"
              }`}>
                <div className="flex items-center gap-3">
                  {result.matched ? (
                    <CheckCircle2 size={28} className="text-teal-500" />
                  ) : (
                    <XCircle size={28} className="text-rose-500" />
                  )}

                  <h3 className="text-lg font-extrabold">
                    {result.matched
                      ? "Integrity verified: records match"
                      : "Tampering detected: history mismatch"}
                  </h3>
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <div>
                    <p className="text-xs muted">
                      Local copy fingerprint
                    </p>
                    <p className="mt-2 break-all font-mono text-xs">
                      {result.displayedHash}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs muted">
                      Blockchain fingerprint
                    </p>
                    <p className="mt-2 break-all font-mono text-xs">
                      {result.authoritativeHash}
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-xs muted">
                  Compared against contract state at block{" "}
                  {result.snapshotBlock}.
                </p>
              </div>
            )}

            <section className="panel p-6">
              <h3 className="text-lg font-bold">
                What does this demonstrate?
              </h3>

              <p className="mt-3 text-sm leading-7 muted">
                An ordinary mutable application record can be
                changed without updating blockchain data. When
                ChainStock fetches the authoritative movement
                history again, the altered local copy generates
                a different cryptographic digest.
              </p>

              <p className="mt-3 text-sm leading-7 muted">
                This demo modifies only JavaScript state inside
                your browser. It is not a real database attack,
                and it does not modify, attack, or rewrite
                blockchain storage.
              </p>
            </section>
          </>
        )}

        {!loadedId && !loading && (
          <div className="panel p-10 text-center">
            <Fingerprint
              size={40}
              className="mx-auto text-teal-500"
            />
            <h2 className="mt-4 font-bold">
              Load an item to begin
            </h2>
            <p className="mt-2 text-sm muted">
              Use a registered pallet such as PALLET001,
              then compare its records.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
