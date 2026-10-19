/* Ações nos planos: criar, conectar, mudar de lugar, organizar, apagar; e as abas de mapas */
/* ---------- ações nos planos ---------- */
function viewCenter() {
  const b = $("#board").getBoundingClientRect();
  return { x: (b.width / 2 - view.tx) / view.s - MAIN_W / 2, y: (b.height / 2 - view.ty) / view.s - 40 };
}
/* empurra os planos para nada ficar em cima de nada */
async function resolveLayout(anchorId, opt = {}) {
  const vis = here().filter(isShown);
  if (vis.length < 2) return;
  const pos = {},
    size = {};
  vis.forEach((n) => {
    pos[n.id] = { x: n.x || 0, y: n.y || 0 };
    const el = document.querySelector(`.node[data-id="${n.id}"]`);
    size[n.id] = { w: el ? el.offsetWidth : MAIN_W, h: el ? el.offsetHeight : 80 };
  });
  const M = 24;
  const rootOf = (n) => {
    let r = n;
    while (parentOf(r)) r = get(r.parent);
    return r.id;
  };
  const desc = (id) => {
    const out = [];
    const walk = (p) =>
      kids(p)
        .filter(isShown)
        .forEach((k) => {
          out.push(k.id);
          walk(k.id);
        });
    walk(id);
    return out;
  };
  const rect = (id) => ({
    x0: pos[id].x,
    y0: pos[id].y,
    x1: pos[id].x + size[id].w,
    y1: pos[id].y + size[id].h,
  });
  const over = (a, b) => !(a.x1 + M <= b.x0 || b.x1 + M <= a.x0 || a.y1 + M <= b.y0 || b.y1 + M <= a.y0);
  const shiftIds = (ids, dx, dy) =>
    ids.forEach((id) => {
      pos[id].x += dx;
      pos[id].y += dy;
    });
  const groups = {};
  vis.forEach((n) => (groups[rootOf(n)] ||= []).push(n.id));
  // 1. dentro de cada grupo: ramificações que se sobrepõem descem
  for (const gid of Object.keys(groups)) {
    const order = [gid, ...desc(gid)];
    for (let pass = 0; pass < 6; pass++) {
      let moved = false;
      for (let i = 1; i < order.length; i++)
        for (let j = 0; j < i; j++) {
          const a = rect(order[i]),
            b = rect(order[j]);
          if (over(a, b) && !desc(order[i]).includes(order[j])) {
            shiftIds([order[i], ...desc(order[i])], 0, b.y1 + M - a.y0);
            moved = true;
          }
        }
      if (!moved) break;
    }
  }
  // 2. grupos diferentes: o grupo aberto fica parado e empurra os outros
  const grect = (gid) =>
    groups[gid]
      .map(rect)
      .reduce((r, q) => ({
        x0: Math.min(r.x0, q.x0),
        y0: Math.min(r.y0, q.y0),
        x1: Math.max(r.x1, q.x1),
        y1: Math.max(r.y1, q.y1),
      }));
  const anchor = anchorId && get(anchorId) ? rootOf(get(anchorId)) : Object.keys(groups)[0];
  const ac = grect(anchor),
    acx = (ac.x0 + ac.x1) / 2,
    acy = (ac.y0 + ac.y1) / 2;
  const others = Object.keys(groups)
    .filter((g) => g !== anchor)
    .sort((g1, g2) => {
      const r1 = grect(g1),
        r2 = grect(g2);
      return (
        Math.hypot((r1.x0 + r1.x1) / 2 - acx, (r1.y0 + r1.y1) / 2 - acy) -
        Math.hypot((r2.x0 + r2.x1) / 2 - acx, (r2.y0 + r2.y1) / 2 - acy)
      );
    });
  const settled = [anchor];
  for (const g of others) {
    for (let k = 0; k < 30; k++) {
      const gr = grect(g),
        hit = settled.map((sg) => grect(sg)).find((sr) => over(gr, sr));
      if (!hit) break;
      const gcx = (gr.x0 + gr.x1) / 2,
        gcy = (gr.y0 + gr.y1) / 2,
        scx = (hit.x0 + hit.x1) / 2,
        scy = (hit.y0 + hit.y1) / 2;
      const dxs = gcx >= scx ? hit.x1 + M - gr.x0 : hit.x0 - M - gr.x1;
      const dys = gcy >= scy ? hit.y1 + M - gr.y0 : hit.y0 - M - gr.y1;
      if (Math.abs(dxs) <= Math.abs(dys)) shiftIds(groups[g], dxs, 0);
      else shiftIds(groups[g], 0, dys);
    }
    settled.push(g);
  }
  for (const n of vis) {
    const p = pos[n.id];
    if (Math.round(p.x) !== Math.round(n.x || 0) || Math.round(p.y) !== Math.round(n.y || 0))
      await write(
        "nodes",
        n.id,
        { x: Math.round(p.x), y: Math.round(p.y) },
        { silent: true, noHistory: !!opt.noHistory },
      );
  }
  render();
}
async function toggleFold(id) {
  const n = get(id);
  if (!n) return;
  if (mapaTravado(mapOf(n))) {
    dobras[id] = !fechado(n);
    return render();
  }
  begin();
  await write("nodes", id, { collapsed: !n.collapsed });
  if (!get(id).collapsed) await resolveLayout(id);
  commit();
  render();
}

