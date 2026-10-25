
import { useEffect, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";

export default function PWAUpdate() {
  const [updateAvailable, setUpdateAvailable] =
    useState(false);

  const [offlineReady, setOfflineReady] =
    useState(false);

  const [updateApp, setUpdateApp] =
    useState(null);

  useEffect(() => {
    let active = true;

    // PWA service workers are generated in production builds.
    if (import.meta.env.DEV) return;

    import("virtual:pwa-register").then(({ registerSW }) => {
      if (!active) return;

      const update = registerSW({
        onNeedRefresh() {
          if (active) setUpdateAvailable(true);
        },

        onOfflineReady() {
          if (active) setOfflineReady(true);
        },

        onRegisterError(error) {
          console.warn("PWA registration failed:", error);
        },
      });

      setUpdateApp(() => update);
    }).catch((error) => {
      console.warn("PWA unavailable:", error);
    });

    return () => {
      active = false;
    };
  }, []);

  if (!updateAvailable && !offlineReady) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-[100] w-[min(360px,calc(100vw-40px))] rounded-2xl border border-teal-500/30 bg-[#112239] p-5 text-white shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 font-bold">
          {updateAvailable
            ? <RefreshCw size={19} className="text-teal-400" />
            : <Download size={19} className="text-teal-400" />}

          {updateAvailable
            ? "ChainStock update available"
            : "Application ready for offline launch"}
        </div>

        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => {
            setUpdateAvailable(false);
            setOfflineReady(false);
          }}
        >
          <X size={18} />
        </button>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-300">
        {updateAvailable
          ? "Save your work before refreshing to the new version."
          : "The interface can load from cache. Live blockchain functions still require a connection."}
      </p>

      {updateAvailable && (
        <button
          type="button"
          className="btn-primary mt-4 w-full"
          onClick={() => updateApp?.(true)}
        >
          <RefreshCw size={16} />
          Update Application
        </button>
      )}
    </div>
  );
}
