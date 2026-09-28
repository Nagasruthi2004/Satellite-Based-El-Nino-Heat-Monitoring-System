import { useState } from 'react';
import { formatWindSpeedKmh } from '../utils/wind';

const REGION_ONLY_SEARCHES = new Set([
  'india',
  'tamil nadu',
  'andhra pradesh',
  'karnataka',
  'kerala',
  'telangana',
  'maharashtra',
  'punjab',
  'rajasthan',
  'united states',
  'united kingdom',
  'australia',
  'canada',
]);

const REGION_COORDINATES = {
  india: { label: 'India', lat: 20.5937, lon: 78.9629 },
};

function SearchLocation({ onCityWeather, onCitySelected, onCityError, onFillForm, onLocationSearch, currentHeatRisk, fetchWeatherForCity }) {
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

    const normalizedSearch = trimmed.toLowerCase();
    const regionCoordinates = REGION_COORDINATES[normalizedSearch];
    if (regionCoordinates) {
      onCityWeather(null);
      onCityError('');
      onLocationSearch?.(regionCoordinates);
      setLoading(false);
      return;
    }

    if (REGION_ONLY_SEARCHES.has(normalizedSearch)) {
      const message = 'Please enter a city name.';
      setError(message);
      onCityWeather(null);
      onCityError(message);
      onLocationSearch?.(null);
      setLoading(false);
      return;
    }

    try {
      onLocationSearch?.(null);
      const data = await fetchWeatherForCity(trimmed);

      setWeather(data);
      onCityWeather(data);
      onCitySelected?.(trimmed);
      onCityError('');
      onFillForm({
        temperature: String(data.temperature),
        humidity: String(data.humidity),
        rainfall: String(data.rainfall),
        wind_speed: formatWindSpeedKmh(data.wind_speed),
      });
    } catch (err) {
      const message = 'Unable to fetch weather data for this location.';
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
            <div className="sr-value">{formatWindSpeedKmh(weather.wind_speed)} km/h</div>
          </div>
          <div className="search-result-item">
            <div className="sr-label">Heat Risk</div>
            <div className="sr-value">{currentHeatRisk?.level || 'Not available'}</div>
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
