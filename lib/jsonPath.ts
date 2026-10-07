export interface PathMatch {
  path: string;
  value: unknown;
}

type Step = { kind: "child"; key: string } | { kind: "index"; index: number } | { kind: "wild" } | { kind: "desc"; key: string | null } | { kind: "slice"; from: number | null; to: number | null };

function tokenize(expr: string): Step[] {
  const s = expr.trim();
  if (!s.startsWith("$")) throw new Error('A JSONPath must start with "$"');
  const steps: Step[] = [];
  let i = 1;
  const readName = () => {
    const m = /^[A-Za-z0-9_$\-\u0080-￿]+/.exec(s.slice(i));
    if (!m) throw new Error(`Expected a property name at position ${i}`);
    i += m[0].length;
    return m[0];
  };
  while (i < s.length) {
    if (s.startsWith("..", i)) {
      i += 2;
      if (s[i] === "*") {
        i++;
        steps.push({ kind: "desc", key: null });
      } else if (s[i] === "[") {
        // ..[...] — descend then apply bracket; treat as descendant wildcard followed by the bracket step
        steps.push({ kind: "desc", key: null });
      } else steps.push({ kind: "desc", key: readName() });
    } else if (s[i] === ".") {
      i++;
      if (s[i] === "*") {
        i++;
        steps.push({ kind: "wild" });
      } else steps.push({ kind: "child", key: readName() });
    } else if (s[i] === "[") {
      const end = s.indexOf("]", i);
      if (end === -1) throw new Error("Missing closing ]");
      const inner = s.slice(i + 1, end).trim();
      i = end + 1;
      if (inner === "*") steps.push({ kind: "wild" });
      else if (/^-?\d+$/.test(inner)) steps.push({ kind: "index", index: Number(inner) });
      else if (/^(-?\d+)?:(-?\d+)?$/.test(inner)) {
        const [a, b] = inner.split(":");
        steps.push({ kind: "slice", from: a === "" ? null : Number(a), to: b === "" ? null : Number(b) });
      } else if (/^(['"]).*\1$/.test(inner)) steps.push({ kind: "child", key: inner.slice(1, -1) });
      else throw new Error(`Unsupported selector [${inner}]`);
    } else throw new Error(`Unexpected "${s[i]}" at position ${i}`);
  }
  return steps;
}

const childPath = (base: string, key: string | number) =>
  typeof key === "number" ? `${base}[${key}]` : /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `${base}.${key}` : `${base}['${key.replace(/'/g, "\\'")}']`;

function descendants(node: PathMatch): PathMatch[] {
  const out: PathMatch[] = [node];
  const walk = (m: PathMatch) => {
    if (Array.isArray(m.value)) {
      m.value.forEach((v, i) => {
        const c = { path: childPath(m.path, i), value: v };
        out.push(c);
        walk(c);
      });
    } else if (m.value && typeof m.value === "object") {
      for (const [k, v] of Object.entries(m.value as Record<string, unknown>)) {
        const c = { path: childPath(m.path, k), value: v };
        out.push(c);
        walk(c);
      }
    }
  };
  walk(node);
  return out;
}

/** Evaluate a JSONPath (child, index, slice, wildcard, recursive descent). Throws on a malformed path. */
export function queryJsonPath(root: unknown, expr: string): PathMatch[] {
  let current: PathMatch[] = [{ path: "$", value: root }];
  for (const step of tokenize(expr)) {
    const next: PathMatch[] = [];
    for (const m of current) {
      const v = m.value;
      if (step.kind === "child") {
        if (v && typeof v === "object" && !Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, step.key)) next.push({ path: childPath(m.path, step.key), value: (v as Record<string, unknown>)[step.key] });
      } else if (step.kind === "index") {
        if (Array.isArray(v)) {
          const idx = step.index < 0 ? v.length + step.index : step.index;
          if (idx >= 0 && idx < v.length) next.push({ path: childPath(m.path, idx), value: v[idx] });
        }
      } else if (step.kind === "wild") {
        if (Array.isArray(v)) v.forEach((x, i) => next.push({ path: childPath(m.path, i), value: x }));
        else if (v && typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) next.push({ path: childPath(m.path, k), value: x });
      } else if (step.kind === "slice") {
        if (Array.isArray(v)) {
          const norm = (n: number | null, d: number) => (n === null ? d : n < 0 ? Math.max(0, v.length + n) : Math.min(n, v.length));
          for (let i = norm(step.from, 0); i < norm(step.to, v.length); i++) next.push({ path: childPath(m.path, i), value: v[i] });
        }
      } else {
        for (const d of descendants(m)) {
          if (step.key === null) next.push(d);
          else if (d.value && typeof d.value === "object" && !Array.isArray(d.value) && Object.prototype.hasOwnProperty.call(d.value, step.key)) {
            next.push({ path: childPath(d.path, step.key), value: (d.value as Record<string, unknown>)[step.key] });
          }
        }
      }
    }
    current = next;
  }
  return current;
}
