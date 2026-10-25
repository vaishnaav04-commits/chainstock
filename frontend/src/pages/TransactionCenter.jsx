
import { useMemo } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
  Trash2,
  Wallet,
} from "lucide-react";

import { useWallet } from "../contexts/WalletContext";
import { useTransactions } from "../contexts/TransactionContext";

import {
  CHAIN,
  shortAddress,
} from "../services/blockchain";

const STATUS = {
  awaiting_wallet: {
    label: "Awaiting wallet",
    color: "text-amber-500 bg-amber-500/10",
    icon: Wallet,
  },
  pending: {
    label: "Pending",
    color: "text-sky-500 bg-sky-500/10",
    icon: Clock3,
  },
  confirmed: {
    label: "Confirmed",
    color: "text-teal-500 bg-teal-500/10",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    color: "text-rose-500 bg-rose-500/10",
    icon: AlertCircle,
  },
};

function TransactionCard({ tx }) {
  const config = STATUS[tx.status] || STATUS.pending;
  const Icon = config.icon;

  const explorerUrl =
    tx.chainId === 11155111 && tx.hash
      ? `https://sepolia.etherscan.io/tx/${tx.hash}`
      : null;

  return (
    <article className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-teal-500/10 p-3 text-teal-500">
            <History size={21} />
          </div>

          <div>
            <h3 className="font-bold">{tx.label}</h3>
            <p className="mt-1 text-xs muted">
              {new Date(tx.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${config.color}`}>
          <Icon
            size={14}
            className={tx.status === "pending" ? "animate-pulse" : ""}
          />
          {config.label}
        </span>
      </div>

      <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5 text-sm dark:border-white/10 sm:grid-cols-2">
        <div>
          <p className="text-xs muted">Wallet</p>
          <p className="mt-1 font-mono">
            {shortAddress(tx.account)}
          </p>
        </div>

        <div>
          <p className="text-xs muted">Block number</p>
          <p className="mt-1 font-semibold">
            {tx.blockNumber ?? "Not confirmed"}
          </p>
        </div>

        <div>
          <p className="text-xs muted">Network</p>
          <p className="mt-1 font-semibold">
            {tx.chainId === 31337
              ? "ChainStock Local"
              : `Chain ${tx.chainId}`}
          </p>
        </div>

        <div>
          <p className="text-xs muted">Items</p>
          <p className="mt-1 break-words font-mono text-xs">
            {tx.itemIds?.join(", ") || "—"}
          </p>
        </div>
      </div>

      {tx.hash && (
        <div className="mt-4 rounded-xl bg-slate-100 p-3 dark:bg-white/5">
          <p className="mb-1 text-xs muted">Transaction hash</p>
          <p className="break-all font-mono text-xs">
            {tx.hash}
          </p>

          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-teal-500 hover:underline"
            >
              View on Sepolia Etherscan
              <ExternalLink size={13} />
            </a>
          )}

          {tx.chainId === 31337 && (
            <p className="mt-2 text-xs muted">
              Local Hardhat transactions have no public
              Etherscan page.
            </p>
          )}
        </div>
      )}

      {tx.error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-500"
        >
          {tx.error}
        </p>
      )}

      {tx.status === "failed" && (
        <p className="mt-3 text-xs muted">
          To retry, return to the scanner, re-read the
          item's current blockchain state, and submit a
          new transaction. Never automatically replay a
          failed movement.
        </p>
      )}
    </article>
  );
}

export default function TransactionCenter() {
  const { address } = useWallet();

  const {
    transactions,
    refreshReceipts,
    clearFinished,
  } = useTransactions();

  // Show the history for the connected wallet only.
  // These records are local browser metadata, not an
  // exhaustive blockchain-wide audit log.
  const records = useMemo(() => {
    return transactions.filter(
      (tx) =>
        address &&
        tx.account === address.toLowerCase(),
    );
  }, [transactions, address]);

  const counts = {
    confirmed: records.filter(
      (tx) => tx.status === "confirmed",
    ).length,
    pending: records.filter(
      (tx) => tx.status === "pending" ||
        tx.status === "awaiting_wallet",
    ).length,
    failed: records.filter(
      (tx) => tx.status === "failed",
    ).length,
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            Blockchain Operations
          </p>
          <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
            Transaction Center
          </h2>
          <p className="mt-2 text-sm muted">
            Track your submitted warehouse movement
            transactions and confirmation status.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={refreshReceipts}
            className="btn-secondary"
          >
            <RefreshCw size={16} />
            Refresh Receipts
          </button>

          <button
            onClick={clearFinished}
            className="btn-secondary"
          >
            <Trash2 size={16} />
            Clear Finished
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Confirmed",
            value: counts.confirmed,
            icon: CheckCircle2,
            color: "text-teal-500",
          },
          {
            label: "Pending",
            value: counts.pending,
            icon: Loader2,
            color: "text-sky-500",
          },
          {
            label: "Failed",
            value: counts.failed,
            icon: AlertCircle,
            color: "text-rose-500",
          },
        ].map((metric) => {
          const Icon = metric.icon;

          return (
            <div key={metric.label} className="panel p-5">
              <Icon
                size={22}
                className={metric.color}
              />
              <p className="mt-4 text-sm muted">
                {metric.label}
              </p>
              <p className="mt-1 text-3xl font-extrabold">
                {metric.value}
              </p>
            </div>
          );
        })}
      </div>

      {!address ? (
        <div className="panel py-16 text-center">
          <Wallet
            size={38}
            className="mx-auto text-slate-400"
          />
          <h3 className="mt-4 font-bold">
            Connect your wallet
          </h3>
          <p className="mt-2 text-sm muted">
            Your transaction history is associated
            with your connected wallet address.
          </p>
        </div>
      ) : records.length === 0 ? (
        <div className="panel py-16 text-center">
          <History
            size={38}
            className="mx-auto text-slate-400"
          />
          <h3 className="mt-4 font-bold">
            No movement transactions yet
          </h3>
          <p className="mt-2 text-sm muted">
            Scan a registered item and submit a
            blockchain movement to see it here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((tx) => (
            <TransactionCard key={tx.id} tx={tx} />
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 p-4 text-xs leading-6 muted dark:border-white/10">
        <strong>Note:</strong> This center stores transaction
        metadata in your browser. The Solidity blockchain
        remains the authoritative source of inventory history.
        Restarting your local Hardhat node resets its blockchain.
        Existing browser records can then refer to an old chain.
        Current configured network: {CHAIN.name}.
      </div>
    </div>
  );
}
