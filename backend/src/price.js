// Regla de tarifas coherente con el front
export function estimatePrice({ base, beds, baths, freq, extras = [] }) {
  let price = base + beds * 8 + baths * 12;
  if (freq === 'Weekly') price *= 0.85;
  if (freq === 'Biweekly') price *= 0.9;
  if (freq === 'Monthly') price *= 0.95;
  const extraMap = { windows: 15, oven: 12, fridge: 12, iron:10 };
  for (const x of extras) price += extraMap[x] ?? 8;
  return Number(price.toFixed(2));
}