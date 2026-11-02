/* =============================================================
 * Ask Litpax — ready questions (chips). Add / edit here, no code change needed.
 * ============================================================= */
window.AGENT_PROMPTS = [
  { label: "Today's summary",       q: "Give me today's summary: new orders, dispatches, production, stock alerts, late POs and late service tickets." },
  { label: 'Orders this month',     q: 'How many sales orders came in this month and what is their total value? Compare with last month.' },
  { label: 'Top customers',         q: 'Who are the top 10 customers by order value this month?' },
  { label: 'Pending orders',        q: 'Which orders are still pending, and which are the oldest?' },
  { label: 'Low stock',             q: 'Which IMS items are below their reorder level?' },
  { label: 'Late POs',              q: 'Which purchase orders in SOMS have not been received after their expected date?' },
  { label: 'Production trend',      q: 'Show day-wise production for the last 14 days with a chart.' },
  { label: 'Line output',           q: 'How many scans happened at each PLT station today, and which employee is ahead?' },
  { label: 'Late service tickets',  q: 'Which Service Hub tickets are past their promised date?' },
  { label: 'Tickets by model',      q: 'How many service tickets came in this month by battery model? Include a chart.' }
];
