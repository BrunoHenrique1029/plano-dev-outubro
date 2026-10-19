/* Relatório de cada plano e de cada item de lista: editor, imagens e arquivos */
/* ---------- relatório e anexos ---------- */
let reportId = null,
  reportItem = null,
  repTimer = null,
  repDesde = 0,
  lastRange = null,
  loadedHtml = "";
/* o relatório pode ser de um plano ou de um item de lista (guardado dentro do item) */
const repItem = () =>
  reportItem ? (get(reportId)?.list || []).find((i) => i.id === reportItem) || null : null;
const repData = () => {
  const n = get(reportId);
  if (!n) return null;
  if (!reportItem) return n;
  return repItem();
};
async function repWrite(patch, opt = {}) {
  const n = get(reportId);
  if (!n) return;
  if (!reportItem) return write("nodes", reportId, patch, { silent: true, ...opt });
  const list = listOf(reportId),
    i = list.find((x) => x.id === reportItem);
  if (!i) return;
  Object.assign(i, patch);
  return write("nodes", reportId, { list }, { silent: true, ...opt });
}

/* ---------- editor do relatório (parecido com uma página do Notion) ----------
   Guarda HTML limpo em `reportHtml`, o texto puro em `report` (busca) e os anexos usados em `files`. */
const ED = () => $("#rep-ed");
const PALETTE = {
  gray: "#787774",
  brown: "#9F6B53",
  orange: "#D9730D",
  yellow: "#CB912F",
  green: "#448361",
  blue: "#337EA9",
  purple: "#9065B0",
  pink: "#C14C8A",
  red: "#D44C47",
};
const HILITE = {
  gray: "#F1F1EF",
  brown: "#F4EEEE",
  orange: "#FBECDD",
  yellow: "#FBF3DB",
  green: "#EDF3EC",
  blue: "#E7F3F8",
  purple: "#F6F3F9",
  pink: "#FAF1F5",
  red: "#FDEBEC",
};
const COLOR_NAMES = {
  gray: "Cinza",
  brown: "Marrom",
  orange: "Laranja",
  yellow: "Amarelo",
  green: "Verde",
  blue: "Azul",
  purple: "Roxo",
  pink: "Rosa",
  red: "Vermelho",
};
const ASSET_RE = /^[A-Za-z0-9_-]{6,80}$/;
const OK_TAGS = new Set(
  "P H1 H2 H3 B I U S CODE PRE BLOCKQUOTE UL OL LI BR HR A IMG DIV SPAN TABLE TBODY TR TD TH".split(" "),
);
const RENAME = {
  FONT: "SPAN",
  STRONG: "B",
  EM: "I",
  STRIKE: "S",
  DEL: "S",
  MARK: "SPAN",
  H4: "H3",
  H5: "H3",
  H6: "H3",
  TH: "TD",
  THEAD: "TBODY",
  TFOOT: "TBODY",
  SECTION: "DIV",
  ARTICLE: "DIV",
};
const DROP = new Set(
  "SCRIPT STYLE IFRAME OBJECT EMBED LINK META TITLE NOSCRIPT TEMPLATE SVG MATH FORM INPUT BUTTON SELECT TEXTAREA VIDEO AUDIO CANVAS".split(
    " ",
  ),
);
function toHex(c) {
  c = String(c || "").trim();
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  return (
    m ? "#" + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, "0")).join("") : c
  ).toUpperCase();
}
const colorName = (map, c) => {
  if (!c) return null;
  const h = toHex(c);
  return Object.keys(map).find((k) => map[k].toUpperCase() === h) || null;
};
function fileHtml(f) {
  const id = esc(f.id),
    nm = esc(f.name || "arquivo");
  return (f.type || "").startsWith("image/")
    ? `<p><img data-asset="${id}" data-name="${nm}" data-type="${esc(f.type)}" alt="${nm}"></p>`
    : `<p><a class="fileblk" contenteditable="false" data-asset="${id}" data-name="${nm}" data-type="${esc(f.type || "")}">📎 ${nm}</a></p>`;
}
/* ---------- links: cartão com prévia (o "banner" do link) ----------
   O cartão guarda título, descrição, imagem e site em data-*; o conteúdo dele é sempre remontado aqui. */
const httpUrl = (u) => {
  try {
    const x = new URL(String(u || "").trim());
    return /^https?:$/.test(x.protocol) ? x.href : "";
  } catch (e) {
    return "";
  }
};
const normUrl = (s) => {
  s = String(s || "").trim();
  return httpUrl(/^https?:\/\//i.test(s) ? s : "https://" + s);
};
const isLoneUrl = (s) => /^(https?:\/\/|www\.)[^\s<>"]+$/i.test(String(s || "").trim());
const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch (e) {
    return "";
  }
};
function linkCardEl(m) {
  const a = document.createElement("a"),
    host = hostOf(m.url),
    site = String(m.site || host).slice(0, 80),
    title = String(m.title || host || m.url).slice(0, 200),
    desc = String(m.desc || "").slice(0, 300),
    img = httpUrl(m.img);
  a.className = "linkcard";
  a.contentEditable = "false";
  a.href = m.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  Object.assign(a.dataset, { title, site }, desc ? { desc } : {}, img ? { img } : {});
  const txt = document.createElement("span"),
    b = document.createElement("b"),
    s = document.createElement("span"),
    ico = document.createElement("img");
  txt.className = "lc-txt";
  b.textContent = title;
  txt.append(b);
  if (desc) {
    const d = document.createElement("span");
    d.className = "lc-desc";
    d.textContent = desc;
    txt.append(d);
  }
  s.className = "lc-site";
  ico.className = "lc-ico";
  ico.alt = "";
  ico.referrerPolicy = "no-referrer";
  ico.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
  s.append(ico, document.createTextNode(site));
  txt.append(s);
  a.append(txt);
  if (img) {
    const im = document.createElement("img");
    im.className = "lc-img";
    im.alt = "";
    im.loading = "lazy";
    im.referrerPolicy = "no-referrer";
    im.src = img;
    a.append(im);
  }
  return a;
}
/* título, descrição e imagem do site vêm do microlink.io (grátis, sem chave, até 50 links novos por dia).
   Sem resposta, o cartão sai só com o endereço e o ícone do site. */
const previas = new Map();
async function buscarPrevia(url) {
  if (previas.has(url)) return previas.get(url);
  let m = { url, site: hostOf(url) };
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) m.img = `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`;
  try {
    const ctl = new AbortController(),
      t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch("https://api.microlink.io/?url=" + encodeURIComponent(url), { signal: ctl.signal });
    clearTimeout(t);
    const j = await r.json();
    if (j?.status === "success" && j.data) {
      const d = j.data;
      m = {
        ...m,
        title: d.title || "",
        desc: d.description || "",
        img: d.image?.url || m.img || "",
        site: d.publisher || m.site,
      };
      previas.set(url, m);
    }
  } catch (e) {}
  return m;
}
async function insertLinkCard(url, after) {
  url = normUrl(url);
  if (!url || !reportId) return null;
  const ph = document.createElement("p");
  ph.className = "uploading";
  ph.textContent = "Buscando a prévia do link…";
  if (after) {
    after.after(ph);
    edChanged();
  } else {
    restoreRange();
    insertBlocks([ph]);
  }
  const target = reportId,
    titem = reportItem,
    m = await buscarPrevia(url);
  if (reportId !== target || reportItem !== titem || !ph.isConnected) return null;
  const p = document.createElement("p");
  p.append(linkCardEl(m));
  ph.replaceWith(p);
  tidyEditor();
  if (p.nextElementSibling) caretInto(p.nextElementSibling, true);
  edChanged(true);
  return p;
}

/* só deixa passar o que o editor sabe mostrar (o texto pode vir colado de qualquer lugar).
   Imagens e arquivos guardam só o id do anexo; o endereço para mostrar vem de showAssets. */
