# Política de segurança

## Versões com suporte

Só a versão mais recente do Relaunch recebe correções de segurança. O launcher se atualiza sozinho; mantenha a atualização automática ligada.

## Como reportar uma vulnerabilidade

**Não abra uma issue pública.** Reporte em privado para [@Silvamenu](https://github.com/Silvamenu):

- pelo [relato privado de vulnerabilidades](https://github.com/Silvamenu/Relaunch/security/advisories/new) (aba **Security → Report a vulnerability**), o caminho preferido; ou
- por mensagem privada no GitHub.

Inclua o que for possível: versão do Relaunch, sistema operacional, passos para reproduzir e o impacto esperado. Você recebe uma resposta em até 7 dias.

## O que nos interessa

- Download ou execução de arquivos de origem diferente do repositório declarado no manifesto.
- Escrita ou leitura de arquivos fora da pasta do jogo ou da pasta de dados do app (path traversal, "zip slip", links simbólicos em pacotes).
- Execução de código a partir de manifestos, pacotes de atualização, notas de release ou arquivos de configuração.
- Vazamento do token do GitHub salvo nas configurações.
- Falhas na verificação de integridade (tamanho/SHA-256) ou no rollback automático.

## Como o app se protege

- Interface isolada do sistema: `contextIsolation`, `sandbox` e `nodeIntegration: false`, servida por um protocolo próprio (`app://`, sem os privilégios de `file://`), com uma API mínima exposta pelo preload e validação dos parâmetros no processo principal. Pastas de jogo só entram pelo diálogo de escolha do sistema.
- CSP restritiva no build de produção (nega tudo por padrão; imagens remotas só do GitHub) e permissões do navegador (câmera, notificações etc.) negadas; links externos só abrem no navegador e só via HTTPS.
- Downloads apenas de `https://github.com/<repo do manifesto>/releases/download/…`, com redirecionamento restrito à CDN do GitHub, conferência de tamanho e de SHA-256 quando o release publica o hash.
- Extração e atualização protegidas contra caminhos fora do destino e links simbólicos, com limite de tamanho; manifestos não aceitam caminhos absolutos ou `..`. Backup antes de atualizar e restauração automática em caso de falha.
- Instalação pelo botão **Baixar**: mesma origem e mesmas verificações das atualizações, numa pasta nova que precisa estar vazia; se não terminar, o jogo sai da biblioteca e a pasta vazia é apagada.
- Instalação pelo link de um repositório: o endereço só é aceito se for de `github.com` (sem usuário, senha ou porta) e apenas identifica o repositório; o app consulta a API e baixa só dos releases desse repositório, via HTTPS, com as mesmas verificações. O manifesto gerado fica na pasta de manifestos do usuário, e o executável escolhido manualmente precisa estar dentro da pasta do jogo.
- Jogos via emulador: o app instala só o emulador, do repositório oficial dele. O jogo é sempre um arquivo do próprio usuário, escolhido no diálogo do sistema; o app nunca baixa jogos. O caminho do arquivo vai ao emulador como argumento (sem shell).
- Capa e banner: só imagens PNG, JPEG, GIF ou WebP de até 20 MB, conferidas pelo conteúdo (não pelo nome); a cópia fica na pasta de dados e a interface só a lê pelo protocolo `rl-cover://`, que aceita apenas o id do jogo.
- Perfis locais: o PIN de 4 dígitos fica só como hash scrypt com sal, nunca em texto, e cada PIN errado espera meio segundo antes da resposta. Ele evita entrar no perfil errado, mas não cifra os dados do app. Arquivos `.relaunch` importados são validados (formato e tamanho) antes de virar perfil.
- Token do GitHub cifrado com o cofre do sistema quando disponível (DPAPI no Windows; no Linux sem chaveiro fica em texto puro na pasta de dados) e nunca devolvido à interface.
- Releases do launcher são criados como rascunho, só a partir de commits da `main`, e publicados manualmente depois de conferidos.
- No repositório: `main` protegida (só via PR, com as verificações passando), CodeQL, revisão de dependências nos PRs, dependências atualizadas pelo Dependabot, `npm audit` no CI, varredura de segredos (gitleaks) e de workflows (zizmor), Actions fixadas por SHA e permissões mínimas nos workflows.
