import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { authClient } from "../lib/auth";

/* ── Animated typing demo ── */
const DEMO_IDEAS = [
  { raw: "A Socratic tutor for math", out: "You are a Socratic mathematics tutor. Your role is to guide students toward insight through carefully sequenced questions rather than providing answers directly. When a student presents a problem, begin by assessing their current level of understanding…" },
  { raw: "Cyberpunk city at night", out: "Hyperrealistic cyberpunk metropolis at 2 AM, towering neon-lit skyscrapers bleeding magenta and cyan reflections onto rain-slicked asphalt, volumetric fog weaving between holographic billboards, shallow depth of field, shot on RED Monstro 8K…" },
  { raw: "REST API for a task app", out: "## Claude Code Project: Task Management REST API\n\n### CLAUDE.md\nBuild a production-ready REST API using Node.js + Fastify + PostgreSQL + Drizzle ORM with JWT authentication, rate limiting, input validation via Zod…" },
];

function TypingDemo() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"typing-in" | "showing" | "typing-out">("typing-in");
  const [displayed, setDisplayed] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const item = DEMO_IDEAS[idx];
    if (phase === "typing-in") {
      let i = 0;
      const tick = () => {
        i++;
        setDisplayed(item.out.slice(0, i));
        if (i < item.out.length) timerRef.current = setTimeout(tick, 12);
        else timerRef.current = setTimeout(() => setPhase("showing"), 2000);
      };
      timerRef.current = setTimeout(tick, 400);
    } else if (phase === "showing") {
      timerRef.current = setTimeout(() => setPhase("typing-out"), 1200);
    } else {
      timerRef.current = setTimeout(() => {
        setDisplayed("");
        setIdx(i => (i + 1) % DEMO_IDEAS.length);
        setPhase("typing-in");
      }, 300);
    }
    return () => clearTimeout(timerRef.current);
  }, [phase, idx]);

  const item = DEMO_IDEAS[idx];
  const typeColors = ["rgba(124,58,237,0.15)", "rgba(6,182,212,0.12)", "rgba(16,185,129,0.12)"];
  const typeBorders = ["rgba(124,58,237,0.4)", "rgba(6,182,212,0.4)", "rgba(16,185,129,0.4)"];
  const typeLabels = ["💬 Chat Prompt", "🎨 Image Prompt", "💻 Code Prompt"];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#0c0c18", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "monospace" }}>
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
        <div className="w-3 h-3 rounded-full" style={{ background: "#febc2e" }} />
        <div className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
        <span className="ml-2 text-xs" style={{ color: "#6b6b8a" }}>megaprompt — generator</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Input */}
        <div>
          <div className="text-xs mb-2 uppercase tracking-widest" style={{ color: "#6b6b8a" }}>Your idea</div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <span className="text-sm" style={{ color: "#f0f0ff" }}>{item.raw}</span>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: typeColors[idx], border: `1px solid ${typeBorders[idx]}`, color: typeBorders[idx] }}>{typeLabels[idx]}</span>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center gap-2">
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="text-xs px-3 py-1 rounded-full" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.3), rgba(37,99,235,0.3))", border: "1px solid rgba(124,58,237,0.4)", color: "#c4b5fd" }}>⚡ Mega Prompt</div>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>

        {/* Output */}
        <div>
          <div className="text-xs mb-2 uppercase tracking-widest" style={{ color: "#6b6b8a" }}>Generated</div>
          <div className="px-4 py-3 rounded-xl min-h-28 relative" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${typeBorders[idx]}22` }}>
            <span className="text-xs leading-6 whitespace-pre-wrap" style={{ color: "#d4d4f0" }}>
              {displayed}
              <span className="inline-block w-0.5 h-3.5 ml-0.5 align-middle animate-pulse" style={{ background: "#7c3aed" }} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Feature card ── */
function FeatureCard({ icon, title, desc, color, delay }: { icon: string; title: string; desc: string; color: string; delay: string }) {
  return (
    <div className="glass-card rounded-2xl p-6 fade-up" style={{ animationDelay: delay, borderTop: `2px solid ${color}` }}>
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold mb-2" style={{ fontFamily: "'Syne', sans-serif", color: "#f0f0ff" }}>{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: "#6b6b8a" }}>{desc}</p>
    </div>
  );
}

/* ── Step ── */
function Step({ n, title, desc, color }: { n: string; title: string; desc: string; color: string }) {
  return (
    <div className="flex gap-5">
      <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: `${color}22`, border: `1px solid ${color}55`, color }}>{n}</div>
      <div>
        <div className="font-semibold mb-1" style={{ color: "#f0f0ff" }}>{title}</div>
        <p className="text-sm" style={{ color: "#6b6b8a" }}>{desc}</p>
      </div>
    </div>
  );
}

/* ── Mode comparison card ── */
function ModeCard({ accent, badge, title, subtitle, bullets, icon }: { accent: string; badge: string; title: string; subtitle: string; bullets: string[]; icon: string }) {
  return (
    <div className="glass-card rounded-2xl p-7 flex flex-col h-full" style={{ borderTop: `2px solid ${accent}` }}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{icon}</span>
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: accent }}>{badge}</div>
          <div className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "#f0f0ff" }}>{title}</div>
        </div>
      </div>
      <p className="text-sm mb-5" style={{ color: "#6b6b8a" }}>{subtitle}</p>
      <ul className="space-y-2 flex-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "#d4d4f0" }}>
            <span style={{ color: accent, flexShrink: 0 }}>✓</span>{b}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Testimonial ── */
function Testimonial({ quote, name, role, avatar }: { quote: string; name: string; role: string; avatar: string }) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <p className="text-sm leading-relaxed mb-4" style={{ color: "#d4d4f0" }}>"{quote}"</p>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>{avatar}</div>
        <div>
          <div className="text-sm font-semibold" style={{ color: "#f0f0ff" }}>{name}</div>
          <div className="text-xs" style={{ color: "#6b6b8a" }}>{role}</div>
        </div>
      </div>
    </div>
  );
}

/* ── Main landing component ── */
export default function Landing() {
  const [, navigate] = useLocation();
  const { data: session } = authClient.useSession();
  const isLoggedIn = !!session?.user;

  const goToApp = () => navigate(isLoggedIn ? "/app" : "/auth");

  return (
    <div className="min-h-screen" style={{ background: "#07070d", color: "#f0f0ff" }}>
      <div className="spectrum-bar w-full" />

      {/* ─── NAV ─── */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto sticky top-0 z-50" style={{ background: "rgba(7,7,13,0.85)", backdropFilter: "blur(16px)" }}>
        <span className="text-2xl cursor-pointer" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800 }} onClick={() => navigate("/")}>
          <span className="gradient-text">Mega</span><span style={{ color: "#f0f0ff" }}>Prompt</span>
        </span>
        <div className="flex items-center gap-3">
          <a href="#features" className="hidden md:block text-sm px-3 py-2 rounded-lg transition-all" style={{ color: "#6b6b8a" }}>Features</a>
          <a href="#how" className="hidden md:block text-sm px-3 py-2 rounded-lg transition-all" style={{ color: "#6b6b8a" }}>How it works</a>
          <a href="/pricing" className="hidden md:block text-sm px-3 py-2 rounded-lg transition-all" style={{ color: "#6b6b8a" }}>Pricing</a>
          {isLoggedIn ? (
            <button onClick={() => navigate("/app")} className="btn-gradient px-4 py-2 rounded-xl text-sm font-semibold">Open App →</button>
          ) : (
            <>
              <button onClick={() => navigate("/auth")} className="text-sm px-4 py-2 rounded-xl" style={{ color: "#6b6b8a" }}>Sign In</button>
              <button onClick={() => navigate("/auth")} className="btn-gradient px-4 py-2 rounded-xl text-sm font-semibold">Start Free →</button>
            </>
          )}
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#c4b5fd" }}>
              ⚡ Powered by Claude AI · Free to start
            </div>
            <h1 className="text-5xl md:text-6xl mb-6" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, lineHeight: 1.1 }}>
              Turn rough ideas into<br />
              <span className="gradient-text">production-grade</span><br />
              <span style={{ color: "#f0f0ff" }}>AI prompts.</span>
            </h1>
            <p className="text-lg mb-8 leading-relaxed" style={{ color: "#6b6b8a", maxWidth: "480px" }}>
              MegaPrompt expands your one-liner into a richly detailed, structured prompt — for Claude, ChatGPT, Midjourney, or any AI tool. In seconds.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <button onClick={goToApp} className="btn-gradient px-8 py-4 rounded-2xl text-base font-bold">
                {isLoggedIn ? "Open Generator →" : "Start for Free →"}
              </button>
              <a href="#how" className="flex items-center gap-2 text-sm font-medium" style={{ color: "#6b6b8a" }}>
                See how it works <span>↓</span>
              </a>
            </div>
            <div className="flex items-center gap-6 mt-8">
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "#c4b5fd" }}>1 free</div>
                <div className="text-xs" style={{ color: "#6b6b8a" }}>prompt on signup</div>
              </div>
              <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.08)" }} />
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "#67e8f9" }}>3 modes</div>
                <div className="text-xs" style={{ color: "#6b6b8a" }}>Chat · Image · Code</div>
              </div>
              <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.08)" }} />
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "#6ee7b7" }}>No card</div>
                <div className="text-xs" style={{ color: "#6b6b8a" }}>needed to start</div>
              </div>
            </div>
          </div>

          {/* Live demo */}
          <div className="fade-up">
            <TypingDemo />
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-center mb-14">
          <h2 className="text-4xl mb-4" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>
            Everything you need to <span className="gradient-text">prompt better</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: "#6b6b8a" }}>
            Not just a text expander — a full prompt engineering pipeline.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          <FeatureCard icon="⬡" title="Claude v2.3 Mode" desc="Structured XML output with intent detection, completeness scoring, locale awareness, conflict detection, and an auto-repair loop." color="#7c3aed" delay="0s" />
          <FeatureCard icon="✦" title="Generic LLM Mode" desc="Optimised prompts for ChatGPT, Gemini, Mistral, and more. Choose between Chat, Image generation, or Code gen." color="#06b6d4" delay="0.05s" />
          <FeatureCard icon="📊" title="Quality Scoring" desc="Every Claude prompt is scored across clarity, specificity, format, and completeness. See exactly what to improve." color="#10b981" delay="0.1s" />
          <FeatureCard icon="📋" title="Prompt History" desc="Every prompt you generate is saved to your account. Rate, search, copy, export, or delete them anytime." color="#f59e0b" delay="0.15s" />
          <FeatureCard icon="📚" title="Template Library" desc="Jump-start with 8 curated templates across Chat, Image, and Code — just one click to populate the generator." color="#ec4899" delay="0.2s" />
          <FeatureCard icon="↓" title="Export Anywhere" desc="Copy to clipboard or export as Markdown and XML. Works with any AI tool — no lock-in." color="#a78bfa" delay="0.25s" />
        </div>
      </section>

      {/* ─── TWO MODES ─── */}
      <section className="max-w-6xl mx-auto px-6 py-24" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-center mb-14">
          <h2 className="text-4xl mb-4" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>
            Two modes. <span className="gradient-text">One tool.</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: "#6b6b8a" }}>Pick the mode that fits your workflow.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <ModeCard
            accent="#7c3aed"
            badge="Claude Mega Prompt · v2.3"
            icon="⬡"
            title="Structured XML Output"
            subtitle="Designed specifically for Claude. Goes beyond text — outputs structured XML with intent analysis, enriched context, and quality scoring."
            bullets={[
              "Intent detection & completeness analysis",
              "Locale awareness (language, region, industry)",
              "Conflict detection between requirements",
              "Auto-repair loop up to 2 attempts",
              "Confidence score + weakest criterion flagged",
              "Powered by claude-opus-4-5",
            ]}
          />
          <ModeCard
            accent="#06b6d4"
            badge="Generic LLM Prompt"
            icon="✦"
            title="Works With Any AI"
            subtitle="A universal prompt expander that works with ChatGPT, Gemini, Mistral, Llama — any model. Choose from 3 prompt types."
            bullets={[
              "Chat / LLM — define role, context, tone, format",
              "Image Gen — subject, style, lighting, composition, negatives",
              "Code Gen — Claude Code project structure with CLAUDE.md",
              "200–500 word output, copy-paste ready",
              "Powered by claude-haiku-4.5 for speed",
              "Copy, export as Markdown",
            ]}
          />
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how" className="max-w-4xl mx-auto px-6 py-24" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-center mb-14">
          <h2 className="text-4xl mb-4" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>
            How it <span className="gradient-text">works</span>
          </h2>
          <p className="text-lg" style={{ color: "#6b6b8a" }}>Three steps from idea to production prompt.</p>
        </div>
        <div className="space-y-10 max-w-xl mx-auto">
          <Step n="1" color="#7c3aed" title="Create a free account" desc="Sign up with email and password — no credit card needed. You get 1 free mega prompt immediately." />
          <div className="ml-5 w-px h-6" style={{ background: "rgba(255,255,255,0.06)" }} />
          <Step n="2" color="#06b6d4" title="Type your rough idea" desc='Write anything — "a Socratic math tutor" or "REST API for a task app". As rough or detailed as you like.' />
          <div className="ml-5 w-px h-6" style={{ background: "rgba(255,255,255,0.06)" }} />
          <Step n="3" color="#10b981" title="Get your mega prompt" desc="Claude expands your idea into a structured, detailed prompt. Copy it, rate it, save it, or export it as Markdown / XML." />
        </div>

        <div className="text-center mt-14">
          <button onClick={goToApp} className="btn-gradient px-10 py-4 rounded-2xl text-base font-bold">
            {isLoggedIn ? "Open Generator →" : "Try it free — no card needed →"}
          </button>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="max-w-6xl mx-auto px-6 py-24" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-center mb-12">
          <h2 className="text-4xl mb-4" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>
            Built for <span className="gradient-text">prompt engineers</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          <Testimonial quote="I used to spend 20 minutes crafting a good Claude prompt. Now I type my idea and it does the heavy lifting. The XML output is exactly what I needed." name="Sarah K." role="Product Designer" avatar="S" />
          <Testimonial quote="The Claude v2.3 mode is insane. It catches conflicts I didn't even notice in my requirements and scores the output. Feels like having a senior prompt engineer on the team." name="Arjun M." role="AI Engineer" avatar="A" />
          <Testimonial quote="The code gen prompts follow the Claude Code structure perfectly — CLAUDE.md, project layout, everything. Saved me hours on every new project." name="Omar T." role="Fullstack Developer" avatar="O" />
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="max-w-3xl mx-auto px-6 py-24 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="glass-card rounded-3xl p-12" style={{ borderTop: "2px solid rgba(124,58,237,0.5)", background: "linear-gradient(135deg, rgba(124,58,237,0.06), rgba(37,99,235,0.06))" }}>
          <div className="text-5xl mb-6">⚡</div>
          <h2 className="text-4xl mb-4" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>
            Start generating better prompts <span className="gradient-text">today</span>
          </h2>
          <p className="text-lg mb-8" style={{ color: "#6b6b8a" }}>
            Free account. 1 mega prompt on us. No credit card.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button onClick={goToApp} className="btn-gradient px-10 py-4 rounded-2xl text-base font-bold">
              {isLoggedIn ? "Open Generator →" : "Create Free Account →"}
            </button>
            <a href="/pricing" className="px-6 py-4 rounded-2xl text-sm font-medium" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f0f0ff" }}>
              See pricing →
            </a>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="py-10 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xl" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>
            <span className="gradient-text">Mega</span><span style={{ color: "#f0f0ff" }}>Prompt</span>
          </span>
          <div className="flex items-center gap-6 text-sm" style={{ color: "#6b6b8a" }}>
            <a href="/pricing" style={{ color: "#6b6b8a", textDecoration: "none" }}>Pricing</a>
            <a href="/auth" style={{ color: "#6b6b8a", textDecoration: "none" }}>Sign Up</a>
            <a href="/app" style={{ color: "#6b6b8a", textDecoration: "none" }}>Generator</a>
          </div>
          <span className="text-xs" style={{ color: "#6b6b8a" }}>Built with Claude AI · © 2025 MegaPrompt</span>
        </div>
      </footer>
    </div>
  );
}
