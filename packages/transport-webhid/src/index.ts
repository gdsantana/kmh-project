import type { Collection, DeviceSnapshot, Report } from '@rapoo/core';

export type Inspection = { device: HIDDevice; snapshot: DeviceSnapshot };

export function availability(secure: boolean, hid: HID | undefined): string | null {
  if (!secure) return 'Abra por HTTPS ou localhost para permitir acesso ao mouse.';
  if (!hid) return 'WebHID indisponível neste navegador. Abra esta página no Chrome ou Chromium para desktop.';
  return null;
}

export function describeError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotFoundError') return 'Nenhum dispositivo selecionado. Tente novamente e escolha o mouse ou receptor.';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'O navegador negou o acesso. Verifique a permissão do site e se a interface HID é protegida.';
  if (name === 'NetworkError') return 'Não foi possível abrir a interface. No Linux, verifique a permissão de /dev/hidraw e se outro aplicativo está usando o dispositivo.';
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function reports(infos: HIDReportInfo[] = []): Report[] {
  return infos.map(report => {
    const items = report.items ?? [];
    const bitLength = items.some(item => item.reportSize === undefined || item.reportCount === undefined)
      || report.items === undefined ? null
      : items.reduce((bits, item) => bits + item.reportSize! * item.reportCount!, 0);
    return {
      reportId: report.reportId ?? null, bitLength, byteLength: bitLength === null ? null : Math.ceil(bitLength / 8),
      items: items.map(item => structuredClone(item)),
    };
  });
}

export function snapshotCollections(collections: HIDCollectionInfo[] = []): Collection[] {
  return collections.map(c => ({
    usagePage: c.usagePage ?? null, usage: c.usage ?? null, type: c.type ?? null,
    inputReports: reports(c.inputReports), outputReports: reports(c.outputReports),
    featureReports: reports(c.featureReports), children: snapshotCollections(c.children),
  }));
}

export async function inspectDevice(device: HIDDevice): Promise<Inspection> {
  let error = null;
  try {
    if (!device.opened) await device.open();
  } catch (cause) {
    error = describeError(cause);
  }
  return { device, snapshot: {
    productName: device.productName, vendorId: device.vendorId, productId: device.productId,
    opened: device.opened, error, collections: snapshotCollections(device.collections),
  } };
}

export async function closeInspections(inspections: Inspection[]): Promise<void> {
  // Close every handle even when one of them fails; callers keep errors visible.
  const results = await Promise.allSettled(inspections.map(i => i.device.opened ? i.device.close() : Promise.resolve()));
  const failed = results.find(result => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
}

export async function requestInspections(hid: HID, rapooOnly: boolean): Promise<Inspection[]> {
  const devices = await hid.requestDevice({ filters: rapooOnly ? [{ vendorId: 0x24ae }] : [] });
  return Promise.all(devices.map(inspectDevice));
}

export async function inspectAuthorizedDevices(hid: HID, rapooOnly: boolean): Promise<Inspection[]> {
  const devices = await hid.getDevices();
  return Promise.all(devices.filter(d => !rapooOnly || d.vendorId === 0x24ae).map(inspectDevice));
}
