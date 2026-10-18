# Primeira gravação de configuração do MT760

Experimento em 2026-10-17. MT760 via receptor 2,4 GHz, VID 24AE/PID 1870, firmware desconhecido. Esta etapa usa um script local; a API HTTP e o painel continuam somente de leitura.

## Escopo

Testar exclusivamente o primeiro estágio de DPI, **1000 → 1050**, mantendo-o inativo. Os demais seis valores, quantidade habilitada, estágio ativo e campos observados do polling rate devem permanecer iguais. O plano original observado tinha estágio ativo 3/3, 1350 DPI e 1000 Hz.

Não é edição arbitrária de endereços, firmware, pareamento ou dump integral de EEPROM. O backup preserva os blocos de configuração consultados, não toda a memória ou firmware do dispositivo. A persistência requer uma verificação após desligar mouse e receptor; ACK e leitura imediata não a comprovam sozinhos. Mesmo com persistência, a localização física do armazenamento no mouse ou receptor permanece desconhecida.

## Evidência no driver oficial

Executável RapooOfficeDev 1.2.1, SHA-256 `4af207a5af13f860218df727619219df90420d4038ad3c3aa49db537235d84a7`, sem executar/instalar o binário. [Fonte e inventário](../software-analysis/official-driver-inventory.json).

| Evidência | VA no PE |
| --- | --- |
| Vtable wireless | 0x013C3DEC |
| Slot 42 herdado, setter da tabela DPI | 0x0051E9D0 |
| Operação A5, comprimento 0x10, registro 0x638 | 0x0051EA17–0x0051EA45 |
| Codificação de cada DPI / 50 em little-endian | 0x0051EB26–0x0051EB73 |
| Quantidade habilitada menos 1 e byte seguinte zero | 0x0051EC3D–0x0051EC9F |
| Envio pelo slot 82 | 0x0051ED31–0x0051ED6B |
| Transação de gravação: Output + GET_REPORT(Input), ACK | 0x00524F60 |

Hash, slot de vtable, bytes de operação/comprimento/endereço e transporte foram conferidos com asserts no executável. A leitura de origem é o bloco A4/0x638 já comprovado. O setter oficial também pode reorganizar estágios conforme os habilitados; o experimento preserva exatamente a ordem já lida e a quantidade atual, mudando só o primeiro valor.

## Pacote do teste

```text
BA A5 A5 10 38 06 00 00
15 00 18 00 1B 00 10 00 30 00 40 00 50 00 02 00
00 00 00 00 00 00 00 00
```

Total: 32 bytes hidraw. Report ID BA, cabeçalho wireless A5, **operação de gravação A5**, comprimento 16, endereço 0x638 little-endian, dados de 16 bytes e preenchimento. A restauração usa o mesmo formato com `14 00` em vez de `15 00` no primeiro valor. Só um byte dos dados muda: unidades de 50 DPI passam de 20 para 21.

Os dados contêm sete valores de 16 bits, quantidade habilitada menos 1 e reservado zero. O comando não escreve o registro do índice ativo em 0x648 nem os registros de polling rate em 0x630/0x631.

## Script e proteções

[write-mt760-dpi.py](write-mt760-dpi.py) reutiliza as leituras e identificação existentes. O script:

- Exige o VID/PID e o hash de descritor conhecidos, conferindo a identidade novamente no handle antes de escrever.
- Exige primeiro estágio original de 1000 DPI, inativo, com quantidade/índice válidos, sete valores entre 50 e 4000 DPI e byte reservado zero.
- Compara duas sequências completas de leitura para obter estado estável.
- Persiste o backup e a intenção antes da escrita, com flush/fsync e substituição atômica do arquivo.
- Aceita somente este teste e sua restauração; não recebe endereço ou payload arbitrário.
- Faz uma única tentativa de envio, sem repetição automática de gravação; processo de escrita limitado a oito segundos.
- Não usa o ACK isolado como sucesso: exige duas sequências estáveis com os dados esperados e preservação dos demais campos lidos.
- Recusa repetir `apply-test` em um backup que já registra tentativa.
- Se a aplicação falhar, tenta restaurar quando o estado ainda corresponde ao original ou ao teste. Diante de estado inesperado, registra o erro de recuperação e não sobrescreve configurações desconhecidas.

