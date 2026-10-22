# RecompHub

Launcher desktop que reúne num só lugar os **ports e recompilações de jogos feitos por fãs** que você já tem instalados — Ship of Harkinian, 2 Ship 2 Harkinian, Zelda 64: Recompiled, Starship, SpaghettiKart, Super Mario 64 PC Port e outros.

Você aponta a pasta do jogo e o RecompHub:

- detecta qual projeto é;
- mostra o que falta configurar;
- ajuda a editar as configurações;
- abre o jogo e conta o tempo jogado;
- mantém tudo atualizado a partir dos GitHub Releases oficiais de cada projeto.

> **Regra legal:** o RecompHub **nunca** baixa, distribui ou embute ROMs, assets ou qualquer arquivo com direitos autorais. Ele só referencia arquivos que você já possui, e só baixa os binários publicados pelos próprios projetos, direto do repositório declarado no manifesto, via HTTPS.

## Funcionalidades

| Área                        | O que faz                                                                                                                                                                                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Biblioteca**              | Grade de cards com status (**Pronto**, **Falta configurar**, **Pasta não encontrada**), filtros e busca rápida com `Ctrl+K`.                                                                                                                                                                             |
| **Adicionar jogo**          | Você escolhe a pasta e o app detecta o projeto pelos `detectFiles` do manifesto, inclusive em subpastas, ou deixa você escolher manualmente.                                                                                                                                                             |
| **Checklist**               | Requisitos do manifesto com ✓/✗ e ações: selecionar a sua ROM (validada por tamanho ou SHA-1), copiá-la para a pasta, abrir a pasta, abrir o jogo pela primeira vez e ver instruções.                                                                                                                    |
| **Editor de configs**       | Arquivos JSON, INI e texto, editáveis em formulário ou como texto. Valida antes de salvar, faz backup automático e permite restaurar.                                                                                                                                                                    |
| **Jogar**                   | Executa o binário com `cwd` na pasta do jogo, mais os `launchArgs` e `launchEnv` do manifesto. Registra o último acesso e o tempo jogado.                                                                                                                                                                |
| **Atualizações dos jogos**  | Consulta os GitHub Releases ao abrir e a cada 3 h, usando ETag. Mostra badge e notificação. O download tem progresso e cancelamento; o app confere tamanho e checksum, faz backup, extrai zip/7z/tar.gz e respeita `preserve`. Se algo falhar, restaura sozinho. Inclui **Voltar para versão anterior**. |
| **Downloads**               | Atualizações em andamento, disponíveis e concluídas na sessão. O progresso também aparece na barra lateral.                                                                                                                                                                                              |
| **Atualização do launcher** | `electron-updater` com os releases deste repositório. Um botão azul aparece acima do avatar quando há versão nova. Depois de atualizar, o popup "Novidades da vX.Y.Z" mostra o CHANGELOG.                                                                                                                |
| **Configurações**           | Tema escuro, claro ou do sistema; idioma (PT-BR padrão, EN); nome do perfil; token do GitHub; atualização automática por jogo; reescanear pastas.                                                                                                                                                        |

## Requisitos

- Node.js **22.12 ou mais recente** e npm.
- Windows 10/11 (prioridade) ou Linux.

## Como rodar

```bash
npm install
npm run dev
```

`npm run dev` abre o app com recarregamento automático da interface.

Outros scripts:

| Script               | Para quê                                                                 |
| -------------------- | ------------------------------------------------------------------------ |
| `npm test`           | Testes unitários (Vitest).                                               |
| `npm run typecheck`  | Checagem de tipos do processo principal e da interface.                  |
| `npm run build`      | Typecheck + build de produção em `out/`.                                 |
| `npm start`          | Abre o build de produção sem empacotar.                                  |
| `npm run dist`       | Gera o **instalador do Windows** em `dist/RecompHub-Setup-<versão>.exe`. |
| `npm run dist:linux` | Gera um AppImage para Linux.                                             |
| `npm run dist:dir`   | Empacota sem instalador (útil para testar).                              |
| `npm run icon`       | Regenera `build/icon.png`.                                               |

Para testar o botão de atualização do launcher em desenvolvimento, rode com `RECOMPHUB_FAKE_UPDATE=1`. No PowerShell é `$env:RECOMPHUB_FAKE_UPDATE=1; npm run dev`. Isso simula um ciclo "disponível → baixando → pronto".

### Gerando o instalador do Windows

Rode `npm run dist` **no Windows**. O resultado é um instalador NSIS em `dist/`, que deixa escolher a pasta e cria atalhos.

Também dá para gerar a partir do Linux, mas o electron-builder precisa do **Wine**, incluindo o de 32 bits (`wine32`), para montar o instalador NSIS.

O app não é assinado digitalmente; o Windows SmartScreen pode avisar na primeira execução.

## Publicando uma nova versão do launcher

As notas de cada release vêm do `CHANGELOG.md`. É a mesma fonte usada no popup de novidades do app.

