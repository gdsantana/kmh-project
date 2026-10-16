# Histórico de pesquisa

## 2026-10-15 — inventário e primeira PoC

- Repositório inicial: handoff, README e licença MIT; sem implementação.
- Host: Linux, usuário sem acesso aos nós hidraw do Rapoo.
- `lsusb` identificou `24ae:1870 Rapoo Gaming Device`.
- Descritores de três interfaces foram preservados diretamente do sysfs; nenhum comando HID enviado.
- Interface USB 2: usage page `0xff01`, report `0x06`, payload de 28 bytes para Input/Output/Feature. Candidata à investigação, protocolo desconhecido.
- PoC React/TypeScript/Vite criada com modelo, transporte e identidade separados, além de espaço documentado para protocolo futuro.
- Navegador integrado: seleção retornou três handles e mostrou VID/PID, nome e coleções. Todas as aberturas foram negadas; permissões do sistema observadas como `0600 root:root` em hidraw4/5/6.
- O usuário também informou que o dispositivo aparece, mas a abertura falha.
- Liberação temporária específica de hidraw6 foi orientada; repetição do teste físico ainda pendente.
- ClickSync: README, runtime de descoberta, licença e presença do workbench consultados. Nenhum código de terceiros incorporado. Detalhes em `research/software-analysis/clicksync.md`.
- Instalação: npm sem vulnerabilidades reportadas. Build passou; 10 casos de teste executados e aprovados fora do sandbox. O runner dentro do sandbox reportou somente o arquivo e foi considerado evidência insuficiente; execução direta também confirmou os casos iniciais.

### Resultado após corrigir a permissão

- Usuário aplicou ACL temporária para seu usuário em `/dev/hidraw6`; `getfacl` confirmou leitura/escrita.
- Ação **Reabrir dispositivos autorizados** abriu a coleção `0xFF01` do Rapoo `24AE:1870` sem novo seletor. As outras duas interfaces continuaram negadas.
- **Encerrar conexão** fechou a interface e uma nova reabertura funcionou no dispositivo real.
- JSON exportado pelo próprio aplicativo foi salvo e validado em `research/captures/rapoo-24ae-1870-webhid-open.json`. Captura visual: `research/captures/webhid-interface-open.png`.
- A exportação foi confirmada pelo arquivo em Downloads; a espera do evento de download na automação expirou, mas o arquivo foi gravado corretamente.
- Build e 10 testes passaram. Não houve comandos de configuração enviados nem leituras de feature.

Decisão: PoC de acesso pelo navegador concluída; continuar WebHID para investigação de protocolo. Abrir a interface e ler descritores não comprova configuração ou persistência.


## 2026-10-15 — investigação de DPI e bateria

- Usuário confirmou MT760 conectado por receptor 2,4 GHz; firmware não informado.
- Dois instaladores oficiais baixados e analisados sem instalação/execução: MT760LDriver 1.0.5 e RapooOfficeDev 1.2.1. Hashes em `research/software-analysis/official-driver-inventory.json`.
- Na 1.2.1, RTTI e construtor identificam `FDeviceMT760_Wireless` e PID `0x1870`.
- Consultas candidatas pela interface `0xFF00/0x0E`, report `0xBA`: bateria `AA`, DPI `A4` nos registros `0x638`/`0x660`; decodificação da lista aplica fator 50.
- Resposta do driver usa `HidD_GetInputReport`. WebHID não tem equivalente direto; resposta por `inputreport` permanece hipótese a medir.
- Caminho antigo `AE 01`/`AE 00` documentado separadamente; não foi promovido à consulta principal.
- Nenhum comando enviado, nenhuma alteração na UI/transporte de produção. Análise completa e experimento seguinte em `research/software-analysis/dpi-battery.md`.

### Preparação do teste nativo