function cleanNode(node) {
  if (node.nodeType === 3) return document.createTextNode(node.nodeValue);
  if (node.nodeType !== 1) return null;
  let tag = RENAME[node.tagName] || node.tagName;
  if (DROP.has(tag)) return null;
  const inner = () => {
    const f = document.createDocumentFragment();
    node.childNodes.forEach((c) => {
      const x = cleanNode(c);
      if (x) f.append(x);
    });
    return f;
  };
  if (!OK_TAGS.has(tag)) return inner();
  const ds = node.dataset || {};
  if (tag === "IMG") {
    const id = ds.asset;
    if (!id || !ASSET_RE.test(id)) return null;
    const im = document.createElement("img");
    im.dataset.asset = id;
    if (ds.name) {
      im.dataset.name = ds.name.slice(0, 200);
      im.alt = im.dataset.name;
    }
    if (ds.type) im.dataset.type = ds.type.slice(0, 80);
    if (/^[sml]$/.test(ds.size || "")) im.dataset.size = ds.size;
    return im;
  }
  if (tag === "A" && node.classList.contains("linkcard")) {
    const url = httpUrl(node.getAttribute("href"));
    return url ? linkCardEl({ url, title: ds.title, desc: ds.desc, img: ds.img, site: ds.site }) : null;
  }
  if (tag === "A" && node.classList.contains("fileblk")) {
    const id = ds.asset;
    if (!id || !ASSET_RE.test(id)) return null;
    const a = document.createElement("a");
    a.className = "fileblk";
    a.contentEditable = "false";
    a.dataset.asset = id;
    a.dataset.name = (ds.name || "arquivo").slice(0, 200);
    if (ds.type) a.dataset.type = ds.type.slice(0, 80);
    a.textContent = "📎 " + a.dataset.name;
    return a;
  }
  const out = document.createElement(tag);
  if (tag === "A") {
    const h = node.getAttribute("href") || "";
    if (/^(https?:|mailto:)/i.test(h)) {
      out.setAttribute("href", h);
      out.setAttribute("target", "_blank");
      out.setAttribute("rel", "noopener");
    }
  }
  if (tag === "TABLE") {
    ["cab-linha", "cab-coluna", "sem-cab"].forEach((c) => node.classList.contains(c) && out.classList.add(c));
    // tabela colada com cabeçalho (th na primeira linha) já chega com o cabeçalho em cima
    const r1 = node.querySelector("tr");
    if (r1?.children.length && [...r1.children].every((x) => x.tagName === "TH"))
      out.classList.add("cab-linha");
  }
  if (tag === "UL" && node.classList.contains("todo")) out.className = "todo";
  if (tag === "DIV" && node.classList.contains("callout")) out.className = "callout";
  if (tag === "P" && node.classList.contains("uploading")) out.className = "uploading";
  if (tag === "LI" && ds.checked === "true") out.dataset.checked = "true";
  if (tag === "SPAN" || tag === "B" || tag === "I" || tag === "U" || tag === "S") {
    const c =
      (ds.color && PALETTE[ds.color] ? ds.color : null) ||
      colorName(PALETTE, node.getAttribute("color") || node.style?.color);
    const g = (ds.bg && HILITE[ds.bg] ? ds.bg : null) || colorName(HILITE, node.style?.backgroundColor);
    if (c) out.dataset.color = c;
    if (g) out.dataset.bg = g;
  }
  out.append(inner());
  if (tag === "TABLE") {
    // thead e tfoot viram tbody: junta tudo num só, para a primeira linha ser uma só
    const [tb, ...resto] = out.querySelectorAll(":scope > tbody");
    resto.forEach((x) => {
      tb.append(...x.childNodes);
      x.remove();
    });
  }
  if (tag === "SPAN" && !out.dataset.color && !out.dataset.bg) {
    const f = document.createDocumentFragment();
    f.append(...out.childNodes);
    return f;
  }
  return out;
}
function sanitize(html) {
  const t = document.createElement("template");
  t.innerHTML = String(html || "");
  const box = document.createElement("div");
  t.content.childNodes.forEach((c) => {
    const x = cleanNode(c);
    if (x) box.append(x);
  });
  return box.innerHTML;
}
function legacyHtml(d) {
  const parts = (d.report || "").split("\n").map((l) => `<p>${l ? esc(l) : "<br>"}</p>`);
  (d.files || []).forEach((f) => parts.push(fileHtml(f)));
  return parts.join("");
}
function canon(html) {
  const box = document.createElement("div");
  box.innerHTML = sanitize(html);
  box.querySelectorAll("p.uploading").forEach((p) => p.remove());
  const blankP = (el) => el && el.tagName === "P" && !el.textContent.trim() && !el.querySelector("img,a");
  while (blankP(box.lastElementChild)) box.lastElementChild.remove();
  return box.innerHTML;
}
function docHtml(d) {
  return d ? (d.reportHtml != null ? sanitize(d.reportHtml) : legacyHtml(d)) : "";
}
function collectFiles(root, old) {
  const by = Object.fromEntries((old || []).map((f) => [f.id, f])),
    out = [],
    seen = new Set();
  root.querySelectorAll("img[data-asset], a.fileblk[data-asset]").forEach((el) => {
    const id = el.dataset.asset;
    if (seen.has(id)) return;
    seen.add(id);
    const o = by[id] || {};
    out.push({
      id,
      name: el.dataset.name || o.name || "arquivo",
      type: el.dataset.type || o.type || (el.tagName === "IMG" ? "image/png" : ""),
      size: o.size || 0,
    });
  });
  return out;
}
/* os anexos ficam neste navegador (js/servicos-locais.js) ou na nuvem (js/nuvem.js); aqui as imagens ganham o endereço para aparecer */
function showAssets(root) {
  if (!assets) return;
  root.querySelectorAll("img[data-asset]:not([src]):not(.missing)").forEach(async (im) => {
    const u = await assets.url(im.dataset.asset).catch(() => null);
    if (u) im.src = u;
    else {
      im.classList.add("missing");
      im.alt = `${im.dataset.name || "Imagem"} (${assets.falta || "não está guardada neste navegador"})`;
    }
  });
}
/* abre o anexo numa aba nova (imagem, PDF, vídeo, áudio, texto) ou baixa com o nome certo */
const VIEW_TYPES = /^(image\/(png|jpe?g|gif|webp|avif|bmp)|application\/pdf|video\/|audio\/|text\/plain)/i;
async function openAsset(id, name, type) {
  const u = assets ? await assets.url(id).catch(() => null) : null;
  if (!u) {
    $("#file-status").textContent =
      `${name || "Arquivo"}: ${assets?.falta || "não está guardado neste navegador"}.`;
    return;
  }
  const a = document.createElement("a");
  a.href = u;
  a.rel = "noopener";
  if (VIEW_TYPES.test(type || "")) a.target = "_blank";
  else a.download = name || "arquivo";
  document.body.append(a);
  a.click();
  a.remove();
}
/* sempre sobra uma linha de texto no fim, para dar para sair de tabelas, códigos e imagens */
function tidyEditor() {
  const ed = ED();
  [...ed.childNodes].forEach((n) => {
    if (n.nodeType === 3 && n.nodeValue.trim()) {
      const p = document.createElement("p");
      n.replaceWith(p);
      p.append(n);
    } else if (n.nodeType === 3) n.remove();
  });
  const last = ed.lastElementChild;
  if (!last || last.tagName !== "P" || last.querySelector("img,a.fileblk,a.linkcard")) {
    const p = document.createElement("p");
    p.innerHTML = "<br>";
    ed.append(p);
  }
  updateBlank();
  showAssets(ed);
}
function updateBlank() {
  const ed = ED();
  ed.classList.toggle(
    "blank",
    !ed.textContent.trim() &&
      !ed.querySelector("img,hr,table,a.fileblk,a.linkcard,li,pre,blockquote,.callout,h1,h2,h3"),
  );
}
function loadEditor() {
  const html = docHtml(repData());
  loadedHtml = canon(html);
  lembrar(loadedHtml);
  ED().innerHTML = html || "<p><br></p>";
  tidyEditor();
  hidePops();
}
function wordCount() {
  const t = ED().innerText.trim();
  return t ? t.split(/\s+/).length : 0;
}

