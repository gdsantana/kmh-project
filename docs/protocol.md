# Estado do protocolo

**Nenhum comando de configuração confirmado.**

Os descritores abaixo indicam formatos anunciados pelo dispositivo, não o significado dos bytes nem a disponibilidade de DPI, bateria ou memória interna. Não há replay, handshake, leitura de feature ou escrita nesta PoC.

Dispositivo observado: VID `0x24AE`, PID `0x1870`, nome USB `Rapoo Gaming Device`. O usuário confirmou modelo MT760 via receptor 2,4 GHz; firmware desconhecido. `bcdDevice=0.00` e o identificador USB não comprovam versão de firmware.

| Interface USB | Coleção | Usage | Reports anunciados | Payload |
| --- | --- | --- | --- | --- |
| 0 | Generic Desktop / Mouse | `0x02` | Input padrão | Ver descritor bruto |
| 1 | Vendor `0xFF00` | `0x0E` | Input e Output `0xBA` | 31 B |
| 1 | Vendor `0xFF00` | `0x02` | Input e Output `0xBB` | 6 B |
| 2 | Vendor `0xFF01` | `0x00` | Input, Output e Feature `0x06` | 28 B |

A interface 1 também contém teclado, controle de sistema e consumer control; o navegador pode omitir ou bloquear relatórios protegidos. A interface 2 é candidata à investigação, sem significado de comando atribuído.

Fonte: descritores sysfs em `research/device-identification/rapoo-24ae-1870-sysfs.json`, correlacionados com os descritores exibidos pela PoC no navegador. Não houve tráfego de configuração capturado.

Para promover uma hipótese a comando implementável, registrar VID/PID, variante, firmware, conexão, interface/coleção, tipo e ID do report, comprimento, request/response, valores antes/depois, repetições, origem e confiança conforme HANDOFF.MD. Campos desconhecidos devem permanecer nulos.

## Pesquisa de DPI e bateria

O usuário identificou o equipamento deste experimento como **MT760 via receptor 2,4 GHz**. Firmware desconhecido.

A análise estática do driver oficial **1.2.1** identificou `FDeviceMT760_Wireless`, PID `0x1870`, com consultas pela coleção **`0xFF00`, usage `0x0E`, report `0xBA`**. Bateria: operação candidata `0xAA`; DPI: leituras candidatas `0xA4` dos endereços `0x638` e `0x660`, com valores em passos de 50 DPI.

**Teste nativo de leitura realizado neste receptor.** Após ACL em hidraw5, duas sequências retornaram bytes idênticos via GET_REPORT(Input): bateria interpretada como 59% e sete valores DPI (1000, 1200, 1350, 800, 2400, 3200, 4000). Três estágios estão habilitados; três toques físicos separados confirmaram índices `2 → 0 → 1 → 2`, DPI `1350 → 1000 → 1200 → 1350`. O estágio original foi restaurado. Evidências: `research/captures/mt760-native-baseline.json` e `mt760-native-restored.json`. Comparação com software oficial e calibração física ainda pendentes.

GET_REPORT(Input) não tem equivalente direto no WebHID. Em 2026-10-16, abrimos `FF00/0E`, enviamos a consulta de bateria pelo navegador e não recebemos evento BA em três segundos; um GET_INPUT nativo posterior retornou a bateria sem novo Output Report. A ponte local agora entrega bateria/DPI reais à página. Evidências e execução em [integração no navegador](../research/experiments/browser-telemetry.md).

Detalhes, limites, hashes e VAs reproduzíveis: [pesquisa DPI/bateria](../research/software-analysis/dpi-battery.md). A aplicação possui o teste fixo WebHID e acesso à ponte de leitura; nenhuma gravação de configuração foi adicionada.
