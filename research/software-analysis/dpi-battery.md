# MT760 via receptor 2,4 GHz: DPI e bateria

Pesquisa em 2026-10-15. Modelo e conexão confirmados pelo usuário; firmware desconhecido.

## Resultado

Existem rotinas específicas para MT760 wireless no driver oficial **RapooOfficeDev 1.2.1**. Elas usam a coleção **usage page `0xFF00`, usage `0x0E`, report `0xBA`**. A interface aberta na primeira PoC (`0xFF01`, report `0x06`) não é o caminho usado por essas rotinas.

As seções de análise estática abaixo registram as hipóteses anteriores ao teste. Depois da liberação de hidraw5, o experimento nativo recebeu respostas reais, descritas a seguir. A compatibilidade continua limitada a este receptor; firmware desconhecido.

## Resultado do teste nativo — 2026-10-15 a 2026-10-16

Duas sequências consecutivas de consultas produziram respostas idênticas, preservadas em `../captures/mt760-native-baseline.json`:

- Bateria: `01 01 3B`, três bytes retornados por GET_REPORT(Input). Aplicando a interpretação do driver oficial, nível **59%**; sinalização de carregamento ainda não validada por teste físico.
- Lista DPI: sete inteiros little-endian nos offsets 4–17, multiplicados por 50: **1000, 1200, 1350, 800, 2400, 3200, 4000**.
- Consulta `0x660`: respondeu, mas os bytes 5/6 foram `FF 00`; não atribuir significado de índice atual/quantidade a esses campos sem correlação.
- Após um toque físico no botão de DPI, somente o offset 20 da resposta `0x638` mudou de `2` para `0`. Evidência em `../captures/mt760-native-dpi-button.json`. Revisão adicional do binário encontrou leitura de `0x648` em `0x0051D3B0`, com comprimento `08`, extraindo o primeiro byte dos dados (offset 4 da resposta). Esse endereço já está coberto pelo bloco `0x638` lido: `4 + (0x648 - 0x638) = 20`.
- A rotina em `0x0051D750` lê `0x646`, comprimento `08`, e soma 1 ao primeiro byte dos dados. No bloco capturado, offset 18 é `2`, consistente com três estágios habilitados. Portanto, sete valores armazenados não significam sete estágios habilitados.

O buffer nativo recebido começa com `01`, não `BA`: não remover automaticamente seu primeiro byte como se fosse Report ID. Os retornos do ioctl foram 3 bytes para bateria e 28 para as duas consultas A4; o restante do buffer de 32 bytes permaneceu zerado.

Dois toques físicos separados confirmaram a sequência de índice **2 → 0 → 1**, correspondente a **1350 → 1000 → 1200 DPI**. Somente o byte 20 do bloco 0x638 mudou; a lista, a consulta 0x660 e a bateria permaneceram iguais. Isso correlaciona o campo de índice com o seletor físico e é consistente com os três estágios habilitados. Capturas `../captures/mt760-native-dpi-button.json` e `../captures/mt760-native-dpi-button-2.json`.

Um terceiro toque restaurou índice **2 / 1350 DPI**. A leitura final foi idêntica à referência em todas as consultas (`../captures/mt760-native-restored.json`). Uma tentativa intermediária com erro/atraso foi descartada e motivou validação de status e tamanho no script; detalhes em `../experiments/native-dpi-battery.md`.

Esses valores foram extraídos do receptor conectado, com interpretação apoiada no driver e, para o índice DPI, teste físico. Ainda não foram comparados com a tela do software oficial. Precisão do percentual e calibração física de DPI continuam pendentes. Procedimento reproduzível em `../experiments/native-dpi-battery.md`.

Em 2026-10-16, o teste WebHID direto enviou a consulta sem erro, mas não recebeu evento BA em três segundos; um GET_INPUT nativo posterior recuperou a resposta. Uma ponte local Linux passou a entregar bateria/DPI à página, com leitura real verificada visualmente. Detalhes em [integração no navegador](../experiments/browser-telemetry.md).

## Fontes e integridade

