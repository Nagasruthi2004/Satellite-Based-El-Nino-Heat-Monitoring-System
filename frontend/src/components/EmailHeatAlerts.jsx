import { useState, useEffect, useId, useMemo } from "react";
import "./EmailHeatAlerts.css";

const API_BASE = "http://127.0.0.1:5000";

const THRESHOLD_OPTIONS = [
  { id: "Medium", name: "Medium", range: "30°C - 35.9°C LST", desc: "Moderate Heat Caution" },
  { id: "High", name: "High", range: "36°C - 39.9°C LST", desc: "Severe Heat Risk" },
  { id: "Critical", name: "Critical", range: "≥ 40°C LST", desc: "Extreme Heat Emergency" },
];

const RISK_RANKS = {
  Low: 1,
  Moderate: 2,
  Medium: 2,
  High: 3,
  Critical: 4,
};

const FREQUENCY_OPTIONS = [
  { id: "Instant", label: "Instant (When threshold is exceeded)" },
  { id: "Daily", label: "Daily Summary Digest" },
  { id: "Weekly", label: "Weekly Trend Report" },
];

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export default function EmailHeatAlerts() {
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("Tamil Nadu");
  const [threshold, setThreshold] = useState("Medium");
  const [frequency, setFrequency] = useState("Instant");
  const [enabled, setEnabled] = useState(true);

  const [availableLocations, setAvailableLocations] = useState([
    "Tamil Nadu", "Andhra Pradesh", "Karnataka", "Kerala", "Maharashtra",
    "Rajasthan", "Delhi", "Gujarat", "Uttar Pradesh", "West Bengal",
    "Coimbatore", "Chennai", "Salem", "Madurai", "Bengaluru"
  ]);

  const [isSmtpConfigured, setIsSmtpConfigured] = useState(false);
  const [smtpStatusMessage, setSmtpStatusMessage] = useState("");
  const [currentRiskData, setCurrentRiskData] = useState(null);
  const [lastSavedConfig, setLastSavedConfig] = useState(null);

  const [emailError, setEmailError] = useState("");
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: '' }
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const emailInputId = useId();
  const locationSelectId = useId();
  const frequencySelectId = useId();

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const response = await fetch(`${API_BASE}/email-alert/config`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (isMounted) {
          setIsSmtpConfigured(Boolean(data.is_smtp_configured));
          setSmtpStatusMessage(data.smtp_status_message || "");

          if (data.config) {
            const cfg = data.config;
            if (cfg.email) setEmail(cfg.email);
            if (cfg.location) setLocation(cfg.location);
            if (cfg.threshold) setThreshold(cfg.threshold);
            if (cfg.frequency) setFrequency(cfg.frequency);
            if (typeof cfg.enabled === "boolean") setEnabled(cfg.enabled);
            if (cfg.available_locations?.length) setAvailableLocations(cfg.available_locations);
            if (cfg.current_risk) setCurrentRiskData(cfg.current_risk);
            setLastSavedConfig(cfg);
          }
        }
      } catch {
        if (isMounted) {
          setIsSmtpConfigured(false);
          setSmtpStatusMessage("Email service is not configured.");
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Evaluate whether the selected threshold is triggered based on current risk
  const isTriggered = useMemo(() => {
    const currentRisk = currentRiskData?.level || "Medium";
    const currentRank = RISK_RANKS[currentRisk] || 1;
    const thresholdRank = RISK_RANKS[threshold] || 2;
    return currentRank >= thresholdRank;
  }, [currentRiskData, threshold]);

  // Handle saving alert configuration
  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();

    if (!isValidEmail(cleanEmail)) {
      setEmailError("Please enter a valid email address (e.g. name@domain.com).");
      return;
    }
    setEmailError("");
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`${API_BASE}/email-alert/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          location,
          threshold,
          frequency,
          enabled,
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setStatusMessage({
          type: "success",
          text: "Alert settings saved successfully! Monitored thresholds are now active.",
        });
        if (result.config) {
          setLastSavedConfig(result.config);
          if (result.config.current_risk) {
            setCurrentRiskData(result.config.current_risk);
          }
        }
      } else {
        setStatusMessage({
          type: "error",
          text: result.error || "Failed to save alert settings. Please check your inputs.",
        });
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: "Could not reach server to save settings. Please verify backend is running.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle sending a test heat alert email
  const handleSendTestAlert = async () => {
    const cleanEmail = email.trim();
    if (!isValidEmail(cleanEmail)) {
      setEmailError("Please enter a valid email address before sending a test alert.");
      return;
    }
    setEmailError("");
    setIsSendingTest(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`${API_BASE}/email-alert/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          location,
          threshold,
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setStatusMessage({
          type: "success",
          text: `Test heat risk alert sent successfully to ${cleanEmail}! Please check your inbox.`,
        });
      } else {
        const errorDetail = result.error || "Failed to dispatch test email.";
        setStatusMessage({
          type: "error",
          text: errorDetail,
        });
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: "Failed to dispatch test email. Please check network connection and backend status.",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="email-alerts-container">
      {/* ── HEADER ── */}
      <header className="email-alerts-header">
        <div className="email-alerts-title-area">
          <div className="email-alerts-eyebrow">
            <span>🛰️</span>
            <span>Automated Awareness & Notification</span>
          </div>
          <h1 className="email-alerts-title">📧 Email Heat Alert & Notification System</h1>
          <p className="email-alerts-subtitle">
            Configure automated email warnings triggered when satellite Land Surface Temperature (LST) and heat risk reach your designated threshold.
          </p>
        </div>

        <div>
          <span
            className={`smtp-status-badge ${isSmtpConfigured ? "configured" : "unconfigured"}`}
            title={smtpStatusMessage}
          >
            <span className="status-dot">●</span>
            {isSmtpConfigured ? "SMTP Service Active" : "SMTP Unconfigured"}
          </span>
        </div>
      </header>

      {/* ── SMTP WARNING BANNER IF UNCONFIGURED ── */}
      {!isSmtpConfigured && (
        <div className="smtp-warning-banner" role="alert">
          <div className="smtp-warning-icon">⚠️</div>
          <div className="smtp-warning-content">
            <strong>Email service is not configured.</strong>
            <p>
              SMTP environment credentials (<code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USERNAME</code>, <code>SMTP_PASSWORD</code>)
              are not set in <code>backend/.env</code>. The application is running normally; configure your SMTP credentials to dispatch live delivery.
            </p>
          </div>
        </div>
      )}

      {/* ── STATUS MESSAGE ── */}
      {statusMessage && (
        <div className={`alert-message-banner ${statusMessage.type}`} role="status">
          <span>{statusMessage.type === "success" ? "✅" : "⚠️"}</span>
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* ── MAIN TWO-COLUMN WORKSPACE ── */}
      <div className="email-alerts-grid">
        {/* LEFT COLUMN: CONFIGURATION FORM */}
        <section className="alerts-card">
          <h2 className="alerts-card-title">⚙️ Alert Configuration</h2>
          <p className="alerts-card-desc">
            Define recipient details, monitored geographic region, and heat-risk triggers.
          </p>

          <form onSubmit={handleSaveConfig} noValidate>
            {/* Email Address */}
            <div className="form-group">
              <label htmlFor={emailInputId} className="form-label">
                <span>Email Address <span style={{ color: "#dc2626" }}>*</span></span>
                <span style={{ fontSize: "11px", fontWeight: "normal", color: "var(--text-muted)" }}>
                  Recipients will receive heat alerts here
                </span>
              </label>
              <input
                id={emailInputId}
                type="email"
                className={`form-input ${emailError ? "error" : ""}`}
                placeholder="e.g. climate.researcher@domain.org"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
                required
              />
              {emailError && <p className="form-error-text">{emailError}</p>}
            </div>

            {/* Location / State */}
            <div className="form-group">
              <label htmlFor={locationSelectId} className="form-label">
                <span>Monitored Location / State <span style={{ color: "#dc2626" }}>*</span></span>
              </label>
              <select
                id={locationSelectId}
                className="form-select"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                {availableLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Heat-Risk Threshold Selection */}
            <div className="form-group">
              <span className="form-label">
                <span>Heat-Risk Trigger Threshold <span style={{ color: "#dc2626" }}>*</span></span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Low &lt; Medium &lt; High &lt; Critical</span>
              </span>
              <div className="threshold-grid">
                {THRESHOLD_OPTIONS.map((opt) => {
                  const isSelected = threshold === opt.id;
                  const selectedClass = isSelected ? `selected-${opt.id.toLowerCase()}` : "";
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`threshold-card-btn ${selectedClass}`}
                      onClick={() => setThreshold(opt.id)}
                    >
                      <span className="thresh-name">{opt.name}</span>
                      <span className="thresh-range">{opt.range}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Alert Frequency */}
            <div className="form-group">
              <label htmlFor={frequencySelectId} className="form-label">
                <span>Alert Frequency / Dispatch Mode</span>
              </label>
              <select
                id={frequencySelectId}
                className="form-select"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                {FREQUENCY_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Enable Alert Toggle */}
            <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: "10px" }}>
              <input
                id="alert-active-checkbox"
                type="checkbox"
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <label htmlFor="alert-active-checkbox" style={{ fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                Active (Enable automated threshold evaluation)
              </label>
            </div>

            {/* Action Buttons */}
            <div className="form-actions-row">
              <button
                type="submit"
                className="btn-primary"
                disabled={isSaving || isSendingTest}
              >
                {isSaving ? "Saving Settings..." : "💾 Save Alert Settings"}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleSendTestAlert}
                disabled={isSaving || isSendingTest}
                title="Send a sample heat risk notification to verify recipient address"
              >
                {isSendingTest ? "Sending Test..." : "🚀 Send Test Alert"}
              </button>
            </div>
          </form>
        </section>

        {/* RIGHT COLUMN: CURRENT ALERT STATUS & LIVE EVALUATION */}
        <section className="alerts-card status-overview-card">
          <div>
            <h2 className="alerts-card-title">📊 Current Heat Risk Status</h2>
            <p className="alerts-card-desc">
              Real-time evaluation for <strong>{location}</strong> compared against your configured threshold.
            </p>
          </div>

          {/* Trigger Condition Status */}
          <div className={`condition-check-box ${isTriggered ? "triggered" : "safe"}`}>
            <div className="condition-header">
              <strong style={{ fontSize: "14px" }}>Condition Status</strong>
              <span className={`condition-badge ${isTriggered ? "triggered" : "safe"}`}>
                {isTriggered ? "🚨 Alert Triggered" : "✅ Normal Condition"}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.45 }}>
              {isTriggered
                ? `Current risk (${currentRiskData?.level || "Medium"}) meets or exceeds your threshold (${threshold}). Automated heat alerts will dispatch.`
                : `Current risk (${currentRiskData?.level || "Low"}) is below your configured threshold (${threshold}). No warning triggered.`}
            </p>

            <div className="condition-details-list">
              <div className="condition-item">
                <span className="item-label">Current Risk</span>
                <span className="item-val" style={{ color: isTriggered ? "#dc2626" : "#059669" }}>
                  {currentRiskData?.level || "Medium"}
                </span>
              </div>
              <div className="condition-item">
                <span className="item-label">Current LST / Temp</span>
                <span className="item-val">
                  {currentRiskData?.temperature != null ? `${currentRiskData.temperature}°C` : "34.5°C"}
                </span>
              </div>
              <div className="condition-item">
                <span className="item-label">Alert Threshold</span>
                <span className="item-val">{threshold}</span>
              </div>
              <div className="condition-item">
                <span className="item-label">Monitored Region</span>
                <span className="item-val" style={{ fontSize: "13px" }}>{location}</span>
              </div>
            </div>
          </div>

          {/* Saved Configuration Summary */}
          {lastSavedConfig && lastSavedConfig.configured && (
            <div style={{ fontSize: "13px", color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
              <strong style={{ color: "var(--text)", display: "block", marginBottom: "4px" }}>Active Subscription</strong>
              <div>Recipient: <strong>{lastSavedConfig.email}</strong></div>
              <div>Frequency: <strong>{lastSavedConfig.frequency}</strong></div>
              <div>Status: <strong>{lastSavedConfig.enabled ? "Active" : "Paused"}</strong></div>
            </div>
          )}

          {/* Live Email Content Preview */}
          <div className="email-preview-box">
            <div className="preview-title">✉️ Sample Alert Email Preview</div>
            <div className="preview-subject">
              Subject: Heat Risk Alert – Satellite-Based El Niño Heat Monitoring System
            </div>
            <div className="preview-body-content">
{`Satellite-Based El Niño Heat Monitoring System
HEAT RISK ALERT NOTIFICATION

Location / State: ${location}
Current Temperature / LST: ${currentRiskData?.temperature || "36.8"}°C
Heat-Risk Level: ${currentRiskData?.level || "High"}
Alert Threshold: ${threshold}

Safety Recommendation:
${currentRiskData?.safety_recommendation || "Drink plenty of water and limit direct afternoon sun exposure."}

DISCLAIMER:
This is an automated awareness alert, not an official emergency warning.`}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
