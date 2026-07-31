function HeatRecommendation({ risk }) {
  if (!risk) return null;

  const recommendations = {
    High: [
      "Drink at least 4 litres of water",
      "Avoid outdoor activities from 12 PM to 3 PM",
      "Wear light cotton clothes",
      "Use sunscreen and cap",
      "Heatstroke Risk: High"
    ],
    Medium: [
      "Drink enough water",
      "Avoid long outdoor exposure",
      "Wear comfortable clothes",
      "Monitor weather updates"
    ],
    Low: [
      "Normal outdoor activities are safe",
      "Stay hydrated",
      "Check weather regularly"
    ]
  };

  return (
    <div className="card">
      <h2>💡 AI Heat Recommendations</h2>

      <h3>Heat Risk: {risk}</h3>

      <ul>
        {recommendations[risk]?.map((item, index) => (
          <li key={index}>✅ {item}</li>
        ))}
      </ul>
    </div>
  );
}

export default HeatRecommendation;