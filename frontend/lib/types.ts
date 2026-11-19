export interface GNDivision {
  id: number;
  name: string;
  name_si: string;
  name_ta: string;
  district: string;
  elevation_meters: number;
  risk_zone?: string;
}

export interface Shelter {
  name: string;
  name_si: string;
  name_ta: string;
  latitude: number;
  longitude: number;
  capacity: number;
}

export interface MultilingualAlerts {
  en: string;
  si: string;
  ta: string;
}

export interface AgentResponse {
  status: "success" | "error";
  message?: string;
  input_data: { rainfall_mm: number; water_level: number };
  final_risk_level: string;
  estimated_cusecs: number;
  affected_areas: GNDivision[];
  safe_shelters: Shelter[];
  multilingual_alerts: MultilingualAlerts;
  agent_log: string[];
}

export type RiskLevel = "CRITICAL" | "WARNING" | "NORMAL" | "UNKNOWN";

export const RISK_STYLES: Record<
  string,
  { text: string; ring: string; chip: string; glow: string; label: string }
> = {
  CRITICAL: {
    text: "text-rose-300",
    ring: "ring-rose-500/40",
    chip: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/40",
    glow: "shadow-[0_0_60px_-15px_rgba(244,63,94,0.65)]",
    label: "Critical",
  },
  WARNING: {
    text: "text-amber-300",
    ring: "ring-amber-500/40",
    chip: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40",
    glow: "shadow-[0_0_60px_-15px_rgba(245,158,11,0.6)]",
    label: "Warning",
  },
  NORMAL: {
    text: "text-emerald-300",
    ring: "ring-emerald-500/40",
    chip: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40",
    glow: "shadow-[0_0_60px_-15px_rgba(16,185,129,0.55)]",
    label: "Normal",
  },
  UNKNOWN: {
    text: "text-slate-300",
    ring: "ring-slate-500/40",
    chip: "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/40",
    glow: "",
    label: "Unknown",
  },
};
