/* Serviços locais. Dentro do Claude, a página usava serviços prontos da plataforma para guardar anexos
   e baixar arquivos. Fora dele, estas versões fazem o mesmo neste navegador:
   - anexos: imagens e arquivos guardados no IndexedDB do navegador
   - downloads: o navegador baixa o arquivo (cópia de segurança) */
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

  return { anexos, downloads };
})();
