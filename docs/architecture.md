# Arquitetura da PoC

A aplicação web é local. O navegador controla a seleção e a permissão WebHID para inspecionar descritores. A leitura de bateria/DPI usa uma ponte Python opcional restrita a loopback, após o teste direto não receber evento de resposta.

```text
apps/web (React / TypeScript / Vite)
  ├── @rapoo/transport-webhid → navigator.hid → mouse/receptor
  ├── @rapoo/core → snapshots serializáveis e resumos
  └── @rapoo/device-definitions → observações verificadas no host

apps/web/src/local-reader.ts → POST loopback :5175
  → apps/bridge/server.py → diagnóstico Python → hidraw → receptor

packages/protocol-rapoo → reservado, sem implementação
```

O modelo em core não depende de React ou da API WebHID. O transporte copia descritores para esse modelo e tenta abrir cada handle separadamente, preservando descritores e erro se a abertura falhar. Cada handle pode conter várias coleções. Tamanho do payload é a soma dos bits dos itens, arredondada para bytes, sem Report ID; campos ausentes permanecem desconhecidos.

A UI dispara o seletor diretamente no gesto do usuário, mostra o resultado individual, acompanha desconexões e fecha os handles ao encerrar ou sair da página. O JSON inclui contexto do navegador, horário da inspeção, estado exportado, erros e coleções. A exportação também pode incluir a leitura nativa e seus bytes brutos, identificando a fonte. Nenhum dado é enviado a serviço externo.

Os pacotes são privados, com exports para fontes TypeScript consumidas pelo Vite. Não há builds separados de biblioteca ou framework de monorepo. `npm run build` verifica tipos de toda a árvore e gera `apps/web/dist`.

O painel e a ponte HTTP não expõem gravação de configuração. Há um script separado de teste e restauração da tabela DPI, com persistência após ciclo de energia observada neste conjunto; ver [experimento de escrita](../research/experiments/write-dpi.md). O experimento de leitura é isolado em `research/experiments/read-mt760.py`, reutilizado pela ponte em subprocessos com timeout. A ponte aceita somente três consultas fixas (bateria, DPI e polling rate) e valida respostas antes de decodificar. O cliente valida o JSON, remove dados anteriores ao iniciar cada leitura e mostra erro se a ponte falhar. Não há atualização automática. A leitura de polling rate usa o campo wireless do bloco 0x630 e confere sua região comum com o bloco DPI; códigos desconhecidos não recebem uma taxa presumida. Os handles WebHID são fechados antes da leitura nativa e há um lock na ponte para evitar pedidos concorrentes.

A ponte usa bind `127.0.0.1`, valida Host e Origin, exige POST com header próprio e não aceita payloads arbitrários. Limites, execução e evidências: [leitura no navegador](../research/experiments/browser-telemetry.md). Respostas antigas de mesmo tamanho ainda não têm correlação de transação; manter o fluxo experimental e somente um leitor HID ativo.
