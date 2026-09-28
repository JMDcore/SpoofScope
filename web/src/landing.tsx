import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Braces,
  Check,
  Eye,
  Fingerprint,
  Globe2,
  History,
  LockKeyhole,
  Network,
  Pause,
  Play,
  Radar,
  ScanSearch,
  Server,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import "./landing.css";

type LandingPageProps = {
  onOpenConsole: () => void;
};

type DemoView = "signals" | "surface";

const demoSignals = [
  {
    domain: "northstarlabs.example",
    technique: "Brand extension",
    score: 68,
    state: "NEW",
    evidence: "DNS + public page + structural match",
  },
  {
    domain: "north-star.example",
    technique: "Hyphenation",
    score: 42,
    state: "CHANGED",
    evidence: "TLS certificate + redirect change",
  },
  {
    domain: "northstarlab.example",
    technique: "Omission",
    score: 21,
    state: "UNCHANGED",
    evidence: "DNS only",
  },
];

const surfaceRows = [
  ["northstar.example", "200", "TLS 1.3", "Next.js"],
  ["status.northstar.example", "200", "TLS 1.3", "Unknown"],
  ["mail.northstar.example", "DNS", "Observed", "MX"],
];

export function LandingPage({ onOpenConsole }: LandingPageProps) {
  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
  }, []);

  return (
    <div className="landing-shell" id="top">
      <LandingHeader onOpenConsole={onOpenConsole} />
      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <p className="landing-label">
              <span /> Open-source defensive intelligence
            </p>
            <h1>
              Know what appears around <span>your domain.</span>
            </h1>
            <p className="landing-lead">
              SpoofScope continuously maps public exposure, related domains and
              impersonation signals into evidence your team can review and
              explain.
            </p>
            <div className="landing-actions">
              <button
                className="landing-button primary"
                onClick={onOpenConsole}
              >
                Open console <ArrowRight />
              </button>
              <a className="landing-button secondary" href="#platform">
                Explore platform
              </a>
            </div>
            <div className="landing-proof">
              <span>
                <Check /> Passive by default
              </span>
              <span>
                <Check /> Fully self-hosted
              </span>
              <span>
                <Check /> No AI dependency
              </span>
            </div>
          </div>
          <div className="hero-signal" aria-hidden="true">
            <div className="signal-orbit orbit-one" />
            <div className="signal-orbit orbit-two" />
            <div className="signal-axis horizontal" />
            <div className="signal-axis vertical" />
            <div className="signal-sweep" />
            <span className="signal-blip blip-one" />
            <span className="signal-blip blip-two" />
            <span className="signal-blip blip-three" />
            <div className="signal-core">
              <Radar />
            </div>
            <p>Continuous observation</p>
          </div>
        </section>

        <LandingDemo />

        <section
          className="landing-stat-strip"
          aria-label="Platform attributes"
        >
          <div>
            <strong>PASSIVE</strong>
            <span>Bounded collection</span>
          </div>
          <div>
            <strong>HISTORICAL</strong>
            <span>Immutable observations</span>
          </div>
          <div>
            <strong>EXPLAINABLE</strong>
            <span>Evidence-led priority</span>
          </div>
          <div>
            <strong>SELF-HOSTED</strong>
            <span>Your infrastructure</span>
          </div>
        </section>

        <section className="landing-intro" id="platform">
          <div>
            <p className="landing-label">Platform</p>
            <h2>
              Turn domain exposure into <span>reviewable intelligence.</span>
            </h2>
          </div>
          <div className="landing-intro-copy">
            <p>
              Go from a monitored domain to a retained baseline of public
              assets, DNS, TLS, related registrations and page-level evidence
              without stitching together disconnected tools.
            </p>
            <button className="landing-button primary" onClick={onOpenConsole}>
              Start monitoring <ArrowRight />
            </button>
          </div>
        </section>

        <ThreatFlow />
        <WorkflowBand />
        <FeatureMatrix />

        <section className="landing-cta">
          <div>
            <p className="landing-label dark-label">Deploy on your terms</p>
            <h2>Defensive monitoring, under your control.</h2>
            <p>
              One Docker Compose stack. Persistent history. No external AI
              service.
            </p>
            <button
              className="landing-button dark-button"
              onClick={onOpenConsole}
            >
              Open SpoofScope <ArrowRight />
            </button>
          </div>
          <div className="cta-terminal" aria-label="Deployment example">
            <div className="terminal-head">
              <span />
              <span />
              <span />
              <small>spoofscope / deploy</small>
            </div>
            <code>
              <i>$</i> git clone spoofscope
            </code>
            <code>
              <i>$</i> docker compose up -d
            </code>
            <code className="terminal-success">
              <Check /> monitoring stack healthy
            </code>
            <div className="terminal-services">
              <span>WEB</span>
              <span>API</span>
              <span>WORKER</span>
              <span>POSTGRES</span>
              <span>REDIS</span>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter onOpenConsole={onOpenConsole} />
    </div>
  );
}

