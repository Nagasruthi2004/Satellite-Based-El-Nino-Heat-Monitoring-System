import { getSatelliteData } from "../data/satelliteData";

export default function SatelliteMonitoring({ city }) {
  const observation = getSatelliteData(city);
  const details = [
    ["Satellite", observation.satelliteName],
    ["Source", observation.source],
    ["Observation Date", observation.observationDate],
    ["Region", observation.region],
    ["Surface Temperature", observation.surfaceTemperature],
    ["Vegetation Index (NDVI)", observation.ndvi],
    ["Cloud Coverage", observation.cloudCoverage],
  ];

  return (
    <article className="card satellite-observation-card">
      <div className="satellite-observation-heading">
        <div>
          <p className="eyebrow">Offline satellite observation</p>
          <h2 className="section-title">🛰 Latest Satellite Observation</h2>
        </div>
        <span className="satellite-status">{observation.status}</span>
      </div>

      <img className="satellite-observation-image" src={observation.image} alt={`Satellite-style observation of ${observation.region}`} />

      <div className="satellite-meta satellite-observation-meta">
        {details.map(([label, value]) => (
          <div className="satellite-meta-item" key={label}>
            <div className="meta-label">{label}</div>
            <div className="meta-value">{value}</div>
          </div>
        ))}
      </div>

      <section className="satellite-observation-note">
        <h3>Observation</h3>
        <p>{observation.observation}</p>
      </section>
    </article>
  );
}