// num mapa do Dev, da Aquisição ou do Conteúdo, o que é criado já começa sendo dessa pessoa
const quemNovo = () => {
  const m = mapaInfo(currentMap).who;
  return m && m !== "all" ? m : who === "all" ? "D" : who;
};
function addMain() {
  if (!mapaLivre()) return;
  const tops = steps(null),
    last = tops[tops.length - 1],
    id = rid();
  const pos = last ? { x: (last.x || 0) + 300, y: last.y || 0 } : viewCenter();
  pendingFocus = id;
  selected = id;
  write("nodes", id, {
    map: currentMap,
    title: "",
    who: quemNovo(),
    status: "todo",
    done: false,
    parent: null,
    order: last ? (last.order || 0) + 1 : 1,
    x: Math.round(pos.x),
    y: Math.round(pos.y),
  });
}
async function addSub(pid) {
  const p = get(pid),
    ks = kids(pid),
    id = rid();
  if (p.collapsed) {
    begin();
    await write("nodes", pid, { collapsed: false });
    commit();
  }
  const pe = document.querySelector(`.node[data-id="${pid}"]`),
    ph = pe ? pe.offsetHeight : 90;
  pendingFocus = id;
  selected = id;
  begin();
  await write("nodes", id, {
    map: currentMap,
    title: "",
    who: p.who && p.who !== "all" ? p.who : "D",
    status: "todo",
    done: false,
    parent: pid,
    order: ks.length ? (ks[ks.length - 1].order || 0) + 1 : 1,
    x: Math.round((p.x || 0) + 20),
    y: Math.round((p.y || 0) + ph + 30 + ks.length * 80),
  });
  await resolveLayout(pid);
  commit();
  const el = document.querySelector(`[data-key="${id}"]`);
  if (el) el.focus({ preventScroll: true });
}
async function addListNode(pid, kind = "list") {
  if (!mapaLivre()) return;
  const id = rid(),
    p = pid ? get(pid) : null,
    ag = kind === "agenda",
    info = kind === "info";
  if (p && p.collapsed) {
    begin();
    await write("nodes", pid, { collapsed: false });
    commit();
  }
  let pos;
  if (p) {
    const pe = document.querySelector(`.node[data-id="${pid}"]`),
      pw = pe ? pe.offsetWidth : MAIN_W;
    pos = {
      x: (p.x || 0) + pw + 60 + kids(pid).filter(isList).length * 30,
      y: (p.y || 0) + kids(pid).filter(isList).length * 30,
    };
  } else {
    const others = here();
    if (others.length) {
      let mx = -Infinity,
        my = Infinity;
      others.forEach((o) => {
        const r = box(o);
        mx = Math.max(mx, r.cx + r.w);
        my = Math.min(my, r.cy - r.h);
      });
      pos = { x: mx + 60, y: my };
    } else pos = viewCenter();
  }
  const who0 = p && p.who && p.who !== "all" ? p.who : quemNovo();
  const first = { id: rid(), text: "", done: false };
  pendingFocus = ag ? null : info ? id : "li-" + first.id;
  selected = null;
  const ks = pid ? kids(pid) : [];
  begin();
  await write("nodes", id, {
    map: currentMap,
    kind,
    title: "",
    who: who0,
    parent: pid || null,
    order: ks.length ? (ks[ks.length - 1].order || 0) + 1 : 1,
    x: Math.round(pos.x),
    y: Math.round(pos.y),
    ...(info ? {} : { list: ag ? [] : [first] }),
  });
  await resolveLayout(id);
  commit();
  if (ag) {
    openMeeting(id, null);
    return;
  }
  const el = document.querySelector(`[data-key="${info ? id : "li-" + first.id}"]`);
  if (el) el.focus({ preventScroll: true });
}

