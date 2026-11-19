"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  Droplets,
  Gauge,
  Radio,
  Waves,
} from "lucide-react";
import AdminPanel from "@/components/AdminPanel";
import FloodMap from "@/components/FloodMap";
import { RISK_STYLES, type AgentResponse } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "si", label: "Sinhala", native: "සිංහල" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
] as const;

type LanguageCode = (typeof LANGUAGES)[number]["code"];

export default function Home() {
  const [result, setResult] = useState<AgentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<LanguageCode>("en");

  const runAgents = async (rainfall: number, waterLevel: number) => {
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

  const risk = result ? RISK_STYLES[result.final_risk_level] ?? RISK_STYLES.UNKNOWN : null;
  const alertText = result?.multilingual_alerts?.[language];

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(14,116,144,0.25),_transparent_55%)] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/30">
                <Waves className="h-6 w-6 text-white" />
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
                HydroGuard <span className="text-cyan-400">AI</span>
              </h1>
            </div>
            <p className="max-w-xl text-sm text-slate-400">
              Autonomous multi-agent flood prediction &amp; evacuation warnings for
              the Mahaweli basin.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400">
            <Radio className="h-3.5 w-3.5 text-emerald-400" />
            Live agent pipeline
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-6">
            <AdminPanel onRunAgents={runAgents} isLoading={isLoading} />

            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Agent execution log
              </h2>

              {result ? (
                <ol className="space-y-3">
                  {result.agent_log.map((log, index) => (
                    <li key={index} className="flex gap-3 text-sm">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-slate-800 font-mono text-[10px] text-cyan-300">
                        {index + 1}
                      </span>
                      <span className="text-slate-300">{log}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-500">
                  No run yet. Set the sensors and run the pipeline.
                </p>
              )}
            </section>
          </div>

          <div className="space-y-6">
            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {result && risk ? (
              <>
                <section
                  className={`rounded-2xl border border-white/10 bg-slate-900/60 p-6 ring-1 ${risk.ring} ${risk.glow}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-400">
                        Assessed risk
                      </p>
                      <p className={`mt-1 text-4xl font-bold ${risk.text}`}>
                        {risk.label}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {result.affected_areas.length > 0
                          ? `${result.affected_areas.length} GN division${
                              result.affected_areas.length > 1 ? "s" : ""
                            } affected · ${result.safe_shelters.length} shelter${
                              result.safe_shelters.length === 1 ? "" : "s"
                            } available`
                          : "No GN divisions at risk"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${risk.chip}`}
                    >
                      {result.final_risk_level}
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Metric
                      icon={<Droplets className="h-4 w-4 text-sky-400" />}
                      label="Rainfall"
                      value={`${result.input_data.rainfall_mm} mm`}
                    />
                    <Metric
                      icon={<Gauge className="h-4 w-4 text-emerald-400" />}
                      label="Reservoir"
                      value={`${result.input_data.water_level} ft`}
                    />
                    <Metric
                      icon={<Waves className="h-4 w-4 text-cyan-400" />}
                      label="Predicted spill"
                      value={`${result.estimated_cusecs.toLocaleString()} cusecs`}
                    />
                    <Metric
                      icon={<Building2 className="h-4 w-4 text-amber-400" />}
                      label="Zones"
                      value={String(result.affected_areas.length)}
                    />
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-100">
                      Public emergency alert
                    </h2>
                    <div className="flex gap-1 rounded-lg bg-slate-800/80 p-1">
                      {LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => setLanguage(lang.code)}
                          className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                            language === lang.code
                              ? "bg-cyan-500 text-slate-950"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {lang.native}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p
                    className={`rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-base leading-relaxed text-slate-100 ${
                      language === "en" ? "" : "font-native"
                    }`}
                  >
                    {alertText ?? "—"}
                  </p>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-100">
                      Flood impact map
                    </h2>
                    <span className="text-xs text-slate-500">
                      Drag to tilt · scroll to zoom
                    </span>
                  </div>
                  <FloodMap
                    affectedAreas={result.affected_areas}
                    safeShelters={result.safe_shelters}
                    riskLevel={result.final_risk_level}
                  />
                </section>
              </>
            ) : (
              <section className="grid min-h-[520px] place-items-center rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-10 text-center">
                <div className="max-w-sm space-y-3">
                  <Waves className="mx-auto h-10 w-10 text-slate-600" />
                  <h2 className="text-lg font-semibold text-slate-200">
                    Awaiting telemetry
                  </h2>
                  <p className="text-sm text-slate-500">
                    Run the agents to generate a risk assessment, trilingual
                    alerts and the 3D impact map.
                  </p>
                </div>
              </section>
            )}
          </div>
        </div>

        <footer className="pb-4 text-center text-xs text-slate-600">
          HydroGuard AI · Victoria Dam / Mahaweli pilot · demo data
        </footer>
      </div>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-950/50 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-mono text-sm text-slate-100">{value}</p>
    </div>
  );
}
