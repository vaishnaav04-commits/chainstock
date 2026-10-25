
import { useState } from "react";

import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  Boxes,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Moon,
  QrCode,
  Settings2,
  ShieldCheck,
  Sun,
  Wallet,
  Warehouse,
  X,
} from "lucide-react";

import {
  NavLink,
  Outlet,
  useLocation,
} from "react-router-dom";

import { motion, AnimatePresence } from "framer-motion";

import { useWallet } from "../../contexts/WalletContext";
import { useTheme } from "../../contexts/ThemeContext";

import {
  CHAIN,
  shortAddress,
} from "../../services/blockchain";

const NAV = [
  {
    label: "Workspace",
    items: [
      { name: "Overview", to: "/", icon: LayoutDashboard },
      { name: "Inventory", to: "/inventory", icon: Boxes },
      { name: "Register Item", to: "/register", icon: ClipboardList, write: true, manager: true },
      { name: "QR Scanner", to: "/scan", icon: QrCode, write: true },
      { name: "Transactions", to: "/transactions", icon: ArrowRightLeft },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { name: "Zone Map", to: "/zones", icon: Warehouse },
      { name: "Analytics", to: "/analytics", icon: BarChart3 },
      { name: "Alerts", to: "/alerts", icon: AlertTriangle },
      { name: "Verification", to: "/verify", icon: ShieldCheck },
    ],
  },
  {
    label: "System",
    items: [
      { name: "Admin Console", to: "/admin", icon: Settings2, admin: true },
    ],
  },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400 text-slate-950 shadow-glow">
        <Boxes size={23} strokeWidth={2.5} />
      </div>
      <div>
        <div className="text-xl font-extrabold tracking-tight">
          Chain<span className="text-teal-400">Stock</span>
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.19em] text-slate-400">
          Warehouse Intelligence
        </div>
      </div>
    </div>
  );
}

function SidebarContent({ close }) {
  const { address, roles, role } = useWallet();

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-7">
        <Logo />
      </div>

      <div className="mx-5 mb-5 rounded-xl border border-teal-400/20 bg-teal-400/5 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-teal-400">
          <Activity size={15} /> Blockchain Workspace
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {CHAIN.name} · Chain {CHAIN.id}
        </p>
      </div>

      <nav aria-label="Main navigation" className="flex-1 space-y-6 overflow-y-auto px-4">
        {NAV.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (item.admin) return roles.ADMIN;
            if (item.manager) {
              return roles.ADMIN || roles.MANAGER;
            }
            if (item.write) {
              return roles.ADMIN ||
                roles.MANAGER ||
                roles.OPERATOR;
            }
            return true;
          });

          if (!visibleItems.length) return null;

          return (
            <div key={group.label}>
              <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                {group.label}
              </div>

              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      onClick={close}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                          isActive
                            ? "bg-teal-400/10 text-teal-400"
                            : "text-slate-400 hover:bg-white/5 hover:text-white"
                        }`
                      }
                    >
                      <Icon size={18} />
                      <span className="flex-1">{item.name}</span>
                      <ChevronRight size={14} className="opacity-40" />
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300">
            <ShieldCheck size={15} className="text-teal-400" />
            On-chain identity
          </div>
          <p className="font-mono text-xs text-slate-400">
            {shortAddress(address)}
          </p>
          <div className="mt-3 inline-flex rounded-md bg-teal-400/10 px-2 py-1 text-[11px] font-bold text-teal-400">
            {role}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const location = useLocation();

  const {
    address,
    role,
    correctNetwork,
    connect,
    connecting,
    switchNetwork,
    error,
  } = useWallet();

  const { theme, toggleTheme } = useTheme();

  const pathLabel =
    NAV.flatMap((group) => group.items)
      .find((item) => item.to === location.pathname)?.name ||
    "ChainStock";

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/10 bg-[#0c1728] text-white lg:block">
        <SidebarContent close={() => {}} />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              aria-label="Close navigation overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-[#0c1728] text-white lg:hidden"
            >
              <button
                aria-label="Close sidebar"
                onClick={() => setMobileOpen(false)}
                className="absolute right-4 top-7 rounded-lg p-2 text-white"
              >
                <X size={20} />
              </button>
              <SidebarContent close={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1423]/90 sm:px-8">
          <div className="flex items-center gap-4">
            <button
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 lg:hidden"
            >
              <Menu size={22} />
            </button>

            <div>
              <div className="text-xs muted">Workspace / {pathLabel}</div>
              <h1 className="text-lg font-bold">{pathLabel}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-white/10 sm:flex">
              <span className={`h-2 w-2 rounded-full ${
                correctNetwork ? "bg-teal-400" : "bg-amber-400"
              }`} />
              {correctNetwork ? CHAIN.name : "Network check"}
            </div>

            <button
              aria-label="Toggle dark mode"
              title="Toggle theme"
              onClick={toggleTheme}
              className="btn-secondary !p-2.5"
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {!address ? (
              <button
                className="btn-primary"
                onClick={connect}
                disabled={connecting}
              >
                <Wallet size={16} />
                <span className="hidden sm:inline">
                  {connecting ? "Connecting..." : "Connect Wallet"}
                </span>
                <span className="sm:hidden">Connect</span>
              </button>
            ) : (
              <div className="rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10">
                <div className="font-mono text-xs font-bold">
                  {shortAddress(address)}
                </div>
                <div className="text-[10px] text-teal-500">{role}</div>
              </div>
            )}
          </div>
        </header>

        {address && !correctNetwork && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm sm:px-8">
            <span className="flex items-center gap-2 text-amber-600 dark:text-amber-300">
              <AlertTriangle size={17} />
              Wrong blockchain network selected.
            </span>
            <button onClick={switchNetwork} className="btn-secondary">
              Switch to {CHAIN.name}
            </button>
          </div>
        )}

        {error && (
          <div role="alert" className="border-b border-amber-500/20 px-4 py-2 text-xs text-amber-600 dark:text-amber-300 sm:px-8">
            {error}
          </div>
        )}

        <main className="mx-auto max-w-[1550px] p-4 sm:p-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </main>

        <footer className="px-4 pb-8 text-center text-xs muted sm:px-8">
          ChainStock · Blockchain Inventory Intelligence · Development v1.0
        </footer>
      </div>
    </div>
  );
}
