import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
      <h2>🌡️ Temperature Prediction</h2>
      <div style={{ width: '100%', height: '240px', marginTop: '12px' }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="temperature" stroke="#ff6b6b" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default PredictionGraph;
