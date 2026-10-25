
import {
  getAddress,
  id as hashString,
  keccak256,
  toUtf8Bytes,
} from "ethers";

import {
  getReadContract,
  getWriteContract,
} from "./blockchain";

export const ROLE_LABELS = [
  "MANAGER",
  "OPERATOR",
];

export function supports(contract, signature) {
  try {
    return contract.interface.hasFunction(signature);
  } catch {
    return false;
  }
}

export async function getRoleIds(contract) {
  const roleIds = {};

  for (const name of [
    "DEFAULT_ADMIN",
    "ADMIN",
    "MANAGER",
    "OPERATOR",
  ]) {
    const getter = `${name}_ROLE`;

    if (supports(contract, `${getter}()`)) {
      roleIds[name] = await contract[getter]();
    }
  }

  return roleIds;
}

export async function getAdminSnapshot(account) {
  const contract = getReadContract();

  const [zones, paused, roleIds] = await Promise.all([
    contract.getZones(),
    contract.paused(),
    getRoleIds(contract),
  ]);

  const permissions = {};

  if (account) {
    for (const [name, roleId] of Object.entries(roleIds)) {
      permissions[name] = await contract.hasRole(
        roleId,
        account,
      );
    }
  }

  const zoneDetails = await Promise.all(
    zones.map(async (name) => ({
      name,
      active: await contract.zoneActive(
        hashString(name),
      ),
    })),
  );

  const canGrant = supports(
    contract,
    "grantRole(bytes32,address)",
  );

  const canRevoke = supports(
    contract,
    "revokeRole(bytes32,address)",
  );

  const canPause = supports(contract, "pause()");
  const canUnpause = supports(contract, "unpause()");

  return {
    zones: zoneDetails,
    paused,
    roleIds,
    permissions,
    capabilities: {
      canGrant,
      canRevoke,
      canPause,
      canUnpause,
    },
  };
}

export async function checkWalletRoles(address) {
  const target = getAddress(address);
  const contract = getReadContract();
  const roleIds = await getRoleIds(contract);

  const roles = {};

  for (const [name, roleId] of Object.entries(roleIds)) {
    roles[name] = await contract.hasRole(
      roleId,
      target,
    );
  }

  return { address: target, roles };
}

export async function manageRole({
  action,
  role,
  account,
}) {
  if (!["grant", "revoke"].includes(action)) {
    throw new Error("Invalid role action.");
  }

  if (!ROLE_LABELS.includes(role)) {
    throw new Error(
      "Only MANAGER and OPERATOR can be managed here.",
    );
  }

  const target = getAddress(account);
  const contract = await getWriteContract();
  const roleIds = await getRoleIds(contract);

  const roleId = roleIds[role];

  if (!roleId) {
    throw new Error(
      `${role} role is unavailable in this contract ABI.`,
    );
  }

  const method = action === "grant"
    ? "grantRole"
    : "revokeRole";

  if (!supports(
    contract,
    `${method}(bytes32,address)`,
  )) {
    throw new Error(
      `${method} is not exposed by the contract.`,
    );
  }

  const alreadyHasRole = await contract.hasRole(
    roleId,
    target,
  );

  if (action === "grant" && alreadyHasRole) {
    throw new Error(
      "This wallet already has the selected role.",
    );
  }

  if (action === "revoke" && !alreadyHasRole) {
    throw new Error(
      "This wallet does not have the selected role.",
    );
  }

  // The contract performs the definitive authorization check.
  await contract[method].staticCall(roleId, target);

  const tx = await contract[method](roleId, target);
  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("Role transaction was not confirmed.");
  }

  return receipt;
}

export async function setEmergencyPause(shouldPause) {
  const contract = await getWriteContract();
  const method = shouldPause ? "pause" : "unpause";

  if (!supports(contract, `${method}()`)) {
    throw new Error(
      `${method}() is not exposed by this contract.`,
    );
  }

  const currentlyPaused = await contract.paused();

  if (currentlyPaused === shouldPause) {
    throw new Error(
      shouldPause
        ? "The contract is already paused."
        : "The contract is already running.",
    );
  }

  await contract[method].staticCall();

  const tx = await contract[method]();
  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("Pause transaction failed.");
  }

  return receipt;
}

