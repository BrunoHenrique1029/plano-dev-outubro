/* Comentários no mapa: um alfinete com a inicial de quem comentou, as respostas e o botão de apagar.
   Qualquer pessoa comenta, até no mapa com senha. Apaga quem escreveu ou quem pode editar o mapa.
   Comentário preso num plano anda junto com ele (campos node, dx e dy). */
let comentando = false, // esperando o clique no mapa para pôr o comentário
  comentAberto = null, // id do comentário com a janelinha aberta ("novo" = ainda escrevendo)
  rascunho = null, // lugar do comentário novo, antes de enviar
  apagarComent = null, // comentário esperando o segundo clique em Apagar
  apagarComentTimer = 0,
  ocultos = false;
try {
  ocultos = localStorage.getItem("plano-comentarios-ocultos") === "1";
} catch (e) {}

const porData = (a, b) => ((a.em || "") < (b.em || "") ? -1 : 1);
const raizes = () => comentarios.filter((c) => !c.pai && c.map === currentMap).sort(porData);
const respostas = (id) => comentarios.filter((c) => c.pai === id).sort(porData);
const nomeDe = (c) => (c.autorId === myId ? "Você" : c.autor || "Alguém");
const inicial = (c) =>
  ((c.autorId === myId ? meuNome : c.autor) || "?").trim().charAt(0).toUpperCase() || "?";
const podeApagar = (c) => c.autorId === myId || !mapaTravado(c.map || currentMap);
function posDe(c) {
  const n = c.node && get(c.node);
  return n && mapOf(n) === c.map
    ? { x: (n.x || 0) + (c.dx || 0), y: (n.y || 0) + (c.dy || 0) }
    : { x: c.x || 0, y: c.y || 0 };
}
// alfinete de plano escondido (ramificação fechada) também fica escondido
const visivel = (c) => {
  const n = c.node && get(c.node);
  return !n || isShown(n);
};

function drawPins() {
  const el = document.getElementById("pins");
  if (!el) return;
  let h = "";
  for (const c of ocultos ? [] : raizes()) {
    if (!visivel(c)) continue;
    const p = posDe(c),
      r = respostas(c.id).length,
      quem = esc(nomeDe(c));
    h += `<button class="pin${comentAberto === c.id ? " on" : ""}" data-pin="${c.id}" style="left:${p.x}px;top:${p.y}px" title="Comentário de ${quem}" aria-label="Comentário de ${quem}">${esc(inicial(c))}${r ? `<span class="n">${r}</span>` : ""}</button>`;
  }
  if (rascunho) {
    const p = posDe(rascunho);
    h += `<span class="pin novo" style="left:${p.x}px;top:${p.y}px" aria-hidden="true">${esc(inicial({ autorId: myId }))}</span>`;
  }
  el.innerHTML = h;
  syncBotoesComent();
  if (comentAberto) atualizarPop();
}
function syncBotoesComent() {
  const n = raizes().length,
    v = $("#c-ver");
  v.hidden = !n;
  v.innerHTML = `${ocultos ? "Mostrar" : "Ocultar"}<span class="hide-xs"> comentários</span> (${n})`;
  $("#c-novo").setAttribute("aria-pressed", comentando);
}

/* pôr um comentário: liga o modo, e o próximo clique no mapa (js/interacao.js) chama colocarComentario */
function modoComentar(on) {
  comentando = on;
  $("#board").classList.toggle("comentando", on);
  if (on) {
    fecharPop();
    if (ocultos) mostrarComentarios(true);
  }
  render();
}
function colocarComentario(e) {
  const r = $("#board").getBoundingClientRect(),
    x = Math.round((e.clientX - r.left - view.tx) / view.s),
    y = Math.round((e.clientY - r.top - view.ty) / view.s),
    no = document.elementFromPoint(e.clientX, e.clientY)?.closest(".node"),
    n = no && get(no.dataset.id);
  comentando = false;
  $("#board").classList.remove("comentando");
  rascunho = { map: currentMap, x, y, ...(n ? { node: n.id, dx: x - (n.x || 0), dy: y - (n.y || 0) } : {}) };
  comentAberto = "novo";
  render();
  abrirPop();
}
function mostrarComentarios(on) {
  ocultos = !on;
  try {
    localStorage.setItem("plano-comentarios-ocultos", ocultos ? "1" : "0");
  } catch (e) {}
  if (ocultos) fecharPop();
  drawPins();
}

