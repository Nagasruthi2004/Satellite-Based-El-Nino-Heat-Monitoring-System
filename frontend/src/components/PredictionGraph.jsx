import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const data = [
  { day: 'Day 1', temperature: 39 },
  { day: 'Day 2', temperature: 40 },
  { day: 'Day 3', temperature: 41 },
  { day: 'Day 4', temperature: 42 },
  { day: 'Day 5', temperature: 41 },
  { day: 'Day 6', temperature: 40 },
  { day: 'Day 7', temperature: 39 },
];

function PredictionGraph() {
  return (
    <div className="card">
      <h2>📈 7-Day Temperature Forecast</h2>
      <div className="graph-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis
              domain={[36, 44]}
              tickFormatter={(v) => `${v}°C`}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              width={52}
            />
            <Tooltip
              formatter={(value) => [`${value}°C`, 'Temperature']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
            />
            <ReferenceLine y={40} stroke="#f97316" strokeDasharray="4 4" label={{ value: 'Alert', fill: '#f97316', fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="temperature"
              stroke="#ef4444"
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
    </div>
  );
}

export default PredictionGraph;
