/* =============================================================
 * Litpax Suite — EK HI CONFIG (poore repo ki sirf yahi config file hai)
 * Shell, ERP, IMS, PLT, SOMS — sab pages yahi file load karte hain.
 * Har app ka GAS deploy karke uska /exec URL neeche paste karo. Bas.
 * ============================================================= */
window.SUITE = {
  ERP_URL:  'https://script.google.com/macros/s/AKfycbw0ykKGTgVkJWuF4S-MPlJ3wUnvPDlwEber6-wd7cC6GjPJzEz7p45c2RjPim00RrGw/exec',
  IMS_URL:  'https://script.google.com/macros/s/AKfycbwfBWF_w1xXiaZNr6M6GhQYnYTjUtJp0Z3LFkEabQpNDz9cBPkcwtj8KklepL_iKtamfQ/exec',
  PLT_URL:  'https://script.google.com/macros/s/AKfycbzKqbowf60D_4jgBlkXbqMZe5LxtvERhoR8_d2FpvBOYDgh93HwEuToxIAhVnShE71vkQ/exec',
  SOMS_URL: 'https://script.google.com/macros/s/AKfycbzgr2WI_fRerBAUoRc-JDWd2aveamp2xyRIjC8rQBiC-QPh3Xm6h_kIl4IGBrWUr5r1zg/exec',

  APP_NAME: 'Litpax Suite',
  TIMEOUT_MS: 45000,

  // PLT scan station settings
  PLT: {
    FLOOR: 'Floor-1',            // is PC ka floor / unit — har scan row me jaata hai
    POLL_MS: 15000,              // admin dashboard refresh (0 = band)
    LOG_LIMIT: 3000,             // load par kitni recent scan rows
    ENFORCE_SEQUENCE: false      // station order galat ho to warning
  },

  // Suite ke sidebar me khulne wale apps
  MODULES: {
    erp:      { label: 'ERP',             path: 'erp/app.html' },
    ims:      { label: 'Inventory (IMS)', path: 'ims/index.html' },
    pltScan:  { label: 'Line Scan',       path: 'plt/index.html' },
    pltAdmin: { label: 'Line Admin',      path: 'plt/admin.html' },
    soms:     { label: 'Store Orders',    path: 'soms/index.html' }
  }
};

/* ---- Neeche kuch mat badlo: har app ko wahi variables milte hain jo uska purana config deta tha ---- */
(function () {
  var S = window.SUITE, p = location.pathname;
  window.GAS_URL = S.ERP_URL;                                   // ERP pages
  window.IMS_URL = S.IMS_URL;                                   // ERP material check
  window.MP = { ERP_URL: S.ERP_URL, IMS_URL: S.IMS_URL };       // ERP / MaterialProd
  if (/\/plt\//.test(p)) {
    window.CONFIG = { API_URL: S.PLT_URL, FLOOR: S.PLT.FLOOR, POLL_MS: S.PLT.POLL_MS, LOG_LIMIT: S.PLT.LOG_LIMIT,
      ENFORCE_SEQUENCE: S.PLT.ENFORCE_SEQUENCE, TIMEOUT_MS: S.TIMEOUT_MS };
  } else if (/\/soms\//.test(p)) {
    window.CONFIG = { API_URL: S.SOMS_URL, APP_NAME: 'Litpax SMS', APP_SUBTITLE: 'Store Management System',
      COMPANY: 'Litpax Technology', REQUEST_TIMEOUT: 30000 };
  }
})();
