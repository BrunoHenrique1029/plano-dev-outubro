/* Desenho do mapa: abas, planos, setas, zoom e "Ver tudo" */
function applyView() {
  const w = $("#world");
  w.style.transform = `translate(${view.tx}px,${view.ty}px) scale(${view.s})`;
  w.style.setProperty("--inv", (1 / view.s).toFixed(3));
  clampTools();
  if (comentAberto) posicionarPop(); // a janelinha do comentário anda junto com o mapa
}
/* o menu do plano nunca fica cortado na borda do quadro (importante em tela estreita) */
function clampTools() {
  const t = document.querySelector("#world .tools");
  if (!t) return;
  t.style.setProperty("--dx", "0px");
  t.style.setProperty("--dy", "0px");
  const b = $("#board").getBoundingClientRect(),
    r = t.getBoundingClientRect(),
    m = 8;
  let dx = 0,
    dy = 0;
  if (r.right > b.right - m) dx = b.right - m - r.right;
  if (r.left + dx < b.left + m) dx = b.left + m - r.left;
  if (r.bottom > b.bottom - m) {
    const nr = t.closest(".node").getBoundingClientRect(),
      up = nr.top - 8 - r.height;
    if (up >= b.top + m) dy = up - r.top;
  }
  t.style.setProperty("--dx", (dx / view.s).toFixed(1) + "px");
  t.style.setProperty("--dy", (dy / view.s).toFixed(1) + "px");
}

const CADEADO =
  '<svg class="cad" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>';
const CADEADO_ABERTO =
  '<svg class="cad" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8 11V8a4 4 0 0 1 7.6-1.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
/* abas: cada mapa tem a cor da pessoa (Todos, Dev, Aquisição ou Conteúdo); mapa com senha mostra o cadeado */
function renderTabs() {
  const list = tabList();
  if (!list.some((m) => m.id === currentMap)) currentMap = list[0].id;
  $("#tabs").innerHTML =
    list
      .map((m) => {
        const cor = `--c:var(--p-${m.who || "all"})`,
          trav = mapaTravado(m.id);
        if (m.id !== currentMap)
          return `<button class="tab" data-tab="${m.id}" style="${cor}"><span class="tdot" aria-hidden="true"></span>${esc(m.name)}${m.senha ? CADEADO : ""}</button>`;
        const chave = !m.senha
          ? ""
          : trav
            ? `<button class="x neutro" data-mapchave="${m.id}" title="Desbloquear para editar">${CADEADO}Desbloquear</button>`
            : `<button class="x neutro" data-mapchave="${m.id}" title="Bloquear de novo neste aparelho" aria-label="Bloquear de novo">${CADEADO_ABERTO}</button>`;
        const apagar =
          trav || list.length < 2
            ? ""
            : confirmMapDel === m.id
              ? `<button class="x" data-mapdelok="${m.id}" style="color:var(--danger)">Apagar mapa e planos</button><button class="x" data-mapdelno="1">Cancelar</button>`
              : `<button class="x" data-mapdel="${m.id}" title="Apagar este mapa">Apagar</button>`;
        return `<span class="tab on" style="${cor}"><span class="tdot" aria-hidden="true"></span><input data-key="map-${m.id}" data-map="${m.id}" value="${esc(m.name)}" ${trav ? "readonly" : ""} aria-label="Nome do mapa">${chave}${
          trav
            ? ""
            : `<button class="x neutro" data-mapopc="${m.id}" title="Nome, pessoa e senha do mapa">Opções</button>`
        }${apagar}</span>`;
      })
      .join("") + `<button class="tab add" id="add-map">+ Novo mapa</button>`;
}

