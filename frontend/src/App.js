import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import Planner from "@/pages/Planner";
import AuthCallback from "@/auth/AuthCallback";
import { AuthProvider } from "@/auth/AuthContext";

function AppRouter() {
  const location = useLocation();
  // Read hash reactively from useLocation, not window.location.hash
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Planner />} />
      <Route path="*" element={<Planner />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
      <Toaster
        position="top-center"
        theme="dark"
        toastOptions={{
          style: {
            background: "rgba(14, 20, 16, 0.95)",
            border: "1px solid rgba(74, 94, 80, 0.5)",
            color: "#e5e7eb",
            fontFamily: "Inter, sans-serif",
          },
        }}
      />
    </div>
  );
}

export default App;
