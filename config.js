/* =============================================================
 * Litpax Suite — saare URLs EK hi jagah
 * Har app ka naya GAS deploy karke /exec URL yahan paste karo.
 * Shell aur charon apps (erp/ ims/ plt/ soms/) yahi file padhte hain.
 * (URLs "Litpax Suite Links" sheet ke Links tab me bhi likhe milenge)
 * ============================================================= */
window.SUITE = {
  ERP_URL:  'PASTE_ERP_GAS_EXEC_URL',
  IMS_URL:  'PASTE_IMS_GAS_EXEC_URL',
  PLT_URL:  'PASTE_PLT_GAS_EXEC_URL',
  SOMS_URL: 'PASTE_SOMS_GAS_EXEC_URL',

  APP_NAME: 'Litpax Suite',
  TIMEOUT_MS: 45000,

  MODULES: {
    erp:      { label: 'ERP',             path: 'erp/app.html' },
    ims:      { label: 'Inventory (IMS)', path: 'ims/index.html' },
    pltScan:  { label: 'Line Scan',       path: 'plt/index.html' },
    pltAdmin: { label: 'Line Admin',      path: 'plt/admin.html' },
    soms:     { label: 'Store Orders',    path: 'soms/index.html' }
  }
};
