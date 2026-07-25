import React, { useState } from 'react';

function SearchLocation() {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState(null);

  const handleSearch = () => {
    if (!city.trim()) return;

    setWeather({
      city: city.trim(),
      temperature: '38°C',
      humidity: '60%',
      rainfall: '10 mm',
      windSpeed: '15 km/h',
    });
  };

  return (
    <div className="card">
      <h2>🔍 Search Location</h2>
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Enter city name"
          style={{
            flex: '1',
            minWidth: '180px',
            padding: '10px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
          }}
        />
        <button
          onClick={handleSearch}
          style={{
            padding: '10px 16px',
            borderRadius: '6px',
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Search
        </button>
      </div>

      {weather && (
        <div style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
          <p><strong>City:</strong> {weather.city}</p>
          <p><strong>Temperature:</strong> {weather.temperature}</p>
          <p><strong>Humidity:</strong> {weather.humidity}</p>
          <p><strong>Rainfall:</strong> {weather.rainfall}</p>
          <p><strong>Wind Speed:</strong> {weather.windSpeed}</p>
        </div>
      )}
    </div>
  );
}

export default SearchLocation;
