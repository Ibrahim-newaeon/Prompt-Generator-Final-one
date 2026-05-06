import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { authClient } from "../lib/auth";
import { useCustomer } from "autumn-js/react";

/* ─────────────────────── Types ─────────────────────── */
type PromptType = "chat" | "image" | "code";
type AppMode = "claude" | "generic";
type NavTab = "generate" | "history" | "templates";

interface SavedPrompt {
  id: string; title: string; inputIdea: string; generatedPrompt: string;
  promptType: PromptType; promptMode?: string; rating: number; createdAt: number;
}

interface ClaudeSuccess {
  status: "success"; version: string;
  answer: { mega_prompt_xml: string; enriched_input: { goal: string; context: string; intent: string; complexity: string; constraints: string[]; locale_defaults: Record<string, unknown>; missing_data: string[]; completeness_score: number; conflicts: string[] } };
  scoring: { score: number; breakdown: Record<string, number>; penalties: string[]; weakest_criterion: string; repair_attempts_used: number };
  assumptions: string[]; conflicts: string[]; confidence: number; needs_human_review: boolean;
}
interface ClaudeClarification { status: "needs_clarification"; version: string; blocking_questions: string[]; safe_assumptions_if_forced: string[]; completeness_score: number; }
interface ClaudeMissingData { status: "missing_data"; version: string; gaps: string[]; what_would_unblock: string[]; }
type ClaudeResult = ClaudeSuccess | ClaudeClarification | ClaudeMissingData;

/* ─────────────────────── Constants ─────────────────────── */
const TEMPLATES = [
  { label: "AI Writing Assistant", type: "chat" as PromptType, idea: "An AI assistant that helps me write better blog posts with SEO in mind", color: "#7c3aed" },
  { label: "Fantasy Character Art", type: "image" as PromptType, idea: "A powerful wizard standing on a mountain top at sunset", color: "#06b6d4" },
  { label: "REST API Builder", type: "code" as PromptType, idea: "A Node.js REST API for a task management app with auth and CRUD", color: "#10b981" },
  { label: "Socratic Tutor", type: "chat" as PromptType, idea: "A Socratic tutor that teaches math by asking guiding questions instead of giving answers", color: "#f59e0b" },
  { label: "Cyberpunk Cityscape", type: "image" as PromptType, idea: "Futuristic cyberpunk city at night with neon lights and flying cars", color: "#ec4899" },
  { label: "Python Data Pipeline", type: "code" as PromptType, idea: "A Python ETL pipeline that reads CSV files, cleans data, and loads to PostgreSQL", color: "#10b981" },
  { label: "Interview Coach", type: "chat" as PromptType, idea: "A tough but fair interview coach for senior software engineering roles", color: "#7c3aed" },
  { label: "Product Photo", type: "image" as PromptType, idea: "A luxury perfume bottle on white marble surface with dramatic lighting", color: "#06b6d4" },
];

const TYPE_META = {
  chat:  { label: "Chat / LLM", icon: "💬", pillClass: "pill-chat",  tagColor: "rgba(124,58,237,0.2)",  tagBorder: "#7c3aed",  tagText: "#c4b5fd" },
  image: { label: "Image Gen",  icon: "🎨", pillClass: "pill-image", tagColor: "rgba(6,182,212,0.15)", tagBorder: "#06b6d4", tagText: "#67e8f9" },
  code:  { label: "Code Gen",   icon: "💻", pillClass: "pill-code",  tagColor: "rgba(16,185,129,0.15)", tagBorder: "#10b981", tagText: "#6ee7b7" },
};

const SCORE_COLOR = (s: number) => s >= 0.8 ? "#6ee7b7" : s >= 0.6 ? "#fbbf24" : "#f87171";

/* ─────────────────────── Small components ─────────────────────── */
function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <span key={s} className="star text-lg" onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)} onClick={() => onChange?.(s)} style={{ color: s <= (hovered || value) ? "#fbbf24" : "#2d2d4a" }}>★</span>
      ))}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#6b6b8a" }}>
      {copied ? "✓ Copied" : "⎘ Copy"}
    </button>
  );
}

function PromptTypePill({ type, active, onClick }: { type: PromptType; active: boolean; onClick: () => void }) {
  const meta = TYPE_META[type];
  return (
    <button onClick={onClick} className={`${meta.pillClass} ${active ? "active" : ""} px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200`} style={!active ? { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "#6b6b8a" } : {}}>
      {meta.icon} {meta.label}
    </button>
  );
}

