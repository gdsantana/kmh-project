import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { hex, flattenCollections, summarizeCollections } from '@rapoo/core';
import { availability, closeInspections, describeError, inspectAuthorizedDevices, requestInspections } from '@rapoo/transport-webhid';
import type { Inspection } from '@rapoo/transport-webhid';
import { observedRapoo } from '@rapoo/device-definitions';
import './style.css';
import { probeBattery, supportsProbe } from './webhid-probe';
import type { ProbeResult } from './webhid-probe';
import { readLocal } from './local-reader';
import type { Reading } from './local-reader';

const hid = navigator.hid;
const unavailable = availability(window.isSecureContext, hid);

function App() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const handles = useRef<Inspection[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Selecione o mouse ou receptor para começar.');
  const [error, setError] = useState<string | null>(null);
  const [rapooOnly, setRapooOnly] = useState(true);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [readingError, setReadingError] = useState<string | null>(null);

  async function readMouse() {
    if (busy) return;
    setBusy(true);
    setReading(null);
    setReadingError(null);
    try {
      await closeInspections(handles.current);
      setInspections(current => current.map(i => ({...i, snapshot: {...i.snapshot, opened: i.device.opened}})));
      setReading(await readLocal());
      setMessage('Bateria, DPI e polling rate recebidos do receptor pela ponte local.');
    } catch (cause) {
      setReadingError(cause instanceof Error ? cause.message : String(cause));
      setMessage('A leitura falhou. Nenhum valor anterior está sendo apresentado como atual.');
    }
    finally { setBusy(false); }
  }

  async function testWebHid() {
    const target = handles.current.find(i => supportsProbe(i.device));
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    setProbe(null);
    try { setProbe(await probeBattery(target.device)); }
    catch (cause) { setError(describeError(cause)); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!hid) return;
    const disconnected = (event: HIDConnectionEvent) => {
      setInspections(current => {
        const next = current.map(i => i.device === event.device
          ? { ...i, snapshot: { ...i.snapshot, opened: false, error: 'Dispositivo desconectado. Selecione novamente para reconectar.' } } : i);
        handles.current = next;
        return next;
      });
    };
    hid.addEventListener('disconnect', disconnected);
    const close = () => { void closeInspections(handles.current).catch(() => {}); };
    window.addEventListener('pagehide', close);
    return () => {
      hid.removeEventListener('disconnect', disconnected);
      window.removeEventListener('pagehide', close);
      close();
    };
  }, []);

  async function selectDevice(source: 'select' | 'authorized' = 'select') {
    if (!hid || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Invoke the chooser before any await to preserve the user activation.
      const selection = source === 'select' ? requestInspections(hid, rapooOnly) : inspectAuthorizedDevices(hid, rapooOnly);
      const next = await selection;
      if (!next.length) {
        setMessage(source === 'select' ? 'Seleção cancelada. Nenhuma nova interface foi aberta.' : 'Nenhum dispositivo autorizado encontrado. Use Selecionar dispositivo.');
        return;
      }
      // Keep handles reused by the chooser and close only the previous selection.
      const previous = handles.current.filter(i => !next.some(n => n.device === i.device));
      handles.current = next;
      setInspections(next);
      setCapturedAt(new Date().toISOString());
      setMessage(`${next.length} interface(s) inspecionada(s).`);
      try { await closeInspections(previous); }
      finally { handles.current = [...next, ...previous.filter(i => i.device.opened)]; }
    } catch (cause) { setError(describeError(cause)); }
    finally { setBusy(false); }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await closeInspections(handles.current);
      setMessage('Conexão encerrada. Os descritores continuam disponíveis para exportação.');
    } catch (cause) { setError(describeError(cause)); }
    finally {
      setInspections(current => current.map(i => ({ ...i, snapshot: { ...i.snapshot, opened: i.device.opened } })));
      setBusy(false);
    }
  }

  function exportEvidence() {
    const evidence = {
      schemaVersion: 1, capturedAt: reading?.capturedAt ?? capturedAt, exportedAt: new Date().toISOString(),
      source: reading ? (inspections.length ? 'WebHID+linux-hidraw' : 'linux-hidraw') : 'WebHID',
      userAgent: navigator.userAgent, secureContext: window.isSecureContext,
      configurationCommandsSent: false, model: null, firmware: null, connectionMode: null,
      devices: inspections.map(i => i.snapshot),
      batteryProbe: probe,
      nativeReading: reading,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], {type: 'application/json'}));
    const link = document.createElement('a');
    link.href = url; link.download = `rapoo-hid-${Date.now()}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const opened = inspections.filter(i => i.snapshot.opened).length;
  return <main>
    <header><a className="brand" href="/">rapoo<span> / laboratório aberto</span></a><span className="mode">Somente leitura</span></header>
    <section className="intro">
      <div><h1>O que o navegador <br />consegue ver do seu mouse?</h1>
      <p>Inspecione a conexão e os descritores HID. Este primeiro experimento não altera as configurações do dispositivo.</p></div>
      <div className="connector" aria-hidden="true"><span>USB</span><i /><span>HID</span><i /><span>Web</span></div>
    </section>
    <section className="connection" aria-labelledby="connection-title">
      <div><h2 id="connection-title">Conectar e inspecionar</h2><p>Use o seletor do navegador para autorizar o acesso.</p></div>
      <div className="controls"><button onClick={() => selectDevice()} disabled={!!unavailable || busy}>{busy ? 'Aguarde…' : 'Selecionar dispositivo'}</button>
      <button className="reopen" onClick={() => selectDevice('authorized')} disabled={!!unavailable || busy}>Reabrir dispositivos autorizados</button>
      <label><input type="checkbox" checked={rapooOnly} onChange={e => setRapooOnly(e.target.checked)} disabled={busy} />Mostrar somente Rapoo</label></div>
    </section>
    {unavailable && <p className="notice" role="alert">{unavailable}</p>}
    {error && <p className="notice" role="alert">{error}</p>}
    <div className="status" role="status"><span className={opened ? 'dot online' : 'dot'} />{message}</div>
    <section className="device" aria-labelledby="telemetry-title">
      <h2 id="telemetry-title">Informações do mouse</h2>
      <p>Leia bateria, DPI e polling rate configurado do MT760 conectado pelo receptor 2,4 GHz.</p>
      <button className="secondary" onClick={readMouse} disabled={busy}>{busy ? 'Lendo…' : 'Ler informações do mouse'}</button>
      <p className="observed">Conexão pela ponte local Linux · Leitura experimental · Atualização manual</p>
      {readingError && <p className="notice" role="alert">{readingError}</p>}
      {reading && <div role="status">
        <dl className="telemetry-values"><div><dt>Bateria informada</dt><dd>{reading.batteryPercent}%</dd></div>
          <div><dt>DPI atual</dt><dd>{reading.activeDpi} DPI</dd></div>
          <div><dt>Estágio ativo</dt><dd>{reading.activeIndex + 1} de {reading.enabledStages}</dd></div>
          <div><dt>Polling rate configurado</dt><dd>{reading.pollingRateHz === null ? `Desconhecido (código ${reading.pollingRateCode})` : `${reading.pollingRateHz} Hz`}</dd></div></dl>
        <p>Estágios habilitados: {reading.dpiValues.slice(0, reading.enabledStages).join(' · ')} DPI</p>
        <p className="observed">Recebido do receptor em {new Date(reading.capturedAt).toLocaleString('pt-BR')} · Fonte: Linux hidraw</p>
        <button className="secondary" onClick={exportEvidence} disabled={busy}>Exportar leitura JSON</button>
        <details><summary>Resposta real da leitura</summary><pre>{JSON.stringify(reading, null, 2)}</pre></details>
      </div>}
      <details className="webhid-experiment"><summary>Diagnóstico WebHID direto</summary>
      <p>Verifique se a resposta também chega por evento do navegador. Reabra as interfaces antes do teste.</p>
      <button className="secondary" onClick={testWebHid} disabled={busy || !inspections.some(i => supportsProbe(i.device))}>Testar bateria via WebHID</button>
      {probe && <div role="status"><p>{probe.error ? `Falha no envio: ${probe.error}` : probe.reports.length
        ? `${probe.reports.length} resposta(s) BA recebida(s) por evento WebHID.`
        : 'Consulta enviada. Nenhuma resposta BA por evento WebHID em 3 segundos.'}</p>
        <details><summary>Evidência do teste WebHID</summary><pre>{JSON.stringify(probe, null, 2)}</pre></details></div>}
      </details>
    </section>
    {!inspections.length && !reading && <section className="empty"><h2>Aguardando um dispositivo</h2><p>Após a seleção, você verá o nome, VID/PID, coleções e formatos dos relatórios expostos pelo navegador.</p>
      <details><summary>O mouse não aparece na lista?</summary><p>Experimente USB ou receptor 2,4 GHz e desmarque o filtro Rapoo. Interfaces padrão de mouse e teclado podem ser protegidas pelo navegador. No Linux, a abertura também depende das permissões de hidraw. Consulte o README antes de alterar permissões.</p></details></section>}
    {!!inspections.length && <>
      <div className="results-heading"><h2>Interfaces encontradas <span>({inspections.length})</span></h2><div className="actions"><button className="secondary" onClick={disconnect} disabled={!opened || busy}>Encerrar conexão</button><button className="secondary" onClick={exportEvidence} disabled={busy}>Exportar evidência JSON</button></div></div>
      {inspections.map(({snapshot: d}, index) => {
        const summary = summarizeCollections(d.collections);
        return <article className="device" key={`${d.vendorId}-${d.productId}-${index}`}>
          <div className="device-title"><h3>{d.productName || 'Dispositivo sem nome'}</h3><span className={d.opened ? 'badge success' : 'badge'}>{d.opened ? 'Interface aberta' : 'Interface fechada'}</span></div>
          <dl><div><dt>Vendor ID</dt><dd>{hex(d.vendorId)}</dd></div><div><dt>Product ID</dt><dd>{hex(d.productId)}</dd></div><div><dt>Coleções do fabricante</dt><dd>{summary.vendorCollections}</dd></div><div><dt>Configuração MT760</dt><dd>Não verificada</dd></div></dl>
          {d.error && <p className="notice" role="alert">{d.error}</p>}
          {summary.vendorCollections > 0 && <p className="finding">Coleção do fabricante encontrada. O acesso aos descritores não comprova suporte a DPI, bateria ou memória interna.</p>}
          <div className="table-wrap"><table><caption>Coleções e relatórios expostos</caption><thead><tr><th>Coleção / usage page</th><th>Usage</th><th>Entrada</th><th>Saída</th><th>Feature</th></tr></thead><tbody>
            {flattenCollections(d.collections).map((c, ci) => <tr key={ci}><th>{hex(c.usagePage)}{c.usagePage !== null && c.usagePage >= 0xff00 ? ' · Fabricante' : ''}</th><td>{hex(c.usage)}</td>{(['inputReports', 'outputReports', 'featureReports'] as const).map(type => <td key={type}>{c[type].length ? c[type].map((r, ri) => <div key={ri}>ID {hex(r.reportId)} · {r.byteLength === null ? 'Tamanho desconhecido' : `${r.byteLength} B`}</div>) : '—'}</td>)}</tr>)}
          </tbody></table></div>
          <details><summary>Descritores completos em JSON</summary><pre>{JSON.stringify(d.collections, null, 2)}</pre></details>
        </article>;
      })}
    </>}
    <aside><h2>O que este experimento confirma</h2><p>Leitura nativa de bateria e DPI verificada no MT760 deste laboratório. A ponte entrega os dados ao navegador; gravação de configurações e outros firmwares continuam sem validação.</p><p className="observed">Referência local observada: {hex(observedRapoo.vendorId)}:{hex(observedRapoo.productId)} · MT760 via receptor 2,4 GHz informado pelo usuário.</p></aside>
    <footer>Rapoo MT760 · PoC WebHID independente<span>Local · Sem telemetria · Sem comandos de configuração</span></footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