/* seleção */
const selRange = () => {
  const s = getSelection();
  return s.rangeCount ? s.getRangeAt(0) : null;
};
const inEd = (n) => !!n && ED().contains(n);
function liveRange() {
  const r = selRange();
  return r && inEd(r.startContainer) ? r : null;
}
function restoreRange() {
  ED().focus({ preventScroll: true });
  if (lastRange && inEd(lastRange.startContainer)) {
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(lastRange);
  }
}
function blockOf(node) {
  const ed = ED();
  if (!node || !inEd(node) || node === ed) return null;
  while (node.parentNode !== ed) node = node.parentNode;
  return node.nodeType === 1 ? node : null;
}
function curBlock() {
  const r = liveRange() || lastRange;
  if (!r || !inEd(r.startContainer)) return null;
  if (r.startContainer === ED())
    return ED().children[Math.max(0, r.startOffset - 1)] || ED().firstElementChild;
  return blockOf(r.startContainer);
}
function curLi() {
  const r = liveRange() || lastRange;
  if (!r) return null;
  let n = r.startContainer;
  n = n.nodeType === 3 ? n.parentNode : n;
  const li = n.closest ? n.closest("li") : null;
  return li && inEd(li) ? li : null;
}
function caretInto(el, atStart) {
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(!!atStart || !el.textContent);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
  lastRange = r.cloneRange();
}
document.addEventListener("selectionchange", () => {
  const r = liveRange();
  if (r) {
    lastRange = r.cloneRange();
    syncBar();
  }
  syncTabbar();
});

/* barrinha da tabela: com o cursor numa célula, dá para pôr e tirar linhas e colunas,
   escolher o cabeçalho (primeira linha em cima, primeira coluna do lado) e apagar a tabela */
let tabCell = null,
  apagarTimer = 0;
function desarmarApagar() {
  clearTimeout(apagarTimer);
  const b = $('#tabbar [data-tbl="apagar"]');
  b.classList.remove("confirmar");
  b.textContent = "Apagar tabela";
}
// cabeçalho ligado em cima e do lado? Tabela de informativo feita antes dessas opções (sem classe)
// já tinha a primeira linha como cabeçalho
function cabecalho(tabela) {
  const antiga = !tabela.classList.length && !!tabela.closest(".info-corpo, .drawer.info");
  return {
    "cab-linha": antiga || tabela.classList.contains("cab-linha"),
    "cab-coluna": tabela.classList.contains("cab-coluna"),
  };
}
function celulaAtual() {
  const r = liveRange(),
    n = r && (r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer),
    c = n?.closest?.("td,th");
  return c && inEd(c) ? c : null;
}
function syncTabbar() {
  const bar = $("#tabbar"),
    c = !$("#drawer").hidden && ED().isContentEditable ? celulaAtual() : null;
  if (!c) {
    if (!bar.matches(":hover, :focus-within")) bar.hidden = true;
    return;
  }
  const tabela = c.closest("table");
  if (tabCell?.closest("table") !== tabela) desarmarApagar();
  tabCell = c;
  const cab = cabecalho(tabela);
  for (const k in cab) bar.querySelector(`[data-tbl="${k}"]`).setAttribute("aria-pressed", cab[k]);
  const t = tabela.getBoundingClientRect(),
    linha = c.parentElement.getBoundingClientRect();
  bar.hidden = false;
  const h = bar.offsetHeight,
    cima = linha.top - h - 4 >= Math.max(8, $("#drawer").getBoundingClientRect().top);
  placePop(bar, { left: t.left, top: linha.top, bottom: cima ? linha.top - h - 10 : linha.bottom });
}
function mexerTabela(acao) {
  const c = celulaAtual() || (tabCell?.isConnected && inEd(tabCell) ? tabCell : null);
  if (!c) return;
  const tr = c.parentElement,
    tabela = c.closest("table"),
    col = [...tr.children].indexOf(c),
    linhas = [...tabela.querySelectorAll("tr")],
    nova = (tag) => {
      const x = document.createElement(tag);
      x.innerHTML = "<br>";
      return x;
    };
  let foco = c;
  if (acao === "cab-linha" || acao === "cab-coluna") {
    const cab = cabecalho(tabela);
    cab[acao] = !cab[acao];
    for (const k in cab) tabela.classList.toggle(k, cab[k]);
    tabela.classList.toggle("sem-cab", !cab["cab-linha"] && !cab["cab-coluna"]); // sem cabeçalho, de propósito
  } else if (acao === "apagar") {
    // apagar pede um segundo clique, para não sumir com a tabela sem querer
    const b = $('#tabbar [data-tbl="apagar"]');
    if (!b.classList.contains("confirmar")) {
      b.classList.add("confirmar");
      b.textContent = "Apagar mesmo?";
      clearTimeout(apagarTimer);
      apagarTimer = setTimeout(desarmarApagar, 4000);
      return;
    }
    desarmarApagar();
    foco = tabela.nextElementSibling;
    tabela.remove();
  } else if (acao === "linha") {
    const t2 = document.createElement("tr");
    [...tr.children].forEach(() => t2.append(nova("td")));
    tr.after(t2);
    foco = t2.children[col];
  } else if (acao === "coluna") {
    linhas.forEach((l) => {
      const ref = l.children[Math.min(col, l.children.length - 1)],
        x = nova(ref ? ref.tagName : "TD");
      if (ref) ref.after(x);
      else l.append(x);
    });
    foco = tr.children[col + 1];
  } else if (acao === "sem-linha") {
    foco = (tr.nextElementSibling || tr.previousElementSibling)?.children[col] || null;
    tr.remove();
  } else if (acao === "sem-coluna") {
    linhas.forEach((l) => l.children[col]?.remove());
    foco = tr.children[Math.min(col, tr.children.length - 1)] || null;
  }
  // sem linhas ou sem colunas, a tabela some
  if (tabela.isConnected && !tabela.querySelector("td,th")) {
    foco = tabela.nextElementSibling;
    tabela.remove();
  }
  tidyEditor();
  if (foco?.isConnected) caretInto(foco, true);
  edChanged();
  if (!tabela.isConnected) {
    $("#tabbar").hidden = true;
    tabCell = null;
  } else syncTabbar();
}
$("#tabbar").addEventListener("mousedown", (e) => e.preventDefault());
$("#tabbar").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tbl]");
  if (b) mexerTabela(b.dataset.tbl);
});

/* nova tabela: passa o mouse (ou toca) nos quadradinhos para escolher quantas colunas e linhas */
const TAB_MAX = 8;
function escolherTabela(rect) {
  hidePops();
  let q = "";
  for (let l = 1; l <= TAB_MAX; l++)
    for (let c = 1; c <= TAB_MAX; c++)
      q += `<button data-l="${l}" data-c="${c}" aria-label="${c} × ${l}"></button>`;
  $("#tabsize").innerHTML =
    `<b id="ts-tam"></b><div class="ts-grade">${q}</div><small>Escolha o tamanho. Depois dá para pôr e tirar linhas e colunas.</small>`;
  marcarTamanho(3, 3);
  placePop($("#tabsize"), rect || caretRect());
}
function marcarTamanho(l, c) {
  $("#tabsize")
    .querySelectorAll("button[data-l]")
    .forEach((b) => b.classList.toggle("on", +b.dataset.l <= l && +b.dataset.c <= c));
  $("#ts-tam").textContent = `${c} ${c > 1 ? "colunas" : "coluna"} × ${l} ${l > 1 ? "linhas" : "linha"}`;
}
$("#tabsize").addEventListener("mousedown", (e) => e.preventDefault());
$("#tabsize").addEventListener("mouseover", (e) => {
  const b = e.target.closest("button[data-l]");
  if (b) marcarTamanho(+b.dataset.l, +b.dataset.c);
});
$("#tabsize").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-l]");
  if (!b) return;
  $("#tabsize").hidden = true;
  restoreRange();
  insertBlocks([makeTable(+b.dataset.l, +b.dataset.c)]);
});

