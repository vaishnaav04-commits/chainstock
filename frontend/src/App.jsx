
import Admin from "./pages/Admin";
import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import AppLayout from "./components/layout/AppLayout";

import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import ItemDetail from "./pages/ItemDetail";
import RegisterItem from "./pages/RegisterItem";
import Scanner from "./pages/Scanner";
import TransactionCenter from "./pages/TransactionCenter";
import ZoneMap from "./pages/ZoneMap";
import Analytics from "./pages/Analytics";
import Alerts from "./pages/Alerts";

import Verify from "./pages/Verify";
import TamperDemo from "./pages/TamperDemo";

import Placeholder from "./pages/Placeholder";

import { useWallet } from "./contexts/WalletContext";

function ProtectedPage({ children, permission }) {
  const {
    address,
    roles,
    correctNetwork,
    loading,
  } = useWallet();

  if (loading) {
    return (
      <div className="panel p-8">
        <div className="skeleton h-6 w-48" />
        <div className="skeleton mt-5 h-4 w-full" />
        <div className="skeleton mt-3 h-4 w-2/3" />
      </div>
    );
  }

  if (!address || !correctNetwork) {
    return (
      <Placeholder
        title="Connect an authorized wallet"
        description="Connect MetaMask and select the ChainStock blockchain to access this operation."
        restricted
      />
    );
  }

  const allowed =
    permission === "admin"
      ? roles.ADMIN
      : permission === "manager"
        ? roles.ADMIN || roles.MANAGER
        : roles.ADMIN ||
          roles.MANAGER ||
          roles.OPERATOR;

  if (!allowed) {
    return (
      <Placeholder
        title="Insufficient permissions"
        description="Your wallet lacks the required on-chain warehouse role."
        restricted
      />
    );
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public routes: no wallet required */}
      <Route path="/verify" element={<Verify />} />
      <Route path="/verify/:itemId" element={<Verify />} />
      <Route path="/tamper-demo" element={<TamperDemo />} />

      {/* Main warehouse application */}
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />

        <Route path="inventory" element={<Inventory />} />
        <Route
          path="inventory/:itemId"
          element={<ItemDetail />}
        />

        <Route
          path="register"
          element={
            <ProtectedPage permission="manager">
              <RegisterItem />
            </ProtectedPage>
          }
        />

        <Route
          path="scan"
          element={
            <ProtectedPage permission="operator">
              <Scanner />
            </ProtectedPage>
          }
        />

        <Route
          path="transactions"
          element={<TransactionCenter />}
        />

        <Route path="zones" element={<ZoneMap />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="alerts" element={<Alerts />} />

        
<Route
  path="admin"
  element={
    <ProtectedPage permission="admin">
      <Admin />
    </ProtectedPage>
  }
/>


        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Route>
    </Routes>
  );
}
