# Compatibilidade

| Identidade | Modelo/firmware | Conexão com mouse | Descritores no navegador | Abertura | Configuração / persistência |
| --- | --- | --- | --- | --- | --- |
| Rapoo `24AE:1870` | MT760 informado pelo usuário; firmware desconhecido | Receptor 2,4 GHz informado pelo usuário | Confirmado, 3 handles | Confirmada na coleção `0xFF01` | Não testadas |
| Outras variantes MT760 | Não identificados | USB / receptor / Bluetooth | Não testado | Não testado | Não testadas |

A enumeração USB não prova que o mouse esteja conectado por cabo: também pode representar um receptor. O teste inicial exibiu nome e coleções reais pelo navegador integrado do Codex, mas todas as aberturas foram negadas. Os nós hidraw estavam em `0600 root:root`. Depois da ACL temporária aplicada pelo usuário a hidraw6, a coleção `0xFF01` abriu com sucesso. Fechar e reabrir também funcionou; as outras duas interfaces permaneceram negadas. Evidência: `research/captures/rapoo-24ae-1870-webhid-open.json` e `webhid-interface-open.png`.

Chromium para desktop e contexto seguro (HTTPS ou localhost) são o alvo do experimento. Permissões do site e do sistema operacional são independentes. Um handle aberto comprova acesso, não compatibilidade de protocolo.

A interface candidata às consultas DPI/bateria do driver 1.2.1 é `0xFF00/0x0E` (report `0xBA`), cuja abertura continuava negada na captura da PoC. A abertura confirmada de `0xFF01` não deve ser apresentada como prova de acesso ao protocolo de configuração. Ver pesquisa em `research/software-analysis/dpi-battery.md`.

Teste nativo posterior, após ACL específica em hidraw5: GET_REPORT(Input) respondeu às consultas de bateria e DPI. Bateria interpretada como 59%; três estágios habilitados, ciclo físico completo `1350 → 1000 → 1200 → 1350 DPI`, restaurando o estágio original. Capturas em `research/captures/mt760-native-*.json`. Este resultado vale para o receptor conectado; firmware desconhecido.

Em 2026-10-16, WebHID abriu `FF00/0E` e enviou a consulta de bateria sem erro, mas não recebeu evento BA em três segundos. A ponte Linux entregou os dados reais à página com sucesso. Parada/recuperação da ponte foi testada; naquela etapa, desconexão física, outros sistemas/firmwares e gravação continuavam sem validação. Ver `research/experiments/browser-telemetry.md`.

Em 2026-10-17, o teste separado A5/0x638/16 alterou o primeiro estágio inativo de 1000 para 1050 DPI. O valor persistiu após o usuário desligar mouse e receptor, sem reenvio da gravação; a tabela original foi restaurada e verificada, preservando 1350 DPI ativos e 1000 Hz. Isso vale apenas para o conjunto observado. Não identifica a memória física no mouse/receptor, não valida outros comandos nem inclui segundo ciclo após restaurar. [Experimento](../research/experiments/write-dpi.md).