/* blocos */
const BLOCKS = [
  { k: "p", label: "Texto", hint: "Parágrafo simples", icon: "¶" },
  { k: "h1", label: "Título 1", hint: "Título grande", icon: "H1" },
  { k: "h2", label: "Título 2", hint: "Título médio", icon: "H2" },
  { k: "h3", label: "Título 3", hint: "Título pequeno", icon: "H3" },
  { k: "ul", label: "Lista", hint: "Lista com marcadores", icon: "•" },
  { k: "ol", label: "Lista numerada", hint: "1, 2, 3…", icon: "1." },
  { k: "todo", label: "Lista de tarefas", hint: "Itens para marcar", icon: "☑" },
  { k: "blockquote", label: "Citação", hint: "Destaca uma frase", icon: "❝" },
  { k: "callout", label: "Destaque", hint: "Caixa em destaque para algo importante", icon: "ⓘ" },
  { k: "pre", label: "Código", hint: "Bloco de código", icon: "</>" },
  { k: "hr", label: "Divisor", hint: "Linha para separar partes", icon: "—" },
  { k: "table", label: "Tabela", hint: "Escolha quantas linhas e colunas", icon: "▦" },
  { k: "image", label: "Imagem", hint: "Enviar uma imagem", icon: "🖼" },
  { k: "file", label: "Arquivo", hint: "Anexar PDF, vídeo ou outro arquivo", icon: "📎" },
  { k: "linkcard", label: "Link com prévia", hint: "Cartão com a imagem e o título do site", icon: "🔗" },
];
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function blockType() {
  const li = curLi();
  if (li) {
    const l = li.parentElement;
    return l.tagName === "OL" ? "ol" : l.classList.contains("todo") ? "todo" : "ul";
  }
  const b = curBlock();
  if (!b) return "p";
  if (b.tagName === "DIV") return b.classList.contains("callout") ? "callout" : "p";
  const t = b.tagName.toLowerCase();
  return ["h1", "h2", "h3", "blockquote", "pre"].includes(t) ? t : "p";
}
function setBlock(type) {
  restoreRange();
  if (type === "hr") {
    insertBlocks([document.createElement("hr")]);
    return;
  }
  if (type === "table") {
    escolherTabela();
    return;
  }
  if (type === "image") {
    $("#img-in").click();
    return;
  }
  if (type === "file") {
    $("#file-in").click();
    return;
  }
  if (type === "linkcard") {
    showLink(null, true);
    return;
  }
  const li = curLi();
  if (li) {
    const list = li.parentElement,
      now = list.tagName === "OL" ? "ol" : list.classList.contains("todo") ? "todo" : "ul";
    if (now === type) return;
    if (list.tagName === "UL" && (type === "ul" || type === "todo")) {
      list.classList.toggle("todo", type === "todo");
      if (type === "ul") list.querySelectorAll(":scope > li").forEach((x) => delete x.dataset.checked);
      edChanged();
      return;
    }
    document.execCommand(now === "ol" ? "insertOrderedList" : "insertUnorderedList");
  }
  if (type === "ul" || type === "todo" || type === "ol") {
    const blk = curBlock();
    if (blk && !["TABLE", "UL", "OL", "HR"].includes(blk.tagName)) {
      // monta a lista direto, junto com a lista igual logo acima se houver
      const tag = type === "ol" ? "OL" : "UL",
        li = document.createElement("li");
      li.append(...blk.childNodes);
      if (!li.firstChild) li.innerHTML = "<br>";
      const prev = blk.previousElementSibling;
      if (prev && prev.tagName === tag && prev.classList.contains("todo") === (type === "todo")) {
        prev.append(li);
        blk.remove();
      } else {
        const l = document.createElement(tag);
        if (type === "todo") l.className = "todo";
        l.append(li);
        blk.replaceWith(l);
      }
      tidyEditor();
      caretInto(li);
      edChanged();
      return;
    }
    document.execCommand(type === "ol" ? "insertOrderedList" : "insertUnorderedList");
    const l = curLi();
    if (l && type === "todo") l.parentElement.classList.add("todo");
  } else if (type === "callout") {
    document.execCommand("formatBlock", false, "<div>");
    const b = curBlock();
    if (b && b.tagName === "DIV") b.className = "callout";
  } else {
    const b = curBlock();
    if (b && b.classList && b.classList.contains("callout")) b.className = "";
    document.execCommand("formatBlock", false, `<${type}>`);
  }
  edChanged();
}
function makeTable(linhas = 3, colunas = 3) {
  const t = document.createElement("table"),
    tb = document.createElement("tbody");
  t.className = "cab-linha"; // começa com o cabeçalho em cima; a barrinha da tabela muda
  t.append(tb);
  for (let r = 0; r < linhas; r++) {
    const tr = document.createElement("tr");
    for (let c = 0; c < colunas; c++) {
      const td = document.createElement("td");
      td.innerHTML = "<br>";
      tr.append(td);
    }
    tb.append(tr);
  }
  return t;
}
/* coloca blocos no lugar da linha vazia atual, ou logo depois da linha atual */
function insertBlocks(nodes) {
  const ed = ED();
  let b = curBlock();
  if (b && b.closest && b.closest("table")) b = blockOf(b);
  const empty =
    b && b.tagName === "P" && !b.textContent.trim() && !b.querySelector("img,a.fileblk,a.linkcard");
  if (b && empty) b.replaceWith(...nodes);
  else if (b) b.after(...nodes);
  else ed.append(...nodes);
  tidyEditor();
  const after = nodes[nodes.length - 1].nextElementSibling;
  const first = nodes[0];
  if (first.tagName === "TABLE") caretInto(first.querySelector("td"), true);
  else if (after) caretInto(after, true);
  edChanged();
  return nodes;
}

/* barra de ferramentas */
function syncBar() {
  if ($("#drawer").hidden) return;
  $("#ed-block").value = blockType();
  for (const [cmd, sel] of [
    ["bold", "b"],
    ["italic", "i"],
    ["underline", "u"],
    ["strikeThrough", "s"],
  ]) {
    let on = false;
    try {
      on = document.queryCommandState(cmd);
    } catch (e) {}
    $(`#edbar [data-cmd="${sel}"]`)?.setAttribute("aria-pressed", on);
  }
}
function inlineCode() {
  restoreRange();
  const r = selRange();
  if (!r || r.collapsed) return;
  const txt = r.toString();
  document.execCommand("insertHTML", false, `<code>${esc(txt)}</code>&#8203;`);
  edChanged();
}
function normalizeColors() {
  ED()
    .querySelectorAll("[style], font[color]")
    .forEach((el) => {
      const c = colorName(PALETTE, el.getAttribute("color") || el.style.color),
        g = colorName(HILITE, el.style.backgroundColor);
      if (c) el.dataset.color = c;
      if (g) el.dataset.bg = g;
      el.removeAttribute("style");
      el.removeAttribute("color");
    });
}
function applyColor(kind, name) {
  restoreRange();
  const r = selRange();
  if (!r || r.collapsed) {
    hidePops();
    return;
  }
  if (name === "none") {
    document.execCommand("removeFormat");
  } else {
    document.execCommand("styleWithCSS", false, true);
    document.execCommand(
      kind === "fg" ? "foreColor" : "hiliteColor",
      false,
      kind === "fg" ? PALETTE[name] : HILITE[name],
    );
    document.execCommand("styleWithCSS", false, false);
    normalizeColors();
  }
  hidePops();
  edChanged();
}
function placePop(el, rect) {
  const d = $("#drawer").getBoundingClientRect();
  el.hidden = false;
  const w = el.offsetWidth,
    h = el.offsetHeight;
  let x = Math.min(Math.max(d.left + 8, rect.left), d.right - w - 8),
    y = rect.bottom + 6;
  if (y + h > innerHeight - 8) y = Math.max(8, rect.top - h - 6);
  el.style.left = x + "px";
  el.style.top = y + "px";
}
function caretRect() {
  const r = liveRange() || lastRange;
  if (!r) return ED().getBoundingClientRect();
  const rs = r.getClientRects();
  if (rs.length) return rs[0];
  const b = curBlock();
  return (b || ED()).getBoundingClientRect();
}
function hidePops() {
  linkSel = null;
  linkCard = false;
  ["#slash", "#colors", "#linkbar", "#imgbar", "#linkpop", "#tabbar", "#tabsize"].forEach((s) => {
    const e = $(s);
    if (e) e.hidden = true;
  });
  ED()
    ?.querySelectorAll("img.sel")
    .forEach((i) => i.classList.remove("sel"));
  slash = null;
}
function showColors(btn) {
  const pal = Object.keys(PALETTE);
  $("#colors").innerHTML =
    `<b>Cor do texto</b><div class="sw">${pal.map((k) => `<button data-fg="${k}" title="${COLOR_NAMES[k]}" style="color:${PALETTE[k]}">A</button>`).join("")}</div>
    <b>Fundo</b><div class="sw">${pal.map((k) => `<button data-bgc="${k}" title="${COLOR_NAMES[k]}" style="background:${HILITE[k]};color:#37352F">A</button>`).join("")}</div>
    <button class="clear" data-fg="none">Limpar formatação</button>`;
  placePop($("#colors"), btn.getBoundingClientRect());
}
let linkCard = false; // a barra do link está criando um cartão com prévia?
function showLink(btn, card) {
  const r = lastRange;
  let cur = "";
  const a =
    r && (r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer).closest?.("a");
  if (a && inEd(a) && !card) cur = a.getAttribute("href") || "";
  hidePops();
  linkCard = !!card;
  $("#link-in").value = cur;
  $("#link-in").placeholder = card ? "Cole o link do site" : "Cole o link (vazio remove)";
  placePop($("#linkbar"), btn ? btn.getBoundingClientRect() : caretRect());
  $("#link-in").focus();
}
function applyLink() {
  let url = $("#link-in").value.trim();
  const card = linkCard;
  hidePops();
  restoreRange();
  if (card) {
    if (url) insertLinkCard(url);
    return;
  }
  if (!url) {
    document.execCommand("unlink");
    edChanged();
    return;
  }
  if (!/^(https?:|mailto:)/i.test(url)) url = "https://" + url;
  if (!/^mailto:/i.test(url) && !httpUrl(url)) {
    $("#file-status").textContent = "Esse endereço não parece um link.";
    return;
  }
  const r = selRange();
  if (r && r.collapsed)
    document.execCommand("insertHTML", false, `<a href="${esc(url)}">${esc(url)}</a>&nbsp;`);
  else document.execCommand("createLink", false, url);
  edChanged();
}
$("#edbar").addEventListener("mousedown", (e) => {
  if (e.target.closest("button")) e.preventDefault();
});
$("#edbar").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-cmd]");
  if (!b) return;
  const c = b.dataset.cmd;
  restoreRange();
  if (c === "b") document.execCommand("bold");
  else if (c === "i") document.execCommand("italic");
  else if (c === "u") document.execCommand("underline");
  else if (c === "s") document.execCommand("strikeThrough");
  else if (c === "code") {
    inlineCode();
    return;
  } else if (c === "color") {
    showColors(b);
    return;
  } else if (c === "link") {
    showLink(b);
    return;
  } else if (c === "table") {
    escolherTabela(b.getBoundingClientRect());
    return;
  } else if (c === "undo") {
    document.execCommand("undo");
  } else if (c === "redo") {
    document.execCommand("redo");
  } else {
    setBlock(c);
    return;
  }
  edChanged();
  syncBar();
});
$("#ed-block").addEventListener("change", (e) => {
  setBlock(e.target.value);
});
$("#colors").addEventListener("mousedown", (e) => e.preventDefault());
$("#colors").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.fg) applyColor("fg", b.dataset.fg);
  else if (b.dataset.bgc) applyColor("bg", b.dataset.bgc);
});
$("#linkbar").addEventListener("submit", (e) => {
  e.preventDefault();
  applyLink();
});

