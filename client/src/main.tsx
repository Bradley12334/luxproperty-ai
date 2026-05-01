import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { restoreSession } from "./lib/authStore";

if (!window.location.hash) {
  window.location.hash = "#/";
}

// Restore session from localStorage and re-validate against Supabase
restoreSession();

createRoot(document.getElementById("root")!).render(<App />);