function listOf(id) {
  return (get(id)?.list || []).map((i) => ({ ...i }));
}
async function saveList(id, list) {
  await write("nodes", id, { list }, { silent: true });
  render();
}

async function connect(from, to) {
  connectFrom = null;
  if (travado(get(to))) {
    avisar(avisoTravado(get(to)));
    return;
  }
  if (from === to || isDesc(to, from) || isList(get(to))) {
    render();
    return;
  }
  const ks = kids(to);
  if (get(to).collapsed) await write("nodes", to, { collapsed: false });
  await write("nodes", from, { parent: to, order: ks.length ? (ks[ks.length - 1].order || 0) + 1 : 1 });
}
async function disconnect(id) {
  const tops = kids(null);
  await write("nodes", id, { parent: null, order: tops.length ? (tops[tops.length - 1].order || 0) + 1 : 1 });
}
/* muda a ordem entre os irmãos. Nos passos, troca o número. No que está ligado a um plano, os dois
   também trocam de lugar no quadro, para a ordem nova aparecer na hora (e o Organizar segue a mesma ordem) */
async function shift(id, dir) {
  const n = get(id),
    sib = irmaos(n),
    i = sib.findIndex((x) => x.id === id),
    j = i + dir;
  if (i < 0 || j < 0 || j >= sib.length) return;
  const nova = [...sib];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  const lugar = parentOf(n) ? lugarNaOrdem(nova[Math.min(i, j)].id, nova[Math.max(i, j)].id) : {};
  // planos antigos podem ter a mesma ordem (ou nenhuma): aí numera todos de novo, 1, 2, 3…
  const empate = sib.some((x, k) => k > 0 && (x.order ?? 0) <= (sib[k - 1].order ?? 0));
  begin();
  if (empate) {
    for (const [k, x] of nova.entries())
      if (x.order !== k + 1) await write("nodes", x.id, { order: k + 1 }, { silent: true });
  } else {
    await write("nodes", sib[i].id, { order: sib[j].order }, { silent: true });
    await write("nodes", sib[j].id, { order: sib[i].order }, { silent: true });
  }
  for (const [mid, p] of Object.entries(lugar)) await write("nodes", mid, p, { silent: true });
  if (parentOf(n)) await resolveLayout(id);
  commit();
  render();
}
/* onde ficam dois irmãos vizinhos (cada um com o que está ligado nele) depois de trocarem de ordem:
   o que agora vem antes vai para o primeiro lugar e o outro vai logo depois, com o mesmo espaço que já
   havia entre eles. Funciona lado a lado ou um embaixo do outro, como o Organizar deixa. */