let renderDepois = null;
function render() {
  if (drag || (pointerDown && Date.now() - pointerDown < 1500)) {
    pendingRender = true;
    // se o navegador não avisar que soltou, desenha assim mesmo daqui a pouco
    clearTimeout(renderDepois);
    renderDepois = setTimeout(() => pendingRender && render(), 1600);
    return;
  }
  pendingRender = false;
  const ae = document.activeElement,
    key = ae?.dataset?.key,
    typed = key ? ae.value : null;
  const sel = key ? [ae.selectionStart, ae.selectionEnd] : null;

  renderTabs();
  const list = here(),
    mine = list.filter((n) => !isList(n) && (who === "all" || n.who === who));
  const cnt = { todo: 0, doing: 0, blocked: 0, done: 0 };
  mine.forEach((n) => cnt[statusOf(n)]++);
  const p = mine.length ? Math.round((cnt.done * 100) / mine.length) : 0;
  $("#pct").textContent = p + "%";
  $("#pctbar").style.width = p + "%";
  $("#pcttext").textContent = mine.length
    ? `${cnt.done} de ${mine.length} planos feitos` + (who === "all" ? "" : ` (${WHO[who]})`)
    : "Nenhum plano neste mapa";
  $("#counts").innerHTML = mine.length
    ? `<span><b>${cnt.todo}</b>a fazer</span><span><b>${cnt.doing}</b>fazendo</span><span class="trav"><b>${cnt.blocked}</b>travado</span>`
    : "";
  $("#empty").hidden = list.length > 0;

  const ban = $("#banner");
  if (connectFrom) {
    ban.hidden = false;
    ban.innerHTML = `<span>Agora clique no plano que vai receber este.</span><button data-ban="connect-no">Cancelar</button>`;
  } else if (comentando) {
    ban.hidden = false;
    ban.innerHTML = `<span>${matchMedia("(pointer: coarse)").matches ? "Toque" : "Clique"} no mapa onde quer deixar o comentário.</span><button data-ban="coment-no">Cancelar</button>`;
  } else if (aviso) {
    ban.hidden = false;
    ban.innerHTML = `<span>${esc(aviso)}</span>`;
  } else if (mapaTravado(currentMap)) {
    ban.hidden = false;
    ban.innerHTML = `<span>${CADEADO} Mapa ${DE[mapaInfo(currentMap).who || "all"]} com senha<span class="hide-xs">: dá para ver e comentar</span>.</span><button data-mapchave="${currentMap}">Desbloquear</button>`;
  } else ban.hidden = true;

  const num = topNumbers();
  let h = `<svg id="edges" aria-hidden="true"><defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted);stroke:none"/></marker>${[
    "D",
    "A",
    "C",
    "all",
  ]
    .map(
      (k) =>
        `<marker id="arr-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--p-${k});stroke:none"/></marker>`,
    )
    .join("")}</defs><g id="eg"></g></svg><div class="hubs" id="hubs"></div>`;
  list.forEach((n) => {
    if (!isShown(n)) return;
    const sub = !!parentOf(n),
      c = corDe(n, num),
      isSel = selected === n.id,
      st = statusOf(n),
      lock = travado(n),
      ro = lock ? "readonly" : "",
      off = lock ? "disabled" : "";
    const dim = travadoPessoa(n) || (q && !matches(n)); // mapa com senha fica normal, só não deixa mexer
    const cls = [
      "node",
      sub ? "sub" : "main",
      isSel ? "sel" : "",
      dim ? "dim" : "",
      lock ? "lock" : "",
      q && matches(n) ? "hit" : "",
      st === "done" ? "done" : "",
      st === "doing" ? "st-doing" : "",
      st === "blocked" ? "st-blocked" : "",
      connectFrom && connectFrom !== n.id && !isDesc(n.id, connectFrom) && !isList(n) && !lock
        ? "target"
        : "",
    ].join(" ");
    const sib = irmaos(n),
      si = sib.findIndex((x) => x.id === n.id);
    const tools =
      !isSel || connectFrom || lock
        ? ""
        : `<div class="tools">
        <div class="row">
          <select data-act="who" data-id="${n.id}" aria-label="De quem é">${Object.entries(WHO)
            .map(([k, v]) => `<option value="${k}" ${k === (n.who || "all") ? "selected" : ""}>${v}</option>`)
            .join("")}</select>
          ${
            isList(n)
              ? ""
              : `<select data-act="status" data-id="${n.id}" aria-label="Status">${Object.entries(STATUS)
                  .map(([k, v]) => `<option value="${k}" ${k === st ? "selected" : ""}>${v}</option>`)
                  .join("")}</select>`
          }
          <button data-act="report" data-id="${n.id}">${isInfo(n) ? "Editar texto" : "Relatório"}</button>
          ${isInfo(n) ? `<button data-act="wide" data-id="${n.id}">${n.wide ? "Mais estreito" : "Mais largo"}</button>` : ""}
          ${isList(n) ? "" : `<button data-act="list" data-id="${n.id}">+ Lista</button><button data-act="agenda" data-id="${n.id}">+ Agenda</button><button data-act="info" data-id="${n.id}">+ Informativo</button>`}
        </div>
        <div class="row">
          ${
            sub || isList(n)
              ? sib.length > 1
                ? `<button data-act="antes" data-id="${n.id}" ${si <= 0 ? "disabled" : ""} title="Passar para antes dos outros ligados no mesmo plano">◀ Antes</button><button data-act="depois" data-id="${n.id}" ${si >= sib.length - 1 ? "disabled" : ""} title="Passar para depois dos outros ligados no mesmo plano">Depois ▶</button>`
                : ""
              : `<button data-act="up" data-id="${n.id}" ${si <= 0 ? "disabled" : ""} title="Diminuir o número do passo">◀ Nº</button><button data-act="down" data-id="${n.id}" ${si >= sib.length - 1 ? "disabled" : ""} title="Aumentar o número do passo">Nº ▶</button>`
          }
          ${isList(n) ? "" : `<button data-act="sub" data-id="${n.id}">+ Sub-plano</button>`}
          <button data-act="connect" data-id="${n.id}">Conectar a outro</button>
          ${sub ? `<button data-act="disconnect" data-id="${n.id}">Desconectar</button>` : ""}
          ${
            confirmDel === n.id
              ? `<button class="danger strong" data-act="del-ok" data-id="${n.id}">Confirmar apagar</button><button data-act="del-no">Cancelar</button>`
              : `<button class="danger" data-act="del" data-id="${n.id}">Apagar</button>`
          }
        </div>
        ${n.editedAt ? `<span class="edited">${esc(editedLine(n))}</span>` : ""}
      </div>`;
    const ta = `<textarea rows="1" data-key="${n.id}" data-act="title" data-id="${n.id}" ${ro} placeholder="${sub ? "Nome do sub-plano" : "Nome do plano"}" aria-label="Nome do plano">${esc(n.title)}</textarea>`;
    const ck = `<input type="checkbox" class="ck" data-act="done" data-id="${n.id}" ${st === "done" ? "checked" : ""} ${off} aria-label="Marcar como feito">`;
    const nf = (n.files || []).length;
    // os três pontinhos abrem o mesmo menu de clicar no plano
    const kb = lock
      ? ""
      : `<button class="kebab" data-act="menu" data-id="${n.id}" aria-label="Opções" title="Opções" aria-expanded="${isSel}">${ic(IC.mais, 18)}</button>`;
    const rep = `<button class="rep ${n.report || nf ? "has" : ""}" data-act="report" data-id="${n.id}" aria-label="Abrir relatório" title="Relatório">${ICON}${nf ? `<span class="clip">${nf}</span>` : ""}</button>`;
    const L = n.list || [],
      ld = L.filter((i) => i.done).length;
    // quanto já foi feito do que está ligado ao plano (sub-planos e itens das listas)
    const pg = isList(n) ? { total: 0 } : feitosDe(n.id),
      feitos = pg.total ? `${pg.feito} de ${pg.total} ${pg.total === 1 ? "concluído" : "concluídos"}` : "",
      prog = feitos ? `<div class="nprog">${feitos}</div>` : "";
    const stp =
      st === "doing"
        ? `<span class="stp doing">Fazendo</span>`
        : st === "blocked"
          ? `<span class="stp blocked">Travado</span>`
          : "";
    if (isInfo(n)) {
      const corpo = canon(docHtml(n));
      h += `<div class="${cls.replace(" sub", "").replace(" main", "")} listnode infonode${n.wide ? " wide" : ""}" data-id="${n.id}" style="left:${n.x || 0}px;top:${n.y || 0}px;--c:${c}">
        <div class="lhead"><span class="lic" title="Informativo · ${WHO[n.who || "all"]}">${ic(IC.info, 20)}</span><span class="lmeio"><textarea rows="1" data-key="${n.id}" data-act="title" data-id="${n.id}" ${ro} placeholder="Título do informativo" aria-label="Título do informativo">${esc(n.title)}</textarea></span><span class="right"><button class="info-ed" data-act="report" data-id="${n.id}" title="${lock ? "Ler" : "Editar"} o informativo">${ic(IC.abrir, 17)}<span class="sr">${lock ? "Ler" : "Editar"}</span></button>${kb}</span></div>
        ${corpo ? `<div class="ed info-corpo" data-id="${n.id}">${corpo}</div>` : lock ? "" : `<button class="add-li" data-act="report" data-id="${n.id}">+ Escrever o informativo</button>`}
        ${tools}</div>`;
      return;
    }
    if (isAgenda(n)) {
      h += `<div class="${cls.replace(" sub", "").replace(" main", "")} listnode agendanode" data-id="${n.id}" style="left:${n.x || 0}px;top:${n.y || 0}px;--c:${c}">${agendaRows(n, rep, kb)}${tools}</div>`;
      return;
    }
    if (isList(n)) {
      const pct = L.length ? Math.round((ld * 100) / L.length) : 0;
      h += `<div class="${cls.replace(" sub", "").replace(" main", "")} listnode" data-id="${n.id}" style="left:${n.x || 0}px;top:${n.y || 0}px;--c:${c}">
        <div class="lhead"><span class="lic">${ic(IC.lista, 20)}</span><span class="lmeio"><textarea rows="1" data-key="${n.id}" data-act="title" data-id="${n.id}" ${ro} placeholder="Nome da lista" aria-label="Nome da lista">${esc(n.title)}</textarea><span class="lt">Lista · ${WHO[n.who || "all"]} · <span class="lc">${ld}/${L.length}</span></span></span><span class="right">${rep}${kb}</span></div>
        <div class="lbar"><i style="width:${pct}%"></i></div>
        <table class="mtable"><tbody>${L.map(
          (i) => `<tr class="${i.done ? "ok" : ""}">
          <td class="c"><input type="checkbox" class="lck" data-mli-done="${i.id}" data-id="${n.id}" ${i.done ? "checked" : ""} ${off} aria-label="Marcar item"></td>
          <td><textarea rows="1" class="li" data-key="li-${i.id}" data-mli-text="${i.id}" data-id="${n.id}" ${ro} placeholder="Escreva o item" aria-label="Item da lista">${esc(i.text)}</textarea></td>
          <td class="a"><button class="rep ${i.report || (i.files || []).length ? "has" : ""}" data-act="report" data-id="${n.id}" data-item="${i.id}" aria-label="Abrir relatório do item" title="Relatório do item">${ICON}${(i.files || []).length ? `<span class="clip">${i.files.length}</span>` : ""}</button><button class="del" data-mli-del="${i.id}" data-id="${n.id}" aria-label="Apagar item">✕</button></td></tr>`,
        ).join("")}</tbody></table>
        <button class="add-li" data-mli-add="1" data-id="${n.id}">+ Item</button>
        ${tools}</div>`;
      return;
    }
    h += sub
      ? `<div class="${cls}" data-id="${n.id}" style="left:${n.x || 0}px;top:${n.y || 0}px;--c:${c}"><span class="nic">${icQuem(n, 22)}</span><span class="body"><span class="ntop">${ta}${kb}</span><span class="who-lbl" title="${WHO[n.who || "all"]}"><span>${feitos || WHO[n.who || "all"]}</span>${stp}<span class="nlado">${rep}${ck}</span></span></span>${tools}</div>`
      : `<div class="${cls}" data-id="${n.id}" style="left:${n.x || 0}px;top:${n.y || 0}px;--c:${c}"><div class="nhead"><span class="npasso"><span class="nnum">${num[n.id]}</span>Passo ${num[n.id]} · ${WHO[n.who || "all"]}</span><span class="right">${stp}${rep}${ck}${kb}</span></div><div class="ncorpo">${ta}${prog}</div>${tools}</div>`;
  });
  $("#world").innerHTML = h + `<div class="pins" id="pins"></div>`;
  document.querySelectorAll("#world .info-corpo").forEach(showAssets);
  applyView();
  if (reportId) fillDrawer();

  const fk = pendingFocus || key;
  if (fk) {
    const el = document.querySelector(`[data-key="${fk}"]`);
    if (el) {
      if (!pendingFocus && typed !== null) {
        el.value = typed;
        try {
          el.setSelectionRange(sel[0], sel[1]);
        } catch (e) {}
      }
      el.focus({ preventScroll: true });
      if (pendingFocus === fk) pendingFocus = null;
    }
  }
  drawEdges();
}

