// Shared PDF/print window mechanism — was reimplemented 4 times (AdminView.jsx,
// QuotesView.jsx, PublicRouteView.jsx, PresupuestoView.jsx), 3 of them via
// `window.open('') + document.write + w.onload = print` with no fallback when the
// browser blocks the popup. This adopts PresupuestoView's approach (the one variant
// that already handled it): a Blob object URL, with the print trigger embedded as a
// <script> inside the HTML itself (reliable across blob-URL navigation, unlike
// `w.onload` which doesn't always fire consistently for it), plus a downloadable-file
// fallback when `window.open` returns null.
//
// The generated `html` must include its own `<script>window.onload=function(){window.print()}<\/script>`
// before `</body>` — this helper only owns the window-opening mechanism, not each
// document's layout/content, which is legitimately different per document.
export function openPrintWindow(html, filename = 'documento.html') {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