function LandingHeader({ onOpenConsole }: LandingPageProps) {
  return (
    <header className="landing-header">
      <a className="landing-brand" href="#top" aria-label="SpoofScope home">
        <span className="landing-brand-mark">
          <Radar />
        </span>
        <span>
          <strong>SpoofScope</strong>
          <small>Defensive intelligence</small>
        </span>
      </a>
      <nav aria-label="Public navigation">
        <a href="#platform">Platform</a>
        <a href="#workflow">Workflow</a>
        <a href="#features">Capabilities</a>
      </nav>
      <button className="landing-button header-button" onClick={onOpenConsole}>
        Open console <ArrowRight />
      </button>
    </header>
  );
}

function LandingDemo() {
  const [view, setView] = useState<DemoView>("signals");
  const [domain, setDomain] = useState("northstar.example");
  const [phase, setPhase] = useState<"ready" | "running" | "complete">("ready");
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (phase !== "running") return;
    if (step >= 4) {
      setPhase("complete");
      return;
    }
    const timer = window.setTimeout(
      () => setStep((current) => current + 1),
      520,
    );
    return () => window.clearTimeout(timer);
  }, [phase, step]);

  const runDemo = () => {
    setStep(0);
    setPhase("running");
  };

  return (
    <section className="landing-demo" aria-labelledby="demo-title">
      <div className="demo-window-head">
        <div className="window-controls">
          <i />
          <i />
          <i />
        </div>
        <span>
          <LockKeyhole /> Local demo environment
        </span>
        <span className="demo-status">
          <i /> SYSTEM ONLINE
        </span>
      </div>
      <div className="demo-toolbar">
        <div>
          <p className="landing-label">Interactive product preview</p>
          <h2 id="demo-title">Investigate a monitored domain.</h2>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            runDemo();
          }}
        >
          <label>
            <span className="sr-only">Demo domain</span>
            <Globe2 />
            <input
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              aria-label="Demo domain"
            />
          </label>
          <button
            type="submit"
            disabled={!domain.trim() || phase === "running"}
          >
            {phase === "running" ? <Activity /> : <ScanSearch />}
            {phase === "running" ? "Collecting" : "Run demo"}
          </button>
        </form>
      </div>
      <div className="demo-progress" aria-live="polite">
        {["DNS", "TLS", "HTTP", "CORRELATE"].map((label, index) => (
          <span
            className={
              step > index || phase === "complete"
                ? "done"
                : step === index && phase === "running"
                  ? "active"
                  : ""
            }
            key={label}
          >
            <i /> {label}
          </span>
        ))}
        <small>
          {phase === "complete"
            ? `Demo evidence ready for ${domain}`
            : phase === "running"
              ? "Correlating public observations..."
              : "Demo data only. No network scan is performed."}
        </small>
      </div>
      <div className="demo-workspace">
        <aside>
          <p>Workspace</p>
          <button
            className={view === "signals" ? "active" : ""}
            onClick={() => setView("signals")}
          >
            <Radar /> Related signals <b>3</b>
          </button>
          <button
            className={view === "surface" ? "active" : ""}
            onClick={() => setView("surface")}
          >
            <Network /> Public surface <b>3</b>
          </button>
          <div className="demo-scope">
            <small>AUTHORIZED SCOPE</small>
            <strong>{domain || "No domain"}</strong>
            <span>
              <i /> Monitored
            </span>
          </div>
        </aside>
        <div className="demo-data">
          <div className="demo-data-head">
            <div>
              <p className="landing-label">
                {view === "signals" ? "Impersonation watch" : "Attack surface"}
              </p>
              <h3>
                {view === "signals"
                  ? "Related domains requiring context"
                  : "Observed public assets"}
              </h3>
            </div>
            <span>{view === "signals" ? "3 CANDIDATES" : "3 ASSETS"}</span>
          </div>
          {view === "signals" ? (
            <DemoSignals dimmed={phase === "running"} />
          ) : (
            <DemoSurface dimmed={phase === "running"} />
          )}
        </div>
      </div>
    </section>
  );
}

