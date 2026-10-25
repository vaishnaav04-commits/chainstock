
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * ChainStock deployment script.
 *
 * 1. Deploys WarehouseLedger.
 * 2. Waits for transaction confirmation.
 * 3. Exports the contract address and ABI.
 * 4. Prepares the frontend for blockchain interaction.
 */
async function main() {
  const { ethers, network, artifacts } = hre;

  const [deployer] = await ethers.getSigners();

  const providerNetwork =
    await ethers.provider.getNetwork();

  const chainId = Number(providerNetwork.chainId);

  console.log("\n========================================");
  console.log("       CHAINSTOCK DEPLOYMENT");
  console.log("========================================");

  console.log("Network:", network.name);
  console.log("Chain ID:", chainId);
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(
    deployer.address,
  );

  console.log(
    "Deployer balance:",
    ethers.formatEther(balance),
    "ETH",
  );

  console.log("\nDeploying WarehouseLedger...");

  // Creates and broadcasts the contract deployment.
  const WarehouseLedger =
    await ethers.getContractFactory("WarehouseLedger");

  const ledger = await WarehouseLedger.deploy();

  // Wait until deployment has been mined.
  await ledger.waitForDeployment();

  const contractAddress = await ledger.getAddress();

  const deploymentTx = ledger.deploymentTransaction();

  const receipt = deploymentTx
    ? await deploymentTx.wait()
    : null;

  console.log("\nDeployment successful!");
  console.log("Contract address:", contractAddress);

  if (receipt) {
    console.log("Block number:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Transaction hash:", receipt.hash);
  }

  // Verify the contract responds before exporting it.
  const itemCount = await ledger.getItemCount();
  const zones = await ledger.getZones();

  console.log("Initial item count:", itemCount.toString());
  console.log("Warehouse zones:", zones.join(", "));

  const artifact = await artifacts.readArtifact(
    "WarehouseLedger",
  );

  const deployment = {
    contractName: "WarehouseLedger",
    address: contractAddress,
    chainId,
    network: network.name,
    deploymentBlock: receipt
      ? receipt.blockNumber
      : null,
    deploymentTxHash: receipt
      ? receipt.hash
      : null,
    abi: artifact.abi,
  };

  // This file will be consumed by our React app.
  const frontendConfigPath = path.resolve(
    __dirname,
    "../frontend/src/config/contract.json",
  );

  fs.mkdirSync(
    path.dirname(frontendConfigPath),
    { recursive: true },
  );

  fs.writeFileSync(
    frontendConfigPath,
    JSON.stringify(deployment, null, 2),
    "utf8",
  );

  console.log(
    "\nFrontend configuration exported:",
    frontendConfigPath,
  );

  // Keep a separate deployment record per network.
  const deploymentsDir = path.resolve(
    __dirname,
    "../deployments",
  );

  fs.mkdirSync(deploymentsDir, { recursive: true });

  const deploymentRecordPath = path.join(
    deploymentsDir,
    `${chainId}.json`,
  );

  fs.writeFileSync(
    deploymentRecordPath,
    JSON.stringify(deployment, null, 2),
    "utf8",
  );

  console.log(
    "Deployment record:",
    deploymentRecordPath,
  );

  console.log("\n========================================");
  console.log("CHAINSTOCK READY FOR FRONTEND INTEGRATION");
  console.log("========================================\n");
}

main().catch((error) => {
  console.error("\nDeployment failed:");
  console.error(error);
  process.exitCode = 1;
});
