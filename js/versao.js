/* Avisa quando sai uma versão nova do site (depois de um git push) e atualiza com os arquivos novos.
   O GitHub Pages deixa os arquivos guardados no navegador por até 10 minutos: sem isso, um aparelho
   pode continuar com a versão antiga mesmo depois de recarregar a página. */
let procurarVersaoNova = () => {};
(() => {
  if (!/^https?:$/.test(location.protocol)) return; // aberto com dois cliques (file://): não tem o que comparar
  const enderecos = [
    location.pathname,
    ...[...document.querySelectorAll("script[src], link[rel=stylesheet][href]")].map(
      (e) => e.getAttribute("src") || e.getAttribute("href"),
    ),
  ]
    .map((u) => new URL(u, location.href))
    .filter((u) => u.origin === location.origin)
    .map((u) => u.href);
  // data de publicação do arquivo (e a etiqueta, para quando o servidor não manda a data)
  const marca = (r) =>
    r.ok
      ? { data: Date.parse(r.headers.get("last-modified") || "") || 0, tag: r.headers.get("etag") || "" }
      : null;
  /* Só conta como versão nova quando o servidor tem um arquivo MAIS NOVO que o deste aparelho.
     Logo depois de um push, alguns servidores do GitHub ainda entregam a versão anterior por alguns
     minutos: comparar só "diferente" fazia o aviso voltar várias vezes. */
  const maisNovo = (a, b) =>
    !!(a && b) && (a.data && b.data ? b.data > a.data : !!(a.tag && b.tag) && a.tag !== b.tag);
  // a versão que este aparelho está usando é a que ficou guardada no navegador
  const usando = Promise.all(
    enderecos.map((u) => fetch(u, { cache: "force-cache" }).then(marca, () => null)),
  );
  let ultima = 0,
    achou = false;
  procurarVersaoNova = async () => {
    if (achou || document.hidden || Date.now() - ultima < 30000) return;
    ultima = Date.now();
    const antes = await usando;
    // "no-store" só pergunta ao servidor: não troca o que está guardado (quem troca é o Atualizar)
    const agora = await Promise.all(
      enderecos.map((u) => fetch(u, { cache: "no-store" }).then(marca, () => null)),
    );
    if (agora.some((m, i) => maisNovo(antes[i], m))) {
      achou = true;
      $("#versao-nova").hidden = false;
    }
  };
  $("#versao-atualizar").onclick = async () => {
    if (typeof flushReport === "function" && reportId) flushReport();
    // baixa de novo os arquivos (e guarda), para o recarregar usar a versão nova; no máximo 6 s
    const baixar = Promise.all(enderecos.map((u) => fetch(u, { cache: "reload" }).catch(() => {})));
    await Promise.race([baixar, new Promise((ok) => setTimeout(ok, 6000))]);
    location.reload();
  };
  setTimeout(procurarVersaoNova, 5000);
  setInterval(procurarVersaoNova, 3 * 60000);
  document.addEventListener("visibilitychange", procurarVersaoNova);
  addEventListener("focus", procurarVersaoNova);
})();
