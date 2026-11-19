"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CloudRain,
  Download,
  Droplets,
  FlaskConical,
  MapPin,
  Network,
  Play,
  Radio,
  RefreshCw,
  Waves,
} from "lucide-react";
import FloodMap from "@/components/FloodMap";
import type { AgentResponse } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "si", label: "සිංහල" },
  { code: "ta", label: "தமிழ்" },
] as const;

type LanguageCode = (typeof LANGUAGES)[number]["code"];

interface Tone {
  chip: string;
  dot: string;
  ping: string;
  text: string;
}

const TONES: Record<string, Tone> = {
  CRITICAL: {
    chip: "border-rose-200 bg-rose-50 text-rose-700",
    dot: "bg-rose-600",
    ping: "bg-rose-500",
    text: "text-rose-600",
  },
  WARNING: {
    chip: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    ping: "bg-amber-500",
    text: "text-amber-600",
  },
  NORMAL: {
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    ping: "bg-emerald-500",
    text: "text-emerald-600",
  },
  STANDBY: {
    chip: "border-slate-200 bg-slate-50 text-slate-600",
    dot: "bg-slate-400",
    ping: "bg-slate-400",
    text: "text-slate-500",
  },
};

export default function CommandCenter() {
  const [rainfall, setRainfall] = useState(105);
  const [waterLevel, setWaterLevel] = useState(1135);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [lastRun, setLastRun] = useState<string | null>(null);

  const runSimulation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/run-agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rainfall_mm: rainfall,
          current_water_level: waterLevel,
        }),
      });

      const data: AgentResponse = await response.json();

      if (!response.ok || data.status === "error") {
        setError(data.message ?? `Backend returned ${response.status}.`);
        setResult(null);
        return;
      }

      setResult(data);
      setLastRun(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
      if (data.final_risk_level === "NORMAL") setLanguage("en");
    } catch {
      setError(
        `Could not reach the backend at ${API_URL}. Start it with: cd backend && ./venv/Scripts/python.exe -m uvicorn main:app --reload`,
      );
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const exportScenario = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hydroguard-${result.final_risk_level.toLowerCase()}-${result.input_data.rainfall_mm}mm-${result.input_data.water_level}ft.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const riskLevel = result?.final_risk_level ?? "STANDBY";
  const tone = TONES[riskLevel] ?? TONES.STANDBY;
  const alertText = result?.multilingual_alerts?.[language];

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#eef2f7] text-slate-900">
      {/* ================= TOP GLOBAL NAVIGATION BAR ================= */}
      <header className="z-40 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/90 bg-white/95 px-5 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm ring-1 ring-slate-800">
            <Droplets className="h-[20px] w-[20px] text-blue-400" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-heading text-sm font-bold tracking-tight text-slate-950">
                HYDROGUARD <span className="text-blue-600">//</span> AI COMMAND
              </span>
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                LIVE OPS
              </span>
            </div>
            <span className="font-mono text-[11px] tracking-tight text-slate-500">
              SECTOR: VICTORIA DAM / MAHAWELI BASIN
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastRun && (
            <span className="hidden items-center gap-1.5 font-mono text-[11px] text-slate-500 sm:flex">
              <Activity className="h-3.5 w-3.5 text-slate-400" />
              LAST RUN {lastRun}
            </span>
          )}
          <a
            href={`${API_URL}/docs`}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 md:block"
          >
            API DOCS
          </a>
          <div
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-bold ${tone.chip}`}
          >
            <span className={`h-2 w-2 animate-ping rounded-full ${tone.ping}`} />
            STAGE: {riskLevel}
          </div>
        </div>
      </header>

      {/* ================= MAIN BODY ================= */}
      <div className="relative flex flex-1 overflow-hidden bg-[#f1f4f8]">
        {/* 1. REAL GIS MAP CANVAS */}
        <FloodMap
          variant="canvas"
          affectedAreas={result?.affected_areas ?? []}
          safeShelters={result?.safe_shelters ?? []}
          riskLevel={riskLevel}
        />

        {/* Map legend, centred in the free strip above the panels */}
        <div className="pointer-events-none absolute left-1/2 top-4 z-20 hidden -translate-x-1/2 items-center gap-4 rounded-full border border-slate-200/90 bg-white/95 px-4 py-1.5 font-mono text-[11px] text-slate-600 shadow-sm backdrop-blur lg:flex">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> RISK ZONE
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-emerald-500" /> SHELTER
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <MapPin className="h-3 w-3" /> MAHAWELI BASIN
          </span>
        </div>

        {/* 2. LEFT INTELLIGENCE STACK */}
        <div className="absolute bottom-4 left-4 top-4 z-20 flex w-[360px] flex-col gap-3 overflow-y-auto pr-1 max-md:hidden">
          {/* Card 1: Executive hydro-risk */}
          <div className="flex shrink-0 flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 animate-pulse rounded-full ring-4 ring-slate-100 ${tone.dot}`} />
                <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-slate-900">
                  Hydro-Risk Index
                </h2>
              </div>
              <span className={`font-mono text-[10px] font-bold ${tone.text}`}>
                {result ? "ASSESSED" : "AWAITING"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <span className="text-[11px] font-medium uppercase tracking-tight text-slate-500">
                  Projected Release
                </span>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="font-mono text-2xl font-bold text-slate-900">
                    {result ? result.estimated_cusecs.toLocaleString() : "0"}
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-500">
                    cusecs
                  </span>
                </div>
              </div>
              <div className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <span className="text-[11px] font-medium uppercase tracking-tight text-slate-500">
                  Reservoir
                </span>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="font-mono text-2xl font-bold text-slate-900">
                    {waterLevel.toFixed(1)}
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-500">ft</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
              <Stat
                icon={<CloudRain className="h-3.5 w-3.5 text-blue-500" />}
                label="Rain"
                value={`${rainfall} mm`}
              />
              <Stat
                icon={<MapPin className="h-3.5 w-3.5 text-rose-500" />}
                label="Zones"
                value={String(result?.affected_areas.length ?? 0)}
              />
              <Stat
                icon={<Building2 className="h-3.5 w-3.5 text-emerald-500" />}
                label="Shelters"
                value={String(result?.safe_shelters.length ?? 0)}
              />
            </div>

            {/* Trilingual alert preview */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  Generated Alert
                </span>
                <div className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setLanguage(lang.code)}
                      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                        language === lang.code
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                      } ${lang.code === "en" ? "" : "font-native"}`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <p
                  className={`text-xs leading-relaxed text-slate-200 ${
                    language === "en" ? "font-heading" : "font-native"
                  }`}
                >
                  {alertText ?? "No alert yet. Run the agent swarm to generate one."}
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Impact footprint */}
          <div className="flex shrink-0 flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-[18px] w-[18px] text-rose-600" />
                <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-900">
                  Impact Footprint
                </h3>
              </div>
              <span className="font-mono text-[10px] text-slate-400">
                GN / SHELTER
              </span>
            </div>

            <div className="flex max-h-[176px] flex-col gap-1.5 overflow-y-auto pr-1">
              {result && result.affected_areas.length > 0 ? (
                <>
                  {result.affected_areas.map((area) => (
                    <div
                      key={area.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/70 border-l-4 border-l-rose-500 bg-slate-50/80 px-2.5 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-slate-800">
                          {area.name}
                        </p>
                        <p className="font-native truncate text-[11px] text-slate-500">
                          {area.name_si}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-slate-500">
                        {area.elevation_meters} m
                      </span>
                    </div>
                  ))}
                  {result.safe_shelters.map((shelter) => (
                    <div
                      key={`${shelter.name}-${shelter.latitude}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/70 border-l-4 border-l-emerald-500 bg-slate-50/80 px-2.5 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-slate-800">
                          {shelter.name}
                        </p>
                        <p className="font-native truncate text-[11px] text-slate-500">
                          {shelter.name_si}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-slate-500">
                        cap {shelter.capacity}
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                <p className="py-6 text-center font-mono text-[11px] text-slate-400">
                  {result ? "NO ZONES AT RISK" : "AWAITING ASSESSMENT"}
                </p>
              )}
            </div>
          </div>

          {/* Card 3: LangGraph swarm runtime */}
          <div className="flex min-h-[150px] flex-1 flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="h-[18px] w-[18px] text-blue-600" />
                <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-900">
                  LangGraph Swarm Log
                </h3>
              </div>
              <span className="font-mono text-[10px] text-slate-400">
                {result ? `${result.agent_log.length} STEPS` : "IDLE"}
              </span>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto pr-1">
              {result ? (
                result.agent_log.map((log, index) => (
                  <div
                    key={index}
                    className="flex gap-2 rounded-xl border border-slate-200/70 border-l-4 border-l-blue-600 bg-slate-50/80 p-2.5"
                  >
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded bg-slate-900 font-mono text-[9px] text-blue-300">
                      {index + 1}
                    </span>
                    <p className="text-[11px] font-medium leading-snug text-slate-700">
                      {log}
                    </p>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center font-mono text-[11px] text-slate-400">
                  Run simulation to view agent execution logs...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 3. RIGHT WHAT-IF SIMULATION TWIN DRAWER */}
        <div className="absolute bottom-4 right-4 top-4 z-30 flex w-[350px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-2xl backdrop-blur-2xl max-md:left-4 max-md:w-auto">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600">
                <FlaskConical className="h-[18px] w-[18px]" />
              </div>
              <div>
                <h2 className="font-heading text-sm font-bold text-slate-950">
                  WHAT-IF TWIN
                </h2>
                <p className="font-mono text-[10px] tracking-tight text-slate-500">
                  PARAMETRIC HYDROLOGIC MODEL
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={runSimulation}
              disabled={isLoading}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 font-mono text-[11px] font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 disabled:bg-blue-400"
            >
              {isLoading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              <span>{isLoading ? "COMPUTING…" : "RUN AGENTS"}</span>
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {/* Rainfall slider */}
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-slate-50/80 p-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="rainfall"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-900"
                >
                  <CloudRain className="h-[15px] w-[15px] text-blue-600" />
                  Precipitation Surge
                </label>
                <span className="rounded border border-blue-200/80 bg-blue-50 px-2 py-0.5 font-mono text-xs font-bold text-blue-700">
                  {rainfall} mm/hr
                </span>
              </div>
              <input
                id="rainfall"
                type="range"
                min="0"
                max="300"
                step="0.5"
                value={rainfall}
                disabled={isLoading}
                onChange={(event) => setRainfall(Number(event.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600"
              />
            </div>

            {/* Reservoir slider */}
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-slate-50/80 p-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="water-level"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-900"
                >
                  <Waves className="h-[15px] w-[15px] text-rose-600" />
                  Reservoir Level
                </label>
                <span className="rounded border border-rose-200/80 bg-rose-50 px-2 py-0.5 font-mono text-xs font-bold text-rose-700">
                  {waterLevel.toFixed(1)} ft
                </span>
              </div>
              <input
                id="water-level"
                type="range"
                min="1100"
                max="1160"
                step="0.1"
                value={waterLevel}
                disabled={isLoading}
                onChange={(event) => setWaterLevel(Number(event.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-rose-600"
              />
              <div className="flex justify-between font-mono text-[10px] text-slate-400">
                <span>1100 ft</span>
                <span>SPILL 1160 ft</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/70 bg-white p-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                Watch thresholds
              </p>
              <div className="mt-1.5 flex flex-col gap-1 font-mono text-[10px] text-slate-600">
                <span>WARNING&nbsp;&nbsp;&gt; 50 mm or &gt; 1120 ft</span>
                <span>CRITICAL &gt; 100 mm or &gt; 1140 ft</span>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="button"
              onClick={exportScenario}
              disabled={!result}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 font-mono text-xs font-bold uppercase tracking-wide text-white shadow-md transition-all hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Download className="h-4 w-4" />
              Export Scenario Report
            </button>

            <p className="flex items-center justify-center gap-1.5 font-mono text-[10px] text-slate-400">
              <Radio className="h-3 w-3" />
              4-AGENT PIPELINE · WATCHER → BRAIN → MAPPER → COMM
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </span>
      <span className="mt-0.5 font-mono text-[11px] font-bold text-slate-800">
        {value}
      </span>
    </div>
  );
}
