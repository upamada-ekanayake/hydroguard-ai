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
