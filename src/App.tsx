import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PhoneShell } from "@/components/PhoneShell";
import AuthPage from "./pages/Auth";
import Home from "./pages/Home";
import MachineDetail from "./pages/MachineDetail";
import Profile from "./pages/Profile";
import Placeholder from "./pages/Placeholder";
import Diagnosis from "./pages/Diagnosis";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const Protected = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  const loc = useLocation();
  if (loading) return null;
  if (!session) return <Navigate to="/auth" replace state={{ from: loc }} />;
  return <PhoneShell>{children}</PhoneShell>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<Protected><Home /></Protected>} />
            <Route path="/machine/:id" element={<Protected><MachineDetail /></Protected>} />
            <Route path="/job/:id" element={<Protected><Placeholder title="İş Emri" note="Job detail (parça listesi, kapatma) Build 3'te geliyor." /></Protected>} />
            <Route path="/diagnosis" element={<Protected><Diagnosis /></Protected>} />
            <Route path="/profile" element={<Protected><Profile /></Protected>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
