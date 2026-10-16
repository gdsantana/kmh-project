import http.client
import importlib.util
import json
from pathlib import Path
import subprocess
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("bridge", ROOT / "apps/bridge/server.py")
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class BridgeTests(unittest.TestCase):
    def test_decodes_actual_button_cycle_and_rejects_invalid_data(self):
        for filename, expected in (("baseline", 1350), ("dpi-button", 1000), ("dpi-button-2", 1200), ("restored", 1350)):
            capture = json.loads((ROOT / f"research/captures/mt760-native-{filename}.json").read_text())
            battery, dpi = [bytes.fromhex(q["responseBufferHex"])[:q["returnedBytes"]] for q in capture["queries"][:2]]
            result = bridge.decode(battery, dpi)
            self.assertEqual((result["batteryPercent"], result["activeDpi"], result["enabledStages"]), (59, expected, 3))
        for bad_battery, bad_dpi in ((b"\x02", dpi), (bytes([1, 1, 101]), dpi), (battery, battery),
                                     (battery, dpi[:20] + b"\x07" + dpi[21:])):
            with self.assertRaises(ValueError):
                bridge.decode(bad_battery, bad_dpi)

    def test_worker_failure_or_timeout_prevents_partial_snapshot(self):
        for failure in (subprocess.CompletedProcess([], 1, "", "permission denied"), subprocess.TimeoutExpired([], 8)):
            with patch.object(bridge.subprocess, "run", side_effect=[failure]) as worker:
                with self.assertRaises((RuntimeError, subprocess.TimeoutExpired)):
                    bridge.read_snapshot()
                self.assertEqual(worker.call_count, 1)

    def test_http_origin_host_payload_lock_and_failure(self):
        server = bridge.ThreadingHTTPServer(("127.0.0.1", 0), bridge.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        def request(method="POST", origin="http://127.0.0.1:5174", host="127.0.0.1:5175", body=None, custom="1"):
            client = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=2)
            try:
                client.request(method, "/api/telemetry", body=body,
                               headers={"Host": host, "Origin": origin, "X-Rapoo-Read": custom,
                                        "Access-Control-Request-Method": "POST"})
                reply = client.getresponse()
                return reply.status, reply.getheader("Access-Control-Allow-Origin"), reply.read()
            finally:
                client.close()
        try:
            with patch.object(bridge, "read_snapshot", return_value={"batteryPercent": 59}) as reader:
                self.assertEqual(request(origin="https://evil.example")[0], 403)
                self.assertEqual(request(host="evil.example:5175")[0], 403)
                self.assertEqual(request(custom="")[0], 400)
                self.assertEqual(request(body="{}")[0], 400)
                self.assertEqual(request(method="OPTIONS")[:2], (204, "http://127.0.0.1:5174"))
                reader.assert_not_called()
                bridge.READ_LOCK.acquire()
                try:
                    self.assertEqual(request()[0], 409)
                finally:
                    bridge.READ_LOCK.release()
                self.assertEqual(request()[:2], (200, "http://127.0.0.1:5174"))
                self.assertEqual(reader.call_count, 1)
            with patch.object(bridge, "read_snapshot", side_effect=RuntimeError("disconnected")):
                status, _, body = request()
                self.assertEqual(status, 503)
                self.assertIn("disconnected", json.loads(body)["error"])
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
