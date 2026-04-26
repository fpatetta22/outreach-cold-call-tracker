import { useState, useEffect, useCallback } from "react";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
// Replace these with your actual Supabase project values
const SUPABASE_URL = "https://sb_publishable_IMA5t4MGhfZMog4n3OOsPA_49y6ZYuM
.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5bGxjZGFqbHBzemtneGxlaWhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNDQxNDUsImV4cCI6MjA5MjcyMDE0NX0.F_EbRbN5IXJ6a7-Vyp7c1UVRtQ3v356YZ_DIWaueocA";

async function supabase(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ─── SUPABASE SQL SCHEMA (run this in your Supabase SQL editor) ───────────────
/*
create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  created_at timestamptz default now()
);

create table call_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  log_date date not null default current_date,
  calls_made int default 0,
  gate_guards int default 0,
  decision_makers int default 0,
  booked int default 0,
  demos int default 0,
  closed int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, log_date)
);

create index on call_logs(log_date);
create index on call_logs(user_id);
*/

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];
const pct = (n, d) => (d === 0 ? "0%" : `${Math.round((n / d) * 100)}%`);
const weekStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1); // Monday
  return d.toISOString().split("T")[0];
};

const METRICS = [
  { key: "calls_made", label: "Calls Made", color: "#2563eb", icon: "📞" },
  { key: "gate_guards", label: "Gate Guards", color: "#d97706", icon: "🛡" },
  { key: "decision_makers", label: "Decision Makers", color: "#16a34a", icon: "👤" },
  { key: "booked", label: "Booked", color: "#dc2626", icon: "📅" },
  { key: "demos", label: "Demos", color: "#7c3aed", icon: "🖥" },
  { key: "closed", label: "Closed", color: "#059669", icon: "💰" },
];

const emptyStats = () => ({
  calls_made: 0,
  gate_guards: 0,
  decision_makers: 0,
  booked: 0,
  demos: 0,
  closed: 0,
});

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) {
      setError("Please enter your name and email.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Upsert user by email
      const existing = await supabase(
        `/users?email=eq.${encodeURIComponent(email.trim().toLowerCase())}&select=id,name,email`
      );
      let user;
      if (existing && existing.length > 0) {
        user = existing[0];
      } else {
        const created = await supabase("/users", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase() }),
        });
        user = created[0];
      }
      localStorage.setItem("oc_user", JSON.stringify(user));
      onLogin(user);
    } catch (e) {
      setError("Something went wrong. Check your Supabase config.");
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div style={styles.loginWrap}>
      <div style={styles.loginCard}>
        <div style={styles.loginLogo}>
          <div style={styles.logoMark}>OC</div>
        </div>
        <h1 style={styles.loginTitle}>Outreach Collective</h1>
        <p style={styles.loginSub}>Cold Call Tracker · Sign in to track your progress</p>
        <div style={styles.field}>
          <label style={styles.label}>Full name</label>
          <input
            style={styles.input}
            placeholder="Jane Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Email address</label>
          <input
            style={styles.input}
            type="email"
            placeholder="jane@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>
        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.loginBtn} onClick={handleSubmit} disabled={loading}>
          {loading ? "Signing in..." : "Enter the tracker →"}
        </button>
      </div>
    </div>
  );
}

