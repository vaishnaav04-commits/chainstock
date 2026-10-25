
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Loader2,
  Lock,
  PackagePlus,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Warehouse,
} from "lucide-react";

import { isAddress } from "ethers";
import toast from "react-hot-toast";

import { useWallet } from "../contexts/WalletContext";

import {
  checkWalletRoles,
  DEMO_ITEMS,
  getAdminSnapshot,
  manageRole,
  seedDemoItems,
  setEmergencyPause,
} from "../services/admin";

import {
  downloadInventoryCSV,
  downloadInventoryPDF,
  downloadMovementCSV,
} from "../services/reports";

import { explainError } from "../services/blockchain";

const inputClass =
  "w-full rounded-xl border border-slate-200 " +
  "bg-slate-50 px-4 py-3 text-sm outline-none " +
  "focus:border-teal-500 dark:border-white/10 " +
  "dark:bg-white/5 dark:text-white";

function SectionTitle({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-xl bg-teal-500/10 p-3 text-teal-500">
        <Icon size={21} />
      </div>
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-1 text-xs leading-5 muted">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function Admin() {
  const { address, correctNetwork } = useWallet();

  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const [targetWallet, setTargetWallet] = useState("");
  const [role, setRole] = useState("OPERATOR");
  const [targetRoles, setTargetRoles] = useState(null);

  const [seedProgress, setSeedProgress] = useState("");
  const [seedResults, setSeedResults] = useState([]);

  const refresh = useCallback(async () => {
    if (!address || !correctNetwork) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const result = await getAdminSnapshot(address);
      setSnapshot(result);
      setError("");
    } catch (err) {
      setError(explainError(err));
    } finally {
      setLoading(false);
    }
  }, [address, correctNetwork]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const hasAdminRole = Boolean(
    snapshot?.permissions?.ADMIN ||
    snapshot?.permissions?.DEFAULT_ADMIN,
  );

  async function runAction(name, action) {
    if (busy) return;

    setBusy(name);
    setError("");

    try {
      const result = await action();
      toast.success(`${name} completed.`);
      await refresh();
      return result;
    } catch (err) {
      const message = explainError(err);
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setBusy("");
    }
  }

  async function lookupWallet() {
    if (!isAddress(targetWallet)) {
      toast.error("Enter a valid Ethereum wallet address.");
      return;
    }

    const result = await runAction(
      "Wallet role lookup",
      () => checkWalletRoles(targetWallet),
    );

    if (result) {
      setTargetRoles(result);
    }
  }

  async function changeRole(action) {
    if (!isAddress(targetWallet)) {
      toast.error("Enter a valid wallet address.");
      return;
    }

    if (
      action === "revoke" &&
      targetWallet.toLowerCase() === address.toLowerCase()
    ) {
      toast.error(
        "Do not revoke your own access from this admin panel.",
      );
      return;
    }

    const description =
      `${action === "grant" ? "Grant" : "Revoke"} ` +
      `${role} for ${targetWallet}?`;

    if (!window.confirm(description)) return;

    const receipt = await runAction(
      `${action} ${role}`,
      () =>
        manageRole({
          action,
          role,
          account: targetWallet,
        }),
    );

    if (receipt) {
      try {
        setTargetRoles(
          await checkWalletRoles(targetWallet),
        );
      } catch {
        setTargetRoles(null);
      }
    }
  }

  async function togglePause() {
    if (!snapshot) return;

    const shouldPause = !snapshot.paused;

    const message = shouldPause
      ? "Pause warehouse transactions? This may block registration and movement operations until resumed."
      : "Resume warehouse transactions?";

    if (!window.confirm(message)) return;

    await runAction(
      shouldPause ? "Pause warehouse" : "Resume warehouse",
      () => setEmergencyPause(shouldPause),
    );
  }

  async function exportReport(type) {
    const callbacks = {
      inventoryCsv: downloadInventoryCSV,
      movementsCsv: downloadMovementCSV,
      inventoryPdf: downloadInventoryPDF,
    };

    await runAction(
      "Report export",
      callbacks[type],
    );
  }

  async function seed() {
    if (
      !window.confirm(
        `Register up to ${DEMO_ITEMS.length} demo pallets? ` +
        "This creates real local blockchain transactions " +
        "and may require multiple MetaMask approvals.",
      )
    ) {
      return;
    }

    setBusy("Seed inventory");
    setSeedResults([]);
    setSeedProgress("");
    setError("");

    try {
      const results = await seedDemoItems(
        (current, total, message) => {
          setSeedProgress(
            `${current}/${total} — ${message}`,
          );
        },
      );

      setSeedResults(results);

      const successful = results.filter(
        (result) => result.result === "registered",
      ).length;

      const failed = results.filter(
        (result) => result.result === "failed",
      );

      if (failed.length) {
        setError(
          `Seeding stopped at ${failed[0].itemId}: ` +
          failed[0].error,
        );
        toast.error("Demo seeding stopped.");
      } else {
        toast.success(
          `${successful} new demo item(s) registered.`,
        );
      }

      await refresh();
    } catch (err) {
      const message = explainError(err);
      setError(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  if (!address || !correctNetwork) {
    return (
      <div className="panel p-8">
        <Lock size={32} className="text-amber-500" />
        <h2 className="mt-4 text-xl font-bold">
          Admin wallet required
        </h2>
        <p className="mt-2 text-sm muted">
          Connect MetaMask on ChainStock Local.
        </p>
      </div>
    );
  }

  if (loading && !snapshot) {
    return (
      <div className="panel flex items-center gap-3 p-10">
        <Loader2
          size={21}
          className="animate-spin text-teal-500"
        />
        Loading contract permissions...
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="panel p-8">
        <p className="text-rose-500">
          {error || "Admin data unavailable."}
        </p>
        <button onClick={refresh} className="btn-secondary mt-4">
          <RefreshCw size={16} />
          Try Again
        </button>
      </div>
    );
  }

  if (!hasAdminRole) {
    return (
      <div className="panel p-8">
        <Lock size={34} className="text-amber-500" />
        <h2 className="mt-4 text-xl font-bold">
          Administrator access required
        </h2>
        <p className="mt-2 text-sm muted">
          The connected wallet does not hold the
          ADMIN_ROLE or DEFAULT_ADMIN_ROLE exposed
          by this deployment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Access & Administration</p>
          <h2 className="mt-2 text-3xl font-extrabold">
            Admin Console
          </h2>
          <p className="mt-2 text-sm muted">
            Manage roles, safety controls and reporting.
          </p>
        </div>

        <button
          className="btn-secondary"
          onClick={refresh}
          disabled={Boolean(busy) || loading}
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-500"
        >
          <AlertTriangle size={19} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-5">
          <ShieldCheck size={23} className="text-teal-500" />
          <p className="mt-4 text-xs muted">Wallet</p>
          <p className="mt-2 break-all font-mono text-xs">
            {address}
          </p>
        </div>

        <div className="panel p-5">
          <Warehouse size={23} className="text-teal-500" />
          <p className="mt-4 text-xs muted">
            Warehouse zones
          </p>
          <p className="mt-2 text-3xl font-extrabold">
            {snapshot.zones.length}
          </p>
        </div>

        <div className="panel p-5">
          {snapshot.paused
            ? <PauseCircle size={23} className="text-amber-500" />
            : <CheckCircle2 size={23} className="text-teal-500" />}
          <p className="mt-4 text-xs muted">
            Contract operations
          </p>
          <p className="mt-2 text-xl font-extrabold">
            {snapshot.paused ? "Paused" : "Running"}
          </p>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className="panel space-y-5 p-6">
          <SectionTitle
            icon={KeyRound}
            title="Role Management"
            description="Grant or revoke warehouse permissions using a confirmed MetaMask transaction."
          />

          <div>
            <label className="mb-2 block text-sm font-bold">
              Target Wallet Address
            </label>
            <input
              value={targetWallet}
              onChange={(event) => {
                setTargetWallet(event.target.value.trim());
                setTargetRoles(null);
              }}
              className={`${inputClass} font-mono`}
              placeholder="0x..."
              disabled={Boolean(busy)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold">
              Warehouse Role
            </label>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className={inputClass}
              disabled={Boolean(busy)}
            >
              <option value="OPERATOR">OPERATOR</option>
              <option value="MANAGER">MANAGER</option>
            </select>
          </div>

          <button
            onClick={lookupWallet}
            disabled={Boolean(busy)}
            className="btn-secondary w-full"
          >
            <UserCheck size={17} />
            Check Wallet Permissions
          </button>

          {targetRoles && (
            <div className="rounded-xl bg-teal-500/5 p-4">
              <p className="mb-3 font-mono text-xs muted">
                {targetRoles.address}
              </p>

              <div className="flex flex-wrap gap-2">
                {Object.entries(targetRoles.roles).map(
                  ([name, enabled]) => (
                    <span
                      key={name}
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        enabled
                          ? "bg-teal-500/10 text-teal-500"
                          : "bg-slate-500/10 text-slate-500"
                      }`}
                    >
                      {name}: {enabled ? "YES" : "NO"}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => changeRole("grant")}
              disabled={
                Boolean(busy) ||
                !snapshot.capabilities.canGrant
              }
              className="btn-primary"
            >
              <UserCheck size={16} />
              Grant Role
            </button>

            <button
              onClick={() => changeRole("revoke")}
              disabled={
                Boolean(busy) ||
                !snapshot.capabilities.canRevoke
              }
              className="btn-secondary"
            >
              <KeyRound size={16} />
              Revoke Role
            </button>
          </div>

          <p className="text-xs leading-5 muted">
            The contract decides which administrator may
            change each role. Default administrator grants
            are intentionally excluded from this page.
          </p>
        </section>

        <section className="panel space-y-5 p-6">
          <SectionTitle
            icon={PauseCircle}
            title="Emergency Controls"
            description="Pause or resume supported state-changing warehouse operations."
          />

          <div className={`rounded-xl border p-5 ${
            snapshot.paused
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-teal-500/30 bg-teal-500/5"
          }`}>
            <p className="text-sm font-bold">
              Current contract state
            </p>
            <p className={`mt-3 text-2xl font-extrabold ${
              snapshot.paused
                ? "text-amber-500"
                : "text-teal-500"
            }`}>
              {snapshot.paused
                ? "Operations Paused"
                : "Operations Enabled"}
            </p>
          </div>

          <button
            onClick={togglePause}
            disabled={
              Boolean(busy) ||
              (snapshot.paused
                ? !snapshot.capabilities.canUnpause
                : !snapshot.capabilities.canPause)
            }
            className={
              snapshot.paused
                ? "btn-primary w-full"
                : "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            }
          >
            {snapshot.paused
              ? <PlayCircle size={19} />
              : <PauseCircle size={19} />}
            {snapshot.paused
              ? "Resume Operations"
              : "Pause Operations"}
          </button>

          <p className="text-xs leading-6 muted">
            Pause behavior depends on which Solidity methods
            use the Pausable guard. Public read-only queries
            should remain available. This is a contract-level
            control, not merely a frontend setting.
          </p>
        </section>
      </div>

      <section className="panel p-6">
        <SectionTitle
          icon={Warehouse}
          title="Warehouse Zones"
          description="Active and inactive zones retrieved from the deployed contract."
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {snapshot.zones.map((zone) => (
            <div
              key={zone.name}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-white/10"
            >
              <span className="font-semibold">
                {zone.name}
              </span>

              <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                zone.active
                  ? "bg-teal-500/10 text-teal-500"
                  : "bg-rose-500/10 text-rose-500"
              }`}>
                {zone.active ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs muted">
          Zone editing is read-only in this version because
          the exact zone mutation signatures have not been
          confirmed against your deployed Solidity ABI.
          We won't invent potentially unsafe zone operations.
        </p>
      </section>

      <section className="panel p-6">
        <SectionTitle
          icon={FileSpreadsheet}
          title="Export Reports"
          description="Download inventory snapshots and complete stored movement history."
        />

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <button
            onClick={() => exportReport("inventoryCsv")}
            disabled={Boolean(busy)}
            className="btn-secondary"
          >
            <FileSpreadsheet size={18} />
            Inventory CSV
          </button>

          <button
            onClick={() => exportReport("movementsCsv")}
            disabled={Boolean(busy)}
            className="btn-secondary"
          >
            <Download size={18} />
            Movements CSV
          </button>

          <button
            onClick={() => exportReport("inventoryPdf")}
            disabled={Boolean(busy)}
            className="btn-primary"
          >
            <FileText size={18} />
            Inventory PDF
          </button>
        </div>

        <p className="mt-4 text-xs muted">
          Reports capture the current local blockchain
          snapshot. Exports are not themselves on-chain
          records or signed audit certificates.
        </p>
      </section>

      <section className="panel p-6">
        <SectionTitle
          icon={PackagePlus}
          title="Demo Inventory Generator"
          description="Populate the warehouse with eight realistic example pallets for your project demonstration."
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DEMO_ITEMS.map((item) => (
            <div
              key={item.itemId}
              className="rounded-xl border border-slate-200 p-4 dark:border-white/10"
            >
              <p className="font-mono text-xs font-bold text-teal-500">
                {item.itemId}
              </p>
              <p className="mt-2 text-sm font-semibold">
                {item.name}
              </p>
              <p className="mt-1 text-xs muted">
                {item.quantity} {item.unit}
              </p>
            </div>
          ))}
        </div>

        {seedProgress && (
          <div
            role="status"
            className="mt-5 flex items-center gap-2 rounded-xl bg-teal-500/10 p-4 text-sm text-teal-500"
          >
            {busy === "Seed inventory" && (
              <Loader2
                size={16}
                className="animate-spin"
              />
            )}
            {seedProgress}
          </div>
        )}

        {seedResults.length > 0 && (
          <div className="mt-4 space-y-1 text-xs">
            {seedResults.map((result) => (
              <p key={result.itemId}>
                {result.itemId}: {result.result}
              </p>
            ))}
          </div>
        )}

        <button
          onClick={seed}
          disabled={
            Boolean(busy) ||
            snapshot.paused
          }
          className="btn-primary mt-6"
        >
          {busy === "Seed inventory"
            ? <Loader2 size={18} className="animate-spin" />
            : <PackagePlus size={18} />}
          Register Demo Inventory
        </button>

        <p className="mt-4 text-xs leading-6 muted">
          Existing DEMO item IDs are skipped.
          New items require real MetaMask confirmations
          and consume simulated Hardhat ETH. If an
          approval is rejected or a transaction fails,
          the remaining registrations are stopped.
        </p>
      </section>
    </div>
  );
}
