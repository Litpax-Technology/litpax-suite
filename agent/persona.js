/* =============================================================
 * Ask Litpax — persona (naam poochna, quotes, "kisne banaya")
 * Quotes yahin add / edit karo, code chhedne ki zaroorat nahi.
 *   SAHIL  → har baar random quote
 *   SNEHA  → roz ka ek quote (poore din wahi rahega)
 * ============================================================= */
(function () {
  'use strict';

  /* Sahil: inspirational / motivational / spiritual — random */
  var SAHIL = [
    'Jo kaam aaj mushkil lagta hai, wahi kal aapki pehchaan banta hai.',
    'Arise, awake, and stop not till the goal is reached. — Swami Vivekananda',
    'Karm karo, phal ki chinta mat karo. Mehnat kabhi khaali nahi jaati.',
    'Small steps, taken every day, travel further than big plans taken never.',
    'Shaant mann sabse tez dimaag hota hai.',
    'Discipline is simply remembering what you really want.',
    'Andhera kitna bhi gehra ho, ek diya kaafi hota hai.',
    'Do the work so well that it speaks before you do.',
    'Jo apne aap ko jeet leta hai, use duniya jeetne ki zaroorat nahi padti.',
    'A calm start to the morning is half the day won.',
    'Girna haar nahi hai. Uthne se mana kar dena haar hai.',
    'What you do when nobody is watching is who you really are.',
    'Sabr aur mehnat — in dono ka jawaab waqt khud deta hai.',
    'Be grateful for what you have while you work for what you want.',
    'Mann ke haare haar hai, mann ke jeete jeet.',
    'Energy flows where attention goes. Choose your focus with care.',
    'Jahan shraddha hai, wahan raasta apne aap ban jaata hai.',
    'The best time to begin was yesterday. The next best time is right now.',
    'Bada sochiye, chhote se shuru kijiye, par aaj hi shuru kijiye.',
    'Peace is not the absence of work. It is doing the work without fear.',
    'Har subah ek naya mauka hai — kal ki galti ko aaj ki seekh banane ka.',
    'Leaders do not wait for the right moment. They make the moment right.',
    'Seva se bada koi dharm nahi, aur imaandaari se badi koi kamaai nahi.',
    'Stay humble in success and steady in failure. Both will pass.'
  ];

  /* Sneha: Quote of the Day — list ke hisaab se roz agla */
  var SNEHA = [
    'Aaj ka din utna hi khoobsurat hoga jitna aap use banana chahengi.',
    'You are allowed to be a masterpiece and a work in progress at the same time.',
    'Muskurahat sabse sasta aur sabse keemti tohfa hai — aaj kisi ko zaroor dijiye.',
    'Quiet confidence does more than loud doubt ever will.',
    'Khud par bharosa rakhiye. Aap jitna sochti hain, usse kahin zyada kar sakti hain.',
    'Progress, not perfection. One good step is enough for today.',
    'Jo dil se kiya jaata hai, woh hamesha achha hi hota hai.',
    'Your pace is your own. Flowers do not hurry, and still they bloom.',
    'Chhoti-chhoti khushiyan hi badi zindagi banati hain.',
    'Kindness is a strength. Keep it, even on the busy days.',
    'Aaj ki mehnat kal ka sukoon hai.',
    'Believe in the person you are becoming.',
    'Himmat ka matlab darr ka na hona nahi, darr ke baad bhi aage badhna hai.',
    'Do one thing today that your future self will thank you for.',
    'Aap jahan bhi jaati hain, thodi roshni saath le jaati hain. Use bujhne mat dijiye.',
    'A clear mind and a kind heart can handle almost any day.',
    'Har mushkil ek naya hunar sikha kar jaati hai.',
    'You do not have to do everything. You only have to do the next right thing.',
    'Sapne wahi sach hote hain jinke liye neend thodi kam ki jaati hai.',
    'Grace under pressure is its own kind of power.',
    'Apni tulna sirf apne kal se kijiye, kisi aur se nahi.',
    'Start where you are. Use what you have. Do what you can.',
    'Sukoon bahar nahi milta, woh andar se shuru hota hai.',
    'Let your work be honest and your day will be light.',
    'Aaj khud ke liye bhi do pal nikaliye. Aap bhi zaroori hain.',
    'Strong is not loud. Strong is showing up again tomorrow.',
    'Jo beet gaya use jaane dijiye. Jo aane wala hai, woh aapka intezaar kar raha hai.',
    'Every expert once sat exactly where a beginner sits today.',
    'Shukriya kehna seekh liya to har din achha lagne lagta hai.',
    'Dream gently, work steadily, and trust the timing.',
    'Aap kaafi hain — aaj bhi, abhi bhi, jaisi hain waisi hi.'
  ];

  function dayOfYear() {
    var d = new Date();
    return Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 0)) / 86400000);
  }
  function sahilQuote() {
    var last = -1, i;
    try { last = +localStorage.getItem('ag_sq'); } catch (e) {}
    do { i = Math.floor(Math.random() * SAHIL.length); } while (SAHIL.length > 1 && i === last);
    try { localStorage.setItem('ag_sq', i); } catch (e) {}
    return SAHIL[i];
  }
  function snehaQuote() { return SNEHA[dayOfYear() % SNEHA.length]; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }

  /* Likha hua naam nikaalo. Sawaal jaisa lage (lamba / ? / number) to null. */
  function parseName(q) {
    var s = String(q || '').trim();
    if (!s || s.length > 40 || /[?\d]/.test(s)) return null;
    s = s.replace(/[.,!]+/g, ' ')
      .replace(/\b(my name is|mera naam|mera name|i am|i'm|im|this is|main|mai|mein|me|naam|name|hoon|hun|hu|hai|here|hi|hello|hey|namaste|ji|sir|mam|madam)\b/gi, ' ')
      .replace(/\s+/g, ' ').trim();
    if (!s) return null;
    var w = s.split(' ');
    if (w.length > 3 || !/^[A-Za-zऀ-ॿ .'-]+$/.test(s)) return null;
    if (/\b(orders?|stock|pos?|production|service|customers?|sales|pending|late|today|summary|show|list|dealers?|battery|batteries|tickets?|purchase|invoices?|reports?|dispatch|ims|soms|plt|erp|cash|ledger|help|what|kya|kitna|kitne|kaun|who|how|top|low|new)\b/i.test(s)) return null;
    return w.map(cap).join(' ');
  }
  function who(name) {
    var n = String(name || '').toLowerCase();
    if (/\bsahil\b|साहिल/.test(n)) return 'sahil';
    if (/\bsneha\b|स्नेहा/.test(n)) return 'sneha';
    return '';
  }

  /* Naam milne par pehla jawaab */
  function greet(name) {
    var k = who(name);
    if (k === 'sahil') return '**Namaste, ' + name + ' ji.** 🙏\n\nAaj ke liye ek vichaar:\n\n> ' + sahilQuote() + '\n\nAb bataiye, kya dekhna hai — orders, stock, production ya service?';
    if (k === 'sneha') return '**Good to see you, ' + name + '.** 🌸\n\n**Quote of the Day**\n\n> ' + snehaQuote() + '\n\nAb bataiye, aaj kis cheez mein madad karun?';
    return '**Welcome, ' + name + '.** Main Ask Litpax hoon — orders, stock, production, purchase ya service, jo poochna ho poochiye.';
  }

  /* Khaali chat ke upar dikhne wali line (naam pehle se pata ho) */
  function hero(name) {
    var k = who(name);
    if (k === 'sahil') return { h: 'Namaste, ' + name + ' ji', p: '“' + sahilQuote() + '”' };
    if (k === 'sneha') return { h: 'Hello, ' + name, p: 'Quote of the Day — “' + snehaQuote() + '”' };
    return null;
  }

  /* "Who created you?" — kisi bhi waqt */
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

  window.AGENT_PERSONA = { parseName: parseName, greet: greet, hero: hero, creator: creator };
})();
