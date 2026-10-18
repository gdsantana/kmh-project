# Retomada do projeto: leitura de bateria e DPI do MT760

Registro de continuidade em **2026-10-16**, atualizado em **2026-10-17**, horário de referência America/Sao_Paulo.

Atualização de 2026-10-17: o painel também lê o **polling rate configurado**, usando A4/0x630, byte wireless no offset 5. Foram obtidos 1000 Hz e o usuário confirmou esse valor na página. [Descoberta, captura e limites](../research/software-analysis/polling-rate.md). As capturas de 59%/1350 DPI abaixo são o histórico inicial; a captura posterior da ponte trouxe 54%/1350 DPI/1000 Hz.

## Estado alcançado

Conseguimos consultar o receptor do Rapoo MT760 e receber os dados reais na página local. O caminho funcional usa **ponte Python no Linux**, pois o teste WebHID direto não recebeu evento de resposta.

Na última captura preservada, a página mostrou **59% de bateria, 1350 DPI e estágio 3 de 3**. Esses números são resultados daquele teste, não valores fixos nem garantia do estado atual do mouse.

- Modelo MT760 e conexão por receptor 2,4 GHz: informados pelo usuário.
- Identidade USB observada: VID `0x24AE`, PID `0x1870`.
- Firmware: desconhecido. O identificador USB `20220811` não foi confirmado como versão de firmware.
- Coleção usada na leitura: usage page `0xFF00`, usage `0x0E`, report ID `0xBA`, payload de 31 bytes.
- Interface Linux no teste: `/dev/hidraw5`; reencontrar após reconectar, pois o número pode mudar.
- A leitura inicial abaixo foi ampliada por um experimento supervisionado de gravação de um estágio DPI, documentado em [write-dpi.md](../research/experiments/write-dpi.md). Pareamento e atualização de firmware continuam não implementados.

O [HANDOFF original](../HANDOFF.MD) contém os objetivos de longo prazo. Este documento registra o estado implementado para retomar sem depender do histórico do chat.

## Como a descoberta foi feita

1. **Inspeção do hardware:** a PoC WebHID mostrou nome, VID/PID e descritores. A abertura inicial falhou por permissão Linux; o usuário aplicou ACL temporária em hidraw6, abrindo a coleção `FF01/06`. Abrir essa coleção não revelou bateria/DPI.
2. **Análise estática do software oficial:** os instaladores MT760LDriver 1.0.5 e RapooOfficeDev 1.2.1 foram baixados e seus executáveis extraídos, sem instalação ou execução. Na versão 1.2.1, a classe `FDeviceMT760_Wireless` identificou a coleção correta `FF00/0E`, report BA e as consultas de leitura. Fontes, hashes, método de extração e endereços no binário estão na [análise detalhada](../research/software-analysis/dpi-battery.md) e no [inventário dos drivers](../research/software-analysis/official-driver-inventory.json).
3. **Acesso à interface correta:** revalidamos o sysfs e o descritor. O usuário aplicou ACL específica em hidraw5, separada da permissão anterior de hidraw6.
4. **Experimento nativo:** o diagnóstico Python enviou as consultas fixas e leu as respostas por `HIDIOCGINPUT(32)`, equivalente ao GET_REPORT(Input) usado pelo driver Windows. Duas sequências iniciais retornaram dados idênticos.
5. **Correlação física:** três toques separados no botão de DPI produziram índices `2 → 0 → 1 → 2` e valores `1350 → 1000 → 1200 → 1350`. Somente o byte 20 do bloco DPI mudou. A leitura final restaurou e confirmou o estado inicial.
6. **Teste no navegador:** WebHID abriu `FF00/0E` e enviou a consulta de bateria sem erro. Não houve evento BA em três segundos. Um GET_INPUT nativo posterior, sem outro Output Report, retornou `01 01 3B`. Como WebHID não expõe GET_REPORT(Input), implementamos a ponte local.
7. **Integração real:** a página passou a consultar a ponte e mostrar bateria/DPI, origem e horário. Ao parar a ponte, a página mostrou erro e removeu os valores anteriores. Reiniciar a ponte recuperou a leitura.

Uma tentativa nativa intermediária retornou erro e resposta atrasada. Ela foi preservada, mas descartada da interpretação. O diagnóstico passou a validar status/tamanho, interromper em caso de incompatibilidade e aguardar mais tempo entre operações.

