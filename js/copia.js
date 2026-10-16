/* Cópia de segurança: um arquivo .json com os mapas, os planos e os anexos.
   Serve para guardar o plano e para levar para outro navegador ou computador. */
const fileIds = () => [
  ...new Set(
    nodes
      .flatMap((n) => [...(n.files || []), ...(n.list || []).flatMap((i) => i.files || [])])
      .map((f) => f.id)
      .filter(Boolean),
  ),
];
$("#dl").onclick = async () => {
  if (!downloads) return;
  const d = new Date().toISOString().slice(0, 10);
  setSave("Preparando a cópia…", "");
  try {
    const arquivos = assets ? await assets.exportar(fileIds()) : [];
    await downloads.save({
      filename: `plano-dev-copia-${d}.json`,
      data: JSON.stringify(
        {
          tipo: "plano-dev",
          versao: 2,
          salvoEm: new Date().toISOString(),
          mapas: tabList().map(({ virtual, ...m }) => m),
          planos: nodes,
          arquivos,
        },
        null,
        2,
      ),
    });
    setSave("Cópia baixada", "ok");
  } catch (e) {
    setSave("Não foi possível baixar a cópia agora.", "err");
  }
};
$("#restore").onclick = () => $("#restore-in").click();
$("#restore-in").onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (d?.tipo !== "plano-dev" || !Array.isArray(d.planos)) throw 0;
    pendingRestore = d;
    render();
  } catch (err) {
    setSave("Esse arquivo não é uma cópia do plano.", "err");
  }
};
async function doRestore() {
  const d = pendingRestore;
  pendingRestore = null;
  if (!d) return;
  let lost = false;
  if (Array.isArray(d.arquivos) && d.arquivos.length) {
    try {
      if (!assets) throw 0;
      await assets.importar(d.arquivos);
    } catch (e) {
      lost = true;
    }
  }
  begin();
  for (const m of d.mapas || []) {
    const { id, ...b } = m;
    if (id) await write("maps", id, b, { silent: true, replace: true });
  }
  for (const n of d.planos) {
    const { id, ...b } = n;
    if (id) await write("nodes", id, b, { silent: true, replace: true });
  }
  commit();
  render();
  fit();
  if (lost)
    setSave(
      `Cópia restaurada: ${d.planos.length} planos. Os anexos não puderam ser guardados neste navegador.`,
      "err",
    );
  else setSave(`Cópia restaurada: ${d.planos.length} planos`, "ok");
}
