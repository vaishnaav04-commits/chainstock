
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Hash,
  Loader2,
  PackagePlus,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import {
  keccak256,
  toUtf8Bytes,
} from "ethers";
import toast from "react-hot-toast";

import QRLabel from "../components/inventory/QRLabel";
import { useWallet } from "../contexts/WalletContext";
import {
  CHAIN,
  explainError,
  getReadContract,
  getWriteContract,
} from "../services/blockchain";

// Candidate IDs use random UUID bytes.
// The blockchain still makes the final uniqueness check.
function generateItemId() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error(
      "Secure random ID generation is not available.",
    );
  }

  const randomPart = crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 12)
    .toUpperCase();

  return `PLT-${randomPart}`;
}

const EMPTY_FORM = {
  itemId: "",
  name: "",
  category: "Electronics",
  sku: "",
  quantity: "1",
  unit: "pieces",
  zone: "Receiving",
  description: "",
};

const CATEGORIES = [
  "Electronics",
  "Mechanical Parts",
  "Automotive",
  "Food & Beverages",
  "Pharmaceuticals",
  "Textiles",
  "Raw Materials",
  "Consumer Goods",
  "Other",
];

const UNITS = [
  "pieces",
  "boxes",
  "cartons",
  "kg",
  "litres",
  "sets",
  "pallets",
];

