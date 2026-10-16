import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { hex, summarizeCollections } from '../packages/core/src/index.ts';
import { availability, closeInspections, describeError, inspectAuthorizedDevices, inspectDevice, requestInspections, snapshotCollections } from '../packages/transport-webhid/src/index.ts';
import { collections } from './fixtures/hid.ts';

function device(fail = false) {
  return {
    vendorId: 0x24ae, productId: 0x1870, productName: 'Synthetic test device',
    collections, opened: false, opens: 0, closes: 0,
    async open() { this.opens++; if (fail) throw new DOMException('denied', 'NetworkError'); this.opened = true; },
    async close() { this.closes++; this.opened = false; },
    sendReport() { assert.fail('PoC must never send reports'); },
    sendFeatureReport() { assert.fail('PoC must never send feature reports'); },
    receiveFeatureReport() { assert.fail('No unverified feature reads'); },
  };
}

test('checks secure context and WebHID availability', () => {
  assert.match(availability(false, undefined)!, /HTTPS/);
  assert.match(availability(true, undefined)!, /WebHID indisponível/);
  assert.equal(availability(true, {} as HID), null);
});

test('serializes nested collections, keeps item metadata and rounds payload lengths excluding report ID', () => {
  const result = snapshotCollections(collections);
  assert.deepEqual(summarizeCollections(result), {collections: 2, vendorCollections: 2, inputReports: 1, outputReports: 1, featureReports: 1});
  assert.equal(result[0].outputReports[0].bitLength, 9);
  assert.equal(result[0].outputReports[0].byteLength, 2);
  assert.equal(result[0].featureReports[0].byteLength, 28);
  assert.deepEqual(result[0].children[0].inputReports[0].items[0], {reportSize: 8, reportCount: 28, usages: [1]});
  assert.notEqual(result[0].children[0].inputReports[0].items[0], collections[0].children![0].inputReports![0].items![0]);
  assert.equal(hex(0x24ae), '0x24AE');
});

test('missing descriptor fields remain unknown, not guessed', () => {
  const result = snapshotCollections([{featureReports: [{items: [{}]}]}, {}]);
  assert.equal(result[0].usagePage, null);
  assert.equal(result[0].featureReports[0].reportId, null);
  assert.equal(result[0].featureReports[0].byteLength, null);
  assert.deepEqual(result[1].children, []);
  assert.equal(hex(null), 'Desconhecido');
});

test('opens and closes without issuing reports; reuses an already-open handle', async () => {
  const d = device();
  const inspection = await inspectDevice(d as unknown as HIDDevice);
  assert.equal(inspection.snapshot.opened, true);
  assert.equal(inspection.snapshot.error, null);
  await inspectDevice(d as unknown as HIDDevice);
  assert.equal(d.opens, 1);
  await closeInspections([inspection]);
  assert.equal(d.closes, 1);
  assert.equal(d.opened, false);
});

test('denied open still exposes descriptors and a useful error', async () => {
  const d = device(true);
  const {snapshot} = await inspectDevice(d as unknown as HIDDevice);
  assert.equal(snapshot.opened, false);
  assert.match(snapshot.error!, /hidraw/);
  assert.equal(snapshot.collections.length, 1);
});

test('request runs immediately in user gesture and inspects all selected handles', async () => {
  const options: HIDDeviceRequestOptions[] = [];
  const devices = [device(), device(true)];
  const hid = {requestDevice: async (opts: HIDDeviceRequestOptions) => {
    options.push(opts); return devices as unknown as HIDDevice[];
  }} as HID;
  const pending = requestInspections(hid, true);
  assert.deepEqual(options, [{filters: [{vendorId: 0x24ae}]}]);
  const result = await pending;
  assert.deepEqual(result.map(i => i.snapshot.opened), [true, false]);
  await closeInspections(result);
  await requestInspections(hid, false);
  assert.deepEqual(options[1], {filters: []});
});

test('cancel and chooser rejection are handled without opening a device', async () => {
  assert.deepEqual(await requestInspections({requestDevice: async () => []} as unknown as HID, true), []);
  await assert.rejects(requestInspections({requestDevice: async () => {throw new DOMException('cancel', 'NotFoundError');}} as unknown as HID, true));
  assert.match(describeError(new DOMException('cancel', 'NotFoundError')), /Nenhum dispositivo/);
  assert.match(describeError(new DOMException('protected', 'SecurityError')), /protegida/);
});

test('closes remaining handles even when one close fails', async () => {
  const a = device(), b = device();
  const ia = await inspectDevice(a as unknown as HIDDevice);
  const ib = await inspectDevice(b as unknown as HIDDevice);
  a.close = async () => {throw new Error('busy');};
  await assert.rejects(closeInspections([ia, ib]), /busy/);
  assert.equal(b.closes, 1);
});

test('production transport contains no report read or write calls', () => {
  const source = readFileSync(new URL('../packages/transport-webhid/src/index.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\.(sendReport|sendFeatureReport|receiveFeatureReport)\s*\(/);
});


test('reopens only authorized devices matching the selected filter without a chooser', async () => {
  const a = device(), b = device();
  b.vendorId = 0x046d;
  const hid = {getDevices: async () => [a, b]} as unknown as HID;
  const filtered = await inspectAuthorizedDevices(hid, true);
  assert.equal(filtered.length, 1);
  assert.equal(a.opens, 1);
  assert.equal(b.opens, 0);
  await closeInspections(filtered);
  const all = await inspectAuthorizedDevices(hid, false);
  assert.equal(all.length, 2);
  await closeInspections(all);
});
