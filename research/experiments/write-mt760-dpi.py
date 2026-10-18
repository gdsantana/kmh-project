"""Bounded 1000→1050 DPI experiment on inactive stage 1; requires its own backup."""
import argparse
import datetime
import fcntl
import json
import os
from pathlib import Path
import runpy
import struct
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
CAPTURES = ROOT / 'research/captures'
READ = runpy.run_path(str(ROOT / 'research/experiments/read-mt760.py'))
BRIDGE = runpy.run_path(str(ROOT / 'apps/bridge/server.py'))


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def original(plan):
    if plan.get('kind') != 'mt760-inactive-dpi-test-v1' or plan.get('descriptorSha256') != READ['DESCRIPTOR_SHA256']:
        raise ValueError('Backup desconhecido.')
    dpi = bytes.fromhex(plan['before']['rawResponses']['dpi-list'])
    if len(dpi) != 28 or dpi[0] != 1:
        raise ValueError('Bloco original inválido.')
    values = struct.unpack('<7H', dpi[4:18])
    if values[0] != 20 or any(not 1 <= value <= 80 for value in values):
        raise ValueError('Este teste exige estágio 1 em 1000 DPI e valores entre 50 e 4000 DPI.')
    if not 1 <= dpi[18] <= 6 or not 1 <= dpi[20] <= dpi[18] or dpi[19] != 0:
        raise ValueError('Estágio 1 deve estar inativo; quantidade/reservado não corresponde ao teste.')
    BRIDGE['decode_polling'](bytes.fromhex(plan['before']['rawResponses']['polling-rate']), dpi)
    return dpi


def expected(plan, restore=False):
    data = bytearray(original(plan))
    if not restore:
        struct.pack_into('<H', data, 4, 21)
    return bytes(data)


def packet(plan, restore=False):
    data = expected(plan, restore)[4:20]
    return (bytes.fromhex('ba a5 a5 10 38 06 00 00') + data).ljust(32, b'\0')


def stable_snapshot():
    a, b = BRIDGE['read_snapshot'](), BRIDGE['read_snapshot']()
    if a['rawResponses']['dpi-list'] != b['rawResponses']['dpi-list'] or a['rawResponses']['polling-rate'] != b['rawResponses']['polling-rate']:
        raise RuntimeError('Configuração instável; nenhuma gravação deve ser iniciada.')
    return b


def check_state(plan, snapshot, restore=False):
    dpi = bytes.fromhex(snapshot['rawResponses']['dpi-list'])
    polling = bytes.fromhex(snapshot['rawResponses']['polling-rate'])
    before_polling = bytes.fromhex(plan['before']['rawResponses']['polling-rate'])
    if dpi[4:] != expected(plan, restore)[4:] or polling[4:12] != before_polling[4:12]:
        raise RuntimeError('Leitura não corresponde ao estado esperado; confira a evidência antes de continuar.')


def save(path, plan):
    temporary = path.with_suffix('.tmp')
    with temporary.open('w') as file:
        json.dump(plan, file, indent=2, ensure_ascii=False)
        file.write('\n')
        file.flush()
        os.fsync(file.fileno())
    temporary.replace(path)


def write_worker(plan, restore):
    path = READ['device_path']()
    fd = os.open(path, os.O_RDWR | os.O_NONBLOCK)
    try:
        info = bytearray(8)
        fcntl.ioctl(fd, 0x80084803, info, True)
        if struct.unpack('IHH', info) != (3, 0x24AE, 0x1870):
            raise RuntimeError('Identidade diferente antes da gravação.')
        request = packet(plan, restore)
        print(json.dumps({'device': str(path), 'requestHex': request.hex()}), flush=True)
        if os.write(fd, request) != 32:
            raise RuntimeError('Envio incompleto, sem repetição automática.')
        time.sleep(0.45)
        response = bytearray(32)
        response[0] = 0xBA
        count = fcntl.ioctl(fd, 0xC020480A, response, True)
        print(json.dumps({'returnedBytes': count, 'responseBufferHex': response.hex()}), flush=True)
        if count < 1 or response[0] != 1:
            raise RuntimeError('ACK de gravação não confirmado; exigir leitura e restauração.')
        time.sleep(0.15)
    finally:
        os.close(fd)


