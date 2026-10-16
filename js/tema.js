/* Modo claro ou escuro. O site abre claro; o botão no topo troca, e a escolha fica guardada neste navegador.
   Este arquivo carrega no <head>, para a página já aparecer no modo certo. */
const TEMA = "plano-tema";
function aplicarTema(escuro) {
  const raiz = document.documentElement;
  if (escuro) raiz.dataset.tema = "escuro";
  else delete raiz.dataset.tema;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", escuro ? "dark" : "light");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", escuro ? "#1B1A18" : "#F5F4F1");
  const b = document.getElementById("tema");
  if (b) {
    b.setAttribute("aria-pressed", String(escuro));
    b.title = escuro ? "Mudar para o modo claro" : "Mudar para o modo escuro";
  }
}
try {
  aplicarTema(localStorage.getItem(TEMA) === "escuro");
} catch (e) {}
document.addEventListener("DOMContentLoaded", () => {
  const b = document.getElementById("tema");
  aplicarTema(document.documentElement.dataset.tema === "escuro");
  b.addEventListener("click", () => {
    const escuro = document.documentElement.dataset.tema !== "escuro";
    aplicarTema(escuro);
    try {
      localStorage.setItem(TEMA, escuro ? "escuro" : "claro");
    } catch (e) {}
  });
});
