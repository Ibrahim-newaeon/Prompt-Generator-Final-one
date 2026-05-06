import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import Landing from "./pages/landing";
import Index from "./pages/index";
import AuthPage from "./pages/auth";
import Pricing from "./pages/pricing";
import Admin from "./pages/admin";
import { Provider } from "./components/provider";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";
import { authClient } from "./lib/auth";

/* Gate: redirect to /auth if not logged in */
function AppRoute() {
  const { data: session, isPending } = authClient.useSession();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isPending && !session?.user) {
      navigate("/auth");
    }
  }, [session, isPending, navigate]);

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07070d" }}>
        <div className="shimmer-text text-sm" style={{ color: "#6b6b8a" }}>Loading…</div>
      </div>
    );
  }

  if (!session?.user) return null;

  return <Index />;
}

function App() {
  return (
    <Provider>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/app" component={AppRoute} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/admin" component={Admin} />
      </Switch>
      {import.meta.env.DEV && <AgentFeedback />}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