function ModeSwitcher({ mode, onChange, canUseClaude }: { mode: AppMode; onChange: (m: AppMode) => void; canUseClaude: boolean }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-2xl mx-auto w-fit" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <button onClick={() => onChange("claude")} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
        style={mode === "claude" ? { background: "linear-gradient(135deg, rgba(124,58,237,0.3), rgba(37,99,235,0.3))", border: "1px solid rgba(124,58,237,0.5)", color: "#c4b5fd" } : { color: "#6b6b8a", border: "1px solid transparent" }}>
        <span>⬡</span> Claude Mega Prompt
        <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(124,58,237,0.2)", color: "#a78bfa", fontSize: "10px" }}>v2.3</span>
        {!canUseClaude && <span className="text-xs" style={{ opacity: 0.6 }}>🔒</span>}
      </button>
      <button onClick={() => onChange("generic")} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
        style={mode === "generic" ? { background: "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(16,185,129,0.2))", border: "1px solid rgba(6,182,212,0.4)", color: "#67e8f9" } : { color: "#6b6b8a", border: "1px solid transparent" }}>
        <span>✦</span> Generic LLM Prompt
      </button>
    </div>
  );
}

/* ─────────────────────── Quota Wall ─────────────────────── */
function QuotaWall() {
  const [, navigate] = useLocation();
  return (
    <div className="glass-card rounded-2xl p-8 mt-6 text-center fade-up" style={{ borderTop: "2px solid #ff3cac", background: "rgba(255,60,172,0.04)" }}>
      <div className="text-4xl mb-4">⚡</div>
      <h3 className="text-xl mb-2" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, color: "#f0f0ff" }}>You've used your free prompt</h3>
      <p className="text-sm mb-6" style={{ color: "#6b6b8a" }}>Upgrade to keep generating. Plans start at $9/month.</p>
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => navigate("/pricing")} className="btn-gradient px-6 py-3 rounded-xl text-sm font-semibold">
          View Plans →
        </button>
        <button onClick={() => navigate("/pricing")} className="px-6 py-3 rounded-xl text-sm font-medium" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f0f0ff" }}>
          See what's included
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────── Unauthenticated wall ─────────────────────── */
function AuthWall() {
  const [, navigate] = useLocation();
  return (
    <div className="glass-card rounded-2xl p-8 mt-6 text-center fade-up" style={{ borderTop: "2px solid rgba(124,58,237,0.5)" }}>
      <div className="text-4xl mb-4">🔐</div>
      <h3 className="text-xl mb-2" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, color: "#f0f0ff" }}>Sign in to generate</h3>
      <p className="text-sm mb-6" style={{ color: "#6b6b8a" }}>Create a free account. Get 1 mega prompt on us.</p>
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => navigate("/auth")} className="btn-gradient px-6 py-3 rounded-xl text-sm font-semibold">Create Free Account →</button>
        <button onClick={() => navigate("/auth")} className="px-6 py-3 rounded-xl text-sm font-medium" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f0f0ff" }}>Sign In</button>
      </div>
    </div>
  );
}

