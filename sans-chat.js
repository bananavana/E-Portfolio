/* A drop-in replacement for the existing chatbot controller in index.html.
 * Uses the existing Vercel /api/chat. No API keys are stored here.
 */
(() => {
  'use strict';
  const STORE = 'van-sans-chat-v2';
  const MAX_HISTORY = 20;
  const EMAIL = 'vanallenserafico@gmail.com';
  const LINKS = new Set([
    'https://github.com/bananavana',
    'https://github.com/GouuuM/PROJECT-S.W.I.F.T',
    'https://github.com/potchi420/Payroll-System',
    'https://www.figma.com/design/cTM8ADROP6pS9KDDbn4NnX/HCI-Final-Project?node-id=523-434&t=iSbxyGGMbJXLMpt1-1'
  ]);
  const PROJECTS = {
    travelease: 'TravelEase is a mobile booking UI prototype built with Figma for a group HCI project. it covers search, booking flow, and mobile layouts.',
    swift: 'PROJECT-S.W.I.F.T is a group-made Java console school management system. it handles student records, enrollment, and saved data.',
    payroll: 'the Payroll System is a C# Windows Forms desktop app for school employee payroll and pay computation.'
  };
  const facts = {
    skills: 'Java, C#, HTML, CSS, JavaScript, MongoDB, and MySQL. all listed at beginner level.',
    games: 'Valorant, Monster Hunter, Teamfight Tactics, League of Legends, Undertale, and Roblox, among others.'
  };
  const SENSITIVE = /\b(suicid|self.harm|kill myself|want to die|hurt myself|depressed|grief|my friend died|abuse|panic attack|really scared|hopeless)\b/i;
  const NAMES_OF_GAMES = /\b(valorant|monster hunter|tft|league of legends|lol|undertale|roblox|minecraft|genshin|stardew|fortnite|elden ring|hollow knight)\b/i;

  function init() {
    const el = id => document.getElementById(id);
    const chat = el('chat'), launch = el('chat-launch'), close = el('chat-close');
    const log = el('chat-log'), chips = el('chat-chips'), form = el('chat-form');
    const input = el('chat-input'), send = el('chat-send');
    if (![chat, launch, close, log, chips, form, input, send].every(Boolean)) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    let muted = true, audio = null, busy = false, skip = false, typed = false;
    let turns = [], lastTopic = '', lastJoke = -1, jokeStreak = 0, awaitingGame = false;
    let apiState = 'ready';

    // Original pixel-inspired skeleton drawing. You may swap this SVG for your own sprite.
    const PORTRAIT = `<svg viewBox="0 0 96 96" aria-hidden="true" shape-rendering="crispEdges">
      <path class="sans-hood" d="M4 96V71L22 60H74L92 71V96Z"/><path class="sans-outline" d="M15 76V34L26 17H70L81 34V76L67 83H29Z"/>
      <path class="sans-skull" d="M22 39L29 22H67L74 39V65L64 75H32L22 65Z"/>
      <path class="sans-eye sans-eye-left" d="M27 39Q35 30 44 39V48Q35 55 27 48Z"/>
      <path class="sans-eye sans-eye-right" d="M52 39Q61 30 69 39V48Q61 55 52 48Z"/>
      <circle class="sans-eye-glow" cx="61" cy="44" r="4"/>
      <path class="sans-outline" d="M43 54H53L48 59Z"/>
      <path class="sans-outline" d="M30 62H66V69H30Z"/>
      <path class="sans-teeth" d="M36 62V69M43 62V69M50 62V69M57 62V69"/>
      <path class="sans-outline" d="M22 83L10 96H25L38 85M74 83L86 96H71L58 85"/>
    </svg>`;
    const head = chat.querySelector('.chat-head');
    if (!head) return;
    const oldH2 = head.querySelector('h2');
    if (oldH2) oldH2.textContent = 'sans';
    chat.setAttribute('aria-label', 'Talk to a Sans-inspired AI character about Van');
    launch.textContent = 'Talk to Sans';
    input.placeholder = 'say something...';
    input.setAttribute('aria-label', 'Message Sans');
    const identity = document.createElement('div');
    identity.className = 'sans-identity';
    const portrait = document.createElement('div');
    portrait.className = 'sans-portrait';
    portrait.dataset.mood = 'neutral';
    portrait.setAttribute('role', 'img');
    portrait.setAttribute('aria-label', 'Sans-style skeleton, neutral expression');
    portrait.innerHTML = PORTRAIT; // constant developer-controlled markup, not model output
    const textBox = document.createElement('div');
    textBox.className = 'sans-identity-text';
    const name = document.createElement('h2');
    name.textContent = 'sans';
    const status = document.createElement('p');
    status.className = 'sans-status';
    status.textContent = 'ready to chat · AI character';
    textBox.append(name, status);
    identity.append(portrait, textBox);
    const tools = document.createElement('div');
    tools.className = 'sans-tools';
    const sfxBtn = makeButton('SFX OFF', 'Turn on dialogue sounds');
    const skipBtn = makeButton('SKIP', 'Skip dialogue typing');
    const newBtn = makeButton('NEW', 'Clear this conversation');
    skipBtn.disabled = true;
    tools.append(sfxBtn, skipBtn, newBtn);
    head.replaceChildren(identity, tools, close);
    const note = document.createElement('div');
    note.className = 'sans-mode-note';
    note.textContent = 'AI portrayal · replies may be imperfect';
    form.parentNode.insertBefore(note, form);

    function makeButton(label, title) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label; b.title = title;
      b.setAttribute('aria-label', title); return b;
    }
    function setMood(mood) {
      const allowed = ['neutral', 'happy', 'thinking', 'surprised', 'serious', 'sleepy', 'sad'];
      const m = allowed.includes(mood) ? mood : 'neutral';
      portrait.dataset.mood = m;
      portrait.setAttribute('aria-label', 'Sans-style skeleton, ' + m + ' expression');
    }
    function setStatus(s) {
      apiState = s;
      status.textContent = s === 'online' ? 'AI connected · in character' :
        s === 'offline' ? 'offline mode · limited replies' :
        s === 'thinking' ? 'thinking... probably' : 'ready to chat · AI character';
    }
    function setRich(parent, value) {
      parent.replaceChildren();
      const re = /(https?:\/\/[^\s]+|[\w.+-]+@[\w-]+\.[\w.-]+)/g;
      String(value).split(re).forEach(part => {
        if (!part) return;
        const url = part.replace(/[.,;!?]+$/, '');
        if (url === EMAIL || LINKS.has(url)) {
          const a = document.createElement('a');
          a.href = url === EMAIL ? 'mailto:' + EMAIL : url;
          a.textContent = url; if (url !== EMAIL) { a.rel = 'noopener noreferrer'; a.target = '_blank'; }
          parent.appendChild(a);
          if (part.length > url.length) parent.appendChild(document.createTextNode(part.slice(url.length)));
        } else parent.appendChild(document.createTextNode(part));
      });
    }
    function message(who, content) {
      const wrapper = document.createElement('div');
      wrapper.className = 'msg ' + (who === 'user' ? 'user' : 'bot');
      if (who === 'assistant') {
        const tag = document.createElement('span'); tag.className = 'sans-speaker'; tag.textContent = 'sans';
        const txt = document.createElement('span'); txt.className = 'sans-text';
        setRich(txt, content); wrapper.append(tag, txt);
      } else wrapper.textContent = content;
      log.appendChild(wrapper); log.scrollTop = log.scrollHeight;
      return wrapper;
    }
    function remember() {
      const data = { turns: turns.slice(-MAX_HISTORY), lastTopic, jokeStreak, awaitingGame, lastJoke };
      try { sessionStorage.setItem(STORE, JSON.stringify(data)); } catch { /* storage blocked */ }
    }
    function restore() {
      try {
        const obj = JSON.parse(sessionStorage.getItem(STORE) || 'null');
        if (!obj || !Array.isArray(obj.turns)) return;
        turns = obj.turns.filter(t => t && ['user', 'assistant'].includes(t.role) && typeof t.content === 'string').slice(-MAX_HISTORY);
        lastTopic = String(obj.lastTopic || '').slice(0, 40);
        jokeStreak = Math.min(20, Math.max(0, Number(obj.jokeStreak) || 0));
        awaitingGame = !!obj.awaitingGame;
        lastJoke = Number.isInteger(obj.lastJoke) ? obj.lastJoke : -1;
        turns.forEach(t => message(t.role, t.content));
      } catch { /* no stored conversation */ }
    }
    function addTurn(role, content) {
      turns.push({ role, content }); turns = turns.slice(-MAX_HISTORY); remember();
    }
    function pick(options) {
      return options[Math.floor(Math.random() * options.length)];
    }
    const jokes = [
      'why did the skeleton refuse to race?\n\nhe couldn\'t find the nerve.\n\n...yeah. fair reaction.',
      'i started a band with some skeletons.\n\nour first album was pretty bare-bones.',
      'why did the skeleton bring a ladder to school?\n\nto reach a higher level.\n\n...i\'ll see myself out.',
      'i tried to take up cooking.\n\nturns out i don\'t have the stomach for it.'
    ];
    function special(q) {
      if (SENSITIVE.test(q)) return null; // let dedicated empathy handling run
      if (/\b(joke|pun|make me laugh)\b/i.test(q)) {
        jokeStreak++;
        if (jokeStreak >= 5) return { reply: 'five jokes? wow.\n\nyou really have a high tolerance for bad comedy.\n\nok, i\'m officially on break.', mood:'sleepy', topic:'jokes' };
        lastJoke = (lastJoke + 1) % jokes.length;
        return { reply: jokes[lastJoke], mood:'happy', topic:'jokes' };
      }
      jokeStreak = 0;
      if (/\bpapyrus\b/i.test(q)) return { reply: pick([
        'papyrus? he puts his whole heart into everything.\n\n...figuratively. i\'m proud of him.',
        'my brother? real determined guy. big ideas. bigger spaghetti plans.\n\nwouldn\'t trade him for anything.'
      ]), mood:'happy', topic:'papyrus' };
      if (/\b(secret|easter egg|hidden message)\b/i.test(q)) return {
        reply: 'secret, huh?\n\ntry asking about my brother. or keep asking for jokes until i run out of excuses.\n\nnot that you heard that from me.', mood:'thinking', topic:'secret'
      };
      if (/\b(judg(e)?ment|bad time)\b/i.test(q)) return {
        reply: '...\n\nthat\'s a pretty heavy question.\n\nwhat matters more than a score is what you choose to do next.', mood:'serious', topic:'judgement'
      };
      if (/\b(ketchup|hot dogs?)\b/i.test(q)) return {
        reply: 'now you\'re speaking my language.\n\ni have very simple standards for a good meal.', mood:'happy', topic:'food'
      };
      return null;
    }
    function offline(q) {
      const s = q.toLowerCase().trim();
      if (SENSITIVE.test(s)) return { reply: 'oh. that sounds really hard.\n\nyou don\'t have to deal with it alone. if you can, talk with someone you trust.\n\ni\'m listening, too.', mood:'sad', topic:'support' };
      if (awaitingGame && NAMES_OF_GAMES.test(s) && s.length < 110) {
        awaitingGame = false;
        return { reply: 'oh, ' + (s.length > 50 ? 'that one' : q.trim()) + '? nice choice.\n\nwhat do you like most about it?', mood:'happy', topic:'visitor-games' };
      }
      if (/^(hi|hey|hello|yo|howdy|sup)[!.?\s]*$/i.test(s)) return { reply: pick(['hey. welcome back.\n\nneed something?', 'oh, hey.\n\ni was almost doing something productive. almost.']), mood:'neutral' };
      if (/\b(who are you|are you real|are you sans|are you an ai|are you a bot)\b/.test(s)) return { reply: 'i\'m an AI doing a certain lazy skeleton act.\n\npretty good at the lazy part, at least.', mood:'happy' };
      if (/\b(bye|goodbye|see ya|later)\b/.test(s)) return { reply: 'later. don\'t forget to take breaks.\n\ni\'m kind of an expert.', mood:'sleepy' };
      if (/\b(thanks|thank you|salamat)\b/.test(s)) return { reply: 'no problem.\n\nthat one was easy on the bones.', mood:'happy' };
      if (/\b(sad|lonely|bad day|feel down|upset|stressed|anxious)\b/.test(s)) return { reply: 'oh. that sounds rough.\n\nwanna tell me what happened? no jokes unless you want them.', mood:'sad', topic:'support' };
      if (/\b(who is van|who's van|tell me about van|about van|who is he)\b/.test(s)) return { reply: 'van allen serafico is a fourth-year BSIT student at Philippine Christian University, training toward game development.\n\nhe\'s building up his skills through school projects. quiet progress still counts.', mood:'neutral', topic:'about' };
      if (lastTopic === 'projects' && /\b(java|school|console)\b/.test(s)) return { reply: PROJECTS.swift, mood:'neutral', topic:'SWIFT' };
      if (lastTopic === 'projects' && /\b(c#|pay|desktop)\b/.test(s)) return { reply: PROJECTS.payroll, mood:'neutral', topic:'Payroll' };
      if (lastTopic === 'projects' && /\b(mobile|booking|design)\b/.test(s)) return { reply: PROJECTS.travelease, mood:'neutral', topic:'TravelEase' };
      if (/\b(travelease|figma|booking|ui\/ux)\b/.test(s)) return { reply: PROJECTS.travelease, mood:'neutral', topic:'TravelEase' };
      if (/\b(swift|s\.w\.i\.f\.t|enrollment|school management)\b/.test(s)) return { reply: PROJECTS.swift, mood:'neutral', topic:'SWIFT' };
      if (/\b(payroll|winforms|windows forms)\b/.test(s)) return { reply: PROJECTS.payroll, mood:'neutral', topic:'Payroll' };
      if (/\b(projects?|built|portfolio work)\b/.test(s)) return { reply: 'van\'s got three projects listed:\n\n• TravelEase (Figma booking UI)\n• PROJECT-S.W.I.F.T (Java school system)\n• Payroll System (C# Windows Forms)\n\nwhich one do you wanna know more about?', mood:'thinking', topic:'projects' };
      if (/\b(skills?|technologies|programming|languages? does (he|van) know)\b/.test(s)) return { reply: 'here\'s van\'s current skills list:\n\n' + facts.skills + '\n\nstill leveling up.', mood:'neutral', topic:'skills' };
      if (/\b(games? does (he|van) play|van.*games?|what games|which games|game tastes)\b/.test(s)) {
        awaitingGame = true;
        return { reply: 'van plays ' + facts.games + '\n\nwhat do you play?', mood:'happy', topic:'games' };
      }
      if (/\b(ojt|internship|work experience|cablecrafts|technical support)\b/.test(s)) return { reply: 'van did OJT as Technical Support at CableCrafts Systems, Inc.\n\ni don\'t have the specific tasks or dates on file.', mood:'neutral', topic:'ojt' };
      if (/\b(college|education|study|school|pcu|university|bsit)\b/.test(s)) return { reply: 'he\'s a fourth-year BSIT student at Philippine Christian University in Metro Manila.\n\nhe went to Sta. Clara Parish School for senior high.', mood:'neutral', topic:'education' };
      if (/\b(contact|email|reach|message him|github)\b/.test(s)) return { reply: 'you can reach van at ' + EMAIL + '.\n\nhis GitHub is https://github.com/bananavana', mood:'neutral', topic:'contact' };
      if (/\b(resume|cv|phone|address|salary|availability|unreal|unity|godot|python)\b/.test(s)) return { reply: 'don\'t have that on van\'s public portfolio.\n\nbetter ask him directly: ' + EMAIL, mood:'thinking' };
      // Short follow-ups are interpreted in terms of the preceding topic.
      if (/^(why|how|tell me more|what about it|that one|explain|more|what does it do)\??$/i.test(s)) {
        if (lastTopic === 'TravelEase') return { reply: PROJECTS.travelease + '\n\nit\'s a group HCI design project, not a deployed booking service.', topic:'TravelEase' };
        if (lastTopic === 'SWIFT') return { reply: PROJECTS.swift, topic:'SWIFT' };
        if (lastTopic === 'Payroll') return { reply: PROJECTS.payroll, topic:'Payroll' };
        if (lastTopic === 'games') return { reply: 'the games on van\'s list range from competitive matches to action adventures.\n\ni don\'t have his rankings on file.', topic:'games' };
        if (lastTopic === 'skills') return { reply: 'the portfolio labels those skills as beginner.\n\nthe project descriptions show where he\'s been practicing them.', topic:'skills' };
        if (lastTopic === 'support') return { reply: 'you can tell me a little more, if you want.\n\ni\'ll listen.', mood:'sad', topic:'support' };
      }
      if (awaitingGame && /^yes|^sure|^yeah/i.test(s)) return { reply:'nice. which game?', mood:'happy', topic:'visitor-games' };
      return { reply: pick([
        'huh. i might need my full AI brain for that one.\n\ni\'m in limited mode right now. wanna ask about van\'s projects or skills?',
        'sorry, that one\'s beyond my offline brain.\n\ntry again in a bit, or ask about van\'s portfolio.'
      ]), mood:'thinking' };
    }
    function determineMood(q, answer, hint) {
      if (hint) return hint;
      if (SENSITIVE.test(q) || /\b(sad|scared|lonely|sorry|upset)\b/i.test(q)) return 'sad';
      if (/\b(judge|serious|danger|threat|responsibility)\b/i.test(q)) return 'serious';
      if (/\b(joke|funny|laugh|papyrus|amazing|great)\b/i.test(q)) return 'happy';
      if (/\b(why|how|explain|think|wonder|maybe)\b/i.test(q)) return 'thinking';
      if (/\b(surprise|wow|really\?!)\b/i.test(q)) return 'surprised';
      if (/\b(nap|sleep|lazy|tired|goodnight)\b/i.test(answer)) return 'sleepy';
      return 'neutral';
    }
    function beep() {
      if (muted) return;
      try {
        audio ||= new (window.AudioContext || window.webkitAudioContext)();
        if (audio.state === 'suspended') audio.resume().catch(() => {});
        const osc = audio.createOscillator(), gain = audio.createGain();
        osc.type = 'triangle'; osc.frequency.value = 250;
        const now = audio.currentTime;
        gain.gain.setValueAtTime(.012, now);
        gain.gain.exponentialRampToValueAtTime(.001, now + .028);
        osc.connect(gain); gain.connect(audio.destination);
        osc.start(now); osc.stop(now + .029);
      } catch { muted = true; sfxBtn.textContent = 'SFX OFF'; }
    }
    async function typeReply(answer, mood) {
      setMood(mood); portrait.classList.add('is-talking');
      const bubble = message('assistant', '');
      const txt = bubble.querySelector('.sans-text');
      const value = String(answer || '').slice(0, 2400);
      skip = false; typed = true; skipBtn.disabled = false;
      if (reduced || value.length < 4) {
        setRich(txt, value);
      } else {
        const duration = Math.min(3400, Math.max(400, value.length * 22));
        const t0 = performance.now(); let old = 0, nextBeep = 0;
        await new Promise(resolve => {
          function frame(now) {
            const count = skip ? value.length : Math.min(value.length, Math.floor(((now - t0) / duration) * value.length));
            if (count !== old) {
              txt.textContent = value.slice(0, count);
              log.scrollTop = log.scrollHeight;
              if (count < value.length && now > nextBeep) { beep(); nextBeep = now + 95; }
              old = count;
            }
            if (count >= value.length) { setRich(txt, value); resolve(); }
            else requestAnimationFrame(frame);
          }
          requestAnimationFrame(frame);
        });
      }
      portrait.classList.remove('is-talking'); typed = false; skipBtn.disabled = true;
      addTurn('assistant', value);
    }
    async function askServer() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const result = await fetch('/api/chat', {
          method:'POST', headers:{ 'Content-Type':'application/json' }, signal: controller.signal,
          body:JSON.stringify({ messages: turns.slice(-12) })
        });
        if (!result.ok) throw new Error('API status ' + result.status);
        const data = await result.json();
        if (!data || typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('Empty AI reply');
        return data.reply.trim();
      } finally { clearTimeout(timer); }
    }
    async function ask(value) {
      const q = String(value || '').trim();
      if (busy || !q) return;
      busy = true; send.disabled = true; input.disabled = true;
      chips.hidden = true; message('user', q); addTurn('user', q);
      let result;
      try {
        result = special(q);
        if (!result) {
          setStatus('thinking');
          try {
            result = { reply:await askServer() };
            setStatus('online');
          } catch {
            result = offline(q); setStatus('offline');
          }
        }
        if (result.topic) lastTopic = result.topic;
        if (/\bwhat (games? )?do you play\?/i.test(result.reply)) awaitingGame = true;
        await typeReply(result.reply, determineMood(q, result.reply, result.mood));
      } finally {
        remember(); busy = false; send.disabled = false; input.disabled = false;
        if (chat.classList.contains('open')) input.focus();
      }
    }
    function makeChips() {
      chips.replaceChildren(); chips.hidden = false;
      ['Who is Van?', 'Show his projects', 'What games does Van play?', 'Tell a joke'].forEach(q => {
        const b = makeButton(q, q); b.className = 'sans-chip-button';
        b.addEventListener('click', () => ask(q)); chips.appendChild(b);
      });
    }
    function openChat() {
      chat.classList.add('open'); launch.style.display = 'none'; launch.setAttribute('aria-expanded','true');
      if (!turns.length && !log.children.length) message('assistant', 'oh, hey.\n\nwelcome to van\'s corner of the internet. ask me about his work, or just talk.\n\ni wasn\'t doing much anyway.');
      input.focus();
    }
    function closeChat() { chat.classList.remove('open'); launch.style.display=''; launch.setAttribute('aria-expanded','false'); launch.focus(); }
    sfxBtn.addEventListener('click', () => {
      muted = !muted;
      sfxBtn.textContent = muted ? 'SFX OFF' : 'SFX ON';
      sfxBtn.title = muted ? 'Enable dialogue sounds' : 'Mute dialogue sounds';
      if (!muted) {
        // Initialize while the user gesture is active (browser autoplay policy).
        try {
          audio ||= new (window.AudioContext || window.webkitAudioContext)();
          audio.resume().catch(() => {});
        } catch { muted = true; sfxBtn.textContent = 'SFX OFF'; }
      }
    });
    skipBtn.addEventListener('click', () => { if (typed) skip = true; });
    newBtn.addEventListener('click', () => {
      if (busy) { if (typed) skip = true; return; }
      turns = []; lastTopic = ''; jokeStreak = 0; awaitingGame = false; lastJoke = -1;
      log.replaceChildren(); try { sessionStorage.removeItem(STORE); } catch {}
      setMood('neutral'); setStatus('ready'); makeChips();
      message('assistant','fresh start, huh?\n\nworks for me.'); input.focus();
    });
    launch.addEventListener('click',openChat); close.addEventListener('click',closeChat);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && chat.classList.contains('open')) { if (typed) skip = true; else closeChat(); } });
    form.addEventListener('submit', e => { e.preventDefault(); const q = input.value; input.value=''; ask(q); });
    restore(); if (!turns.length) makeChips(); else chips.hidden=true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
