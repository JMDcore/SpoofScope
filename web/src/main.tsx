import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Database,
  Fingerprint,
  Globe2,
  KeyRound,
  Layers3,
  LockKeyhole,
  Moon,
  Network,
  Plus,
  Radar,
  RefreshCw,
  ScanSearch,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Sun,
  Waypoints,
  X,
  Zap,
} from "lucide-react";
import "./tokens.css";
import "./styles.css";
import "./enhancements.css";
import type {
  Asset,
  Candidate,
  DashboardData,
  Domain,
  DomainDetail,
  Scan,
  Snapshot,
} from "./types";
import {
  Badge,
  EmptyState,
  MetricCard,
  ScoreRing,
  SectionHeader,
  Timeline,
  relativeTime,
  stateTone,
} from "./ui";

const authHeaders = (): Record<string, string> =>
  localStorage.spoofscopeKey
    ? { "X-SpoofScope-Key": localStorage.spoofscopeKey }
    : {};

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  if (!response.ok) {
    throw new Error((await response.json()).detail || "Request failed");
  }
  return response.json();
};

const formatTechnique = (value: string) => value.replaceAll("-", " ");

export function App() {
  const [dark, setDark] = useState(localStorage.theme !== "light");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData>();
  const [selected, setSelected] = useState<number>();
  const [detail, setDetail] = useState<DomainDetail>();
  const [domainModal, setDomainModal] = useState(false);
  const [keyModal, setKeyModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const [domainRows, overview] = await Promise.all([
        api<Domain[]>("/api/domains"),
        api<DashboardData>("/api/dashboard"),
      ]);
      setDomains(domainRows);
      setDashboard(overview);
      if (selected) {
        setDetail(await api<DomainDetail>(`/api/domains/${selected}`));
      }
      setError("");
    } catch (exception: any) {
      setError(exception.message);
      if (exception.message === "Authentication required") setKeyModal(true);
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

  const scan = async (domainId: number) => {
    try {
      await api(`/api/domains/${domainId}/scan`, { method: "POST" });
      await load();
      for (let attempt = 0; attempt < 150; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const latest = await api<DomainDetail>(`/api/domains/${domainId}`);
        setDetail(latest);
        if (!["queued", "running"].includes(latest.scans?.[0]?.status)) {
          await load();
          break;
        }
      }
    } catch (exception: any) {
      setError(exception.message);
    }
  };

  const scanning = ["queued", "running"].includes(
    detail?.scans?.[0]?.status || "",
  );

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <Sidebar domains={domains} selected={selected} onSelect={setSelected} />

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-copy">
            <div className="breadcrumb">
              <span>Threat operations</span>
              <ChevronRight />
              <strong>{selected ? "Domain intelligence" : "Overview"}</strong>
            </div>
            <h1>
              {selected
                ? detail?.domain.name || "Loading domain intelligence…"
                : "Exposure command center"}
            </h1>
            <p>
              {selected
                ? "Evidence-led monitoring across infrastructure, identity and change."
                : "Continuous visibility into your public attack surface and lookalike ecosystem."}
            </p>
          </div>
          <div className="topbar-actions">
            <div className="system-pill">
              <i />
              Monitoring online
            </div>
            <button
              className="button button-icon"
              title="Configure API key"
              aria-label="Configure API key"
              onClick={() => setKeyModal(true)}
            >
              <KeyRound />
            </button>
            <button
              className="button button-icon"
              aria-label={dark ? "Use light theme" : "Use dark theme"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun /> : <Moon />}
            </button>
            {selected ? (
              <button
                className="button button-primary"
                disabled={scanning}
                onClick={() => scan(selected)}
              >
                <RefreshCw className={scanning ? "spinning" : ""} />
                {scanning ? "Scanning…" : "Scan now"}
              </button>
            ) : (
              <button
                className="button button-primary"
                onClick={() => setDomainModal(true)}
              >
                <Plus />
                Add domain
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="alert-banner" role="alert">
            <span>
              <AlertTriangle />
            </span>
            <div>
              <strong>Something needs attention</strong>
              <p>{error}</p>
            </div>
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X />
            </button>
          </div>
        )}

        <div className="view-stage" key={selected || "overview"}>
          {loading && !dashboard ? (
            <LoadingState />
          ) : selected ? (
            <DomainView data={detail} onBack={() => setSelected(undefined)} />
          ) : (
            <Dashboard
              data={dashboard}
              domains={domains}
              onSelect={setSelected}
            />
          )}
        </div>
      </main>

      {domainModal && (
        <AddDomain
          close={() => setDomainModal(false)}
          done={async () => {
            setDomainModal(false);
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

function Sidebar({
  domains,
  selected,
  onSelect,
}: {
  domains: Domain[];
  selected?: number;
  onSelect: (domain?: number) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="brand-mark">
          <Radar />
          <span />
        </div>
        <div>
          <strong>SpoofScope</strong>
          <small>Defensive intelligence</small>
        </div>
      </div>

      <div className="workspace-label">
        <span>Workspace</span>
        <Badge tone="good" dot>
          Live
        </Badge>
      </div>

      <nav className="navigation" aria-label="Main navigation">
        <button
          className={!selected ? "active" : ""}
          onClick={() => onSelect(undefined)}
        >
          <span className="nav-icon">
            <Waypoints />
          </span>
          <span className="nav-copy">
            <strong>Overview</strong>
            <small>Global monitoring posture</small>
          </span>
          <ChevronRight className="nav-arrow" />
        </button>

        <p className="nav-heading">Monitored scope</p>
        <div className="domain-navigation">
          {domains.map((domain) => (
            <button
              className={selected === domain.id ? "active" : ""}
              onClick={() => onSelect(domain.id)}
              key={domain.id}
            >
              <span className="nav-icon domain-nav-icon">
                <Globe2 />
              </span>
              <span className="nav-copy">
                <strong>{domain.label || domain.name}</strong>
                <small>{domain.name}</small>
              </span>
              <i className="status-dot" />
            </button>
          ))}
          {!domains.length && (
            <div className="sidebar-empty">
              <CircleDot />
              <span>No scopes configured</span>
            </div>
          )}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="passive-card">
          <span className="passive-icon">
            <ShieldCheck />
          </span>
          <div>
            <strong>Passive by default</strong>
            <small>Bounded, explainable collection</small>
          </div>
        </div>
        <div className="instance-meta">
          <span>SpoofScope 1.0</span>
          <span>Self-hosted</span>
        </div>
      </div>
    </aside>
  );
}

function Dashboard({
  data,
  domains,
  onSelect,
}: {
  data?: DashboardData;
  domains: Domain[];
  onSelect: (domain: number) => void;
}) {
  const counts = data?.counts || {};
  const hasCoverage = Boolean(domains.length);
  return (
    <>
      <section className="overview-hero enter-panel">
        <div className="hero-copy">
          <div className="hero-kicker">
            <Sparkles />
            Continuous domain intelligence
          </div>
          <h2>See the exposure shift before it becomes noise.</h2>
          <p>
            Correlate public assets, DNS and TLS changes, related domains and
            page-level impersonation signals in one defensible timeline.
          </p>
          <div className="hero-chips">
            <span>
              <Check /> Passive discovery
            </span>
            <span>
              <Check /> Explainable scoring
            </span>
            <span>
              <Check /> Immutable history
            </span>
          </div>
        </div>
        <div className="hero-radar" aria-hidden="true">
          <div className="radar-grid">
            <i />
            <i />
            <i />
            <span className="radar-sweep" />
            <span className="radar-point point-one" />
            <span className="radar-point point-two" />
            <div className="radar-center">
              <Radar />
            </div>
          </div>
          <div className="radar-caption">
            <strong>{hasCoverage ? "Active" : "Ready"}</strong>
            <span>
              {domains.length} monitored scope{domains.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Overview metrics">
        <MetricCard
          icon={<Globe2 />}
          label="Monitored domains"
          value={counts.domains || 0}
          sub="Authorized defensive scope"
          tone="mint"
          delay={40}
        />
        <MetricCard
          icon={<Network />}
          label="Discovered assets"
          value={counts.assets || 0}
          sub="Current public surface"
          tone="blue"
          delay={90}
        />
        <MetricCard
          icon={<ScanSearch />}
          label="Similar domains"
          value={counts.candidates || 0}
          sub="Evidence requiring context"
          tone="violet"
          delay={140}
        />
        <MetricCard
          icon={<Activity />}
          label="Timeline events"
          value={counts.events || 0}
          sub="Retained observations"
          tone="amber"
          delay={190}
        />
      </section>

      <div className="dashboard-grid">
        <section className="panel panel-domains enter-panel">
          <SectionHeader
            eyebrow="Monitored scope"
            title="Domain posture"
            description="Your authorized inventory and its latest observation state."
            action={
              <Badge tone="good" dot>
                {domains.length} active
              </Badge>
            }
          />
          {domains.length ? (
            <div className="domain-list">
              {domains.map((domain, index) => (
                <button
                  className="domain-row enter-item"
                  style={
                    { "--delay": `${index * 50}ms` } as React.CSSProperties
                  }
                  onClick={() => onSelect(domain.id)}
                  key={domain.id}
                >
                  <span className="domain-avatar">
                    <Globe2 />
                  </span>
                  <span className="domain-primary">
                    <strong>{domain.name}</strong>
                    <small>
                      {domain.label || "Authorized monitoring scope"}
                    </small>
                  </span>
                  <span className="domain-observation">
                    <small>Last observation</small>
                    <strong>{relativeTime(domain.last_scan_at)}</strong>
                  </span>
                  <span className="domain-open">
                    Open intelligence <ArrowUpRight />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No monitored domains"
              body="Add a domain you control to establish your first exposure baseline."
              icon={<Globe2 />}
            />
          )}
        </section>

        <section className="panel panel-timeline enter-panel">
          <SectionHeader
            eyebrow="Change feed"
            title="Recent signals"
            action={
              <span className="live-label">
                <i />
                Live
              </span>
            }
          />
          <Timeline events={data?.events || []} compact />
        </section>

        <section className="panel panel-scans enter-panel">
          <SectionHeader
            eyebrow="Scan operations"
            title="Recent runs"
            description="Collection health and output from the latest jobs."
          />
          <ScanTable scans={data?.scans || []} />
        </section>

        <section className="panel capability-panel enter-panel">
          <div className="capability-icon">
            <Fingerprint />
          </div>
          <div>
            <p className="eyebrow">Evidence model</p>
            <h2>Signals, never accusations.</h2>
            <p>
              Priority scores combine objective observations and remain
              explainable for analyst review.
            </p>
          </div>
          <div className="capability-stack">
            <span>DNS</span>
            <span>TLS</span>
            <span>DOM</span>
            <span>VISUAL</span>
          </div>
        </section>
      </div>
    </>
  );
}

function ScanTable({ scans }: { scans: Scan[] }) {
  return scans.length ? (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            <th>Run</th>
            <th>Status</th>
            <th>Assets</th>
            <th>Candidates</th>
            <th>Collection</th>
          </tr>
        </thead>
        <tbody>
          {scans.map((scan) => {
            const output =
              (scan.stats?.assets || 0) + (scan.stats?.candidates || 0);
            return (
              <tr key={scan.id}>
                <td>
                  <span className="run-id">
                    #{String(scan.id).padStart(3, "0")}
                  </span>
                </td>
                <td>
                  <Badge tone={stateTone(scan.status)} dot>
                    {scan.status}
                  </Badge>
                </td>
                <td>{scan.stats?.assets ?? "—"}</td>
                <td>{scan.stats?.candidates ?? "—"}</td>
                <td>
                  <div className="collection-bar">
                    <span
                      style={{
                        width: `${Math.min(100, Math.max(14, output * 12))}%`,
                      }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState
      title="No scans yet"
      body="Start a scan from a domain workspace to populate collection history."
      icon={<Activity />}
    />
  );
}

function DomainView({
  data,
  onBack,
}: {
  data?: DomainDetail;
  onBack: () => void;
}) {
  if (!data) return <LoadingState label="Loading domain intelligence…" />;

  const assets = data.assets || [];
  const candidates = data.candidates || [];
  const activeAssets = assets.filter((asset) => asset.state !== "DISAPPEARED");
  const activeCandidates = candidates.filter(
    (candidate) => candidate.state !== "DISAPPEARED",
  );
  const priorityCandidates = activeCandidates.filter(
    (candidate) => candidate.score >= 60,
  );
  const httpsHosts = activeAssets.filter(
    (asset) => asset.data?.tls && !asset.data.tls.error,
  );
  const latestScan = data.scans?.[0];

  return (
    <>
      <button className="back-button" onClick={onBack}>
        <ArrowLeft />
        All domains
      </button>
      <section className="domain-hero enter-panel">
        <div className="domain-identity">
          <span className="domain-hero-icon">
            <Globe2 />
          </span>
          <div>
            <div className="domain-title-line">
              <h2>{data.domain.name}</h2>
              <Badge tone="good" dot>
                Monitored
              </Badge>
            </div>
            <p>
              {data.domain.label || "Authorized domain intelligence workspace"}
            </p>
            <div className="domain-facts">
              <span>
                <Clock3 /> Last observed{" "}
                {relativeTime(data.domain.last_scan_at)}
              </span>
              <span>
                <Database /> {data.scans.length} retained runs
              </span>
              <span>
                <LockKeyhole /> Authorized scope
              </span>
            </div>
          </div>
        </div>
        <div className="domain-status-card">
          <span>Latest collection</span>
          <strong>{latestScan?.status || "Awaiting scan"}</strong>
          <Badge tone={stateTone(latestScan?.status)} dot>
            {latestScan ? `Run #${latestScan.id}` : "No baseline"}
          </Badge>
        </div>
      </section>

      <section className="metrics-grid domain-metrics">
        <MetricCard
          icon={<Network />}
          label="Active assets"
          value={activeAssets.length}
          sub={`${assets.filter((asset) => asset.state === "NEW").length} newly observed`}
          tone="mint"
          delay={30}
        />
        <MetricCard
          icon={<ScanSearch />}
          label="Similar domains"
          value={activeCandidates.length}
          sub={`${priorityCandidates.length} high-priority reviews`}
          tone="violet"
          delay={80}
        />
        <MetricCard
          icon={<LockKeyhole />}
          label="TLS observed"
          value={httpsHosts.length}
          sub="Hosts with certificate evidence"
          tone="blue"
          delay={130}
        />
        <MetricCard
          icon={<Activity />}
          label="Latest scan"
          value={latestScan?.status || "—"}
          sub={relativeTime(data.domain.last_scan_at)}
          tone="amber"
          delay={180}
        />
      </section>

      <div className="domain-grid">
        <section className="panel attack-panel enter-panel">
          <SectionHeader
            eyebrow="Attack surface"
            title="Observed public assets"
            description="DNS, HTTP and TLS evidence from the latest inventory."
            action={<Badge>{activeAssets.length} active</Badge>}
          />
          {assets.length ? (
            <div className="asset-grid">
              {assets.map((asset, index) => (
                <AssetCard asset={asset} index={index} key={asset.id} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No exposure baseline"
              body="Run a scan to collect DNS, HTTP and TLS observations."
              icon={<Server />}
            />
          )}
        </section>

        <section className="panel domain-timeline enter-panel">
          <SectionHeader
            eyebrow="Domain timeline"
            title="Change intelligence"
            action={<Badge>{data.events.length} events</Badge>}
          />
          <Timeline events={data.events} />
        </section>

        <section className="panel candidates-panel enter-panel">
          <SectionHeader
            eyebrow="Impersonation watch"
            title="Related domains requiring context"
            description="Priority is based on observed evidence and is not a maliciousness verdict."
            action={
              <div className="priority-legend">
                <span className="low">Low</span>
                <span className="medium">Review</span>
                <span className="high">Priority</span>
              </div>
            }
          />
          {candidates.length ? (
            <div className="candidate-grid">
              {candidates.map((candidate, index) => (
                <CandidateCard
                  candidate={candidate}
                  index={index}
                  key={candidate.id}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No related domains observed"
              body="Generated candidates that do not resolve are intentionally omitted."
              icon={<Search />}
            />
          )}
        </section>
        <History domainId={data.domain.id} />
      </div>
    </>
  );
}

function AssetCard({ asset, index }: { asset: Asset; index: number }) {
  const dnsCount = Object.values(asset.data?.dns || {}).flat().length;
  const technologies = asset.data?.http?.technologies || [];
  const status = asset.data?.http?.status;
  return (
    <article
      className={`asset-card enter-item ${asset.state === "DISAPPEARED" ? "is-dimmed" : ""}`}
      style={{ "--delay": `${index * 45}ms` } as React.CSSProperties}
    >
      <div className="asset-card-head">
        <span className="asset-icon">
          <Server />
        </span>
        <div>
          <strong>{asset.hostname}</strong>
          <small>{asset.data?.http?.title || "No HTML title observed"}</small>
        </div>
        <Badge tone={stateTone(asset.state)} dot>
          {asset.state}
        </Badge>
      </div>
      <div className="asset-facts">
        <span>
          <small>HTTP</small>
          <strong>{status || "—"}</strong>
        </span>
        <span>
          <small>DNS records</small>
          <strong>{dnsCount}</strong>
        </span>
        <span>
          <small>TLS</small>
          <strong>{asset.data?.tls?.version || "—"}</strong>
        </span>
      </div>
      <footer>
        <div className="technology-list">
          {technologies.length ? (
            technologies
              .slice(0, 3)
              .map((technology: string) => (
                <span key={technology}>{technology}</span>
              ))
          ) : (
            <span>Technology unknown</span>
          )}
        </div>
        <span className="asset-pulse">
          <i />
          Observed
        </span>
      </footer>
    </article>
  );
}

function CandidateCard({
  candidate,
  index,
}: {
  candidate: Candidate;
  index: number;
}) {
  const priority =
    candidate.score >= 60 ? "high" : candidate.score >= 35 ? "medium" : "low";
  const registered = candidate.data?.rdap?.registered_at;
  const structural = candidate.data?.structural_similarity;
  const visual = candidate.data?.visual_similarity;
  return (
    <article
      className={`candidate-card priority-${priority} enter-item ${candidate.state === "DISAPPEARED" ? "is-dimmed" : ""}`}
      style={{ "--delay": `${index * 55}ms` } as React.CSSProperties}
    >
      <div className="candidate-visual">
        {candidate.data?.visual?.available ? (
          <SecureImage
            path={candidate.data.visual.path}
            alt={`Captured page for ${candidate.hostname}`}
          />
        ) : (
          <div className="capture-placeholder">
            <Fingerprint />
            <span>Visual evidence unavailable</span>
          </div>
        )}
        <div className="candidate-priority">
          <span>
            {priority === "high"
              ? "Priority review"
              : priority === "medium"
                ? "Review"
                : "Context"}
          </span>
        </div>
      </div>
      <div className="candidate-body">
        <div className="candidate-heading">
          <div>
            <p>{formatTechnique(candidate.technique)}</p>
            <h3>{candidate.hostname}</h3>
          </div>
          <ScoreRing score={candidate.score} />
        </div>
        <div className="candidate-state-row">
          <Badge tone={stateTone(candidate.state)} dot>
            {candidate.state}
          </Badge>
          <span>{candidate.data?.http?.title || "No public page title"}</span>
        </div>
        <div className="signal-list">
          {candidate.signals.length ? (
            candidate.signals.slice(0, 5).map((signal) => (
              <span key={signal}>
                <Zap /> {signal}
              </span>
            ))
          ) : (
            <span className="muted-signal">No elevated page signals</span>
          )}
        </div>
        <footer className="candidate-footer">
          <span>
            <small>Registered</small>
            <strong>
              {registered
                ? new Date(registered).toLocaleDateString()
                : "Unavailable"}
            </strong>
          </span>
          <span>
            <small>DOM match</small>
            <strong>
              {typeof structural === "number"
                ? `${Math.round(structural * 100)}%`
                : "—"}
            </strong>
          </span>
          <span>
            <small>Visual match</small>
            <strong>
              {typeof visual === "number"
                ? `${Math.round(visual * 100)}%`
                : "—"}
            </strong>
          </span>
        </footer>
      </div>
    </article>
  );
}

function SecureImage({ path, alt }: { path: string; alt: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    fetch(`/api/screenshots/${path}`, { headers: authHeaders() })
      .then((response) => (response.ok ? response.blob() : Promise.reject()))
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setSrc(objectUrl);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  return src ? <img className="capture" src={src} alt={alt} /> : null;
}

function History({ domainId }: { domainId: number }) {
  const [items, setItems] = useState<Snapshot[]>([]);
  useEffect(() => {
    api<Snapshot[]>(`/api/domains/${domainId}/history?limit=20`)
      .then(setItems)
      .catch(() => setItems([]));
  }, [domainId]);
  return (
    <section className="panel history-panel enter-panel">
      <SectionHeader
        eyebrow="Snapshot history"
        title="Immutable observations"
        description="Evidence retained across completed collection runs."
        action={<Badge>{items.length} recent</Badge>}
      />
      {items.length ? (
        <div className="table-shell history-table">
          <table>
            <thead>
              <tr>
                <th>Observed</th>
                <th>Subject</th>
                <th>Evidence type</th>
                <th>State</th>
                <th>Run</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.observed_at).toLocaleString()}</td>
                  <td>
                    <span className="subject-key">{item.subject_key}</span>
                  </td>
                  <td>
                    <span className="type-label">{item.subject_type}</span>
                  </td>
                  <td>
                    <Badge tone={stateTone(item.state)} dot>
                      {item.state}
                    </Badge>
                  </td>
                  <td>
                    <span className="run-id">#{item.scan_id}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No snapshots yet"
          body="Each completed observation will be retained here."
          icon={<Layers3 />}
        />
      )}
    </section>
  );
}

function LoadingState({ label = "Loading telemetry…" }: { label?: string }) {
  return (
    <div className="loading-state">
      <div className="loading-radar">
        <Radar />
        <span />
      </div>
      <strong>{label}</strong>
      <p>Synchronizing the latest defensive intelligence.</p>
      <div className="loading-bars">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

function ModalShell({
  eyebrow,
  title,
  icon,
  close,
  children,
  ariaLabel,
}: {
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
  close: () => void;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div className="modal-card">
        <div className="modal-header">
          <span className="modal-icon">{icon}</span>
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          <button
            className="button button-icon"
            type="button"
            aria-label="Close modal"
            onClick={close}
          >
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddDomain({ close, done }: { close: () => void; done: () => void }) {
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api("/api/domains", {
        method: "POST",
        body: JSON.stringify({ name, label: label || null, authorized }),
      });
      done();
    } catch (exception: any) {
      setError(exception.message);
    }
  };
  return (
    <ModalShell
      eyebrow="Authorized scope"
      title="Add monitored domain"
      icon={<Globe2 />}
      close={close}
      ariaLabel="Add domain"
    >
      <p className="modal-copy">
        Establish a new defensive baseline for a domain you control or are
        explicitly authorized to monitor.
      </p>
      <form onSubmit={submit}>
        <label className="field-label">
          <span>Domain</span>
          <div className="input-shell">
            <Globe2 />
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="example.com"
            />
          </div>
        </label>
        <label className="field-label">
          <span>
            Display label <small>optional</small>
          </span>
          <div className="input-shell">
            <Sparkles />
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Example brand"
            />
          </div>
        </label>
        <label className="authorization-check">
          <input
            type="checkbox"
            aria-label="Authorization confirmation"
            checked={authorized}
            onChange={(event) => setAuthorized(event.target.checked)}
          />
          <span className="custom-check">
            <Check />
          </span>
          <span>
            <strong>Authorization confirmed</strong>I control this domain or
            have permission to monitor its public exposure.
          </span>
        </label>
        {error && <p className="form-error">{error}</p>}
        <button
          className="button button-primary modal-submit"
          disabled={!authorized || !name}
        >
          <Plus /> Create monitoring scope
        </button>
      </form>
    </ModalShell>
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
    <ModalShell
      eyebrow="Instance access"
      title="Connect to SpoofScope"
      icon={<KeyRound />}
      close={close}
      ariaLabel="Configure API key"
    >
      <p className="modal-copy">
        The key stays in this browser and is sent only to this self-hosted
        SpoofScope instance.
      </p>
      <form onSubmit={submit}>
        <label className="field-label">
          <span>API key</span>
          <div className="input-shell">
            <LockKeyhole />
            <input
              autoFocus
              type="password"
              autoComplete="off"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Paste SPOOFSCOPE_API_KEY"
            />
          </div>
        </label>
        <div className="privacy-note">
          <ShieldCheck />
          <span>Stored locally. Never transmitted to a third party.</span>
        </div>
        <button
          className="button button-primary modal-submit"
          disabled={!value.trim()}
        >
          <LockKeyhole /> Save and reconnect
        </button>
      </form>
    </ModalShell>
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
