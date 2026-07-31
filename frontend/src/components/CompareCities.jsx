import { useState } from 'react';

const ROWS = [
  { label: 'Temperature',        key: 'temperature',          unit: '°C' },
  { label: 'Humidity',           key: 'humidity',             unit: '%'  },
  { label: 'Rainfall',           key: 'rainfall',             unit: ' mm'},
  { label: 'Wind Speed',         key: 'wind_speed',           unit: ' m/s'},
  { label: 'Weather Condition',  key: 'weather_description',  unit: ''   },
  { label: 'Heat Risk',          key: 'heat_risk',            unit: ''   },
  { label: 'Heat Risk Confidence', key: 'heat_risk_confidence', unit: '%'},
];

function riskClass(value) {
  if (!value) return '';
  const v = String(value).toLowerCase();
  if (v === 'high'     || v === 'critical') return 'risk-badge risk-high';
  if (v === 'medium')                       return 'risk-badge risk-medium';
  if (v === 'low')                          return 'risk-badge risk-low';
  return '';
}

function highlight(key, a, b) {
  if (a == null || b == null) return { a: '', b: '' };
  const numA = parseFloat(a);
  const numB = parseFloat(b);
  if (isNaN(numA) || isNaN(numB)) return { a: '', b: '' };
  if (key === 'heat_risk_confidence' || key === 'temperature' ||
      key === 'humidity' || key === 'rainfall' || key === 'wind_speed') {
    if (numA > numB) return { a: 'cell-higher', b: 'cell-lower' };
    if (numA < numB) return { a: 'cell-lower',  b: 'cell-higher' };
  }
  return { a: '', b: '' };
}

function fetchCity(city) {
  return fetch(`http://127.0.0.1:5000/weather?city=${encodeURIComponent(city)}`)
    .then((res) => res.json())
    .then((data) => {
      if (data.error) throw new Error(data.error);
      return data;
    });
}

function CompareCities() {
  const [cityA, setCityA]   = useState('');
  const [cityB, setCityB]   = useState('');
  const [dataA, setDataA]   = useState(null);
  const [dataB, setDataB]   = useState(null);
  const [errorA, setErrorA] = useState('');
  const [errorB, setErrorB] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCompare = async () => {
    const trimA = cityA.trim();
    const trimB = cityB.trim();
    if (!trimA || !trimB) return;

    setLoading(true);
    setDataA(null);
    setDataB(null);
    setErrorA('');
    setErrorB('');

    const [resA, resB] = await Promise.allSettled([
      fetchCity(trimA),
      fetchCity(trimB),
    ]);

    if (resA.status === 'fulfilled') setDataA(resA.value);
    else setErrorA(resA.reason?.message || 'Unable to fetch city.');

    if (resB.status === 'fulfilled') setDataB(resB.value);
    else setErrorB(resB.reason?.message || 'Unable to fetch city.');

    setLoading(false);
  };

  const handleKey = (e) => { if (e.key === 'Enter') handleCompare(); };
  const showTable = dataA && dataB;

  return (
    <div className="card">
      <h2>🏙️ Compare Two Cities</h2>

      <div className="compare-inputs">
        <div className="compare-input-group">
          <label className="compare-label">City 1</label>
          <input
            className="compare-input"
            type="text"
            placeholder="e.g. Chennai"
            value={cityA}
            onChange={(e) => setCityA(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
          />
          {errorA && <span className="compare-error">{errorA}</span>}
        </div>

        <div className="compare-input-group">
          <label className="compare-label">City 2</label>
          <input
            className="compare-input"
            type="text"
            placeholder="e.g. Delhi"
            value={cityB}
            onChange={(e) => setCityB(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
          />
          {errorB && <span className="compare-error">{errorB}</span>}
        </div>

        <button
          className="predict-button compare-btn"
          onClick={handleCompare}
          disabled={loading || !cityA.trim() || !cityB.trim()}
        >
          {loading ? 'Comparing…' : '⚖️ Compare'}
        </button>
      </div>

      {showTable && (
        <div className="compare-table-wrapper">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>{dataA.city}</th>
                <th>{dataB.city}</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(({ label, key, unit }) => {
                const valA = dataA[key];
                const valB = dataB[key];
                const hl   = highlight(key, valA, valB);
                const isRisk = key === 'heat_risk';

                return (
                  <tr key={key}>
                    <td className="compare-metric">{label}</td>
                    <td className={hl.a}>
                      {isRisk
                        ? <span className={riskClass(valA)}>{valA ?? '—'}</span>
                        : `${valA ?? '—'}${valA != null ? unit : ''}`}
                    </td>
                    <td className={hl.b}>
                      {isRisk
                        ? <span className={riskClass(valB)}>{valB ?? '—'}</span>
                        : `${valB ?? '—'}${valB != null ? unit : ''}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default CompareCities;
