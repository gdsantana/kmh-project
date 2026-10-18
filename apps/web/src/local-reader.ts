export type Reading = {
  source: 'linux-hidraw'; experimental: true; vendorId: number; productId: number;
  capturedAt: string; batteryPercent: number; dpiValues: number[]; enabledStages: number;
  activeIndex: number; activeDpi: number; pollingRateCode: number; pollingRateHz: number | null; rawResponses: Record<string, string>;
};

export function validateReading(value: unknown): Reading {
  const d = value as Reading | null;
  const rates: Record<number, number | undefined> = {8: 125, 4: 250, 2: 500, 1: 1000};
  if (!d || d.source !== 'linux-hidraw' || d.experimental !== true || d.vendorId !== 0x24ae || d.productId !== 0x1870
    || typeof d.capturedAt !== 'string' || !Number.isFinite(Date.parse(d.capturedAt))
    || !Number.isInteger(d.batteryPercent) || d.batteryPercent < 0 || d.batteryPercent > 100
    || !Array.isArray(d.dpiValues) || d.dpiValues.length !== 7 || !d.dpiValues.every(v => Number.isInteger(v) && v >= 0)
    || !Number.isInteger(d.enabledStages) || d.enabledStages < 1 || d.enabledStages > 7
    || !Number.isInteger(d.activeIndex) || d.activeIndex < 0 || d.activeIndex >= d.enabledStages
    || d.activeDpi !== d.dpiValues[d.activeIndex] || d.activeDpi <= 0
    || !Number.isInteger(d.pollingRateCode) || d.pollingRateCode < 0 || d.pollingRateCode > 255
    || d.pollingRateHz !== (rates[d.pollingRateCode] ?? null)
    || !d.rawResponses || typeof d.rawResponses.battery !== 'string' || !/^[0-9a-f]{6}$/.test(d.rawResponses.battery)
    || typeof d.rawResponses['dpi-list'] !== 'string' || !/^[0-9a-f]{56}$/.test(d.rawResponses['dpi-list'])
    || typeof d.rawResponses['polling-rate'] !== 'string' || !/^[0-9a-f]{56}$/.test(d.rawResponses['polling-rate'])) {
    throw new Error('A ponte retornou dados inválidos. Nenhum valor foi atualizado.');
  }
  return d;
}

export async function readLocal(): Promise<Reading> {
  let response: Response;
  try {
    response = await fetch('http://127.0.0.1:5175/api/telemetry', {
      method: 'POST', headers: {'X-Rapoo-Read': '1'}, cache: 'no-store', signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error('Ponte local indisponível ou tempo de leitura excedido. Execute npm run bridge e tente novamente.');
  }
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Falha na ponte local.');
  return validateReading(result);
}
