
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ImagePlus,
  Keyboard,
  Layers,
  Loader2,
  PackageCheck,
  Play,
  Plus,
  QrCode,
  ShieldCheck,
  Square,
  Trash2,
  Wallet,
} from "lucide-react";

import toast from "react-hot-toast";

import {
  CHAIN,
  explainError,
  formatStatus,
  getReadContract,
  getWriteContract,
} from "../services/blockchain";

import { useWallet } from "../contexts/WalletContext";
import { useTransactions } from "../contexts/TransactionContext";

const STATUSES = [
  "Received",
  "Stored",
  "Picked",
  "InTransit",
  "Shipped",
  "Delivered",
  "Damaged",
  "Returned",
];

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white " +
  "px-4 py-3 text-sm text-slate-900 outline-none " +
  "focus:border-teal-500 dark:border-white/10 " +
  "dark:bg-[#17243a] dark:text-white";

const STATUS_COLORS = {
  Received: "text-sky-500",
  Stored: "text-teal-500",
  Picked: "text-violet-500",
  InTransit: "text-amber-500",
  Shipped: "text-indigo-500",
  Delivered: "text-emerald-500",
  Damaged: "text-rose-500",
  Returned: "text-orange-500",
};

// Phase 5 QR labels contain only the item ID.
function parseQR(text) {
  const value = String(text || "").trim();

  if (!/^[A-Za-z0-9_-]{3,64}$/.test(value)) {
    throw new Error(
      "Invalid ChainStock QR. Expected an item ID such as PALLET001.",
    );
  }

  return value;
}