1. Adicione uma seção `## [x.y.z] - AAAA-MM-DD` no `CHANGELOG.md` com as subseções `### Novidades`, `### Melhorias` e `### Correções`.
2. Atualize `version` no `package.json`.
3. Crie e envie a tag:

   ```bash
   git tag vx.y.z
   git push origin vx.y.z
   ```

   O workflow `.github/workflows/release.yml` roda os testes, gera as notas (`npm run release-notes`) e publica o instalador e o `latest.yml` no GitHub Releases.

Para publicar manualmente, use `GH_TOKEN=<token> npm run release`.

Os apps instalados checam os releases ao abrir e a cada 3 horas, baixam em segundo plano e instalam quando você clica no botão azul ou ao fechar o app.

## Como criar um manifesto novo

Cada projeto suportado é descrito por um arquivo `manifests/<id>.json`. **Adicionar um jogo = adicionar um manifesto, sem mexer no código.** O nome do arquivo precisa ser igual ao `id`.

Os manifestos embutidos ficam em `manifests/`. Você também pode colocar arquivos na pasta de manifestos do usuário (em **Configurações → Abrir pasta de manifestos**). Um manifesto do usuário com o mesmo `id` substitui o embutido. Use **Reescanear pastas** para recarregar sem reiniciar.

```jsonc
{
  "id": "soh", // letras minúsculas, números, "-" e "_"
  "name": "Ship of Harkinian",
  "originalGame": "The Legend of Zelda: Ocarina of Time",
  "description": "Texto curto exibido na aba Sobre.",
  "repoUrl": "https://github.com/HarbourMasters/Shipwright",
  "website": "https://www.shipofharkinian.com", // opcional
  "accentColor": "#3f8f4a", // cor da capa gerada (opcional)

  "executables": { "win32": ["soh.exe"], "linux": ["soh.appimage"] },
  "detectFiles": ["soh.exe", "soh.appimage", "soh.o2r"],

  "requirements": [
    { "id": "port-data", "type": "file", "label": "Arquivo de dados do port", "patterns": ["soh.o2r"], "helpText": "Vem junto com o download do port." },
    {
      "id": "rom",
      "type": "userFile",
      "label": "Sua ROM",
      "optional": true,
      "extensions": ["z64", "n64", "v64"],
      "copyToGameDir": true,
      "validation": { "sizes": [33554432], "sha1": [{ "sha1": "ad69c911…", "label": "NTSC 1.0 (US)" }] }
    },
    {
      "id": "rom-assets",
      "type": "firstRun",
      "label": "Gerar os assets a partir da sua ROM",
      "doneWhen": ["oot.o2r", "oot-mq.o2r"],
      "helpText": "Abra o jogo uma vez…"
    }
  ],

  "configFiles": [
    { "path": "shipofharkinian.json", "format": "json", "label": "Configurações" },
    { "path": { "win32": ["general.json", "{localAppData}/Jogo/general.json"] }, "format": "json" }
  ],

  "launchArgs": [],
  "launchEnv": { "linux": { "SHIP_HOME": "{gameDir}" } },

  "updates": {
    "source": "github-releases",
    "repo": "HarbourMasters/Shipwright",
    "assetPatterns": { "win32": "*Win64*.zip", "linux": ["*.appimage", "*Linux*.zip"] },
    "includePrereleases": false,
    "preserve": ["oot.o2r", "oot-mq.o2r", "Save/**", "shipofharkinian.json", "mods/**", "imgui.ini"]
  },

  "_todo": "Qualquer chave que começa com _ é ignorada; use para anotar o que falta confirmar."
}
```

### Referência dos campos

**`executables`** e **`detectFiles`**

- Nomes ou globs relativos à pasta do jogo, sem diferenciar maiúsculas de minúsculas.
- `executables` é por plataforma (`win32`, `linux`, `darwin`).
- Na detecção, ganha o manifesto com a maior proporção de `detectFiles` encontrados.

**`requirements`** — três tipos:

- `file`: algum dos `patterns` precisa existir.
  - Os padrões são relativos à pasta do jogo.
  - Também aceitam caminhos absolutos com variáveis, como `{localAppData}/Jogo/arquivo.bin`.
- `userFile`: o usuário seleciona um arquivo dele (ex.: a ROM).
  - Pode ser validado por `sizes` e/ou `sha1`.
  - Com `copyToGameDir`, o app oferece copiar o arquivo para a pasta do jogo (cópia local).
- `firstRun`: instrução para abrir o jogo uma vez.
  - Com `doneWhen`, fica ✓ quando algum desses arquivos existir.
  - Sem `doneWhen`, fica ✓ depois do primeiro lançamento pelo launcher ou ao marcar manualmente.
- Todos aceitam `optional`, `helpText` (markdown) e `id`. O `id` é recomendado, porque é a chave das escolhas salvas.

**`configFiles`**

- `format` pode ser `json`, `ini` ou `text`.
- `path` pode ser um texto, uma lista de candidatos (o primeiro que existir é usado) ou um objeto por plataforma.
- Variáveis disponíveis:

