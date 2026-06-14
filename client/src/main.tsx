import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "leaflet/dist/leaflet.css";
import { restoreSession } from "./lib/authStore";

// Restore session from localStorage and re-validate against Supabase
restoreSession();

createRoot(document.getElementById("root")!).render(<App />);