/* a janelinha do comentário: a conversa, Responder e Apagar */
function abrirComentario(id) {
  if (rascunho) rascunho = null;
  comentAberto = id;
  apagarComent = null;
  drawPins();
  abrirPop();
}
function abrirPop() {
  const novo = comentAberto === "novo",
    pop = $("#coment");
  pop.innerHTML = `<div class="cp-topo"><b id="cp-tit"></b><button type="button" class="cp-x" data-cp="fechar" aria-label="Fechar">✕</button></div>
    <div class="cp-lista" id="cp-lista"></div>
    <form class="cp-form" id="cp-form"><textarea id="cp-txt" rows="2" maxlength="2000" placeholder="${novo ? "Escreva o comentário" : "Escreva a resposta"}" aria-label="${novo ? "Comentário" : "Resposta"}"></textarea>
    <div class="cp-acts">${novo ? `<button type="button" class="btn" data-cp="fechar">Cancelar</button>` : ""}<button type="submit" class="btn primary">${novo ? "Comentar" : "Responder"}</button></div></form>`;
  pop.hidden = false;
  atualizarPop();
  $("#cp-txt").focus({ preventScroll: true });
}
function atualizarPop() {
  const pop = $("#coment");
  if (pop.hidden || !comentAberto) return;
  const novo = comentAberto === "novo",
    c = novo ? null : comentarios.find((x) => x.id === comentAberto);
  if (!novo && !c) return fecharPop(); // outra pessoa apagou
  const msgs = novo ? [] : [c, ...respostas(c.id)];
  $("#cp-tit").textContent = novo
    ? "Novo comentário"
    : msgs.length > 1
      ? `Comentário e ${msgs.length - 1} ${msgs.length > 2 ? "respostas" : "resposta"}`
      : "Comentário";
  const html = msgs
    .map((m) => {
      const conf = apagarComent === m.id;
      return `<div class="cp-msg${m.pai ? " resp" : ""}"><div class="cp-quem"><b>${esc(nomeDe(m))}</b><span>${esc(when(m.em))}</span></div><p>${esc(m.texto).replace(/\n/g, "<br>")}</p>${
        podeApagar(m)
          ? `<button type="button" class="cp-apagar${conf ? " confirmar" : ""}" data-cp="apagar" data-id="${m.id}">${conf ? (m.pai ? "Apagar mesmo?" : "Apagar com as respostas?") : "Apagar"}</button>`
          : ""
      }</div>`;
    })
    .join("");
  const lista = $("#cp-lista");
  if (lista.innerHTML !== html) {
    const fim = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 8;
    lista.innerHTML = html;
    if (fim) lista.scrollTop = lista.scrollHeight;
  }
  lista.hidden = !msgs.length;
  posicionarPop();
}
function posicionarPop() {
  const pop = $("#coment");
  if (pop.hidden) return;
  const pin = document.querySelector(
    comentAberto === "novo" ? "#pins .pin.novo" : `#pins [data-pin="${comentAberto}"]`,
  );
  if (!pin) return;
  const r = pin.getBoundingClientRect(),
    w = pop.offsetWidth,
    h = pop.offsetHeight,
    m = 8;
  let x = r.right + m;
  if (x + w > innerWidth - m) x = r.left - w - m;
  x = Math.max(m, Math.min(x, innerWidth - w - m));
  let y = Math.max(m, Math.min(r.top - 10, innerHeight - h - m));
  // em tela estreita a janelinha cobre o alfinete: vai para baixo ou para cima dele
  if (x < r.right && x + w > r.left)
    y = r.bottom + m + h <= innerHeight - m ? r.bottom + m : Math.max(m, r.top - h - m);
  pop.style.left = x + "px";
  pop.style.top = y + "px";
}
function fecharPop() {
  comentAberto = null;
  apagarComent = null;
  rascunho = null;
  $("#coment").hidden = true;
  drawPins();
}
async function enviarComentario() {
  const txt = $("#cp-txt"),
    texto = txt.value.trim();
  if (!texto || !comentAberto) return;
  const id = rid(),
    base = { map: currentMap, texto, autor: meuNome || "", autorId: myId, em: new Date().toISOString() };
  txt.value = "";
  if (comentAberto === "novo") {
    const r = rascunho;
    rascunho = null;
    comentAberto = id;
    await write("comentarios", id, { ...r, ...base }, { noHistory: true });
    abrirPop();
  } else {
    await write(
      "comentarios",
      id,
      { ...base, map: comentarios.find((x) => x.id === comentAberto)?.map || base.map, pai: comentAberto },
      { noHistory: true },
    );
    $("#cp-txt").focus({ preventScroll: true });
    const lista = $("#cp-lista");
    lista.scrollTop = lista.scrollHeight;
  }
}
async function apagarComentario(id) {
  const c = comentarios.find((x) => x.id === id);
  if (!c || !podeApagar(c)) return;
  // o primeiro clique só pergunta; o segundo apaga
  if (apagarComent !== id) {
    apagarComent = id;
    clearTimeout(apagarComentTimer);
    apagarComentTimer = setTimeout(() => {
      apagarComent = null;
      atualizarPop();
    }, 4000);
    atualizarPop();
    return;
  }
  apagarComent = null;
  if (!c.pai) {
    for (const r of respostas(id)) await write("comentarios", r.id, null, { noHistory: true, silent: true });
    fecharPop();
  }
  await write("comentarios", id, null, { noHistory: true });
}

$("#c-novo").onclick = () => modoComentar(!comentando);
$("#c-ver").onclick = () => mostrarComentarios(ocultos);
$("#coment").addEventListener("submit", (e) => {
  e.preventDefault();
  enviarComentario();
});
$("#coment").addEventListener("click", (e) => {
  const b = e.target.closest("[data-cp]");
  if (!b) return;
  if (b.dataset.cp === "fechar") fecharPop();
  else if (b.dataset.cp === "apagar") apagarComentario(b.dataset.id);
});
$("#coment").addEventListener("keydown", (e) => {
  // Enter envia; Shift+Enter pula linha. Não deixa o Enter chegar no resto do site (que tiraria o cursor)
  if (e.key === "Enter" && !e.shiftKey && e.target.id === "cp-txt") {
    e.preventDefault();
    e.stopPropagation();
    enviarComentario();
  } else if (e.key === "Escape") {
    e.stopPropagation();
    fecharPop();
  }
});
$("#coment").addEventListener("input", (e) => e.stopPropagation());
$("#coment").addEventListener("change", (e) => e.stopPropagation());
document.addEventListener("click", (e) => {
  const p = e.target.closest("[data-pin]");
  if (p) {
    if (comentAberto === p.dataset.pin) fecharPop();
    else abrirComentario(p.dataset.pin);
  }
});
document.addEventListener("pointerdown", (e) => {
  if (comentAberto && !e.target.closest("#coment, .pin")) fecharPop();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && comentando) modoComentar(false);
});
addEventListener("resize", posicionarPop);
addEventListener("scroll", posicionarPop, { passive: true }); // no celular a página rola e a janelinha acompanha o alfinete