/* menu "/" */
let slash = null;
function slashLine() {
  return curLi() || curBlock();
}
function checkSlash() {
  const line = slashLine();
  if (!line) {
    hidePopsSlash();
    return;
  }
  const t = line.textContent;
  if (t.startsWith("/") && t.length <= 24 && !/\s/.test(t.slice(1))) {
    const q = norm(t.slice(1)),
      items = BLOCKS.filter((b) => !q || norm(b.label + " " + b.hint + " " + b.k).includes(q));
    if (!items.length) {
      hidePopsSlash();
      return;
    }
    slash = { line, items, i: Math.min(slash?.i || 0, items.length - 1) };
    renderSlash();
    placePop($("#slash"), caretRect());
  } else hidePopsSlash();
}
function hidePopsSlash() {
  $("#slash").hidden = true;
  slash = null;
}
function renderSlash() {
  $("#slash").innerHTML =
    `<div class="sh">Blocos</div>` +
    slash.items
      .map(
        (b, i) =>
          `<button class="${i === slash.i ? "on" : ""}" data-k="${b.k}"><span class="ic">${esc(b.icon)}</span><span><b>${esc(b.label)}</b><small>${esc(b.hint)}</small></span></button>`,
      )
      .join("");
  $("#slash .on")?.scrollIntoView({ block: "nearest" });
}
function runSlash(k) {
  const line = slash?.line;
  hidePopsSlash();
  if (!line || !inEd(line)) return;
  line.innerHTML = "<br>";
  caretInto(line, true);
  setBlock(k);
}
$("#slash").addEventListener("mousedown", (e) => e.preventDefault());
$("#slash").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-k]");
  if (b) runSlash(b.dataset.k);
});

/* atalhos do jeito do Notion: "# " título, "- " lista, "[] " tarefa, "> " citação, "``` " código, "--- " divisor */
const MD = {
  "#": "h1",
  "##": "h2",
  "###": "h3",
  "-": "ul",
  "*": "ul",
  "1.": "ol",
  "[]": "todo",
  "[ ]": "todo",
  ">": "blockquote",
  "```": "pre",
  "!": "callout",
};
function mdShortcut(e) {
  const b = curBlock();
  if (!b || curLi()) return false;
  if (!(b.tagName === "P" || (b.tagName === "DIV" && !b.classList.contains("callout")))) return false;
  const r = liveRange();
  if (!r || !r.collapsed) return false;
  const pre = document.createRange();
  pre.selectNodeContents(b);
  pre.setEnd(r.startContainer, r.startOffset);
  const t = pre.toString();
  if (t !== b.textContent) return false;
  if (t === "---") {
    e.preventDefault();
    b.innerHTML = "<br>";
    caretInto(b, true);
    insertBlocks([document.createElement("hr")]);
    return true;
  }
  if (!MD[t]) return false;
  e.preventDefault();
  b.innerHTML = "<br>";
  caretInto(b, true);
  setBlock(MD[t]);
  return true;
}

/* imagens e arquivos dentro do texto */
const TEXT_TYPES = { csv: "text/csv", md: "text/markdown", json: "application/json", txt: "text/plain" };
const UPLOAD_ERR = {
  too_large: () => `o arquivo é grande demais (até ${assets?.limiteMB || 20} MB)`,
  unsupported_type: "esse tipo de arquivo não é aceito (use imagem, PDF, vídeo ou texto)",
  quota_or_state: "o espaço de anexos acabou",
  rate_limited: "muitos envios seguidos, espere um pouco",
  not_granted: "você não tem permissão para anexar aqui",
};
async function insertFiles(list) {
  if (!ED().isContentEditable) return;
  if (!assets) {
    $("#file-status").textContent = "Este navegador não deixa guardar anexos.";
    return;
  }
  if (!reportId || !list.length) return;
  const target = reportId,
    titem = reportItem;
  for (const f of list) {
    const ph = document.createElement("p");
    ph.className = "uploading";
    ph.textContent = `Enviando ${f.name || "imagem"}…`;
    restoreRange();
    insertBlocks([ph]);
    $("#file-status").textContent = `Enviando ${f.name || "arquivo"}…`;
    const ext = (f.name.split(".").pop() || "").toLowerCase(),
      type = TEXT_TYPES[ext] || f.type || undefined;
    try {
      const r = await assets.upload(f, type ? { type } : undefined);
      const meta = {
        id: r.id,
        name: f.name || "print.png",
        type: r.contentType || type || "",
        size: r.sizeBytes,
      };
      if (reportId === target && reportItem === titem && ph.isConnected) {
        const t = document.createElement("template");
        t.innerHTML = fileHtml(meta);
        ph.replaceWith(t.content.firstElementChild);
        tidyEditor();
        pendingMeta[meta.id] = meta;
        edChanged(true);
      }
      $("#file-status").textContent = `${meta.name} anexado.`;
    } catch (e) {
      ph.remove();
      edChanged();
      const msg = UPLOAD_ERR[e?.code];
      $("#file-status").textContent =
        `${f.name}: ${(typeof msg === "function" ? msg() : msg) || "não foi possível enviar agora"}.`;
    }
  }
}
const pendingMeta = {};

