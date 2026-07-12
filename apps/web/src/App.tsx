import { Spinner } from "@heroui/react";
import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import OfflineBanner from "./components/OfflineBanner";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import PwaUpdatePrompt from "./components/PwaUpdatePrompt";
import { AppUpdateProvider } from "./context/AppUpdateContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import DevQrs from "./pages/DevQrs";
import ForceChangePassword from "./pages/ForceChangePassword";
import Login from "./pages/Login";

const KEYBOARD_INPUT_TYPES = new Set([
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);

const isKeyboardInputElement = (
  element: Element | null | undefined,
): boolean => {
  if (!element) {
    return false;
  }

  if (element instanceof HTMLTextAreaElement) {
    return !element.readOnly && !element.disabled;
  }

  if (element instanceof HTMLInputElement) {
    const inputType = element.type.toLowerCase();
    return (
      KEYBOARD_INPUT_TYPES.has(inputType) && !element.readOnly && !element.disabled
    );
  }

  return (
    element instanceof HTMLElement &&
    element.isContentEditable &&
    element.getAttribute("contenteditable") !== "false"
  );
};

function AppRoutes() {
  const { isAuthenticated, isLoading, requiresPasswordChange } = useAuth();
  const authenticatedHome = requiresPasswordChange ? "/force-change-password" : "/";

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-hidden">
        <Spinner
          aria-label="앱 로딩 중"
          className="text-[#409eff]"
          color="current"
          size="md"
        />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/dev/qrs"
        element={
          import.meta.env.DEV ? (
            !isAuthenticated ? (
              <Navigate to="/login" replace />
            ) : requiresPasswordChange ? (
              <Navigate to="/force-change-password" replace />
            ) : (
              <DevQrs />
            )
          ) : (
            <Navigate to={authenticatedHome} replace />
          )
        }
      />
      <Route
        path="/"
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : requiresPasswordChange ? (
            <Navigate to="/force-change-password" replace />
          ) : (
            <BottomNav />
          )
        }
      />
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to={authenticatedHome} replace /> : <Login />
        }
      />
      <Route
        path="/force-change-password"
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : requiresPasswordChange ? (
            <ForceChangePassword />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="*"
        element={
          <Navigate to={isAuthenticated ? authenticatedHome : "/login"} replace />
        }
      />
    </Routes>
  );
}

function App() {
  const location = useLocation();
  const isFullWidthDevPage =
    import.meta.env.DEV && location.pathname === "/dev/qrs";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let isKeyboardInputFocused = isKeyboardInputElement(document.activeElement);

    const updateViewportMetrics = () => {
      const visualViewport = window.visualViewport;
      const keyboardOffset = isKeyboardInputFocused
        ? Math.max(
            0,
            window.innerHeight -
              (visualViewport?.height ?? window.innerHeight) -
              (visualViewport?.offsetTop ?? 0),
          )
        : 0;

      document.documentElement.style.setProperty(
        "--app-keyboard-offset",
        `${Math.round(keyboardOffset)}px`,
      );
    };

    const syncKeyboardFocusState = () => {
      isKeyboardInputFocused = isKeyboardInputElement(document.activeElement);
      updateViewportMetrics();
    };

    const handleFocusOut = () => {
      window.requestAnimationFrame(syncKeyboardFocusState);
    };

    updateViewportMetrics();

    window.addEventListener("resize", updateViewportMetrics);
    window.addEventListener("focusin", syncKeyboardFocusState);
    window.addEventListener("focusout", handleFocusOut);
    window.visualViewport?.addEventListener("resize", updateViewportMetrics);
    window.visualViewport?.addEventListener("scroll", updateViewportMetrics);

    return () => {
      window.removeEventListener("resize", updateViewportMetrics);
      window.removeEventListener("focusin", syncKeyboardFocusState);
      window.removeEventListener("focusout", handleFocusOut);
      window.visualViewport?.removeEventListener("resize", updateViewportMetrics);
      window.visualViewport?.removeEventListener("scroll", updateViewportMetrics);
    };
  }, []);

  return (
    <div
      className={
        isFullWidthDevPage
          ? "h-full w-full min-w-[320px] overflow-hidden bg-amber-50"
          : "flex h-full w-full min-w-[320px] justify-center overflow-hidden bg-gray-900"
      }
    >
      <main
        className={
          isFullWidthDevPage
            ? "h-full w-full overflow-y-auto overflow-x-hidden"
            : "h-full w-full max-w-[480px] overflow-hidden bg-white shadow-none min-[481px]:shadow-lg"
        }
      >
        <AppUpdateProvider>
          <AuthProvider>
            <OfflineBanner />
            <PwaInstallPrompt />
            <PwaUpdatePrompt />
            <AppRoutes />
          </AuthProvider>
        </AppUpdateProvider>
      </main>
    </div>
  );
}

export default App;