function ItemRow({ item, remove, disabled }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <div className="rounded-lg bg-teal-500/10 p-2 text-teal-500">
        <QrCode size={20} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-sm font-bold">
          {item.itemId}
        </p>
        <p className="truncate text-xs muted">
          {item.name} · {item.quantity} {item.unit}
        </p>
        <p className="mt-1 text-xs muted">
          {item.currentZone} /{" "}
          <span className={STATUS_COLORS[item.status] || ""}>
            {item.status}
          </span>
        </p>
      </div>

      <button
        type="button"
        aria-label={`Remove ${item.itemId}`}
        disabled={disabled}
        onClick={() => remove(item.itemId)}
        className="rounded-lg p-2 text-rose-500 hover:bg-rose-500/10 disabled:opacity-40"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

export default function Scanner() {
  const { address, correctNetwork, roles } = useWallet();
  const { submitTransaction } = useTransactions();

  const [mode, setMode] = useState("single");
  const [manualId, setManualId] = useState("");
  const [items, setItems] = useState([]);
  const [zones, setZones] = useState([]);
  const [zone, setZone] = useState("");
  const [status, setStatus] = useState("Stored");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [lastReceipt, setLastReceipt] = useState(null);

  const scannerRef = useRef(null);
  const startingRef = useRef(false);
  const scanLockRef = useRef(false);
  const addItemRef = useRef(null);
  const fileInputRef = useRef(null);

  const canMove =
    Boolean(address) &&
    correctNetwork &&
    (roles.ADMIN || roles.MANAGER || roles.OPERATOR);

  // Load zones from the actual smart contract.
  useEffect(() => {
    let cancelled = false;

    async function loadZones() {
      try {
        const contract = getReadContract();
        const names = await contract.getZones();

        const list = await Promise.all(
          names.map(async (name) => ({
            name,
            active: await contract.zoneActive(
              // zoneExists uses keccak256 of zone text.
              (await import("ethers")).id(name),
            ),
          })),
        );

        if (!cancelled) {
          const active = list.filter((entry) => entry.active);
          setZones(active);
          setZone((previous) =>
            active.some((z) => z.name === previous)
              ? previous
              : active.find((z) => z.name === "Storage A")?.name ||
                active[0]?.name ||
                "",
          );
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(explainError(error));
        }
      }
    }

    loadZones();

    return () => {
      cancelled = true;
    };
  }, []);

  const addItem = useCallback(async (rawValue) => {
    let itemId;

    try {
      itemId = parseQR(rawValue);
    } catch (error) {
      toast.error(error.message);
      return;
    }

    // Do not add the same pallet twice to a batch.
    if (items.some((item) => item.itemId === itemId)) {
      toast("This pallet is already in the scan queue.");
      return;
    }

    try {
      const contract = getReadContract();
      const record = await contract.getItem(itemId);

      const selected = {
        itemId: record.itemId,
        name: record.name,
        sku: record.sku,
        quantity: record.quantity.toString(),
        unit: record.unit,
        currentZone: record.currentZone,
        statusValue: Number(record.status),
        status: formatStatus(record.status),
      };

      setItems((previous) => {
        if (previous.some((i) => i.itemId === selected.itemId)) {
          return previous;
        }

        // Single mode replaces the previous scan.
        if (mode === "single") return [selected];

        if (previous.length >= 25) {
          toast.error("Maximum 25 items per batch.");
          return previous;
        }

        return [...previous, selected];
      });

      setManualId("");
      setLastReceipt(null);

      if (navigator.vibrate) {
        navigator.vibrate(80);
      }

      toast.success(`Scanned ${selected.itemId}`);
    } catch (error) {
      const message = explainError(error);

      if (/ItemNotFound/.test(message)) {
        toast.error(`Item ${itemId} is not registered.`);
      } else {
        toast.error(message);
      }
    }
  }, [items, mode]);

  // The camera callback must always use the latest addItem.
  useEffect(() => {
    addItemRef.current = addItem;
  }, [addItem]);

  const stopCamera = useCallback(async () => {
    startingRef.current = false;

    const scanner = scannerRef.current;
    scannerRef.current = null;

    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
        scanner.clear();
      } catch (error) {
        console.warn("Camera cleanup:", error);
      }
    }

    setCameraOn(false);
  }, []);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;

      if (scanner) {
        if (scanner.isScanning) {
          scanner.stop()
            .then(() => scanner.clear())
            .catch(() => {});
        } else {
          try {
            scanner.clear();
          } catch {
            // Camera was already stopped.
          }
        }
      }
    };
  }, []);

  async function startCamera() {
    if (startingRef.current || scannerRef.current) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Camera unavailable. Use localhost/HTTPS or manual entry.",
      );
      return;
    }

    startingRef.current = true;
    setCameraError("");

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      const scanner = new Html5Qrcode(
        "chainstock-reader",
        { verbose: false },
      );

      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 8,
          qrbox: { width: 220, height: 220 },
        },
        async (decodedText) => {
          if (scanLockRef.current) return;

          scanLockRef.current = true;

          try {
            await addItemRef.current?.(decodedText);
          } finally {
            // Prevent repeated readings of the same QR frame.
            setTimeout(() => {
              scanLockRef.current = false;
            }, 1200);
          }
        },
        () => {
          // Ordinary no-QR frames are not application errors.
        },
      );

      setCameraOn(true);
    } catch (error) {
      setCameraError(
        "Camera could not start. Check permissions or use manual entry. " +
        explainError(error),
      );

      await stopCamera();
    } finally {
      startingRef.current = false;
    }
  }

  async function scanImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    // The same scanning element must not be used by two
    // scanning sessions at the same time.
    await stopCamera();

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      const decoder = new Html5Qrcode(
        "chainstock-reader",
        { verbose: false },
      );

      scannerRef.current = decoder;

      const decoded = await decoder.scanFile(file, true);
      await addItem(decoded);

      decoder.clear();
      scannerRef.current = null;
    } catch (error) {
      toast.error(
        "Could not decode this image. Use a clear QR picture.",
      );

      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch {
          // Ignore an already-cleared reader.
        }
        scannerRef.current = null;
      }
    } finally {
      event.target.value = "";
    }
  }

  function removeItem(id) {
    if (busy) return;

    setItems((previous) =>
      previous.filter((item) => item.itemId !== id),
    );
  }

  function changeMode(nextMode) {
    if (busy) return;

    setMode(nextMode);
    setItems([]);
    setLastReceipt(null);
  }

  function simulateScan() {
    // Demo fallback: choose a real registered item.
    // This never creates or forges a blockchain record.
    addItem("PALLET001");
  }

  async function submitMovement() {
    if (busy || !canMove) {
      toast.error("Connect an authorized operator wallet.");
      return;
    }

    if (items.length === 0) {
      toast.error("Scan at least one registered item.");
      return;
    }

    if (!zone) {
      toast.error("Select a destination zone.");
      return;
    }

    if (new TextEncoder().encode(note).length > 256) {
      toast.error("Movement note exceeds 256 bytes.");
      return;
    }

    setBusy(true);
    setLastReceipt(null);

    try {
      const contract = await getWriteContract();
      const read = getReadContract();

      // Fetch the latest chain state to prevent stale scans.
      const latest = await Promise.all(
        items.map((item) => read.getItem(item.itemId)),
      );

      const targetStatus = STATUSES.indexOf(status);

      const requests = items.map((item, index) => ({
        itemId: item.itemId,
        toZone: zone,
        status: targetStatus,
        quantity: latest[index].quantity,
        note: note.trim() || "Warehouse QR movement",
      }));

      // Simulate first. Invalid status/zone rules are rejected
      // before MetaMask asks for the transaction signature.
      if (mode === "single") {
        const m = requests[0];

        await contract.logMovement.staticCall(
          m.itemId,
          m.toZone,
          m.status,
          m.quantity,
          m.note,
        );
      } else {
        await contract.batchLogMovement.staticCall(requests);
      }

      const receipt = await submitTransaction({
        label: mode === "single"
          ? `Move ${items[0].itemId} to ${zone}`
          : `Batch move ${items.length} items to ${zone}`,
        account: address,
        itemIds: items.map((item) => item.itemId),
        send: () =>
          mode === "single"
            ? contract.logMovement(
                requests[0].itemId,
                requests[0].toZone,
                requests[0].status,
                requests[0].quantity,
                requests[0].note,
              )
            : contract.batchLogMovement(requests),
      });

      if (receipt?.status === 1) {
        setLastReceipt({
          hash: receipt.hash,
          count: items.length,
          blockNumber: receipt.blockNumber,
        });

        setItems([]);
        setNote("");

        // Avoid rescanning the printed QR immediately.
        await stopCamera();
      }
    } catch (error) {
      toast.error(
        `Movement not completed: ${explainError(error)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow">Warehouse Operations</p>
        <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
          QR Movement Scanner
        </h2>
        <p className="mt-2 text-sm muted">
          Scan registered pallets and record their movements
          through authorized blockchain transactions.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => changeMode("single")}
          className={mode === "single"
            ? "btn-primary"
            : "btn-secondary"}
        >
          <QrCode size={17} />
          Single Scan
        </button>

        <button
          type="button"
          onClick={() => changeMode("batch")}
          className={mode === "batch"
            ? "btn-primary"
            : "btn-secondary"}
        >
          <Layers size={17} />
          Batch Mode
        </button>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 p-5 dark:border-white/10">
            <h3 className="flex items-center gap-2 font-bold">
              <Camera size={19} className="text-teal-500" />
              Scan Warehouse QR
            </h3>
            <p className="mt-1 text-xs muted">
              {mode === "batch"
                ? "Scan up to 25 different registered pallets."
                : "Scan one pallet to prepare its movement."}
            </p>
          </div>

          <div className="p-5">
            <div className="relative min-h-[260px] overflow-hidden rounded-2xl border border-dashed border-teal-500/30 bg-[#091626]">
              <div
                id="chainstock-reader"
                className="mx-auto w-full text-white"
              />

              {!cameraOn && (
                <div className="pointer-events-none flex min-h-[260px] flex-col items-center justify-center p-6 text-center text-slate-300">
                  <QrCode
                    size={65}
                    strokeWidth={1.2}
                    className="mb-4 text-teal-400"
                  />
                  <p className="font-semibold">
                    QR reader ready
                  </p>
                  <p className="mt-2 max-w-xs text-xs text-slate-400">
                    Start the camera or choose a QR image.
                    Manual entry is always available.
                  </p>
                </div>
              )}
            </div>

            {cameraError && (
              <div
                role="alert"
                className="mt-3 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-500"
              >
                {cameraError}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {!cameraOn ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="btn-primary"
                >
                  <Play size={16} />
                  Start Camera
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="btn-secondary"
                >
                  <Square size={16} />
                  Stop Camera
                </button>
              )}

              <button
                type="button"
                className="btn-secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus size={16} />
                Upload QR
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={scanImage}
              />
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                addItem(manualId);
              }}
              className="mt-6"
            >
              <label className="mb-2 flex items-center gap-2 text-sm font-bold">
                <Keyboard size={16} />
                Manual Item ID
              </label>

              <div className="flex gap-2">
                <input
                  className={fieldClass}
                  value={manualId}
                  onChange={(event) =>
                    setManualId(event.target.value.toUpperCase())
                  }
                  placeholder="PALLET001"
                  maxLength={64}
                  disabled={busy}
                />

                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary"
                >
                  <Plus size={17} />
                  Add
                </button>
              </div>
            </form>

            <button
              type="button"
              onClick={simulateScan}
              className="mt-4 text-xs font-semibold text-teal-500 hover:underline"
            >
              Simulate scan: PALLET001
            </button>

            <p className="mt-2 text-xs muted">
              Simulation reads the real item from the blockchain.
              It does not fabricate movement history.
            </p>
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-white/10">
            <div>
              <h3 className="font-bold">Movement Queue</h3>
              <p className="mt-1 text-xs muted">
                {items.length} of {mode === "batch" ? 25 : 1} items
              </p>
            </div>
            <span className="rounded-full bg-teal-500/10 px-3 py-1 text-xs font-bold text-teal-500">
              {mode === "batch" ? "Batch" : "Single"}
            </span>
          </div>

          <div className="space-y-5 p-5">
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center dark:border-white/10">
                <PackageCheck
                  size={34}
                  className="mx-auto text-slate-400"
                />
                <p className="mt-3 text-sm font-semibold">
                  No items scanned
                </p>
                <p className="mt-1 text-xs muted">
                  Scan, upload or manually enter an item ID.
                </p>
              </div>
            ) : (
              <div className="max-h-[320px] space-y-2 overflow-y-auto">
                {items.map((item) => (
                  <ItemRow
                    key={item.itemId}
                    item={item}
                    disabled={busy}
                    remove={removeItem}
                  />
                ))}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-bold">
                Destination Zone
              </label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className={fieldClass}
                disabled={busy}
              >
                <option value="">Choose destination</option>
                {zones.map((entry) => (
                  <option key={entry.name} value={entry.name}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold">
                New Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={fieldClass}
                disabled={busy}
              >
                {STATUSES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold">
                Movement Note
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={`${fieldClass} min-h-[90px] resize-y`}
                maxLength={256}
                disabled={busy}
                placeholder="Moved after receiving inspection"
              />
            </div>

            <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  size={20}
                  className="shrink-0 text-teal-500"
                />
                <div>
                  <p className="text-sm font-bold">
                    Blockchain workflow validation
                  </p>
                  <p className="mt-1 text-xs leading-5 muted">
                    Invalid zone or status transitions are
                    rejected by Solidity. In batch mode, one
                    invalid item cancels the whole batch.
                  </p>
                </div>
              </div>
            </div>

            {!canMove && (
              <p className="flex items-center gap-2 text-xs text-amber-500">
                <AlertTriangle size={16} />
                Connect an authorized wallet on {CHAIN.name}.
              </p>
            )}

            <button
              type="button"
              onClick={submitMovement}
              disabled={!canMove || busy || items.length === 0 || !zone}
              className="btn-primary w-full py-3.5"
            >
              {busy ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Wallet size={18} />
                  {mode === "batch"
                    ? `Submit ${items.length} Movements`
                    : "Record Movement"}
                </>
              )}
            </button>
          </div>
        </section>
      </div>

      {lastReceipt && (
        <div className="panel border-teal-500/30 p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2
              size={29}
              className="text-teal-500"
            />
            <div>
              <h3 className="font-bold">
                Movement confirmed on blockchain
              </h3>
              <p className="text-xs muted">
                {lastReceipt.count} item(s) · Block{" "}
                {lastReceipt.blockNumber}
              </p>
            </div>
          </div>

          <p className="mt-4 break-all font-mono text-xs muted">
            Transaction: {lastReceipt.hash}
          </p>
        </div>
      )}
    </div>
  );
}
