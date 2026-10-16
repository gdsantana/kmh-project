# Experimento nativo: respostas de bateria e DPI

Script: `read-mt760.py`, Python 3, somente biblioteca padrão. Separado da PoC web.

## Como chegamos aos dados

1. A PoC WebHID identificou `24AE:1870` e os descritores reais. A coleção aberta inicialmente (`FF01`, report `06`, hidraw6 naquele momento) não era a usada pelas consultas de DPI/bateria.
2. Baixamos os drivers oficiais e fizemos análise estática, sem instalar ou executar os binários. A classe `FDeviceMT760_Wireless` do RapooOfficeDev 1.2.1 associa PID `1870`, coleção `FF00/0E` e report `BA`. URLs, hashes, extração e endereços das rotinas estão na [análise do driver](../software-analysis/dpi-battery.md) e no [inventário](../software-analysis/official-driver-inventory.json).
3. As rotinas revelaram operações de leitura e o transporte: envio Output seguido de GET_REPORT(Input). Como WebHID não expõe essa consulta Input diretamente, criamos um experimento Linux com hidraw.
4. Reidentificamos a interface correta, liberada pelo usuário por ACL temporária. Duas leituras iniciais foram idênticas. Depois comparamos três toques separados no botão físico, confirmando o ciclo completo de DPI e a restauração original.
5. Preservamos requests, respostas, horários, tamanhos e a tentativa inválida. A interpretação abaixo usa o driver como referência e a mudança física como confirmação do índice de DPI.

## Como repetir no Linux

Execute da raiz do projeto, com Python 3 e o receptor conectado. O script encontra a interface pelo VID/PID e hash do descritor; não depende de continuar sendo hidraw5. O self-test usa capturas salvas e não acessa o dispositivo.

```sh
python3 research/experiments/read-mt760.py --self-test
rapoo_node=$(python3 -c 'import runpy; print(runpy.run_path("research/experiments/read-mt760.py")["device_path"]())')
getfacl "$rapoo_node"
```

Se faltar acesso de leitura/escrita, o próprio usuário aplica a permissão específica:

```sh
sudo setfacl -m "u:$(id -un):rw" "$rapoo_node"
```

O valor de `rapoo_node` só é válido enquanto o dispositivo permanecer conectado sem reenumeração; reidentifique se houver reconexão. Execute a captura como usuário normal, usando nome novo para preservar capturas anteriores:

```sh
python3 research/experiments/read-mt760.py --capture > "research/captures/mt760-native-$(date +%Y%m%d-%H%M%S).jsonl"
```

Confira também o código de saída e eventuais linhas de erro: um arquivo gerado pode conter uma tentativa parcial ou inválida. Para revogar a ACL sem desconectar, após conferir novamente o nó:

```sh
sudo setfacl -x "u:$(id -un)" "$rapoo_node"
```

## Pacotes e interpretação

Cada solicitação tem 32 bytes no hidraw: report ID `BA`, cabeçalho wireless `A5`, operação, comprimento, endereço de 32 bits little-endian e zeros até completar 32 bytes. O `A5` do cabeçalho não é uma operação de gravação.

| Consulta | Primeiros 8 bytes, incluindo Report ID | Resposta observada |
| --- | --- | --- |
| Bateria | `BA A5 AA 00 00 00 00 00` | 3 bytes |
| Bloco DPI | `BA A5 A4 18 38 06 00 00` | 28 bytes |
| Bloco adicional, significado pendente | `BA A5 A4 18 60 06 00 00` | 28 bytes |

Os offsets abaixo começam em zero no buffer retornado pelo ioctl Linux. O byte 0 recebido é status `01`, não o Report ID `BA`; não removê-lo.

- Bateria: resposta `01 01 3B`; byte 2 = `0x3B` = **59%**, conforme interpretação do driver. O estado do byte 1 não foi validado como carregando/descarregando.
- Sete valores armazenados: `DPI[i] = LE16(resposta[4 + 2*i : 6 + 2*i]) * 50`, para `i` de 0 a 6. Os pares `14 00`, `18 00`, `1B 00` fornecem 1000, 1200 e 1350 DPI.
- Quantidade habilitada: `resposta[18] + 1`; valor observado `2 + 1 = 3`, coerente com a rotina do registro `0x646`.
- Índice ativo: `resposta[20]`, base zero, correspondente ao registro `0x648`. O DPI ativo é `DPI[índice]`, somente se o índice estiver dentro da lista e dos estágios habilitados.
- O bloco `0x660` não foi necessário para identificar o DPI ativo. Seu significado permanece pendente; não interpretar `FF 00` como índice/quantidade.