function DemoSignals({ dimmed }: { dimmed: boolean }) {
  return (
    <div className={`demo-table ${dimmed ? "is-collecting" : ""}`}>
      <div className="demo-table-row demo-table-header">
        <span>Candidate</span>
        <span>Technique</span>
        <span>Evidence</span>
        <span>State</span>
        <span>Priority</span>
      </div>
      {demoSignals.map((signal) => (
        <div className="demo-table-row" key={signal.domain}>
          <span className="demo-domain">
            <i />
            <strong>{signal.domain}</strong>
          </span>
          <span>{signal.technique}</span>
          <span>{signal.evidence}</span>
          <span>
            <em className={`state-${signal.state.toLowerCase()}`}>
              {signal.state}
            </em>
          </span>
          <span className={`demo-score ${signal.score >= 60 ? "high" : ""}`}>
            {signal.score}
            <small>/100</small>
          </span>
        </div>
      ))}
    </div>
  );
}

function DemoSurface({ dimmed }: { dimmed: boolean }) {
  return (
    <div className={`demo-table ${dimmed ? "is-collecting" : ""}`}>
      <div className="demo-table-row surface-row demo-table-header">
        <span>Hostname</span>
        <span>HTTP</span>
        <span>TLS</span>
        <span>Technology</span>
      </div>
      {surfaceRows.map((row) => (
        <div className="demo-table-row surface-row" key={row[0]}>
          <span className="demo-domain">
            <i />
            <strong>{row[0]}</strong>
          </span>
          {row.slice(1).map((value) => (
            <span key={value}>{value}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function ThreatFlow() {
  const [paused, setPaused] = useState(false);
  return (
    <section
      className={`threat-flow ${paused ? "is-paused" : ""}`}
      id="workflow"
    >
      <div className="flow-heading">
        <div>
          <p className="landing-label">Continuous analysis</p>
          <h2>From public signal to review-ready evidence.</h2>
        </div>
        <button
          onClick={() => setPaused(!paused)}
          aria-label={
            paused ? "Play signal animation" : "Pause signal animation"
          }
        >
          {paused ? <Play /> : <Pause />} {paused ? "Play" : "Pause"}
        </button>
      </div>
      <div
        className="flow-stage"
        aria-label="Animated signal processing diagram"
      >
        <div className="flow-column sources">
          <FlowNode icon={<Globe2 />} label="Domain registrations" />
          <FlowNode icon={<LockKeyhole />} label="Certificate transparency" />
          <FlowNode icon={<Network />} label="DNS and nameservers" />
          <FlowNode icon={<Server />} label="Public web hosts" />
        </div>
        <div className="flow-lines inbound" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <b className="pulse p1" />
          <b className="pulse p2" />
          <b className="pulse p3" />
        </div>
        <div className="flow-core">
          <span>
            <Radar />
          </span>
          <strong>SpoofScope</strong>
          <small>CORRELATE</small>
        </div>
        <div className="flow-lines outbound" aria-hidden="true">
          <i />
          <i />
          <i />
          <b className="pulse p1" />
          <b className="pulse p2" />
        </div>
        <div className="flow-column outputs">
          <FlowNode icon={<Activity />} label="Prioritized signals" />
          <FlowNode icon={<Fingerprint />} label="Evidence snapshots" />
          <FlowNode icon={<History />} label="Change timeline" />
        </div>
      </div>
      <div className="flow-caption">
        <span>
          <i /> LIVE SIGNAL SIMULATION
        </span>
        <p>
          Objective observations remain visible from collection through analyst
          review.
        </p>
      </div>
    </section>
  );
}

function FlowNode({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flow-node">
      <span>{icon}</span>
      <strong>{label}</strong>
    </div>
  );
}

function WorkflowBand() {
  return (
    <section className="workflow-band">
      <article>
        <span>
          <Radar />
        </span>
        <small>01 / DETECT</small>
        <h3>Observe</h3>
        <p>
          Build a passive baseline across DNS, TLS, HTTP and certificate
          sources.
        </p>
      </article>
      <article>
        <span>
          <Waypoints />
        </span>
        <small>02 / CORRELATE</small>
        <h3>Prioritize</h3>
        <p>Combine registration, content, redirect and similarity evidence.</p>
      </article>
      <article>
        <span>
          <Eye />
        </span>
        <small>03 / REVIEW</small>
        <h3>Decide</h3>
        <p>
          Inspect signals and historical change without categorical accusations.
        </p>
      </article>
    </section>
  );
}

const features = [
  {
    icon: <Network />,
    title: "Attack surface monitoring",
    copy: "Discover authorized public assets and retain DNS, HTTP, TLS, technology and security-header evidence.",
    meta: "DNS / HTTP / TLS",
  },
  {
    icon: <ScanSearch />,
    title: "Typosquatting watch",
    copy: "Generate defensible variants and enrich resolving candidates with RDAP, certificates, redirects and registration context.",
    meta: "VARIANTS / RDAP",
  },
  {
    icon: <Fingerprint />,
    title: "Page-level evidence",
    copy: "Compare titles, forms, resources, structural fingerprints and optional screenshots for analyst review.",
    meta: "DOM / VISUAL",
  },
  {
    icon: <History />,
    title: "Historical snapshots",
    copy: "Retain immutable observations across runs and make NEW, CHANGED and DISAPPEARED states immediately visible.",
    meta: "CHANGE / HISTORY",
  },
  {
    icon: <Activity />,
    title: "Explainable priority",
    copy: "Surface the objective signals behind every score instead of presenting an unexplained maliciousness verdict.",
    meta: "SIGNALS / SCORE",
  },
  {
    icon: <Braces />,
    title: "Self-hosted operations",
    copy: "Run the API, workers, scheduler, PostgreSQL, Redis and browser capture pipeline under your own control.",
    meta: "DOCKER / API",
  },
];

function FeatureMatrix() {
  return (
    <section className="feature-section" id="features">
      <div className="feature-intro">
        <div>
          <p className="landing-label">Capabilities</p>
          <h2>One workspace for continuous domain defense.</h2>
        </div>
        <p>
          Every module contributes evidence to the same domain workspace, scan
          history and change timeline.
        </p>
      </div>
      <div className="feature-grid">
        {features.map((feature, index) => (
          <article
            className={index === 0 ? "feature-lead" : ""}
            key={feature.title}
          >
            <div className="feature-number">0{index + 1}</div>
            <span className="feature-icon">{feature.icon}</span>
            <h3>{feature.title}</h3>
            <p>{feature.copy}</p>
            <small>{feature.meta}</small>
            <div className="feature-visual" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function LandingFooter({ onOpenConsole }: LandingPageProps) {
  return (
    <footer className="landing-footer">
      <div className="landing-brand">
        <span className="landing-brand-mark">
          <Radar />
        </span>
        <span>
          <strong>SpoofScope</strong>
          <small>Defensive intelligence</small>
        </span>
      </div>
      <p>Passive, explainable monitoring for domains you control.</p>
      <button onClick={onOpenConsole}>
        OPEN CONSOLE <ArrowRight />
      </button>
      <div className="footer-meta">
        <span>
          <ShieldCheck /> AUTHORIZED USE ONLY
        </span>
        <span>OPEN SOURCE / SELF-HOSTED</span>
      </div>
    </footer>
  );
}