function lugarNaOrdem(antesId, depoisId) {
  const ramo = (id) => [id, ...kids(id).flatMap((k) => ramo(k.id))];
  const caixa = (id) =>
    ramo(id)
      .filter((r) => isShown(get(r)))
      .map((r) => {
        const m = get(r),
          el = document.querySelector(`.node[data-id="${r}"]`),
          x = m.x || 0,
          y = m.y || 0;
        return { x0: x, y0: y, x1: x + (el ? el.offsetWidth : MAIN_W), y1: y + (el ? el.offsetHeight : 80) };
      })
      .reduce((r, q) => ({
        x0: Math.min(r.x0, q.x0),
        y0: Math.min(r.y0, q.y0),
        x1: Math.max(r.x1, q.x1),
        y1: Math.max(r.y1, q.y1),
      }));
  const A = caixa(antesId),
    D = caixa(depoisId);
  // um embaixo do outro ou lado a lado: vale o lado em que os dois estão mais longe
  const vert = Math.abs(D.y0 + D.y1 - A.y0 - A.y1) >= Math.abs(D.x0 + D.x1 - A.x0 - A.x1),
    [e0, e1, c0] = vert ? ["y0", "y1", "x0"] : ["x0", "x1", "y0"];
  const [p1, p2] = A[e0] <= D[e0] ? [A, D] : [D, A], // os dois lugares, na ordem em que aparecem no quadro
    gap = Math.max(24, p2[e0] - p1[e1]);
  const alvo = [
    [antesId, A, p1[e0], p1[c0]],
    [depoisId, D, p1[e0] + A[e1] - A[e0] + gap, p2[c0]],
  ];
  const out = {};
  for (const [id, cx, eixo, cruz] of alvo) {
    const dx = vert ? cruz - cx[c0] : eixo - cx[e0],
      dy = vert ? eixo - cx[e0] : cruz - cx[c0];
    if (dx || dy)
      for (const r of ramo(id)) {
        const m = get(r);
        out[r] = { x: Math.round((m.x || 0) + dx), y: Math.round((m.y || 0) + dy) };
      }
  }
  return out;
}
async function remove(id) {
  confirmDel = null;
  selected = null;
  const n = get(id),
    up = parentOf(n);
  let base = kids(up).reduce((m, x) => Math.max(m, x.order || 0), 0);
  begin();
  for (const k of kids(id)) await write("nodes", k.id, { parent: up, order: ++base }, { silent: true });
  await write("nodes", id, null, { silent: true });
  commit();
  render();
}
async function setStatus(id, st) {
  await write("nodes", id, { status: st, done: st === "done" });
}
/* Organizar: passos em ordem da esquerda para a direita. Embaixo de cada passo, os sub-planos dele lado a lado;
   o que está dentro de um sub-plano fica empilhado embaixo dele, recuado por nível.
   O espaço é medido pelo tamanho real de cada plano, então nada fica em cima de nada.
   Entre o grupo de um passo (com o que está ligado nele) e o do passo seguinte fica um espaço bem maior.
   Listas soltas viram colunas no fim. Ramificações fechadas também são arrumadas, para aparecerem certas ao abrir. */
async function tidy() {
  if (!mapaLivre()) return;
  const size = (id) => {
    const el = document.querySelector(`.node[data-id="${id}"]`);
    return { w: el ? el.offsetWidth : MAIN_W, h: el ? el.offsetHeight : 80 };
  };
  const GAPX = 90,
    GAPG = 260,
    GAPC = 34,
    GAPY = 22,
    HUBY = 34,
    ROWY = 56,
    IND = 40;
  const tops = [...steps(null), ...kids(null).filter(isList)];
  const pos = {};
  // uma pilha: o plano e, embaixo, o que está dentro dele (relativo a 0,0); devolve largura, altura e posições
  const stack = (n) => {
    const rel = {};
    let y = 0,
      w = 0;
    const go = (m, depth, hidden) => {
      const s = size(m.id);
      rel[m.id] = { x: depth * IND, y };
      if (!hidden) w = Math.max(w, depth * IND + s.w);
      y += s.h + (kids(m.id).length ? HUBY : GAPY);
      const ks = kids(m.id);
      if (hidden) ks.forEach((k) => go(k, depth + 1, true));
      else if (m.collapsed) {
        const save = y;
        ks.forEach((k) => go(k, depth + 1, true));
        y = save;
      } // fechada: arruma sem ocupar espaço
      else ks.forEach((k) => go(k, depth + 1, false));
    };
    go(n, 0, false);
    return { w, h: y, rel };
  };
  const aberto = (t) => !!t && !t.collapsed && kids(t.id).length > 0;
  let x = 40;
  for (const [i, t] of tops.entries()) {
    const ts = size(t.id),
      ks = kids(t.id);
    const cols = ks.map((k) => ({ k, ...stack(k) }));
    const rowW = cols.reduce((a, c) => a + c.w, 0) + GAPC * Math.max(0, cols.length - 1);
    const blockW = t.collapsed ? ts.w : Math.max(ts.w, rowW);
    pos[t.id] = { x: x + (blockW - ts.w) / 2, y: 40 };
    let cx = x + (blockW - rowW) / 2;
    const ry = 40 + ts.h + ROWY;
    for (const c of cols) {
      for (const [id, r] of Object.entries(c.rel)) pos[id] = { x: cx + r.x, y: ry + r.y };
      cx += c.w + GAPC;
    }
    // o grupo de um passo (com o que está ligado nele) fica bem longe do grupo do passo seguinte
    x += blockW + (aberto(t) || aberto(tops[i + 1]) ? GAPG : GAPX);
  }
  const old = {};
  here().forEach((n) => (old[n.id] = { x: n.x || 0, y: n.y || 0 }));
  const shownAnc = (n) => {
    let p = parentOf(n);
    while (p && !pos[p]) p = parentOf(get(p));
    return p;
  };
  begin();
  for (const n of here()) {
    let p = pos[n.id];
    if (!p) {
      const a = shownAnc(n);
      if (!a) continue;
      p = { x: old[n.id].x + pos[a].x - old[a].x, y: old[n.id].y + pos[a].y - old[a].y };
    }
    if (Math.round(p.x) !== Math.round(old[n.id].x) || Math.round(p.y) !== Math.round(old[n.id].y))
      await write("nodes", n.id, { x: Math.round(p.x), y: Math.round(p.y) }, { silent: true });
  }
  commit();
  render();
  fit();
}

