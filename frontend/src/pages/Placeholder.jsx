
import {
  ArrowLeft,
  Construction,
  LockKeyhole,
} from "lucide-react";

import { Link } from "react-router-dom";

export default function Placeholder({
  title,
  description,
  phase,
  restricted = false,
}) {
  return (
    <div className="mx-auto max-w-3xl py-12">
      <div className="panel overflow-hidden p-8 text-center sm:p-12">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-teal-500/20 bg-teal-500/10 text-teal-500">
          {restricted
            ? <LockKeyhole size={36} />
            : <Construction size={36} />}
        </div>

        <p className="eyebrow">
          {restricted ? "Access restricted" : `Implementation Phase ${phase}`}
        </p>

        <h2 className="mt-3 text-3xl font-extrabold">
          {title}
        </h2>

        <p className="mx-auto mt-4 max-w-md text-sm leading-7 muted">
          {description}
        </p>

        <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold dark:border-white/10">
          <span className="h-2 w-2 rounded-full bg-teal-400" />
          {restricted
            ? "Wallet permissions enforced"
            : "Connected to the ChainStock workspace"}
        </div>

        <div className="mt-8">
          <Link to="/" className="btn-secondary">
            <ArrowLeft size={16} />
            Return to Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
