"use client";

import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type StyleSpecification,
} from "maplibre-gl";
import { Layers } from "lucide-react";
import type { GNDivision, Shelter } from "@/lib/types";

interface FloodMapProps {
  affectedAreas: GNDivision[];
  safeShelters: Shelter[];
  riskLevel: string;
  /** "canvas" fills its positioned parent instead of rendering a rounded panel. */
  variant?: "panel" | "canvas";
}

/**
 * Approximate GN division centroids. The table stores elevation and risk zone
 * but no geometry, so these are used for marker placement only.
 */
const GN_COORDINATES: Record<string, [number, number]> = {
  Tennekumbura: [80.635, 7.315],
  Katugastota: [80.645, 7.325],
  Peradeniya: [80.59, 7.29],
  Ampitiya: [80.62, 7.31],
};

const FALLBACK_CENTER: [number, number] = [80.632, 7.308];

const GEOAPIFY_STYLE_NAME = "osm-bright-smooth";

/**
 * Turbopack emits a chunk URL for MapLibre's bundled worker that the production
 * server answers with HTML, so the worker never boots (tiles/GeoJSON parsing
 * break). Point it at the copy shipped in /public instead.
 */
const MAPLIBRE_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

function geoapifyStyle(apiKey: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      geoapify: {
        type: "raster",
        tiles: [
          `https://maps.geoapify.com/v1/tile/${GEOAPIFY_STYLE_NAME}/{z}/{x}/{y}.png?apiKey=${apiKey}`,
        ],
        tileSize: 256,
        maxzoom: 20,
        attribution:
          '© <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#0b1220" },
      },
      { id: "basemap", type: "raster", source: "geoapify" },
    ],
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function popupHtml(title: string, native: string, meta: string, accent: string) {
  return `
    <div style="font-family: var(--font-geist-sans), system-ui, sans-serif; min-width: 170px;">
      <div style="display:flex; align-items:center; gap:6px; font-weight:700; color:${accent}; font-size:13px;">
        ${escapeHtml(title)}
      </div>
      <div class="font-native" style="font-size:12px; color:#cbd5e1; margin-top:2px;">${escapeHtml(native)}</div>
      <div style="font-size:11px; color:#94a3b8; margin-top:6px;">${escapeHtml(meta)}</div>
    </div>`;
}

export default function FloodMap({
  affectedAreas,
  safeShelters,
  riskLevel,
  variant = "panel",
}: FloodMapProps) {
  const isCanvas = variant === "canvas";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY;

  // Initialise the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    if (!apiKey) {
      setError(
        "NEXT_PUBLIC_GEOAPIFY_KEY is missing. Add it to frontend/.env.local and restart the dev server.",
      );
      return;
    }

    let map: MapLibreMap;
    try {
      setWorkerUrl(MAPLIBRE_WORKER_URL);
      map = new MapLibreMap({
        container,
        style: geoapifyStyle(apiKey),
        center: FALLBACK_CENTER,
        zoom: 12,
        pitch: 45,
        bearing: -12,
        attributionControl: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Map failed to initialise.");
      return;
    }

    map.addControl(
      new NavigationControl({ visualizePitch: true }),
      "top-right",
    );
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");

    // style.load fires once the style is parsed; `load` also waits for tiles,
    // so a slow tile CDN must never hide the markers.
    map.on("style.load", () => setMapReady(true));
    if (map.isStyleLoaded()) setMapReady(true);

    map.on("error", (event) => {
      const message = event.error?.message ?? "";
      if (/key|401|403|style/i.test(message)) setError(message);
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [apiKey]);

  // Sync markers and the flood overlay with the latest agent result.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const bounds = new LngLatBounds();

    affectedAreas.forEach((area) => {
      const coords = GN_COORDINATES[area.name];
      if (!coords) return;

      const isCritical = riskLevel === "CRITICAL";
      const el = document.createElement("div");
      el.className = `gt-marker ${isCritical ? "gt-marker-danger" : "gt-marker-warn"}`;
      if (isCritical) {
        const pulse = document.createElement("span");
        pulse.className = "gt-pulse";
        pulse.style.color = "#f43f5e";
        el.appendChild(pulse);
      }

      const zone = (area.risk_zone ?? riskLevel).toUpperCase();
      const marker = new Marker({ element: el })
        .setLngLat(coords)
        .setPopup(
          new Popup({ offset: 20, className: "gt-popup" }).setHTML(
            popupHtml(
              area.name,
              area.name_si || area.name,
              `${area.name_ta || ""} · ${zone} · ${area.elevation_meters} m`,
              isCritical ? "#fb7185" : "#fbbf24",
            ),
          ),
        )
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend(coords);
    });

    safeShelters.forEach((shelter) => {
      const coords: [number, number] = [shelter.longitude, shelter.latitude];
      const el = document.createElement("div");
      el.className = "gt-marker gt-marker-safe";

      const marker = new Marker({ element: el })
        .setLngLat(coords)
        .setPopup(
          new Popup({ offset: 20, className: "gt-popup" }).setHTML(
            popupHtml(
              shelter.name,
              shelter.name_si || shelter.name,
              `${shelter.name_ta || ""} · Capacity ${shelter.capacity}`,
              "#34d399",
            ),
          ),
        )
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend(coords);
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 90, maxZoom: 13.5, duration: 900 });
    }

    // Flood water overlay, visible only for a critical release.
    const overlayId = "hydroguard-flood";
    if (map.getLayer(`${overlayId}-ring`)) map.removeLayer(`${overlayId}-ring`);
    if (map.getLayer(overlayId)) map.removeLayer(overlayId);
    if (map.getSource(overlayId)) map.removeSource(overlayId);

    const floodAreas = affectedAreas.filter((area) => GN_COORDINATES[area.name]);
    if (riskLevel === "CRITICAL" && floodAreas.length > 0) {
      map.addSource(overlayId, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: floodAreas.map((area) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: GN_COORDINATES[area.name],
            },
            properties: { name: area.name },
          })),
        },
      });

      map.addLayer({
        id: overlayId,
        type: "circle",
        source: overlayId,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 34, 14, 160],
          "circle-color": "#38bdf8",
          "circle-opacity": 0.35,
          "circle-blur": 0.8,
        },
      });

      map.addLayer({
        id: `${overlayId}-ring`,
        type: "circle",
        source: overlayId,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 46, 14, 200],
          "circle-color": "#38bdf8",
          "circle-opacity": 0.07,
        },
      });
    }
  }, [affectedAreas, safeShelters, riskLevel, mapReady]);

  return (
    <div
      className={
        isCanvas
          ? "map-canvas absolute inset-0 overflow-hidden bg-slate-200"
          : "relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950"
      }
    >
      <div
        ref={containerRef}
        className={isCanvas ? "h-full w-full" : "h-[520px] w-full"}
      />

      {error && (
        <div className="absolute inset-0 grid place-items-center bg-slate-950/90 p-6 text-center">
          <p className="max-w-sm text-sm text-rose-300">{error}</p>
        </div>
      )}

      {!isCanvas && (
        <>
          <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-300 backdrop-blur">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Flood risk zone
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-emerald-500" /> Safe shelter
            </span>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-400 backdrop-blur">
            <Layers className="h-3.5 w-3.5" />
            Geoapify · OpenStreetMap
          </div>
        </>
      )}
    </div>
  );
}
