import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { authClient } from "../lib/auth";

/* ── Types ── */
interface AdminUser {
  id: string;
  name: string;
  email: string;
  createdAt: number;
  plan: string;
  autumnId?: string;
  promptCount: number;
}

interface Stats {
  total: number;
  totalUsers: number;
  byType: { promptType: string; count: number }[];
  byMode: { promptMode: string | null; count: number }[];
  dailyActivity: { date: string; count: number }[];
}

interface RevenueCustomer {
  id: string;
  name?: string;
  email?: string;
  subscriptions?: { product_id?: string; status?: string; current_period_end?: number }[];
}

/* ── Plan badge ── */
const PLAN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  free:    { bg: "rgba(107,107,138,0.15)", text: "#6b6b8a", border: "rgba(107,107,138,0.3)" },
  starter: { bg: "rgba(16,185,129,0.15)",  text: "#6ee7b7", border: "rgba(16,185,129,0.4)" },
  pro:     { bg: "rgba(124,58,237,0.15)",  text: "#c4b5fd", border: "rgba(124,58,237,0.4)" },
  agency:  { bg: "rgba(251,191,36,0.15)",  text: "#fbbf24", border: "rgba(251,191,36,0.4)" },
};

function PlanBadge({ plan }: { plan: string }) {
  const c = PLAN_COLORS[plan] ?? PLAN_COLORS.free;
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {plan}
    </span>
  );
}

