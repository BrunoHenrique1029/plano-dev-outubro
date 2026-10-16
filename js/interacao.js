/* Arrastar planos, mover o quadro, zoom de pinça e cliques nos botões do mapa */
const board = $("#board");
document.addEventListener(
  "pointerdown",
  () => {
    pointerDown = true;
  },
  true,
);
document.addEventListener(
  "pointerup",
  () =>
    setTimeout(() => {
      pointerDown = false;
      if (pendingRender && !drag) {
        pendingRender = false;
        render();
      }
    }, 0),
  true,
);
/* dois dedos: zoom de pinça no celular e no tablet */
const fingers = new Map();
let pinch = null;
function endDrag() {
  const d = drag;
  drag = null;
  board.classList.remove("panning");
  if (d && d.el && d.moved) {
    const n = get(d.id),
      pos = { x: n.x, y: n.y };
    n.x = d.before.x;
    n.y = d.before.y;
    d.el.classList.remove("dragging");
    write("nodes", d.id, pos);
  }
}
board.addEventListener(
  "pointerdown",
  (e) => {
    if (e.pointerType !== "touch") return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2) {
      endDrag();
      const [a, c] = [...fingers.values()],
        r = board.getBoundingClientRect();
      pinch = {
        d: Math.hypot(a.x - c.x, a.y - c.y) || 1,
        s: view.s,
        wx: ((a.x + c.x) / 2 - r.left - view.tx) / view.s,
        wy: ((a.y + c.y) / 2 - r.top - view.ty) / view.s,
      };
    }
  },
  true,
);
board.addEventListener(
  "pointermove",
  (e) => {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!pinch || fingers.size < 2) return;
    const [a, c] = [...fingers.values()],
      r = board.getBoundingClientRect();
    const s = Math.max(0.15, Math.min(2, (pinch.s * Math.hypot(a.x - c.x, a.y - c.y)) / pinch.d));
    view.s = s;
    view.tx = (a.x + c.x) / 2 - r.left - pinch.wx * s;
    view.ty = (a.y + c.y) / 2 - r.top - pinch.wy * s;
    applyView();
  },
  true,
);
const fingerUp = (e) => {
  fingers.delete(e.pointerId);
  if (fingers.size < 2) pinch = null;
};
board.addEventListener("pointerup", fingerUp, true);
board.addEventListener("pointercancel", fingerUp, true);
board.addEventListener("pointerdown", (e) => {
  if (pinch) return;
  if (e.target.closest(".zoom,.banner,.tools,textarea,select,button,input,a")) return;
  const el = e.target.closest(".node");
  drag = {
    id: el?.dataset.id || null,
    el,
    sx: e.clientX,
    sy: e.clientY,
    moved: false,
    ox: el ? get(el.dataset.id).x || 0 : view.tx,
    oy: el ? get(el.dataset.id).y || 0 : view.ty,
  };
  board.setPointerCapture(e.pointerId);
  if (!el) board.classList.add("panning");
});
board.addEventListener("pointermove", (e) => {
  if (!drag || pinch) return;
  const dx = e.clientX - drag.sx,
    dy = e.clientY - drag.sy;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  if (!drag.moved && drag.el) drag.before = { x: get(drag.id).x, y: get(drag.id).y };
  drag.moved = true;
  if (drag.el) {
    const n = get(drag.id);
    n.x = Math.round(drag.ox + dx / view.s);
    n.y = Math.round(drag.oy + dy / view.s);
    drag.el.style.left = n.x + "px";
    drag.el.style.top = n.y + "px";
    drag.el.classList.add("dragging");
    drawEdges();
  } else {
    view.tx = drag.ox + dx;
    view.ty = drag.oy + dy;
    applyView();
  }
});
board.addEventListener("pointerup", () => {
  if (!drag) return;
  const d = drag;
  drag = null;
  board.classList.remove("panning");
  if (d.el && d.moved) {
    const n = get(d.id),
      pos = { x: n.x, y: n.y };
    n.x = d.before.x;
    n.y = d.before.y; // para o desfazer guardar a posição anterior
    write("nodes", d.id, pos);
    return;
  }
  if (d.el) {
    if (connectFrom) {
      connect(connectFrom, d.id);
      return;
    }
    if (selected !== d.id) {
      selected = d.id;
      confirmDel = null;
    }
    pendingRender = true;
    return;
  }
  if (!d.moved) {
    connectFrom = null;
    selected = null;
    confirmDel = null;
    pendingRender = true;
  }
});
board.addEventListener("pointercancel", endDrag);
board.addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1.1 : 0.9);
    }
  },
  { passive: false },
);

