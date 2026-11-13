/* =============================================================
 * Ask Litpax — persona: "Who created you?" ka jawaab
 * Jawaab badalna ho to neeche creator() ka text edit karo.
 * ============================================================= */
(function () {
  'use strict';

  var YOU = '(tumhe|tumhen|tumhein|tumko|tum ko|tume|tujhe|tujhko|aapko|aap ko|apko|is agent ko|is bot ko)';
  var CREATOR_RE = new RegExp(
    '\\bwho\\s+(has\\s+)?(created|made|built|developed|designed|programmed)\\s+(you|u|ask litpax|litu|this\\s+(agent|bot|ai|assistant|chatbot|chat))\\b' +
    '|\\b(your|tumhara|tumhare|aapka|aapke|tera|tere)\\s+(creator|maker|developer|banane\\s*wala|banane\\s*wale)\\b' +
    '|\\b' + YOU + '\\b.*\\b(kisne|kis ne|kinhone|kaun)\\b.*\\b(banaya|bnaya|bnya|create|develop)' +
    '|\\b(kisne|kis ne|kinhone)\\s+' + YOU + '\\s+(banaya|bnaya|bnya|create|develop)' +
    '|^\\s*(kisne|kis ne)\\s+(banaya|bnaya|bnya)(\\s+hai)?\\s*\\??\\s*$' +
    '|(तुम्हें|तुम्हे|आपको|तुमको|तुझे).*किसने\\s+बनाया', 'i');
  function creator(q) {
    if (!CREATOR_RE.test(String(q || ''))) return null;
    return '**Mujhe Darpan ne banaya hai.** ✨\n\n' +
      'Har line of code ke peeche unki soch hai, aur har jawaab ke peeche unki mehnat. ' +
      'Unhone mujhe sirf data padhna nahi sikhaya — yeh bhi sikhaya ki sahi jawaab seedhe, saaf aur imaandaari se diya jaaye.\n\n' +
      'Litpax ke orders, stock, production aur service ko ek jagah samajhne ka jo sapna tha, use Darpan ne **Ask Litpax** ki shakal di. ' +
      'Main unka banaya hua ek chhota sa saathi hoon, jo aapka waqt bachane ke liye hamesha yahin hai.\n\n' +
      '_Crafted with care by Darpan · Litpax Technology_';
  }

  window.AGENT_PERSONA = { creator: creator };
})();