## Protocolo observado

Solicitações hidraw têm 32 bytes: report ID `BA`, cabeçalho wireless `A5`, operação, comprimento, endereço de 32 bits little-endian e preenchimento zero. O `A5` do cabeçalho e a operação de gravação são campos diferentes.

| Leitura | Primeiros 8 bytes, completar com 24 zeros | Resposta observada |
| --- | --- | --- |
| Bateria | `BA A5 AA 00 00 00 00 00` | 3 bytes |
| Bloco DPI | `BA A5 A4 18 38 06 00 00` | 28 bytes |

No buffer retornado pelo ioctl Linux, offsets começam em zero. O primeiro byte recebido é status `01`, não `BA`; não removê-lo como Report ID.

- Bateria: byte 2. `01 01 3B` fornece `0x3B = 59%`, conforme a interpretação do driver. O significado de carregamento do byte 1 ainda não foi validado fisicamente.
- Valores DPI: sete inteiros de 16 bits little-endian a partir do offset 4, cada um multiplicado por 50.
- Quantidade habilitada: byte 18 + 1, correspondente ao registro `0x646`.
- Índice ativo: byte 20, base zero, correspondente ao registro `0x648`. Usar somente índice válido dentro da quantidade habilitada.
- DPI ativo: valor da lista na posição indicada pelo índice.

A lista armazenada no teste foi `1000, 1200, 1350, 800, 2400, 3200, 4000`, com apenas os três primeiros estágios habilitados. O bloco adicional `0x660` foi investigado, mas seu significado não foi confirmado; ele **não é necessário** ao fluxo da ponte. Não reutilizar a hipótese inicial de que esse bloco forneceria o índice DPI atual.

Esses offsets descrevem o buffer Linux observado; não presumir enquadramento igual em eventos WebHID ou em outros firmwares.

## Executar novamente

Requer Linux, Python 3, Node.js compatível com o projeto e receptor conectado. Executar da raiz do repositório:

```sh
npm ci
python3 research/experiments/read-mt760.py --self-test
```

Identificar a interface pelo próprio diagnóstico, sem enviar consultas:

```sh
rapoo_node=$(python3 -c 'import runpy; print(runpy.run_path("research/experiments/read-mt760.py")["device_path"]())')
getfacl "$rapoo_node"
```

O helper exige um único dispositivo USB com VID/PID e hash do descritor conhecidos. Se faltar leitura/escrita, o usuário aplica a ACL específica no seu terminal:

```sh
sudo setfacl -m "u:$(id -un):rw" "$rapoo_node"
```

Não executar a aplicação como root. Se o dispositivo reconectar, reidentificar o nó; a ACL pode ser perdida. Para revogar a permissão, conferir novamente o nó e executar `sudo setfacl -x "u:$(id -un)" "$rapoo_node"`.

Em um terminal:

```sh
npm run bridge
```

Em outro:

```sh
npm run dev
```

Abrir **http://127.0.0.1:5174/** e clicar **Ler informações do mouse**. Não é necessário selecionar o dispositivo pelo WebHID para usar a ponte. A atualização é manual, sem polling. **Exportar leitura JSON** guarda valores e respostas brutas. Não depender de processos que tenham ficado abertos em uma sessão anterior.

## Fluxo e arquivos para continuar

```text
apps/web/src/main.tsx
  → apps/web/src/local-reader.ts
  → POST http://127.0.0.1:5175/api/telemetry
  → apps/bridge/server.py
  → research/experiments/read-mt760.py --worker
  → Output Report + GET_REPORT(Input) → receptor
  → validação/decodificação → JSON → validação no cliente → página
```

| Arquivo | Papel |
| --- | --- |
| [server.py](../apps/bridge/server.py) | Ponte, controle de origem/concorrência, execução limitada e decoder |
| [read-mt760.py](../research/experiments/read-mt760.py) | Identidade/descritor, pacotes fixos e acesso hidraw |
| [local-reader.ts](../apps/web/src/local-reader.ts) | Cliente HTTP e validação do JSON |
| [main.tsx](../apps/web/src/main.tsx) | Exibição, atualização manual, erros e exportação |
| [webhid-probe.ts](../apps/web/src/webhid-probe.ts) | Experimento direto com eventos WebHID e timeout |
| [bridge_test.py](../tests/bridge_test.py) | Decoder com capturas reais, falhas e proteção HTTP |
| [local-reader.test.ts](../tests/local-reader.test.ts) | Validação e falhas do cliente |
| [webhid-probe.test.ts](../tests/webhid-probe.test.ts) | Consulta fixa e observação de eventos |

