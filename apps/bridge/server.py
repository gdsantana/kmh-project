"""Loopback-only bridge for fixed, observed MT760 read queries."""
import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import struct
import subprocess
import sys
import threading

ROOT = Path(__file__).resolve().parents[2]
DIAGNOSTIC = ROOT / "research/experiments/read-mt760.py"
ORIGINS = {"http://127.0.0.1:5174", "http://localhost:5174", "http://127.0.0.1:4173", "http://localhost:4173"}
READ_LOCK = threading.Lock()


def decode(battery, dpi):
    if len(battery) != 3 or battery[0] != 1 or not 0 <= battery[2] <= 100 or battery[1] not in (1, 2):
        raise ValueError("Resposta de bateria inválida; tente novamente com o mouse acordado.")
    if len(dpi) != 28 or dpi[0] != 1:
        raise ValueError("Resposta de DPI inválida; tente novamente com o mouse acordado.")
    values = [value * 50 for value in struct.unpack("<7H", dpi[4:18])]
    enabled, index = dpi[18] + 1, dpi[20]
    if not 1 <= enabled <= 7 or not 0 <= index < enabled or any(value == 0 for value in values[:enabled]):
        raise ValueError("Índice ou quantidade de estágios DPI inválidos.")
    return {"batteryPercent": battery[2], "dpiValues": values, "enabledStages": enabled,
            "activeIndex": index, "activeDpi": values[index]}


def decode_polling(polling, dpi):
    if len(polling) != 28 or polling[0] != 1 or len(dpi) != 28 or dpi[0] != 1:
        raise ValueError("Resposta de polling rate inválida.")
    if polling[12:28] != dpi[4:20]:
        raise ValueError("Blocos de polling rate e DPI incompatíveis; leitura descartada.")
    code = polling[5]  # Wireless getter uses register 0x631; wired getter uses 0x630.
    return {"pollingRateCode": code, "pollingRateHz": {8: 125, 4: 250, 2: 500, 1: 1000}.get(code)}


def read_snapshot():
    replies = {}
    for name in ("battery", "dpi-list", "polling-rate"):
        result = subprocess.run([sys.executable, str(DIAGNOSTIC), "--worker", name],
                                capture_output=True, text=True, timeout=8)
        if result.returncode:
            raise RuntimeError(result.stderr.strip() or "Falha na leitura do receptor.")
        reply = json.loads(result.stdout.splitlines()[-1])
        expected = 3 if name == "battery" else 28
        if reply["query"] != name or reply["ioctlReturn"] != expected:
            raise ValueError("Resposta incompatível com a consulta; leitura descartada.")
        replies[name] = bytes.fromhex(reply["responseHex"])[:expected]
    # shortcut: same-sized stale replies from another HID client cannot be correlated; keep one reader active until the protocol exposes an identifier.
    return {"source": "linux-hidraw", "experimental": True, "vendorId": 0x24AE, "productId": 0x1870,
            "capturedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            **decode(replies["battery"], replies["dpi-list"]),
            **decode_polling(replies["polling-rate"], replies["dpi-list"]),
            "rawResponses": {name: data.hex() for name, data in replies.items()}}


class Handler(BaseHTTPRequestHandler):
    def allowed(self):
        return self.headers.get("Host") in ("127.0.0.1:5175", "localhost:5175") and self.headers.get("Origin") in ORIGINS

    def respond(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        if self.allowed():
            self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
            self.send_header("Vary", "Origin")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        if not self.allowed() or self.path != "/api/telemetry" or self.headers.get("Access-Control-Request-Method") != "POST":
            self.respond(403, {"error": "Origem ou operação não autorizada."})
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "POST")
        self.send_header("Access-Control-Allow-Headers", "X-Rapoo-Read")
        self.end_headers()

    def do_POST(self):
        if not self.allowed():
            self.respond(403, {"error": "Origem não autorizada."})
            return
        if self.path != "/api/telemetry":
            self.respond(404, {"error": "Rota não encontrada."})
            return
        if self.headers.get("X-Rapoo-Read") != "1" or self.headers.get("Content-Length", "0") != "0" or self.headers.get("Transfer-Encoding"):
            self.respond(400, {"error": "Somente a leitura fixa, sem payload, é permitida."})
            return
        if not READ_LOCK.acquire(blocking=False):
            self.respond(409, {"error": "Uma leitura está em andamento. Aguarde e tente novamente."})
            return
        try:
            self.respond(200, read_snapshot())
        except (OSError, RuntimeError, ValueError, KeyError, IndexError, subprocess.TimeoutExpired) as error:
            self.respond(503, {"error": f"Não foi possível ler o MT760. Verifique receptor, atividade do mouse e permissão hidraw. {error}"})
        finally:
            READ_LOCK.release()


if __name__ == "__main__":
    print("Ponte MT760 em http://127.0.0.1:5175 — consultas de leitura, sem gravação de configuração", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 5175), Handler).serve_forever()
