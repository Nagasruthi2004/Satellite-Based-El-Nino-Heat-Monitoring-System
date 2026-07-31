import { useState } from 'react';

function SearchLocation({ onCityWeather, onCityError, onFillForm }) {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    const trimmed = city.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    setWeather(null);

    try {
      const response = await fetch(`http://127.0.0.1:5000/weather?city=${encodeURIComponent(trimmed)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'City not found.');
      }

      setWeather(data);
      onCityWeather(data);
      onCityError('');
      onFillForm({
        temperature: String(data.temperature),
        humidity: String(data.humidity),
        rainfall: String(data.rainfall),
        wind_speed: String(data.wind_speed),
      });
    } catch (err) {
      const message = err.message || 'Unable to fetch weather for this city.';
      setError(message);
      onCityError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="card">
      <h2>🔍 Search Location</h2>
      <div className="search-box">
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter city name..."
          disabled={loading}
        />
        <button className="search-btn" onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="prediction-error" style={{ marginTop: '12px' }}>
          {error}
        </div>
      )}

      {weather && !error && (
        <div className="search-result">
          <div className="search-result-item">
            <div className="sr-label">City</div>
            <div className="sr-value">{weather.city}</div>
          </div>
          <div className="search-result-item">
            <div className="sr-label">Temperature</div>
            <div className="sr-value">{weather.temperature}°C</div>
          </div>
          <div className="search-result-item">
            <div className="sr-label">Humidity</div>
            <div className="sr-value">{weather.humidity}%</div>
          </div>
          <div className="search-result-item">
            <div className="sr-label">Rainfall</div>
            <div className="sr-value">{weather.rainfall} mm</div>
          </div>
          <div className="search-result-item">
            <div className="sr-label">Wind Speed</div>
            <div className="sr-value">{weather.wind_speed} m/s</div>
          </div>
          <div className="search-result-item">
            <div className="sr-label">Heat Risk</div>
            <div className="sr-value">{weather.heat_risk}</div>
          </div>
          <div className="search-result-item">
            <div className="sr-label">Condition</div>
            <div className="sr-value">{weather.weather_description}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchLocation;