A ponte é pausada durante todo o experimento para não disputar consultas. O lock HTTP da ponte não protege contra outros clientes externos: manter o configurador oficial e outros leitores fechados. O script é um experimento supervisionado, não uma interface de configuração pronta para uso geral.

## Procedimento reproduzível

Da raiz do projeto, com acesso à interface hidraw correta, mouse acordado e ponte parada:

```sh
python3 research/experiments/write-mt760-dpi.py prepare
```

Esse comando apenas lê e cria `research/captures/mt760-dpi-write-<horário>.json`. Confira o estado e o pacote antes do passo seguinte. Use o caminho retornado; não copie um backup de outro dispositivo.

```sh
python3 research/experiments/write-mt760-dpi.py apply-test research/captures/mt760-dpi-write-<horário>.json
```

Após confirmar 1050 DPI no primeiro estágio, desligue fisicamente o mouse e retire o receptor USB por 10 segundos. Reconecte, ligue e mova o mouse; não pressione DPI. Reidentifique a interface e reaplique ACL específica se necessário, usando o [procedimento nativo](native-dpi-battery.md). Então:

```sh
python3 research/experiments/write-mt760-dpi.py verify-after-power-cycle research/captures/mt760-dpi-write-<horário>.json
python3 research/experiments/write-mt760-dpi.py restore research/captures/mt760-dpi-write-<horário>.json
```

A verificação não faz gravação. A restauração é idempotente: se o original já estiver presente, só lê. Se desligar o dispositivo também mudar o estágio ativo, analisar o backup e retornar ao estágio original pelo botão físico antes de continuar; não relaxar a comparação nem restaurar sobre estado inesperado sem investigação.

`worker-apply` e `worker-restore` são caminhos internos de subprocesso; usar os comandos supervisionados acima, que persistem a intenção e verificam o estado.

## Resultado da primeira aplicação

Backup/evidência: [mt760-dpi-write-20261017T154052865924Z.json](../captures/mt760-dpi-write-20261017T154052865924Z.json).

- A primeira preparação recebeu erro de bateria/status 02 e parou sem escrever. A segunda preparação obteve leituras estáveis e criou o backup.
- A gravação A5 foi enviada uma vez; ACK de um byte `01` recebido.
- Duas sequências posteriores confirmaram lista `1050, 1200, 1350, 800, 2400, 3200, 4000`.
- Estágio ativo 3/3 e 1350 DPI preservados; 1000 Hz e demais campos observados preservados.
- O usuário confirmou desligar o mouse, retirar o receptor e reconectar. A reconexão removeu a ACL de hidraw5; a verificação ficou bloqueada até reaplicar a permissão e conferir a entrada `user:gdsantana:rw-`.
- Após o ciclo físico confirmado, duas sequências de leitura mostraram **1050 DPI no primeiro estágio**, mantendo a tabela restante, índice ativo e polling rate esperados. A configuração sobreviveu à perda de energia do conjunto sem reenvio da gravação.
- Enviada uma única gravação de restauração, com ACK 01. Duas sequências posteriores confirmaram **1000 DPI no primeiro estágio**, tabela original completa, 1350 DPI ativos e 1000 Hz.
- Ponte somente de leitura reativada após a restauração; o endpoint real devolveu a tabela original, 1350 DPI ativos e 1000 Hz. [Resposta final](../captures/bridge-after-dpi-restore.json).
- Não foi realizado outro ciclo de energia depois da restauração. O teste demonstra persistência no conjunto mouse/receptor observado, sem identificar o componente físico ou a tecnologia de armazenamento.

## Validação automatizada

`npm test` passou com 14 testes TypeScript e 11 Python, incluindo pacote exato, rejeição de backup/campos inválidos, falha de aplicação com restauração, bloqueio de restauração sobre estado inesperado e verificação sem escrita. Os testes usam mocks e capturas: persistência física não é simulada como se estivesse comprovada.
