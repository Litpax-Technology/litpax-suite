/* =============================================================
 * Litpax Suite — EK HI CONFIG (poore repo ki sirf yahi config file hai)
 * Shell, ERP, IMS, PLT, SOMS — sab pages yahi file load karte hain.
 * Har app ka GAS deploy karke uska /exec URL neeche paste karo. Bas.
 * ============================================================= */
window.SUITE = {
  ERP_URL:  'https://script.google.com/macros/s/AKfycbw_fhvFSsdIMV2KVulnP7QX5Yhr3Q7XwnXuYpu1fjObsmHg0zByNWDu15f_abvSkgk/exec',
  IMS_URL:  'https://script.google.com/macros/s/AKfycbxT6THkAgjM6h2xRU6kwsxYqylukrxrwWCkU3Adq498mnTmDmUQ6shR6nzfmqmt12Puww/exec',
  PLT_URL:  'https://script.google.com/macros/s/AKfycbwSENECChjy8cOZg_VP1BwXj0s_gw2q0dqyhHD81dQRD2XYvkOj_suhyb4mpfqmx3PzUA/exec',
  SOMS_URL: 'https://script.google.com/macros/s/AKfycbwsfgKLzVOVJq1EpR9eiQUIwY1XKzamgeA0BVYQ30AM2lSlM9_rKvDG2FS5DkQWeyipDw/exec',
  SERVICE_URL: 'https://script.google.com/macros/s/AKfycbzMu4YZIp7bKHMqdY8ZmPN3KDHHLUW3dfXSVO1zgDirwVkf8J0ugc0KPCExWUM3ryKHWw/exec',

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
    plt2W:    { label: '2 Wheeler Line',  path: 'plt/index.html?hall=2%20Wheeler' },
    pltAdmin: { label: 'Line Admin',      path: 'plt/admin.html' },
    soms:     { label: 'Store Orders',    path: 'soms/index.html' },
    pltPack:  { label: 'Battery Packing', path: 'plt/index.html?mode=packing' },
    cash:     { label: 'Cash Ledger',     path: 'https://litpax-technology.github.io/Cash-Ledger-/' },
    service:  { label: 'Service Hub',     path: 'service/index.html' }
  },

  // Service Hub settings (service/ ke saare pages yahi padhte hain)
  SERVICE: {
    JSONP_TIMEOUT_MS: 25000,
    POST_TIMEOUT_MS: 90000,      // builty upload / Mark Received
    BUILTY_MAX_MB: 5,
    CACHE_TTL_MS: 60000,

    // nav = sidebar items for the role (the first one opens after login)
    ROLES: {
      attendant: { label: 'Call Attendant', icon: '📞', nav: ['newTicket', 'tracker'] },
      service:   { label: 'Service Team',   icon: '🎧', nav: ['tickets', 'tracker', 'newTicket'] },
      repair:    { label: 'Repair Team',    icon: '🔧', nav: ['board', 'dispatch', 'tickets'] },
      admin:     { label: 'Admin',          icon: '👑', nav: ['tickets', 'tracker', 'newTicket', 'board', 'dispatch', 'masters'] }
    },

    // ⚠️ Keep in sync with ROLE_PERMS in Code.gs
    PERMS: {
      attendant: ['create'],
      service:   ['create', 'service'],
      repair:    ['repair'],
      admin:     ['create', 'service', 'repair', 'admin']
    },

    // ⚠️ Must EXACTLY match PURCHASE_AGE in Code.gs
    PURCHASE_AGE: ['Less than 6 months', '6 months - 1 year', 'More than 1 year'],

    // ⚠️ Must EXACTLY match REPAIR_STAGES in Code.gs (same order) — last = Final QC & Pack
    STAGES: ['Diagnosis', 'Cell Testing', 'Repair Work', 'Charging Test', 'Final QC & Pack'],

    // ── Customer tracking + WhatsApp (click-to-send) ──
    COMPANY: 'Litpax Technology Pvt. Ltd.',
    SUPPORT_PHONE: '',
    TRACK_URL: 'https://litpax-technology.github.io/litpax-service-erp/track/',   // track abhi purane repo mein hi hai
    WA_COUNTRY: '91',
    FEEDBACK_AFTER_DAYS: 3,
    // ⚠️ Must EXACTLY match WARRANTY in Code.gs
    WARRANTY: ['In Warranty', 'Out of Warranty', 'Not Sure'],

    // New Ticket → State dropdown
    STATES: ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
             'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
             'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
             'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman & Nicobar', 'Chandigarh',
             'Dadra & Nagar Haveli and Daman & Diu', 'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'],
    // New Ticket → Scooty Brand dropdown
    SCOOTY_BRANDS: ['Evey', 'Warivo', 'Zelio', 'YBK', 'Urban', 'Maxim', 'Jiva', 'Yakuza', 'J Bros', 'Neovolt',
                    'Navix', 'G Byke', 'Electric Pay', 'GenZ', 'Mega Green', 'Durasol', 'Ampfuel', 'Marudhar'],
    SLA_HOURS: {
      firstCall: 4,    // ticket created → first service call
      transit:   72,   // pickup arranged → received
      queue:     24,   // received → repair planned
      repair:    72,   // repair planned → Final QC & Pack
      dispatch:  24    // Final QC → dispatched
    },

    // {placeholder} khaali ho toh wo poori line message se hat jaati hai
    WA_TEMPLATES: {
      created:    'Hello {name},\nThank you for contacting Litpax Service. Your request has been registered.\nTicket ID: {id}\nTrack your service status: {link}',
      pickup:     'Hello {name},\nPickup for your Ticket {id} has been arranged.\nPickup date: {date}\nTransport: {transport}\nLR No: {lr}\nTrack status: {link}',
      received:   'Hello {name},\nWe have received your {items} at the Litpax Service Center.\nTicket ID: {id}\nTrack repair status: {link}',
      dispatched: 'Hello {name},\nYour {items} (Ticket {id}) has been dispatched.\nDispatch date: {date}\nTransport: {transport}\nTrack status: {link}',
      feedback:   'Hello {name},\nWe hope your battery is working well after the service (Ticket {id}).\nPlease share your feedback, it takes less than a minute:\n{flink}\nThank you, Team Litpax'
    }
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
  } else if (/\/service\//.test(p)) {
    window.CONFIG = Object.assign({ API_URL: S.SERVICE_URL, REPAIR_URL: S.SERVICE_URL }, S.SERVICE);
  } else if (/\/soms\//.test(p)) {
    window.CONFIG = { API_URL: S.SOMS_URL, APP_NAME: 'Litpax SMS', APP_SUBTITLE: 'Store Management System',
      COMPANY: 'Litpax Technology', REQUEST_TIMEOUT: 30000 };
  }
})();
