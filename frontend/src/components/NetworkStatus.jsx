
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  WifiOff,
} from "lucide-react";

import { CHAIN, getReadContract } from "../services/blockchain";

const INTERVAL = 12000;

export default function NetworkStatus() {
  const [state, setState] = useState({
    checking: true,
    browserOnline: navigator.onLine,
    rpcOnline: false,
    correctChain: false,
  });

  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;

    async function check() {
      const browserOnline = navigator.onLine;

      if (!browserOnline) {
        if (alive) {
          setState({
            checking: false,
            browserOnline: false,
            rpcOnline: false,
            correctChain: false,
          });
        }
        return;
      }

      let timeout;

      try {
        const contract = getReadContract();
        const provider = contract.runner;

        // Detect a hung local RPC, not just a disconnected browser.
        const network = await Promise.race([
          provider.getNetwork(),
          new Promise((_, reject) => {
            timeout = setTimeout(
              () => reject(new Error("RPC timeout")),
              5000,
            );
          }),
        ]);

        if (alive) {
          setState({
            checking: false,
            browserOnline: true,
            rpcOnline: true,
            correctChain: Number(network.chainId) === CHAIN.id,
          });
        }
      } catch {
        if (alive) {
          setState({
            checking: false,
            browserOnline: true,
            rpcOnline: false,
            correctChain: false,
          });
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    check();

    const timer = setInterval(check, INTERVAL);

    const onConnectionChange = () => {
      check();
    };

    window.addEventListener("online", onConnectionChange);
    window.addEventListener("offline", onConnectionChange);

    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("online", onConnectionChange);
      window.removeEventListener("offline", onConnectionChange);
    };
  }, [retry]);

  // Healthy connection: keep the interface unobstructed.
  if (
    state.checking ||
    (state.browserOnline &&
      state.rpcOnline &&
      state.correctChain)
  ) {
    return null;
  }

  const browserOffline = !state.browserOnline;
  const wrongChain = state.rpcOnline && !state.correctChain;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 right-4 z-[90] mx-auto max-w-lg rounded-xl border border-amber-500/40 bg-[#281e18] p-4 text-amber-100 shadow-2xl"
    >
      <div className="flex items-start gap-3">
        {browserOffline
          ? <WifiOff size={21} className="shrink-0 text-amber-400" />
          : <AlertTriangle size={21} className="shrink-0 text-amber-400" />}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            {browserOffline
              ? "Internet connection unavailable"
              : wrongChain
                ? "Unexpected blockchain network"
                : "Blockchain connection unavailable"}
          </p>

          <p className="mt-1 text-xs leading-5 text-amber-100/80">
            {browserOffline
              ? "Cached pages may still open, but transactions and verification require connectivity."
              : wrongChain
                ? `The RPC must connect to chain ${CHAIN.id}.`
                : "Check the Hardhat node on port 8545 and the configured contract RPC."}
          </p>

          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-amber-300 hover:underline"
          >
            <RefreshCw size={14} />
            Retry Connection
          </button>
        </div>

        {state.rpcOnline && !wrongChain && (
          <CheckCircle2 size={18} className="text-teal-500" />
        )}
      </div>
    </div>
  );
}