/* salvar */
function edChanged(now) {
  updateBlank();
  showAssets(ED());
  $("#rep-status").textContent = "Salvando…";
  // salva meio segundo depois de parar de digitar e, enquanto digita, a cada 1,5 s (para os outros verem)
  if (!repTimer) repDesde = Date.now();
  clearTimeout(repTimer);
  repTimer = setTimeout(flushReport, now ? 0 : Math.max(0, Math.min(500, repDesde + 1500 - Date.now())));
}
function flushReport() {
  clearTimeout(repTimer);
  repTimer = null;
  if (!reportId) return;
  const d = repData();
  if (!d) return;
  let html = canon(ED().innerHTML);
  const meuNovo = html !== loadedHtml,
    deles = canon(docHtml(d));
  // chegou mudança de outra pessoa: junta com a minha, bloco por bloco, e mostra sem tirar o cursor do lugar
  if (deles !== loadedHtml) {
    lembrar(deles);
    const junto = canon(juntar(versoes.get(d.reportBase) ?? loadedHtml, html, deles, meuNovo));
    if (junto !== html && !trocarBlocos(junto)) {
      repTimer = setTimeout(flushReport, 400); // ainda escolhendo a palavra no teclado do celular
      return;
    }
    loadedHtml = deles;
    html = canon(ED().innerHTML);
  }
  const box = document.createElement("div");
  box.innerHTML = html;
  const text = ED()
    .innerText.replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const files = collectFiles(box, [...(d.files || []), ...Object.values(pendingMeta)]);
  if (html.length > 200000) {
    $("#rep-status").textContent =
      "O relatório ficou grande demais para salvar. Divida em outro plano ou item.";
    return;
  }
  if (html === loadedHtml) {
    $("#rep-status").textContent = `Salvo · ${wordCount()} palavras`;
    return;
  }
  const base = loadedHtml;
  loadedHtml = html;
  lembrar(html);
  repWrite({ reportHtml: html, report: text, files, reportBase: assinar(base) }, { noHistory: !meuNovo });
  $("#rep-status").textContent = `Salvo · ${wordCount()} palavras`;
}

/* ---------- relatório ao vivo ----------
   Cada bloco do topo (parágrafo, título, lista, tabela, imagem…) é comparado com o que chegou.
   Se duas pessoas mexeram em pontos diferentes (até no mesmo parágrafo), as duas mudanças ficam; no mesmo
   pedaço, fica a de quem ainda está digitando. Cada gravação leva a assinatura da versão de onde saiu (reportBase). */
const versoes = new Map();
let compondo = false,
  compondoEm = 0,
  sincTimer = null;
function assinar(html) {
  let h = 0x811c9dc5;
  for (let i = 0; i < html.length; i++) h = Math.imul(h ^ html.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36) + "." + html.length.toString(36);
}
function lembrar(html) {
  const k = assinar(html);
  versoes.delete(k);
  versoes.set(k, html);
  while (versoes.size > 40) versoes.delete(versoes.keys().next().value);
}
function blocos(html) {
  const box = document.createElement("div");
  box.innerHTML = html;
  return [...box.childNodes].map((n) => (n.nodeType === 1 ? n.outerHTML : esc(n.nodeValue)));
}
/* o pedaço de `a` que mudou para virar `b` (serve para lista de blocos e para texto) */
function trecho(a, b) {
  let i = 0,
    j = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
  return { de: i, ate: a.length - j, novo: b.slice(i, b.length - j) };
}
const juntaTudo = (v) => (typeof v === "string" ? v : v.join(""));
const comeca = (a, b) => b.length <= a.length && juntaTudo(a.slice(0, b.length)) === juntaTudo(b);
const termina = (a, b) => b.length <= a.length && juntaTudo(a.slice(a.length - b.length)) === juntaTudo(b);
function aplicar(b, partes) {
  const out = [];
  let pos = 0;
  for (const p of partes) {
    out.push(b.slice(pos, p.de), p.novo);
    pos = p.ate;
  }
  out.push(b.slice(pos));
  return typeof b === "string" ? out.join("") : out.flat();
}
/* junta duas mudanças feitas sobre a mesma base; null quando mexeram no mesmo pedaço */
function juntar3(b, m, d) {
  let x, y;
  if (m.de === m.ate && d.de === d.ate && m.de === d.de) {
    // os dois só acrescentaram no mesmo ponto: se um já tem o do outro, fica um só; senão, sempre na mesma ordem
    if (comeca(m.novo, d.novo) || termina(m.novo, d.novo)) return aplicar(b, [m]);
    if (comeca(d.novo, m.novo) || termina(d.novo, m.novo)) return aplicar(b, [d]);
    [x, y] = juntaTudo(m.novo) <= juntaTudo(d.novo) ? [m, d] : [d, m];
  } else if (m.ate <= d.de) [x, y] = [m, d];
  else if (d.ate <= m.de) [x, y] = [d, m];
  else return null;
  if (x.ate === y.de) {
    // encostados: não repete o que um lado já trouxe do outro
    if (x.de === x.ate && comeca(y.novo, x.novo)) return aplicar(b, [y]);
    if (y.de === y.ate && termina(x.novo, y.novo)) return aplicar(b, [x]);
  }
  return aplicar(b, [x, y]);
}
function juntar(base, meu, deles, meuGanha) {
  if (meu === deles || deles === base) return meu;
  if (meu === base) return deles;
  const b = blocos(base),
    m = trecho(b, blocos(meu)),
    d = trecho(b, blocos(deles));
  let r = juntar3(b, m, d);
  if (
    !r &&
    m.de === d.de &&
    m.ate === m.de + 1 &&
    d.ate === d.de + 1 &&
    m.novo.length === 1 &&
    d.novo.length === 1
  ) {
    // os dois mexeram no mesmo parágrafo: junta letra por letra, se foram pontos diferentes dele
    const bb = b[m.de],
      um = juntar3(bb, trecho(bb, m.novo[0]), trecho(bb, d.novo[0]));
    if (um != null) r = [...b.slice(0, m.de), um, ...b.slice(m.ate)];
  }
  return r ? r.join("") : meuGanha ? meu : deles;
}
/* letras que dá para editar dentro dos blocos (os cartões de link e de arquivo ficam de fora) */
function textosDe(nodes) {
  const out = [],
    ed = ED();
  const ok = (t) => {
    const c = t.parentElement?.closest('[contenteditable="false"]');
    return !c || c === ed;
  };
  nodes.forEach((top) => {
    if (top.nodeType === 3) return out.push(top);
    const w = document.createTreeWalker(top, NodeFilter.SHOW_TEXT);
    for (let t; (t = w.nextNode()); ) if (ok(t)) out.push(t);
  });
  return out;
}
function posTexto(lista, no, off) {
  const r = document.createRange();
  r.setStart(no, off);
  let n = 0;
  for (const t of lista) {
    if (t === no) return n + off;
    if (r.comparePoint(t, t.length) > 0) break;
    n += t.length;
  }
  return n;
}
/* troca no editor só os blocos que mudaram; o cursor fica no mesmo ponto do texto.
   Devolve false quando o bloco do cursor está no meio de uma palavra do teclado do celular. */
function trocarBlocos(html) {
  const ed = ED(),
    box = document.createElement("div");
  box.innerHTML = html;
  const vazio = (n) =>
    n.nodeType === 1 && n.tagName === "P" && !n.textContent.trim() && !n.querySelector("img,a");
  // a linha "Enviando…" e as linhas vazias do fim ficam onde estão
  const cur = [...ed.childNodes].filter((n) => !(n.nodeType === 1 && n.matches("p.uploading")));
  while (cur.length && vazio(cur[cur.length - 1])) cur.pop();
  const nov = [...box.childNodes],
    chave = (n) => (n.nodeType === 1 ? sanitize(n.outerHTML) : n.nodeValue),
    t = trecho(cur.map(chave), nov.map(chave)),
    sai = cur.slice(t.de, t.ate),
    entra = nov.slice(t.de, nov.length - (cur.length - t.ate));
  if (!sai.length && !entra.length) return true;
  const sel = getSelection(),
    dentro = (no) => !!no && sai.some((b) => b === no || b.contains(no)),
    temSel = sel.rangeCount > 0 && ed.contains(sel.anchorNode),
    aIn = temSel && dentro(sel.anchorNode),
    fIn = temSel && dentro(sel.focusNode);
  if ((aIn || fIn) && compondo && Date.now() - compondoEm < 3000) return false;
  const antes = textosDe(sai),
    ta = antes.map((x) => x.data).join(""),
    pa = aIn ? posTexto(antes, sel.anchorNode, sel.anchorOffset) : 0,
    pf = fIn ? posTexto(antes, sel.focusNode, sel.focusOffset) : 0,
    ref = sai.length
      ? sai[sai.length - 1].nextSibling
      : cur[t.ate] || (t.de ? cur[t.de - 1].nextSibling : ed.firstChild);
  sai.forEach((n) => n.remove());
  entra.forEach((n) => ed.insertBefore(n, ref));
  tidyEditor();
  if (!aIn && !fIn) return true;
  // o cursor estava num bloco trocado: volta para o mesmo ponto do texto
  const depois = textosDe(entra),
    td = depois.map((x) => x.data).join("");
  let p = 0,
    s = 0;
  while (p < ta.length && p < td.length && ta[p] === td[p]) p++;
  while (s < ta.length - p && s < td.length - p && ta[ta.length - 1 - s] === td[td.length - 1 - s]) s++;
  const mover = (c) =>
    c <= p ? c : c >= ta.length - s ? c + td.length - ta.length : Math.min(c, td.length - s);
  const ponto = (c) => {
    for (const x of depois) {
      if (c <= x.length) return [x, c];
      c -= x.length;
    }
    const alvo = entra.find((n) => n.nodeType === 1) || ref || ed.lastChild;
    return alvo && alvo.parentNode ? [alvo, 0] : [ed, 0];
  };
  const [an, ao] = aIn ? ponto(mover(pa)) : [sel.anchorNode, sel.anchorOffset],
    [fn, fo] = fIn ? ponto(mover(pf)) : [sel.focusNode, sel.focusOffset];
  try {
    sel.setBaseAndExtent(an, ao, fn, fo);
    if (sel.rangeCount) lastRange = sel.getRangeAt(0).cloneRange();
  } catch (e) {}
  return true;
}

