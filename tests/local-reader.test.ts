import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { readLocal, validateReading } from '../apps/web/src/local-reader.ts';

function fixture() {
  const capture = JSON.parse(readFileSync(new URL('../research/captures/mt760-native-restored.json', import.meta.url), 'utf8'));
  return {source:'linux-hidraw', experimental:true, vendorId:0x24ae, productId:0x1870, capturedAt:capture.capturedAt,
    batteryPercent:59, dpiValues:[1000,1200,1350,800,2400,3200,4000], enabledStages:3, activeIndex:2, activeDpi:1350,
    rawResponses:Object.fromEntries(capture.queries.slice(0,2).map((q: {name:string; responseBufferHex:string; returnedBytes:number}) => [q.name,q.responseBufferHex.slice(0,q.returnedBytes*2)]))};
}

test('accepts observed telemetry and rejects malformed or inconsistent values', () => {
  const data = fixture();
  assert.equal(validateReading(data).activeDpi, 1350);
  for (const invalid of [null, {}, {...data,batteryPercent:101}, {...data,activeIndex:3}, {...data,activeDpi:1000},
    {...data,capturedAt:'bad'}, {...data,rawResponses:{}}, {...data,source:'WebHID'}]) {
    assert.throws(() => validateReading(invalid), /dados inválidos/);
  }
});

test('uses fixed POST without payload; rejects bridge failure or unavailability', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'http://127.0.0.1:5175/api/telemetry');
      assert.equal(init?.method, 'POST'); assert.equal(init?.body, undefined);
      assert.equal(init?.cache, 'no-store');
      return Response.json(fixture());
    };
    assert.equal((await readLocal()).batteryPercent, 59);
    globalThis.fetch = async () => Response.json({error:'Mouse desconectado'}, {status:503});
    await assert.rejects(readLocal(), /Mouse desconectado/);
    globalThis.fetch = async () => {throw new Error('offline');};
    await assert.rejects(readLocal(), /npm run bridge/);
  } finally {globalThis.fetch = original;}
});
