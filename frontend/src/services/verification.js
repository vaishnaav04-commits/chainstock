
import {
  AbiCoder,
  id,
  keccak256,
  getAddress,
} from "ethers";

import deployment from "../config/contract.json";

import {
  CHAIN,
  formatStatus,
  getReadContract,
} from "./blockchain";

const coder = AbiCoder.defaultAbiCoder();

const MOVEMENT_TYPES = [
  "string",
  "uint8",
  "uint256",
  "uint256",
  "address",
  "string",
];

const HISTORY_TYPES = ["bytes32[]"];

export function validItemId(value) {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{3,64}$/.test(value)
  );
}

// Normalize both contract records and browser records.
// All integer values use decimal strings to avoid precision loss.
export function normalizeMovement(movement) {
  return {
    toZone: String(movement.toZone),
    status: Number(movement.status),
    quantity: BigInt(movement.quantity).toString(),
    timestamp: BigInt(movement.timestamp).toString(),
    actor: getAddress(movement.actor),
    note: String(movement.note),
  };
}

export function normalizeItem(item) {
  return {
    itemId: String(item.itemId),
    name: String(item.name),
    category: String(item.category),
    sku: String(item.sku),
    quantity: BigInt(item.quantity).toString(),
    unit: String(item.unit),
    currentZone: String(item.currentZone),
    status: Number(item.status),
    metadataHash: String(item.metadataHash),
    createdAt: BigInt(item.createdAt).toString(),
    updatedAt: BigInt(item.updatedAt).toString(),
    exists: Boolean(item.exists),
  };
}

// Hash each movement with Solidity-compatible ABI encoding,
// then hash the ordered array of movement hashes.
export function historyDigest(history) {
  const movementHashes = history.map((entry) => {
    const m = normalizeMovement(entry);

    const encoded = coder.encode(MOVEMENT_TYPES, [
      m.toZone,
      m.status,
      BigInt(m.quantity),
      BigInt(m.timestamp),
      m.actor,
      m.note,
    ]);

    return keccak256(encoded);
  });

  return keccak256(
    coder.encode(HISTORY_TYPES, [movementHashes]),
  );
}

export function compareHistories(displayed, authoritative) {
  const displayedHash = historyDigest(displayed);
  const authoritativeHash = historyDigest(authoritative);

  return {
    matched: displayedHash === authoritativeHash,
    displayedHash,
    authoritativeHash,
    displayedCount: displayed.length,
    authoritativeCount: authoritative.length,
  };
}

/**
 * Read a consistent on-chain snapshot at one block.
 * The contract is public; no wallet connection is required.
 */
export async function fetchVerification(itemId) {
  if (!validItemId(itemId)) {
    throw new Error(
      "Enter a valid ChainStock item ID (3–64 letters, digits, - or _).",
    );
  }

  const contract = getReadContract();
  const provider = contract.runner;

  const network = await provider.getNetwork();

  if (Number(network.chainId) !== CHAIN.id) {
    throw new Error("Public RPC returned the wrong chain.");
  }

  const bytecode = await provider.getCode(CHAIN.address);

  if (bytecode === "0x") {
    throw new Error(
      "No contract exists at the saved address. Redeploy ChainStock.",
    );
  }

  const snapshotBlock = await provider.getBlockNumber();

  const [rawItem, rawHistory] = await Promise.all([
    contract.getItem(itemId, {
      blockTag: snapshotBlock,
    }),
    contract.getHistory(itemId, {
      blockTag: snapshotBlock,
    }),
  ]);

  const item = normalizeItem(rawItem);
  const history = rawHistory.map(normalizeMovement);

  // The itemId event parameter is indexed as a string.
  // Ethereum indexes dynamic strings using their hash.
  // Filtering by the original ID is supported by ethers.
  const filter = contract.filters.MovementLogged(itemId);

  const fromBlock = Math.max(
    0,
    Number(deployment.deploymentBlock ?? 0),
  );

  let events = [];
  let eventError = "";

  try {
    const logs = await contract.queryFilter(
      filter,
      fromBlock,
      snapshotBlock,
    );

    events = logs
      .filter((event) => event.fragment?.name === "MovementLogged")
      .sort(
        (a, b) =>
          a.blockNumber - b.blockNumber ||
          a.index - b.index,
      )
      .map((event) => ({
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        actor: String(event.args.actor),
        fromZone: String(event.args.fromZone),
        toZone: String(event.args.toZone),
        status: Number(event.args.status),
        quantity: BigInt(event.args.quantity).toString(),
        timestamp: BigInt(event.args.timestamp).toString(),
      }));
  } catch (error) {
    eventError =
      "Transaction event lookup is unavailable. " +
      "Stored contract history is still readable.";
  }

  // Compare every log field available in contract history.
  // Logs don't contain the note, and therefore cannot
  // independently corroborate movement notes.
  const eventMatch =
    !eventError &&
    events.length === history.length &&
    events.every((event, index) => {
      const movement = history[index];

      return (
        event.toZone === movement.toZone &&
        event.status === movement.status &&
        event.quantity === movement.quantity &&
        event.timestamp === movement.timestamp &&
        event.actor.toLowerCase() ===
          movement.actor.toLowerCase()
      );
    });

  return {
    item,
    history,
    events,
    eventMatch,
    eventError,
    historyHash: historyDigest(history),
    snapshotBlock,
    chainId: CHAIN.id,
    contractAddress: CHAIN.address,
  };
}

export function verifyAgainstFreshHistory(
  displayed,
  freshlyFetched,
) {
  return compareHistories(displayed, freshlyFetched);
}

export function getExplorerTxUrl(hash) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash || "")) {
    return null;
  }

  return CHAIN.id === 11155111
    ? `https://sepolia.etherscan.io/tx/${hash}`
    : null;
}

export function displayStatus(value) {
  return formatStatus(value);
}

export function getVerificationUrl(itemId) {
  return `${window.location.origin}/verify/${encodeURIComponent(itemId)}`;
}