/* eventos do editor */
const ed0 = $("#rep-ed");
try {
  document.execCommand("defaultParagraphSeparator", false, "p");
} catch (e) {}
ed0.addEventListener("input", (e) => {
  tidyRootText();
  const b = curBlock();
  if (b && b.tagName === "P" && b.textContent === "---" && !curLi()) {
    b.innerHTML = "<br>";
    caretInto(b, true);
    insertBlocks([document.createElement("hr")]);
    return;
  }
  if (e.inputType === "insertParagraph") {
    const li = curLi();
    if (li && !li.textContent.trim()) delete li.dataset.checked;
  }
  checkSlash();
  edChanged();
});
function tidyRootText() {
  const ed = ED();
  if ([...ed.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim()))
    document.execCommand("formatBlock", false, "<p>");
}
ed0.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (slash && !$("#slash").hidden) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      slash.i = (slash.i + 1) % slash.items.length;
      renderSlash();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      slash.i = (slash.i - 1 + slash.items.length) % slash.items.length;
      renderSlash();
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      runSlash(slash.items[slash.i].k);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      hidePopsSlash();
      return;
    }
  }
  if (e.key === "Escape") {
    e.preventDefault();
    if (!$("#tabsize").hidden) $("#tabsize").hidden = true;
    else closeReport();
    return;
  }
  if (e.key === " " && mdShortcut(e)) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    showLink($('#edbar [data-cmd="link"]'));
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
    e.preventDefault();
    inlineCode();
    return;
  }
  if (e.key === "Tab") {
    const r = liveRange(),
      cell =
        r &&
        (r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer).closest?.("td,th");
    if (cell && inEd(cell)) {
      e.preventDefault();
      const cells = [...cell.closest("table").querySelectorAll("td,th")],
        i = cells.indexOf(cell);
      let next = cells[i + (e.shiftKey ? -1 : 1)];
      if (!next && !e.shiftKey) {
        const tr = cell.parentElement.cloneNode(true);
        tr.querySelectorAll("td,th").forEach((c) => (c.innerHTML = "<br>"));
        cell.closest("tbody").append(tr);
        next = tr.firstElementChild;
        edChanged();
      }
      if (next) caretInto(next, true);
      return;
    }
    if (curLi()) {
      e.preventDefault();
      document.execCommand(e.shiftKey ? "outdent" : "indent");
      edChanged();
      return;
    }
    const b = curBlock();
    if (b && b.tagName === "PRE") {
      e.preventDefault();
      document.execCommand("insertText", false, "  ");
      return;
    }
  }
  if (e.key === "Enter" && !e.shiftKey) {
    const b = curBlock();
    if (b && (b.tagName === "PRE" || b.tagName === "BLOCKQUOTE" || b.classList?.contains("callout"))) {
      e.preventDefault();
      document.execCommand("insertLineBreak");
      return;
    }
  }
  if (e.key === "Backspace") {
    const b = curBlock(),
      r = liveRange();
    if (
      b &&
      r &&
      r.collapsed &&
      !curLi() &&
      ["H1", "H2", "H3", "BLOCKQUOTE", "PRE", "DIV"].includes(b.tagName)
    ) {
      const pre = document.createRange();
      pre.selectNodeContents(b);
      pre.setEnd(r.startContainer, r.startOffset);
      if (!pre.toString()) {
        e.preventDefault();
        setBlock("p");
        return;
      }
    }
  }
});
ed0.addEventListener("click", (e) => {
  const li = e.target.closest("ul.todo > li");
  if (li && inEd(li) && e.clientX - li.getBoundingClientRect().left < 26 && ED().isContentEditable) {
    e.preventDefault();
    if (li.dataset.checked === "true") delete li.dataset.checked;
    else li.dataset.checked = "true";
    edChanged();
    return;
  }
  const a = e.target.closest("a");
  if (a && inEd(a) && a.classList.contains("fileblk")) {
    e.preventDefault();
    openAsset(a.dataset.asset, a.dataset.name, a.dataset.type);
    return;
  }
  if (a && inEd(a) && a.getAttribute("href")) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || !ED().isContentEditable) window.open(a.href, "_blank", "noopener");
    else showLinkPop(a);
    return;
  }
  const img = e.target.closest("img");
  hidePops();
  if (img && inEd(img)) {
    img.classList.add("sel");
    imgSel = img;
    const rr = img.getBoundingClientRect();
    placePop($("#imgbar"), { left: rr.left + 8, right: rr.left + 8, top: rr.top + 8, bottom: rr.top + 8 });
    $("#imgbar")
      .querySelectorAll("[data-size]")
      .forEach((b) => b.setAttribute("aria-pressed", (img.dataset.size || "l") === b.dataset.size));
  }
});
let linkSel = null;
const shortUrl = (u) => {
  const s = String(u)
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/$/, "");
  return s.length > 42 ? s.slice(0, 40) + "…" : s;
};
function showLinkPop(a) {
  hidePops();
  linkSel = a;
  const card = a.classList.contains("linkcard");
  $("#lp-open").href = a.href;
  $("#lp-url").textContent = shortUrl(a.href);
  $("#lp-url").title = a.href;
  $('#linkpop [data-lp="edit"]').hidden = card;
  $('#linkpop [data-lp="card"]').textContent = card ? "Virar link" : "Cartão";
  const r = a.getBoundingClientRect();
  placePop(
    $("#linkpop"),
    card ? { left: r.left + 8, right: r.left + 8, top: r.top + 8, bottom: r.top + 8 } : r,
  );
}
$("#linkpop").addEventListener("mousedown", (e) => {
  if (e.target.closest("button")) e.preventDefault();
});
$("#linkpop").addEventListener("click", (e) => {
  const a = linkSel;
  if (e.target.closest("#lp-open")) {
    hidePops();
    return; // o próprio link abre a aba nova
  }
  const b = e.target.closest("button[data-lp]");
  if (!b || !a || !inEd(a)) return;
  const card = a.classList.contains("linkcard"),
    blk = blockOf(a);
  if (b.dataset.lp === "edit") {
    const r = document.createRange();
    r.selectNodeContents(a);
    lastRange = r;
    showLink({ getBoundingClientRect: () => a.getBoundingClientRect() });
    return;
  }
  hidePops();
  if (b.dataset.lp === "rm") {
    if (card) {
      a.remove();
      if (blk && blk !== ED() && !blk.textContent.trim() && !blk.querySelector("img,a")) blk.remove();
    } else a.replaceWith(...a.childNodes);
  } else if (b.dataset.lp === "card") {
    if (card) {
      const l = document.createElement("a");
      l.href = a.href;
      l.textContent = a.href;
      a.replaceWith(l);
    } else {
      // o link sozinho na linha vira o cartão; no meio do texto, o cartão entra na linha de baixo
      const url = a.href;
      if (blk && blk !== ED() && blk.textContent.trim() === a.textContent.trim()) {
        insertLinkCard(url, blk).then((p) => {
          if (p && blk.isConnected) {
            blk.remove();
            tidyEditor();
            edChanged(true);
          }
        });
        return;
      }
      insertLinkCard(url, blk && blk !== ED() ? blk : null);
      return;
    }
  }
  tidyEditor();
  edChanged();
});
ED().addEventListener(
  "error",
  (e) => {
    // imagem do cartão que não carregou (site fora do ar, sem internet): some, e o cartão fica só com o texto
    if (e.target.tagName === "IMG" && e.target.closest(".linkcard")) e.target.classList.add("off");
  },
  true,
);
let imgSel = null;
$("#imgbar").addEventListener("mousedown", (e) => e.preventDefault());
$("#imgbar").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || !imgSel || !inEd(imgSel)) return;
  if (b.dataset.size) {
    if (b.dataset.size === "l") delete imgSel.dataset.size;
    else imgSel.dataset.size = b.dataset.size;
    edChanged();
  } else if (b.dataset.img === "open")
    openAsset(imgSel.dataset.asset, imgSel.dataset.name, imgSel.dataset.type);
  else if (b.dataset.img === "rm") {
    const p = imgSel.parentElement;
    imgSel.remove();
    if (p && p !== ED() && !p.textContent.trim() && !p.querySelector("img")) p.remove();
    tidyEditor();
    edChanged();
  }
  hidePops();
});
ed0.addEventListener("paste", (e) => {
  const cd = e.clipboardData;
  if (!cd) return;
  const fs = [...(cd.files || [])];
  if (fs.length) {
    e.preventDefault();
    insertFiles(fs);
    return;
  }
  const plain = cd.getData("text/plain") || "";
  if (isLoneUrl(plain) && normUrl(plain)) {
    e.preventDefault();
    const url = normUrl(plain),
      b = curBlock(),
      r = liveRange();
    if (r && !r.collapsed) document.execCommand("createLink", false, url);
    else if (
      b &&
      b.parentElement === ED() &&
      b.tagName === "P" &&
      !b.textContent.trim() &&
      !b.querySelector("img,a")
    )
      insertLinkCard(url);
    else document.execCommand("insertHTML", false, `<a href="${esc(url)}">${esc(plain.trim())}</a>&nbsp;`);
    edChanged();
    return;
  }
  const html = cd.getData("text/html");
  e.preventDefault();
  if (html) document.execCommand("insertHTML", false, sanitize(html));
  else document.execCommand("insertText", false, cd.getData("text/plain"));
  normalizeColors();
  edChanged();
});
ed0.addEventListener("dragover", (e) => {
  if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
});
ed0.addEventListener("drop", (e) => {
  const fs = [...(e.dataTransfer?.files || [])];
  if (!fs.length) return;
  e.preventDefault();
  const r = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
  if (r && inEd(r.startContainer)) {
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    lastRange = r.cloneRange();
  }
  insertFiles(fs);
});
ed0.addEventListener("blur", (e) => {
  compondo = false;
  if (repTimer) flushReport();
  if (!e.relatedTarget?.closest?.("#drawer, .pop")) setTimeout(refreshEditorFromData, 0);
});
// teclado do celular escolhendo a palavra: o bloco do cursor não é trocado até ela terminar
// (se o teclado não avisar que terminou, depois de 3 s parado ele troca assim mesmo)
ed0.addEventListener("compositionstart", () => {
  compondo = true;
  compondoEm = Date.now();
});
ed0.addEventListener("compositionupdate", () => (compondoEm = Date.now()));
ed0.addEventListener("compositionend", () => (compondo = false));
// trocou de aplicativo ou bloqueou o celular logo depois de digitar: salva na hora
document.addEventListener("visibilitychange", () => document.hidden && repTimer && flushReport());
addEventListener("pagehide", () => repTimer && flushReport());
$("#drawer").addEventListener("scroll", () => {
  $("#imgbar").hidden = true;
  $("#linkpop").hidden = true;
  syncTabbar();
  $("#colors").hidden = true;
  $("#linkbar").hidden = true;
  $("#tabsize").hidden = true;
});
document.addEventListener("mousedown", (e) => {
  if (!e.target.closest("#slash,#colors,#linkbar,#imgbar,#linkpop,#tabbar,#tabsize,#edbar,#rep-ed")) {
    ["#colors", "#linkbar", "#imgbar", "#linkpop", "#tabsize"].forEach((s) => ($(s).hidden = true));
  }
});
$("#img-in").onchange = (e) => {
  insertFiles([...e.target.files]);
  e.target.value = "";
};
$("#file-in").onchange = (e) => {
  insertFiles([...e.target.files]);
  e.target.value = "";
};
$("#rep-wide").onclick = () => {
  const w = $("#drawer").classList.toggle("wide");
  $("#rep-wide span").textContent = w ? "Reduzir" : "Tela cheia";
};

