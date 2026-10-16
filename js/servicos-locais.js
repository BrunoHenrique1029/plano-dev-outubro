/* Serviços locais. Dentro do Claude, a página usava um serviço pronto da plataforma para guardar os anexos.
   Fora dele, esta versão faz o mesmo neste navegador: imagens e arquivos ficam guardados no IndexedDB. */
const servicos = (() => {
  /* ---------- anexos (IndexedDB) ---------- */
  const BANCO = "plano-dev-anexos",
    LOJA = "arquivos",
    LIMITE = 20 * 1024 * 1024;
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
        };

  return { anexos };
})();
