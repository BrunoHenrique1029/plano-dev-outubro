/* Desenho do mapa: abas, planos, setas, zoom e "Ver tudo" */
function applyView() {
  const w = $("#world");
  w.style.transform = `translate(${view.tx}px,${view.ty}px) scale(${view.s})`;
  w.style.setProperty("--inv", (1 / view.s).toFixed(3));
  clampTools();
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

function renderTabs() {
  const list = tabList();
  if (!list.some((m) => m.id === currentMap)) currentMap = list[0].id;
  $("#tabs").innerHTML =
    list
      .map((m) =>
        m.id === currentMap
          ? `<span class="tab on"><input data-key="map-${m.id}" data-map="${m.id}" value="${esc(m.name)}" aria-label="Nome do mapa">${
              list.length > 1
                ? confirmMapDel === m.id
                  ? `<button class="x" data-mapdelok="${m.id}" style="color:var(--danger)">Apagar mapa e planos</button><button class="x" data-mapdelno="1">Cancelar</button>`
                  : `<button class="x" data-mapdel="${m.id}" title="Apagar este mapa">Apagar</button>`
                : ""
            }</span>`
          : `<button class="tab" data-tab="${m.id}">${esc(m.name)}</button>`,
      )
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
    ? `<span>A fazer <b>${cnt.todo}</b></span><span>Fazendo <b>${cnt.doing}</b></span><span style="color:var(--st-blocked)">Travado <b>${cnt.blocked}</b></span>`
    : "";
  $("#empty").hidden = list.length > 0;

  const ban = $("#banner");
  if (connectFrom) {
    ban.hidden = false;
    ban.innerHTML = `<span>Agora clique no plano que vai receber este.</span><button data-ban="connect-no">Cancelar</button>`;
  } else if (aviso) {
    ban.hidden = false;
    ban.innerHTML = `<span>${esc(aviso)}</span>`;
  } else ban.hidden = true;

  const num = topNumbers();
  let h = `<svg id="edges" aria-hidden="true"><defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted);stroke:none"/></marker></defs><g id="eg"></g></svg><div class="hubs" id="hubs"></div>`;
  list.forEach((n) => {
    if (!isShown(n)) return;
    const sub = !!parentOf(n),
      c = `var(--p-${n.who || "all"})`,
      isSel = selected === n.id,
      st = statusOf(n),
      lock = travado(n),
      ro = lock ? "readonly" : "",
      off = lock ? "disabled" : "";
    const dim = lock || (q && !matches(n));
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
    const sib = steps(parentOf(n)),
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
          <button data-act="report" data-id="${n.id}">Relatório</button>
          ${isList(n) ? "" : `<button data-act="list" data-id="${n.id}">+ Lista</button><button data-act="agenda" data-id="${n.id}">+ Agenda</button>`}
        </div>
        <div class="row">
          ${sub || isList(n) ? "" : `<button data-act="up" data-id="${n.id}" ${si <= 0 ? "disabled" : ""} title="Diminuir o número do passo">◀ Nº</button><button data-act="down" data-id="${n.id}" ${si >= sib.length - 1 ? "disabled" : ""} title="Aumentar o número do passo">Nº ▶</button>`}
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
    const rep = `<button class="rep ${n.report || nf ? "has" : ""}" data-act="report" data-id="${n.id}" aria-label="Abrir relatório" title="Relatório">${ICON}${nf ? `<span class="clip">${nf}</span>` : ""}</button>`;
    const L = n.list || [],
      ld = L.filter((i) => i.done).length;
    const stp =
      st === "doing"
        ? `<span class="stp doing">Fazendo</span>`
        : st === "blocked"
          ? `<span class="stp blocked">Travado</span>`
          : "";
    if (isAgenda(n)) {
      h += `<div class="${cls.replace(" sub", "").replace(" main", "")} listnode agendanode" data-id="${n.id}" style="left:${n.x || 0}px;top:${n.y || 0}px;--c:${c}">${agendaRows(n, rep)}${tools}</div>`;
      return;
    }
    if (isList(n)) {
      const pct = L.length ? Math.round((ld * 100) / L.length) : 0;
      h += `<div class="${cls.replace(" sub", "").replace(" main", "")} listnode" data-id="${n.id}" style="left:${n.x || 0}px;top:${n.y || 0}px;--c:${c}">
        <div class="lhead"><span>Lista · ${WHO[n.who || "all"]}</span><span class="right"><span class="lc">${ld}/${L.length}</span>${rep}</span></div>
        <textarea rows="1" data-key="${n.id}" data-act="title" data-id="${n.id}" ${ro} placeholder="Nome da lista" aria-label="Nome da lista">${esc(n.title)}</textarea>
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
      ? `<div class="${cls}" data-id="${n.id}" style="left:${n.x || 0}px;top:${n.y || 0}px;--c:${c}"><span class="body">${ta}<span class="who-lbl">${WHO[n.who || "all"]}${stp}</span></span>${rep}${ck}${tools}</div>`
      : `<div class="${cls}" data-id="${n.id}" style="left:${n.x || 0}px;top:${n.y || 0}px;--c:${c}"><div class="nhead"><span>Passo ${num[n.id]} · ${WHO[n.who || "all"]}</span><span class="right">${stp}${rep}${ck}</span></div>${ta}${tools}</div>`;
  });
  $("#world").innerHTML = h;
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
      out += `<path d="M${s.x1},${s.y1} L${s.x2},${s.y2}" style="stroke:var(--muted)" stroke-width="3" marker-end="url(#arr)"/>`;
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
      out += `<path d="M${h.x},${h.y} V${B.cy} H${left}" style="stroke:var(--p-${n.who || "all"})" stroke-width="3" stroke-linejoin="round"/>`;
      return;
    }
    if (h.down && top > h.y + 24) {
      const my = h.y + Math.min(26, (top - h.y) / 2);
      out += `<path d="M${h.x},${h.y} V${my} H${B.cx} V${top}" style="stroke:var(--p-${n.who || "all"})" stroke-width="3" stroke-linejoin="round"/>`;
      return;
    }
    const [x2, y2] = clip(B, dx, dy);
    out += `<path d="M${h.x},${h.y} L${x2},${y2}" style="stroke:var(--p-${n.who || "all"})" stroke-width="3"/>`;
  });
  for (const [id, h] of Object.entries(hubs)) {
    const n = get(id),
      c = n.collapsed,
      k = descCount(id);
    hb += `<button class="hub ${c ? "closed" : ""} ${travado(n) ? "lock" : ""}" data-act="fold" data-id="${id}" style="left:${h.x}px;top:${h.y}px;--c:var(--p-${n.who || "all"})" aria-expanded="${!c}" title="${c ? `Abrir ramificações (${k})` : "Fechar ramificações"}" aria-label="${c ? "Abrir ramificações" : "Fechar ramificações"}">${c ? "+" : "−"}${c ? `<span class="n">${k}</span>` : ""}</button>`;
  }
  g.innerHTML = out;
  const hd = document.getElementById("hubs");
  if (hd) hd.innerHTML = hb;
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
