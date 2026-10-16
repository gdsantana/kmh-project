# ClickSync — pesquisa inicial

Fontes consultadas em 2026-10-15:

- [Repositório e README](https://github.com/Nuitfanee/ClickSync).
- [Runtime de descoberta](https://github.com/Nuitfanee/ClickSync/blob/main/src/core/device_runtime.js).
- [Licença](https://github.com/Nuitfanee/ClickSync/blob/main/LICENSE).
- [Workbench existente](https://github.com/Nuitfanee/ClickSync/blob/main/tools/WebHID_Workbench.js).

O projeto separa a descoberta do dispositivo do carregamento de protocolos e das operações de configuração. O README declara reconhecimento Rapoo por VID `0x24AE` e coleção `0xFF00`, usage 14/15, para determinados modelos; isso não confirma suporte ao MT760 ou ao PID observado aqui.

A licença consultada é GPL-2.0. Nenhum código foi copiado ou adaptado; a PoC usa diretamente a API WebHID e permanece sob a licença existente do repositório. O workbench está disponível no caminho indicado, mas ainda não foi adotado ou auditado integralmente.

Próximo estudo: comparar assinaturas de interfaces com as capturas do hardware exato antes de investigar o protocolo de configuração.

Referências de API:

- [Especificação WebHID](https://wicg.github.io/webhid/): permissão, contexto seguro, coleções e relatórios.
- [Rapoo Web HUB](https://hub.rapoo.cn/): página localizada; suporte ao MT760 não testado.

A análise dos binários oficiais, download/inventário do driver e REA ficam para a fase de investigação do protocolo, após a prova de acesso.
