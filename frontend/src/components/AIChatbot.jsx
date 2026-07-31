import { useState, useEffect, useRef } from "react";

const RISK_WATER = { Low: "2–3L", Medium: "3–4L", High: "4–5L", Critical: "5–6L" };
const RISK_OUTSIDE = {
  Low:      "✅ It is safe to go outside. Normal activities are fine, but stay hydrated.",
  Medium:   "⚠️ Use caution outdoors. Avoid direct sun between 11am–3pm and wear light clothing.",
  High:     "🚨 Avoid going outside during peak hours. If you must, wear a hat, use sunscreen, and carry water.",
  Critical: "🛑 Stay indoors. Going outside is dangerous. Seek air-conditioned spaces immediately.",
};
const RISK_PRECAUTIONS = {
  Low:      ["Stay hydrated", "Wear light clothing", "Use sunscreen if outdoors"],
  Medium:   ["Avoid outdoor activity 11am–3pm", "Drink water every 30 min", "Wear a hat and sunglasses", "Check on elderly neighbours"],
  High:     ["Stay indoors as much as possible", "Drink 4–5L of water daily", "Never leave children or pets in cars", "Watch for heat exhaustion symptoms", "Use fans or AC"],
  Critical: ["Do NOT go outside", "Drink 5–6L of water", "Call emergency services if feeling unwell", "Close blinds to block heat", "Check on vulnerable people nearby"],
};

function getResponse(input, weather) {
  const q     = input.toLowerCase().trim();
  const risk  = weather?.heat_risk   || "Unknown";
  const temp  = weather?.temperature ?? "N/A";
  const city  = weather?.city        || "your city";
  const hum   = weather?.humidity    ?? "N/A";
  const wind  = weather?.wind_speed  ?? "N/A";
  const rain  = weather?.rainfall    ?? "N/A";
  const nino  = weather?.el_nino_status || "Unknown";

  if (!weather) return "I don't have weather data yet. Please search for a city first.";

  // Water / hydration
  if (/water|drink|hydrat/.test(q)) {
    const amount = RISK_WATER[risk] || "2–3L";
    return `💧 With ${risk} heat risk in ${city} (${temp}°C), you should drink at least ${amount} of water today. Sip regularly — don't wait until you're thirsty.`;
  }

  // Safe to go outside
  if (/safe|outside|go out|outdoor/.test(q)) {
    return RISK_OUTSIDE[risk] || "Please check the current heat risk level before going outside.";
  }

  // Tomorrow / forecast
  if (/tomorrow|forecast|next day|will it/.test(q)) {
    return `📅 Based on current conditions in ${city}, today's heat risk is ${risk} at ${temp}°C. Check the AI 7-Day Heat Forecast section above for a full day-by-day breakdown including tomorrow's prediction.`;
  }

  // Precautions / tips / protect
  if (/precaution|tip|protect|advice|suggest|what should/.test(q)) {
    const list = RISK_PRECAUTIONS[risk] || RISK_PRECAUTIONS.Low;
    return `🛡️ Precautions for ${risk} heat risk in ${city}:\n• ${list.join("\n• ")}`;
  }

  // What does heat risk mean
  if (/what is|what does|mean|explain|define/.test(q) && /heat risk|risk level|high risk|medium risk|low risk/.test(q)) {
    const defs = {
      Low:      "Low Heat Risk means conditions are generally safe. Stay hydrated and enjoy normal activities.",
      Medium:   "Medium Heat Risk means heat stress is possible. Vulnerable people (elderly, children) should take extra care.",
      High:     "High Heat Risk means dangerous heat conditions. Limit outdoor exposure and watch for heat exhaustion.",
      Critical: "Critical Heat Risk means life-threatening heat. Stay indoors, seek medical help if feeling unwell.",
    };
    return `ℹ️ ${defs[risk] || "Heat risk indicates how dangerous the current temperature and humidity are for human health."}`;
  }

  // Humidity
  if (/humid/.test(q)) {
    return `💦 Current humidity in ${city} is ${hum}%. ${Number(hum) > 70 ? "High humidity makes heat feel worse and slows sweat evaporation — take extra care." : "Humidity is at a manageable level."}`;
  }

  // Wind
  if (/wind/.test(q)) {
    return `💨 Wind speed in ${city} is currently ${wind} km/h. ${Number(wind) > 20 ? "There's a decent breeze which can help cool you down." : "Low wind means less natural cooling — stay in the shade."}`;
  }

  // Rainfall
  if (/rain|rainfall|precipit/.test(q)) {
    return `🌧️ Rainfall in ${city} is ${rain} mm. ${Number(rain) > 0 ? "Some rainfall may provide temporary relief from the heat." : "No significant rainfall — dry conditions can intensify heat."}`;
  }

  // El Niño
  if (/el ni|nino|niño|climate/.test(q)) {
    return `🌊 El Niño status for ${city}: ${nino}. El Niño events typically cause above-average temperatures and can intensify heatwaves across South Asia.`;
  }

  // Temperature
  if (/temperature|how hot|temp|degree/.test(q)) {
    return `🌡️ Current temperature in ${city} is ${temp}°C with ${risk} heat risk. ${Number(temp) >= 40 ? "This is extremely hot — limit all outdoor activity." : Number(temp) >= 35 ? "This is quite hot — take precautions." : "Conditions are moderate."}`;
  }

  // Heat stroke / exhaustion symptoms
  if (/stroke|exhaustion|symptom|dizzy|faint|sick/.test(q)) {
    return `🚑 Heat exhaustion symptoms include dizziness, heavy sweating, nausea, and weakness. Heat stroke symptoms include confusion, no sweating, and very high body temperature.\n\nIf you or someone shows these signs: move to a cool place, drink water, apply cool cloths, and call emergency services immediately.`;
  }

  // Greeting
  if (/hello|hi|hey|good morning|good afternoon/.test(q)) {
    return `👋 Hello! I'm your AI Heatwave Assistant. Current conditions in ${city}: ${temp}°C, ${risk} heat risk. Ask me anything about heat safety, precautions, or today's forecast!`;
  }

  // Fallback
  return `🤖 I can help with heat safety in ${city} (${temp}°C, ${risk} risk). Try asking:\n• "Is it safe to go outside?"\n• "What precautions should I take?"\n• "How much water should I drink?"\n• "What does High Heat Risk mean?"`;
}

