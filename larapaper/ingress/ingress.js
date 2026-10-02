// Home Assistant ingress (added by the LaraPaper (local) app; nginx loads this only
// there). LaraPaper's recipe preview writes the screen's HTML into an iframe, and its
// root-relative asset paths (/trmnl-framework/..., /fonts/..., /rolling-month-calendar/...)
// would point at Home Assistant itself. Put the ingress prefix in front of them.
(() => {
  const prefix = (location.pathname.match(/^\/api\/hassio_ingress\/[A-Za-z0-9_-]+/) || [])[0];
  if (!prefix) return;
  const fix = (html) => html.replace(/(["'(])\/(trmnl-framework|fonts|rolling-month-calendar)\//g, `$1${prefix}/$2/`);
  document.addEventListener('livewire:init', () => {
    window.Livewire.interceptMessage(({ onSuccess }) => onSuccess(({ payload }) => {
      for (const d of payload?.effects?.dispatches || []) {
        if (d.name === 'preview-updated' && typeof d.params?.preview === 'string') d.params.preview = fix(d.params.preview);
      }
    }));
  });
})();
