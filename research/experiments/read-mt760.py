"""Experimental fixed read queries from RapooOfficeDev 1.2.1; raw evidence only."""
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import time

DESCRIPTOR_SHA256 = "d6316567a9545dd700ac3d5f2d2d23ff408e2ee1125c5ea385a7dae38aa34738"
QUERIES = {"battery": (0xAA, 0, 0), "dpi-list": (0xA4, 0x18, 0x638), "dpi-state": (0xA4, 0x18, 0x660)}


def request(name):
    operation, length, address = QUERIES[name]
    payload = bytes((0xA5, operation, length)) + struct.pack("<I", address)
    return bytes((0xBA,)) + payload.ljust(31, b"\0")


def device_path():
    matches = []
    for node in Path("/sys/class/hidraw").glob("hidraw*"):
        identity = (node / "device/uevent").read_text()
        if "HID_ID=0003:000024AE:00001870\n" not in identity:
            continue
        descriptor = (node / "device/report_descriptor").read_bytes()
        if hashlib.sha256(descriptor).hexdigest() == DESCRIPTOR_SHA256:
            matches.append(Path("/dev") / node.name)
    if len(matches) != 1:
        raise RuntimeError(f"Esperada uma interface com identidade e descritor conhecidos; encontradas {len(matches)}")
    return matches[0]


def validate_response(name, response, count):
    expected = 3 if name == "battery" else 28
    if count != expected or response[0] != 1:
        raise RuntimeError(f"Resposta incompatível para {name}: {count} bytes, status {response[0]:02x}; captura interrompida")


def query(name):
    path = device_path()
    fd = os.open(path, os.O_RDWR | os.O_NONBLOCK)
    try:
        info = bytearray(8)
        fcntl.ioctl(fd, 0x80084803, info, True)  # HIDIOCGRAWINFO
        if struct.unpack("IHH", info) != (3, 0x24AE, 0x1870):
            raise RuntimeError("Identidade mudou antes da consulta")
        packet = request(name)
        if os.write(fd, packet) != len(packet):
            raise RuntimeError("Envio incompleto; interrompido sem repetição")
        print(json.dumps({"device": str(path), "query": name, "requestHex": packet.hex()}), flush=True)
        time.sleep(0.45)
        response = bytearray(32)
        response[0] = 0xBA
        count = fcntl.ioctl(fd, 0xC020480A, response, True)  # HIDIOCGINPUT(32), not Feature
        print(json.dumps({"query": name, "responseHex": response.hex(), "ioctlReturn": count}), flush=True)
        validate_response(name, response, count)
        time.sleep(0.15)
    finally:
        os.close(fd)


def main():
    if sys.argv[1:] == ["--self-test"]:
        assert request("battery") == bytes.fromhex("ba a5 aa 00 00 00 00 00") + bytes(24)
        assert request("dpi-list") == bytes.fromhex("ba a5 a4 18 38 06 00 00") + bytes(24)
        assert request("dpi-state") == bytes.fromhex("ba a5 a4 18 60 06 00 00") + bytes(24)
        try:
            request("write")
        except KeyError:
            pass
        else:
            raise AssertionError("Consulta desconhecida aceita")
        fixture = json.loads((Path(__file__).parents[1] / "captures/mt760-native-baseline.json").read_text())
        battery, dpi, _ = fixture["queries"]
        battery_bytes = bytes.fromhex(battery["responseBufferHex"])[:battery["returnedBytes"]]
        dpi_bytes = bytes.fromhex(dpi["responseBufferHex"])[:dpi["returnedBytes"]]
        validate_response("battery", battery_bytes, len(battery_bytes))
        validate_response("dpi-list", dpi_bytes, len(dpi_bytes))
        for name, response in (("battery", b"\x02"), ("dpi-list", battery_bytes), ("battery", b"\x02\x00\x00")):
            try:
                validate_response(name, response, len(response))
            except RuntimeError:
                pass
            else:
                raise AssertionError("Resposta de erro ou de outra consulta aceita")
        assert battery_bytes == bytes((1, 1, 59))
        assert [value * 50 for value in struct.unpack("<7H", dpi_bytes[4:18])] == fixture["interpretation"]["dpiValues"]
        assert dpi_bytes[18] + 1 == 3
        assert dpi_bytes[20] == 2
        for filename, index in (("mt760-native-dpi-button.json", 0), ("mt760-native-dpi-button-2.json", 1)):
            capture = json.loads((Path(__file__).parents[1] / "captures" / filename).read_text())
            changed = bytes.fromhex(capture["queries"][1]["responseBufferHex"])[:28]
            assert [(i, value) for i, value in enumerate(changed) if value != dpi_bytes[i]] == [(20, index)]
        restored = json.loads((Path(__file__).parents[1] / "captures/mt760-native-restored.json").read_text())
        assert restored["queries"] == fixture["queries"]
        print("Self-test: pacotes fixos, rejeição de comando/resposta inválidos e ciclo DPI completo OK")
    elif len(sys.argv) == 3 and sys.argv[1] == "--worker" and sys.argv[2] in QUERIES:
        query(sys.argv[2])
    elif sys.argv[1:] == ["--capture"]:
        path = device_path()
        if not os.access(path, os.R_OK | os.W_OK):
            raise PermissionError(f"Sem acesso a {path}; nenhuma consulta enviada")
        print(json.dumps({"capturedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                          "experimental": True, "descriptorSha256": DESCRIPTOR_SHA256}), flush=True)
        for name in QUERIES:
            try:
                result = subprocess.run([sys.executable, __file__, "--worker", name],
                                        capture_output=True, text=True, timeout=8)
            except subprocess.TimeoutExpired as error:
                print(json.dumps({"query": name, "error": "timeout", "partialOutput": (error.stdout or b"").decode()}))
                return 1
            print(result.stdout, end="", flush=True)
            if result.returncode:
                print(json.dumps({"query": name, "error": result.stderr.strip()}))
                return 1
    else:
        raise SystemExit("Uso: python3 read-mt760.py --self-test | --capture")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, RuntimeError) as error:
        raise SystemExit(str(error))
