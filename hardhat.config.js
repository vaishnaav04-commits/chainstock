
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const {
  SEPOLIA_RPC_URL = "",
  PRIVATE_KEY = "",
  ETHERSCAN_API_KEY = "",
} = process.env;

// Only enable Sepolia when both the RPC endpoint
// and a valid deployment private key are available.
const sepoliaReady =
  SEPOLIA_RPC_URL.startsWith("https://") &&
  /^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY);

const networks = {
  // Hardhat's in-memory testing environment.
  hardhat: {
    chainId: 31337,
  },

  // Persistent local node started using npm run node.
  localhost: {
    url: "http://127.0.0.1:8545",
    chainId: 31337,
  },
};

if (sepoliaReady) {
  networks.sepolia = {
    url: SEPOLIA_RPC_URL,
    accounts: [PRIVATE_KEY],
    chainId: 11155111,
    timeout: 60000,
  };
}

module.exports = {
    solidity: {
  version: "0.8.24",
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    viaIR: true,
  },
},

  networks,

  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  mocha: {
    timeout: 60000,
  },
};
