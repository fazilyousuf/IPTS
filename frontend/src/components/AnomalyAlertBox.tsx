import React, { useMemo } from "react";

type RawAnom = {
  anomaly_type?: string; // frontend raw
  details?: string;
  timestamp?: string;

  event_type?: string; // backend raw
  message?: string;
  created_at?: string;
};

type Agg = {
  event_type: string;
  count: number;
  last_seen?: string | null;
};

interface Props {
  anomalies?: RawAnom[];    // raw incoming events (may flood)
  aggregates?: Agg[];       // aggregated data from backend (preferred)
}

/**
 * AnomalyAlertBox
 * - If `aggregates` provided => render those (preferred).
 * - Otherwise reduce `anomalies` into aggregated counts and render that.
 */
const AnomalyAlertBox: React.FC<Props> = ({ anomalies = [], aggregates }) => {
  // If explicit aggregates present from backend — use them directly
  if (aggregates && aggregates.length > 0) {
    return (
      <div
        style={{
          marginTop: "1rem",
          border: "1px solid #d4cfc0",
          padding: "0.9rem 1rem",
          borderRadius: "8px",
          background: "#fdfbf6",
        }}
      >
        <h4 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Live Anomaly Alerts</h4>

        <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.95rem" }}>
          {aggregates.map((a, i) => (
            <li key={i} style={{ marginBottom: "0.4rem" }}>
              <strong>{a.event_type}</strong> — count: <strong>{a.count}</strong>
              {a.last_seen && (
                <> — <em>{new Date(a.last_seen).toLocaleTimeString()}</em></>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Otherwise compute aggregates from raw anomalies
  const computedAggregates: Agg[] = useMemo(() => {
    const map: Record<string, Agg> = {};

    anomalies.forEach((raw) => {
      const eventType = raw.anomaly_type || raw.event_type || "unknown";
      const ts = raw.timestamp || raw.created_at || new Date().toISOString();
      if (!map[eventType]) {
        map[eventType] = { event_type: eventType, count: 0, last_seen: ts };
      }
      map[eventType].count += 1;

      // keep the most recent timestamp
      if (ts) {
        try {
          const prev = map[eventType].last_seen;
          if (!prev || new Date(ts) > new Date(prev)) {
            map[eventType].last_seen = ts;
          }
        } catch {
          map[eventType].last_seen = ts;
        }
      }
    });

    // Convert to array and sort by count desc then last_seen desc
    return Object.values(map).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const ta = a.last_seen ? new Date(a.last_seen).getTime() : 0;
      const tb = b.last_seen ? new Date(b.last_seen).getTime() : 0;
      return tb - ta;
    });
  }, [anomalies]);

  return (
    <div
      style={{
        marginTop: "1rem",
        border: "1px solid #d4cfc0",
        padding: "0.9rem 1rem",
        borderRadius: "8px",
        background: "#fdfbf6",
      }}
    >
      <h4 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Live Anomaly Alerts</h4>

      {computedAggregates.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.9rem", color: "#6b6657" }}>
          No anomalies detected yet.
        </p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.95rem" }}>
          {computedAggregates.map((a, idx) => (
            <li key={idx} style={{ marginBottom: "0.4rem" }}>
              <strong>{a.event_type}</strong> — count: <strong>{a.count}</strong>
              {a.last_seen && (
                <> — <em>{new Date(a.last_seen).toLocaleTimeString()}</em></>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AnomalyAlertBox;
