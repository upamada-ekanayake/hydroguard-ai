"use client";

import { useState } from "react";
import { Droplets, Gauge, Loader2, Sparkles } from "lucide-react";

interface AdminPanelProps {
  onRunAgents: (rainfall: number, waterLevel: number) => void;
  isLoading: boolean;
}

export default function AdminPanel({ onRunAgents, isLoading }: AdminPanelProps) {
  const [rainfall, setRainfall] = useState(150.5);
  const [waterLevel, setWaterLevel] = useState(1150.2);

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
      <div className="mb-6 flex items-center gap-2">
        <Gauge className="h-5 w-5 text-cyan-400" />
        <h2 className="text-lg font-semibold text-slate-100">
          Dam Sensor Input
        </h2>
      </div>

      <div className="space-y-6">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Droplets className="h-4 w-4 text-sky-400" />
              Rainfall
            </label>
            <span className="font-mono text-sm text-sky-300">
              {rainfall.toFixed(1)} mm
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="300"
            step="0.5"
            value={rainfall}
            disabled={isLoading}
            onChange={(event) => setRainfall(parseFloat(event.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-sky-500"
          />
          <div className="mt-1 flex justify-between text-[11px] text-slate-500">
            <span>0 mm</span>
            <span>300 mm</span>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Gauge className="h-4 w-4 text-emerald-400" />
              Reservoir level
            </label>
            <span className="font-mono text-sm text-emerald-300">
              {waterLevel.toFixed(1)} ft
            </span>
          </div>
          <input
            type="range"
            min="1100"
            max="1160"
            step="0.1"
            value={waterLevel}
            disabled={isLoading}
            onChange={(event) => setWaterLevel(parseFloat(event.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-[11px] text-slate-500">
            <span>1100 ft</span>
            <span>Spill level 1160 ft</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onRunAgents(rainfall, waterLevel)}
        disabled={isLoading}
        className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Agents reasoning…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Run AI Agents
          </>
        )}
      </button>

      <p className="mt-3 text-center text-[11px] text-slate-500">
        4-agent LangGraph pipeline · Watcher → Brain → Mapper → Communicator
      </p>
    </section>
  );
}
