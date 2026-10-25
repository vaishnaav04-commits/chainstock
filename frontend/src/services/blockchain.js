
import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
} from "ethers";

import deployment from "../config/contract.json";

export const CHAIN = {
  id: Number(deployment.chainId),
  name:
    Number(deployment.chainId) === 31337
      ? "ChainStock Local"
      : deployment.network,
  address: deployment.address,
  rpc:
    Number(deployment.chainId) === 31337
      ? "http://127.0.0.1:8545"
      : import.meta.env.VITE_PUBLIC_RPC_URL || "",
};

export const STATUS_NAMES = [
  "Received",
  "Stored",
  "Picked",
  "InTransit",
  "Shipped",
  "Delivered",
  "Damaged",
  "Returned",
];

// Each status number matches the Solidity enum.
export function formatStatus(value) {
  return STATUS_NAMES[Number(value)] || "Unknown";
}

export function shortAddress(address) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function explainError(error) {
  if (!error) return "An unknown error occurred.";

  if (error.code === 4001 ||
      error.code === "ACTION_REJECTED") {
    return "You rejected the wallet request.";
  }

  if (error.code === 4902) {
    return "ChainStock Local is not added to MetaMask.";
  }

  if (error.code === -32002) {
    return "A MetaMask request is already pending. Open MetaMask.";
  }

  const text = String(
    error.shortMessage ||
    error.reason ||
    error.message ||
    error,
  );

  if (/could not coalesce|could not detect network|ECONNREFUSED/i.test(text)) {
    return "Blockchain unavailable. Start the Hardhat node.";
  }

  return text.length > 220
    ? `${text.slice(0, 220)}...`
    : text;
}

export function hasMetaMask() {
  return typeof window !== "undefined" &&
    Boolean(window.ethereum);
}

// Public reads do not require MetaMask approval.
// For local development, we read the Hardhat node directly.
export function getReadProvider() {
  if (!CHAIN.rpc) {
    throw new Error(
      "Public RPC URL is not configured for this network.",
    );
  }

  return new JsonRpcProvider(
    CHAIN.rpc,
    CHAIN.id,
    { staticNetwork: true },
  );
}

export function getReadContract() {
  return new Contract(
    CHAIN.address,
    deployment.abi,
    getReadProvider(),
  );
}

// MetaMask supplies transaction signing.
// The private key never enters React.
export async function getWalletConnection(
  requestAccounts = false,
) {
  if (!hasMetaMask()) {
    throw new Error(
      "MetaMask is not installed. Install the browser extension.",
    );
  }

  const method = requestAccounts
    ? "eth_requestAccounts"
    : "eth_accounts";

  const accounts = await window.ethereum.request({
    method,
  });

  if (!accounts || accounts.length === 0) {
    return null;
  }

  const provider = new BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  return {
    address: accounts[0],
    chainId,
    provider,
  };
}

export async function switchToChainStock() {
  if (!hasMetaMask()) {
    throw new Error("MetaMask is not installed.");
  }

  const hexId = `0x${CHAIN.id.toString(16)}`;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexId }],
    });
  } catch (error) {
    if (error.code !== 4902) throw error;

    if (!CHAIN.rpc) {
      throw new Error("Missing RPC URL for this network.");
    }

    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: hexId,
        chainName: CHAIN.name,
        rpcUrls: [CHAIN.rpc],
        nativeCurrency: {
          name: "Ether",
          symbol: "ETH",
          decimals: 18,
        },
      }],
    });
  }
}

export async function getWriteContract() {
  const connection = await getWalletConnection(false);

  if (!connection) {
    throw new Error("Connect your MetaMask wallet first.");
  }

  if (connection.chainId !== CHAIN.id) {
    throw new Error(
      `Wrong network. Switch to ${CHAIN.name}.`,
    );
  }

  const signer = await connection.provider.getSigner();

  return new Contract(
    CHAIN.address,
    deployment.abi,
    signer,
  );
}

// Reads actual contract roles, not a simulated login.
export async function fetchWalletRoles(address) {
  const contract = getReadContract();

  const [
    isAdmin,
    isManager,
    isOperator,
    isViewer,
  ] = await Promise.all([
    contract.hasRole(await contract.ADMIN_ROLE(), address),
    contract.hasRole(await contract.MANAGER_ROLE(), address),
    contract.hasRole(await contract.OPERATOR_ROLE(), address),
    contract.hasRole(await contract.VIEWER_ROLE(), address),
  ]);

  const roles = {
    ADMIN: isAdmin,
    MANAGER: isManager,
    OPERATOR: isOperator,
    VIEWER: isViewer,
  };

  const primaryRole =
    isAdmin ? "ADMIN"
    : isManager ? "MANAGER"
    : isOperator ? "OPERATOR"
    : isViewer ? "VIEWER"
    : "GUEST";

  return { roles, primaryRole };
}

// Confirm that the contract is really present on this chain.
export async function checkContractHealth() {
  const provider = getReadProvider();

  const [network, block, code] = await Promise.all([
    provider.getNetwork(),
    provider.getBlockNumber(),
    provider.getCode(CHAIN.address),
  ]);

  if (code === "0x") {
    throw new Error(
      "No contract at the saved address. Redeploy with Hardhat.",
    );
  }

  return {
    chainId: Number(network.chainId),
    blockNumber: block,
    contractDeployed: true,
  };
}
