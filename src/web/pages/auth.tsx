import { useState } from "react";
import { useLocation } from "wouter";
import { authClient } from "../lib/auth";

type AuthMode = "signin" | "signup";

export default function AuthPage() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handle = async () => {
    if (!email || !password) return;
    setLoading(true); setError("");
    try {
      if (mode === "signup") {
        const res = await authClient.signUp.email({ name: name || email.split("@")[0], email, password });
        if (res.error) throw new Error(res.error.message || "Sign up failed");
      } else {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) throw new Error(res.error.message || "Sign in failed");
      }
      navigate("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#07070d" }}>
      {/* Spectrum bar */}
      <div className="spectrum-bar w-full" />

      {/* Logo */}
      <div className="flex justify-center pt-10 pb-6">
        <a href="/" className="text-2xl" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, textDecoration: "none" }}>
          <span className="gradient-text">Mega</span><span style={{ color: "#f0f0ff" }}>Prompt</span>
        </a>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-start justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          {/* Tab toggle */}
          <div className="flex p-1 rounded-2xl mb-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {(["signin", "signup"] as AuthMode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200" style={mode === m ? { background: "linear-gradient(135deg, rgba(124,58,237,0.35), rgba(37,99,235,0.35))", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.4)" } : { color: "#6b6b8a" }}>
                {m === "signin" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <div className="glass-card rounded-2xl p-8" style={{ borderTop: "2px solid rgba(124,58,237,0.4)" }}>
            <h1 className="text-2xl mb-1" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, color: "#f0f0ff" }}>
              {mode === "signin" ? "Welcome back" : "Start for free"}
            </h1>
            <p className="text-sm mb-7" style={{ color: "#6b6b8a" }}>
              {mode === "signin" ? "Sign in to access your prompt history." : "Get 1 free mega prompt. No credit card needed."}
            </p>

            <div className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="block text-xs mb-1.5 uppercase tracking-widest" style={{ color: "#6b6b8a" }}>Name</label>
                  <input className="glow-input w-full rounded-xl px-4 py-3 text-sm" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
                </div>
              )}
              <div>
                <label className="block text-xs mb-1.5 uppercase tracking-widest" style={{ color: "#6b6b8a" }}>Email</label>
                <input className="glow-input w-full rounded-xl px-4 py-3 text-sm" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} />
              </div>
              <div>
                <label className="block text-xs mb-1.5 uppercase tracking-widest" style={{ color: "#6b6b8a" }}>Password</label>
                <input className="glow-input w-full rounded-xl px-4 py-3 text-sm" type="password" placeholder={mode === "signup" ? "Min 8 characters" : "Your password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} />
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
                ⚠ {error}
              </div>
            )}

            <button className="btn-gradient w-full mt-6 py-3.5 rounded-xl text-sm font-semibold" onClick={handle} disabled={loading || !email || !password}>
              {loading ? <span className="shimmer-text">{mode === "signup" ? "Creating account..." : "Signing in..."}</span> : mode === "signup" ? "Create Free Account →" : "Sign In →"}
            </button>

            {/* WhatsApp placeholder */}
            <div className="mt-4">
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
                <span className="text-xs" style={{ color: "#6b6b8a" }}>or</span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
              </div>
              <button disabled className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 cursor-not-allowed" style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)", color: "#6b6b8a" }}>
                <span style={{ fontSize: "16px" }}>📱</span>
                Continue with WhatsApp
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "#6b6b8a", fontSize: "10px" }}>Coming soon</span>
              </button>
            </div>

            {mode === "signup" && (
              <p className="text-xs text-center mt-5" style={{ color: "#6b6b8a" }}>
                By signing up, you agree to our Terms of Service.<br />
                You get 1 free prompt. Upgrade anytime to generate more.
              </p>
            )}
          </div>

          <p className="text-center text-sm mt-5" style={{ color: "#6b6b8a" }}>
            {mode === "signin" ? "No account? " : "Already have one? "}
            <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }} className="underline" style={{ color: "#c4b5fd", background: "none", border: "none", cursor: "pointer" }}>
              {mode === "signin" ? "Create one free →" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
