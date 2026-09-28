import { useState } from "react";

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function EmailAlert({ weather }) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle"); // "idle" | "success" | "error"
  const [statusMessage, setStatusMessage] = useState("");

  const handleSubscribe = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim();

    if (!isValidEmail(normalizedEmail)) {
      setEmailError("Please enter a valid email address.");
      setStatus("idle");
      setStatusMessage("");
      return;
    }

    setEmailError("");
    setStatus("idle");
    setStatusMessage("");
    setLoading(true);

    try {
      const selectedCity = weather?.city || "Coimbatore";
      const response = await fetch("http://127.0.0.1:5000/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          city: selectedCity,
        }),
      });

      const data = await response.json();

      if (response.ok && data?.status === "success") {
        setStatus("success");
        setStatusMessage("Email Alert Registered Successfully");
        setEmail("");
      } else {
        setStatus("error");
        setStatusMessage("Unable to send email. Please try again.");
      }
    } catch (error) {
      setStatus("error");
      setStatusMessage("Unable to send email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>📧 Email Heat Alerts</h2>

      <p>
        Get heatwave alerts directly to your email.
      </p>

      <form onSubmit={handleSubscribe} noValidate>
        <input
          type="email"
          placeholder="Enter Email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailError("");
            setStatus("idle");
            setStatusMessage("");
          }}
          disabled={loading}
          required
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? "email-alert-error" : undefined}
        />
        {emailError && (
          <p id="email-alert-error" className="change-validation" role="alert">
            {emailError}
          </p>
        )}

        <br />
        <br />

        <button className="predict-button" type="submit" disabled={loading}>
          {loading ? "Sending..." : "Subscribe"}
        </button>

        {status === "success" && (
          <div className="change-summary" style={{ marginTop: "18px" }} role="status">
            <p style={{ margin: 0, fontWeight: 600 }}>{statusMessage}</p>
          </div>
        )}

        {status === "error" && (
          <div className="prediction-error" style={{ marginTop: "18px" }} role="alert">
            {statusMessage}
          </div>
        )}
      </form>
    </div>
  );
}

export default EmailAlert;
