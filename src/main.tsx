import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import App from "./App.tsx";
import FormPage from "./pages/FormPage.tsx";
import LoginPage from "./pages/admin/LoginPage.tsx";
import DashboardPage from "./pages/admin/DashboardPage.tsx";
import SubmissionDetailPage from "./pages/admin/SubmissionDetailPage.tsx";
import FormsPage from "./pages/admin/FormsPage.tsx";
import FormEditorPage from "./pages/admin/FormEditorPage.tsx";
import { AuthProvider, useAuth } from "./context/AuthContext.tsx";
import "./index.css";

function PrivateRoute() {
  const { admin, isInitializing } = useAuth();
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Verificando sessão...</span>
      </div>
    );
  }
  return admin ? <Outlet /> : <Navigate to="/admin/login" replace />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/inscricao/:slug" element={<FormPage />} />
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin" element={<PrivateRoute />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="submissions/:id" element={<SubmissionDetailPage />} />
            <Route path="forms" element={<FormsPage />} />
            <Route path="forms/:id" element={<FormEditorPage />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
