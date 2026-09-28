import type { ReactNode } from "react";
import {
  Activity,
  CircleCheck,
  Clock3,
  Radar,
  TriangleAlert,
} from "lucide-react";
import type { Event } from "./types";

export const relativeTime = (date?: string) => {
  if (!date) return "Never";
  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return "Unknown";

  const elapsedSeconds = Math.round((Date.now() - timestamp) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];

  for (const [unit, seconds] of units) {
    if (Math.abs(elapsedSeconds) >= seconds) {
      return formatter.format(-Math.round(elapsedSeconds / seconds), unit);
    }
  }
  return "just now";
};

export const stateTone = (state?: string) => {
  if (state === "NEW") return "accent";
  if (state === "CHANGED") return "warn";
  if (state === "DISAPPEARED" || state === "failed") return "danger";
  if (state === "completed" || state === "UNCHANGED") return "good";
  return "neutral";
};

export function Badge({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: ReactNode;
  tone?: string;
  dot?: boolean;
}) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <i />}
      {children}
    </span>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description && <p className="section-description">{description}</p>}
      </div>
      {action && <div className="section-action">{action}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-visual">
        <span />
        {icon || <Radar />}
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

export function MetricCard({
  icon,
  label,
  value,
  sub,
  tone = "mint",
  delay = 0,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub: string;
  tone?: "mint" | "violet" | "blue" | "amber";
  delay?: number;
}) {
  return (
    <article
      className={`metric-card metric-${tone} enter-panel`}
      style={{ "--delay": `${delay}ms` } as React.CSSProperties}
    >
      <div className="metric-topline">
        <span className="metric-icon">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-footer">
        <small>{sub}</small>
        <div className="micro-bars" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </article>
  );
}

export function ScoreRing({ score }: { score: number }) {
  const level = score >= 60 ? "high" : score >= 35 ? "medium" : "low";
  return (
    <div
      className={`score-ring score-${level}`}
      style={
        {
          "--score": `${Math.max(0, Math.min(score, 100))}%`,
        } as React.CSSProperties
      }
      aria-label={`Review priority ${score} out of 100`}
    >
      <div>
        <strong>{score}</strong>
        <small>/100</small>
      </div>
    </div>
  );
}

const severityIcon = (severity: string) => {
  if (severity === "high") return <TriangleAlert />;
  if (severity === "medium") return <Activity />;
  return <CircleCheck />;
};

export function Timeline({
  events,
  compact = false,
}: {
  events: Event[];
  compact?: boolean;
}) {
  return events.length ? (
    <div className={`timeline ${compact ? "timeline-compact" : ""}`}>
      {events.slice(0, compact ? 6 : 8).map((event, index) => (
        <article
          key={event.id}
          className={`timeline-event severity-${event.severity} enter-item`}
          style={{ "--delay": `${index * 45}ms` } as React.CSSProperties}
        >
          <div className="timeline-marker">{severityIcon(event.severity)}</div>
          <div className="timeline-content">
            <div className="timeline-meta">
              <Badge
                tone={
                  event.severity === "high"
                    ? "danger"
                    : event.severity === "medium"
                      ? "warn"
                      : "good"
                }
              >
                {event.severity || "info"}
              </Badge>
              <time>
                <Clock3 /> {relativeTime(event.created_at)}
              </time>
            </div>
            <h3>{event.title}</h3>
            <p>{event.detail}</p>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <EmptyState
      title="Quiet timeline"
      body="Changes and noteworthy observations will appear here after scans are compared."
    />
  );
}
