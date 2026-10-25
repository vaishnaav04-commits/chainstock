
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Checks the deployed ChainStock contract.
 * Confirms the network, bytecode, administrator,
 * zones, and initial inventory count.
 */
async function main() {
  const configPath = path.resolve(
    __dirname,
    "../frontend/src/config/contract.json",
  );

  if (!fs.existsSync(configPath)) {
    throw new Error(
      "Contract configuration not found. Deploy first.",
    );
  }

  const config = JSON.parse(
    fs.readFileSync(configPath, "utf8"),
  );

  const network = await hre.ethers.provider.getNetwork();
  const currentChainId = Number(network.chainId);

  if (currentChainId !== config.chainId) {
    throw new Error(
      `Wrong network. Expected ${config.chainId}, ` +
      `received ${currentChainId}.`,
    );
  }

  const code = await hre.ethers.provider.getCode(
    config.address,
  );

  if (code === "0x") {
    throw new Error(
      "No contract found at the saved address. " +
      "Your local node may have restarted. " +
      "Redeploy the contract.",
    );
  }

  const ledger = await hre.ethers.getContractAt(
    "WarehouseLedger",
    config.address,
  );

  const [deployer] = await hre.ethers.getSigners();

  const adminRole = await ledger.ADMIN_ROLE();

  const hasAdminRole = await ledger.hasRole(
    adminRole,
    deployer.address,
  );

  const count = await ledger.getItemCount();
  const zones = await ledger.getZones();
  const paused = await ledger.paused();

  console.log("\nCHAINSTOCK LOCAL VERIFICATION");
  console.log("-----------------------------");
  console.log("Chain ID:", currentChainId);
  console.log("Contract:", config.address);
  console.log("Code deployed: YES");
  console.log("Deployer has admin role:", hasAdminRole);
  console.log("Item count:", count.toString());
  console.log("Zones:", zones.join(", "));
  console.log("Paused:", paused);

  if (!hasAdminRole) {
    throw new Error(
      "Expected deployer to have ADMIN_ROLE.",
    );
  }

  if (zones.length !== 6) {
    throw new Error(
      `Expected 6 initial zones, found ${zones.length}.`,
    );
  }

  console.log("\nVerification PASSED.\n");
}

main().catch((error) => {
  console.error("\nVerification FAILED:");
  console.error(error);
  process.exitCode = 1;
});
