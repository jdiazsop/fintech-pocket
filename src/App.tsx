import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AcceptTermsGate } from "@/components/legal/AcceptTermsGate";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import NewLoan from "./pages/NewLoan";
import NewClient from "./pages/NewClient";
import Operations from "./pages/Operations";
import Portfolio from "./pages/Portfolio";
import LoanDetail from "./pages/LoanDetail";
import ClientDetail from "./pages/ClientDetail";
import Profile from "./pages/Profile";
import Subscription from "./pages/Subscription";
import ConfirmAgreement from "./pages/ConfirmAgreement";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminClients from "./pages/admin/AdminClients";
import AdminClientDetail from "./pages/admin/AdminClientDetail";
import AdminOperations from "./pages/admin/AdminOperations";
import AdminOperationDetail from "./pages/admin/AdminOperationDetail";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminConsents from "./pages/admin/AdminConsents";
import NotFound from "./pages/NotFound";
import ScrollToTop from "./components/ScrollToTop";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, acceptedTerms, profileLoading, signOut } = useAuth();
  const [acceptedNow, setAcceptedNow] = useState(false);

  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-primary/20" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (acceptedTerms === false && !acceptedNow) {
    return (
      <>
        <AcceptTermsGate
          open
          userId={user.id}
          email={user.email ?? null}
          onAccepted={() => setAcceptedNow(true)}
          onDecline={async () => { await signOut(); }}
        />
        <div className="min-h-screen bg-background" />
      </>
    );
  }

  return <>{children}</>;
};

// Root redirect component
const RootRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-primary/20" />
        </div>
      </div>
    );
  }

  return <Navigate to={user ? "/dashboard" : "/auth"} replace />;
};

// App Routes
const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/new-loan"
        element={
          <ProtectedRoute>
            <NewLoan />
          </ProtectedRoute>
        }
      />
      <Route
        path="/new-client"
        element={
          <ProtectedRoute>
            <NewClient />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operations"
        element={
          <ProtectedRoute>
            <Operations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/portfolio"
        element={
          <ProtectedRoute>
            <Portfolio />
          </ProtectedRoute>
        }
      />
      <Route
        path="/loan/:id"
        element={
          <ProtectedRoute>
            <LoanDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/client/:key"
        element={
          <ProtectedRoute>
            <ClientDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/subscription"
        element={
          <ProtectedRoute>
            <Subscription />
          </ProtectedRoute>
        }
      />
      <Route path="/confirm/:token" element={<ConfirmAgreement />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="users/:id" element={<AdminUserDetail />} />
        <Route path="clients" element={<AdminClients />} />
        <Route path="clients/:id" element={<AdminClientDetail />} />
        <Route path="operations" element={<AdminOperations />} />
        <Route path="operations/:id" element={<AdminOperationDetail />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="consents" element={<AdminConsents />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const Router = BrowserRouter;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Router>
        <ScrollToTop />
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
