import { useState, useEffect } from 'react';

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
];

async function tryRequest(url, body) {
  const res = await fetch(url, { method: 'POST', body });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function queryWithFallback(query) {
  for (const server of SERVERS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await tryRequest(server, query);
      } catch {
        // retry once, then move to next server
      }
    }
  }
  throw new Error('Nearby hospital service is temporarily unavailable.');
}

function NearbyHospitals({ weather }) {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const lat  = weather?.lat;
  const lon  = weather?.lon;
  const city = weather?.city;

  useEffect(() => {
    if (lat == null || lon == null) return;

    setLoading(true);
    setError('');
    setHospitals([]);

    const query = `[out:json][timeout:25];node["amenity"="hospital"](around:5000,${lat},${lon});out body;`;

    queryWithFallback(query)
      .then((data) => setHospitals(data.elements || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [lat, lon]);

  const buildAddress = (tags) => {
    const parts = [
      tags['addr:housenumber'],
      tags['addr:street'],
      tags['addr:suburb'],
      tags['addr:city'],
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  };

  if (lat == null || lon == null) {
    return (
      <div className="card">
        <h2>🏥 Nearby Hospitals</h2>
        <p className="hospitals-hint">Search a city to find nearby hospitals.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>🏥 Nearby Hospitals — {city}</h2>

      {loading && (
        <p className="hospitals-hint">Searching for hospitals within 5 km…</p>
      )}

      {error && (
        <div className="prediction-error" style={{ marginTop: 0 }}>{error}</div>
      )}

      {!loading && !error && hospitals.length === 0 && (
        <p className="hospitals-hint">No hospitals found within 5 km of {city}.</p>
      )}

      {!loading && !error && hospitals.length > 0 && (
        <>
          <p className="hospitals-count">{hospitals.length} hospital{hospitals.length !== 1 ? 's' : ''} found within 5 km</p>
          <div className="hospitals-grid">
            {hospitals.map((h) => {
              const name    = h.tags?.name || 'Unnamed Hospital';
              const address = buildAddress(h.tags || {});
              return (
                <div key={h.id} className="hospital-card">
                  <div className="hospital-icon">🏥</div>
                  <div className="hospital-info">
                    <div className="hospital-name">{name}</div>
                    {address && <div className="hospital-address">{address}</div>}
                    <div className="hospital-coords">
                      {h.lat.toFixed(4)}°N, {h.lon.toFixed(4)}°E
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default NearbyHospitals;
