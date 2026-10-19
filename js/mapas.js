/* Mapas: a janela de novo mapa e de opções do mapa (nome, de quem é e senha) e a janela de desbloquear com a senha */
let mapaDlg = null; // { id: null num mapa novo, quem, tinha: o mapa já tinha senha }
function abrirMapa(id) {
  const m = id ? mapaInfo(id) : null;
  if (m && mapaTravado(id)) return abrirSenha(id);
  mapaDlg = { id, quem: m?.who || "all", tinha: !!m?.senha };
  const f = $("#mapa-form");
  f.reset();
  $("#mapa-h").textContent = m ? "Opções do mapa" : "Novo mapa";
  $("#mapa-ok").textContent = m ? "Salvar" : "Criar mapa";
  f.nome.value = m ? m.name : `Mapa ${tabList().length + 1}`;
  f.usar.checked = !!m?.senha;
  $("#mapa-err").hidden = true;
  syncMapa();
  $("#mapa").hidden = false;
  f.nome.focus();
  f.nome.select();
}
function syncMapa() {
  const f = $("#mapa-form"),
    q = mapaDlg.quem;
  f.style.setProperty("--c", `var(--p-${q})`);
  document
    .querySelectorAll("#mapa [data-mquem]")
    .forEach((b) => b.setAttribute("aria-checked", b.dataset.mquem === q));
  // só os mapas do Dev, da Aquisição e do Conteúdo podem ter senha
  $("#mapa-senha").hidden = q === "all";
  $("#mapa-campos").hidden = q === "all" || !f.usar.checked;
  $("#mapa-manter").hidden = !(mapaDlg.id && mapaDlg.tinha);
}
function fecharMapa() {
  mapaDlg = null;
  $("#mapa").hidden = true;
}
async function salvarMapa() {
  const d = mapaDlg,
    f = $("#mapa-form");
  if (!d) return;
  const erro = (t, campo) => {
    $("#mapa-err").textContent = t;
    $("#mapa-err").hidden = false;
    campo?.focus();
  };
  const usar = d.quem !== "all" && f.usar.checked,
    s1 = f.senha.value,
    s2 = f.senha2.value;
  if (usar) {
    if (!s1 && !(d.id && d.tinha)) return erro("Escreva a senha.", f.senha);
    if (s1 && s1.length < 4) return erro("A senha precisa ter pelo menos 4 letras ou números.", f.senha);
    if (s1 !== s2) return erro("As duas senhas estão diferentes.", f.senha2);
  }
  const nome = f.nome.value.trim();
  fecharMapa();
  if (!d.id) await addMap({ nome, quem: d.quem, senha: usar ? s1 : "" });
  else await ajustarMapa(d.id, { nome, quem: d.quem, senha: usar ? s1 || undefined : null });
  render();
}
$("#mapa-form").addEventListener("submit", (e) => {
  e.preventDefault();
  salvarMapa();
});
$("#mapa-form").addEventListener("change", (e) => {
  e.stopPropagation();
  syncMapa();
});
$("#mapa-form").addEventListener("click", (e) => {
  const b = e.target.closest("[data-mquem]");
  if (!b) return;
  mapaDlg.quem = b.dataset.mquem;
  syncMapa();
});
$("#mapa-cancel").onclick = fecharMapa;
$("#mapa").addEventListener("pointerdown", (e) => {
  if (e.target.id === "mapa") fecharMapa();
});

/* desbloquear: a senha do mapa ou a de administrador (que abre todos os mapas neste aparelho) */
let senhaDe = null;
function abrirSenha(id) {
  senhaDe = id;
  const f = $("#senha-form"),
    m = mapaInfo(id);
  f.reset();
  $("#senha-err").hidden = true;
  $("#senha-k").textContent = `Desbloquear · ${WHO[m.who || "all"]}`;
  $("#senha-nome").textContent = m.name;
  f.style.setProperty("--c", `var(--p-${m.who || "all"})`);
  $("#senha").hidden = false;
  f.senha.focus();
}
function fecharSenha() {
  senhaDe = null;
  $("#senha").hidden = true;
}
async function conferirSenha() {
  const f = $("#senha-form"),
    id = senhaDe;
  if (!id) return;
  if (!(await desbloquear(id, f.senha.value))) {
    $("#senha-err").textContent = "Senha errada. Tente de novo.";
    $("#senha-err").hidden = false;
    f.senha.select();
    return;
  }
  fecharSenha();
  avisar(
    souAdm()
      ? "Modo administrador: todos os mapas abertos neste aparelho."
      : "Mapa desbloqueado neste aparelho.",
  );
}
$("#senha-form").addEventListener("submit", (e) => {
  e.preventDefault();
  conferirSenha();
});
$("#senha-form").addEventListener("change", (e) => e.stopPropagation());
$("#senha-cancel").onclick = fecharSenha;
$("#senha").addEventListener("pointerdown", (e) => {
  if (e.target.id === "senha") fecharSenha();
});

document.addEventListener("click", (e) => {
  const ch = e.target.closest("[data-mapchave]");
  if (ch) {
    const id = ch.dataset.mapchave;
    if (mapaTravado(id)) abrirSenha(id);
    else {
      bloquear(id);
      avisar("Mapa bloqueado de novo neste aparelho.");
    }
    return;
  }
  const op = e.target.closest("[data-mapopc]");
  if (op) abrirMapa(op.dataset.mapopc);
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("#mapa").hidden) fecharMapa();
  else if (!$("#senha").hidden) fecharSenha();
  else return;
  e.stopImmediatePropagation();
});