/* ─────────────────────── Claude Result Renderer ─────────────────────── */
function ClaudeResultCard({ result, onSave }: { result: ClaudeResult; onSave: (xml: string) => void }) {
  const [xmlExpanded, setXmlExpanded] = useState(false);

  if (result.status === "needs_clarification") {
    return (
      <div className="glass-card rounded-2xl p-6 mt-6 fade-up" style={{ borderLeft: "3px solid #fbbf24" }}>
        <div className="flex items-center gap-2 mb-4">
          <span>❓</span>
          <span className="font-semibold" style={{ color: "#fde68a" }}>Needs Clarification</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.15)", color: "#fde68a", border: "1px solid rgba(251,191,36,0.3)" }}>Completeness: {Math.round(result.completeness_score * 100)}%</span>
        </div>
        <p className="text-sm mb-4" style={{ color: "#6b6b8a" }}>Your request needs more detail:</p>
        <ol className="space-y-2 mb-4">
          {result.blocking_questions.map((q, i) => (
            <li key={i} className="flex gap-3 text-sm" style={{ color: "#f0f0ff" }}>
              <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24" }}>{i+1}</span>
              {q}
            </li>
          ))}
        </ol>
        {result.safe_assumptions_if_forced.length > 0 && (
          <details><summary className="text-xs cursor-pointer" style={{ color: "#6b6b8a" }}>Safe assumptions if proceeding anyway</summary>
            <ul className="mt-2 space-y-1">{result.safe_assumptions_if_forced.map((a,i) => <li key={i} className="text-xs" style={{ color: "#6b6b8a" }}>• {a}</li>)}</ul>
          </details>
        )}
      </div>
    );
  }

  if (result.status === "missing_data") {
    return (
      <div className="glass-card rounded-2xl p-6 mt-6 fade-up" style={{ borderLeft: "3px solid #f87171" }}>
        <div className="flex items-center gap-2 mb-3"><span>⚠</span><span className="font-semibold" style={{ color: "#fca5a5" }}>Missing Data</span></div>
        <ul className="space-y-1 mb-4">{result.gaps.map((g,i) => <li key={i} className="text-sm" style={{ color: "#f0f0ff" }}>• {g}</li>)}</ul>
        <p className="text-xs" style={{ color: "#6b6b8a" }}>To unblock: {result.what_would_unblock.join(" · ")}</p>
      </div>
    );
  }

  const { answer, scoring, assumptions, conflicts, confidence, needs_human_review } = result;
  const ei = answer.enriched_input;
  return (
    <div className="space-y-4 mt-6 fade-up">
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: SCORE_COLOR(scoring.score) }}>{Math.round(scoring.score * 100)}</div>
            <div><div className="text-sm font-semibold" style={{ color: "#f0f0ff" }}>Quality Score</div><div className="text-xs" style={{ color: "#6b6b8a" }}>Confidence: {Math.round(confidence * 100)}% · v{result.version}</div></div>
          </div>
          <div className="flex items-center gap-2">
            {needs_human_review && <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(251,191,36,0.15)", color: "#fde68a", border: "1px solid rgba(251,191,36,0.3)" }}>⚠ Review recommended</span>}
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "#6b6b8a", border: "1px solid rgba(255,255,255,0.1)" }}>{ei.intent}</span>
            <span className="text-xs px-2 py-1 rounded-full capitalize" style={{ background: "rgba(255,255,255,0.05)", color: "#6b6b8a", border: "1px solid rgba(255,255,255,0.1)" }}>{ei.complexity}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {Object.entries(scoring.breakdown).map(([k, v]) => (
            <div key={k} className="p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="text-xs mb-1 capitalize" style={{ color: "#6b6b8a" }}>{k.replace(/_/g," ")}</div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-1 rounded-full" style={{ width: `${v * 100}%`, background: SCORE_COLOR(v) }} />
                </div>
                <span className="text-xs font-mono" style={{ color: SCORE_COLOR(v) }}>{Math.round(v * 100)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs" style={{ color: "#6b6b8a" }}>
          Weakest: <span style={{ color: "#fbbf24" }}>{scoring.weakest_criterion.replace(/_/g," ")}</span>
          {scoring.repair_attempts_used > 0 && ` · ${scoring.repair_attempts_used} repair`}
          {scoring.penalties.length > 0 && ` · Penalties: ${scoring.penalties.join(", ")}`}
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5" style={{ borderLeft: "3px solid #2563eb" }}>
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#6b6b8a" }}>Enriched Input</div>
        <p className="text-sm mb-3" style={{ color: "#f0f0ff" }}>{ei.goal}</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {ei.constraints.map((c,i) => <span key={i} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", color: "#93c5fd" }}>✓ {c}</span>)}
        </div>
        {conflicts.length > 0 && <div className="mt-2 p-3 rounded-lg" style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)" }}><div className="text-xs font-semibold mb-1" style={{ color: "#fde68a" }}>⚡ Conflicts</div>{conflicts.map((c,i) => <p key={i} className="text-xs" style={{ color: "#fde68a" }}>• {c}</p>)}</div>}
        {assumptions.length > 0 && <details className="mt-2"><summary className="text-xs cursor-pointer" style={{ color: "#6b6b8a" }}>{assumptions.length} assumption(s)</summary><ul className="mt-2 space-y-1">{assumptions.map((a,i) => <li key={i} className="text-xs" style={{ color: "#6b6b8a" }}>• {a}</li>)}</ul></details>}
      </div>

      <div className="glass-card rounded-2xl p-5" style={{ borderLeft: "3px solid #7c3aed" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold" style={{ color: "#c4b5fd" }}>⬡ Claude Mega Prompt XML</span>
          <div className="flex items-center gap-2">
            <CopyButton text={answer.mega_prompt_xml} />
            <button onClick={() => { const blob = new Blob([answer.mega_prompt_xml], { type: "text/xml" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "mega-prompt.xml"; a.click(); }} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#6b6b8a" }}>↓ XML</button>
            <button onClick={() => onSave(answer.mega_prompt_xml)} className="px-3 py-1.5 rounded-lg text-xs font-medium btn-gradient">Save</button>
          </div>
        </div>
        <button onClick={() => setXmlExpanded(!xmlExpanded)} className="text-xs mb-2 flex items-center gap-1" style={{ color: "#7c3aed" }}>{xmlExpanded ? "▲ Collapse" : "▼ Expand prompt"}</button>
        {xmlExpanded && <pre className="font-mono-code text-xs leading-6 whitespace-pre-wrap overflow-auto max-h-96 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", color: "#d4d4f0", fontFamily: "'JetBrains Mono', monospace" }}>{answer.mega_prompt_xml}</pre>}
      </div>
    </div>
  );
}

/* ─────────────────────── Main page ─────────────────────── */
export default function Index() {
  const [, navigate] = useLocation();
  const { data: session } = authClient.useSession();
  const { data: customer } = useCustomer();
  const [mode, setMode] = useState<AppMode>("claude");
  const [activeTab, setActiveTab] = useState<NavTab>("generate");
  const [promptType, setPromptType] = useState<PromptType>("chat");
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Generic state
  const [idea, setIdea] = useState(""); const [generated, setGenerated] = useState("");
  const [genericLoading, setGenericLoading] = useState(false); const [genericError, setGenericError] = useState("");
  const [savedId, setSavedId] = useState<string|null>(null); const [currentRating, setCurrentRating] = useState(0);
  const [showQuota, setShowQuota] = useState(false);

  // Claude state
  const [claudeRequest, setClaudeRequest] = useState(""); const [claudeLocation, setClaudeLocation] = useState("");
  const [claudeIndustry, setClaudeIndustry] = useState(""); const [claudeLanguage, setClaudeLanguage] = useState("");
  const [claudeResult, setClaudeResult] = useState<ClaudeResult|null>(null);
  const [claudeLoading, setClaudeLoading] = useState(false); const [claudeError, setClaudeError] = useState("");
  const [claudeShowQuota, setClaudeShowQuota] = useState(false);

  // History
  const [history, setHistory] = useState<SavedPrompt[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const isLoggedIn = !!session?.user;
  const balance = customer?.balances?.["prompts"];
  const hasQuota = balance?.unlimited || (balance?.remaining ?? 0) > 0;
  const activePlan = customer?.subscriptions?.[0]?.planId ?? "free";

  // Plan rank helpers (mirrors backend PLAN_RANK)
  const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, agency: 3 };
  const hasPlan = (required: string) => (PLAN_RANK[activePlan] ?? 0) >= (PLAN_RANK[required] ?? 0);
  const canUseClaude = hasPlan("pro");   // Claude v2.3 = Pro+
  const canBulkExport = hasPlan("agency"); // Bulk export = Agency
  const isPriorityModel = hasPlan("pro"); // Pro/Agency get sonnet

  const fetchHistory = async () => {
    if (!isLoggedIn) return;
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/prompts");
      if (res.status === 401) { setHistory([]); return; }
      const data = await res.json() as { prompts: SavedPrompt[] };
      setHistory(data.prompts || []);
    } catch { /**/ } finally { setHistoryLoading(false); }
  };

  useEffect(() => { if (isLoggedIn) fetchHistory(); }, [isLoggedIn]);

  const handleSignOut = async () => { await authClient.signOut(); setUserMenuOpen(false); setHistory([]); };

  /* ── Generic generate ── */
  const generateGeneric = async () => {
    if (!idea.trim()) return;
    if (!isLoggedIn) return;
    if (!hasQuota) { setShowQuota(true); return; }
    setGenericLoading(true); setGenericError(""); setGenerated(""); setSavedId(null); setCurrentRating(0); setShowQuota(false);
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea, type: promptType }) });
      if (res.status === 402) { setShowQuota(true); return; }
      const data = await res.json() as { generated?: string; error?: string };
      if (data.error) throw new Error(data.error);
      setGenerated(data.generated || "");
      const saveRes = await fetch("/api/prompts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: idea.slice(0, 60), inputIdea: idea, generatedPrompt: data.generated, promptType, promptMode: "generic" }) });
      const saved = await saveRes.json() as { id?: string };
      if (saved.id) setSavedId(saved.id);
      fetchHistory();
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) { setGenericError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setGenericLoading(false); }
  };

  /* ── Claude generate ── */
  const generateClaude = async () => {
    if (!claudeRequest.trim()) return;
    if (!isLoggedIn) return;
    if (!hasQuota) { setClaudeShowQuota(true); return; }
    setClaudeLoading(true); setClaudeError(""); setClaudeResult(null); setClaudeShowQuota(false);
    try {
      const res = await fetch("/api/generate-claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request: claudeRequest, location: claudeLocation || undefined, industry: claudeIndustry || undefined, language: claudeLanguage || undefined }) });
      if (res.status === 402) { setClaudeShowQuota(true); return; }
      const data = await res.json() as { result?: ClaudeResult; error?: string };
      if (data.error) throw new Error(data.error);
      setClaudeResult(data.result!);
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) { setClaudeError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setClaudeLoading(false); }
  };

  const saveClaudePrompt = async (xml: string) => {
    await fetch("/api/prompts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: claudeRequest.slice(0, 60), inputIdea: claudeRequest, generatedPrompt: xml, promptType: "code", promptMode: "claude" }) });
    fetchHistory();
  };

  const handleRating = async (rating: number) => {
    setCurrentRating(rating);
    if (!savedId) return;
    await fetch(`/api/prompts/${savedId}/rating`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating }) });
    fetchHistory();
  };

  const handleRatingHistory = async (id: string, rating: number) => {
    await fetch(`/api/prompts/${id}/rating`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating }) });
    setHistory(prev => prev.map(p => p.id === id ? { ...p, rating } : p));
  };

  const deletePrompt = async (id: string) => {
    await fetch(`/api/prompts/${id}`, { method: "DELETE" });
    setHistory(prev => prev.filter(p => p.id !== id));
  };

  const exportPrompt = (p: SavedPrompt) => {
    const blob = new Blob([`# ${p.title}\n\n${p.generatedPrompt}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${p.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`; a.click();
  };

  return (
    <div className="min-h-screen" style={{ background: "#07070d" }}>
      <div className="spectrum-bar w-full" />

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <span className="text-2xl cursor-pointer" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800 }} onClick={() => navigate("/")}>
          <span className="gradient-text">Mega</span><span style={{ color: "#f0f0ff" }}>Prompt</span>
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {(["generate", "history", "templates"] as NavTab[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className="px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all duration-200" style={activeTab === tab ? { background: "rgba(124,58,237,0.2)", color: "#c4b5fd" } : { color: "#6b6b8a" }}>
                {tab === "generate" ? "✨ Generate" : tab === "history" ? "📋 History" : "📚 Templates"}
              </button>
            ))}
          </div>

          {/* User area */}
          {isLoggedIn ? (
            <div className="relative">
              <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "#f0f0ff" }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                  {session.user.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <span className="hidden md:block max-w-24 truncate">{session.user.name || session.user.email}</span>
                {!balance?.unlimited && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd" }}>{balance?.remaining ?? 0} left</span>}
                {balance?.unlimited && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(110,231,183,0.2)", color: "#6ee7b7" }}>∞</span>}
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl p-1 z-50" style={{ background: "#0f0f1a", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
                  <div className="px-3 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <div className="text-xs font-medium truncate" style={{ color: "#f0f0ff" }}>{session.user.email}</div>
                    <div className="text-xs capitalize mt-0.5" style={{ color: "#6b6b8a" }}>Plan: {activePlan}</div>
                  </div>
                  <button onClick={() => { navigate("/pricing"); setUserMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-white/5 transition-all" style={{ color: "#c4b5fd" }}>⚡ Upgrade Plan</button>
                  {["abd.rabo.940@gmail.com", "laglag980"].some(e => e.toLowerCase() === session.user.email?.toLowerCase()) && (
                    <button onClick={() => { navigate("/admin"); setUserMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-white/5 transition-all" style={{ color: "#fbbf24" }}>🛡 Admin Panel</button>
                  )}
                  <button onClick={handleSignOut} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-white/5 transition-all" style={{ color: "#f87171" }}>Sign Out</button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => navigate("/auth")} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ color: "#6b6b8a" }}>Sign In</button>
              <button onClick={() => navigate("/auth")} className="btn-gradient px-4 py-2 rounded-xl text-sm font-semibold">Sign Up Free</button>
            </div>
          )}
        </div>
      </nav>

      {/* ══════════ GENERATE ══════════ */}
      {activeTab === "generate" && (
        <div className="hero-grid py-12 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-5" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#c4b5fd" }}>⚡ Powered by Claude</div>
              <h1 className="text-5xl md:text-6xl mb-3" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, lineHeight: 1.1 }}>
                <span className="gradient-text">Mega Prompts</span><br /><span style={{ color: "#f0f0ff" }}>From Simple Ideas</span>
              </h1>
              <p className="text-lg" style={{ color: "#6b6b8a" }}>Choose your mode. Type an idea. Get a production-grade prompt.</p>
              {!isLoggedIn && (
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b6b8a" }}>
                  🎁 1 free prompt with every account — no credit card needed
                </div>
              )}
            </div>

            <div className="mb-8"><ModeSwitcher mode={mode} onChange={setMode} canUseClaude={isLoggedIn ? canUseClaude : true} /></div>

            {/* ── CLAUDE MODE ── */}
            {mode === "claude" && (
              <>
                {/* Plan gate: show upgrade wall for free/starter */}
                {isLoggedIn && !canUseClaude ? (
                  <div className="glass-card rounded-2xl p-8 text-center fade-up" style={{ borderTop: "2px solid rgba(124,58,237,0.5)", background: "linear-gradient(135deg, rgba(124,58,237,0.06), rgba(37,99,235,0.04))" }}>
                    <div className="text-4xl mb-4">⬡</div>
                    <h3 className="text-xl mb-2" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, color: "#f0f0ff" }}>Claude v2.3 is a Pro feature</h3>
                    <p className="text-sm mb-2" style={{ color: "#6b6b8a" }}>Structured XML output · intent detection · completeness scoring · repair loop</p>
                    <p className="text-sm mb-6" style={{ color: "#6b6b8a" }}>
                      You're on the <span style={{ color: "#c4b5fd", fontWeight: 600 }}>{activePlan}</span> plan. Upgrade to <span style={{ color: "#c4b5fd", fontWeight: 600 }}>Pro</span> to unlock.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => navigate("/pricing")} className="btn-gradient px-6 py-3 rounded-xl text-sm font-semibold">Upgrade to Pro →</button>
                      <button onClick={() => setMode("generic")} className="px-6 py-3 rounded-xl text-sm font-medium" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f0f0ff" }}>Use Generic mode</button>
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-3 text-left">
                      {["Intent detection & completeness scoring", "Conflict detection between requirements", "Auto-repair loop · Quality scoring"].map((f, i) => (
                        <div key={i} className="p-3 rounded-xl text-xs" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", color: "#c4b5fd" }}>✓ {f}</div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="glass-card rounded-2xl p-6" style={{ borderTop: "2px solid rgba(124,58,237,0.4)" }}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-semibold" style={{ color: "#c4b5fd" }}>⬡ Claude Mega Prompt Generator</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.2)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.3)" }}>v2.3 · Structured XML</span>
                      </div>
                      <p className="text-xs mb-5" style={{ color: "#6b6b8a" }}>Intent detection · completeness scoring · locale awareness · conflict detection · repair loop</p>
                      <label className="block text-xs mb-1.5 uppercase tracking-widest" style={{ color: "#6b6b8a" }}>Your request</label>
                      <textarea className="glow-input w-full rounded-xl p-4 text-base resize-none mb-4" rows={4} placeholder="e.g. Build a SaaS dashboard for a marketing agency in Amman..." value={claudeRequest} onChange={e => setClaudeRequest(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && e.metaKey) generateClaude(); }} />
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div><label className="block text-xs mb-1" style={{ color: "#6b6b8a" }}>Location</label><input className="glow-input w-full rounded-lg p-2.5 text-sm" placeholder="e.g. Amman, Jordan" value={claudeLocation} onChange={e => setClaudeLocation(e.target.value)} /></div>
                        <div><label className="block text-xs mb-1" style={{ color: "#6b6b8a" }}>Industry</label><input className="glow-input w-full rounded-lg p-2.5 text-sm" placeholder="e.g. fintech" value={claudeIndustry} onChange={e => setClaudeIndustry(e.target.value)} /></div>
                        <div><label className="block text-xs mb-1" style={{ color: "#6b6b8a" }}>Language</label><input className="glow-input w-full rounded-lg p-2.5 text-sm" placeholder="e.g. en, ar" value={claudeLanguage} onChange={e => setClaudeLanguage(e.target.value)} /></div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: "#6b6b8a" }}>⌘ + Enter · claude-opus-4-5</span>
                        {isLoggedIn ? (
                          <button className="btn-gradient px-6 py-3 rounded-xl text-sm" onClick={generateClaude} disabled={claudeLoading || !claudeRequest.trim()}>
                            {claudeLoading ? <span className="shimmer-text">Running pipeline...</span> : "⬡ Generate Claude Prompt"}
                          </button>
                        ) : (
                          <button className="btn-gradient px-6 py-3 rounded-xl text-sm" onClick={() => navigate("/auth")}>Sign Up to Generate →</button>
                        )}
                      </div>
                    </div>
                    {claudeError && <div className="mt-4 p-4 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>⚠ {claudeError}</div>}
                    {!isLoggedIn && <AuthWall />}
                    {isLoggedIn && claudeShowQuota && <QuotaWall />}
                    <div ref={outputRef}>{claudeResult && <ClaudeResultCard result={claudeResult} onSave={saveClaudePrompt} />}</div>
                  </>
                )}
              </>
            )}

            {/* ── GENERIC MODE ── */}
            {mode === "generic" && (
              <>
                <div className="glass-card rounded-2xl p-6" style={{ borderTop: "2px solid rgba(6,182,212,0.4)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-semibold" style={{ color: "#67e8f9" }}>✦ Generic LLM Prompt Generator</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(6,182,212,0.15)", color: "#67e8f9", border: "1px solid rgba(6,182,212,0.3)" }}>ChatGPT · Gemini · Mistral</span>
                  </div>
                  <p className="text-xs mb-5" style={{ color: "#6b6b8a" }}>Expands a rough idea into a richly detailed mega prompt for any LLM.</p>
                  <div className="flex gap-3 mb-5">
                    {(["chat", "image", "code"] as PromptType[]).map(t => <PromptTypePill key={t} type={t} active={promptType === t} onClick={() => setPromptType(t)} />)}
                  </div>
                  <label className="block text-xs mb-1.5 uppercase tracking-widest" style={{ color: "#6b6b8a" }}>Your idea</label>
                  <textarea className="glow-input w-full rounded-xl p-4 text-base resize-none" rows={4}
                    placeholder={promptType === "chat" ? "e.g. A Socratic tutor..." : promptType === "image" ? "e.g. A dragon above a medieval city..." : "e.g. A Python FastAPI backend..."}
                    value={idea} onChange={e => setIdea(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && e.metaKey) generateGeneric(); }} />
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: "#6b6b8a" }}>⌘ + Enter to generate</span>
                      {isLoggedIn && isPriorityModel && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#6ee7b7" }}>⚡ Sonnet model</span>}
                    </div>
                    {isLoggedIn ? (
                      <button className="btn-gradient px-6 py-3 rounded-xl text-sm" onClick={generateGeneric} disabled={genericLoading || !idea.trim()}>
                        {genericLoading ? <span className="shimmer-text">Generating...</span> : "✦ Generate Mega Prompt"}
                      </button>
                    ) : (
                      <button className="btn-gradient px-6 py-3 rounded-xl text-sm" onClick={() => navigate("/auth")}>Sign Up to Generate →</button>
                    )}
                  </div>
                </div>
                {genericError && <div className="mt-4 p-4 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>⚠ {genericError}</div>}
                {!isLoggedIn && <AuthWall />}
                {isLoggedIn && showQuota && <QuotaWall />}
                {generated && !showQuota && (
                  <div ref={outputRef} className="glass-card rounded-2xl p-6 mt-4 fade-up" style={{ borderLeft: "3px solid #06b6d4" }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: "#67e8f9" }}>✦ Mega Prompt</span>
                        <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: TYPE_META[promptType].tagColor, border: `1px solid ${TYPE_META[promptType].tagBorder}`, color: TYPE_META[promptType].tagText }}>{TYPE_META[promptType].icon} {TYPE_META[promptType].label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CopyButton text={generated} />
                        <button onClick={() => exportPrompt({ id: savedId||"", title: idea.slice(0,60), inputIdea: idea, generatedPrompt: generated, promptType, rating: currentRating, createdAt: Date.now() })} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#6b6b8a" }}>↓ Export</button>
                      </div>
                    </div>
                    <pre className="text-xs leading-7 whitespace-pre-wrap" style={{ color: "#d4d4f0", fontFamily: "'JetBrains Mono', monospace" }}>{generated}</pre>
                    <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                      <span className="text-xs" style={{ color: "#6b6b8a" }}>Rate this prompt</span>
                      <StarRating value={currentRating} onChange={handleRating} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════ HISTORY ══════════ */}
      {activeTab === "history" && (
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>Prompt History</h2>
              <span className="text-sm" style={{ color: "#6b6b8a" }}>{history.length} saved</span>
            </div>
            <div className="flex items-center gap-2">
              {isLoggedIn && canBulkExport && history.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { window.open("/api/prompts/export?format=md", "_blank"); }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{ background: "rgba(255,60,172,0.1)", border: "1px solid rgba(255,60,172,0.3)", color: "#ff3cac" }}
                  >
                    ↓ Export All (.md)
                  </button>
                  <button
                    onClick={() => { window.open("/api/prompts/export?format=csv", "_blank"); }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{ background: "rgba(255,60,172,0.07)", border: "1px solid rgba(255,60,172,0.2)", color: "#ff3cac" }}
                  >
                    ↓ CSV
                  </button>
                </div>
              )}
              {isLoggedIn && !canBulkExport && history.length > 0 && (
                <button
                  onClick={() => navigate("/pricing")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b6b8a" }}
                  title="Agency plan required"
                >
                  🔒 Bulk Export
                </button>
              )}
            </div>
          </div>
          {!isLoggedIn && (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🔐</div>
              <p className="mb-4" style={{ color: "#6b6b8a" }}>Sign in to see your prompt history</p>
              <button onClick={() => navigate("/auth")} className="btn-gradient px-6 py-3 rounded-xl text-sm">Sign In →</button>
            </div>
          )}
          {isLoggedIn && historyLoading && <div className="text-center py-20 shimmer-text" style={{ color: "#6b6b8a" }}>Loading...</div>}
          {isLoggedIn && !historyLoading && history.length === 0 && (
            <div className="text-center py-20" style={{ color: "#6b6b8a" }}><div className="text-5xl mb-4">📭</div><p>No prompts yet.</p></div>
          )}
          <div className="space-y-4">
            {history.map((p, i) => (
              <div key={p.id} className="glass-card rounded-2xl p-5 fade-up" style={{ animationDelay: `${i*0.05}s`, borderLeft: `3px solid ${p.promptMode === "claude" ? "#7c3aed" : p.promptType === "image" ? "#06b6d4" : "#10b981"}` }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-semibold truncate" style={{ color: "#f0f0ff" }}>{p.title}</span>
                      {p.promptMode === "claude" && <span className="shrink-0 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(124,58,237,0.2)", border: "1px solid #7c3aed", color: "#c4b5fd" }}>⬡ Claude</span>}
                      {p.promptMode !== "claude" && <span className="shrink-0 px-2 py-0.5 rounded-full text-xs" style={{ background: TYPE_META[p.promptType]?.tagColor, border: `1px solid ${TYPE_META[p.promptType]?.tagBorder}`, color: TYPE_META[p.promptType]?.tagText }}>{TYPE_META[p.promptType]?.icon} {TYPE_META[p.promptType]?.label}</span>}
                    </div>
                    <p className="text-sm mb-3 line-clamp-2" style={{ color: "#6b6b8a" }}>{p.generatedPrompt}</p>
                    <div className="flex items-center gap-4">
                      <StarRating value={p.rating} onChange={r => handleRatingHistory(p.id, r)} />
                      <span className="text-xs" style={{ color: "#6b6b8a" }}>{new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <CopyButton text={p.generatedPrompt} />
                    <button onClick={() => exportPrompt(p)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#6b6b8a" }}>↓</button>
                    <button onClick={() => deletePrompt(p.id)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>✕</button>
                  </div>
                </div>
                <details className="mt-3"><summary className="text-xs cursor-pointer" style={{ color: "#7c3aed" }}>View full prompt</summary>
                  <pre className="mt-3 p-3 rounded-xl text-xs leading-6 whitespace-pre-wrap overflow-auto" style={{ background: "rgba(255,255,255,0.03)", color: "#d4d4f0", fontFamily: "'JetBrains Mono', monospace" }}>{p.generatedPrompt}</pre>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════ TEMPLATES ══════════ */}
      {activeTab === "templates" && (
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="mb-8">
            <h2 className="text-3xl mb-2" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>Template Library</h2>
            <p style={{ color: "#6b6b8a" }}>Start from a template — opens in Generic LLM mode.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TEMPLATES.map((t, i) => (
              <div key={i} className="glass-card rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:scale-[1.02]" style={{ borderLeft: `3px solid ${t.color}` }} onClick={() => { setIdea(t.idea); setPromptType(t.type); setMode("generic"); setActiveTab("generate"); }}>
                <div className="flex items-start justify-between mb-3">
                  <span className="font-semibold" style={{ color: "#f0f0ff" }}>{t.label}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: TYPE_META[t.type].tagColor, border: `1px solid ${TYPE_META[t.type].tagBorder}`, color: TYPE_META[t.type].tagText }}>{TYPE_META[t.type].icon} {TYPE_META[t.type].label}</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "#6b6b8a" }}>{t.idea}</p>
                <button className="mt-3 text-xs font-medium" style={{ color: t.color }}>Use this template →</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer className="py-8 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-center gap-4 text-sm" style={{ color: "#6b6b8a" }}>
          <span>MegaPrompt — Built with Claude AI</span>
          <span>·</span>
          <a href="/pricing" style={{ color: "#c4b5fd", textDecoration: "none" }}>Pricing</a>
          {!isLoggedIn && <><span>·</span><a href="/auth" style={{ color: "#c4b5fd", textDecoration: "none" }}>Sign Up Free</a></>}
        </div>
      </footer>
    </div>
  );
}
