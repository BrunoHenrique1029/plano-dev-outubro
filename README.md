# Plano Dev Autônomo Outubro

O mapa de planejamento do Dev, da Aquisição e do Conteúdo, agora como um projeto normal de site: HTML, CSS e JavaScript em arquivos separados, pronto para abrir e editar no VS Code. Funciona sem internet.

No ar em https://brunohenrique1029.github.io/plano-dev-outubro/

## Como abrir

**Jeito recomendado: VS Code + Live Server**

1. No VS Code, abra a pasta `plano-dev-outubro` (Arquivo > Abrir Pasta).
2. O VS Code vai sugerir as extensões recomendadas. Clique em **Instalar** (Live Server, Prettier e EditorConfig).
3. Clique em **Go Live**, na barra azul lá embaixo. O site abre no navegador em `http://127.0.0.1:5500`.
4. Cada vez que você salvar um arquivo, a página recarrega sozinha.

**Jeito rápido:** dar dois cliques no `index.html`. Tudo funciona, mas o endereço fica `file://...`.

> Os dados ficam guardados no navegador **por endereço**. O que você fizer em `http://127.0.0.1:5500` não aparece em `file://...` e vice-versa. Escolha um jeito e use sempre o mesmo. Para passar de um para o outro, use "Baixar cópia" e "Restaurar cópia".

## Onde ficam os dados

- **Planos, listas, agendas e relatórios:** no navegador (localStorage), salvos sozinhos a cada mudança.
- **Imagens e arquivos dos relatórios:** no navegador também (IndexedDB), até 20 MB cada.
- **Na primeira vez** que o site abre num navegador, o mapa começa como estava no site do Claude (`js/dados-iniciais.js`).
- **Baixar cópia** (no rodapé) gera um arquivo `.json` com tudo, inclusive as imagens e os arquivos. **Restaurar cópia** coloca esse arquivo de volta, em qualquer navegador ou computador. Faça cópias de vez em quando: limpar os dados do navegador apaga o mapa.

Não tem login nem salvamento compartilhado: cada pessoa tem o próprio mapa no próprio navegador. Para as três pessoas mexerem no mesmo mapa ao mesmo tempo, seria preciso um servidor (por exemplo Firebase ou Supabase).

## Publicar na internet (grátis)

O site está no GitHub Pages: a cada `git push` na branch `main`, o arquivo de publicação em `.github/workflows/` publica o site de novo, sozinho. O andamento aparece na aba **Actions** do repositório.

Para publicar num repositório novo:

1. Crie um repositório **público** no GitHub e envie esta pasta para ele.
2. No repositório, vá em **Settings > Pages** e, em **Source**, escolha **GitHub Actions**. Isso é feito uma vez só.
3. O site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

**Sem GitHub:** crie uma conta grátis no Netlify, abra [app.netlify.com/drop](https://app.netlify.com/drop) e arraste esta pasta para a página.

Bom saber:

- Qualquer pessoa com o endereço abre o site. No GitHub grátis, o código (com o mapa inicial de `js/dados-iniciais.js`) também fica público.
- Cada pessoa que abre o site tem o próprio mapa, salvo no navegador dela. Para passar o mapa para alguém, use "Baixar cópia" e "Restaurar cópia".
- O endereço da internet é outro endereço: o que está salvo no `127.0.0.1:5500` não aparece lá. Use "Baixar cópia" aqui e "Restaurar cópia" lá.

## Mapa dos arquivos

```
index.html              a página (só a estrutura, sem estilo nem código)
css/
  fontes.css            as fontes guardadas na pasta
  base.css              cores, letras, cabeçalho, botões e rodapé
  mapa.css              abas, quadro, planos, listas e ramificações
  agenda.css            agenda no mapa e janela de reunião
  relatorio.css         aba do relatório e editor
  responsivo.css        ajustes para celular, tablet e telas grandes
js/                     carregados nesta ordem (está no fim do index.html)
  servicos-locais.js    anexos e downloads
  dados-iniciais.js     o mapa como estava no Claude
  estado.js             dados do mapa, salvar e desfazer
  planos.js             criar, conectar, organizar e apagar planos; abas de mapas
  agenda.js             reuniões e link do Google Agenda
  relatorio.js          editor do relatório, imagens e arquivos
  copia.js              baixar e restaurar cópia
  desenho.js            desenha o mapa, as setas e o zoom
  interacao.js          arrastar, pinça no celular e cliques
  inicio.js             teclado, botões e começo da página
assets/                 ícone e fontes (com as licenças)
.vscode/                extensões recomendadas e formatação ao salvar
.github/workflows/      publicação automática no GitHub Pages
```

Os arquivos de `js/` são scripts comuns (não módulos), por isso o site abre até com dois cliques no `index.html`. Eles compartilham as variáveis: um arquivo pode usar as funções dos outros, e a ordem no `index.html` importa.

## O que mudou em relação ao site do Claude

- Visual e funções iguais: mapa, sub-planos, listas, agendas, relatórios, busca, desfazer, abas.
- Salvamento: antes era compartilhado pelo Claude; agora é no navegador, com a cópia de segurança para levar de um lugar para outro.
- "Editado por": sem login, aparece "Editado por você" no que foi editado neste navegador.
- Anexos: antes ficavam no Claude; agora ficam no navegador e vão junto na cópia.
- Assistente (robô): não tem nesta versão. Fora do Claude ele precisaria da API da Anthropic, que é paga à parte da assinatura. Ele continua na versão do mapa dentro do Claude.
- Google Agenda: igual, os links abrem o evento já preenchido.

## Comandos (opcional, precisa do Node.js)

Nada disso é preciso para usar o site.

- `npm install`: instala as ferramentas.
- `npm run dev`: abre o site em `http://127.0.0.1:5500` sem o Live Server (mesmo endereço, então os mesmos dados).
- `npm run formatar`: arruma a formatação de todos os arquivos com o Prettier.
