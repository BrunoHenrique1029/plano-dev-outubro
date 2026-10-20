/* Agenda: reuniões com data e hora, e o link que manda para o Google Agenda */
const pad2 = (v) => String(v).padStart(2, "0");
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const showPast = new Set();
let mtg = null;
function mtgStart(i) {
  if (!i.date || !/^\d{4}-\d{2}-\d{2}$/.test(i.date)) return null;
  const [y, m, d] = i.date.split("-").map(Number),
    [hh, mm] = (i.time || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0);
}
function mtgEnd(i) {
  const s = mtgStart(i);
  if (!s) return null;
  if (!i.time) {
    const e = new Date(s);
    e.setDate(e.getDate() + 1);
    return e;
  }
  return new Date(s.getTime() + (Number(i.dur) || 60) * 60000);
}
const mtgPast = (i, now) => {
  const e = mtgEnd(i);
  return !!e && e.getTime() <= now;
};
const mtgSort = (a, b) =>
  (a.date || "9999").localeCompare(b.date || "9999") || (a.time || "99:99").localeCompare(b.time || "99:99");
function durTxt(m) {
  m = Number(m) || 60;
  if (m < 60) return m + " min";
  const h = Math.floor(m / 60),
    r = m % 60;
  return r ? `${h}h${pad2(r)}` : `${h} h`;
}
function dayLabel(date) {
  const s = mtgStart({ date });
  if (!s) return "Sem data";
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(s.getFullYear(), s.getMonth(), s.getDate()) - t0) / 86400000),
    base = `${WD[s.getDay()]} ${pad2(s.getDate())}/${pad2(s.getMonth() + 1)}`;
  return diff === 0
    ? "Hoje · " + base
    : diff === 1
      ? "Amanhã · " + base
      : diff === -1
        ? "Ontem · " + base
        : base;
}
const safeUrl = (u) => (/^https?:\/\/[^\s"'<>]+$/i.test(String(u || "").trim()) ? String(u).trim() : "");
/* link de "criar evento" do Google Agenda, já preenchido; a pessoa só confere e salva lá */
function gcalUrl(i) {
  const s = mtgStart(i),
    e = mtgEnd(i);
  if (!s) return "";
  const ymd = (d) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`,
    hm = (d) => `T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: (i.text || "").trim() || "Reunião",
    dates: i.time ? ymd(s) + hm(s) + "/" + ymd(e) + hm(e) : ymd(s) + "/" + ymd(e),
  });
  const details = [i.with ? "Com: " + i.with : "", i.link ? "Link ou local: " + i.link : ""]
    .filter(Boolean)
    .join("\n");
  if (details) p.set("details", details);
  if (i.link) p.set("location", i.link);
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) p.set("ctz", tz);
  } catch (err) {}
  return "https://calendar.google.com/calendar/render?" + p.toString();
}
function agendaRows(n, rep, kb = "") {
  const now = Date.now(),
    L = (n.list || []).slice().sort(mtgSort);
  const lock = travado(n),
    up = L.filter((i) => !mtgPast(i, now)),
    past = L.filter((i) => mtgPast(i, now)).reverse(),
    open = showPast.has(n.id);
  const row = (i, cls) => {
    const nf = (i.files || []).length,
      join = safeUrl(i.link);
    return `<div class="ag-row ${cls} ${i.done ? "ok" : ""}">
      <input type="checkbox" class="lck" data-mli-done="${i.id}" data-id="${n.id}" ${i.done ? "checked" : ""} ${lock ? "disabled" : ""} aria-label="Marcar reunião como feita">
      <span class="ag-time">${i.time ? esc(i.time) + `<small>${durTxt(i.dur)}</small>` : "Dia<small>inteiro</small>"}</span>
      <button class="ag-main" data-act="mtg-open" data-id="${n.id}" data-item="${i.id}" title="Editar reunião"><b>${esc(i.text || "Reunião")}</b>${i.with ? `<span>com ${esc(i.with)}</span>` : ""}${i.link && !join ? `<span>${esc(i.link)}</span>` : ""}</button>
      <span class="ag-acts">${join ? `<a class="ag-join" href="${esc(join)}" target="_blank" rel="noopener" title="Abrir o link da reunião">Entrar</a>` : ""}<button class="rep ${i.report || nf ? "has" : ""}" data-act="report" data-id="${n.id}" data-item="${i.id}" aria-label="Abrir relatório da reunião" title="Relatório da reunião">${ICON}${nf ? `<span class="clip">${nf}</span>` : ""}</button><a class="gcal" href="${esc(gcalUrl(i))}" target="_blank" rel="noopener" title="Adicionar ao Google Agenda" aria-label="Adicionar ao Google Agenda">${CAL_ADD}</a></span>
    </div>`;
  };
  const days = (list, cls, firstNext) => {
    let h = "",
      day = null,
      k = 0;
    for (const i of list) {
      if (i.date !== day) {
        day = i.date;
        h += `<div class="ag-day ${dayLabel(i.date).startsWith("Hoje") ? "today" : ""}">${esc(dayLabel(i.date))}</div>`;
      }
      h += row(i, cls + (firstNext && k === 0 ? " next" : ""));
      k++;
    }
    return h;
  };
  let body = up.length
    ? days(up, "", true)
    : `<p class="ag-empty">${past.length ? "Nenhuma reunião pela frente." : "Nenhuma reunião marcada ainda."}</p>`;
  if (past.length)
    body +=
      `<button class="ag-past-t" data-act="ag-past" data-id="${n.id}" aria-expanded="${open}">${open ? "Esconder" : "Ver"} as que já passaram (${past.length})</button>` +
      (open ? days(past, "past", false) : "");
  return `<div class="lhead"><span class="lic">${ic(IC.agenda, 20)}</span><span class="lmeio"><textarea rows="1" data-key="${n.id}" data-act="title" data-id="${n.id}" ${lock ? "readonly" : ""} placeholder="Nome da agenda" aria-label="Nome da agenda">${esc(n.title)}</textarea><span class="lt">Agenda · ${WHO[n.who || "all"]} · <span class="lc">${up.length} ${up.length === 1 ? "próxima" : "próximas"}</span></span></span><span class="right">${rep}${kb}</span></div>
    ${body}
    <button class="add-li" data-act="mtg-add" data-id="${n.id}">+ Reunião</button>`;
}
function mtgVals() {
  const e = $("#mtg-form").elements;
  return {
    text: e.title.value.trim(),
    with: e.with.value.trim(),
    date: e.date.value,
    time: e.time.value,
    dur: Number(e.dur.value) || 60,
    link: e.link.value.trim(),
  };
}
function syncGcal() {
  const a = $("#mtg-gcal"),
    u = gcalUrl(mtgVals());
  a.href = u || "https://calendar.google.com/";
  a.setAttribute("aria-disabled", u ? "false" : "true");
}
function openMeeting(nodeId, itemId) {
  const n = get(nodeId);
  if (!n) return;
  const it = itemId ? (n.list || []).find((i) => i.id === itemId) : null;
  mtg = { nodeId, itemId: it ? it.id : null, confirmDel: false };
  const e = $("#mtg-form").elements,
    t = new Date();
  e.title.value = it?.text || "";
  e.with.value = it?.with || "";
  e.date.value = it?.date || `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
  e.time.value = it ? it.time || "" : "";
  const dv = String(it?.dur || 60);
  if (![...e.dur.options].some((o) => o.value === dv)) e.dur.add(new Option(durTxt(dv), dv));
  e.dur.value = dv;
  e.link.value = it?.link || "";
  $("#mtg-h").textContent = it ? "Editar reunião" : "Nova reunião";
  $("#mtg-k").textContent = `Agenda · ${n.title ? n.title + " · " : ""}${WHO[n.who || "all"]}`;
  $("#mtg").style.setProperty("--c", `var(--p-${n.who || "all"})`);
  const del = $("#mtg-del");
  del.hidden = !it;
  del.textContent = "Apagar";
  del.classList.remove("strong");
  $("#mtg-err").hidden = true;
  selected = null;
  $("#mtg").hidden = false;
  syncGcal();
  render();
  e.title.focus();
}
function closeMeeting() {
  mtg = null;
  $("#mtg").hidden = true;
}
async function saveMeeting() {
  const m = mtg;
  if (!m) return false;
  const v = mtgVals();
  if (!mtgStart(v)) {
    $("#mtg-err").textContent = "Escolha a data da reunião.";
    $("#mtg-err").hidden = false;
    $("#mtg-form").elements.date.focus();
    return false;
  }
  const list = listOf(m.nodeId);
  if (m.itemId) {
    const i = list.find((x) => x.id === m.itemId);
    if (!i) {
      closeMeeting();
      return false;
    }
    Object.assign(i, v);
  } else list.push({ id: rid(), done: false, ...v });
  closeMeeting();
  await saveList(m.nodeId, list);
  return true;
}
$("#mtg-form").addEventListener("submit", (e) => {
  e.preventDefault();
  saveMeeting();
});
$("#mtg-form").addEventListener("input", syncGcal);
$("#mtg-form").addEventListener("change", (e) => {
  e.stopPropagation();
  syncGcal();
});
$("#mtg-cancel").onclick = closeMeeting;
$("#mtg").addEventListener("pointerdown", (e) => {
  if (e.target.id === "mtg") closeMeeting();
});
$("#mtg-gcal").addEventListener("click", (e) => {
  if (!mtgStart(mtgVals())) {
    e.preventDefault();
    $("#mtg-err").textContent = "Escolha a data da reunião.";
    $("#mtg-err").hidden = false;
    return;
  }
  syncGcal();
  saveMeeting();
});
$("#mtg-del").onclick = async () => {
  const m = mtg;
  if (!m || !m.itemId) return;
  if (!m.confirmDel) {
    m.confirmDel = true;
    $("#mtg-del").textContent = "Confirmar apagar";
    $("#mtg-del").classList.add("strong");
    return;
  }
  closeMeeting();
  await saveList(
    m.nodeId,
    listOf(m.nodeId).filter((x) => x.id !== m.itemId),
  );
};
