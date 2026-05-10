// Overrides de PDFs desativado intencionalmente.
//
// Motivo: os PDFs anteriormente injetados aqui (pasta "Apostilas em PDF das
// Videoaulas") foram gerados por script com texto-modelo generico, sem os
// pontos/carreiras/graficos reais das aulas. Para nao exibir conteudo
// incorreto as alunas, a pasta foi removida do site.
//
// Para reativar, basta voltar a popular payload.items (ver
// scripts/generate-sousplat-pdf-pack.mjs) com material legitimo
// correspondente a cada videoaula.
(function () {
  if (typeof TREE === 'undefined' || typeof ITEMS === 'undefined') return;
  // no-op
})();
