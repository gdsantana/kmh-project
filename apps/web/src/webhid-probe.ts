export type ProbeResult = {
  source: 'WebHID'; requestedAt: string; requestHex: string;
  reports: {reportId: number; dataHex: string}[]; error: string | null;
};

export function supportsProbe(device: HIDDevice): boolean {
  return device.vendorId === 0x24ae && device.productId === 0x1870 && device.opened
    && device.collections.some(c => c.usagePage === 0xff00 && c.usage === 0x0e
      && c.outputReports?.some(r => r.reportId === 0xba
        && r.items?.reduce((bits, i) => bits + (i.reportSize ?? 0) * (i.reportCount ?? 0), 0) === 248));
}

export function probeBattery(device: HIDDevice, timeoutMs = 3000): Promise<ProbeResult> {
  if (!supportsProbe(device)) return Promise.reject(new Error('Abra a interface Rapoo FF00/0E com report BA de 31 bytes.'));
  const payload = new Uint8Array(31);
  payload.set([0xa5, 0xaa]);
  const result: ProbeResult = {source: 'WebHID', requestedAt: new Date().toISOString(),
    requestHex: 'ba' + Array.from(payload, b => b.toString(16).padStart(2, '0')).join(''), reports: [], error: null};
  return new Promise(resolve => {
    const listener = (event: HIDInputReportEvent) => {
      if (event.reportId !== 0xba) return;
      result.reports.push({reportId: event.reportId, dataHex: Array.from(
        new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength),
        b => b.toString(16).padStart(2, '0')).join('')});
    };
    const finish = () => { device.removeEventListener('inputreport', listener); clearTimeout(timer); resolve(result); };
    device.addEventListener('inputreport', listener);
    const timer = setTimeout(finish, timeoutMs);
    device.sendReport(0xba, payload).catch(error => { result.error = String(error); finish(); });
  });
}
