# Capturas

- `rapoo-24ae-1870-webhid-open.json`: exportado pela PoC durante acesso físico real. Uma interface aberta, duas negadas. Inclui descritores, erros, horários e navegador; não contém tráfego ou comandos de configuração.
- `webhid-interface-open.png`: captura do navegador mostrando a coleção `0xFF01` aberta.
- `mt760-native-baseline.json`: duas sequências idênticas de leitura nativa de bateria e DPI, após ACL em hidraw5.
- `mt760-native-dpi-button.json`, `mt760-native-dpi-button-2.json`: leituras após dois toques físicos separados no botão DPI. Índices `2 → 0 → 1`, valores `1350 → 1000 → 1200`; somente o byte 20 da resposta de 0x638 mudou. Bateria permaneceu em 59%.
- `mt760-native-restored.json`: após o terceiro toque, índice 2 e 1350 DPI restaurados; todas as respostas idênticas à referência inicial.
- `mt760-native-delayed-response.json`: tentativa inválida, preservada para investigar erro/atraso; não foi interpretada como DPI ou bateria atuais.
- `webhid-battery-probe.json`: consulta enviada pelo WebHID sem evento BA durante três segundos; GET_INPUT nativo posterior recebeu bateria, sem novo Output Report.
- `browser-native-reading.json`, `browser-native-reading.png`: resposta real entregue pela ponte e exibida no navegador, 59% e 1350 DPI.
- `browser-bridge-unavailable.png`: indisponibilidade da ponte exibida na página, sem manter os valores anteriores como atuais.

Descritores sysfs independentes estão em `../device-identification/rapoo-24ae-1870-sysfs.json`. Até agora nenhum comando de configuração foi observado.
