/* Salvamento na nuvem (Firebase, grátis). Com o NUVEM_CONFIG preenchido em js/nuvem-config.js, cada pessoa entra
   com a conta Google e o mapa fica guardado no Firestore: o que alguém muda num aparelho aparece nos outros.
   Sem configuração, ou abrindo o index.html com dois cliques (file://), o site salva só neste navegador. */
const nuvem = (() => {
  const cfg = typeof NUVEM_CONFIG !== "undefined" ? NUVEM_CONFIG : null;
  if (!cfg || typeof FB === "undefined" || location.protocol === "file:") return null;

  const { emulador, ...opcoes } = cfg;
  const app = FB.initializeApp(opcoes);
  const auth = FB.getAuth(app);
  // guarda uma cópia no aparelho: abre rápido e continua funcionando sem internet
  const db = FB.initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: FB.persistentLocalCache({ tabManager: FB.persistentMultipleTabManager() }),
  });
  if (emulador) {
    // só para testar no computador, com os emuladores do Firebase
    FB.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    FB.connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  const el = (id) => document.getElementById(id);

  /* ---------- tela de entrada ---------- */
  const TEXTOS = {
    carregando: () => "Abrindo o mapa…",
    entrar: () =>
      "Entre com a sua conta Google para ver e editar o mapa. O que você mudar aparece em todos os seus aparelhos.",
    negado: (email) =>
      `A conta ${email} não tem acesso a este mapa. Peça para quem cuida do mapa liberar este e-mail, ou entre com outra conta.`,
  };
  function tela(estado, extra) {
    el("entrada").hidden = !estado;
    if (!estado) return;
    el("entrada-txt").textContent = TEXTOS[estado](extra);
    el("entrada-err").hidden = true;
    el("entrar-google").hidden = estado !== "entrar";
    el("entrada-outra").hidden = estado !== "negado";
  }
  function erroEntrada(msg) {
    el("entrada-err").textContent = msg;
    el("entrada-err").hidden = false;
  }
  const ERROS = {
    "auth/unauthorized-domain":
      "Este endereço ainda não está liberado no Firebase (Authentication > Configurações > Domínios autorizados).",
    "auth/operation-not-allowed": "O login com Google ainda não foi ativado no Firebase.",
    "auth/network-request-failed": "Sem internet. Confira a conexão e tente de novo.",
    "auth/too-many-requests": "Muitas tentativas seguidas. Espere um pouco e tente de novo.",
  };
  const provedor = new FB.GoogleAuthProvider();
  provedor.setCustomParameters({ prompt: "select_account" });
  async function entrar() {
    el("entrada-err").hidden = true;
    el("entrar-google").disabled = true;
    try {
      await FB.signInWithPopup(auth, provedor);
    } catch (e) {
      let erro = e;
      if (e.code === "auth/popup-blocked") {
        try {
          await FB.signInWithRedirect(auth, provedor);
          return;
        } catch (e2) {
          erro = e2;
        }
      }
      if (erro.code !== "auth/popup-closed-by-user" && erro.code !== "auth/cancelled-popup-request")
        erroEntrada(ERROS[erro.code] || `Não foi possível entrar agora (${erro.code || "erro"}).`);
    } finally {
      el("entrar-google").disabled = false;
    }
  }

  /* ---------- situação do salvamento, no rodapé ---------- */
  let gravando = 0,
    falha = null;
  const pendente = { nodes: false, maps: false, comentarios: false };
  function status() {
    if (falha) setSave(falha, "err");
    else if (!navigator.onLine)
      setSave("Sem internet. O que você mudar fica neste aparelho e sobe quando a conexão voltar.", "");
    else if (gravando || pendente.nodes || pendente.maps || pendente.comentarios || enviando.size)
      setSave("Salvando na nuvem…", "");
    else setSave("Salvo na nuvem", "ok");
  }
  addEventListener("online", status);
  addEventListener("offline", status);

  /* ---------- gravar uma mudança (chamado pelo write, em js/estado.js) ---------- */
  function gravar(coll, id, data, opt, before, next) {
    const ref = FB.doc(db, coll, id);
    let p;
    if (data === null) p = FB.deleteDoc(ref);
    else if (opt.replace || !before) {
      const { id: _, ...corpo } = next;
      p = FB.setDoc(ref, corpo);
    } else {
      // só os campos que mudaram: duas pessoas mexendo em partes diferentes do mesmo plano não se atrapalham
      const campos = {};
      for (const k of Object.keys(data))
        if (k !== "id") campos[k] = data[k] === undefined ? FB.deleteField() : data[k];
      for (const k of ["editedAt", "editedBy", "editedByName"])
        if (next[k] !== undefined && next[k] !== before[k]) campos[k] = next[k];
      p = FB.setDoc(ref, campos, { merge: true });
    }
    gravando++;
    status();
    p.then(
      () => (falha = null),
      (e) => {
        console.warn("Não salvou na nuvem:", e);
        falha =
          e?.code === "permission-denied"
            ? "Sua conta não tem permissão para salvar neste mapa."
            : e?.code === "invalid-argument"
              ? "Este plano ficou grande demais para salvar. Divida o relatório em outro plano ou item."
              : "Não foi possível salvar na nuvem. Confira a internet e recarregue a página.";
      },
    ).finally(() => {
      gravando--;
      status();
    });
  }

  /* ---------- anexos: cópia neste aparelho (IndexedDB) e na nuvem, em pedaços ----------
     O Firestore guarda até 1 MB por documento, então cada arquivo vai em partes de 900 KB:
     anexos/{id} tem o nome e o tipo, e anexos/{id}/partes/0000, 0001… têm o conteúdo. */
  const local = servicos.anexos,
    PARTE = 900 * 1024,
    LIMITE_MB = 10;
  const baixando = new Map(),
    enviando = new Set();
  async function enviar(id) {
    if (enviando.has(id)) return;
    enviando.add(id);
    status();
    try {
      const r = await local.ler(id);
      if (!r || r.nuvem === true) return;
      const bytes = new Uint8Array(await r.blob.arrayBuffer()),
        n = Math.max(1, Math.ceil(bytes.length / PARTE));
      for (let i = 0; i < n; i++)
        await FB.setDoc(FB.doc(db, "anexos", id, "partes", String(i).padStart(4, "0")), {
          d: FB.Bytes.fromUint8Array(bytes.slice(i * PARTE, (i + 1) * PARTE)),
        });
      // o resumo vai por último: quem abrir em outro aparelho só vê o anexo quando ele chegou inteiro
      await FB.setDoc(FB.doc(db, "anexos", id), {
        name: r.name || "",
        type: r.type || "",
        size: r.size || bytes.length,
        partes: n,
        por: myId,
        em: new Date().toISOString(),
      });
      await local.guardar({ ...r, nuvem: true });
    } catch (e) {
      console.warn("O anexo não foi para a nuvem agora. Tenta de novo na próxima vez que o site abrir.", e);
    } finally {
      enviando.delete(id);
      status();
    }
  }
  async function buscar(id) {
    const u = await local.url(id).catch(() => null);
    if (u) return u;
    const meta = await FB.getDoc(FB.doc(db, "anexos", id));
    if (!meta.exists()) return null;
    const m = meta.data(),
      partes = await FB.getDocs(FB.collection(db, "anexos", id, "partes"));
    if (partes.size !== m.partes) return null;
    const pedacos = partes.docs.sort((a, b) => (a.id < b.id ? -1 : 1)).map((d) => d.get("d").toUint8Array());
    const blob = new Blob(pedacos, { type: m.type || "application/octet-stream" });
    try {
      await local.guardar({ id, blob, type: blob.type, name: m.name || "", size: m.size, nuvem: true });
      return await local.url(id);
    } catch (e) {
      return URL.createObjectURL(blob);
    }
  }
  const anexos = local && {
    limiteMB: LIMITE_MB,
    falta: "ainda não chegou neste aparelho",
    async upload(arquivo, opcoes) {
      const r = await local.upload(arquivo, opcoes, {
        limite: LIMITE_MB * 1024 * 1024,
        campos: { nuvem: false },
      });
      enviar(r.id); // sobe sem travar o editor; se a internet cair, continua quando o site abrir de novo
      return r;
    },
    url(id) {
      if (!baixando.has(id))
        baixando.set(
          id,
          buscar(id).finally(() => baixando.delete(id)),
        );
      return baixando.get(id);
    },
  };
  /* anexos guardados só neste aparelho (de antes da nuvem, ou que não terminaram de subir) */
  async function enviarPendentes() {
    if (!local) return;
    const usados = new Set(
      nodes
        .flatMap((n) => [...(n.files || []), ...(n.list || []).flatMap((i) => i.files || [])])
        .map((f) => f.id),
    );
    let regs = [];
    try {
      regs = await local.todos();
    } catch (e) {
      return;
    }
    for (const r of regs) if (r.nuvem !== true && usados.has(r.id)) await enviar(r.id);
  }

  /* ---------- primeira vez: a nuvem está vazia, então leva o mapa deste navegador ---------- */
  async function levarMapaLocal(u) {
    let d = null;
    try {
      d = JSON.parse(localStorage.getItem("plano-mapa") || "null");
    } catch (e) {}
    let ns = (Array.isArray(d) ? d : d?.nodes) || [],
      ms = (Array.isArray(d) ? [] : d?.maps) || [],
      cs = (Array.isArray(d) ? [] : d?.comentarios) || [];
    if (!ns.length && !ms.length && typeof DADOS_INICIAIS !== "undefined") {
      ns = clone(DADOS_INICIAIS.planos);
      ms = clone(DADOS_INICIAIS.mapas);
    }
    // o que foi editado aqui antes do login passa a mostrar o nome de quem entrou
    const docs = [
      ...ms.map((m) => ["maps", m]),
      ...cs.map((c) => ["comentarios", c.autorId === "local" ? { ...c, autorId: u.uid, autor: meuNome } : c]),
      ...ns.map((n) => [
        "nodes",
        n.editedBy === "local" ? { ...n, editedBy: u.uid, editedByName: meuNome } : n,
      ]),
    ];
    const envios = [];
    let lote = FB.writeBatch(db),
      qtd = 0,
      tam = 0;
    for (const [c, { id, ...corpo }] of docs) {
      if (!id) continue;
      const t = JSON.stringify(corpo).length;
      if (qtd && (qtd >= 400 || tam + t > 4e6)) {
        envios.push(lote.commit());
        lote = FB.writeBatch(db);
        qtd = tam = 0;
      }
      lote.set(FB.doc(db, c, String(id)), corpo);
      qtd++;
      tam += t;
    }
    if (qtd) envios.push(lote.commit());
    await Promise.all(envios);
  }

  /* ---------- ouvir as mudanças: as minhas e as dos outros aparelhos ---------- */
  let parar = [];
  function desligar() {
    parar.forEach((f) => f());
    parar = [];
    if (reportId) closeReport();
    if (comentAberto) fecharPop();
    nodes = [];
    maps = [];
    comentarios = [];
    undoStack = [];
    $("#undo").disabled = true;
    el("conta").hidden = true;
    render();
  }
  function negado(u) {
    desligar();
    tela("negado", u.email || "usada");
  }
  function ouvir(u, online) {
    // este aparelho já recebeu o mapa inteiro da nuvem alguma vez? então a cópia guardada aqui pode abrir na hora
    const CHAVE = "plano-nuvem-" + u.uid;
    let primeiro = true,
      espera = null,
      completo = false;
    try {
      completo = localStorage.getItem(CHAVE) === "1";
    } catch (e) {}
    const erro = (e) => {
      if (e.code === "permission-denied") negado(u);
      else setSave("Sem conexão com a nuvem. Recarregue a página.", "err");
    };
    function aplicar(snap) {
      const novos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (drag?.el) {
        // não tira do lugar o plano que está sendo arrastado
        const cur = get(drag.id),
          k = novos.find((n) => n.id === drag.id);
        if (cur && k) {
          k.x = cur.x;
          k.y = cur.y;
        } else if (cur) novos.push(cur);
      }
      nodes = novos;
      render();
      refreshEditorFromData();
      if (!snap.metadata.fromCache && !completo) {
        completo = true;
        try {
          localStorage.setItem(CHAVE, "1");
        } catch (e) {}
      }
      if (primeiro) {
        primeiro = false;
        clearTimeout(espera);
        tela(null);
        fitted[currentMap] = true;
        requestAnimationFrame(() => fit());
        enviarPendentes();
      }
    }
    parar.push(
      FB.onSnapshot(
        FB.collection(db, "nodes"),
        { includeMetadataChanges: true },
        (snap) => {
          pendente.nodes = snap.metadata.hasPendingWrites;
          if (primeiro && snap.metadata.fromCache && online && !completo) {
            // num aparelho novo, a cópia local ainda não tem o mapa inteiro: espera a resposta da nuvem
            clearTimeout(espera);
            espera = setTimeout(() => primeiro && aplicar(snap), 10000);
          } else if (primeiro || snap.docChanges().length) aplicar(snap);
          status();
        },
        erro,
      ),
    );
    parar.push(
      FB.onSnapshot(
        FB.collection(db, "maps"),
        { includeMetadataChanges: true },
        (snap) => {
          pendente.maps = snap.metadata.hasPendingWrites;
          if (snap.docChanges().length) {
            maps = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            render();
          }
          status();
        },
        erro,
      ),
    );
    parar.push(
      FB.onSnapshot(
        FB.collection(db, "comentarios"),
        { includeMetadataChanges: true },
        (snap) => {
          pendente.comentarios = snap.metadata.hasPendingWrites;
          if (snap.docChanges().length) {
            comentarios = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            drawPins();
          }
          status();
        },
        erro,
      ),
    );
    parar.push(() => clearTimeout(espera));
  }
  async function conectar(u) {
    myId = u.uid;
    meuNome = (u.displayName || u.email || "").split(/[\s@]/)[0];
    el("conta-nome").textContent = u.displayName || u.email || "";
    el("conta").hidden = false;
    tela("carregando");
    let vazio = null;
    try {
      const [a, b] = await Promise.all(
        ["nodes", "maps"].map((c) => FB.getDocsFromServer(FB.query(FB.collection(db, c), FB.limit(1)))),
      );
      vazio = a.empty && b.empty;
    } catch (e) {
      if (e.code === "permission-denied") {
        negado(u);
        return;
      }
      // sem internet: abre com o que este aparelho já tem guardado
    }
    if (auth.currentUser?.uid !== u.uid) return;
    if (vazio) {
      try {
        await levarMapaLocal(u);
      } catch (e) {
        console.warn("Não levou o mapa deste navegador para a nuvem:", e);
        falha = "Não foi possível levar o mapa deste navegador para a nuvem. Recarregue a página.";
      }
    }
    ouvir(u, vazio !== null);
  }

  function iniciar() {
    tela("carregando");
    el("entrar-google").onclick = entrar;
    el("entrada-outra").onclick = () => FB.signOut(auth);
    el("sair").onclick = () => FB.signOut(auth);
    FB.getRedirectResult(auth).catch((e) => {
      tela("entrar");
      erroEntrada(ERROS[e.code] || `Não foi possível entrar agora (${e.code || "erro"}).`);
    });
    FB.onAuthStateChanged(auth, (u) => {
      if (u) conectar(u);
      else {
        desligar();
        tela("entrar");
        setSave("Entre para ver o mapa", "");
      }
    });
    // só nos testes com os emuladores: entra sem a janela do Google
    if (emulador)
      window.entrarTeste = (email, nome) =>
        FB.signInWithCredential(
          auth,
          FB.GoogleAuthProvider.credential(
            JSON.stringify({ sub: email, email, email_verified: true, name: nome || email }),
          ),
        );
  }

  return { iniciar, gravar, anexos };
})();
