function toFiniteNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatTemperature(celsius, fractionDigits = 1) {
  const value = toFiniteNumber(celsius);
  if (value == null) return "—";
  const fahrenheit = (value * 9) / 5 + 32;
  return `${value.toFixed(fractionDigits)}°C / ${fahrenheit.toFixed(fractionDigits)}°F`;
}

export function formatTemperatureDelta(celsius, fractionDigits = 1) {
  const value = toFiniteNumber(celsius);
  if (value == null) return "—";
  const fahrenheitDelta = (value * 9) / 5;
  return `${value.toFixed(fractionDigits)}°C / ${fahrenheitDelta.toFixed(fractionDigits)}°F`;
}