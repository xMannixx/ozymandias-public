import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "@/App";
import { AuthProvider } from "@/store/auth";
import { ModeProvider } from "@/store/mode";
import "@/index.css";

if ("serviceWorker" in navigator) {
  // Keep runtime deterministic: stale SW caches caused outdated UIs after deploys.
  // We explicitly unregister workers on startup to always load fresh assets.
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      void registration.unregister();
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ModeProvider>
          <App />
        </ModeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