export const DEMO_ITEMS = [
  {
    itemId: "DEMO-001",
    name: "Industrial Bearings",
    category: "Mechanical Parts",
    sku: "BRG-001",
    quantity: 50,
    unit: "pieces",
  },
  {
    itemId: "DEMO-002",
    name: "Hydraulic Pumps",
    category: "Mechanical Parts",
    sku: "HYD-020",
    quantity: 20,
    unit: "pieces",
  },
  {
    itemId: "DEMO-003",
    name: "Electrical Connectors",
    category: "Electronics",
    sku: "ELE-100",
    quantity: 100,
    unit: "boxes",
  },
  {
    itemId: "DEMO-004",
    name: "Medical Supply Cartons",
    category: "Pharmaceuticals",
    sku: "MED-040",
    quantity: 40,
    unit: "cartons",
  },
  {
    itemId: "DEMO-005",
    name: "Automotive Fasteners",
    category: "Automotive",
    sku: "AUT-200",
    quantity: 200,
    unit: "pieces",
  },
  {
    itemId: "DEMO-006",
    name: "Electronic Control Units",
    category: "Electronics",
    sku: "ECU-015",
    quantity: 15,
    unit: "pieces",
  },
  {
    itemId: "DEMO-007",
    name: "Food Packaging Materials",
    category: "Food & Beverages",
    sku: "PKG-080",
    quantity: 80,
    unit: "boxes",
  },
  {
    itemId: "DEMO-008",
    name: "Textile Bundles",
    category: "Textiles",
    sku: "TEX-030",
    quantity: 30,
    unit: "sets",
  },
];

export async function seedDemoItems(onProgress) {
  const contract = await getWriteContract();
  const readContract = getReadContract();

  if (!supports(
    contract,
    "registerItem(string,string,string,string,uint256,string,string,bytes32)",
  )) {
    throw new Error(
      "The deployed registerItem signature does not match " +
      "the Phase 5 contract. Demo seeding was not started.",
    );
  }

  const [existingIds, zoneNames] = await Promise.all([
    readContract.getAllItemIds(),
    readContract.getZones(),
  ]);

  const preferred = zoneNames.includes("Receiving")
    ? "Receiving"
    : zoneNames[0];

  if (!preferred) {
    throw new Error("No warehouse zones are configured.");
  }

  const isActive = await readContract.zoneActive(
    hashString(preferred),
  );

  if (!isActive) {
    throw new Error(
      `Initial demo zone ${preferred} is inactive.`,
    );
  }

  const existing = new Set(existingIds);
  const results = [];

  for (let index = 0; index < DEMO_ITEMS.length; index++) {
    const item = DEMO_ITEMS[index];

    if (existing.has(item.itemId)) {
      results.push({
        itemId: item.itemId,
        result: "skipped",
      });

      onProgress?.(
        index + 1,
        DEMO_ITEMS.length,
        `${item.itemId}: already registered`,
      );

      continue;
    }

    const metadata = JSON.stringify({
      itemId: item.itemId,
      name: item.name,
      category: item.category,
      sku: item.sku,
      quantity: String(item.quantity),
      unit: item.unit,
      description: "ChainStock Phase 10 demonstration item",
    });

    const metadataHash = keccak256(
      toUtf8Bytes(metadata),
    );

    const args = [
      item.itemId,
      item.name,
      item.category,
      item.sku,
      BigInt(item.quantity),
      item.unit,
      preferred,
      metadataHash,
    ];

    try {
      await contract.registerItem.staticCall(...args);

      onProgress?.(
        index + 1,
        DEMO_ITEMS.length,
        `Approve ${item.itemId} in MetaMask`,
      );

      const tx = await contract.registerItem(...args);
      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        throw new Error("Registration transaction failed.");
      }

      existing.add(item.itemId);

      results.push({
        itemId: item.itemId,
        result: "registered",
        hash: receipt.hash,
      });
    } catch (error) {
      results.push({
        itemId: item.itemId,
        result: "failed",
        error:
          error.shortMessage ||
          error.message ||
          String(error),
      });

      onProgress?.(
        index + 1,
        DEMO_ITEMS.length,
        `${item.itemId}: failed; stopping`,
      );

      // Stop rather than repeatedly opening MetaMask
      // after a rejection or contract error.
      break;
    }

    onProgress?.(
      index + 1,
      DEMO_ITEMS.length,
      `${item.itemId}: confirmed`,
    );
  }

  return results;
}
