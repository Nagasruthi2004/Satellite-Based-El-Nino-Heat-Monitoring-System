import { useState } from "react";

function EmailAlert({ weather }) {
  const [email, setEmail] = useState("");

  const handleSubscribe = () => {
    if (!email) {
      alert("Enter your email.");
      return;
    }

    alert(
      `Email Alert Registered!\n\nEmail: ${email}\nCity: ${weather?.city}`
    );
  };

  return (
    <div className="card">
      <h2>📧 Email Heat Alerts</h2>

      <p>
        Get heatwave alerts directly to your email.
      </p>

      <input
        type="email"
        placeholder="Enter Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <br />
      <br />

      <button
        className="predict-button"
        onClick={handleSubscribe}
      >
        Subscribe
      </button>
    </div>
  );
}

export default EmailAlert;