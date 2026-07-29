import { useState } from 'react';

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
        />
        <button className="search-btn" onClick={handleSearch}>Search</button>
      </div>

      {weather && (
        <div className="search-result">
          <div className="search-result-item">
            <div className="sr-label">City</div>
            <div className="sr-value">{weather.city}</div>
          </div>
          <div className="search-result-item">
            <div className="sr-label">Temperature</div>
            <div className="sr-value">{weather.temperature}</div>
          </div>
          <div className="search-result-item">
            <div className="sr-label">Humidity</div>
            <div className="sr-value">{weather.humidity}</div>
          </div>
          <div className="search-result-item">
            <div className="sr-label">Rainfall</div>
            <div className="sr-value">{weather.rainfall}</div>
          </div>
          <div className="search-result-item">
            <div className="sr-label">Wind Speed</div>
            <div className="sr-value">{weather.windSpeed}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchLocation;
