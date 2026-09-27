import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Clock3,
  Globe2,
  Moon,
  Plus,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  Waypoints,
} from "lucide-react";
import "./styles.css";
import "./enhancements.css";

type Domain = {
  id: number;
  name: string;
  label?: string;
  last_scan_at?: string;
};
type Event = {
  id: number;
  severity: string;
  title: string;
  detail: string;
  created_at: string;
};
type Scan = {
  id: number;
  status: string;
  stats: Record<string, number>;
  started_at?: string;
};
type Asset = {
  id: number;
  hostname: string;
  state: string;
  data: any;
  last_seen: string;
};
type Candidate = {
  id: number;
  hostname: string;
  technique: string;
  score: number;
  state: string;
  signals: string[];
  data: any;
};
const authHeaders = (): Record<string, string> =>
  localStorage.spoofscopeKey
    ? { "X-SpoofScope-Key": localStorage.spoofscopeKey }
    : {};
const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  if (!r.ok) throw new Error((await r.json()).detail || "Request failed");
  return r.json();
};
const ago = (d?: string) =>
  d
    ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        -Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 60000)),
        "minute",
      )
    : "Never";

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <Radar />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
export function App() {
  const [dark, setDark] = useState(localStorage.theme !== "light"),
    [domains, setDomains] = useState<Domain[]>([]),
    [dash, setDash] = useState<any>(),
    [selected, setSelected] = useState<number>(),
    [detail, setDetail] = useState<any>(),
    [modal, setModal] = useState(false),
    [keyModal, setKeyModal] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = async () => {
    try {
      setLoading(true);
      const [ds, da] = await Promise.all([
        api<Domain[]>("/api/domains"),
        api<any>("/api/dashboard"),
      ]);
      setDomains(ds);
      setDash(da);
      if (selected) setDetail(await api(`/api/domains/${selected}`));
      setError("");
    } catch (e: any) {
      setError(e.message);
      if (e.message === "Authentication required") setKeyModal(true);
    } finally {
      setLoading(false);
    }
  };
  const boot = async () => {
    try {
      const response = await fetch("/api/health");
      const health = await response.json();
      if (health.authentication_required && !localStorage.spoofscopeKey) {
        setLoading(false);
        setKeyModal(true);
        return;
      }
      await load();
    } catch {
      setLoading(false);
      setError("Unable to reach the SpoofScope API");
    }
  };
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    if (selected) load();
    else boot();
  }, [selected]);
  const scan = async (id: number) => {
    try {
      await api(`/api/domains/${id}/scan`, { method: "POST" });
      await load();
      for (let i = 0; i < 150; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const latest = await api<any>(`/api/domains/${id}`);
        setDetail(latest);
        if (!["queued", "running"].includes(latest.scans?.[0]?.status)) {
          await load();
          break;
        }
      }
    } catch (e: any) {
      setError(e.message);
    }
  };
  const scanning = ["queued", "running"].includes(detail?.scans?.[0]?.status);
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <div className="mark">
            <Radar />
          </div>
          <div>
            <b>SpoofScope</b>
            <small>DEFENSIVE INTELLIGENCE</small>
          </div>
        </div>
        <nav>
          <button
            className={!selected ? "active" : ""}
            onClick={() => setSelected(undefined)}
          >
            <Waypoints />
            Overview
          </button>
          <span>MONITORING</span>
          {domains.map((d) => (
            <button
              className={selected === d.id ? "active" : ""}
              onClick={() => setSelected(d.id)}
              key={d.id}
            >
              <Globe2 />
              {d.label || d.name}
            </button>
          ))}
        </nav>
        <div className="guard">
          <ShieldCheck />
          <div>
            <b>Passive by default</b>
            <small>Bounded, explainable checks</small>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <p>SECURITY OPERATIONS / {selected ? "DOMAIN" : "OVERVIEW"}</p>
            <h1>
              {selected ? detail?.domain.name : "Exposure command center"}
            </h1>
          </div>
          <div className="actions">
            <button
              className="icon"
              title="Configure API key"
              aria-label="Configure API key"
              onClick={() => setKeyModal(true)}
            >
              <ShieldCheck />
            </button>
            <button
              className="icon"
              aria-label={dark ? "Use light theme" : "Use dark theme"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun /> : <Moon />}
            </button>
            {selected ? (
              <button
                className="primary"
                disabled={scanning}
                onClick={() => scan(selected)}
              >
                <RefreshCw className={scanning ? "spinning" : ""} />
                {scanning ? "Scanning…" : "Scan now"}
              </button>
            ) : (
              <button className="primary" onClick={() => setModal(true)}>
                <Plus />
                Add domain
              </button>
            )}
          </div>
        </header>
        {error && (
          <div className="error">
            <AlertTriangle />
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}
        {loading && !dash ? (
          <div className="loader">
            <Radar />
            Loading telemetry…
          </div>
        ) : selected ? (
          <DomainView data={detail} onBack={() => setSelected(undefined)} />
        ) : (
          <Dashboard data={dash} domains={domains} onSelect={setSelected} />
        )}
      </main>
      {modal && (
        <AddDomain
          close={() => setModal(false)}
          done={async () => {
            setModal(false);
            await load();
          }}
        />
      )}
      {keyModal && (
        <ApiKeyModal
          close={() => setKeyModal(false)}
          done={async () => {
            setKeyModal(false);
            await load();
          }}
        />
      )}
    </div>
  );
}
function Dashboard({
  data,
  domains,
  onSelect,
}: {
  data: any;
  domains: Domain[];
  onSelect: (n: number) => void;
}) {
  const c = data?.counts || {};
  return (
    <>
      <section className="metrics">
        <Metric
          icon={<Globe2 />}
          label="MONITORED DOMAINS"
          value={c.domains || 0}
          sub="Authorized scope"
        />
        <Metric
          icon={<Activity />}
          label="DISCOVERED ASSETS"
          value={c.assets || 0}
          sub="Current public surface"
        />
        <Metric
          icon={<Search />}
          label="SIMILAR DOMAINS"
          value={c.candidates || 0}
          sub="Requiring context"
        />
        <Metric
          icon={<Clock3 />}
          label="TIMELINE EVENTS"
          value={c.events || 0}
          sub="Recorded observations"
        />
      </section>
      <div className="grid">
        <section className="panel span2">
          <div className="panelhead">
            <div>
              <p>MONITORED SCOPE</p>
              <h2>Domain posture</h2>
            </div>
            <Badge tone="good">{domains.length} active</Badge>
          </div>
          {domains.length ? (
            <div className="domainlist">
              {domains.map((d) => (
                <button onClick={() => onSelect(d.id)} key={d.id}>
                  <div className="domainicon">
                    <Globe2 />
                  </div>
                  <div>
                    <b>{d.name}</b>
                    <small>Last observation {ago(d.last_scan_at)}</small>
                  </div>
                  <span>Open →</span>
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title="No monitored domains"
              body="Add a domain you control to establish the first baseline."
            />
          )}
        </section>
        <Timeline events={data?.events || []} />
        <section className="panel span2">
          <div className="panelhead">
            <div>
              <p>SCAN OPERATIONS</p>
              <h2>Recent runs</h2>
            </div>
          </div>
          {data?.scans?.length ? (
            <table>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Status</th>
                  <th>Assets</th>
                  <th>Candidates</th>
                </tr>
              </thead>
              <tbody>
                {data.scans.map((s: Scan) => (
                  <tr key={s.id}>
                    <td>#{s.id}</td>
                    <td>
                      <Badge
                        tone={
                          s.status === "completed"
                            ? "good"
                            : s.status === "failed"
                              ? "danger"
                              : "warn"
                        }
                      >
                        {s.status}
                      </Badge>
                    </td>
                    <td>{s.stats?.assets ?? "—"}</td>
                    <td>{s.stats?.candidates ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty
              title="No scans yet"
              body="Start a scan from a domain workspace."
            />
          )}
        </section>
      </div>
    </>
  );
}
function DomainView({ data, onBack }: { data: any; onBack: () => void }) {
  if (!data) return <div className="loader">Loading domain…</div>;
  const assets: Asset[] = data.assets,
    cands: Candidate[] = data.candidates;
  const activeAssets = assets.filter((a) => a.state !== "DISAPPEARED");
  return (
    <>
      <button className="back" onClick={onBack}>
        <ArrowLeft />
        All domains
      </button>
      <section className="metrics">
        <Metric
          icon={<Activity />}
          label="ACTIVE ASSETS"
          value={activeAssets.length}
          sub={`${assets.filter((a) => a.state === "NEW").length} newly observed`}
        />
        <Metric
          icon={<Search />}
          label="SIMILAR DOMAINS"
          value={cands.filter((c) => c.state !== "DISAPPEARED").length}
          sub={`${cands.filter((c) => c.score >= 60 && c.state !== "DISAPPEARED").length} high relevance`}
        />
        <Metric
          icon={<ShieldCheck />}
          label="HTTPS HOSTS"
          value={
            activeAssets.filter((a) => a.data?.tls && !a.data.tls.error).length
          }
          sub="Certificate observed"
        />
        <Metric
          icon={<Clock3 />}
          label="LAST SCAN"
          value={data.scans[0]?.status || "—"}
          sub={ago(data.domain.last_scan_at)}
        />
      </section>
      <div className="grid">
        <section className="panel span2">
          <div className="panelhead">
            <div>
              <p>ATTACK SURFACE</p>
              <h2>Observed public assets</h2>
            </div>
          </div>
          {assets.length ? (
            <div className="cards">
              {assets.map((a) => (
                <article
                  key={a.id}
                  className={a.state === "DISAPPEARED" ? "dimmed" : ""}
                >
                  <div>
                    <b>{a.hostname}</b>
                    <Badge
                      tone={
                        a.state === "NEW"
                          ? "accent"
                          : a.state === "DISAPPEARED"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {a.state}
                    </Badge>
                  </div>
                  <p>{a.data.http?.title || "No HTML title observed"}</p>
                  <footer>
                    <span>HTTP {a.data.http?.status || "—"}</span>
                    <span>
                      {(a.data.http?.technologies || []).join(", ") ||
                        "Technology unknown"}
                    </span>
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="No exposure baseline"
              body="Run a scan to collect DNS, HTTP and TLS observations."
            />
          )}
        </section>
        <Timeline events={data.events} />
        <section className="panel full">
          <div className="panelhead">
            <div>
              <p>IMPERSONATION WATCH</p>
              <h2>Similar registered domains</h2>
            </div>
            <small>Scores indicate review priority, not maliciousness.</small>
          </div>
          {cands.length ? (
            <div className="candidategrid">
              {cands.map((c) => (
                <article
                  key={c.id}
                  className={c.state === "DISAPPEARED" ? "dimmed" : ""}
                >
                  {c.data.visual?.available && (
                    <SecureImage
                      path={c.data.visual.path}
                      alt={`Captured page for ${c.hostname}`}
                    />
                  )}
                  <div
                    className="score"
                    style={{ "--score": `${c.score}%` } as any}
                  >
                    <b>{c.score}</b>
                    <small>/100</small>
                  </div>
                  <div>
                    <h3>
                      {c.hostname}{" "}
                      <Badge
                        tone={
                          c.state === "NEW"
                            ? "accent"
                            : c.state === "DISAPPEARED"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {c.state}
                      </Badge>
                    </h3>
                    <p>
                      {c.technique} · {c.data.http?.title || "No page title"}
                      {c.data.rdap?.registered_at
                        ? ` · registered ${new Date(c.data.rdap.registered_at).toLocaleDateString()}`
                        : ""}
                    </p>
                    <div className="signals">
                      {c.signals.map((x) => (
                        <span key={x}>{x}</span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="No related domains observed"
              body="Generated candidates that do not resolve are intentionally omitted."
            />
          )}
        </section>
        <History domainId={data.domain.id} />
      </div>
    </>
  );
}
function SecureImage({ path, alt }: { path: string; alt: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`/api/screenshots/${path}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => {
        if (active) setSrc(URL.createObjectURL(b));
      })
      .catch(() => {});
    return () => {
      active = false;
      if (src) URL.revokeObjectURL(src);
    };
  }, [path]);
  return src ? <img className="capture" src={src} alt={alt} /> : null;
}
function History({ domainId }: { domainId: number }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    api<any[]>(`/api/domains/${domainId}/history?limit=20`)
      .then(setItems)
      .catch(() => setItems([]));
  }, [domainId]);
  return (
    <section className="panel full">
      <div className="panelhead">
        <div>
          <p>SNAPSHOT HISTORY</p>
          <h2>Immutable observations</h2>
        </div>
        <Badge>{items.length} recent</Badge>
      </div>
      {items.length ? (
        <table>
          <thead>
            <tr>
              <th>Observed</th>
              <th>Subject</th>
              <th>Type</th>
              <th>State</th>
              <th>Run</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id}>
                <td>{new Date(x.observed_at).toLocaleString()}</td>
                <td>{x.subject_key}</td>
                <td>{x.subject_type}</td>
                <td>
                  <Badge
                    tone={
                      x.state === "NEW"
                        ? "accent"
                        : x.state === "DISAPPEARED"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {x.state}
                  </Badge>
                </td>
                <td>#{x.scan_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty
          title="No snapshots yet"
          body="Each completed observation will be retained here."
        />
      )}
    </section>
  );
}
function Timeline({ events }: { events: Event[] }) {
  return (
    <section className="panel">
      <div className="panelhead">
        <div>
          <p>CHANGE FEED</p>
          <h2>Recent signals</h2>
        </div>
      </div>
      {events.length ? (
        <div className="timeline">
          {events.slice(0, 8).map((e) => (
            <div key={e.id}>
              <i className={e.severity} />
              <div>
                <b>{e.title}</b>
                <small>{e.detail}</small>
                <time>{ago(e.created_at)}</time>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="Quiet timeline"
          body="Changes will appear after observations are compared."
        />
      )}
    </section>
  );
}
function Metric({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: any;
  sub: string;
}) {
  return (
    <article className="metric">
      <div>
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{sub}</small>
    </article>
  );
}
function AddDomain({ close, done }: { close: () => void; done: () => void }) {
  const [name, setName] = useState(""),
    [label, setLabel] = useState(""),
    [ok, setOk] = useState(false),
    [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/domains", {
        method: "POST",
        body: JSON.stringify({ name, label: label || null, authorized: ok }),
      });
      done();
    } catch (x: any) {
      setErr(x.message);
    }
  };
  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label="Add domain"
    >
      <form onSubmit={submit}>
        <div className="panelhead">
          <div>
            <p>AUTHORIZED SCOPE</p>
            <h2>Add monitored domain</h2>
          </div>
          <button type="button" className="icon" onClick={close}>
            ×
          </button>
        </div>
        <label>
          Domain
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="example.com"
          />
        </label>
        <label>
          Display label <small>optional</small>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Example brand"
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            aria-label="Authorization confirmation"
            checked={ok}
            onChange={(e) => setOk(e.target.checked)}
          />
          <span>
            I confirm I control this domain or am authorized to monitor its
            public exposure.
          </span>
        </label>
        {err && <p className="formerror">{err}</p>}
        <button className="primary" disabled={!ok || !name}>
          Create monitoring scope
        </button>
      </form>
    </div>
  );
}
function ApiKeyModal({ close, done }: { close: () => void; done: () => void }) {
  const [value, setValue] = useState(localStorage.spoofscopeKey || "");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    localStorage.spoofscopeKey = value.trim();
    done();
  };
  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label="Configure API key"
    >
      <form onSubmit={submit}>
        <div className="panelhead">
          <div>
            <p>INSTANCE ACCESS</p>
            <h2>Configure API key</h2>
          </div>
          <button type="button" className="icon" onClick={close}>
            ×
          </button>
        </div>
        <p className="modalcopy">
          The key stays in this browser and is sent only to this SpoofScope
          instance.
        </p>
        <label>
          API key
          <input
            autoFocus
            type="password"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Paste SPOOFSCOPE_API_KEY"
          />
        </label>
        <button className="primary" disabled={!value.trim()}>
          Save and reconnect
        </button>
      </form>
    </div>
  );
}
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