/* ---------- mapas (abas) ---------- */
function switchMap(id) {
  if (reportId) closeReport();
  currentMap = id;
  selected = null;
  connectFrom = null;
  confirmDel = null;
  confirmMapDel = null;
  try {
    localStorage.setItem("plano-mapa-aba", id);
  } catch (e) {}
  render();
  if (!fitted[id]) {
    fitted[id] = true;
    requestAnimationFrame(fit);
  }
}
// novo mapa: nome, de quem é (Todos, Dev, Aquisição ou Conteúdo) e, se quiser, senha para editar (js/mapas.js)
async function addMap({ nome, quem = "all", senha = "" } = {}) {
  const list = tabList(),
    id = rid(),
    order = list.reduce((m, x) => Math.max(m, x.order || 0), 0) + 1;
  const dados = { name: nome || `Mapa ${list.length + 1}`, order, who: quem };
  if (senha && quem !== "all") dados.senha = await hashSenha(`mapa:${id}:${senha}`);
  begin();
  if (list.some((m) => m.virtual))
    await write("maps", "main", { name: "Mapa 1", order: 0 }, { silent: true });
  await write("maps", id, dados, { silent: true });
  commit();
  // quem criou já fica com o mapa desbloqueado neste aparelho
  if (dados.senha) {
    chaves[id] = dados.senha;
    guardarChaves();
  }
  switchMap(id);
}
// mudar nome, pessoa ou senha de um mapa; senha null tira a senha, undefined deixa como está
async function ajustarMapa(id, { nome, quem, senha }) {
  const m = mapaInfo(id),
    dados = { name: nome || m.name || "Sem nome", order: m.order || 0, who: quem || m.who || "all" };
  if (m.hidden) dados.hidden = true;
  if (dados.who !== "all" && senha) dados.senha = await hashSenha(`mapa:${id}:${senha}`);
  else if (dados.who !== "all" && senha === undefined && m.senha) dados.senha = m.senha;
  await write("maps", id, dados, { replace: true });
  if (dados.senha) {
    chaves[id] = dados.senha;
    guardarChaves();
  }
}
async function renameMap(id, name) {
  if (mapaTravado(id)) return render();
  const m = maps.find((x) => x.id === id),
    v = name.trim() || "Sem nome";
  if (m && m.name === v) return;
  await write("maps", id, { name: v, order: m ? m.order : 0 });
}
async function deleteMap(id) {
  confirmMapDel = null;
  if (mapaTravado(id)) return render();
  const list = tabList();
  if (list.length < 2) return;
  begin();
  for (const n of nodes.filter((n) => mapOf(n) === id)) await write("nodes", n.id, null, { silent: true });
  for (const c of comentarios.filter((c) => c.map === id))
    await write("comentarios", c.id, null, { silent: true });
  if (id === "main")
    await write(
      "maps",
      "main",
      { name: list.find((m) => m.id === "main")?.name || "Mapa 1", order: 0, hidden: true },
      { silent: true },
    );
  else await write("maps", id, null, { silent: true });
  commit();
  switchMap(tabList()[0].id);
}