function box(n) {
  const el = document.querySelector(`.node[data-id="${n.id}"]`);
  const w = el ? el.offsetWidth : MAIN_W,
    h = el ? el.offsetHeight : 80;
  return { cx: (n.x || 0) + w / 2, cy: (n.y || 0) + h / 2, w: w / 2, h: h / 2 };
}
function clip(b, dx, dy) {
  const t = Math.min(dx ? b.w / Math.abs(dx) : Infinity, dy ? b.h / Math.abs(dy) : Infinity);
  return [b.cx + dx * t, b.cy + dy * t];
}
function seg(a, b) {
  const A = box(a),
    B = box(b),
    dx = B.cx - A.cx,
    dy = B.cy - A.cy;
  if (!dx && !dy) return null;
  const [x1, y1] = clip(A, dx, dy),
    [x2, y2] = clip(B, -dx, -dy);
  return { x1, y1, x2, y2 };
}
/* ponto onde a ramificação começa: no lado do plano virado para as ramificações */
function hubPoint(p) {
  const B = box(p),
    ks = kids(p.id);
  if (!ks.length) return null;
  let sx = 0,
    sy = 0;
  ks.forEach((k) => {
    const b = box(k);
    sx += b.cx;
    sy += b.cy;
  });
  const dx = sx / ks.length - B.cx,
    dy = sy / ks.length - B.cy;
  if (Math.abs(dy) / B.h >= Math.abs(dx) / B.w) {
    if (dy < 0) return { x: B.cx, y: B.cy - B.h };
    // ramificações embaixo: o botão vai para perto da borda esquerda, de onde sai o "tronco" até cada ramificação
    const minLeft = Math.min(
      ...ks.map((k) => {
        const b = box(k);
        return b.cx - b.w;
      }),
    );
    if (minLeft >= B.cx - B.w + 20)
      return {
        x: Math.max(B.cx - B.w + 16, Math.min(B.cx, minLeft - 16)),
        y: B.cy + B.h,
        down: true,
        trunk: true,
      };
    return { x: B.cx, y: B.cy + B.h, down: true };
  }
  return { x: dx >= 0 ? B.cx + B.w : B.cx - B.w, y: B.cy };
}
const FIELD_SIZING = typeof CSS !== "undefined" && CSS.supports && CSS.supports("field-sizing", "content");
function autosize(el) {
  if (FIELD_SIZING) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}
