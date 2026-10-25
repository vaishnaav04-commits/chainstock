
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle2,
  Copy,
  Download,
  Printer,
  QrCode,
} from "lucide-react";
import toast from "react-hot-toast";

/**
 * Printable physical QR label.
 *
 * The QR contains the item's exact on-chain ID.
 * QR scanning alone does not authorize a transaction.
 */
export default function QRLabel({ item, txHash }) {
  if (!item) return null;

  const printLabel = () => window.print();

  const downloadQR = () => {
    const svg = document.querySelector(
      "#chainstock-print-label svg",
    );

    if (!svg) {
      toast.error("QR image is not available.");
      return;
    }

    const clone = svg.cloneNode(true);
    clone.setAttribute(
      "xmlns",
      "http://www.w3.org/2000/svg",
    );
    clone.setAttribute("width", "320");
    clone.setAttribute("height", "320");

    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${item.itemId}-QR.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("QR downloaded.");
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(item.itemId);
      toast.success("Item ID copied.");
    } catch {
      toast.error("Clipboard permission unavailable.");
    }
  };

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2 text-teal-500">
            <CheckCircle2 size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">
              On-chain registration confirmed
            </span>
          </div>

          <h3 className="mt-2 text-lg font-bold">
            Your QR label is ready
          </h3>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadQR}
            className="btn-secondary"
          >
            <Download size={16} />
            Download
          </button>

          <button
            type="button"
            onClick={printLabel}
            className="btn-primary"
          >
            <Printer size={16} />
            Print Label
          </button>
        </div>
      </div>

      <div className="p-5">
        <div
          id="chainstock-print-label"
          className="mx-auto max-w-[380px] rounded-2xl border-2 border-slate-200 bg-white p-6 text-slate-900 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-teal-500 p-2 text-white">
                <QrCode size={21} />
              </div>
              <div>
                <p className="text-xl font-black tracking-tight">
                  Chain<span className="text-teal-600">Stock</span>
                </p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  Warehouse Asset Label
                </p>
              </div>
            </div>

            <span className="rounded-full bg-teal-50 px-2 py-1 text-[9px] font-bold uppercase text-teal-700">
              Registered
            </span>
          </div>

          <div className="my-6 flex justify-center">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <QRCodeSVG
                value={item.itemId}
                size={210}
                level="H"
                bgColor="#ffffff"
                fgColor="#111827"
                marginSize={2}
                title={`ChainStock ${item.itemId}`}
              />
            </div>
          </div>

          <p className="text-center font-mono text-xl font-black tracking-widest">
            {item.itemId}
          </p>

          <p className="mt-1 text-center text-xs text-slate-500">
            Scan to identify this warehouse asset
          </p>

          <div className="mt-6 space-y-2 border-t border-dashed border-slate-300 pt-4 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Product</span>
              <span className="max-w-[210px] break-words text-right font-bold">
                {item.name}
              </span>
            </div>

            <div className="flex justify-between gap-2">
              <span className="text-slate-500">SKU</span>
              <span className="font-semibold">{item.sku}</span>
            </div>

            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Quantity</span>
              <span className="font-semibold">
                {item.quantity} {item.unit}
              </span>
            </div>

            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Initial Zone</span>
              <span className="font-semibold">{item.zone}</span>
            </div>
          </div>

          <p className="mt-5 border-t border-slate-200 pt-3 text-center text-[10px] font-semibold text-slate-500">
            CHAINSTOCK • BLOCKCHAIN INVENTORY RECORD
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs muted">
            This QR encodes the item ID, not a wallet key.
          </span>

          <button
            type="button"
            onClick={copyId}
            className="btn-secondary"
          >
            <Copy size={15} />
            Copy Item ID
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-teal-500/5 p-4 text-xs">
          <p className="font-semibold text-teal-500">
            Blockchain transaction
          </p>
          <p className="mt-2 break-all font-mono muted">
            {txHash}
          </p>
        </div>
      </div>

      {/* Print only the QR label, not the SaaS dashboard. */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 12mm;
          }

          body * {
            visibility: hidden !important;
          }

          #chainstock-print-label,
          #chainstock-print-label * {
            visibility: visible !important;
          }

          #chainstock-print-label {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 95mm !important;
            max-width: 95mm !important;
            padding: 8mm !important;
            border: 1px solid #dddddd !important;
            box-shadow: none !important;
            color: #111827 !important;
          }
        }
      `}</style>
    </div>
  );
}
