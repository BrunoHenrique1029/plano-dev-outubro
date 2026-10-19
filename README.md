# Plano Dev Autônomo Outubro

O mapa de planejamento do Dev, da Aquisição e do Conteúdo, agora como um projeto normal de site: HTML, CSS e JavaScript em arquivos separados, pronto para abrir e editar no VS Code. Com a nuvem ligada, o mapa é o mesmo em todos os aparelhos.

No ar em https://brunohenrique1029.github.io/plano-dev-outubro/

## Como abrir

**Jeito recomendado: VS Code + Live Server**

1. No VS Code, abra a pasta `plano-dev-outubro` (Arquivo > Abrir Pasta).
2. O VS Code vai sugerir as extensões recomendadas. Clique em **Instalar** (Live Server, Prettier e EditorConfig).
3. Clique em **Go Live**, na barra azul lá embaixo. O site abre no navegador em `http://127.0.0.1:5500`.
4. Cada vez que você salvar um arquivo, a página recarrega sozinha.

**Jeito rápido:** dar dois cliques no `index.html`. O endereço fica `file://...` e, nesse jeito, o site não usa a nuvem: salva só no navegador.

## Onde ficam os dados

**Com a nuvem ligada** (o `js/nuvem-config.js` preenchido, que é como está no site publicado):

- Cada pessoa entra com a conta Google. Só os e-mails liberados nas regras do Firestore veem e editam o mapa.
- **Planos, listas, agendas e relatórios** ficam no Firestore (Firebase, plano grátis Spark). O que alguém muda aparece na hora nos outros aparelhos abertos, sem recarregar.
- **Relatório aberto em dois lugares:** o que um escreve aparece no outro enquanto ele digita (a cada segundo e meio, no máximo), e o cursor de quem está lendo fica onde estava. Se duas pessoas escrevem ao mesmo tempo em partes diferentes, até no mesmo parágrafo, o texto das duas fica. Se mexerem na mesma palavra, fica a de quem ainda está digitando.
- **Sem internet** o site continua funcionando com a cópia guardada no aparelho. As mudanças sobem sozinhas quando a conexão volta.
- **Imagens e arquivos** dos relatórios vão para o Firestore em partes de 900 KB, até 10 MB cada. Cada aparelho guarda uma cópia (IndexedDB) depois de abrir.
- **"Editado por"** mostra o primeiro nome da conta Google de quem mudou.
- **Na primeira vez** que alguém entra e a nuvem está vazia, o mapa daquele navegador vai para a nuvem (ou, se ele não tiver nada, o mapa como estava no Claude, de `js/dados-iniciais.js`). A cópia antiga continua guardada no navegador.

**Sem a nuvem** (`NUVEM_CONFIG = null` ou aberto pelo `file://`): tudo fica só no navegador (localStorage e IndexedDB), como nas versões anteriores, e cada navegador tem o próprio mapa. Limpar os dados do navegador apaga o mapa.

**Modo claro ou escuro:** o botão com o ícone de lua (ou sol), no topo, troca o modo. A escolha fica guardada no navegador.

## Informativo

Para textos e instruções que todo mundo precisa ler: explicações, regras, tabelas. Crie com **+ Novo informativo** ou, para ficar ligado a um passo, com **+ Informativo** no menu do passo.

- Clique em **Editar** no cartão (ou dois cliques no texto) para escrever. O editor é o mesmo do relatório, com títulos, listas, tabelas, imagens e links.
- **Tabelas** (no informativo e no relatório): no botão **▦ Tabela**, ou digitando `/` e escolhendo Tabela, passe o mouse nos quadradinhos para escolher quantas colunas e linhas. Com o cursor numa tabela aparece a barrinha com **Linha + −**, **Coluna + −**, **Cabeçalho: Em cima / Do lado** (a primeira linha, a primeira coluna ou as duas ficam em destaque, com fundo escuro) e **Apagar tabela**, que pede um segundo clique para não apagar sem querer. Também dá para colar uma tabela copiada de outro lugar.
- No menu do informativo, **Mais largo** deixa o cartão quase com o dobro da largura, bom para tabelas grandes.
- No celular, tabelas largas rolam para o lado dentro do editor.

## Organizar

O botão **Organizar** põe os passos da esquerda para a direita, com o que está ligado a cada passo embaixo dele. Entre o grupo de um passo e o do passo seguinte fica um espaço bem maior, para ver de qual passo é cada coisa.

## Filtro por pessoa

Com o filtro em uma pessoa só (Dev, Aquisição ou Conteúdo), dá para mexer apenas nos planos, listas, agendas e informativos dela. Os outros, inclusive os de **Todos**, ficam apagados e só para ver: não dá para editar, arrastar, conectar nem apagar, e o relatório deles abre só para leitura. Para mexer em tudo, deixe o filtro em **Todos**.

## Links nos relatórios

