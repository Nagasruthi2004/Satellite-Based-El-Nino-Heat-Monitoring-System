import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

function PredictionGraph({ weather }) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const city = weather?.city || 'Coimbatore';

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`http://127.0.0.1:5000/forecast?city=${encodeURIComponent(city)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json.forecast);
      })
      .catch((err) => setError(err.message || 'Unable to load forecast.'))
      .finally(() => setLoading(false));
  }, [city]);

  const temps      = data.map((d) => d.temperature);
  const minTemp    = temps.length ? Math.floor(Math.min(...temps)) - 2 : 20;
  const maxTemp    = temps.length ? Math.ceil(Math.max(...temps))  + 2 : 45;
  const alertLevel = Math.round((minTemp + maxTemp) / 2);

  return (
    <div className="card">
      <h2>📈 5-Day Temperature Forecast — {city}</h2>

      {loading && (
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '12px' }}>
          Loading forecast…
        </p>
      )}

      {error && (
        <div className="prediction-error" style={{ marginBottom: '12px' }}>{error}</div>
      )}

      {!loading && !error && data.length > 0 && (
        <>
          <div className="graph-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis
                  domain={[minTemp, maxTemp]}
                  tickFormatter={(v) => `${v}°C`}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  width={52}
                />
                <Tooltip
                  formatter={(value) => [`${value}°C`, 'Temperature']}
                  contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '13px' }}
                />
                <ReferenceLine
                  y={alertLevel}
                  stroke="var(--chart-alert)"
                  strokeDasharray="4 4"
                  label={{ value: 'Alert', fill: '#f97316', fontSize: 11 }}
                />
                <Line
                  type="monotone"
                  dataKey="temperature"
                  stroke="var(--chart-temperature)"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="graph-legend">
            <span className="graph-legend-dot"></span>
            <span>Predicted Temperature (°C)</span>
          </div>
        </>
      )}
    </div>
  );
}

export default PredictionGraph;
