import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireCafe } from "@/components/RequireCafe";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteThemeSync } from "@/components/SiteThemeSync";
import { PERMISSIONS } from "@/convex/permissions";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const Legal = lazy(() => import("./pages/Legal.tsx"));
const CmsPage = lazy(() => import("./pages/CmsPage.tsx"));
const HelpCenter = lazy(() => import("./pages/HelpCenter.tsx"));
const Contact = lazy(() => import("./pages/Contact.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Accounting = lazy(() => import("./pages/Accounting.tsx"));
const News = lazy(() => import("./pages/News.tsx"));
const NewsDetail = lazy(() => import("./pages/NewsDetail.tsx"));
const Sites = lazy(() => import("./pages/Sites.tsx"));
const Agent = lazy(() => import("./pages/Agent.tsx"));
const Rates = lazy(() => import("./pages/Rates.tsx"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.tsx"));
const Setup = lazy(() => import("./pages/Setup.tsx"));
const CafeSettings = lazy(() => import("./pages/CafeSettings.tsx"));
const Employees = lazy(() => import("./pages/Employees.tsx"));
const Subscription = lazy(() => import("./pages/Subscription.tsx"));
const AccountSettings = lazy(() => import("./pages/AccountSettings.tsx"));
const Support = lazy(() => import("./pages/Support.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="clay-sm size-11 animate-pulse rounded-2xl" />
    </div>
  );
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      const showDetails = import.meta.env.DEV;
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">
              {showDetails ? "Preview runtime error" : "خطای غیرمنتظره‌ای رخ داد"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {showDetails
                ? this.state.message
                : "لطفاً صفحه را دوباره بارگذاری کنید. اگر مشکل ادامه داشت با پشتیبانی تماس بگیرید."}
            </p>
            {showDetails && this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


function ManagementEntry() {
  useEffect(() => { window.location.replace('/manage'); }, []);
  return <RouteLoading />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ThemeProvider>
        <ConvexAuthProvider client={convex}>
          <SiteThemeSync />
          <BrowserRouter>
            <RouteSyncer />
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/legal/:document" element={<Legal />} />
                <Route path="/p/:slug" element={<CmsPage />} />
                <Route path="/help" element={<HelpCenter />} />
                <Route path="/contact" element={<Contact />} />
                <Route
                  path="/auth"
                  element={<AuthPage redirectAfterAuth="/dashboard" />}
                />
                <Route
                  path="/forgot-password"
                  element={<ForgotPassword />}
                />
                <Route
                  path="/setup"
                  element={
                    <RequireAuth>
                      <Setup />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth>
                      <RequireCafe permission={PERMISSIONS.DASHBOARD_VIEW}>
                        <Dashboard />
                      </RequireCafe>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/accounting"
                  element={
                    <RequireAuth>
                      <RequireCafe
                        permission={PERMISSIONS.ACCOUNTING_VIEW}
                      >
                        <Accounting />
                      </RequireCafe>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/news"
                  element={
                    <RequireAuth>
                      <RequireCafe permission={PERMISSIONS.NEWS_VIEW}>
                        <News />
                      </RequireCafe>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/news/:newsId"
                  element={
                    <RequireAuth>
                      <RequireCafe permission={PERMISSIONS.NEWS_VIEW}>
                        <NewsDetail />
                      </RequireCafe>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/sites"
                  element={
                    <RequireAuth>
                      <RequireCafe permission={PERMISSIONS.SITES_VIEW}>
                        <Sites />
                      </RequireCafe>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/agent"
                  element={
                    <RequireAuth>
                      <RequireCafe
                        permission={PERMISSIONS.AGENT_USE}
                        planFeature="agent"
                      >
                        <Agent />
                      </RequireCafe>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/rates"
                  element={
                    <RequireAuth>
                      <RequireCafe
                        permission={PERMISSIONS.RATES_VIEW}
                        planFeature="rates"
                      >
                        <Rates />
                      </RequireCafe>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/cafe"
                  element={
                    <RequireAuth>
                      <RequireCafe ownerOnly>
                        <CafeSettings />
                      </RequireCafe>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/employees"
                  element={
                    <RequireAuth>
                      <RequireCafe
                        permission={PERMISSIONS.EMPLOYEES_MANAGE}
                      >
                        <Employees />
                      </RequireCafe>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/subscription"
                  element={
                    <RequireAuth>
                      <RequireCafe ownerOnly>
                        <Subscription />
                      </RequireCafe>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/support"
                  element={
                    <RequireAuth>
                      <RequireCafe allowSuspended>
                        <Support />
                      </RequireCafe>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/account"
                  element={
                    <RequireAuth>
                      <RequireCafe allowSuspended>
                        <AccountSettings />
                      </RequireCafe>
                    </RequireAuth>
                  }
                />
                <Route path="/admin/*" element={<ManagementEntry />} />
                <Route path="/super-admin" element={<ManagementEntry />} />
                <Route path="/manage/*" element={<ManagementEntry />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster />
        </ConvexAuthProvider>
      </ThemeProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
