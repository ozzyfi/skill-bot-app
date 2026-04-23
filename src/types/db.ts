export type Region = "Marmara" | "Ege" | "İç Anadolu";
export type MachineStatus = "ok" | "busy" | "fault" | "service";
export type WoBadge = "urgent" | "active" | "scheduled";

export interface Machine {
  id: string;
  code: string;
  name: string;
  model: string;
  serial_no: string | null;
  year: number | null;
  city: string;
  district: string;
  region: Region;
  status: MachineStatus;
  operating_hours: number;
  last_service: string | null;
  next_maintenance: string | null;
  alert_text: string | null;
}

export interface WorkOrderPart {
  code: string;
  name: string;
  qty: number;
}

export interface WorkOrder {
  id: string;
  code: string;
  machine_id: string;
  alarm_code: string | null;
  complaint: string;
  description: string | null;
  status: string;
  badge: WoBadge;
  parts: WorkOrderPart[];
  assignee_id: string | null;
  closed_at: string | null;
  closing_notes: string | null;
  machines?: Machine;
}

export interface Technician {
  id: string;
  full_name: string;
  experience_years: number;
  region: Region;
  city: string;
  specialty: string | null;
}

export interface Profile {
  id: string;
  full_name: string;
  region: Region;
  client: string;
}

export interface MasterProfile {
  id: string;
  name: string;
  region: Region;
  domain: string;
  experience_years: number;
  city: string;
  work_md: string;
  persona_md: string;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CorrectionRule {
  id: string;
  master_profile_id: string | null;
  region: Region;
  scene_pattern: string;
  wrong: string;
  correct: string;
  lesson: string;
  is_active: boolean;
  applied_count: number;
  created_at: string;
  last_applied_at: string | null;
}

export interface LogFinding {
  severity: "info" | "warn" | "critical";
  code?: string;
  message: string;
  count: number;
  first_seen?: string;
  last_seen?: string;
}

export interface MachineLog {
  id: string;
  machine_id: string;
  wo_id: string | null;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  status: "uploaded" | "processing" | "ready" | "failed";
  summary: string | null;
  findings: LogFinding[];
  recurring_match: {
    matched_log_id: string;
    matched_date?: string;
    similarity_pct: number;
    note: string;
  } | null;
  recommendations: string[];
  error_msg: string | null;
  created_at: string;
}

export interface RepairVideo {
  id: string;
  wo_id: string | null;
  machine_id: string | null;
  storage_path: string;
  duration_sec: number | null;
  sop_steps: { num: number; text: string; time?: string }[];
  transcript: string | null;
  summary: string | null;
  status: "uploaded" | "processing" | "ready" | "failed";
  error_msg: string | null;
  created_at: string;
}
