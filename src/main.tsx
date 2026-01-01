import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./Index.css";

console.log('Kingdom FM Xtra - App starting...');

createRoot(document.getElementById("root")!).render(<App />);
