export function assemble(ranked: string[], depsOf: Record<string, string[]>, k: number): string[] {
  const rank = new Map(ranked.map((id, index) => [id, index]));
  const chosen: string[] = [];
  const used = new Set<string>();

  const bestBase = (deps: string[], have: Set<string>) => {
    const present = deps.filter((dep) => have.has(dep) && rank.has(dep));
    const pool = present.length ? present : deps.filter((dep) => rank.has(dep));
    if (!pool.length) return null;
    return pool.sort((a, b) => (rank.get(a)! - rank.get(b)!) || a.localeCompare(b))[0];
  };

  const chain = (productId: string, acc: string[], stack: Set<string>): string[] | null => {
    const have = new Set([...used, ...acc]);
    if (have.has(productId)) return [];
    if (stack.has(productId) || !rank.has(productId)) return null;
    const out: string[] = [];
    const deps = depsOf[productId] ?? [];
    if (deps.length && !deps.some((dep) => have.has(dep))) {
      const base = bestBase(deps, have);
      if (!base) return null;
      const nested = chain(base, [...acc, ...out], new Set([...stack, productId]));
      if (!nested) return null;
      out.push(...nested);
    }
    out.push(productId);
    return out;
  };

  for (const productId of ranked) {
    if (chosen.length >= k) break;
    if (used.has(productId)) continue;
    const extra = chain(productId, [], new Set());
    if (!extra || chosen.length + extra.length > k) continue;
    for (const item of extra) {
      if (!used.has(item)) {
        chosen.push(item);
        used.add(item);
      }
    }
  }
  return chosen;
}

export function bundleViolations(chosen: string[], eligible: Set<string>, depsOf: Record<string, string[]>): string[] {
  const problems: string[] = [];
  const have = new Set(chosen);
  for (const id of chosen) {
    if (!eligible.has(id)) problems.push(`${id} is not eligible`);
    const deps = depsOf[id] ?? [];
    if (deps.length && !deps.some((dep) => have.has(dep))) problems.push(`${id} is missing a required base`);
  }
  return problems;
}

export type BundleItem = {
  id: string;
  origin: "model" | "dependency_base";
  rank: number | null;
  satisfiedBy: string | null;
  requiresOneOf: string[];
};

export function annotateBundle(chosen: string[], ranked: string[], depsOf: Record<string, string[]>): BundleItem[] {
  const rank = new Map(ranked.map((id, index) => [id, index]));
  const origins = new Map<string, "model" | "dependency_base">();
  const used = new Set<string>();
  const chosenSet = new Set(chosen);
  for (const productId of ranked) {
    if (used.size >= chosen.length) break;
    if (used.has(productId) || !chosenSet.has(productId)) continue;
    const deps = depsOf[productId] ?? [];
    if (deps.length && !deps.some((dep) => used.has(dep))) {
      for (const base of chosen.filter((dep) => deps.includes(dep) && !used.has(dep))) {
        if (!origins.has(base)) origins.set(base, "dependency_base");
        used.add(base);
      }
    }
    if (!origins.has(productId)) origins.set(productId, "model");
    used.add(productId);
  }
  return chosen.map((id) => {
    const deps = depsOf[id] ?? [];
    const hits = chosen.filter((dep) => deps.includes(dep));
    const satisfiedBy = hits.sort((a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999) || a.localeCompare(b))[0] ?? null;
    return {
      id,
      origin: origins.get(id) ?? "model",
      rank: rank.has(id) ? rank.get(id)! + 1 : null,
      satisfiedBy,
      requiresOneOf: [...deps].sort(),
    };
  });
}