function Field({
  label,
  hint,
  children,
  required,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">
        {label}
        {required && (
          <span className="ml-1 text-rose-500">*</span>
        )}
      </span>

      {children}

      {hint && (
        <span className="mt-1.5 block text-xs muted">
          {hint}
        </span>
      )}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 " +
  "px-4 py-3 text-sm text-slate-900 outline-none transition " +
  "placeholder:text-slate-400 focus:border-teal-500 " +
  "dark:border-white/10 dark:bg-white/5 dark:text-white";

function validateForm(form, zones) {
  const itemId = form.itemId.trim();
  const name = form.name.trim();
  const category = form.category.trim();
  const sku = form.sku.trim();
  const unit = form.unit.trim();
  const zone = form.zone.trim();
  const description = form.description.trim();

  if (!/^[A-Za-z0-9_-]{3,64}$/.test(itemId)) {
    return "Item ID must contain 3–64 letters, digits, underscores or hyphens.";
  }

  if (!name || new TextEncoder().encode(name).length > 128) {
    return "Product name must be 1–128 bytes.";
  }

  if (
    !category ||
    new TextEncoder().encode(category).length > 64
  ) {
    return "Choose a valid product category.";
  }

  if (
    !sku ||
    new TextEncoder().encode(sku).length > 64
  ) {
    return "SKU is required and must be 64 bytes or fewer.";
  }

  if (
    !unit ||
    new TextEncoder().encode(unit).length > 32
  ) {
    return "Select a valid quantity unit.";
  }

  if (!/^[1-9][0-9]*$/.test(form.quantity)) {
    return "Quantity must be a positive whole number.";
  }

  const quantity = BigInt(form.quantity);

  if (quantity > BigInt(Number.MAX_SAFE_INTEGER)) {
    return "Quantity is too large for this interface.";
  }

  if (!zones.some((entry) => entry.name === zone && entry.active)) {
    return "Select an active warehouse zone.";
  }

  if (new TextEncoder().encode(description).length > 500) {
    return "Description cannot exceed 500 bytes.";
  }

  return "";
}

function readableContractError(error) {
  const revertName =
    error?.revert?.name ||
    error?.info?.error?.data?.name ||
    "";

  if (revertName === "ItemAlreadyExists") {
    return "This item ID is already registered. Generate a new ID.";
  }

  if (revertName === "AccessControlUnauthorizedAccount" ||
      revertName === "UnauthorizedActor") {
    return "This wallet is not authorized to register items.";
  }

  if (revertName === "EnforcedPause") {
    return "Warehouse transactions are paused by the admin.";
  }

  const raw = String(
    error?.shortMessage || error?.message || "",
  );

  if (/ItemAlreadyExists/.test(raw)) {
    return "That item ID is already registered.";
  }

  if (/EnforcedPause/.test(raw)) {
    return "ChainStock is currently paused.";
  }

  if (/UnknownZone|InactiveZone/.test(raw)) {
    return "The selected warehouse zone is unavailable.";
  }

  return explainError(error);
}

export default function RegisterItem() {
  const {
    address,
    roles,
    correctNetwork,
    refresh,
  } = useWallet();

  const [form, setForm] = useState(EMPTY_FORM);
  const [zones, setZones] = useState([]);
  const [loadingZones, setLoadingZones] = useState(true);
  const [zoneError, setZoneError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(null);

  const canRegister =
    Boolean(address) &&
    correctNetwork &&
    (roles.ADMIN || roles.MANAGER);

  useEffect(() => {
    try {
      setForm((previous) => ({
        ...previous,
        itemId: generateItemId(),
      }));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadZones() {
      setLoadingZones(true);
      setZoneError("");

      try {
        const contract = getReadContract();
        const names = await contract.getZones();

        const zoneList = await Promise.all(
          names.map(async (name) => ({
            name,
            active: await contract.zoneActive(
              keccak256(toUtf8Bytes(name)),
            ),
          })),
        );

        if (!cancelled) {
          setZones(zoneList);

          setForm((previous) => {
            const currentIsActive = zoneList.some(
              (z) => z.name === previous.zone && z.active,
            );

            return {
              ...previous,
              zone: currentIsActive
                ? previous.zone
                : zoneList.find((z) => z.active)?.name || "",
            };
          });
        }
      } catch (err) {
        if (!cancelled) {
          setZoneError(explainError(err));
        }
      } finally {
        if (!cancelled) {
          setLoadingZones(false);
        }
      }
    }

    loadZones();

    return () => {
      cancelled = true;
    };
  }, []);

  function update(name, value) {
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
    setError("");
  }

  function regenerateId() {
    if (submitting) return;

    try {
      update("itemId", generateItemId());
    } catch (err) {
      setError(err.message);
    }
  }

  async function registerItem(event) {
    event.preventDefault();

    if (submitting) return;

    setError("");

    if (!canRegister) {
      setError(
        "Connect a manager/admin wallet on ChainStock Local.",
      );
      return;
    }

    const validationError = validateForm(form, zones);

    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    const clean = {
      itemId: form.itemId.trim(),
      name: form.name.trim(),
      category: form.category.trim(),
      sku: form.sku.trim(),
      quantity: form.quantity,
      unit: form.unit.trim(),
      zone: form.zone.trim(),
      description: form.description.trim(),
    };

    setSubmitting(true);
    setConfirmed(null);

    try {
      setPhase("Checking the blockchain...");

      const readContract = getReadContract();
      const duplicateIds = await readContract.getAllItemIds();

      if (duplicateIds.includes(clean.itemId)) {
        throw new Error(
          "This item ID already exists. Generate a new ID.",
        );
      }

      const contract = await getWriteContract();

      // We hash a normalized metadata object rather than
      // putting the potentially sensitive description on-chain.
      const metadata = JSON.stringify({
        itemId: clean.itemId,
        name: clean.name,
        category: clean.category,
        sku: clean.sku,
        quantity: clean.quantity,
        unit: clean.unit,
        description: clean.description,
      });

      const metadataHash = keccak256(
        toUtf8Bytes(metadata),
      );

      const args = [
        clean.itemId,
        clean.name,
        clean.category,
        clean.sku,
        BigInt(clean.quantity),
        clean.unit,
        clean.zone,
        metadataHash,
      ];

      // Simulate before asking the user to pay gas.
      // Hardhat rejects duplicate IDs and invalid inputs.
      await contract.registerItem.staticCall(...args);

      setPhase("Waiting for MetaMask approval...");

      const tx = await contract.registerItem(...args);

      toast.success("Transaction submitted.");
      setPhase("Waiting for blockchain confirmation...");

      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        throw new Error(
          "The transaction was not confirmed successfully.",
        );
      }

      // Read back from the chain: don't trust the form alone.
      const saved = await readContract.getItem(
        clean.itemId,
      );

      if (!saved.exists) {
        throw new Error(
          "Transaction confirmed but item lookup failed.",
        );
      }

      setConfirmed({
        item: {
          itemId: saved.itemId,
          name: saved.name,
          sku: saved.sku,
          category: saved.category,
          quantity: saved.quantity.toString(),
          unit: saved.unit,
          zone: saved.currentZone,
          status: Number(saved.status),
        },
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      setPhase("Registered successfully.");
      toast.success("Item registered on blockchain!");

      await refresh();
    } catch (err) {
      const message = readableContractError(err);

      setError(message);
      setPhase("");
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function newRegistration() {
    let id = "";

    try {
      id = generateItemId();
    } catch (err) {
      setError(err.message);
      return;
    }

    setForm({
      ...EMPTY_FORM,
      itemId: id,
      zone: zones.find((z) => z.active)?.name || "",
    });

    setConfirmed(null);
    setError("");
    setPhase("");
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow">Inventory Operations</p>
        <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
          Register New Inventory
        </h2>
        <p className="mt-2 text-sm muted">
          Create a blockchain-backed identity for each pallet
          or box in your warehouse.
        </p>
      </div>

      {confirmed ? (
        <div className="space-y-5">
          <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2
                size={32}
                className="text-teal-500"
              />

              <div>
                <h3 className="font-bold">
                  Inventory registration successful
                </h3>
                <p className="mt-1 text-xs muted">
                  Confirmed in block {confirmed.blockNumber}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={newRegistration}
              className="btn-primary"
            >
              <PackagePlus size={17} />
              Register Another Item
            </button>
          </div>

          <QRLabel
            item={confirmed.item}
            txHash={confirmed.txHash}
          />
        </div>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[1.55fr_1fr]">
          <form
            onSubmit={registerItem}
            className="panel space-y-7 p-5 sm:p-7"
          >
            <div className="flex items-center gap-3 border-b border-slate-200 pb-5 dark:border-white/10">
              <div className="rounded-xl bg-teal-500/10 p-3 text-teal-500">
                <PackagePlus size={23} />
              </div>

              <div>
                <h3 className="text-lg font-bold">
                  Asset Information
                </h3>
                <p className="text-xs muted">
                  Fields marked * are required.
                </p>
              </div>
            </div>

            <Field
              label="Unique Item ID"
              hint="Automatically generated. You can also enter PALLET001."
              required
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash
                    size={17}
                    className="absolute left-3 top-3.5 text-slate-400"
                  />

                  <input
                    className={`${inputClass} pl-10 font-mono`}
                    value={form.itemId}
                    onChange={(e) =>
                      update(
                        "itemId",
                        e.target.value.toUpperCase(),
                      )
                    }
                    maxLength={64}
                    placeholder="PLT-A1B2C3D4"
                    disabled={submitting}
                    required
                  />
                </div>

                <button
                  type="button"
                  title="Generate new ID"
                  aria-label="Generate new item ID"
                  className="btn-secondary"
                  onClick={regenerateId}
                  disabled={submitting}
                >
                  <RefreshCw size={17} />
                </button>
              </div>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Product Name" required>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) =>
                    update("name", e.target.value)
                  }
                  maxLength={128}
                  placeholder="Industrial Bearings"
                  disabled={submitting}
                  required
                />
              </Field>

              <Field label="SKU" required>
                <input
                  className={inputClass}
                  value={form.sku}
                  onChange={(e) =>
                    update(
                      "sku",
                      e.target.value.toUpperCase(),
                    )
                  }
                  maxLength={64}
                  placeholder="BRG-001"
                  disabled={submitting}
                  required
                />
              </Field>

              <Field label="Category" required>
                <select
                  className={inputClass}
                  value={form.category}
                  onChange={(e) =>
                    update("category", e.target.value)
                  }
                  disabled={submitting}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Initial Warehouse Zone" required>
                <select
                  className={inputClass}
                  value={form.zone}
                  onChange={(e) =>
                    update("zone", e.target.value)
                  }
                  disabled={submitting || loadingZones}
                  required
                >
                  <option value="">
                    {loadingZones
                      ? "Loading zones..."
                      : "Select zone"}
                  </option>

                  {zones
                    .filter((zone) => zone.active)
                    .map((zone) => (
                      <option
                        key={zone.name}
                        value={zone.name}
                      >
                        {zone.name}
                      </option>
                    ))}
                </select>

                {zoneError && (
                  <p className="mt-2 text-xs text-rose-500">
                    {zoneError}
                  </p>
                )}
              </Field>

              <Field label="Quantity" required>
                <input
                  className={inputClass}
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={(e) =>
                    update("quantity", e.target.value)
                  }
                  disabled={submitting}
                  required
                />
              </Field>

              <Field label="Unit" required>
                <select
                  className={inputClass}
                  value={form.unit}
                  onChange={(e) =>
                    update("unit", e.target.value)
                  }
                  disabled={submitting}
                >
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field
              label="Product Description"
              hint="Optional. Only its hash is included in on-chain metadata."
            >
              <textarea
                className={`${inputClass} min-h-[100px] resize-y`}
                value={form.description}
                onChange={(e) =>
                  update("description", e.target.value)
                }
                maxLength={500}
                placeholder="Specifications, batch reference, or inspection notes"
                disabled={submitting}
              />
            </Field>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-500"
              >
                <AlertCircle size={19} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {phase && (
              <div
                role="status"
                className="flex items-center gap-3 rounded-xl bg-teal-500/10 p-4 text-sm text-teal-500"
              >
                {submitting
                  ? <Loader2 size={18} className="animate-spin" />
                  : <CheckCircle2 size={18} />}

                <span>{phase}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={
                submitting ||
                !canRegister ||
                loadingZones ||
                Boolean(zoneError)
              }
              className="btn-primary w-full py-3.5 text-base"
            >
              {submitting ? (
                <>
                  <Loader2
                    size={19}
                    className="animate-spin"
                  />
                  Processing Transaction...
                </>
              ) : (
                <>
                  <Wallet size={19} />
                  Register on Blockchain
                  <ArrowRight size={17} />
                </>
              )}
            </button>

            {!canRegister && (
              <p className="text-center text-xs text-amber-500">
                Connect an authorized ADMIN or MANAGER
                wallet on {CHAIN.name}.
              </p>
            )}
          </form>

          <div className="space-y-5">
            <div className="panel p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-teal-500/10 p-3 text-teal-500">
                  <ShieldCheck size={23} />
                </div>

                <div>
                  <h3 className="font-bold">
                    Blockchain Registration
                  </h3>
                  <p className="text-xs muted">
                    Immutable inventory origin record
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="muted">Network</span>
                  <span className="font-semibold">
                    {CHAIN.name}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="muted">Chain ID</span>
                  <span className="font-mono">
                    {CHAIN.id}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="muted">Initial status</span>
                  <span className="font-semibold text-teal-500">
                    Received
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="muted">QR generation</span>
                  <span className="font-semibold">
                    After confirmation
                  </span>
                </div>
              </div>
            </div>

            <div className="panel p-6">
              <h3 className="flex items-center gap-2 font-bold">
                <CheckCircle2 size={19} className="text-teal-500" />
                How registration works
              </h3>

              <div className="mt-5 space-y-5">
                {[
                  "Enter the asset's identity and inventory information.",
                  "Review and approve the transaction in MetaMask.",
                  "The Solidity contract validates and stores the asset.",
                  "Print the QR and attach it to the pallet or box.",
                ].map((text, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-xs font-bold text-teal-500">
                      {index + 1}
                    </span>

                    <p className="text-sm leading-6 muted">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-600 dark:text-amber-300">
              <strong>Inventory model:</strong> Each QR represents
              an entire pallet or box. Its quantity cannot be
              partially changed through the current movement
              contract.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
