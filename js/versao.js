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
  const marca = (r) => (r.ok ? r.headers.get("etag") || r.headers.get("last-modified") || "" : "");
  // a versão que este aparelho está usando é a que ficou guardada no navegador
  const usando = Promise.all(enderecos.map((u) => fetch(u, { cache: "force-cache" }).then(marca, () => "")));
  let ultima = 0,
    achou = false;
  procurarVersaoNova = async () => {
    if (achou || document.hidden || Date.now() - ultima < 30000) return;
    ultima = Date.now();
    const antes = await usando;
    // "no-cache" pergunta ao servidor e já guarda o arquivo novo, para o Atualizar pegar a versão nova
    const agora = await Promise.all(
      enderecos.map((u) => fetch(u, { cache: "no-cache" }).then(marca, () => "")),
    );
    if (agora.some((m, i) => m && antes[i] && m !== antes[i])) {
      achou = true;
      $("#versao-nova").hidden = false;
    }
  };
  $("#versao-atualizar").onclick = () => {
    if (typeof flushReport === "function" && reportId) flushReport();
    location.reload();
  };
  setTimeout(procurarVersaoNova, 5000);
  setInterval(procurarVersaoNova, 3 * 60000);
  document.addEventListener("visibilitychange", procurarVersaoNova);
  addEventListener("focus", procurarVersaoNova);
})();
