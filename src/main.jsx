import React from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import App from "./App.jsx";
import { I18nProvider, getLang, loadLanguage } from "./i18n.js";
import { ThemeProvider } from "./theme.js";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { installMonitor } from "./monitor.js";

installMonitor(); // no-op unless VITE_ERROR_ENDPOINT is configured

const tree = (
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

// Fetch the reader's dictionary before the first paint. Only English ships in
// the initial bundle now, so rendering immediately would show a Romanian user
// an English screen for as long as their chunk takes to arrive — a flash of the
// wrong language on every cold load.
//
// It is not worth blocking over: if the chunk cannot be had, the app renders in
// English rather than not at all, which is what loadLanguage already resolves
// to on failure.
const root = createRoot(document.getElementById("root"));
loadLanguage(getLang()).finally(() => root.render(tree));