Use somente os bytes efetivamente retornados (3 ou 28); os zeros restantes do buffer de 32 bytes não são dados recebidos. A bateria é o percentual informado pelo dispositivo, sem comparação independente de precisão. O teste físico confirmou o seletor DPI, sem medir deslocamento por polegada.

## Transporte e limites

As três consultas foram derivadas da análise estática do driver oficial 1.2.1, documentada em `../software-analysis/dpi-battery.md`. O script usa o report ID `BA` e 31 bytes de payload anunciados pelo descritor, com preenchimento zero. Esse enquadramento obteve respostas no receptor conectado; ainda falta uma captura de referência do driver Windows para comparação.

O script reencontra a interface por VID/PID USB e SHA-256 do descritor completo, exige um único resultado e confere a identidade novamente pelo handle. Não aceita operações, endereços ou payloads arbitrários. Envia uma solicitação de bateria (`AA`) e duas leituras (`A4`, registros `638` e `660`), uma vez cada, sem repetição. As respostas são solicitadas por `HIDIOCGINPUT(32)`; não usa Feature Reports. Aguarda 450 ms antes da leitura e 150 ms após sucesso. Cada processo de consulta tem timeout de oito segundos; falha de transporte, status diferente de 1 ou tamanho diferente de 3 bytes (bateria)/28 bytes (A4) interrompe as consultas restantes.

Os bytes de resposta são preservados sem interpretação. Sucesso do ioctl não confirma um percentual ou DPI: primeiro é necessário validar o enquadramento e correlacionar os campos com estados observáveis. O script não implementa gravação de configuração, pareamento ou firmware. Consultas experimentais ainda podem não funcionar no firmware conectado.

Antes da captura, verificar o nó atual e suas permissões. Em 2026-10-15, a interface correspondente era `/dev/hidraw5`, com acesso somente a root. A tentativa inicial do script parou na checagem de permissão, sem enviar comandos. A ACL anterior de hidraw6 não libera esta interface. O usuário precisa aplicar uma ACL temporária no nó correto; não executar o script inteiro como root.

Após receber dados, validar primeiro status e tamanho da resposta. A correspondência dos campos com o buffer Linux observado está descrita acima; isso não estabelece offsets para eventos WebHID. Para repetir a confirmação do DPI atual, comparar capturas antes/depois de um toque no botão físico de DPI; registrar e restaurar o estágio original. Para verificar o percentual de bateria independentemente, comparar com o driver oficial ou outra referência do dispositivo.

Este experimento verifica o caminho nativo GET_REPORT(Input). O teste posterior WebHID não recebeu evento BA em três segundos; a ponte entregou os dados à página. Procedimento e evidências em [integração no navegador](browser-telemetry.md).

## Resultado

Após o usuário aplicar ACL em hidraw5, duas sequências retornaram bytes idênticos, preservados em `../captures/mt760-native-baseline.json`. A interpretação identificada no driver fornece bateria de 59% e lista DPI de 1000, 1200, 1350, 800, 2400, 3200 e 4000. Os três primeiros estão habilitados: offset 18 + 1 fornece quantidade 3; offset 20 fornece índice atual.

Três toques físicos separados confirmaram o ciclo `2 → 0 → 1 → 2`, correspondente a `1350 → 1000 → 1200 → 1350 DPI`. A captura `../captures/mt760-native-restored.json` confirmou respostas idênticas às originais, restaurando o estágio inicial. Não houve comando de gravação pelo software.

Uma tentativa intermediária retornou status 2 e uma resposta de bateria atrasada durante outra consulta; foi descartada, preservada em `../captures/mt760-native-delayed-response.json`. Esse resultado motivou a validação de status/tamanho com interrupção e maior espera. A causa exata do atraso ainda não foi estabelecida. A validação atual não distingue respostas antigas de outra consulta com o mesmo tamanho; não tratar o experimento como transporte de produção.
