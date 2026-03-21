"use client";

/**
 * FeedChart — Renders visual charts inside feed cards.
 *
 * Charts are specified via JSON in ```chart code blocks within card body markdown.
 * Supports: bar, line, area, pie, and horizontal bar chart types.
 *
 * JSON format:
 * {
 *   "type": "bar" | "line" | "area" | "pie" | "horizontal_bar",
 *   "title": "Chart Title",
 *   "data": [{ "label": "Jan", "value": 42 }, ...],
 *   "xKey": "label",      // optional, defaults to "label"
 *   "yKey": "value",       // optional, defaults to "value"
 *   "color": "#627c9e",    // optional, defaults to brand blue
 *   "series": [            // optional, for multi-series charts
 *     { "key": "revenue", "color": "#627c9e", "name": "Revenue" },
 *     { "key": "costs", "color": "#e57373", "name": "Costs" }
 *   ]
 * }
 */

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const geist = "var(--font-geist-sans), 'Geist', sans-serif";

// Brand palette for multi-series / pie slices
const COLORS = [
  "#627c9e", "#4da6c9", "#7eb8a0", "#e5a54b",
  "#e57373", "#9575cd", "#4db6ac", "#ff8a65",
  "#a1887f", "#90a4ae",
];

interface ChartSeries {
  key: string;
  color?: string;
  name?: string;
}

export interface ChartSpec {
  type: "bar" | "line" | "area" | "pie" | "horizontal_bar";
  title?: string;
  data: Record<string, unknown>[];
  xKey?: string;
  yKey?: string;
  color?: string;
  series?: ChartSeries[];
}

/**
 * Parse a JSON string into a ChartSpec. Returns null if invalid.
 */
export function parseChartSpec(json: string): ChartSpec | null {
  try {
    const spec = JSON.parse(json);
    if (!spec || !spec.type || !Array.isArray(spec.data) || spec.data.length === 0) {
      return null;
    }
    return spec as ChartSpec;
  } catch {
    return null;
  }
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-[6px] px-[10px] py-[6px]"
      style={{
        backgroundColor: "rgba(255,255,255,0.95)",
        boxShadow: "0px 0px 12px rgba(0,0,0,0.12)",
        fontFamily: geist,
        fontSize: "11px",
      }}
    >
      {label && (
        <p className="font-medium text-[#1e252a] mb-[2px]">{label}</p>
      )}
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: <strong>{typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ─── Chart Component ─────────────────────────────────────────────────────────

export default function FeedChart({ spec }: { spec: ChartSpec }) {
  const xKey = spec.xKey || "label";
  const yKey = spec.yKey || "value";
  const primaryColor = spec.color || COLORS[0];

  const chartHeight = spec.type === "pie" ? 200 : 180;

  const content = useMemo(() => {
    switch (spec.type) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={spec.data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 10, fontFamily: geist, fill: "#6e7b80" }}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fontFamily: geist, fill: "#6e7b80" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {spec.series ? (
                <>
                  {spec.series.map((s, i) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.name || s.key}
                      fill={s.color || COLORS[i % COLORS.length]}
                      radius={[3, 3, 0, 0]}
                    />
                  ))}
                  <Legend
                    wrapperStyle={{ fontSize: "10px", fontFamily: geist }}
                  />
                </>
              ) : (
                <Bar dataKey={yKey} fill={primaryColor} radius={[3, 3, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        );

      case "horizontal_bar":
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={spec.data} layout="vertical" margin={{ top: 4, right: 8, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fontFamily: geist, fill: "#6e7b80" }}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={false}
              />
              <YAxis
                dataKey={xKey}
                type="category"
                tick={{ fontSize: 10, fontFamily: geist, fill: "#6e7b80" }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={yKey} fill={primaryColor} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={spec.data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 10, fontFamily: geist, fill: "#6e7b80" }}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fontFamily: geist, fill: "#6e7b80" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {spec.series ? (
                <>
                  {spec.series.map((s, i) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.name || s.key}
                      stroke={s.color || COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                  <Legend
                    wrapperStyle={{ fontSize: "10px", fontFamily: geist }}
                  />
                </>
              ) : (
                <Line
                  type="monotone"
                  dataKey={yKey}
                  stroke={primaryColor}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        );

      case "area":
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={spec.data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 10, fontFamily: geist, fill: "#6e7b80" }}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fontFamily: geist, fill: "#6e7b80" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {spec.series ? (
                <>
                  {spec.series.map((s, i) => (
                    <Area
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.name || s.key}
                      stroke={s.color || COLORS[i % COLORS.length]}
                      fill={s.color || COLORS[i % COLORS.length]}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend
                    wrapperStyle={{ fontSize: "10px", fontFamily: geist }}
                  />
                </>
              ) : (
                <Area
                  type="monotone"
                  dataKey={yKey}
                  stroke={primaryColor}
                  fill={primaryColor}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        );

      case "pie":
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie
                data={spec.data}
                dataKey={yKey}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={70}
                innerRadius={30}
                paddingAngle={2}
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`
                }
                labelLine={{ stroke: "#9ca5a9", strokeWidth: 1 }}
              >
                {spec.data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  }, [spec, xKey, yKey, primaryColor, chartHeight]);

  return (
    <div className="my-[8px]">
      {spec.title && (
        <p
          className="font-semibold text-[12px] text-[#344054] mb-[6px]"
          style={{ fontFamily: geist }}
        >
          {spec.title}
        </p>
      )}
      {content}
    </div>
  );
}
