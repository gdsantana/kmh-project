# Receber bateria e DPI no navegador

Teste em 2026-10-16, MT760 via receptor 2,4 GHz `24AE:1870`, firmware desconhecido.

## WebHID direto

1. Abrimos a PoC em `http://127.0.0.1:5174/` e usamos **Reabrir dispositivos autorizados**. Com a ACL anterior de hidraw5, a coleção `FF00/0E` abriu.
2. A função `apps/web/src/webhid-probe.ts` verificou VID/PID, abertura, coleção e report BA de 31 bytes. Instalou listener antes do envio, enviou somente a consulta fixa de bateria e observou eventos BA por três segundos, removendo o listener ao concluir.
3. `sendReport(0xBA, payload)` concluiu sem erro, mas nenhum evento BA chegou. O botão de diagnóstico permanece disponível, dentro de **Diagnóstico WebHID direto**.
4. Em seguida fizemos somente GET_REPORT(Input) nativo, sem outro Output Report. Retornou `01 01 3B`, consistente com 59% de bateria.

Evidência: [webhid-battery-probe.json](../captures/webhid-battery-probe.json). Isso demonstra o comportamento observado, sem provar que nenhum outro firmware possa publicar eventos. Não usamos Feature Reports como substituto de Input.

## Caminho que entregou os dados à página

```text
Botão Ler bateria e DPI
  → POST http://127.0.0.1:5175/api/telemetry
  → ponte Python em loopback
  → diagnóstico hidraw, consultas fixas AA e A4/0x638
  → GET_REPORT(Input), validação e decodificação
  → JSON → validação no cliente → valores na página
```

A ponte usa o diagnóstico já testado; não usa as capturas salvas para servir dados. Cada clique executa duas consultas novas. O bloco 0x660 foi excluído desse caminho porque não é necessário para bateria/DPI e suas respostas têm o mesmo tamanho do bloco de DPI.

A interface fecha os handles WebHID antes de consultar a ponte. A ponte serializa pedidos, restringe as consultas, identifica o dispositivo por VID/PID e hash do descritor, valida status/tamanho e limita cada processo a oito segundos. Decodifica o percentual, sete valores DPI, quantidade habilitada e índice atual; rejeita índice, quantidade ou bateria inválidos. As fórmulas estão em [experimento nativo](native-dpi-battery.md).

## Executar

Pré-requisitos: dependências npm instaladas, Python 3 no Linux, receptor conectado e acesso à interface hidraw correta. Não executar o navegador ou a ponte como root. A identificação e ACL temporária estão no [procedimento nativo](native-dpi-battery.md#como-repetir-no-linux).

Em dois terminais, na raiz do projeto:

```sh
npm run bridge
```

```sh
npm run dev
```

Abra `http://127.0.0.1:5174/` e clique **Ler bateria e DPI**. Não precisa usar o seletor WebHID para a leitura pela ponte. O botão pode ser usado novamente para atualizar; não há consulta automática em segundo plano. **Exportar leitura JSON** preserva os valores e respostas brutas, identificando o transporte.

A API é somente local: bind em `127.0.0.1:5175`, Host validado e Origin restrito a `http://127.0.0.1:5174`, `http://localhost:5174` e equivalentes na porta 4173 do preview. Exige POST com header `X-Rapoo-Read: 1`, sem corpo. Não há API para fornecer comandos, endereços ou payloads. A requisição CORS passa por preflight; origens não autorizadas são rejeitadas antes do hardware. A ponte permanece ativa somente enquanto o processo estiver em execução.

## Resultado e verificação

A página recebeu **59% de bateria, 1350 DPI, estágio 3 de 3**, com estágios habilitados 1000, 1200, 1350. A resposta visível no DOM foi preservada em [browser-native-reading.json](../captures/browser-native-reading.json); imagem em [browser-native-reading.png](../captures/browser-native-reading.png).

Paramos a ponte, clicamos novamente e confirmamos mensagem de indisponibilidade e remoção dos valores anteriores. Após reiniciar, uma nova leitura voltou a mostrar dados reais. Imagem do erro: [browser-bridge-unavailable.png](../captures/browser-bridge-unavailable.png).

`npm test` executa os testes TypeScript e Python: pacotes fixos, timeout, dados inválidos, decodificação das capturas do ciclo físico, falha do worker, proteção de origem/Host/payload e concorrência. `npm run build` verifica tipos e gera a aplicação.

## Limites restantes

- Caminho funcional usa uma ponte Linux; não é comunicação puramente WebHID nem suporte a outros sistemas operacionais.
- O percentual não foi comparado com a tela do software oficial; carregamento e outros firmwares continuam pendentes.
- Sem identificador de transação conhecido, respostas antigas de mesmo tamanho produzidas por outro cliente HID podem não ser reconhecidas. Manter somente um leitor ativo. A leitura é experimental e manual.
- Testamos parada/recuperação da ponte; desconexão física e ciclo completo de repouso do mouse ainda não foram exercitados nesta integração.
- Nenhuma configuração, pareamento ou firmware é alterado por esse fluxo.
