/* Teclado, botões do topo e o começo da página */
document.addEventListener("keydown", (e) => {
  const t = e.target,
    typing =
      t.isContentEditable || t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && t.type !== "checkbox");
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z" && !typing) {
    e.preventDefault();
    undo();
    return;
  }
  if (e.key === "Escape" && mtg) {
    closeMeeting();
    return;
  }
  if (e.key === "Escape" && reportId) {
    closeReport();
    return;
  }
  if (e.key === "Escape" && (connectFrom || pendingRestore)) {
    connectFrom = null;
    pendingRestore = null;
    render();
  }
  if (e.key === "Enter" && t.dataset.mliText) {
    e.preventDefault();
    const id = t.dataset.id,
      list = listOf(id),
      k = list.findIndex((x) => x.id === t.dataset.mliText);
    if (k >= 0) list[k].text = t.value;
    const li = { id: rid(), text: "", done: false };
    list.splice(k + 1, 0, li);
    pendingFocus = "li-" + li.id;
    saveList(id, list);
    return;
  }
  if (e.key === "Backspace" && t.dataset.mliText && t.value === "") {
    const id = t.dataset.id,
      list = listOf(id),
      k = list.findIndex((x) => x.id === t.dataset.mliText);
    if (list.length > 1 && k >= 0) {
      e.preventDefault();
      const prev = list[Math.max(0, k - 1)];
      list.splice(k, 1);
      pendingFocus = "li-" + (k > 0 ? prev.id : list[0].id);
      saveList(id, list);
      return;
    }
  }
  if (e.key === "Enter" && !e.shiftKey && (t.tagName === "TEXTAREA" || t.dataset.map)) {
    e.preventDefault();
    t.blur();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.tagName === "TEXTAREA") drawEdges();
});
$("#q").addEventListener("input", (e) => {
  q = e.target.value.trim().toLowerCase();
  render();
});
$("#add-main").onclick = addMain;
$("#add-list").onclick = () => addListNode(null);
$("#add-agenda").onclick = () => addListNode(null, "agenda");
$("#add-first").onclick = addMain;
$("#undo").onclick = undo;
$("#z-in").onclick = () => zoom(1.2);
$("#z-out").onclick = () => zoom(1 / 1.2);
$("#z-fit").onclick = () => fit(true);
$("#z-tidy").onclick = tidy;
if (document.fonts) document.fonts.ready.then(() => drawEdges());
setInterval(() => {
  if (reportId) $("#rep-edited").textContent = editedLine(get(reportId) || {});
}, 30000);

/* ---------- começo ---------- */
assets = servicos.anexos;
downloads = servicos.downloads;
try {
  currentMap = localStorage.getItem("plano-mapa-aba") || "main";
} catch (e) {}
/* na primeira vez neste navegador, o mapa começa como estava no Claude (js/dados-iniciais.js) */
let firstRun = false;
try {
  firstRun = localStorage.getItem("plano-mapa") === null;
} catch (e) {}
loadLocal();
if (firstRun && typeof DADOS_INICIAIS !== "undefined") {
  nodes = clone(DADOS_INICIAIS.planos);
  maps = clone(DADOS_INICIAIS.mapas);
  saveLocal();
}
render();
fitted[currentMap] = true;
fit();
setSave("Salvo neste navegador", "ok");
