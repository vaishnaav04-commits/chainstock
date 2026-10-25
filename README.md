<WritingBlock id="58321" variant="document"># ChainStock
QR-Triggered Blockchain Ledger for Warehouse Inventory Tracking
ChainStock is a blockchain-based warehouse inventory management system that combines QR code technology, Ethereum-compatible smart contracts, and a React web application to improve inventory traceability and transparency.
Features
- Warehouse inventory registration
- QR code generation and scanning
- Blockchain-based inventory movements
- Role-based access control
- Inventory history and tracking
- Warehouse zone visualization
- Analytics dashboard and alerts
- Blockchain record verification
- Tamper detection demonstration
- Administrative controls
- CSV and PDF reporting
Technology Stack
Layer	Technology
Frontend	React, Vite, Tailwind CSS
Blockchain	Solidity, Hardhat
Smart Contract Library	OpenZeppelin
Wallet Integration	MetaMask
Blockchain Interaction	ethers.js
QR Scanning	html5-qrcode
Analytics	Recharts

Running the Project Locally
1. Install dependencies

From the project root:
ChainStock
QR-Triggered Blockchain Ledger for Warehouse Inventory Tracking
ChainStock is a blockchain-based warehouse inventory management system that combines QR code technology, Ethereum-compatible smart contracts, and a React web application to improve inventory traceability and transparency.
Features
- Warehouse inventory registration
- QR code generation and scanning
- Blockchain-based inventory movements
- Role-based access control
- Inventory history and tracking
- Warehouse zone visualization
- Analytics dashboard and alerts
- Blockchain record verification
- Tamper detection demonstration
- Administrative controls
- CSV and PDF reporting
Technology Stack
Layer	Technology
Frontend	React, Vite, Tailwind CSS
Blockchain	Solidity, Hardhat
Smart Contract Library	OpenZeppelin
Wallet Integration	MetaMask
Blockchain Interaction	ethers.js
QR Scanning	html5-qrcode
Analytics	RechartsRunning the Project Locally
1. Install dependencies

From the project root:
npm install
cd frontend
npm install
2. Start the local blockchain

From the project root:
npx hardhat node
**3. Deploy




2. Start the local blockchain

From the project root:
npx hardhat node


3. Deploy the smart contract

In another terminal:
npx hardhat run scripts/deploy.js --network localhost


4. Start the frontend
cd frontend
npm run dev


Open http://127.0.0.1:5173 and connect MetaMask to the local Hardhat blockchain (chain ID 31337).
Project Architecture
React frontend → ethers.js / MetaMask → Hardhat RPC → WarehouseLedger Solidity smart contract.
Project Scope
This project currently uses a local Hardhat development blockchain. It demonstrates on-chain inventory registration, movement tracking, access control, and record verification in a controlled development environment.
Future Enhancements
- Deployment to Ethereum testnets
- Integration with real warehouse management systems
- Multi-warehouse support
- Predictive inventory analytics
- Production-grade identity and access management
