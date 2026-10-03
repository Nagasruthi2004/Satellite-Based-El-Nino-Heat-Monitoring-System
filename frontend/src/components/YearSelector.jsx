export default function YearSelector({
  years = [2020, 2021, 2022, 2023, 2024, 2025],
  selectedYear = 2025,
  onChange,
  disabled = false,
}) {
  return (
    <div className="year-selector-wrap" role="group" aria-label="Select Year for India LST Data">
      <span className="year-selector-label">Select Year:</span>
      <div className="year-selector-buttons" role="tablist">
        {years.map((year) => {
          const isSelected = selectedYear === year;
          return (
            <button
              key={year}
              type="button"
              className={`year-btn ${isSelected ? "active" : ""}`}
              onClick={() => onChange && onChange(year)}
              disabled={disabled}
              aria-selected={isSelected}
              role="tab"
              id={`year-btn-${year}`}
            >
              <span>{year}</span>
              {isSelected && <span className="active-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="year-selector-dropdown-wrap">
        <select
          className="year-selector-dropdown"
          value={selectedYear}
          onChange={(e) => onChange && onChange(Number(e.target.value))}
          disabled={disabled}
          aria-label="Select Year"
          id="year-selector-dropdown"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              Year {year}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
