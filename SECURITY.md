# Política de segurança

## Versões com suporte

Só a versão mais recente do RecompHub recebe correções de segurança. O launcher se atualiza sozinho; mantenha a atualização automática ligada.

## Como reportar uma vulnerabilidade

**Não abra uma issue pública.** Reporte em privado para [@Silvamenu](https://github.com/Silvamenu):

- pela aba **Security → Report a vulnerability** do repositório, quando ela estiver disponível; ou
- por mensagem privada no GitHub.

Inclua o que for possível: versão do RecompHub, sistema operacional, passos para reproduzir e o impacto esperado. Você recebe uma resposta em até 7 dias.

## O que nos interessa

- Download ou execução de arquivos de origem diferente do repositório declarado no manifesto.
- Escrita ou leitura de arquivos fora da pasta do jogo ou da pasta de dados do app (path traversal, "zip slip", links simbólicos em pacotes).
- Execução de código a partir de manifestos, pacotes de atualização, notas de release ou arquivos de configuração.
- Vazamento do token do GitHub salvo nas configurações.
- Falhas na verificação de integridade (tamanho/SHA-256) ou no rollback automático.

## Como o app se protege

- Interface isolada do sistema: `contextIsolation`, `sandbox` e `nodeIntegration: false`, com uma API mínima exposta pelo preload e validação dos parâmetros no processo principal.
- CSP restritiva no build de produção; links externos só abrem no navegador e só via HTTPS.
- Downloads apenas de `https://github.com/<repo do manifesto>/releases/download/…`, com redirecionamento restrito à CDN do GitHub, conferência de tamanho e de SHA-256 quando o release publica o hash.
- Extração protegida contra caminhos fora do destino, backup antes de atualizar e restauração automática em caso de falha.
- Token do GitHub cifrado com o cofre do sistema (DPAPI no Windows) e nunca devolvido à interface.
- No repositório: dependências atualizadas pelo Dependabot, `npm audit` no CI, varredura de segredos (gitleaks) e de workflows (zizmor), Actions fixadas por SHA e permissões mínimas nos workflows.
