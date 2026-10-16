/* Relatório de cada plano e de cada item de lista: editor, imagens e arquivos */
/* ---------- relatório e anexos ---------- */
let reportId = null,
  reportItem = null,
  repTimer = null,
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
async function repWrite(patch) {
  const n = get(reportId);
  if (!n) return;
  if (!reportItem) return write("nodes", reportId, patch, { silent: true });
  const list = listOf(reportId),
    i = list.find((x) => x.id === reportItem);
  if (!i) return;
  Object.assign(i, patch);
  return write("nodes", reportId, { list }, { silent: true });
}

/* ---------- editor do relatório (parecido com uma página do Notion) ----------
   Guarda HTML limpo em `reportHtml`, o texto puro em `report` (busca e assistente) e os anexos usados em `files`. */
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
/* os anexos ficam guardados neste navegador (js/servicos-locais.js); aqui as imagens ganham o endereço para aparecer */
function showAssets(root) {
  if (!assets) return;
  root.querySelectorAll("img[data-asset]:not([src])").forEach(async (im) => {
    const u = await assets.url(im.dataset.asset).catch(() => null);
    if (u) im.src = u;
    else {
      im.classList.add("missing");
      im.alt = `${im.dataset.name || "Imagem"} (não está guardada neste navegador)`;
    }
  });
}
/* abre o anexo numa aba nova (imagem, PDF, vídeo, áudio, texto) ou baixa com o nome certo */
const VIEW_TYPES = /^(image\/(png|jpe?g|gif|webp|avif|bmp)|application\/pdf|video\/|audio\/|text\/plain)/i;
async function openAsset(id, name, type) {
  const u = assets ? await assets.url(id).catch(() => null) : null;
  if (!u) {
    $("#file-status").textContent = `${name || "Arquivo"}: não está guardado neste navegador.`;
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
  if (!last || last.tagName !== "P" || last.querySelector("img,a.fileblk")) {
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
    !ed.textContent.trim() && !ed.querySelector("img,hr,table,a.fileblk,li,pre,blockquote,.callout,h1,h2,h3"),
  );
}
function loadEditor() {
  const html = docHtml(repData());
  loadedHtml = canon(html);
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
  { k: "callout", label: "Destaque", hint: "Caixa com 💡 para algo importante", icon: "💡" },
  { k: "pre", label: "Código", hint: "Bloco de código", icon: "</>" },
  { k: "hr", label: "Divisor", hint: "Linha para separar partes", icon: "—" },
  { k: "table", label: "Tabela", hint: "Tabela 3 × 3", icon: "▦" },
  { k: "image", label: "Imagem", hint: "Enviar uma imagem", icon: "🖼" },
  { k: "file", label: "Arquivo", hint: "Anexar PDF, vídeo ou outro arquivo", icon: "📎" },
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
  if (type === "hr" || type === "table") {
    insertBlocks(type === "hr" ? [document.createElement("hr")] : [makeTable()]);
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
function makeTable() {
  const t = document.createElement("table"),
    tb = document.createElement("tbody");
  t.append(tb);
  for (let r = 0; r < 3; r++) {
    const tr = document.createElement("tr");
    for (let c = 0; c < 3; c++) {
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
  const empty = b && b.tagName === "P" && !b.textContent.trim() && !b.querySelector("img,a.fileblk");
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
  ["#slash", "#colors", "#linkbar", "#imgbar"].forEach((s) => {
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
function showLink(btn) {
  const r = lastRange;
  let cur = "";
  const a =
    r && (r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer).closest?.("a");
  if (a && inEd(a)) cur = a.getAttribute("href") || "";
  $("#link-in").value = cur;
  placePop($("#linkbar"), btn.getBoundingClientRect());
  $("#link-in").focus();
}
function applyLink() {
  let url = $("#link-in").value.trim();
  hidePops();
  restoreRange();
  if (!url) {
    document.execCommand("unlink");
    edChanged();
    return;
  }
  if (!/^(https?:|mailto:)/i.test(url)) url = "https://" + url;
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
  too_large: "o arquivo é grande demais (até 20 MB)",
  unsupported_type: "esse tipo de arquivo não é aceito (use imagem, PDF, vídeo ou texto)",
  quota_or_state: "o espaço de anexos acabou",
  rate_limited: "muitos envios seguidos, espere um pouco",
  not_granted: "você não tem permissão para anexar aqui",
};
async function insertFiles(list) {
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
      $("#file-status").textContent = `${f.name}: ${UPLOAD_ERR[e?.code] || "não foi possível enviar agora"}.`;
    }
  }
}
const pendingMeta = {};

/* salvar */
function edChanged(now) {
  updateBlank();
  showAssets(ED());
  $("#rep-status").textContent = "Salvando…";
  clearTimeout(repTimer);
  repTimer = setTimeout(flushReport, now ? 0 : 700);
}
function flushReport() {
  clearTimeout(repTimer);
  repTimer = null;
  if (!reportId) return;
  const d = repData();
  if (!d) return;
  const html = canon(ED().innerHTML),
    box = document.createElement("div");
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
  loadedHtml = html;
  repWrite({ reportHtml: html, report: text, files });
  $("#rep-status").textContent = `Salvo · ${wordCount()} palavras`;
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
    closeReport();
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
  if (li && inEd(li) && e.clientX - li.getBoundingClientRect().left < 26) {
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
  if (a && inEd(a) && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    window.open(a.href, "_blank", "noopener");
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
ed0.addEventListener("blur", () => {
  if (repTimer) flushReport();
});
$("#drawer").addEventListener("scroll", () => {
  $("#imgbar").hidden = true;
  $("#colors").hidden = true;
  $("#linkbar").hidden = true;
});
document.addEventListener("mousedown", (e) => {
  if (!e.target.closest("#slash,#colors,#linkbar,#imgbar,#edbar,#rep-ed")) {
    ["#colors", "#linkbar", "#imgbar"].forEach((s) => ($(s).hidden = true));
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
  $("#rep-wide").textContent = w ? "Reduzir" : "Tela cheia";
};

function openReport(id, quiet, item) {
  const n = get(id);
  if (!n) return;
  if (reportId) flushReport();
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
  $("#rep-status").textContent = `${wordCount()} palavras · salva sozinho`;
  if (!quiet) {
    const ed = ED();
    ed.focus({ preventScroll: true });
    caretInto(ed.lastElementChild || ed);
  }
}
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
    : n.title || (isAgenda(n) ? "Agenda" : "Plano sem nome");
  $("#rep-who").textContent = it
    ? isAgenda(n)
      ? `Reunião · ${dayLabel(it.date)}${it.time ? " · " + it.time : ""}${it.with ? " · com " + it.with : ""}`
      : `Item da lista ${n.title ? "“" + n.title + "”" : ""} · ${it.done ? "Feito" : "A fazer"}`
    : WHO[n.who || "all"] + (isList(n) ? "" : " · " + STATUS[statusOf(n)]);
  $("#rep-edited").textContent = editedLine(n);
  document
    .querySelectorAll('#edbar [data-cmd="image"], #edbar [data-cmd="file"]')
    .forEach((b) => (b.hidden = !assets));
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