def write_once(path, plan, restore):
    event = {'startedAt': stamp(), 'operation': 'restore' if restore else 'apply-test', 'requestHex': packet(plan, restore).hex()}
    plan['events'].append(event)
    save(path, plan)  # Persist the original and intended write before touching hardware.
    try:
        result = subprocess.run([sys.executable, __file__, 'worker-restore' if restore else 'worker-apply', str(path)],
                                capture_output=True, text=True, timeout=8)
        event.update(exitCode=result.returncode, output=result.stdout, error=result.stderr)
        if result.returncode:
            raise RuntimeError(result.stderr.strip() or 'Falha na gravação.')
    except subprocess.TimeoutExpired as error:
        event.update(error='timeout', output=(error.stdout or b'').decode())
        raise RuntimeError('Timeout após tentativa de gravação; estado exige verificação.') from error
    finally:
        event['finishedAt'] = stamp()
        save(path, plan)


def restore_original(path, plan):
    current = stable_snapshot()
    try:
        check_state(plan, current, True)
    except RuntimeError:
        check_state(plan, current)
        write_once(path, plan, True)
    restored = stable_snapshot()
    check_state(plan, restored, True)
    plan['restored'] = restored
    save(path, plan)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('prepare', 'apply-test', 'verify-after-power-cycle', 'restore', 'worker-apply', 'worker-restore'))
    parser.add_argument('evidence', nargs='?')
    args = parser.parse_args()
    if args.mode == 'prepare':
        plan = {'kind': 'mt760-inactive-dpi-test-v1', 'createdAt': stamp(),
                'descriptorSha256': READ['DESCRIPTOR_SHA256'], 'before': stable_snapshot(), 'events': []}
        original(plan)
        path = CAPTURES / ('mt760-dpi-write-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.json')
        save(path, plan)
        print(json.dumps({'evidence': str(path), 'change': 'inactive stage 1: 1000→1050 DPI', 'requestHex': packet(plan).hex()}))
        return
    if not args.evidence:
        parser.error('Indique o backup criado por prepare.')
    path = Path(args.evidence).resolve()
    if path.parent != CAPTURES or not path.name.startswith('mt760-dpi-write-') or path.suffix != '.json':
        raise ValueError('O backup deve estar no diretório de capturas deste projeto.')
    plan = json.loads(path.read_text())
    original(plan)
    if args.mode.startswith('worker-'):
        write_worker(plan, args.mode == 'worker-restore')
        return
    if args.mode == 'apply-test':
        if any(event.get('operation') == 'apply-test' for event in plan['events']):
            raise ValueError('Este backup já possui uma tentativa; não repetir a gravação automaticamente.')
        check_state(plan, stable_snapshot(), True)
        try:
            write_once(path, plan, False)
            plan['after'] = stable_snapshot()
            check_state(plan, plan['after'])
            save(path, plan)
        except Exception as error:
            plan['applyError'] = str(error)
            save(path, plan)
            try:
                restore_original(path, plan)
            except Exception as recovery_error:
                plan['recoveryError'] = str(recovery_error)
                save(path, plan)
            raise
    elif args.mode == 'restore':
        restore_original(path, plan)
    else:
        plan['afterPowerCycle'] = stable_snapshot()
        save(path, plan)
        check_state(plan, plan['afterPowerCycle'])
        plan['powerCycleVerificationRequestedAt'] = stamp()
        save(path, plan)
    print(json.dumps({'result': args.mode + ' verified by readback', 'evidence': str(path)}))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, KeyError, subprocess.TimeoutExpired) as error:
        raise SystemExit(str(error))
