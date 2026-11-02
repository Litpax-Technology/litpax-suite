/* =============================================================
 * Ask Litpax — ready sawaal (chips). Yahan add / edit karo, code nahi chhedna padega.
 * ============================================================= */
window.AGENT_PROMPTS = [
  { label: 'Aaj ka summary',        q: 'Aaj ka poora summary do: naye orders, dispatch, production, stock alerts, late PO aur late service tickets.' },
  { label: 'Is mahine ke orders',   q: 'Is mahine kitne sales orders aaye aur unki total value kitni hai? Pichhle mahine se compare karo.' },
  { label: 'Top customers',         q: 'Is mahine order value ke hisaab se top 10 customers kaun hain?' },
  { label: 'Pending orders',        q: 'Kaunse orders abhi pending hain aur sabse purane kaunse hain?' },
  { label: 'Reorder / low stock',   q: 'IMS me kaunse items reorder level se neeche hain?' },
  { label: 'Late POs',              q: 'SOMS me kaunse purchase orders ka maal expected date ke baad bhi nahi aaya?' },
  { label: 'Production trend',      q: 'Pichhle 14 din ka din-wise production dikhao, chart ke saath.' },
  { label: 'Line output',           q: 'Aaj PLT line pe kis station pe kitne scans hue aur kaun employee sabse aage hai?' },
  { label: 'Late service tickets',  q: 'Service Hub me kaunse tickets promised date se late hain?' },
  { label: 'Warranty by model',     q: 'Is mahine service tickets model-wise kitne aaye? Chart ke saath.' }
];
