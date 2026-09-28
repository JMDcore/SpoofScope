export type Domain = {
  id: number;
  name: string;
  label?: string;
  last_scan_at?: string;
};

export type Event = {
  id: number;
  severity: string;
  title: string;
  detail: string;
  created_at: string;
};

export type Scan = {
  id: number;
  status: string;
  stats: Record<string, number>;
  started_at?: string;
  finished_at?: string;
  error?: string;
};

export type Asset = {
  id: number;
  hostname: string;
  state: string;
  data: any;
  last_seen: string;
};

export type Candidate = {
  id: number;
  hostname: string;
  technique: string;
  score: number;
  state: string;
  signals: string[];
  data: any;
};

export type Snapshot = {
  id: number;
  scan_id: number;
  subject_key: string;
  subject_type: string;
  state: string;
  observed_at: string;
};

export type DashboardData = {
  counts?: {
    domains?: number;
    assets?: number;
    candidates?: number;
    events?: number;
  };
  events?: Event[];
  scans?: Scan[];
};

export type DomainDetail = {
  domain: Domain;
  assets: Asset[];
  candidates: Candidate[];
  events: Event[];
  scans: Scan[];
};
