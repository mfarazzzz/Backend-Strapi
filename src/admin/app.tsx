import type { StrapiApp } from '@strapi/strapi/admin';

export default {
  config: {
    locales: ['hi', 'en'],
  },
  bootstrap(app: StrapiApp) {
    void app;
    if (typeof document === 'undefined') return;

    const css = `
      html, body, #strapi { overflow-x: hidden; }

      @media (max-width: 768px) {
        body { font-size: 14px; }
        #strapi main { padding-left: 12px !important; padding-right: 12px !important; }
        #strapi header { position: sticky; top: 0; z-index: 1000; }
        #strapi button, #strapi [role="button"], #strapi input, #strapi select, #strapi textarea { min-height: 44px; }
        #strapi table { display: block; overflow-x: auto; width: 100%; }
      }
    `;

    const el = document.createElement('style');
    el.setAttribute('data-rampur-mobile-admin', 'true');
    el.appendChild(document.createTextNode(css));
    document.head.appendChild(el);
  },
};

