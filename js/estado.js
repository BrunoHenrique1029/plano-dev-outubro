/* Estado do mapa, funções pequenas de ajuda, salvar e desfazer */
const WHO = { all: "Todos", D: "Dev", A: "Aquisição", C: "Conteúdo" };
const STATUS = { todo: "A fazer", doing: "Fazendo", blocked: "Travado", done: "Feito" };
const MAIN_W = 240;
const CAL =
  '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 10h17M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const CAL_ADD =
  '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8 3v4M16 3v4M12 11v6M9 14h6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const ICON =
  '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 3v5h5M9 13h7M9 17h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

// ícones de linha (os do mapa: cada pessoa tem o seu, e cada tipo de bloco também)
const ic = (d, t = 16) =>
  `<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  all: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
  D: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
  A: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M15.5 4.9a3.2 3.2 0 0 1 0 6.2M21 20c0-2.8-1.7-4.8-4.2-5.4"/>',
  C: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.3v5.4l4.5-2.7z" fill="currentColor"/>',
  lista: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="3"/>',
  agenda: '<rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  info: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
};
const icQuem = (n) => ic(IC[n.who || "all"] || IC.all, 15);

let nodes = [],
  maps = [],
  comentarios = [], // comentários no mapa (js/comentarios.js); as respostas têm o campo "pai"
  currentMap = "main";
let who = "all",
  q = "",
  selected = null,
  connectFrom = null,
  confirmDel = null,
  confirmMapDel = null,
  pendingFocus = null;
let view = { tx: 40, ty: 40, s: 1 },
  fitted = {};
let assets = null;
let myId = "local", // sem login, quem edita neste navegador é sempre "você"; com a nuvem, é a conta Google
  meuNome = "";
let pointerDown = 0, // quando o dedo ou o mouse apertou (0 = solto)
  pendingRender = false,
  drag = null;
let undoStack = [],
  tx = null;

const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
const clone = (o) => (o == null ? null : JSON.parse(JSON.stringify(o)));
const mapOf = (n) => n.map || "main";
const here = () => nodes.filter((n) => mapOf(n) === currentMap);
const get = (id) => nodes.find((n) => n.id === id);
const parentOf = (n) => (n.parent && get(n.parent) && mapOf(get(n.parent)) === mapOf(n) ? n.parent : null);
const kids = (p) =>
  here()
    .filter((n) => parentOf(n) === p)
    .sort(byOrder);
const isAgenda = (n) => n?.kind === "agenda";
const isInfo = (n) => n?.kind === "info"; // informativo: título e um texto com tabelas, instruções…
const isList = (n) => n?.kind === "list" || isAgenda(n) || isInfo(n); // lista, agenda e informativo são blocos: sem status e sem sub-planos
const isShown = (n) => {
  let p = parentOf(n);
  while (p) {
    const pn = get(p);
    if (fechado(pn)) return false;
    p = parentOf(pn);
  }
  return true;
};
const descCount = (id) => kids(id).reduce((t, k) => t + 1 + descCount(k.id), 0);
const steps = (p) => kids(p).filter((n) => !isList(n));
// com quem um plano divide a ordem: os passos entre si; o que está ligado num plano (sub-planos, listas, agendas, informativos), tudo junto
const irmaos = (n) => (parentOf(n) ? kids(parentOf(n)) : steps(null));
const isDesc = (id, anc) => {
  let n = get(id);
  while (n && parentOf(n)) {
    if (n.parent === anc) return true;
    n = get(n.parent);
  }
  return false;
};
const statusOf = (n) => n.status || (n.done ? "done" : "todo");
// quanto do que está ligado a um plano já foi feito: os sub-planos e os itens das listas
function feitosDe(id) {
  let feito = 0,
    total = 0;
  const visita = (p) =>
    kids(p).forEach((k) => {
      if (isAgenda(k) || isInfo(k)) return;
      if (isList(k))
        for (const i of k.list || []) {
          total++;
          if (i.done) feito++;
        }
      else {
        total++;
        if (statusOf(k) === "done") feito++;
        visita(k.id);
      }
    });
  visita(id);
  return { feito, total };
}
/* filtro numa pessoa só: os planos das outras pessoas ficam apagados e travados (dá para ver, não para mexer) */
const travadoPessoa = (n) => !!n && who !== "all" && (n.who || "all") !== who;
const DE = { all: "de Todos", D: "do Dev", A: "da Aquisição", C: "do Conteúdo" };

/* ---------- senha dos mapas ----------
   Um mapa do Dev, da Aquisição ou do Conteúdo pode ter senha para editar. Sem a senha, quem abre só vê e comenta.
   O mapa guarda só o código da senha (hash), nunca a senha. A senha de administrador abre todos os mapas.
   Isso trava a edição pelo site; quem entra no mapa continua sendo decidido pela lista de e-mails do Firebase. */
const SENHA_ADM = "56fa2f516e7101ead7dbb4e1d41712664ff13a3df2a7e72f83bafd19d3f9ce00"; // hashSenha("adm:" + senha)
async function hashSenha(txt) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
// para trocar a senha de administrador: no console do navegador, await novaSenhaAdm("senha nova")
const novaSenhaAdm = async (senha) => `const SENHA_ADM = "${await hashSenha("adm:" + senha)}";`;
const mapaInfo = (id) => tabList().find((m) => m.id === id) || { id, name: "Mapa", who: "all" };
// mapas desbloqueados neste aparelho: { idDoMapa: código da senha, adm: código da senha de administrador }
let chaves = {};
try {
  chaves = JSON.parse(localStorage.getItem("plano-chaves") || "{}") || {};
} catch (e) {}
function guardarChaves() {
  try {
    localStorage.setItem("plano-chaves", JSON.stringify(chaves));
  } catch (e) {}
}
const souAdm = () => chaves.adm === SENHA_ADM;
const temSenha = (id) => !!mapaInfo(id).senha;
const mapaTravado = (id) => {
  const m = mapaInfo(id);
  return !!m.senha && !souAdm() && chaves[m.id] !== m.senha;
};
async function desbloquear(id, senha) {
  const m = mapaInfo(id);
  if ((await hashSenha("adm:" + senha)) === SENHA_ADM) chaves.adm = SENHA_ADM;
  else if (m.senha && (await hashSenha(`mapa:${m.id}:${senha}`)) === m.senha) chaves[m.id] = m.senha;
  else return false;
  guardarChaves();
  return true;
}
function bloquear(id) {
  delete chaves[id];
  delete chaves.adm;
  guardarChaves();
}
const travado = (n) => !!n && (travadoPessoa(n) || mapaTravado(mapOf(n)));
// mapa com senha e ainda travado neste aparelho: avisa e não deixa mexer
function mapaLivre() {
  if (!mapaTravado(currentMap)) return true;
  avisar(avisoMapa());
  return false;
}
// no mapa com senha, quem só vê também abre e fecha as ramificações, mas isso fica só neste aparelho
let dobras = {};
const fechado = (n) => (n.id in dobras && mapaTravado(mapOf(n)) ? dobras[n.id] : !!n.collapsed);
const avisoMapa = () =>
  `Este mapa ${DE[mapaInfo(currentMap).who || "all"]} tem senha. Para editar, clique em Desbloquear.`;
function avisoTravado(n) {
  if (mapaTravado(mapOf(n))) return avisoMapa();
  const w = n.who || "all",
    oque = isAgenda(n)
      ? "Esta agenda"
      : isInfo(n)
        ? "Este informativo"
        : isList(n)
          ? "Esta lista"
          : "Este plano";
  return `${oque} é ${DE[w]}. Para mexer, marque ${w === "all" ? "" : WHO[w] + " ou "}Todos no filtro.`;
}
let aviso = "",
  avisoTimer = null;
function avisar(txt) {
  aviso = txt;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => {
    aviso = "";
    render();
  }, 4000);
  render();
}
const matches = (n) =>
  !q ||
  [
    n.title,
    n.report,
    ...(n.files || []).map((f) => f.name),
    ...(n.list || []).flatMap((i) => [
      i.text,
      i.with,
      i.link,
      i.report,
      ...(i.files || []).map((f) => f.name),
    ]),
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
function topNumbers() {
  const m = {};
  steps(null).forEach((n, i) => (m[n.id] = i + 1));
  return m;
}
function tabList() {
  const list = maps.filter((m) => !m.hidden).sort(byOrder);
  if (!maps.some((m) => m.id === "main"))
    list.unshift({ id: "main", name: "Mapa 1", order: 0, virtual: true });
  return list;
}
function when(iso) {
  if (!iso) return "";
  const d = new Date(iso),
    s = (Date.now() - d) / 1000;
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return (
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
    " às " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}
function editedLine(n) {
  if (!n.editedAt) return "";
  const nome = n.editedBy === myId ? "você" : n.editedByName;
  return nome ? `Editado por ${nome} · ${when(n.editedAt)}` : `Editado ${when(n.editedAt)}`;
}

/* ---------- salvar e desfazer ---------- */
function saveLocal() {
  try {
    localStorage.setItem("plano-mapa", JSON.stringify({ nodes, maps, comentarios }));
    return true;
  } catch (e) {
    return false;
  }
}
function loadLocal() {
  try {
    const d = JSON.parse(localStorage.getItem("plano-mapa") || "null");
    if (Array.isArray(d)) nodes = d;
    else if (d) {
      nodes = d.nodes || [];
      maps = d.maps || [];
      comentarios = d.comentarios || [];
    }
  } catch (e) {}
}
function setSave(txt, cls) {
  $("#savetxt").textContent = txt;
  $("#save").className = "save " + (cls || "");
}
function begin() {
  tx = [];
}
function commit() {
  if (tx && tx.length) {
    undoStack.push(tx);
    if (undoStack.length > 100) undoStack.shift();
  }
  tx = null;
  $("#undo").disabled = !undoStack.length;
}

async function write(coll, id, data, opt = {}) {
  const list = coll === "maps" ? maps : coll === "comentarios" ? comentarios : nodes,
    i = list.findIndex((x) => x.id === id);
  const before = i >= 0 ? clone(list[i]) : null;
  if (!opt.noHistory) {
    const entry = { coll, id, before };
    if (tx) {
      if (!tx.some((e) => e.coll === coll && e.id === id)) tx.push(entry);
    } else {
      undoStack.push([entry]);
      if (undoStack.length > 100) undoStack.shift();
    }
    $("#undo").disabled = false;
  }
  let next = null;
  if (data === null) {
    if (i >= 0) list.splice(i, 1);
  } else {
    next = opt.replace ? { ...data, id } : { ...(before || {}), ...data, id };
    const onlyPos = Object.keys(data).every((k) => k === "x" || k === "y");
    if (coll === "nodes" && !opt.replace && !onlyPos) {
      next.editedAt = new Date().toISOString();
      if (myId) next.editedBy = myId;
      if (meuNome) next.editedByName = meuNome;
    }
    if (i >= 0) list[i] = next;
    else list.push(next);
  }
  if (!opt.silent) render();
  if (nuvem) nuvem.gravar(coll, id, data, opt, before, next);
  else if (saveLocal()) setSave("Salvo neste navegador", "ok");
  else setSave("Não foi possível salvar neste navegador. O espaço pode ter acabado.", "err");
}
async function undo() {
  if (!mapaLivre()) return;
  const entry = undoStack.pop();
  $("#undo").disabled = !undoStack.length;
  if (!entry) return;
  for (const e of [...entry].reverse())
    await write(e.coll, e.id, e.before ? (({ id, ...b }) => b)(e.before) : null, {
      noHistory: true,
      replace: true,
      silent: true,
    });
  render();
  setSave("Desfeito", "ok");
}
