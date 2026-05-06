import { useCustomer, useListPlans } from "autumn-js/react";
import { useLocation } from "wouter";

const PLAN_META: Record<string, { color: string; badge?: string; desc: string; features: string[]; locked?: string[] }> = {
  free: {
    color: "#6b6b8a",
    desc: "Try it out. No credit card.",
    features: ["1 mega prompt total", "Generic LLM mode (Chat · Image · Code)", "Prompt history & star ratings", "Copy & Markdown export"],
    locked: ["Claude v2.3 mode 🔒", "Priority model (Sonnet) 🔒", "Bulk export 🔒"],
  },
  starter: {
    color: "#06b6d4",
    desc: "For individuals building prompts regularly.",
    features: ["50 prompts / month", "Generic LLM mode (Chat · Image · Code)", "Full prompt history & star ratings", "Copy & Markdown export", "claude-haiku-4.5 model"],
    locked: ["Claude v2.3 mode 🔒", "Priority model (Sonnet) 🔒", "Bulk export 🔒"],
  },
  pro: {
    color: "#7c3aed",
    badge: "Most Popular",
    desc: "For power users and prompt engineers.",
    features: ["200 prompts / month", "Claude v2.3 structured XML ✓", "Intent detection · quality scoring", "Priority model — claude-sonnet-4-5 ✓", "Full history, copy & export"],
    locked: ["Bulk export 🔒"],
  },
  agency: {
    color: "#ff3cac",
    badge: "Best Value",
    desc: "For teams and high-volume usage.",
    features: ["Unlimited prompts", "Claude v2.3 + Generic modes", "Priority model — claude-sonnet-4-5", "Bulk export — .md & .csv ✓", "Full history, copy & export"],
  },
};

export default function Pricing() {
  const [, navigate] = useLocation();
  const { data: customer, attach } = useCustomer();
  const { data: plans, isLoading } = useListPlans();

  const activePlanId = customer?.subscriptions?.[0]?.planId ?? "free";
  const balance = customer?.balances?.["prompts"];

  return (
    <div className="min-h-screen" style={{ background: "#07070d" }}>
      <div className="spectrum-bar w-full" />

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <a href="/" className="text-2xl" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, textDecoration: "none" }}>
          <span className="gradient-text">Mega</span><span style={{ color: "#f0f0ff" }}>Prompt</span>
        </a>
        <a href="/" className="text-sm" style={{ color: "#6b6b8a" }}>← Back to app</a>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-5" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#c4b5fd" }}>
            ⚡ Simple, transparent pricing
          </div>
          <h1 className="text-5xl mb-4" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>
            <span className="gradient-text">Upgrade</span> <span style={{ color: "#f0f0ff" }}>your prompts</span>
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: "#6b6b8a" }}>
            Start free. Scale when you're ready. Cancel anytime.
          </p>

          {/* Current balance */}
          {customer && balance && (
            <div className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-full text-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#f0f0ff" }}>
              Current plan: <span style={{ color: "#c4b5fd", fontWeight: 600 }}>{activePlanId}</span>
              {!balance.unlimited && <span style={{ color: "#6b6b8a" }}>· {balance.remaining ?? 0} prompts remaining</span>}
              {balance.unlimited && <span style={{ color: "#6ee7b7" }}>· Unlimited</span>}
            </div>
          )}
        </div>

        {/* Plans grid */}
        {isLoading ? (
          <div className="text-center py-20 shimmer-text" style={{ color: "#6b6b8a" }}>Loading plans...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {(plans ?? []).map((plan) => {
              const meta = PLAN_META[plan.id] ?? { color: "#6b6b8a", desc: "", features: [] };
              const isActive = activePlanId === plan.id;
              const isFree = plan.id === "free";
              const monthlyPrice = plan.prices?.find((p: { interval?: string }) => p.interval === "month");
              const priceAmount = monthlyPrice ? (monthlyPrice as { unitAmount?: number }).unitAmount ?? 0 : 0;

              return (
                <div
                  key={plan.id}
                  className="glass-card rounded-2xl p-6 flex flex-col relative"
                  style={{ borderTop: `2px solid ${meta.color}`, ...(meta.badge ? { boxShadow: `0 0 30px ${meta.color}22` } : {}) }}
                >
                  {meta.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap" style={{ background: meta.color, color: "#07070d" }}>
                      {meta.badge}
                    </div>
                  )}

                  <div className="mb-5">
                    <div className="text-sm font-semibold uppercase tracking-widest mb-1" style={{ color: meta.color }}>{plan.name}</div>
                    <div className="flex items-end gap-1 mb-2">
                      <span className="text-4xl font-display font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "#f0f0ff" }}>
                        {isFree ? "Free" : `$${priceAmount / 100}`}
                      </span>
                      {!isFree && <span className="text-sm mb-1" style={{ color: "#6b6b8a" }}>/mo</span>}
                    </div>
                    <p className="text-xs" style={{ color: "#6b6b8a" }}>{meta.desc}</p>
                  </div>

                  <ul className="space-y-2 flex-1 mb-6">
                    {meta.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "#d4d4f0" }}>
                        <span style={{ color: meta.color, flexShrink: 0 }}>✓</span>
                        {f}
                      </li>
                    ))}
                    {meta.locked?.map((f, i) => (
                      <li key={`locked-${i}`} className="flex items-start gap-2 text-sm" style={{ color: "#3d3d5c" }}>
                        <span style={{ color: "#3d3d5c", flexShrink: 0 }}>–</span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isActive ? (
                    <div className="w-full py-3 rounded-xl text-sm font-semibold text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#6b6b8a" }}>
                      Current Plan
                    </div>
                  ) : isFree ? (
                    <button onClick={() => navigate("/auth")} className="w-full py-3 rounded-xl text-sm font-semibold" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#f0f0ff" }}>
                      Get Started Free
                    </button>
                  ) : (
                    <button
                      className="btn-gradient w-full py-3 rounded-xl text-sm font-semibold"
                      style={{ background: `linear-gradient(135deg, ${meta.color}cc, ${meta.color}88)` }}
                      onClick={async () => {
                        if (!customer) { navigate("/auth"); return; }
                        await attach({ planId: plan.id, successUrl: window.location.origin });
                      }}
                    >
                      Upgrade to {plan.name} →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* FAQ note */}
        <div className="text-center mt-14" style={{ color: "#6b6b8a" }}>
          <p className="text-sm">All plans include prompt history, copy, export, and star rating. Prices in USD.</p>
          <p className="text-sm mt-1">Cancel or change plan anytime from your account settings.</p>
        </div>
      </div>
    </div>
  );
}
