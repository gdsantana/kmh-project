# MT760 wireless: descoberta da leitura de polling rate

Pesquisa em 2026-10-17. Modelo MT760 e receptor 2,4 GHz informados pelo usuário; firmware desconhecido.

## Fonte e identificação

Análise estática do RapooOfficeDev 1.2.1 oficial, sem instalar/executar o driver. O executável analisado tem SHA-256 `4af207a5af13f860218df727619219df90420d4038ad3c3aa49db537235d84a7`. Fonte, hashes e extração: [inventário](official-driver-inventory.json) e [análise anterior](dpi-battery.md#reprodução-da-análise-estática).

Os endereços abaixo são VAs do PE com image base 0x00400000, válidos apenas para esse executável.

| Evidência | Local |
| --- | --- |
| Vtable FDeviceMT760_Wireless, slot 19 | 0x013C3DEC + 19 * 4 aponta para 0x005280C0 |
| Consulta no getter wireless | 0x005280FF–0x0052811B: A4, comprimento 18, endereço 630 |
| Seleção do byte wireless | 0x005281B9–0x005281C5: offset 5 da resposta |
| Switch do getter wireless | tabela em 0x00528234, saída em 0x005281E8–0x00528203 |
| Getter da classe MT comum | 0x0051D870, consulta igual, porém interpreta offset 4 |
| Rótulos ReportRate / Hz125 / Hz250 / Hz500 / Hz1000 | 0x013BC848 e 0x013BC85C–0x013BC874 |
| Conversão dos nomes em índices 0, 1, 2, 3 | 0x004DAD99–0x004DAE28 |

O hash, a entrada da vtable, os bytes de montagem da consulta, a seleção do offset 5 e as quatro entradas da tabela switch foram conferidos com asserts diretamente no executável.

## Consulta identificada

Mesma interface usada para bateria/DPI: VID 24AE, PID 1870, coleção FF00/0E, report BA, 31 bytes de payload. O script verifica o hash do descritor conhecido antes do acesso.

Solicitação hidraw de 32 bytes, incluindo Report ID:

```text
BA A5 A4 18 30 06 00 00 + 24 bytes zero
```

É uma leitura A4 do bloco de 24 bytes a partir do registro 0x630. Não é a rotina de gravação 0x00528260 (operação A5), que não foi executada.

O driver utiliza GET_REPORT(Input). Para o buffer nativo, o byte 0 é o status e não deve ser removido como se fosse Report ID. Respostas candidatas devem passar pela checagem de status e comprimento (28 bytes), assim como os outros blocos A4.

## Interpretação derivada do driver

Na variante wireless, o byte 5 corresponde ao registro 0x631. A classe comum interpreta o byte 4, correspondente a 0x630. Não usar o campo da conexão com fio como polling rate wireless.

| Código no byte 5 | Índice retornado pelo getter | Frequência correspondente | Intervalo nominal |
| --- | --- | --- | --- |
| 8 | 0 | 125 Hz | 8 ms |
| 4 | 1 | 250 Hz | 4 ms |
| 2 | 2 | 500 Hz | 2 ms |
| 1 | 3 | 1000 Hz | 1 ms |

A tabela descreve as quatro opções identificadas no driver; não comprova valores arbitrários de frequência. Código desconhecido deve permanecer desconhecido, sem assumir 125 Hz como fallback, mesmo que o getter oficial tenha um valor padrão.

O bloco 0x630 se sobrepõe ao bloco DPI 0x638. Portanto, os bytes 12–27 da resposta nova devem corresponder aos bytes 4–19 da resposta DPI em um estado estável. Essa comparação ajuda a detectar a troca entre respostas A4 do mesmo tamanho, mas não estabelece um identificador de transação.

O valor lido é a configuração informada pelo dispositivo. Não é uma medição dos intervalos reais de movimento, do endpoint USB nem da taxa de eventos JavaScript.

## Procedimento de coleta

1. Reidentificar a interface e conferir permissões. No início desta sessão era /dev/hidraw5, sem acesso para o usuário; foi solicitada uma ACL temporária específica, conforme [procedimento nativo](../experiments/native-dpi-battery.md).
2. Executar somente a nova consulta fixa, com timeout, preservando solicitação, resposta e horário. O helper aceita `--worker polling-rate`; o `--capture` antigo continua com as três consultas anteriores.
3. Repetir a leitura, interpretar somente se status, comprimento e código forem válidos, e comparar a região sobreposta com a leitura de DPI.
4. Comparar com a frequência configurada informada pelo usuário ou com o software oficial. Não alterar a frequência para obter a primeira evidência.
5. Manter separadas a configuração lida e uma possível medição física futura.

## Resultado físico e integração

Após o usuário reaplicar a ACL de hidraw5, foram realizadas as leituras `polling-rate → dpi-list → polling-rate`, com timeout de oito segundos por subprocesso. As duas respostas de polling foram idênticas; a região sobreposta com o DPI coincidiu.

- Bytes iniciais efetivamente recebidos: `01 00 00 00 02 01 FF FF ...`, total de 28 bytes.
- Byte 4: `02`, campo utilizado pela classe comum; não foi usado para declarar a taxa wireless.
- Byte 5: `01`, campo da rotina FDeviceMT760_Wireless, interpretado como **1000 Hz / 1 ms nominal**.
- Captura completa com requests e horários: [mt760-native-polling-rate.json](../captures/mt760-native-polling-rate.json).

A ponte passou a consultar bateria, DPI e polling rate. Ela compara a região sobreposta antes de aceitar a leitura de taxa; código desconhecido permanece sem frequência associada. O cliente aceita `pollingRateHz: null` para código desconhecido e mostra esse estado em vez de presumir um valor. O timeout HTTP foi ampliado para 30 segundos, pois são três subprocessos limitados a oito segundos cada.

O endpoint real retornou **54% de bateria, 1350 DPI e 1000 Hz** em 2026-10-17, preservado em [bridge-polling-rate-reading.json](../captures/bridge-polling-rate-reading.json). O usuário confirmou que o painel mostra 1000 Hz após clicar **Ler informações do mouse**. Essa confirmação visual foi feita pelo usuário; não houve screenshot ou automação do navegador nesta sessão.

Testes validaram a captura real, os quatro códigos, código desconhecido, uso do campo wireless apesar do valor diferente no campo adjacente, rejeição de blocos incompatíveis e as três consultas fixas. `npm test` passou com 14 testes TypeScript e 5 Python; build e self-test passaram.

Não foi alterada a frequência. A comparação com a seleção no driver oficial e a medição física dos intervalos continuam pendentes.