function openReport(id, quiet, item) {
  const n = get(id);
  if (!n) return;
  if (reportId) flushReport();
  clearTimeout(sincTimer);
  versoes.clear();
  reportId = id;
  reportItem = item || null;
  selected = null;
  if (reportItem && !repItem()) reportItem = null;
  $("#drawer").style.setProperty("--c", `var(--p-${n.who || "all"})`);
  $("#file-status").textContent = "";
  $("#drawer").hidden = false;
  loadEditor();
  fillDrawer();
  render();
  if (travado(n)) return; // só leitura: fillDrawer já avisou
  $("#rep-status").textContent = `${wordCount()} palavras · salva sozinho`;
  if (!quiet) {
    const ed = ED();
    ed.focus({ preventScroll: true });
    caretInto(ed.lastElementChild || ed);
  }
}
const PH_REL = $("#rep-ed").dataset.ph,
  PH_INFO = "Escreva o informativo: textos, instruções e tabelas. Digite / para ver os blocos.";
function fillDrawer() {
  const n = get(reportId);
  if (!n) {
    closeReport();
    return;
  }
  const it = repItem();
  if (reportItem && !it) {
    closeReport();
    return;
  }
  $("#rep-title").textContent = it
    ? it.text || (isAgenda(n) ? "Reunião" : "Item sem nome")
    : n.title || (isAgenda(n) ? "Agenda" : isInfo(n) ? "Informativo sem título" : "Plano sem nome");
  $("#rep-who").textContent = it
    ? isAgenda(n)
      ? `Reunião · ${dayLabel(it.date)}${it.time ? " · " + it.time : ""}${it.with ? " · com " + it.with : ""}`
      : `Item da lista ${n.title ? "“" + n.title + "”" : ""} · ${it.done ? "Feito" : "A fazer"}`
    : (isInfo(n) ? "Informativo · " : "") +
      WHO[n.who || "all"] +
      (isList(n) ? "" : " · " + STATUS[statusOf(n)]);
  const info = !it && isInfo(n);
  $("#drawer").classList.toggle("info", info);
  $("#rep-k").hidden = info;
  $("#rep-ic").innerHTML = ic(
    info ? IC.info : isAgenda(n) ? IC.agenda : it || isList(n) ? IC.lista : IC[n.who || "all"],
    22,
  );
  ED().dataset.ph = info ? PH_INFO : PH_REL;
  $("#rep-edited").textContent = editedLine(n);
  document
    .querySelectorAll('#edbar [data-cmd="image"], #edbar [data-cmd="file"]')
    .forEach((b) => (b.hidden = !assets));
  // relatório de quem não está no filtro: só para ler
  const ro = travado(n);
  if (ro !== $("#drawer").classList.contains("ro")) {
    $("#drawer").classList.toggle("ro", ro);
    ED().contentEditable = ro ? "false" : "true";
    $("#edbar").hidden = ro;
    if (ro) hidePops();
    else $("#rep-status").textContent = `${wordCount()} palavras · salva sozinho`;
  }
  if (ro) $("#rep-status").textContent = `Só leitura. ${avisoTravado(n)}`;
}
/* chegou mudança de outro aparelho: entra no relatório aberto na hora, mesmo com o cursor no texto */
function refreshEditorFromData() {
  if (!reportId) return;
  fillDrawer();
  clearTimeout(sincTimer);
  const d = reportId && repData();
  if (!d || canon(docHtml(d)) === loadedHtml) return;
  if (repTimer) return; // quem está digitando salva daqui a pouco e junta as duas coisas
  if (document.querySelector(".pop:not([hidden]):not(#tabbar):not(#coment)")) {
    sincTimer = setTimeout(refreshEditorFromData, 800); // com um menu do editor aberto, espera ele fechar
    return;
  }
  flushReport();
}
function closeReport() {
  flushReport();
  hidePops();
  reportId = null;
  reportItem = null;
  $("#drawer").hidden = true;
  render();
}
$("#rep-close").onclick = closeReport;