/* ── Stat card ── */
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "20px 24px" }}>
      <div style={{ color: "#6b6b8a", fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{label}</div>
      <div style={{ color: "#e2e2f0", fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: "#6b6b8a", fontSize: 12, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

/* ── Mini bar chart ── */
function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ color: "#9b9bb8", fontSize: 12, textTransform: "capitalize" }}>{label}</span>
        <span style={{ color: "#e2e2f0", fontSize: 12, fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: color, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

/* ── Activity sparkline (simple SVG) ── */
function ActivityChart({ data }: { data: { date: string; count: number }[] }) {
  if (!data.length) return <div style={{ color: "#6b6b8a", fontSize: 13 }}>No activity data</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  const W = 100, H = 40;
  const pts = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * W;
    const y = H - (d.count / max) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 60 }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="#7c3aed" strokeWidth="2" />
      {data.map((d, i) => {
        const x = (i / Math.max(data.length - 1, 1)) * W;
        const y = H - (d.count / max) * H;
        return <circle key={i} cx={x} cy={y} r="1.5" fill="#c4b5fd" />;
      })}
    </svg>
  );
}

/* ── Change Plan Modal ── */
function ChangePlanModal({ user, onClose, onSave }: { user: AdminUser; onClose: () => void; onSave: (plan: string) => Promise<void> }) {
  const [plan, setPlan] = useState(user.plan);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave(plan);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: "#11111f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: 32, width: 380, maxWidth: "90vw" }} onClick={e => e.stopPropagation()}>
        <div style={{ color: "#e2e2f0", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Change Plan</div>
        <div style={{ color: "#6b6b8a", fontSize: 13, marginBottom: 24 }}>{user.name} · {user.email}</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
          {["free", "starter", "pro", "agency"].map(p => {
            const c = PLAN_COLORS[p];
            const active = plan === p;
            return (
              <button key={p} onClick={() => setPlan(p)} style={{ padding: "14px 16px", borderRadius: 12, border: `2px solid ${active ? c.border : "rgba(255,255,255,0.08)"}`, background: active ? c.bg : "rgba(255,255,255,0.02)", color: active ? c.text : "#6b6b8a", fontWeight: 600, fontSize: 14, textTransform: "capitalize", cursor: "pointer", transition: "all 0.15s" }}>
                {p}
              </button>
            );
          })}
        </div>

        {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 16, padding: "10px 14px", background: "rgba(248,113,113,0.1)", borderRadius: 8 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#6b6b8a", cursor: "pointer", fontWeight: 500 }}>Cancel</button>
          <button onClick={save} disabled={saving || plan === user.plan} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", background: plan === user.plan ? "rgba(124,58,237,0.2)" : "linear-gradient(135deg, #7c3aed, #2563eb)", color: plan === user.plan ? "#6b6b8a" : "white", cursor: plan === user.plan ? "default" : "pointer", fontWeight: 600 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Delete Confirm Modal ── */
function DeleteModal({ user, onClose, onConfirm }: { user: AdminUser; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setDeleting(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: "#11111f", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 20, padding: 32, width: 380, maxWidth: "90vw" }} onClick={e => e.stopPropagation()}>
        <div style={{ color: "#f87171", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Delete User</div>
        <div style={{ color: "#9b9bb8", fontSize: 14, marginBottom: 8 }}>This is permanent and cannot be undone.</div>
        <div style={{ color: "#e2e2f0", fontSize: 14, marginBottom: 24, padding: "12px 16px", background: "rgba(255,255,255,0.04)", borderRadius: 10 }}>
          <strong>{user.name}</strong> ({user.email})<br />
          <span style={{ color: "#6b6b8a", fontSize: 12 }}>{user.promptCount} prompts will be deleted</span>
        </div>

        {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 16, padding: "10px 14px", background: "rgba(248,113,113,0.1)", borderRadius: 8 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#6b6b8a", cursor: "pointer", fontWeight: 500 }}>Cancel</button>
          <button onClick={confirm} disabled={deleting} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #dc2626, #b91c1c)", color: "white", cursor: deleting ? "default" : "pointer", fontWeight: 600 }}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Admin Page ── */
export default function Admin() {
  const [, navigate] = useLocation();
  const { data: session, isPending } = authClient.useSession();

  const [tab, setTab] = useState<"users" | "stats" | "revenue">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [revenue, setRevenue] = useState<RevenueCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [changePlanUser, setChangePlanUser] = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);

  const ADMIN_EMAILS = ["abd.rabo.940@gmail.com", "laglag980"];
  const isAdmin = session?.user?.email && ADMIN_EMAILS.some(e => e.toLowerCase() === session.user.email.toLowerCase());

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { users: AdminUser[] };
      setUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as Stats;
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/revenue", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { customers?: RevenueCustomer[] };
      setRevenue(data.customers ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load revenue data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === "users") fetchUsers();
    else if (tab === "stats") fetchStats();
    else if (tab === "revenue") fetchRevenue();
  }, [tab, isAdmin, fetchUsers, fetchStats, fetchRevenue]);

  // Redirect if not admin
  useEffect(() => {
    if (!isPending && session && !isAdmin) navigate("/app");
    if (!isPending && !session) navigate("/auth");
  }, [isPending, session, isAdmin, navigate]);

  const handleChangePlan = async (plan: string) => {
    if (!changePlanUser) return;
    const res = await fetch(`/api/admin/users/${changePlanUser.id}/plan`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ plan }),
    });
    if (!res.ok) {
      const d = await res.json() as { error?: string };
      throw new Error(d.error ?? "Failed");
    }
    setUsers(prev => prev.map(u => u.id === changePlanUser.id ? { ...u, plan } : u));
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    const res = await fetch(`/api/admin/users/${deleteUser.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const d = await res.json() as { error?: string };
      throw new Error(d.error ?? "Failed");
    }
    setUsers(prev => prev.filter(u => u.id !== deleteUser.id));
  };

  if (isPending) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#07070d" }}>
        <div style={{ color: "#6b6b8a", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const filteredUsers = users.filter(u =>
    search === "" || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  // Plan breakdown from users
  const planBreakdown = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.plan] = (acc[u.plan] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ minHeight: "100vh", background: "#07070d", color: "#e2e2f0", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 32px", display: "flex", alignItems: "center", gap: 24, height: 60 }}>
        <button onClick={() => navigate("/app")} style={{ color: "#6b6b8a", background: "none", border: "none", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          ← App
        </button>
        <div style={{ color: "#e2e2f0", fontWeight: 700, fontSize: 16 }}>Admin Panel</div>
        <div style={{ flex: 1 }} />
        <div style={{ color: "#6b6b8a", fontSize: 12 }}>{session?.user?.email}</div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 32, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 4, width: "fit-content" }}>
          {(["users", "stats", "revenue"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: tab === t ? "rgba(124,58,237,0.25)" : "transparent", color: tab === t ? "#c4b5fd" : "#6b6b8a", fontWeight: 600, fontSize: 13, cursor: "pointer", textTransform: "capitalize", transition: "all 0.15s" }}>
              {t === "users" ? "👥 Users" : t === "stats" ? "📊 Stats" : "💰 Revenue"}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ color: "#f87171", fontSize: 13, marginBottom: 20, padding: "12px 16px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10 }}>
            {error}
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
              <input
                placeholder="Search by name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, maxWidth: 360, padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e2e2f0", fontSize: 14, outline: "none" }}
              />
              <div style={{ color: "#6b6b8a", fontSize: 13 }}>{filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}</div>
              <button onClick={fetchUsers} style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#9b9bb8", cursor: "pointer", fontSize: 13 }}>
                ↻ Refresh
              </button>
            </div>

            {/* Plan summary pills */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              {["free", "starter", "pro", "agency"].map(p => (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, border: `1px solid ${PLAN_COLORS[p].border}`, background: PLAN_COLORS[p].bg }}>
                  <span style={{ color: PLAN_COLORS[p].text, fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>{p}</span>
                  <span style={{ color: PLAN_COLORS[p].text, fontSize: 14, fontWeight: 700 }}>{planBreakdown[p] ?? 0}</span>
                </div>
              ))}
            </div>

            {loading ? (
              <div style={{ color: "#6b6b8a", fontSize: 14, padding: "40px 0", textAlign: "center" }}>Loading users…</div>
            ) : (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["User", "Plan", "Prompts", "Joined", "Actions"].map(h => (
                        <th key={h} style={{ padding: "14px 20px", textAlign: "left", color: "#6b6b8a", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u, i) => (
                      <tr key={u.id} style={{ borderBottom: i < filteredUsers.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", transition: "background 0.1s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <td style={{ padding: "16px 20px" }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: "#e2e2f0", marginBottom: 2 }}>{u.name}</div>
                          <div style={{ color: "#6b6b8a", fontSize: 12 }}>{u.email}</div>
                        </td>
                        <td style={{ padding: "16px 20px" }}><PlanBadge plan={u.plan} /></td>
                        <td style={{ padding: "16px 20px", color: "#9b9bb8", fontSize: 14, fontWeight: 600 }}>{u.promptCount}</td>
                        <td style={{ padding: "16px 20px", color: "#6b6b8a", fontSize: 13 }}>
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—"}
                        </td>
                        <td style={{ padding: "16px 20px" }}>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setChangePlanUser(u)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(124,58,237,0.3)", background: "rgba(124,58,237,0.1)", color: "#c4b5fd", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
                              Change Plan
                            </button>
                            <button onClick={() => setDeleteUser(u)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.07)", color: "#f87171", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && !loading && (
                      <tr><td colSpan={5} style={{ padding: "40px 20px", textAlign: "center", color: "#6b6b8a", fontSize: 14 }}>No users found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── STATS TAB ── */}
        {tab === "stats" && (
          <div>
            {loading ? (
              <div style={{ color: "#6b6b8a", fontSize: 14, padding: "40px 0", textAlign: "center" }}>Loading stats…</div>
            ) : stats ? (
              <div>
                {/* Top stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
                  <StatCard label="Total Prompts" value={stats.total} />
                  <StatCard label="Total Users" value={stats.totalUsers} />
                  <StatCard label="Avg Prompts/User" value={stats.totalUsers > 0 ? (stats.total / stats.totalUsers).toFixed(1) : "0"} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 32 }}>
                  {/* By type */}
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                    <div style={{ color: "#9b9bb8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>By Type</div>
                    {stats.byType.map(r => (
                      <MiniBar key={r.promptType} label={r.promptType} value={r.count} max={stats.total} color="#7c3aed" />
                    ))}
                  </div>

                  {/* By mode */}
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                    <div style={{ color: "#9b9bb8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>By Mode</div>
                    {stats.byMode.map(r => (
                      <MiniBar key={r.promptMode ?? "generic"} label={r.promptMode ?? "generic"} value={r.count} max={stats.total} color="#06b6d4" />
                    ))}
                  </div>

                  {/* Plan breakdown */}
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                    <div style={{ color: "#9b9bb8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>Users by Plan</div>
                    {["free", "starter", "pro", "agency"].map(p => (
                      <MiniBar key={p} label={p} value={planBreakdown[p] ?? 0} max={Math.max(...Object.values(planBreakdown), 1)} color={PLAN_COLORS[p].text} />
                    ))}
                  </div>
                </div>

                {/* Activity chart */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                  <div style={{ color: "#9b9bb8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>Prompt Activity — Last 30 Days</div>
                  <ActivityChart data={stats.dailyActivity} />
                  {stats.dailyActivity.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                      <span style={{ color: "#6b6b8a", fontSize: 11 }}>{stats.dailyActivity[0]?.date}</span>
                      <span style={{ color: "#6b6b8a", fontSize: 11 }}>{stats.dailyActivity[stats.dailyActivity.length - 1]?.date}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ color: "#6b6b8a", fontSize: 14 }}>No data</div>
            )}
          </div>
        )}

        {/* ── REVENUE TAB ── */}
        {tab === "revenue" && (
          <div>
            {loading ? (
              <div style={{ color: "#6b6b8a", fontSize: 14, padding: "40px 0", textAlign: "center" }}>Loading revenue data…</div>
            ) : (
              <>
                <div style={{ color: "#6b6b8a", fontSize: 13, marginBottom: 20 }}>
                  Data from Autumn · {revenue.length} customer{revenue.length !== 1 ? "s" : ""}
                </div>
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                        {["Customer", "Plan", "Status", "Renewal"].map(h => (
                          <th key={h} style={{ padding: "14px 20px", textAlign: "left", color: "#6b6b8a", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {revenue.map((c, i) => {
                        const sub = c.subscriptions?.[0];
                        const plan = sub?.product_id ?? "free";
                        const status = sub?.status ?? "—";
                        const renewal = sub?.current_period_end ? new Date(sub.current_period_end * 1000).toLocaleDateString() : "—";
                        return (
                          <tr key={c.id} style={{ borderBottom: i < revenue.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                            <td style={{ padding: "14px 20px" }}>
                              <div style={{ fontWeight: 600, fontSize: 14, color: "#e2e2f0" }}>{c.name || c.email || c.id}</div>
                              {c.email && c.name && <div style={{ color: "#6b6b8a", fontSize: 12 }}>{c.email}</div>}
                            </td>
                            <td style={{ padding: "14px 20px" }}><PlanBadge plan={plan} /></td>
                            <td style={{ padding: "14px 20px" }}>
                              <span style={{ color: status === "active" ? "#6ee7b7" : "#6b6b8a", fontSize: 13, fontWeight: 500, textTransform: "capitalize" }}>{status}</span>
                            </td>
                            <td style={{ padding: "14px 20px", color: "#6b6b8a", fontSize: 13 }}>{renewal}</td>
                          </tr>
                        );
                      })}
                      {revenue.length === 0 && (
                        <tr><td colSpan={4} style={{ padding: "40px 20px", textAlign: "center", color: "#6b6b8a", fontSize: 14 }}>No customer data from Autumn</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {changePlanUser && (
        <ChangePlanModal user={changePlanUser} onClose={() => setChangePlanUser(null)} onSave={handleChangePlan} />
      )}
      {deleteUser && (
        <DeleteModal user={deleteUser} onClose={() => setDeleteUser(null)} onConfirm={handleDelete} />
      )}
    </div>
  );
}