export default function AIChatbot({ weather }) {
  const city = weather?.city || "your city";
  const risk = weather?.heat_risk || "Unknown";
  const temp = weather?.temperature ?? "N/A";

  const greeting = {
    role: "ai",
    text: `👋 Hi! I'm your AI Heatwave Assistant. ${weather
      ? `Current conditions in ${city}: ${temp}°C with ${risk} heat risk.`
      : "Search for a city to get started."} Ask me anything about heat safety!`,
  };

  const [messages, setMessages] = useState([greeting]);
  const [input, setInput]       = useState("");
  const bottomRef               = useRef(null);

  // Reset greeting when city changes
  useEffect(() => {
    setMessages([{
      role: "ai",
      text: `👋 Hi! I'm your AI Heatwave Assistant. ${weather
        ? `Current conditions in ${city}: ${temp}°C with ${risk} heat risk.`
        : "Search for a city to get started."} Ask me anything about heat safety!`,
    }]);
  }, [weather?.city]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const userMsg = { role: "user", text: trimmed };
    const aiMsg   = { role: "ai",  text: getResponse(trimmed, weather) };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput("");
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div className="card">
      <h2 className="section-title">🤖 AI Heatwave Assistant</h2>
      <p className="hospitals-hint" style={{ marginBottom: "16px" }}>
        Ask about heat safety, precautions, hydration, or today's risk level.
      </p>

      <div className="chatbot-window">
        {messages.map((msg, i) => (
          <div key={i} className={`chatbot-row ${msg.role}`}>
            {msg.role === "ai" && <span className="chatbot-avatar">🤖</span>}
            <div className={`chatbot-bubble ${msg.role}`}>
              {msg.text.split("\n").map((line, j) => (
                <span key={j}>{line}{j < msg.text.split("\n").length - 1 && <br />}</span>
              ))}
            </div>
            {msg.role === "user" && <span className="chatbot-avatar">🧑</span>}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chatbot-input-row">
        <input
          className="chatbot-input"
          type="text"
          placeholder="Ask about heat safety, precautions, water intake…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
        />
        <button className="predict-button" onClick={send} disabled={!input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