A [central chinesa oficial](https://www.rapoo.cn/downloadcenter?model=MT760) vincula os dois instaladores analisados. URLs, tamanhos e SHA-256 do instalador e executável interno estão em `official-driver-inventory.json`.

- [MT760LDriver 1.0.5](https://rpd.rapoo.cn/download/MT760LDriver_1.0.5_20241202.exe): Qt 5, PE32/x86. O executável contém a consulta antiga de estado/energia e o fluxo M+.
- [RapooOfficeDev 1.2.1](https://rpd.rapoo.cn/download/RapooOfficeDevDriver_Setup_1.2.1_20250422.exe): Qt 5, PE32/x86. Contém `FDeviceMT760` e `FDeviceMT760_Wireless`, além de implementações separadas para outras variantes.
- [WebHID, interface HIDDevice](https://wicg.github.io/webhid/#hiddevice-interface): o navegador envia Output Reports e recebe Input Reports por eventos; Feature Reports possuem métodos separados.

Não foram instalados/executados drivers nem redistribuídos binários ou código proprietário. Os downloads da central global retornaram 403; os links oficiais `rpd.rapoo.cn` funcionaram. Os bundles atuais de `hub.rapoo.cn` e `hub1.rapoo.cn` examinados não continham a string MT760. Isso é um resultado da inspeção desses bundles, não prova universal de ausência de suporte em todos os canais oficiais.

## Identificação do caminho correto no driver 1.2.1

Endereços abaixo são **VAs no PE**, com image base `0x00400000`, aplicáveis somente ao hash registrado.

| Evidência | VA |
| --- | --- |
| Vtable identificada por RTTI `FDeviceMT760_Wireless` | `0x013C3DEC` |
| Construtor atribui cabeçalho `0xA5` ao objeto | `0x00527C36` |
| Mesmo construtor atribui PID `0x1870` | `0x00527C40` |
| Abertura procura VID `0x24AE`, page `0xFF00`, usage `0x0E` | `0x0051CFAF`–`0x0051CFCE` |
| Montagem do cabeçalho de comando | `0x00524EA0` |
| Transação com repetição e espera | `0x005250E0` |

O montador preenche: identificador do objeto, operação, comprimento, endereço de 32 bits little-endian. Para a classe wireless observada no binário, o primeiro campo é `0xA5`. As rotinas usam `0xBA` como report ID.

O descritor físico já capturado anuncia 31 bytes de payload nesse report. O driver utiliza buffers auxiliares de 32 bytes e a camada HID ajusta o transporte ao tamanho do descritor. O enquadramento exato precisa ser capturado: não tratar tamanho do buffer auxiliar como comprimento do payload WebHID.

## Bateria

A vtable wireless aponta o slot 28 para `0x00528560`, uma rotina que:

1. Constrói consulta com operação **`0xAA`**, comprimento `0`, endereço `0`.
2. Executa a transação usando report `0xBA`.
3. Verifica sucesso e um campo de estado.
4. Interpreta estado `1`/`2` com sinalização distinta de carregamento.
5. Usa o byte de índice **2 no buffer de resposta entregue à rotina**, limitando-o a 100, como nível da bateria.

Evidência: montagem em `0x005285B7`–`0x005285D0`; interpretação em `0x00528639`–`0x00528768`. Os offsets são do buffer interno do driver: a correspondência com `HIDInputReportEvent.data` precisa ser demonstrada, pois o navegador separa o Report ID.

A implementação antiga 1.0.5 possui outra consulta: `getDevicePower` em `0x00420410` chama `0x0041F020`, que usa `AE 01`, lê e depois usa `AE 00`; obtém energia do byte 5 do buffer interno. Esse caminho antigo **não deve substituir automaticamente** o `AA` específico identificado na versão nova. Demonstra por que a versão do software importa.

## DPI

A classe wireless herda as rotinas de leitura de DPI da implementação MT:

| Dado | Rotina no PE | Consulta candidata |
| --- | --- | --- |
| Lista dos sete valores de DPI | `0x0051D4C0` | operação `0xA4`, comprimento `0x18`, endereço `0x00000638` |
| Índice DPI ativo | `0x0051D3B0` | operação `0xA4`, comprimento `0x08`, endereço `0x00000648`; já incluído no bloco `0x638` |
| Quantidade habilitada (valor lido + 1) | `0x0051D750` | operação `0xA4`, comprimento `0x08`, endereço `0x00000646`; já incluído no bloco `0x638` |
| Metadados de significado pendente | `0x0051E5A0`, `0x0051E6B0` | operação `0xA4`, comprimento `0x18`, endereço `0x00000660` |

Correção após o teste físico: as rotinas `0x0051D3B0` (registro `0x648`) e `0x0051D750` (registro `0x646`, valor + 1) fornecem candidatos melhores para índice atual e quantidade habilitada. Ambos os registros já estão incluídos na leitura de `0x638`. A atribuição anterior de `0x660` a esses dados era uma hipótese não confirmada; não foi usada na interpretação dos valores reais.

A rotina da lista percorre sete pares de bytes a partir do índice 4 do buffer interno. Constrói cada inteiro de 16 bits **little-endian** e multiplica por **50**. Evidência: `0x0051D6BB`–`0x0051D711`.

As duas rotinas de metadados extraem os bytes 5 e 6 do buffer interno. A associação final entre esses campos, índice atual, quantidade habilitada e o valor mostrado na UI ainda deve ser correlacionada com captura controlada e o botão físico de DPI. Não presumir base 0/1 ou usar valores padrão como se fossem lidos.

Há código separado de gravação (`0xA5` como operação) no mesmo driver. Ele não faz parte das consultas propostas e não foi executado. O cabeçalho wireless `0xA5` e a operação de gravação `0xA5` são campos distintos; não classificar pacotes apenas pelo primeiro byte.

## Limitação decisiva do navegador

O caminho analisado envia pelo `WriteFile` da camada HID e consulta respostas com **`HidD_GetInputReport`**. A cadeia da versão 1.2.1 é:

```text
transação 0x005250E0
  envio: 0x00525200 → 0x004468C0 → 0x004402F0 → WriteFile
  resposta: 0x00525320 → 0x00446960 → 0x004403C0 → HidD_GetInputReport
```

WebHID não oferece um método equivalente a GET_REPORT(Input). `receiveFeatureReport()` solicita **Feature**, não **Input**, e o descritor de `0xBA` não anuncia Feature Reports. Portanto, não basta chamar `receiveFeatureReport(0x06)` na interface que já abrimos.

**Hipótese testada neste receptor:** enviamos a consulta por `sendReport(0xBA, ...)`, mas nenhum evento `inputreport` BA chegou em três segundos. A resposta foi recuperada por GET_REPORT(Input) nativo, sem novo Output Report. Por isso a UI usa uma ponte local Linux. Isso não comprova ausência de eventos em todos os firmwares; documenta apenas o caminho que funcionou neste teste.

## Plano inicial e pendências após os testes

Realizado: reidentificação da interface, ACL específica em hidraw5, consultas nativas fixas, respostas preservadas, correlação com botão físico e restauração do estágio original. O protocolo experimental e os comandos de reprodução estão em [experimento nativo](../experiments/native-dpi-battery.md).

Pendentes:

1. Comparar bateria/DPI com a tela do driver oficial 1.2.1 em Windows; capturar requests/responses com USBPcap e identificar firmware, sem Apply, pareamento ou atualização.
2. Ampliar o teste WebHID a outros firmwares se disponíveis. No receptor atual não houve evento BA em três segundos e a ponte Linux já entregou os dados à página.
3. Resolver correlação de transações e respostas antigas de mesmo tamanho antes de transformar o diagnóstico em transporte de produção.

Conclusão atual: **leitura nativa obtida, índice DPI correlacionado com o botão físico e dados recebidos na página via ponte local. O teste WebHID puro não recebeu evento de resposta.**

## Reprodução da análise estática

1. Baixar os instaladores das URLs registradas e conferir SHA-256. O servidor interrompeu downloads grandes; blocos HTTP Range de 1 MiB, com validação de Content-Range e comprimento, permitiram reconstrução integral.
2. Extrair o overlay PE `[0]` com 7-Zip, sem executar o instalador. O formato interno é NSISBI. As versões 23.01 e 26.04 não extraíram diretamente os arquivos internos desse pacote.
3. No overlay, ler blocos a partir do offset 36: tamanho uint64 little-endian; bit 63 indica DEFLATE raw; os 63 bits inferiores dão o tamanho comprimido. Para estes arquivos, descompressão com zlib `wbits=-15` produziu os executáveis cujos hashes estão no inventário. Não generalizar esse procedimento para outros instaladores.
4. O executável principal da versão 1.2.1 é o bloco 7, no offset 41603 do overlay; o da 1.0.5 é o bloco 9, offset 71972.
5. Executar `objdump -p`, `objdump -h` e `objdump -d -Mintel` nesses executáveis. Localizar RTTI das classes, suas vtables e os VAs acima. Conferir o mapeamento VA/offset pelas seções PE, nunca usando uma diferença única para todas as seções.

As constantes de PID, cabeçalho, operação AA, leitura 0x638 e multiplicação por 50 foram conferidas também por asserts nos bytes dos VAs indicados. O teste nativo posterior está registrado acima; não houve captura USB de referência do driver Windows.
