
import React from "react";
import ReactDOM from "react-dom/client";

import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import App from "./App";

import { ThemeProvider } from "./contexts/ThemeContext";
import { WalletProvider } from "./contexts/WalletContext";
import { TransactionProvider } from "./contexts/TransactionContext";

import ErrorBoundary from "./components/ErrorBoundary";
import NetworkStatus from "./components/NetworkStatus";
import PWAUpdate from "./components/PWAUpdate";

import "./index.css";

ReactDOM.createRoot(
  document.getElementById("root"),
).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <WalletProvider>
          <TransactionProvider>
            <BrowserRouter>
              <App />

              <NetworkStatus />
              <PWAUpdate />

              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 3500,
                  style: {
                    background: "#162338",
                    color: "#f8fafc",
                    border: "1px solid #334155",
                  },
                }}
              />
            </BrowserRouter>
          </TransactionProvider>
        </WalletProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
