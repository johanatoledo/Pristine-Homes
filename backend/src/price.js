// Regla de tarifas coherente con el front
export function estimatePrice({ base, beds, baths, freq, extras = [] }) {
  let price = base + beds * 8 + baths * 12;
  if (freq === 'semanal') price *= 0.85;
  if (freq === 'quincenal') price *= 0.9;
  if (freq === 'mensual') price *= 0.95;
  const extraMap = { ventanas: 15, horno: 12, refrigerador: 12, plancha: 10 };
  for (const x of extras) price += extraMap[x] ?? 8;
  return Number(price.toFixed(2));
}