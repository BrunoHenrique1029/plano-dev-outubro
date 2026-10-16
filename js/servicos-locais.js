/* Serviços locais. Dentro do Claude, a página usava serviços prontos da plataforma para guardar anexos,
   baixar arquivos e falar com o assistente. Fora dele, estas versões fazem o mesmo neste navegador:
   - anexos: imagens e arquivos guardados no IndexedDB do navegador
   - downloads: o navegador baixa o arquivo (cópia de segurança)
   - chave e perguntar: o assistente usa o Claude pela API da Anthropic, com a chave salva no botão "Chave" */
const servicos = (() => {
  /* ---------- anexos (IndexedDB) ---------- */
  const BANCO = "plano-dev-anexos",
    LOJA = "arquivos",
    LIMITE = 20 * 1024 * 1024;
  const ID_OK = /^[A-Za-z0-9_-]{6,80}$/;
  let banco = null;
  const abrir = () =>
    (banco ||= new Promise((ok, falha) => {
      const r = indexedDB.open(BANCO, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(LOJA, { keyPath: "id" });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => {
        banco = null;
        falha(r.error);
      };
    }));
  async function usar(modo, fn) {
    const d = await abrir();
    return new Promise((ok, falha) => {
      const t = d.transaction(LOJA, modo),
        r = fn(t.objectStore(LOJA));
      t.oncomplete = () => ok(r ? r.result : undefined);
      t.onerror = t.onabort = () => falha(t.error);
    });
  }
  const novoId = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  const paraBase64 = (blob) =>
    new Promise((ok, falha) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(",")[1] || "");
      r.onerror = () => falha(r.error);
      r.readAsDataURL(blob);
    });
  const deBase64 = (b64, type) => {
    const s = atob(b64),
      a = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return new Blob([a], { type });
  };
  const urls = new Map();

  const anexos =
    typeof indexedDB === "undefined"
      ? null
      : {
          /* guarda o arquivo e devolve o id que o relatório usa */
          async upload(arquivo, opcoes) {
            if (arquivo.size > LIMITE) throw { code: "too_large" };
            const id = novoId(),
              type = opcoes?.type || arquivo.type || "application/octet-stream";
            const blob = new Blob([arquivo], { type });
            try {
              await usar("readwrite", (s) =>
                s.put({ id, blob, type, name: arquivo.name || "", size: arquivo.size }),
              );
            } catch (e) {
              throw { code: "quota_or_state" };
            }
            return { id, contentType: type, sizeBytes: arquivo.size };
          },
          /* endereço temporário (blob:) para mostrar ou abrir o arquivo; null se ele não está neste navegador */
          async url(id) {
            if (urls.has(id)) return urls.get(id);
            const r = await usar("readonly", (s) => s.get(id));
            if (!r) return null;
            // texto sem charset abriria com acentos errados: marca como UTF-8
            const blob =
              /^text\//i.test(r.type) && !/charset/i.test(r.type)
                ? new Blob([r.blob], { type: r.type + ";charset=utf-8" })
                : r.blob;
            const u = URL.createObjectURL(blob);
            urls.set(id, u);
            return u;
          },
          /* para a cópia de segurança: cada arquivo vira texto (base64) dentro do .json */
          async exportar(ids) {
            const out = [];
            for (const id of ids) {
              const r = await usar("readonly", (s) => s.get(id)).catch(() => null);
              if (r)
                out.push({ id, type: r.type, name: r.name, size: r.size, data: await paraBase64(r.blob) });
            }
            return out;
          },
          async importar(lista) {
            let n = 0;
            for (const a of lista) {
              if (!a || !ID_OK.test(String(a.id)) || typeof a.data !== "string") continue;
              const type = String(a.type || "application/octet-stream").slice(0, 120),
                blob = deBase64(a.data, type);
              await usar("readwrite", (s) =>
                s.put({ id: a.id, blob, type, name: String(a.name || "").slice(0, 200), size: blob.size }),
              );
              const old = urls.get(a.id);
              if (old) {
                URL.revokeObjectURL(old);
                urls.delete(a.id);
              }
              n++;
            }
            return n;
          },
        };

  /* ---------- baixar arquivo ---------- */
  const downloads = {
    async save({ filename, data, type }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: type || "application/json" });
      const u = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = u;
      a.download = filename;
      a.hidden = true;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 60000);
    },
  };

  /* ---------- chave da API (fica só neste navegador) ---------- */
  const CHAVE = "plano-anthropic-chave";
  const chave = {
    ler() {
      try {
        return localStorage.getItem(CHAVE) || "";
      } catch (e) {
        return "";
      }
    },
    salvar(v) {
      try {
        localStorage.setItem(CHAVE, v);
      } catch (e) {}
    },
    apagar() {
      try {
        localStorage.removeItem(CHAVE);
      } catch (e) {}
    },
  };

  /* ---------- assistente: o Claude pela API da Anthropic (biblioteca em js/vendor/anthropic-sdk.js) ---------- */
  const MODELO = "claude-opus-5-5",
    MAX_RODADAS = 20;
  function erroDoClaude(e) {
    const A = window.Anthropic,
      detail = e?.error?.error?.message || "";
    if (!A) return { code: "upstream_error" };
    if (e instanceof A.APIUserAbortError) return { code: "cancelled" };
    if (e instanceof A.AuthenticationError) return { code: "bad_key" };
    if (e instanceof A.PermissionDeniedError) return { code: "no_access", detail };
    if (e instanceof A.RateLimitError) return { code: "rate_limited" };
    if (e instanceof A.BadRequestError) return { code: "bad_request", detail };
    if (e instanceof A.InternalServerError)
      return { code: e.status === 529 ? "overloaded" : "upstream_error" };
    if (e instanceof A.APIConnectionError) return { code: "offline" };
    return { code: "upstream_error", detail: detail || String(e?.message || "").slice(0, 200) };
  }
  /* mensagens: [{role, content}]; opcoes: system, signal, onText({text}) e tools [{name, description, inputSchema, execute}].
     No modo "Pode alterar", roda as ferramentas que o Claude pedir e devolve o resultado, até ele terminar a resposta. */
  async function perguntar(mensagens, opcoes = {}) {
    const apiKey = chave.ler();
    if (!apiKey) throw { code: "no_key" };
    if (!window.Anthropic) throw { code: "upstream_error", detail: "a biblioteca da Anthropic não carregou" };
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const ferramentas = opcoes.tools || [];
    const tools = ferramentas.map((f) => ({
      name: f.name,
      description: f.description,
      input_schema: f.inputSchema,
      eager_input_streaming: true,
    }));
    const messages = mensagens.map((m) => ({ role: m.role, content: m.content }));
    const textos = [];
    let usouFerramenta = false,
      falhasJson = 0;
    for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
      if (opcoes.signal?.aborted) throw { code: "cancelled" };
      const pedido = { model: MODELO, max_tokens: 16000, system: opcoes.system, messages };
      if (tools.length) pedido.tools = tools;
      let parcial = "";
      const stream = client.messages.stream(pedido, { signal: opcoes.signal });
      stream.on("text", (delta) => {
        parcial += delta;
        opcoes.onText?.({ text: [...textos, parcial.trim()].filter(Boolean).join("\n\n") });
      });
      let msg;
      try {
        msg = await stream.finalMessage();
        falhasJson = 0;
      } catch (e) {
        // a entrada de uma ferramenta chegou quebrada (não é erro da API): tenta a mesma rodada de novo, até 2 vezes
        if (!(e instanceof Anthropic.APIError) && !opcoes.signal?.aborted && falhasJson++ < 2) {
          rodada--;
          continue;
        }
        throw erroDoClaude(e);
      }
      const texto = msg.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      if (texto) textos.push(texto);
      const resposta = textos.join("\n\n");
      if (msg.stop_reason === "refusal") throw { code: "refused", text: resposta || undefined };
      if (msg.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: msg.content });
        continue;
      }
      const usos = msg.content.filter((b) => b.type === "tool_use");
      // só roda ferramentas quando a resposta parou para isso (nunca com a entrada cortada por max_tokens)
      if (msg.stop_reason !== "tool_use" || !usos.length) {
        if (resposta) return { text: resposta };
        if (usouFerramenta) return { text: "Pronto." };
        throw { code: "empty_completion" };
      }
      messages.push({ role: "assistant", content: msg.content });
      const resultados = [];
      for (const u of usos) {
        const f = ferramentas.find((x) => x.name === u.name);
        let content,
          isError = false;
        try {
          if (!f) throw new Error("Essa ferramenta não existe.");
          if (!u.input || typeof u.input !== "object" || Array.isArray(u.input))
            throw new Error("Entrada inválida.");
          const r = await f.execute(u.input);
          content = typeof r === "string" ? r : JSON.stringify(r ?? "ok");
        } catch (e) {
          isError = true;
          content = String(e?.message || e || "Erro.").slice(0, 500);
        }
        resultados.push(
          isError
            ? { type: "tool_result", tool_use_id: u.id, content, is_error: true }
            : { type: "tool_result", tool_use_id: u.id, content },
        );
        usouFerramenta = true;
      }
      messages.push({ role: "user", content: resultados });
    }
    return { text: textos.join("\n\n") || "Parei aqui: foram passos demais para uma mensagem só." };
  }

  return { anexos, downloads, chave, perguntar };
})();
