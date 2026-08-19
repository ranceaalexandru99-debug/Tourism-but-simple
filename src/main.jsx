import React from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import App from "./App.jsx";
import { I18nProvider } from "./i18n.js";
import { ThemeProvider } from "./theme.js";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { installMonitor } from "./monitor.js";

installMonitor(); // no-op unless VITE_ERROR_ENDPOINT is configured

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <I18nProvider>
          <App />
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
