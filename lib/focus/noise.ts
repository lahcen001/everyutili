export type NoiseKind = "white" | "pink" | "brown";

/** Fills a mono buffer with white, pink (Paul Kellet) or brown noise samples in [-1, 1]. */
export function fillNoise(data: Float32Array, kind: NoiseKind, random: () => number = Math.random): void {
  if (kind === "white") {
    for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1;
    return;
  }
  if (kind === "pink") {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < data.length; i++) {
      const w = random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return;
  }
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const w = random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    data[i] = last * 3.5;
  }
}
