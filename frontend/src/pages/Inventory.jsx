
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowRight,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Database,
  Filter,
  Loader2,
  PackageSearch,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

import { Link } from "react-router-dom";

import {
  explainError,
  formatStatus,
  getReadContract,
} from "../services/blockchain";

const PAGE_SIZE = 8;

const STATUS_OPTIONS = [
  "Received",
  "Stored",
  "Picked",
  "InTransit",
  "Shipped",
  "Delivered",
  "Damaged",
  "Returned",
];

function statusColor(status) {
  const colors = {
    Received: "bg-sky-500/10 text-sky-500",
    Stored: "bg-teal-500/10 text-teal-500",
    Picked: "bg-violet-500/10 text-violet-500",
    InTransit: "bg-amber-500/10 text-amber-500",
    Shipped: "bg-indigo-500/10 text-indigo-500",
    Delivered: "bg-emerald-500/10 text-emerald-500",
    Damaged: "bg-rose-500/10 text-rose-500",
    Returned: "bg-orange-500/10 text-orange-500",
  };

  return colors[status] || "bg-slate-500/10 text-slate-500";
}

const inputStyle =
  "rounded-xl border border-slate-200 bg-white " +
  "px-4 py-3 text-sm outline-none " +
  "focus:border-teal-500 dark:border-white/10 " +
  "dark:bg-[#111c2e] dark:text-white";

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [zones, setZones] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [zone, setZone] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const contract = getReadContract();

      const [ids, zoneNames] = await Promise.all([
        contract.getAllItemIds(),
        contract.getZones(),
      ]);

      // Suitable for the small review dataset.
      // Production deployments should use an indexer.
      const records = await Promise.all(
        ids.map((id) => contract.getItem(id)),
      );

      const mapped = records.map((item) => ({
        itemId: item.itemId,
        name: item.name,
        category: item.category,
        sku: item.sku,
        quantity: item.quantity.toString(),
        unit: item.unit,
        zone: item.currentZone,
        status: formatStatus(item.status),
        statusValue: Number(item.status),
        createdAt: Number(item.createdAt),
        updatedAt: Number(item.updatedAt),
      }));

      setItems(mapped);
      setZones(zoneNames);
    } catch (err) {
      setError(explainError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();

    let contract;

    try {
      contract = getReadContract();

      const onUpdate = () => {
        loadInventory();
      };

      contract.on("ItemRegistered", onUpdate);
      contract.on("MovementLogged", onUpdate);

      return () => {
        contract.off("ItemRegistered", onUpdate);
        contract.off("MovementLogged", onUpdate);
      };
    } catch {
      return undefined;
    }
  }, [loadInventory]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = items.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.itemId,
          item.name,
          item.sku,
          item.category,
        ].some((value) =>
          value.toLowerCase().includes(query),
        );

      const matchesZone =
        zone === "all" || item.zone === zone;

      const matchesStatus =
        status === "all" || item.status === status;

      return matchesSearch && matchesZone && matchesStatus;
    });

    result.sort((a, b) => {
      if (sort === "oldest") {
        return a.createdAt - b.createdAt;
      }

      if (sort === "name") {
        return a.name.localeCompare(b.name);
      }

      if (sort === "sku") {
        return a.sku.localeCompare(b.sku);
      }

      if (sort === "quantity") {
        const left = BigInt(a.quantity);
        const right = BigInt(b.quantity);
        return left === right ? 0 : left > right ? -1 : 1;
      }

      return b.createdAt - a.createdAt;
    });

    return result;
  }, [items, search, zone, status, sort]);

  useEffect(() => {
    setPage(1);
  }, [search, zone, status, sort]);

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE),
  );

  const currentPage = Math.min(page, totalPages);

  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const statusTotals = {
    stored: items.filter((i) => i.status === "Stored").length,
    transit: items.filter((i) => i.status === "InTransit").length,
    damaged: items.filter((i) => i.status === "Damaged").length,
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Inventory Intelligence</p>

          <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
            Inventory Explorer
          </h2>

          <p className="mt-2 text-sm muted">
            Browse and inspect warehouse assets directly
            from the blockchain.
          </p>
        </div>

        <button
          onClick={loadInventory}
          disabled={loading}
          className="btn-secondary"
        >
          <RefreshCw
            size={17}
            className={loading ? "animate-spin" : ""}
          />
          Refresh Inventory
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: "Total Items", value: items.length },
          { label: "Stored", value: statusTotals.stored },
          { label: "In Transit", value: statusTotals.transit },
          { label: "Damaged", value: statusTotals.damaged },
        ].map((metric) => (
          <div key={metric.label} className="panel p-5">
            <p className="text-xs font-semibold muted">
              {metric.label}
            </p>

            <p className="mt-3 text-3xl font-extrabold">
              {loading ? "—" : metric.value}
            </p>
          </div>
        ))}
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-200 p-5 dark:border-white/10">
          <div className="mb-5 flex items-center gap-2">
            <Filter size={18} className="text-teal-500" />
            <h3 className="font-bold">Search & Filter</h3>
          </div>

          <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr]">
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-3.5 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ID, product, SKU..."
                aria-label="Search inventory"
                className={`${inputStyle} w-full pl-10`}
              />
            </div>

            <select
              className={inputStyle}
              aria-label="Filter by warehouse zone"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
            >
              <option value="all">All Zones</option>
              {zones.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <select
              className={inputStyle}
              aria-label="Filter by item status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <select
              className={inputStyle}
              aria-label="Sort inventory"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Product Name</option>
              <option value="sku">SKU</option>
              <option value="quantity">Highest Quantity</option>
            </select>
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="p-8 text-sm text-rose-500"
          >
            <AlertTriangleMessage message={error} />
          </div>
        ) : loading ? (
          <div className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-sm muted">
              <Loader2 size={17} className="animate-spin" />
              Reading inventory from blockchain...
            </div>

            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="skeleton h-14" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <PackageSearch
              size={42}
              className="mx-auto text-slate-400"
            />

            <h3 className="mt-4 text-lg font-bold">
              {items.length === 0
                ? "Your warehouse is empty"
                : "No matching inventory"}
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-sm muted">
              {items.length === 0
                ? "Register your first warehouse pallet to start tracking its journey."
                : "Try changing your search term or filters."}
            </p>

            {items.length === 0 ? (
              <Link
                to="/register"
                className="btn-primary mt-5"
              >
                Register Inventory
                <ArrowRight size={16} />
              </Link>
            ) : (
              <button
                className="btn-secondary mt-5"
                onClick={() => {
                  setSearch("");
                  setZone("all");
                  setStatus("all");
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-white/5">
                  <tr>
                    <th className="px-5 py-4">Item ID</th>
                    <th className="px-5 py-4">Product</th>
                    <th className="px-5 py-4">SKU</th>
                    <th className="px-5 py-4">Quantity</th>
                    <th className="px-5 py-4">Zone</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {paginated.map((item) => (
                    <tr
                      key={item.itemId}
                      className="transition hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      <td className="px-5 py-4">
                        <Link
                          to={`/inventory/${encodeURIComponent(item.itemId)}`}
                          className="font-mono font-bold text-teal-600 hover:underline dark:text-teal-400"
                        >
                          {item.itemId}
                        </Link>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold">{item.name}</p>
                        <p className="mt-1 text-xs muted">
                          {item.category}
                        </p>
                      </td>

                      <td className="px-5 py-4 font-mono text-xs">
                        {item.sku}
                      </td>

                      <td className="px-5 py-4">
                        {item.quantity} {item.unit}
                      </td>

                      <td className="px-5 py-4">
                        {item.zone}
                      </td>

                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <Link
                          to={`/inventory/${encodeURIComponent(item.itemId)}`}
                          className="inline-flex items-center gap-1 font-semibold text-teal-500 hover:underline"
                        >
                          View History
                          <ArrowRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-5 dark:border-white/10">
              <p className="text-xs muted">
                Showing{" "}
                {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(
                  currentPage * PAGE_SIZE,
                  filtered.length,
                )}{" "}
                of {filtered.length} items
              </p>

              <div className="flex items-center gap-2">
                <button
                  className="btn-secondary !p-2"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={18} />
                </button>

                <span className="px-2 text-xs font-semibold">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  className="btn-secondary !p-2"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-teal-500/20 bg-teal-500/5 p-4">
        <ShieldCheck
          size={21}
          className="shrink-0 text-teal-500"
        />

        <div>
          <p className="text-sm font-semibold">
            Blockchain is the source of truth
          </p>
          <p className="mt-1 text-xs leading-5 muted">
            These records come from WarehouseLedger, not an
            editable inventory spreadsheet. Search and
            pagination are performed in the browser for
            this small development dataset.
          </p>
        </div>
      </div>
    </div>
  );
}

function AlertTriangleMessage({ message }) {
  return (
    <div className="flex items-start gap-3">
      <Database size={20} className="shrink-0" />
      <div>
        <p className="font-bold">Inventory unavailable</p>
        <p className="mt-2">{message}</p>
        <p className="mt-2 text-xs">
          Check the Hardhat node and contract deployment.
        </p>
      </div>
    </div>
  );
}
