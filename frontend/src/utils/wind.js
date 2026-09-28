export function formatWindSpeedKmh(value, sourceUnit = "m/s") {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "—";

  const kilometersPerHour = sourceUnit === "km/h" ? numericValue : numericValue * 3.6;
  return kilometersPerHour.toFixed(2);
}