A ponte escuta apenas em `127.0.0.1:5175`, valida Host/Origin, exige POST com `X-Rapoo-Read: 1` e não aceita corpo nem comandos arbitrários. Aceita as origens locais nas portas 5174 e 4173. Serializa as leituras e limita cada subprocesso a oito segundos; o cliente HTTP espera até trinta segundos. O caminho da ponte lê somente bateria, bloco DPI e bloco de polling rate, conferindo a região comum dos dois blocos A4. A interface fecha os handles WebHID antes da leitura nativa.

## Evidências preservadas

O [índice das capturas](../research/captures/README.md) relaciona os arquivos. Os principais para reproduzir a conclusão são:

- [Baseline nativo](../research/captures/mt760-native-baseline.json): duas sequências idênticas, requests e respostas.
- [Primeiro toque](../research/captures/mt760-native-dpi-button.json), [segundo toque](../research/captures/mt760-native-dpi-button-2.json) e [restauração](../research/captures/mt760-native-restored.json): ciclo físico completo de DPI.
- [Tentativa inválida](../research/captures/mt760-native-delayed-response.json): erro/atraso preservado e motivo do descarte.
- [Teste WebHID](../research/captures/webhid-battery-probe.json): envio sem evento e resposta nativa posterior.
- [JSON recebido pela página](../research/captures/browser-native-reading.json) e [imagem do painel](../research/captures/browser-native-reading-card.png): leitura real no navegador.
- [Erro da ponte](../research/captures/browser-bridge-unavailable.png): indisponibilidade tratada na página.

As capturas são evidências e fixtures de teste. O fluxo normal da ponte consulta o hardware, não esses arquivos.

## Verificação já realizada

`npm test` passou com 14 testes TypeScript e 3 testes Python. `npm run build` passou. O self-test do diagnóstico também passou. A integração foi observada no navegador com hardware real e com parada/recuperação controlada da ponte.

Para verificar uma mudança futura:

```sh
npm test
npm run build
python3 research/experiments/read-mt760.py --self-test
```

Os testes automatizados usam mocks e capturas preservadas; não substituem nova validação física quando o transporte ou o protocolo mudar.

## Pendências para a próxima sessão

1. Validar desconexão/reconexão física e repouso/despertar do mouse, preservando respostas brutas e erros. Confirmar reidentificação do nó e comportamento da ACL.
2. Investigar correlação de transações. Sem identificador conhecido, uma resposta antiga de mesmo tamanho produzida por outro cliente HID pode ser aceita. O lock protege apenas os pedidos desta ponte; manter um único leitor HID ativo.
3. Comparar bateria e DPI com o software oficial e registrar firmware, sem Apply, pareamento ou atualização. O teste físico confirmou o seletor DPI, não a calibração de deslocamento por polegada nem a precisão do percentual.
4. Validar carregamento e outros firmwares/modelos/conexões antes de ampliar a compatibilidade.
5. Evoluir o primeiro experimento de escrita para uma configuração utilizável: a tabela DPI já foi alterada, persistiu após ciclo físico do conjunto e foi restaurada. Ver [procedimento e evidência](../research/experiments/write-dpi.md). Antes de expor escrita na UI, resolver concorrência, correlação de respostas e a recuperação diante de desconexão durante gravação.

Não adicionar polling automático ou promover o diagnóstico a transporte de produção antes de resolver o comportamento de respostas atrasadas. WebHID puro não recebeu resposta no teste atual; não apresentar a ponte como suporte WebHID direto.

## Preservação do trabalho

Neste registro existem arquivos novos ainda não versionados no Git. Antes de limpar a árvore, trocar o checkout ou recriar o ambiente, preservar implementação, documentação e capturas. Os instaladores oficiais e artefatos temporários de análise não estão redistribuídos no repositório; usar URLs e hashes do inventário para reobtê-los se necessário.
