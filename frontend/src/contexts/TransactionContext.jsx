
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { JsonRpcProvider } from "ethers";
import toast from "react-hot-toast";

import {
  CHAIN,
  explainError,
} from "../services/blockchain";

const TransactionContext = createContext(null);
const STORAGE_KEY = "chainstock-transactions-v1";

function readStoredTransactions() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]",
    );
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function TransactionProvider({ children }) {
  const [transactions, setTransactions] = useState(
    readStoredTransactions,
  );

  // Persist transaction metadata, never private keys.
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(transactions.slice(0, 100)),
      );
    } catch {
      // Storage failure must not prevent transactions.
    }
  }, [transactions]);

  const updateRecord = useCallback((id, patch) => {
    setTransactions((previous) =>
      previous.map((record) =>
        record.id === id
          ? { ...record, ...patch }
          : record,
      ),
    );
  }, []);

  /**
   * Adds the transaction before requesting confirmation.
   * send() must be a function returning an ethers TransactionResponse.
   */
  const submitTransaction = useCallback(
    async ({ label, account, send, itemIds = [] }) => {
      const id = crypto.randomUUID();

      const record = {
        id,
        label,
        account: account.toLowerCase(),
        itemIds,
        chainId: CHAIN.id,
        hash: "",
        blockNumber: null,
        status: "awaiting_wallet",
        createdAt: new Date().toISOString(),
        error: "",
      };

      setTransactions((previous) => [record, ...previous]);

      try {
        // Opens MetaMask and waits for wallet approval.
        const tx = await send();

        updateRecord(id, {
          status: "pending",
          hash: tx.hash,
        });

        toast.success("Transaction submitted to the blockchain.");

        const receipt = await tx.wait();

        // ethers may return null if a transaction is replaced.
        // Preserve the pending record for later reconciliation.
        if (!receipt) {
          updateRecord(id, {
            status: "pending",
            error: "Receipt not yet available.",
          });
          return null;
        }

        const successful = receipt.status === 1;

        updateRecord(id, {
          hash: receipt.hash,
          blockNumber: receipt.blockNumber,
          status: successful ? "confirmed" : "failed",
          error: successful
            ? ""
            : "Transaction execution reverted.",
        });

        if (!successful) {
          throw new Error("Transaction execution reverted.");
        }

        toast.success("Blockchain transaction confirmed.");

        return receipt;
      } catch (error) {
        const message = explainError(error);

        // A replacement transaction may have been mined.
        const replacement = error.replacement;
        const replacementReceipt = error.receipt;

        if (replacementReceipt && replacementReceipt.status === 1) {
          updateRecord(id, {
            hash: replacementReceipt.hash,
            blockNumber: replacementReceipt.blockNumber,
            status: "confirmed",
            error: "",
          });

          toast.success("Replacement transaction confirmed.");
          return replacementReceipt;
        }

        updateRecord(id, {
          hash: replacement?.hash || undefined,
          blockNumber: replacementReceipt?.blockNumber ?? null,
          status: "failed",
          error: message,
        });

        toast.error(message);
        throw error;
      }
    },
    [updateRecord],
  );

  const refreshReceipts = useCallback(async () => {
    if (!CHAIN.rpc) {
      toast.error("Blockchain RPC is unavailable.");
      return;
    }

    const pending = transactions.filter(
      (record) =>
        record.status === "pending" &&
        record.hash &&
        record.chainId === CHAIN.id,
    );

    if (pending.length === 0) {
      return;
    }

    const provider = new JsonRpcProvider(
      CHAIN.rpc,
      CHAIN.id,
      { staticNetwork: true },
    );

    try {
      for (const record of pending) {
        const receipt = await provider.getTransactionReceipt(
          record.hash,
        );

        if (receipt) {
          updateRecord(record.id, {
            status: receipt.status === 1
              ? "confirmed"
              : "failed",
            blockNumber: receipt.blockNumber,
            error: receipt.status === 1
              ? ""
              : "Execution reverted.",
          });
        }
      }

      toast.success("Transaction receipts checked.");
    } catch (error) {
      toast.error(explainError(error));
    } finally {
      provider.destroy();
    }
  }, [transactions, updateRecord]);

  const clearFinished = useCallback(() => {
    setTransactions((previous) =>
      previous.filter((record) =>
        record.status === "pending" ||
        record.status === "awaiting_wallet",
      ),
    );
  }, []);

  return (
    <TransactionContext.Provider
      value={{
        transactions,
        submitTransaction,
        refreshReceipts,
        clearFinished,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionContext);

  if (!context) {
    throw new Error(
      "useTransactions requires TransactionProvider.",
    );
  }

  return context;
}