- Criado `research/experiments/read-mt760.py`, diagnóstico isolado com somente três consultas candidatas fixas de leitura. Valida identidade e descritor, limita o tempo e preserva bytes brutos sem exibir valores supostamente confirmados.
- Self-test conferiu os três pacotes completos e a rejeição de consulta desconhecida.
- Interface `hidraw5` revalidada no sysfs. Tentativa real interrompida antes do envio por falta de permissão; ACL de hidraw6 continua insuficiente. Liberação específica solicitada ao usuário.
- Nenhum comando enviado nesta tentativa. Procedimento e limitações em `research/experiments/native-dpi-battery.md`.

### Respostas reais após liberação de hidraw5

- Usuário aplicou ACL; duas sequências nativas receberam respostas idênticas. Evidência preservada em `research/captures/mt760-native-baseline.json`, com horários, requests, buffers e comprimentos retornados.
- Interpretação do driver: bateria 59%; lista DPI 1000, 1200, 1350, 800, 2400, 3200, 4000. Consulta 0x660 retornou FF/00 nos campos antes suspeitos; DPI ativo segue desconhecido.
- Nenhuma escrita de configuração. Comparação com software oficial e transporte WebHID ainda não realizados.
- Solicitado ao usuário um toque no botão físico de DPI para comparar os bytes com esta referência.

### Correlação física e restauração

- Três toques físicos, feitos pelo usuário separadamente, correlacionaram o byte 20 do bloco 0x638 com índice `2 → 0 → 1 → 2`; DPI `1350 → 1000 → 1200 → 1350`. Estado original restaurado e confirmado por respostas idênticas à referência.
- Revisão adicional do driver encontrou rotina 0x0051D3B0 lendo 0x648 (índice) e 0x0051D750 lendo 0x646 e somando 1 (quantidade). Esses dados já estavam na leitura de 0x638; há três estágios habilitados, embora sete valores estejam armazenados.
- Uma tentativa intermediária retornou erro/atraso. Evidência preservada e descartada da interpretação. Diagnóstico passou a validar status/tamanho e parar diante de resposta incompatível; espera aumentada. Ainda não há correlação de transação que rejeite resposta antiga com mesmo tamanho: experimento, não transporte de produção.
- Self-test cobre pacotes fixos, rejeição de consulta arbitrária/resposta inválida e as capturas do ciclo DPI e restauração. A aplicação web permanece sem comandos de protocolo.

## 2026-10-16 — bateria e DPI recebidos no navegador

- Usuário autorizou prosseguir até receber dados no navegador, incluindo alternativa de ponte local.
- WebHID reabriu a coleção correta FF00/0E com ACL existente. Consulta fixa AA enviada, sem evento BA em três segundos. Um GET_INPUT nativo posterior, sem novo Output, retornou `01 01 3B`. Evidência `webhid-battery-probe.json`.
- Ponte Python padrão criada em 127.0.0.1:5175, com Host/Origin restritos, POST sem corpo e header próprio, duas consultas fixas (bateria e bloco DPI), lock e timeout de subprocesso. Não consulta 0x660, não aceita comandos arbitrários.
- Página recebeu 59% de bateria, 1350 DPI, estágio 3/3, valores habilitados 1000/1200/1350, horário e respostas brutas. JSON extraído do DOM e screenshot preservados em `research/captures/browser-native-reading.*`.
- Parada da ponte causou erro visível e remoção dos dados anteriores; reinício recuperou a leitura. Evidência de erro preservada.
- Testes TypeScript (14) e Python (3) passaram; cobrem decoder com capturas reais, respostas inválidas, falha/timeout do worker, origem/Host/payload, concorrência e cliente HTTP. Build validado. Atualização manual; não houve gravação de configuração.
- Ainda pendentes: comparação com driver oficial, outros firmwares/sistemas, repouso/desconexão físicos e correlação de respostas antigas de mesmo tamanho.

### Registro para continuidade

- Processo consolidado em `docs/retomada-dpi-bateria.md`, vinculado no início do README: descoberta, protocolo observado, execução/ACL, fluxo dos arquivos, evidências, validações e prioridades da próxima sessão.
- Mantido o HANDOFF original de objetivos. O novo registro distingue estado implementado, resultados históricos e hipóteses pendentes, incluindo a limitação de respostas antigas e os arquivos ainda não versionados.