| Variável         | Windows          | Linux            |
| ---------------- | ---------------- | ---------------- |
| `{gameDir}`      | pasta do jogo    | pasta do jogo    |
| `{appData}`      | `%APPDATA%`      | `~/.config`      |
| `{localAppData}` | `%LOCALAPPDATA%` | `~/.local/share` |
| `{home}`         | pasta do usuário | pasta do usuário |
| `{documents}`    | Documentos       | `~/Documents`    |

**`launchArgs`** e **`launchEnv`**

- Argumentos e variáveis de ambiente, opcionalmente por plataforma.
- Os valores aceitam as variáveis acima.

**`updates`**

- `{ "source": "none" }` para projetos sem binários publicados; o app mostra só o link do repositório.
- `{ "source": "github-releases", … }` para projetos que publicam releases:
  - `assetPatterns`: globs por plataforma, testados em ordem.
    - Se nenhum casar, o app avisa e não baixa nada.
    - Se o asset for um binário solto (AppImage/exe), ele é salvo com o nome do primeiro executável da plataforma.
  - `includePrereleases`: usa a lista de releases em vez de `/releases/latest`.
  - `preserve`: o que **nunca é sobrescrito** na atualização.
    - Padrão sem `/` casa pelo nome do arquivo em qualquer pasta (ex.: `imgui.ini`, `*.sav`).
    - Padrão com `/` é relativo à raiz (ex.: `Save/**`, `mods/`).
    - Arquivos preservados que ainda não existem são criados normalmente.

> Liste em `preserve` só os arquivos do **usuário**: saves, configs, mods e assets gerados da ROM.
>
> Não use curingas que peguem arquivos do próprio port. Exemplo: no Ship of Harkinian, `soh.o2r` é do port e **precisa** ser atualizado, então preserve `oot.o2r` e `oot-mq.o2r`, e não `*.o2r`.

## Como funciona a atualização de um jogo

1. **Escolha do asset:** o app pega o arquivo do release com o `assetPatterns` da plataforma.
2. **Origem:** confere se a URL é `https://github.com/<repo do manifesto>/releases/download/…`. Redirecionamentos só são aceitos para a CDN de releases do GitHub.
3. **Download:** baixa para uma pasta temporária, com progresso e cancelamento.
4. **Integridade:**
   - confere o tamanho;
   - confere o SHA-256, vindo do campo `digest` da API ou de um arquivo de checksums do release, quando existir.
5. **Extração:** extrai zip, 7z ou tar.gz.
   - Se o pacote tem uma pasta raiz única, ela vira a raiz.
   - Se tem outro pacote dentro (ex.: um `.tar.gz` dentro do `.zip`), ele também é extraído.
6. **Jogo aberto:** se o jogo estiver rodando, o app pede para fechar.
7. **Backup:** cria `backups/<id>/<versão>/backup.zip` nos dados do app e mantém os 2 mais recentes.
8. **Cópia:** copia os arquivos novos por cima, pulando o que casar com `preserve`. Cada arquivo é registrado antes de ser escrito.
9. **Falha:** se algo der errado, os arquivos novos são removidos e os alterados voltam do backup automaticamente.
10. **Voltar para versão anterior:**
    - restaura o último backup sem sobrescrever saves e configs;
    - remove os arquivos que a atualização tinha adicionado.

A **versão instalada** é a tag do release. Para jogos adicionados manualmente ela começa como "desconhecida": informe-a na aba Atualizações, ou marque que já tem a mais recente.

### Limite da API do GitHub

Sem login, a API permite 60 consultas por hora. O app usa ETag (`If-None-Match`), e respostas `304` não contam no limite.

Para mais folga, cole um **token pessoal do GitHub** em Configurações. Ele não precisa de nenhuma permissão especial e fica cifrado com o cofre do sistema (DPAPI no Windows).

## Estrutura do projeto

```
manifests/            Manifestos dos jogos suportados
src/shared/           Lógica pura e tipos:
                        esquema de manifesto (zod)
                        versões
                        globs, preserve e checksums
                        devlog
                        formulários de config
src/main/             Processo principal do Electron:
                        store (electron-store) e IPC
                        detecção e requisitos
                        launcher
                        cliente GitHub com ETag
                        atualização, extração e backup
                        electron-updater
src/preload/          Ponte segura (contextIsolation + sandbox) que expõe window.api
src/renderer/         Interface React + Tailwind
tests/                Testes Vitest:
                        parser de manifestos
                        detecção
                        escolha de asset
                        versões
                        preserve, backup e rollback com zip falso
                        fluxo de atualização
                        devlog uma vez por versão
                        cliente GitHub
                        editor de configs
scripts/              Geração do ícone e das notas de release
```

Os dados do app ficam na pasta de dados do usuário: `%APPDATA%\RecompHub` no Windows e `~/.config/RecompHub` no Linux. Lá estão:

- `recomphub.json`: biblioteca, configurações e cache;
- `backups/`;
- `config-backups/`;
- `covers/`;
- `manifests/`.

## Créditos

Os jogos e projetos listados pertencem aos seus respectivos autores e comunidades. O RecompHub é um launcher independente e não é afiliado a nenhum deles. As fontes Geist e Geist Mono são distribuídas sob a SIL Open Font License.