// ─── METRIC CARD ──────────────────────────────────────────────────────────────
function MetricCard({ metric, value, onIncrement, onDecrement }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricHeader}>
        <span style={{ ...styles.metricDot, background: metric.color }} />
        <span style={styles.metricLabel}>{metric.label}</span>
      </div>
      <div style={styles.metricValue}>{value}</div>
      <div style={styles.metricBtns}>
        <button
          style={styles.plusBtn}
          onClick={onIncrement}
          aria-label={`Add ${metric.label}`}
        >
          +1
        </button>
        <button
          style={styles.minusBtn}
          onClick={onDecrement}
          disabled={value === 0}
          aria-label={`Remove ${metric.label}`}
        >
          −
        </button>
      </div>
    </div>
  );
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────
function Leaderboard({ currentUserId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Sum all metrics this week grouped by user
        const data = await supabase(
          `/call_logs?log_date=gte.${weekStart()}&select=user_id,calls_made,gate_guards,decision_makers,booked,demos,closed,users(name)`
        );
        const byUser = {};
        for (const row of data || []) {
          const uid = row.user_id;
          if (!byUser[uid]) byUser[uid] = { name: row.users?.name || "Unknown", ...emptyStats() };
          for (const k of Object.keys(emptyStats())) byUser[uid][k] += row[k] || 0;
        }
        const sorted = Object.entries(byUser)
          .map(([uid, d]) => ({ uid, ...d }))
          .sort((a, b) => b.calls_made - a.calls_made);
        setRows(sorted);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>Weekly Leaderboard</h2>
      <p style={styles.sectionSub}>Week of {weekStart()} · ranked by calls made</p>
      {loading ? (
        <p style={styles.empty}>Loading...</p>
      ) : rows.length === 0 ? (
        <p style={styles.empty}>No calls logged this week yet. Be the first!</p>
      ) : (
        <div style={styles.boardList}>
          {rows.map((r, i) => (
            <div
              key={r.uid}
              style={{
                ...styles.boardRow,
                background: r.uid === currentUserId ? "#f0f9ff" : "white",
                borderLeft: r.uid === currentUserId ? "3px solid #2563eb" : "3px solid transparent",
              }}
            >
              <span style={styles.boardRank}>{medals[i] || `#${i + 1}`}</span>
              <div style={styles.boardAvatar}>
                {r.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.boardName}>
                  {r.name} {r.uid === currentUserId && <span style={styles.youBadge}>you</span>}
                </div>
                <div style={styles.boardSub}>
                  {r.booked} booked · {r.closed} closed · {pct(r.booked, r.calls_made)} booking rate
                </div>
              </div>
              <div style={styles.boardCalls}>{r.calls_made}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── STATISTICS ───────────────────────────────────────────────────────────────
function Statistics({ userId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await supabase(
          `/call_logs?user_id=eq.${userId}&order=log_date.desc&limit=14`
        );
        setLogs(data || []);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, [userId]);

  const totals = logs.reduce((acc, r) => {
    for (const k of Object.keys(emptyStats())) acc[k] = (acc[k] || 0) + (r[k] || 0);
    return acc;
  }, {});

  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>My Statistics</h2>
      <p style={styles.sectionSub}>Last 14 days</p>
      {loading ? (
        <p style={styles.empty}>Loading...</p>
      ) : (
        <>
          <div style={styles.statsGrid}>
            {METRICS.map((m) => (
              <div key={m.key} style={styles.statBox}>
                <div style={{ ...styles.statNum, color: m.color }}>{totals[m.key] || 0}</div>
                <div style={styles.statLabel}>{m.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <h3 style={styles.subhead}>Daily log</h3>
            {logs.length === 0 ? (
              <p style={styles.empty}>No logs yet.</p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    {METRICS.map((m) => (
                      <th key={m.key} style={styles.th}>{m.label.split(" ")[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((r) => (
                    <tr key={r.id}>
                      <td style={styles.td}>{r.log_date}</td>
                      {METRICS.map((m) => (
                        <td key={m.key} style={{ ...styles.td, textAlign: "center" }}>
                          {r[m.key] || 0}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ user }) {
  const [stats, setStats] = useState(emptyStats());
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [logId, setLogId] = useState(null);

  const loadToday = useCallback(async () => {
    try {
      const data = await supabase(
        `/call_logs?user_id=eq.${user.id}&log_date=eq.${today()}`
      );
      if (data && data.length > 0) {
        setLogId(data[0].id);
        const { id, user_id, log_date, created_at, updated_at, ...nums } = data[0];
        setStats(nums);
      }
    } catch (e) {
      console.error(e);
    }
  }, [user.id]);

  useEffect(() => { loadToday(); }, [loadToday]);

  const save = useCallback(async (newStats) => {
    setSaving(true);
    try {
      if (logId) {
        await supabase(`/call_logs?id=eq.${logId}`, {
          method: "PATCH",
          body: JSON.stringify({ ...newStats, updated_at: new Date().toISOString() }),
        });
      } else {
        const res = await supabase("/call_logs", {
          method: "POST",
          body: JSON.stringify({ user_id: user.id, log_date: today(), ...newStats }),
        });
        if (res && res[0]) setLogId(res[0].id);
      }
      setSavedMsg("Saved");
      setTimeout(() => setSavedMsg(""), 2000);
    } catch (e) {
      console.error(e);
      setSavedMsg("Error saving");
    }
    setSaving(false);
  }, [logId, user.id]);

  const increment = (key) => {
    const next = { ...stats, [key]: (stats[key] || 0) + 1 };
    setStats(next);
    save(next);
  };

  const decrement = (key) => {
    if (!stats[key]) return;
    const next = { ...stats, [key]: stats[key] - 1 };
    setStats(next);
    save(next);
  };

  const rates = [
    { label: "Gate Guard Rate", value: pct(stats.gate_guards, stats.calls_made), color: "#d97706" },
    { label: "Decision Maker Rate", value: pct(stats.decision_makers, stats.calls_made), color: "#16a34a" },
    { label: "Booking Rate", value: pct(stats.booked, stats.decision_makers), color: "#dc2626" },
    { label: "Show Rate", value: pct(stats.demos, stats.booked), color: "#7c3aed" },
    { label: "Close Rate", value: pct(stats.closed, stats.demos), color: "#059669" },
  ];

  return (
    <div style={styles.section}>
      <div style={styles.dashHeader}>
        <div>
          <h2 style={styles.sectionTitle}>Today's Activity</h2>
          <p style={styles.sectionSub}>Tap +1 to track your calls in real-time · {today()}</p>
        </div>
        <div style={styles.savedIndicator}>
          {saving ? "Saving..." : savedMsg === "Saved" ? "✅ Saved" : savedMsg}
        </div>
      </div>

      <div style={styles.metricsGrid}>
        {METRICS.map((m) => (
          <MetricCard
            key={m.key}
            metric={m}
            value={stats[m.key] || 0}
            onIncrement={() => increment(m.key)}
            onDecrement={() => decrement(m.key)}
          />
        ))}
      </div>

      <div style={styles.ratesGrid}>
        {rates.map((r) => (
          <div key={r.label} style={styles.rateBox}>
            <div style={{ ...styles.rateVal, color: r.color }}>{r.value}</div>
            <div style={styles.rateLabel}>{r.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("oc_user")); }
    catch { return null; }
  });
  const [tab, setTab] = useState("dashboard");

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "statistics", label: "Statistics" },
    { id: "leaderboard", label: "Leaderboard" },
  ];

  if (!user) return <LoginScreen onLogin={setUser} />;

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerLogoMark}>OC</div>
          <div>
            <div style={styles.headerTitle}>The Outreach Collective Cold Call Tracker</div>
            <div style={styles.headerSub}>Track your daily progress and compete with your community</div>
          </div>
        </div>
        <button style={styles.logoutBtn} onClick={() => { localStorage.removeItem("oc_user"); setUser(null); }}>
          Sign out
        </button>
      </header>

      <nav style={styles.nav}>
        {tabs.map((t) => (
          <button
            key={t.id}
            style={{ ...styles.navTab, ...(tab === t.id ? styles.navTabActive : {}) }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <div style={styles.navUser}>👤 {user.name}</div>
      </nav>

      <main style={styles.main}>
        {tab === "dashboard" && <Dashboard user={user} />}
        {tab === "statistics" && <Statistics userId={user.id} />}
        {tab === "leaderboard" && <Leaderboard currentUserId={user.id} />}
      </main>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = {
  app: { fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh", background: "#f8fafc", color: "#0f172a" },

  // Login
  loginWrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: 16 },
  loginCard: { background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: "2.5rem 2rem", width: "100%", maxWidth: 400 },
  loginLogo: { display: "flex", justifyContent: "center", marginBottom: 16 },
  logoMark: { width: 56, height: 56, borderRadius: 12, background: "#0f172a", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, letterSpacing: 1 },
  loginTitle: { fontSize: 22, fontWeight: 700, textAlign: "center", marginBottom: 4 },
  loginSub: { fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 28 },
  field: { marginBottom: 16 },
  label: { display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box" },
  error: { color: "#dc2626", fontSize: 13, marginBottom: 12 },
  loginBtn: { width: "100%", padding: "12px", background: "#0f172a", color: "white", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 8 },

  // Header
  header: { background: "white", borderBottom: "1px solid #e2e8f0", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  headerLeft: { display: "flex", alignItems: "center", gap: 14 },
  headerLogoMark: { width: 48, height: 48, borderRadius: 10, background: "#0f172a", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 },
  headerTitle: { fontSize: 18, fontWeight: 700 },
  headerSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  logoutBtn: { fontSize: 13, color: "#64748b", background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 12px", cursor: "pointer" },

  // Nav
  nav: { background: "white", borderBottom: "1px solid #e2e8f0", padding: "0 24px", display: "flex", alignItems: "center", gap: 0, overflowX: "auto" },
  navTab: { padding: "14px 20px", fontSize: 14, border: "none", background: "none", cursor: "pointer", color: "#64748b", borderBottom: "2px solid transparent", fontWeight: 500, whiteSpace: "nowrap" },
  navTabActive: { color: "#0f172a", borderBottom: "2px solid #0f172a" },
  navUser: { marginLeft: "auto", fontSize: 13, color: "#64748b", padding: "0 8px", whiteSpace: "nowrap" },

  // Main
  main: { padding: "24px", maxWidth: 1200, margin: "0 auto" },
  section: {},
  sectionTitle: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  sectionSub: { fontSize: 13, color: "#64748b", marginBottom: 24 },
  dashHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 },
  savedIndicator: { fontSize: 13, color: "#16a34a", fontWeight: 500 },

  // Metrics grid
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16, marginBottom: 24 },
  metricCard: { background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px", display: "flex", flexDirection: "column", gap: 8 },
  metricHeader: { display: "flex", alignItems: "center", gap: 8 },
  metricDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  metricLabel: { fontSize: 13, color: "#64748b", fontWeight: 500 },
  metricValue: { fontSize: 36, fontWeight: 800, lineHeight: 1.1 },
  metricBtns: { display: "flex", gap: 8, alignItems: "center" },
  plusBtn: { flex: 1, padding: "10px 0", background: "#0f172a", color: "white", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer" },
  minusBtn: { width: 36, height: 36, background: "white", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 20, cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" },

  // Rates
  ratesGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginTop: 8 },
  rateBox: { background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 12px" },
  rateVal: { fontSize: 22, fontWeight: 800 },
  rateLabel: { fontSize: 12, color: "#64748b", marginTop: 4 },

  // Leaderboard
  boardList: { display: "flex", flexDirection: "column", gap: 8 },
  boardRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "white", border: "1px solid #e2e8f0", borderRadius: 10 },
  boardRank: { fontSize: 18, width: 28, textAlign: "center", flexShrink: 0 },
  boardAvatar: { width: 36, height: 36, borderRadius: "50%", background: "#0f172a", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 },
  boardName: { fontSize: 14, fontWeight: 600 },
  boardSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  boardCalls: { fontSize: 20, fontWeight: 800, minWidth: 36, textAlign: "right" },
  youBadge: { fontSize: 10, background: "#dbeafe", color: "#1d4ed8", padding: "2px 6px", borderRadius: 99, marginLeft: 6, fontWeight: 600 },

  // Stats
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12, marginBottom: 8 },
  statBox: { background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 12px" },
  statNum: { fontSize: 28, fontWeight: 800 },
  statLabel: { fontSize: 12, color: "#64748b", marginTop: 4 },
  subhead: { fontSize: 15, fontWeight: 600, marginBottom: 12 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13, background: "white", borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0" },
  th: { padding: "10px 12px", textAlign: "left", background: "#f8fafc", color: "#64748b", fontWeight: 600, fontSize: 12, borderBottom: "1px solid #e2e8f0" },
  td: { padding: "10px 12px", borderBottom: "1px solid #f1f5f9", color: "#0f172a" },

  // Misc
  empty: { color: "#94a3b8", fontSize: 14, padding: "24px 0" },
};
