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
