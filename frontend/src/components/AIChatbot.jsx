import { useState, useEffect } from "react";
import { processUserQuery } from "../services/aiAssistantEngine";
import { formatTemperature } from "../utils/temperature";

export default function AIChatbot({ weather, currentHeatRisk }) {
  const city = weather?.city || "your city";
  const risk = currentHeatRisk?.level || "Unknown";
  const temp = weather?.temperature != null ? formatTemperature(weather.temperature) : "Not available";

  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: `👋 Hi! I'm your AI Heatwave Assistant. ${
        weather
          ? `Current conditions in ${city}: ${temp} with ${risk} heat risk.`
          : "Search for a city to get started."
      } Ask me anything about heat safety, weather conditions, satellite LST, or El Niño!`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState({
    lastTopic: null,
    lastEntity: null,
    lastLocation: weather?.city || null,
    currentCity: weather?.city || null,
  });

  // Keep context currentCity in sync with weather prop without wiping chat history
  useEffect(() => {
    if (weather?.city) {
      setContext((prev) => ({
        ...prev,
        currentCity: weather.city,
        lastLocation: prev.lastLocation || weather.city,
      }));
    }
  }, [weather?.city]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: "user", text: trimmed };
    setInput("");
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const responseText = await processUserQuery(trimmed, {
        weather,
        currentHeatRisk,
        context,
        setContext,
      });
      setMessages((prev) => [...prev, { role: "ai", text: responseText }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Data is not currently available for this location/query." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="card">
      <h2 className="section-title">🤖 AI Heatwave Assistant</h2>
      <p className="status-hint" style={{ marginBottom: "16px" }}>
        Ask about heat safety, precautions, hydration, or today's risk level.
      </p>

      <div className="chatbot-window">
        {messages.map((msg, i) => (
          <div key={i} className={`chatbot-row ${msg.role}`}>
            {msg.role === "ai" && <span className="chatbot-avatar">🤖</span>}
            <div className={`chatbot-bubble ${msg.role}`}>
              {msg.text.split("\n").map((line, j) => (
                <span key={j}>
                  {line}
                  {j < msg.text.split("\n").length - 1 && <br />}
                </span>
              ))}
            </div>
            {msg.role === "user" && <span className="chatbot-avatar">🧑</span>}
          </div>
        ))}
        {loading && (
          <div className="chatbot-row ai">
            <span className="chatbot-avatar">🤖</span>
            <div className="chatbot-bubble ai">
              <em style={{ opacity: 0.8 }}>Analyzing telemetry and generating answer…</em>
            </div>
          </div>
        )}
      </div>

      <div className="chatbot-input-row">
        <input
          className="chatbot-input"
          type="text"
          placeholder="Ask about heat safety, precautions, water intake…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
        />
        <button
          className="predict-button"
          onClick={send}
          disabled={!input.trim() || loading}
        >
          {loading ? "Thinking…" : "Send"}
        </button>
      </div>
    </div>
  );
}