function drawEdges() {
  if (!FIELD_SIZING) document.querySelectorAll(".node textarea").forEach(autosize);
  const g = document.getElementById("eg");
  if (!g) return;
  let out = "";
  const tops = steps(null);
  for (let i = 0; i < tops.length - 1; i++) {
    const s = seg(tops[i], tops[i + 1]);
    if (s)
      out += `<path d="M${s.x1},${s.y1} L${s.x2},${s.y2}" style="stroke:var(--muted)" stroke-width="2.5" marker-end="url(#arr)"/>`;
  }
  const hubs = {};
  let hb = "";
  here().forEach((n) => {
    if (isShown(n) && kids(n.id).length) hubs[n.id] = hubPoint(n);
  });
  here().forEach((n) => {
    const p = parentOf(n);
    if (!p || !isShown(n) || !hubs[p]) return;
    const h = hubs[p],
      B = box(n),
      dx = h.x - B.cx,
      dy = h.y - B.cy;
    if (!dx && !dy) return;
    const left = B.cx - B.w,
      top = B.cy - B.h;
    if (h.trunk && left >= h.x + 8 && top > h.y) {
      out += `<path d="M${h.x},${h.y} V${B.cy} H${left - 1}" style="stroke:var(--p-${n.who || "all"})" stroke-width="2.2" stroke-linejoin="round" marker-end="url(#arr-${n.who || "all"})"/>`;
      return;
    }
    if (h.down && top > h.y + 24) {
      const my = h.y + Math.min(26, (top - h.y) / 2);
      out += `<path d="M${h.x},${h.y} V${my} H${B.cx} V${top - 1}" style="stroke:var(--p-${n.who || "all"})" stroke-width="2.2" stroke-linejoin="round" marker-end="url(#arr-${n.who || "all"})"/>`;
      return;
    }
    const [x2, y2] = clip(B, dx, dy);
    out += `<path d="M${h.x},${h.y} L${x2},${y2}" style="stroke:var(--p-${n.who || "all"})" stroke-width="2.2" marker-end="url(#arr-${n.who || "all"})"/>`;
  });
  const num = topNumbers();
  for (const [id, h] of Object.entries(hubs)) {
    const n = get(id),
      c = fechado(n),
      k = descCount(id);
    hb += `<button class="hub ${c ? "closed" : ""} ${travadoPessoa(n) ? "lock" : ""}" data-act="fold" data-id="${id}" style="left:${h.x}px;top:${h.y}px;--c:${corDe(n, num)}" aria-expanded="${!c}" title="${c ? `Abrir ramificações (${k})` : "Fechar ramificações"}" aria-label="${c ? "Abrir ramificações" : "Fechar ramificações"}">${c ? "+" : "−"}${c ? `<span class="n">${k}</span>` : ""}</button>`;
  }
  g.innerHTML = out;
  const hd = document.getElementById("hubs");
  if (hd) hd.innerHTML = hb;
  drawPins();
}
/* all = "Ver tudo". Sem ele, em tela pequena o mapa não fica minúsculo: começa legível pelo início do fluxo. */
function fit(all) {
  const b = $("#board").getBoundingClientRect(),
    list = here().filter(isShown);
  if (!list.length) {
    view = { tx: 40, ty: 40, s: 1 };
    applyView();
    return;
  }
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  list.forEach((n) => {
    const r = box(n);
    x0 = Math.min(x0, r.cx - r.w);
    y0 = Math.min(y0, r.cy - r.h);
    x1 = Math.max(x1, r.cx + r.w);
    y1 = Math.max(y1, r.cy + r.h);
  });
  // "Ver tudo" mostra também os comentários que estão fora dos planos
  if (all === true && !ocultos)
    raizes()
      .filter(visivel)
      .forEach((c) => {
        const p = posDe(c);
        x0 = Math.min(x0, p.x);
        y0 = Math.min(y0, p.y - 34);
        x1 = Math.max(x1, p.x + 34);
        y1 = Math.max(y1, p.y);
      });
  const pad = b.width < 600 ? 28 : 60,
    minS = b.width < 600 ? 0.18 : 0.3;
  const s = Math.max(minS, Math.min(1, (b.width - pad) / (x1 - x0 || 1), (b.height - 90) / (y1 - y0 || 1)));
  const readable = 0.55;
  if (all !== true && b.width < 600 && s < readable) {
    view = {
      s: readable,
      tx: 16 - x0 * readable,
      ty: Math.max(16, (b.height - (y1 - y0) * readable) / 2 - y0 * readable - 20),
    };
    if ((y1 - y0) * readable > b.height - 90) view.ty = 24 - y0 * readable;
    applyView();
    return;
  }
  view = {
    s,
    tx: (b.width - (x1 - x0) * s) / 2 - x0 * s,
    ty: Math.max(16, (b.height - (y1 - y0) * s) / 2 - y0 * s - 20),
  };
  applyView();
}
function zoom(f) {
  const b = $("#board").getBoundingClientRect(),
    cx = b.width / 2,
    cy = b.height / 2,
    s = Math.max(0.15, Math.min(2, view.s * f));
  view.tx = cx - (cx - view.tx) * (s / view.s);
  view.ty = cy - (cy - view.ty) * (s / view.s);
  view.s = s;
  applyView();
}
