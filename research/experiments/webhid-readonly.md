# Experimento: acesso WebHID sem comandos

Objetivo: mostrar informações reais do dispositivo pelo navegador e verificar abertura de uma interface do fabricante.

1. Registrar variante na etiqueta, conexão física e firmware se disponível; manter desconhecidos até comprovar.
2. Executar a PoC e autorizar o Rapoo pelo seletor.
3. Registrar nome, VID/PID, usage pages, reports e resultado individual da abertura.
4. Se o Linux negar acesso, identificar o nó correto por sysfs e confirmar permissões; liberação temporária específica descrita no README.
5. Repetir a seleção depois da correção. Não alterar comandos ou flags de proteção do navegador.
6. Exportar JSON e guardar em `research/captures/`, anotando navegador e conexão.
7. Encerrar a conexão e repetir para verificar que o handle é liberado. Desconectar/reconectar e conferir a mensagem.

Critérios independentes:

- Informação: nome, VID/PID e descritores reais exibidos pelo navegador.
- Acesso: pelo menos um handle da coleção do fabricante abre sem erro.
- Configuração: fora deste experimento; nenhum protocolo é comprovado por abrir o handle.

Resultado: informação e abertura confirmadas para `24AE:1870`. A primeira tentativa falhou por permissão insuficiente; após ACL específica em hidraw6, o handle da coleção `0xFF01` abriu. Fechamento e reabertura foram verificados. JSON e screenshot estão em `research/captures/`. A desconexão física/reconexão do cabo não foi realizada neste teste.
