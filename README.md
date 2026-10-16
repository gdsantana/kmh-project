# Rapoo MT760 · WebHID inspector

PoC local, somente leitura, para inspecionar interfaces WebHID e receber bateria/DPI por uma ponte Python Linux. React + TypeScript + Vite em um workspace npm. Sem conta, serviço externo ou comandos de gravação de configuração.

**Para continuar em outra sessão:** leia o [registro de retomada de bateria e DPI](docs/retomada-dpi-bateria.md), com o processo de descoberta, execução, arquivos relevantes, evidências e pendências.

## Executar

Node.js **22.18+**, ou uma versão mais recente compatível com o Vite 8, e npm. Validado neste ambiente com Node 26.5.0 e npm 11.17.0.

```sh
npm ci
npm run dev
```

Abra **http://127.0.0.1:5174/** no Chrome/Chromium para desktop. A porta 5174 evita o serviço de outro projeto encontrado na 5173. O servidor aceita apenas conexões locais.

1. Clique em **Selecionar dispositivo** e escolha o Rapoo ou seu receptor no seletor do navegador.
2. Confira nome, VID/PID, coleções e relatórios. Desmarque o filtro Rapoo se o dispositivo não aparecer.
3. Procure **Interface aberta** em uma coleção do fabricante. O seletor pode retornar vários handles do mesmo dispositivo; alguns podem ser protegidos e falhar independentemente dos demais.
4. Para repetir a inspeção sem um novo seletor, use **Reabrir dispositivos autorizados**.
5. Use **Exportar evidência JSON** para guardar os descritores e o resultado da abertura.
6. Use **Encerrar conexão** para fechar os handles. A permissão do site pode ser revogada nas configurações do navegador.

Coleções padrão de mouse e teclado podem ser protegidas. Uma coleção visível não comprova suporte a configuração. O inspetor não envia comandos; o diagnóstico WebHID separado envia apenas a consulta fixa de bateria. A leitura funcional de bateria e DPI usa a ponte local descrita abaixo; firmware não é lido.

## Linux: dispositivo visível, mas abertura negada

O usuário do navegador precisa de leitura/escrita no nó hidraw da interface; a permissão concedida pelo navegador não substitui a do sistema. Não execute o navegador como root.

Na inspeção inicial, o Rapoo `24ae:1870` tinha a coleção do fabricante `0xff01` na interface USB 2, em `/dev/hidraw6`, com modo `0600 root:root`. Esses números podem mudar após reconectar.

Para reproduzir a identificação, sem comandos HID:

```sh
lsusb -d 24ae:1870
cat /sys/bus/hid/devices/*24AE:1870*/uevent
ls -l /dev/hidraw*
```

Após confirmar que o nó ainda corresponde ao Rapoo, uma liberação temporária e específica para o usuário atual é:

```sh
sudo setfacl -m "u:$(id -un):rw" /dev/hidraw6
```

Essa alteração permite que processos desse usuário abram a interface, inclusive para operações de escrita; o aplicativo desta PoC não as implementa. Clique novamente em **Selecionar dispositivo**. A liberação normalmente termina ao desconectar o dispositivo. Para revogar sem desconectar:

```sh
sudo setfacl -x "u:$(id -un)" /dev/hidraw6
```

Não use `chmod 666` nem regras abrangentes para todos os dispositivos HID. Se for necessária configuração permanente, prepare uma regra udev específica após confirmar variante e interface; a PoC não instala regras nem altera permissões automaticamente.

## Validar

```sh
npm test
npm run build
npm run preview -w @rapoo/web
```

O preview fica em http://127.0.0.1:4173/. Testes usam descritores sintéticos e handles simulados; não substituem o teste físico. O build também verifica tipos. Os comprimentos mostrados são do payload, sem o byte de Report ID.

## Estrutura

- `apps/web`: interface e fluxo do experimento.
- `packages/core`: modelo de evidência e resumos dos descritores.
- `packages/transport-webhid`: descoberta, abertura, inspeção e fechamento.
- `packages/device-definitions`: identidade observada, sem alegar compatibilidade de protocolo.
- `packages/protocol-rapoo`: reservado e documentado; sem comandos até existir evidência.
- `research`: identificação física, pesquisa e protocolo de experimentos.
- `docs`: arquitetura, compatibilidade, protocolo e histórico.
- `tests`: testes do transporte e transformação dos descritores.

Há um diagnóstico nativo reutilizado pela ponte local de leitura. Objetivos e limites completos: [HANDOFF.MD](HANDOFF.MD).

## Resultado verificado

PoC validada no dispositivo físico `24AE:1870`: nome e descritores exibidos pelo navegador, coleção do fabricante `0xFF01` aberta depois da permissão específica em hidraw6. Fechamento e reabertura também confirmados. As outras duas interfaces tiveram abertura negada nessa captura inicial.

Evidência exportada pela própria aplicação: [JSON real](research/captures/rapoo-24ae-1870-webhid-open.json). Captura: [interface aberta](research/captures/webhid-interface-open.png). Gravação de configurações permanece não verificada.

## Leitura direta de DPI e bateria

O experimento Linux posterior, após permissão específica na interface `FF00/0E` (hidraw5 no teste), obteve bateria informada de **59%** e três estágios habilitados: **1000, 1200, 1350 DPI**. Três toques físicos confirmaram o ciclo `1350 → 1000 → 1200 → 1350`, restaurando o estado original.

**Esses dados agora chegam à página por uma ponte local Linux.** Em outro terminal, execute `npm run bridge`, mantenha `npm run dev` ativo e clique **Ler bateria e DPI** em `http://127.0.0.1:5174/`. Requer Python 3 e permissão hidraw; não precisa de um novo seletor WebHID. A atualização é manual, e falhas removem os valores anteriores da tela. A ponte escuta somente em `127.0.0.1:5175` e aceita apenas as consultas fixas de leitura vindas das origens locais permitidas.

O teste WebHID enviou a consulta sem erro, mas não recebeu evento BA em três segundos. A resposta veio por GET_REPORT(Input) nativo, justificando a ponte. Isso não altera a configuração do mouse.

- [Processo completo e comandos para repetir](research/experiments/native-dpi-battery.md): identificação, ACL, pacotes, fórmulas, testes físicos e limitações.
- [Como descobrimos o protocolo no driver oficial](research/software-analysis/dpi-battery.md): fontes, hashes, extração, rotinas e distinção entre hipóteses e resultados.
- [Índice das evidências](research/captures/README.md): respostas brutas, transições, restauração e tentativa inválida.
- [Script de diagnóstico](research/experiments/read-mt760.py): somente biblioteca padrão Python, consultas fixas e self-test.
- [Integração no navegador](research/experiments/browser-telemetry.md): teste WebHID, ponte, execução, evidências e limites.

Leitura na página via ponte confirmada; WebHID puro não recebeu resposta no teste realizado. Comparação com a tela do software oficial e compatibilidade com outros firmwares continuam pendentes. O diagnóstico é experimental e ainda não resolve respostas antigas de mesmo tamanho.