document.addEventListener("click", (e) => {
  pointerDown = false;
  const t = e.target;
  const c = t.closest(".chip[data-who]");
  if (c) {
    who = c.dataset.who;
    document.querySelectorAll(".chip[data-who]").forEach((x) => x.setAttribute("aria-pressed", x === c));
    render();
    return;
  }
  const tab = t.closest("[data-tab]");
  if (tab) {
    switchMap(tab.dataset.tab);
    return;
  }
  if (t.closest("#add-map")) {
    addMap();
    return;
  }
  const md = t.closest("[data-mapdel]");
  if (md) {
    confirmMapDel = md.dataset.mapdel;
    render();
    return;
  }
  if (t.closest("[data-mapdelno]")) {
    confirmMapDel = null;
    render();
    return;
  }
  const mok = t.closest("[data-mapdelok]");
  if (mok) {
    deleteMap(mok.dataset.mapdelok);
    return;
  }
  const bn = t.closest("[data-ban]");
  if (bn) {
    connectFrom = null;
    render();
    return;
  }
  const mdel = t.closest("[data-mli-del]");
  if (mdel) {
    saveList(
      mdel.dataset.id,
      listOf(mdel.dataset.id).filter((x) => x.id !== mdel.dataset.mliDel),
    );
    return;
  }
  const madd = t.closest("[data-mli-add]");
  if (madd) {
    const id = madd.dataset.id,
      list = listOf(id),
      li = { id: rid(), text: "", done: false };
    list.push(li);
    pendingFocus = "li-" + li.id;
    saveList(id, list);
    return;
  }
  const b = t.closest("button[data-act]");
  if (!b) {
    if (pendingRender) {
      pendingRender = false;
      render();
    }
    return;
  }
  const id = b.dataset.id;
  switch (b.dataset.act) {
    case "report":
      openReport(id, false, b.dataset.item || null);
      break;
    case "fold":
      toggleFold(id);
      break;
    case "list":
      addListNode(id);
      break;
    case "agenda":
      addListNode(id, "agenda");
      break;
    case "mtg-add":
      openMeeting(id, null);
      break;
    case "mtg-open":
      openMeeting(id, b.dataset.item);
      break;
    case "ag-past":
      if (showPast.has(id)) showPast.delete(id);
      else showPast.add(id);
      render();
      break;
    case "up":
      shift(id, -1);
      break;
    case "down":
      shift(id, 1);
      break;
    case "sub":
      addSub(id);
      break;
    case "connect":
      connectFrom = id;
      selected = null;
      render();
      break;
    case "disconnect":
      disconnect(id);
      break;
    case "del":
      confirmDel = id;
      render();
      break;
    case "del-no":
      confirmDel = null;
      render();
      break;
    case "del-ok":
      remove(id);
      break;
  }
});
document.addEventListener("focusin", (e) => {
  const t = e.target;
  if (t.dataset?.act === "title" && selected !== t.dataset.id && !connectFrom) {
    selected = t.dataset.id;
    confirmDel = null;
    render();
  }
});
document.addEventListener("change", (e) => {
  const t = e.target,
    id = t.dataset.id;
  if (t.dataset.act === "title" && t.value !== (get(id)?.title || "")) write("nodes", id, { title: t.value });
  if (t.dataset.act === "who") write("nodes", id, { who: t.value });
  if (t.dataset.act === "status") setStatus(id, t.value);
  if (t.dataset.act === "done") setStatus(id, t.checked ? "done" : "todo");
  if (t.dataset.mliDone) {
    const list = listOf(id),
      i = list.find((x) => x.id === t.dataset.mliDone);
    if (i) {
      i.done = t.checked;
      saveList(id, list);
    }
  }
  if (t.dataset.mliText) {
    const list = listOf(id),
      i = list.find((x) => x.id === t.dataset.mliText);
    if (i && i.text !== t.value) {
      i.text = t.value;
      saveList(id, list);
    }
  }
  if (t.dataset.map) renameMap(t.dataset.map, t.value);
});
