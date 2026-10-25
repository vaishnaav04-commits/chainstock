
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import toast from "react-hot-toast";

import {
  CHAIN,
  explainError,
  fetchWalletRoles,
  getWalletConnection,
  hasMetaMask,
  switchToChainStock,
} from "../services/blockchain";

const WalletContext = createContext(null);

const EMPTY_ROLES = {
  ADMIN: false,
  MANAGER: false,
  OPERATOR: false,
  VIEWER: false,
};

export function WalletProvider({ children }) {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(null);
  const [role, setRole] = useState("GUEST");
  const [roles, setRoles] = useState(EMPTY_ROLES);
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const correctNetwork =
    chainId !== null && chainId === CHAIN.id;

  const refresh = useCallback(async () => {
    try {
      const connection = await getWalletConnection(false);

      if (!connection) {
        setAddress("");
        setChainId(null);
        setRole("GUEST");
        setRoles(EMPTY_ROLES);
        setError("");
        return;
      }

      setAddress(connection.address);
      setChainId(connection.chainId);

      if (connection.chainId !== CHAIN.id) {
        setRole("GUEST");
        setRoles(EMPTY_ROLES);
        setError(`Switch to ${CHAIN.name} to use ChainStock.`);
        return;
      }

      const result = await fetchWalletRoles(
        connection.address,
      );

      setRoles(result.roles);
      setRole(result.primaryRole);
      setError("");
    } catch (err) {
      setRole("GUEST");
      setRoles(EMPTY_ROLES);
      setError(explainError(err));
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      await refresh();
      if (active) setLoading(false);
    }

    initialize();

    if (!hasMetaMask()) {
      return () => {
        active = false;
      };
    }

    const handleChange = () => {
      refresh();
    };

    window.ethereum.on("accountsChanged", handleChange);
    window.ethereum.on("chainChanged", handleChange);

    return () => {
      active = false;
      window.ethereum.removeListener(
        "accountsChanged",
        handleChange,
      );
      window.ethereum.removeListener(
        "chainChanged",
        handleChange,
      );
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    setConnecting(true);

    try {
      const connection = await getWalletConnection(true);

      if (!connection) {
        throw new Error("No account was selected.");
      }

      await refresh();

      if (connection.chainId !== CHAIN.id) {
        toast.error("Switch to ChainStock Local.");
      } else {
        toast.success("Wallet connected.");
      }
    } catch (err) {
      toast.error(explainError(err));
    } finally {
      setConnecting(false);
    }
  }, [refresh]);

  const switchNetwork = useCallback(async () => {
    try {
      await switchToChainStock();
      await refresh();
      toast.success("Network switched.");
    } catch (err) {
      toast.error(explainError(err));
    }
  }, [refresh]);

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        role,
        roles,
        connecting,
        loading,
        error,
        correctNetwork,
        connect,
        switchNetwork,
        refresh,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error("useWallet requires WalletProvider");
  }

  return context;
}
