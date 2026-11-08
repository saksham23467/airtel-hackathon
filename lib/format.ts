export function inr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function percent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}