- Clique num link para ver a barrinha com **Abrir ↗** (abre em outra aba), **Editar**, **Cartão** e **Remover**. Com Ctrl (ou Cmd no Mac) apertado, o clique já abre o link.
- **Cartão do link (banner):** cole um link sozinho numa linha vazia, ou digite `/` e escolha **Link com prévia**. O cartão mostra a imagem, o título e o nome do site.
- A prévia vem do [microlink.io](https://microlink.io), grátis até 50 links novos por dia. Se não achar a prévia, o cartão aparece só com o endereço. Vídeos do YouTube usam a capa do próprio YouTube.

## Ligar a nuvem (Firebase)

1. Crie um projeto grátis em [console.firebase.google.com](https://console.firebase.google.com) e registre um app **Web** (ícone `</>`).
2. Copie o `firebaseConfig` que aparecer para `js/nuvem-config.js`, no lugar do `null`.
3. Em **Authentication**, ative o login com **Google** e, em **Configurações > Domínios autorizados**, adicione o endereço do site (por exemplo `brunohenrique1029.github.io`). Para testar no computador com o Live Server, abra pelo endereço `http://localhost:5500`, que o Firebase já deixa liberado.
4. Crie o **Firestore Database** (edição Standard, modo de produção) e, na aba **Regras**, cole:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function permitido() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email.lower() in ['seu-email@gmail.com'];
    }
    match /{document=**} {
      allow read, write: if permitido();
    }
  }
}
```

Troque `seu-email@gmail.com` pelos e-mails liberados, em letras minúsculas e separados por vírgula. Para liberar mais alguém depois, é só mudar essa lista e clicar em **Publicar**.

Os dados do `firebaseConfig` não são senha e podem ficar no repositório público. Quem protege o mapa são as regras.

## Publicar na internet (grátis)

O site está no GitHub Pages: a cada `git push` na branch `main`, o arquivo de publicação em `.github/workflows/` publica o site de novo, sozinho. O andamento aparece na aba **Actions** do repositório.

Para publicar num repositório novo:

1. Crie um repositório **público** no GitHub e envie esta pasta para ele.
2. No repositório, vá em **Settings > Pages** e, em **Source**, escolha **GitHub Actions**. Isso é feito uma vez só.
3. O site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

**Sem GitHub:** crie uma conta grátis no Netlify, abra [app.netlify.com/drop](https://app.netlify.com/drop) e arraste esta pasta para a página.

Bom saber:

- Qualquer pessoa com o endereço abre o site, mas só vê o mapa quem entra com um e-mail liberado. No GitHub grátis, o código (com o mapa inicial de `js/dados-iniciais.js`) fica público.
- Depois de publicar uma mudança, quem está com o site aberto vê o aviso **"Saiu uma versão nova do site"** com o botão **Atualizar** (aparece ao voltar para a aba ou em até 3 minutos). Sem o botão, o navegador pode continuar com os arquivos antigos por até 10 minutos, mesmo recarregando. No PC, **Ctrl+F5** também pega a versão nova.

## Mapa dos arquivos

```
index.html              a página (só a estrutura, sem estilo nem código)
css/
  fontes.css            as fontes guardadas na pasta
  base.css              cores (modo claro e escuro), letras, cabeçalho, botões e rodapé
  mapa.css              abas, quadro, planos, listas e ramificações
  agenda.css            agenda no mapa e janela de reunião
  relatorio.css         aba do relatório e editor
  nuvem.css             tela de entrada com Google e conta no rodapé
  responsivo.css        ajustes para celular, tablet e telas grandes
js/
  tema.js               modo claro ou escuro (carrega no começo do index.html)
                        os outros carregam nesta ordem, no fim do index.html:
  servicos-locais.js    anexos guardados no navegador (imagens e arquivos dos relatórios)
  nuvem-config.js       dados do projeto no Firebase (null = sem nuvem)
  vendor/firebase.js    o Firebase (login e Firestore), já pronto
  dados-iniciais.js     o mapa como estava no Claude
  estado.js             dados do mapa, salvar e desfazer
  nuvem.js              login com Google, salvar e receber mudanças, anexos na nuvem
  planos.js             criar, conectar, organizar e apagar planos; abas de mapas
  agenda.js             reuniões e link do Google Agenda
  relatorio.js          editor do relatório, imagens, arquivos e cartões de link
  desenho.js            desenha o mapa, as setas e o zoom
  interacao.js          arrastar, pinça no celular e cliques
  inicio.js             teclado, botões e começo da página
  versao.js             avisa quando sai uma versão nova do site
assets/                 ícone e fontes (com as licenças)
ferramentas/            de onde sai o js/vendor/firebase.js (npm run vendor)
.vscode/                extensões recomendadas e formatação ao salvar
.github/workflows/      publicação automática no GitHub Pages
```

Os arquivos de `js/` são scripts comuns (não módulos), por isso o site abre até com dois cliques no `index.html`. Eles compartilham as variáveis: um arquivo pode usar as funções dos outros, e a ordem no `index.html` importa.

## O que mudou em relação ao site do Claude

- Visual e funções iguais: mapa, sub-planos, listas, agendas, relatórios, busca, desfazer, abas.
- Salvamento: antes era compartilhado pelo Claude; agora é compartilhado pelo Firebase, com login do Google.
- "Editado por": mostra o primeiro nome da conta Google de quem editou ("você" quando foi você).
- Anexos: antes ficavam no Claude; agora ficam no Firebase, até 10 MB cada.
- Modo escuro: novo, no botão do topo. O site continua abrindo no modo claro.
- Assistente (robô): não tem nesta versão. Fora do Claude ele precisaria da API da Anthropic, que é paga à parte da assinatura. Ele continua na versão do mapa dentro do Claude.
- Google Agenda: igual, os links abrem o evento já preenchido.

## Comandos (opcional, precisa do Node.js)

Nada disso é preciso para usar o site.

- `npm install`: instala as ferramentas.
- `npm run dev`: abre o site em `http://127.0.0.1:5500` sem o Live Server (mesmo endereço, então os mesmos dados).
- `npm run formatar`: arruma a formatação de todos os arquivos com o Prettier.
- `npm run vendor`: monta de novo o `js/vendor/firebase.js` (só se quiser atualizar o Firebase).
