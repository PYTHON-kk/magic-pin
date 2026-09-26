/**
 * Vera AI — Interactive Merchant Chat Client
 * Connects directly to Vera API (/v1/reply, /v1/tick, /v1/context, /v1/healthz)
 */

(function () {
  'use strict';

  // ─── State ───
  const state = {
    backendUrl: window.location.origin.includes('http') ? window.location.origin : 'https://vera-bot-r8yd.onrender.com',
    conversationId: `conv_${Date.now().toString(36)}`,
    turnNumber: 1,
    soundEnabled: true,
    devMode: localStorage.getItem('vera_dev_mode') === 'true',
    activeMerchant: 'm_001_drmeera_dentist_delhi',
    merchants: {
      'm_001_drmeera_dentist_delhi': {
        name: "Dr. Meera's Dental Clinic",
        category: 'dentists',
        locality: 'Lajpat Nagar, Delhi',
        tone: 'peer_clinical',
        views: '1,420',
        calls: '38',
        ctr: '4.2%',
        languages: ['hi', 'en'],
        welcome: "Namaste Dr. Meera! Main Vera hoon, magicpin se aapki dedicated merchant assistant. Main aapke Google Business Profile, active offers, aur patient recalls ko monitor kar rahi hoon. Main aaj aapki kya help kar sakti hoon?",
      },
      'm_003_studio11_salon_hyderabad': {
        name: 'Studio11 Family Salon',
        category: 'salons',
        locality: 'Gachibowli, Hyderabad',
        tone: 'warm_professional',
        views: '2,890',
        calls: '92',
        ctr: '5.8%',
        languages: ['en', 'hi'],
        welcome: "Hi Lakshmi! Vera here from magicpin. Your Studio11 profile is getting high interest for bridal styling and hair spa this week. How can I help you grow your bookings today?",
      },
      'm_005_powerhouse_gym_pune': {
        name: 'Powerhouse Fitness Gym',
        category: 'gyms',
        locality: 'Kothrud, Pune',
        tone: 'energetic_coaching',
        views: '940',
        calls: '19',
        ctr: '3.1%',
        languages: ['en', 'mr'],
        welcome: "Hey Vikram! Vera from magicpin. Noticed your trial inquiries dipped slightly this month compared to Deccan gyms. Ready to launch our seasonal pass push?",
      },
      'm_007_zen_ayurveda_bangalore': {
        name: 'Zen Ayurveda Clinic',
        category: 'clinics',
        locality: 'Indiranagar, Bangalore',
        tone: 'peer_clinical',
        views: '1,120',
        calls: '44',
        ctr: '4.9%',
        languages: ['en', 'kn'],
        welcome: "Greetings Dr. Ananya! Vera here. Your panchakarma wellness package has been trending in East Bangalore. How can I assist your consultation flow today?",
      },
      'm_009_sunrise_pharma_delhi': {
        name: 'Sunrise Pharmacy',
        category: 'pharmacies',
        locality: 'Rohini, Delhi',
        tone: 'accurate_informative',
        views: '3,400',
        calls: '115',
        ctr: '6.4%',
        languages: ['hi', 'en'],
        welcome: "Namaste Ramesh ji! Vera here from magicpin. We are keeping track of your chronic refills and local medicine delivery requests. What can I do for you today?",
      },
    },
  };

  // ─── DOM Elements ───
  const el = {
    appContainer: document.querySelector('.app-container'),
    sidebar: document.getElementById('sidebar'),
    btnDevMode: document.getElementById('btnDevMode'),
    btnCloseDevSidebar: document.getElementById('btnCloseDevSidebar'),
    headerMerchantSelect: document.getElementById('headerMerchantSelect'),
    backendUrl: document.getElementById('backendUrl'),
    btnConnect: document.getElementById('btnConnect'),
    connectionStatus: document.getElementById('connectionStatus'),
    latencyDisplay: document.getElementById('latencyDisplay'),
    modelDisplay: document.getElementById('modelDisplay'),
    merchantSelect: document.getElementById('merchantSelect'),
    currentMerchantName: document.getElementById('currentMerchantName'),
    metricViews: document.getElementById('metricViews'),
    metricCalls: document.getElementById('metricCalls'),
    metricCtr: document.getElementById('metricCtr'),
    merchantTags: document.getElementById('merchantTags'),
    messagesContainer: document.getElementById('messagesContainer'),
    messageInput: document.getElementById('messageInput'),
    btnSend: document.getElementById('btnSend'),
    btnClearChat: document.getElementById('btnClearChat'),
    btnExportChat: document.getElementById('btnExportChat'),
    btnTick: document.getElementById('btnTick'),
    btnSeedContext: document.getElementById('btnSeedContext'),
    btnTeardown: document.getElementById('btnTeardown'),
    btnSoundToggle: document.getElementById('btnSoundToggle'),
    tickDrawer: document.getElementById('tickDrawer'),
    tickDrawerBody: document.getElementById('tickDrawerBody'),
    btnCloseDrawer: document.getElementById('btnCloseDrawer'),
    quickSuggestions: document.getElementById('quickSuggestions'),
    welcomeTime: document.getElementById('welcomeTime'),
  };

  // ─── Mode Switching (Clean View vs Dev View) ───
  function setDevMode(enabled) {
    state.devMode = !!enabled;
    try {
      localStorage.setItem('vera_dev_mode', state.devMode ? 'true' : 'false');
    } catch (_) {}

    if (state.devMode) {
      el.appContainer.classList.add('dev-mode-active');
      if (el.btnDevMode) el.btnDevMode.classList.add('active');
    } else {
      el.appContainer.classList.remove('dev-mode-active');
      if (el.btnDevMode) el.btnDevMode.classList.remove('active');
    }
  }

  // ─── Audio Synthesis (Subtle Web Audio feedback) ───
  const audioCtx = window.AudioContext ? new (window.AudioContext || window.webkitAudioContext)() : null;

  function playSound(type) {
    if (!state.soundEnabled || !audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'send') {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
      } else if (type === 'receive') {
        osc.frequency.setValueAtTime(660, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(520, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      }
    } catch (_) {}
  }

  // ─── API Helpers ───
  async function api(path, method = 'GET', body = null) {
    const url = `${state.backendUrl.replace(/\/$/, '')}${path}`;
    const t0 = performance.now();
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const resp = await fetch(url, opts);
    const latency = Math.round(performance.now() - t0);
    const data = await resp.json();
    return { data, status: resp.status, latency };
  }

  // ─── Health & Connection Check ───
  async function checkHealth() {
    el.connectionStatus.className = 'connection-status';
    el.connectionStatus.querySelector('.status-label').textContent = 'Connecting...';

    try {
      const { data, status, latency } = await api('/v1/healthz');
      if (status === 200 && data.status === 'ok') {
        el.connectionStatus.className = 'connection-status live';
        el.connectionStatus.querySelector('.status-label').textContent = 'Online';
        el.latencyDisplay.textContent = `Latency: ${latency} ms`;

        // Also fetch metadata
        try {
          const meta = await api('/v1/metadata');
          if (meta.data?.model) {
            el.modelDisplay.textContent = `Model: ${meta.data.model}`;
          }
        } catch (_) {}
      } else {
        throw new Error('Not 200');
      }
    } catch (err) {
      el.connectionStatus.className = 'connection-status offline';
      el.connectionStatus.querySelector('.status-label').textContent = 'Offline';
      el.latencyDisplay.textContent = 'Failed to connect';
    }
  }

  // ─── Time Formatter ───
  function formatTime(date = new Date()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ─── Render Message in Chat ───
  function appendMessage(sender, text, meta = null) {
    const isBot = sender === 'vera';
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${isBot ? 'message-bot' : 'message-merchant'}`;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    if (isBot) {
      const senderTitle = document.createElement('div');
      senderTitle.className = 'message-sender';
      senderTitle.textContent = 'Vera AI';
      bubble.appendChild(senderTitle);
    }

    const textEl = document.createElement('div');
    textEl.className = 'message-text';
    textEl.textContent = text;
    bubble.appendChild(textEl);

    const footer = document.createElement('div');
    footer.className = 'message-footer';
    const timeEl = document.createElement('span');
    timeEl.className = 'msg-time';
    timeEl.textContent = formatTime();
    footer.appendChild(timeEl);

    if (!isBot) {
      const check = document.createElement('span');
      check.className = 'check-icon';
      check.textContent = '✓✓';
      footer.appendChild(check);
    }
    bubble.appendChild(footer);
    wrapper.appendChild(bubble);

    // In Dev Mode: Attach discreet expandable debug trigger and card
    if (isBot && meta && (meta.action || meta.rationale || meta.cta)) {
      const debugToggle = document.createElement('button');
      debugToggle.className = 'msg-debug-trigger';
      debugToggle.type = 'button';
      debugToggle.title = 'Inspect LLM & Decision Diagnostics (Dev Mode)';
      debugToggle.innerHTML = `<span>ⓘ</span> <span>Debug Info</span>`;

      const debugCard = document.createElement('div');
      debugCard.className = 'msg-debug-card';
      debugCard.innerHTML = `
        <div class="debug-card-header">
          <span class="debug-badge debug-badge-action">${(meta.action || 'SEND').toUpperCase()}</span>
          ${meta.cta && meta.cta !== 'none' ? `<span class="debug-badge debug-badge-cta">CTA: ${meta.cta}</span>` : ''}
          ${meta.latency ? `<span class="debug-latency">⚡ ${meta.latency}ms</span>` : ''}
        </div>
        ${meta.rationale ? `<div class="debug-rationale"><strong>Rationale:</strong> ${meta.rationale}</div>` : ''}
      `;

      debugToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        debugCard.classList.toggle('open');
      });

      wrapper.appendChild(debugToggle);
      wrapper.appendChild(debugCard);
    }

    el.messagesContainer.appendChild(wrapper);
    el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;

    playSound(isBot ? 'receive' : 'send');
  }

  // ─── Show / Hide Typing Indicator ───
  let typingIndicatorEl = null;

  function showTyping() {
    if (typingIndicatorEl) return;
    typingIndicatorEl = document.createElement('div');
    typingIndicatorEl.className = 'message-wrapper message-bot';
    typingIndicatorEl.innerHTML = `
      <div class="typing-bubble">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    `;
    el.messagesContainer.appendChild(typingIndicatorEl);
    el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;
  }

  function hideTyping() {
    if (typingIndicatorEl && typingIndicatorEl.parentNode) {
      typingIndicatorEl.parentNode.removeChild(typingIndicatorEl);
    }
    typingIndicatorEl = null;
  }

  // ─── Send Message to /v1/reply ───
  async function sendMessage(text) {
    const msg = (text || el.messageInput.value).trim();
    if (!msg) return;

    el.messageInput.value = '';
    el.messageInput.style.height = 'auto';

    // Append merchant message
    appendMessage('merchant', msg);
    showTyping();

    try {
      const payload = {
        conversation_id: state.conversationId,
        merchant_id: state.activeMerchant,
        customer_id: null,
        from_role: 'merchant',
        message: msg,
        turn_number: state.turnNumber,
        received_at: new Date().toISOString(),
      };

      const { data, status, latency } = await api('/v1/reply', 'POST', payload);
      hideTyping();

      state.turnNumber++;

      if (status === 200 && data) {
        if (data.body && data.body.trim()) {
          appendMessage('vera', data.body.trim(), {
            action: data.action,
            cta: data.cta,
            rationale: data.rationale,
            latency,
          });
        } else if (data.action === 'wait') {
          // If the bot has nothing to send, in Clean Mode don't render a bubble at all.
          // In Dev Mode, render a developer event log so engineers see the suppression/cooldown rationale.
          const devEvent = document.createElement('div');
          devEvent.className = 'dev-log-event';
          devEvent.innerHTML = `⚙️ <strong>Vera Restraint:</strong> Bot chose action <code>WAIT</code>. Rationale: ${data.rationale || 'Cooling down / suppressed'}`;
          el.messagesContainer.appendChild(devEvent);
          el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;
        } else if (data.action === 'end') {
          appendMessage('vera', 'Thank you! Let me know if you need anything else.', {
            action: 'end',
            rationale: data.rationale,
            latency,
          });
        }
      } else {
        appendMessage('vera', 'Sorry, I encountered an issue reaching the server.', { action: 'error' });
      }
    } catch (err) {
      hideTyping();
      appendMessage('vera', `Connection Error: ${err.message}`, { action: 'error' });
    }
  }

  // ─── Switch Merchant Persona ───
  function switchMerchant(merchantId) {
    state.activeMerchant = merchantId;
    const m = state.merchants[merchantId];
    if (!m) return;

    // Sync both persona selectors
    if (el.merchantSelect && el.merchantSelect.value !== merchantId) {
      el.merchantSelect.value = merchantId;
    }
    if (el.headerMerchantSelect && el.headerMerchantSelect.value !== merchantId) {
      el.headerMerchantSelect.value = merchantId;
    }

    state.conversationId = `conv_${merchantId}_${Date.now().toString(36)}`;
    state.turnNumber = 1;

    if (el.currentMerchantName) el.currentMerchantName.textContent = m.name;
    if (el.metricViews) el.metricViews.textContent = m.views;
    if (el.metricCalls) el.metricCalls.textContent = m.calls;
    if (el.metricCtr) el.metricCtr.textContent = m.ctr;

    if (el.merchantTags) {
      el.merchantTags.innerHTML = `
        <span class="tag">${m.tone}</span>
        <span class="tag">${m.locality}</span>
        <span class="tag">${m.languages.join(', ')}</span>
      `;
    }

    // Clear and show persona welcome message without technical badges
    el.messagesContainer.innerHTML = `
      <div class="system-message">
        <span class="lock-icon">🔒</span>
        <span>Switched to ${m.name} (${m.locality}). End-to-end encrypted session.</span>
      </div>
    `;
    appendMessage('vera', m.welcome, { action: 'send', rationale: `Active persona loaded: ${m.name}` });
  }

  // ─── Proactive /v1/tick Trigger ───
  async function runTick() {
    el.tickDrawer.classList.add('open');
    el.tickDrawerBody.innerHTML = `
      <div class="drawer-empty">
        <div class="dot" style="display:inline-block; animation:bounce 1.4s infinite"></div>
        <p style="margin-top:10px">Evaluating active triggers against merchant context...</p>
      </div>
    `;

    try {
      const sampleTriggers = [
        "trg_002_compliance_dci_radiograph",
        "trg_003_recall_due_priya",
        "trg_006_festival_diwali",
        "trg_007_bridal_followup_kavya",
      ];

      const { data, status } = await api('/v1/tick', 'POST', {
        now: new Date().toISOString(),
        available_triggers: sampleTriggers,
      });

      if (status === 200 && data.actions) {
        if (data.actions.length === 0) {
          el.tickDrawerBody.innerHTML = `
            <div class="drawer-empty">
              <span>🛑 Restraint Applied</span>
              <p style="margin-top:8px">No actions sent. Suppression window or eligibility limits were respected.</p>
            </div>
          `;
          return;
        }

        el.tickDrawerBody.innerHTML = '';
        data.actions.forEach((act, idx) => {
          const card = document.createElement('div');
          card.className = 'tick-action-card';
          card.innerHTML = `
            <div class="tick-header-row">
              <span class="tick-trigger-name">${act.trigger_id}</span>
              <span class="tick-badge">${act.send_as || 'vera'}</span>
            </div>
            <div class="tick-body">${act.body}</div>
            <div class="bubble-meta">
              <span class="meta-pill cta-pill">CTA: ${act.cta || 'none'}</span>
              <span class="meta-pill role-pill">${act.merchant_id}</span>
            </div>
            ${act.rationale ? `<div class="rationale-box">💡 ${act.rationale}</div>` : ''}
          `;
          el.tickDrawerBody.appendChild(card);
        });
      } else {
        el.tickDrawerBody.innerHTML = `<p class="drawer-empty" style="color:var(--color-danger)">Tick failed: HTTP ${status}</p>`;
      }
    } catch (err) {
      el.tickDrawerBody.innerHTML = `<p class="drawer-empty" style="color:var(--color-danger)">Error: ${err.message}</p>`;
    }
  }

  // ─── Seed Context ───
  async function seedContext() {
    const originalText = el.btnSeedContext.innerHTML;
    el.btnSeedContext.innerHTML = '⏳ Seeding...';

    try {
      // Seed category
      await api('/v1/context', 'POST', {
        scope: 'category',
        context_id: 'dentists',
        version: 1,
        payload: {
          slug: 'dentists',
          display_name: 'Dentists',
          voice: {
            tone: 'peer_clinical',
            register: 'respectful_collegial',
            vocab_allowed: ['chair time', 'OPD', 'fluoride varnish', 'scaling', 'caries', 'aligner'],
            vocab_taboo: ['cheap', 'sale', 'guaranteed', '100% safe'],
          },
        },
        delivered_at: new Date().toISOString(),
      });

      // Seed merchant with active offers & performance
      await api('/v1/context', 'POST', {
        scope: 'merchant',
        context_id: 'm_001_drmeera_dentist_delhi',
        version: 1,
        payload: {
          merchant_id: 'm_001_drmeera_dentist_delhi',
          category_slug: 'dentists',
          identity: {
            name: "Dr. Meera's Dental Clinic",
            owner_first_name: 'Meera',
            locality: 'Lajpat Nagar',
            city: 'Delhi',
            languages: ['en', 'hi'],
          },
          performance: { views: 2410, calls: 18, ctr: 0.021 },
          offers: [
            { id: 'o_meera_001', title: 'Dental Cleaning @ ₹299', status: 'active', started: '2026-03-01' },
            { id: 'o_meera_002', title: 'Deep Cleaning @ ₹499', status: 'expired', ended: '2026-02-28' },
          ],
          review_themes: [
            { theme: 'wait_time', sentiment: 'neg', occurrences_30d: 3 },
            { theme: 'doctor_manner', sentiment: 'pos', occurrences_30d: 5 },
          ],
        },
        delivered_at: new Date().toISOString(),
      });

      el.btnSeedContext.innerHTML = '✅ Seeded!';
      setTimeout(() => { el.btnSeedContext.innerHTML = originalText; }, 2000);
      checkHealth();
    } catch (e) {
      el.btnSeedContext.innerHTML = '❌ Failed';
      setTimeout(() => { el.btnSeedContext.innerHTML = originalText; }, 2000);
    }
  }

  // ─── Reset Session ───
  async function teardown() {
    if (!confirm('Reset in-memory session, suppression window, and auto-reply streaks?')) return;
    try {
      await api('/v1/teardown', 'POST', {});
      alert('Session reset successfully!');
      switchMerchant(state.activeMerchant);
    } catch (err) {
      alert(`Teardown failed: ${err.message}`);
    }
  }

  // ─── Event Listeners ───
  function initEvents() {
    // Connect / Ping
    el.btnConnect.addEventListener('click', () => {
      const val = el.backendUrl.value.trim();
      if (val) state.backendUrl = val;
      checkHealth();
    });

    // Dev Mode Toggle & Close
    if (el.btnDevMode) {
      el.btnDevMode.addEventListener('click', () => {
        setDevMode(!state.devMode);
      });
    }
    if (el.btnCloseDevSidebar) {
      el.btnCloseDevSidebar.addEventListener('click', () => {
        setDevMode(false);
      });
    }

    // Header merchant persona dropdown
    if (el.headerMerchantSelect) {
      el.headerMerchantSelect.addEventListener('change', (e) => {
        switchMerchant(e.target.value);
      });
    }

    // Sidebar merchant persona switcher
    el.merchantSelect.addEventListener('change', (e) => {
      switchMerchant(e.target.value);
    });

    // Send button & Enter key
    el.btnSend.addEventListener('click', () => sendMessage());
    el.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-grow textarea
    el.messageInput.addEventListener('input', () => {
      el.messageInput.style.height = 'auto';
      el.messageInput.style.height = `${Math.min(el.messageInput.scrollHeight, 120)}px`;
    });

    // Quick Probe Pills (Sidebar)
    document.querySelectorAll('.probe-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        const msg = pill.getAttribute('data-msg');
        sendMessage(msg);
      });
    });

    // Quick Suggestions (Above Chat Input)
    el.quickSuggestions.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (chip) {
        const msg = chip.getAttribute('data-msg');
        sendMessage(msg);
      }
    });

    // Proactive Feed Drawer
    el.btnTick.addEventListener('click', runTick);
    el.btnCloseDrawer.addEventListener('click', () => {
      el.tickDrawer.classList.remove('open');
    });

    // Context & Teardown
    el.btnSeedContext.addEventListener('click', seedContext);
    el.btnTeardown.addEventListener('click', teardown);

    // Sound toggle
    el.btnSoundToggle.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      el.btnSoundToggle.textContent = state.soundEnabled ? '🔊' : '🔇';
    });

    // Clear chat
    el.btnClearChat.addEventListener('click', () => {
      if (confirm('Clear current chat view?')) {
        el.messagesContainer.innerHTML = '';
      }
    });

    // Export conversation
    el.btnExportChat.addEventListener('click', () => {
      const msgs = Array.from(el.messagesContainer.querySelectorAll('.message-wrapper')).map((w) => {
        const isBot = w.classList.contains('message-bot');
        const text = w.querySelector('.message-text')?.textContent || '';
        return `[${isBot ? 'Vera' : 'Merchant'}] ${text}`;
      }).join('\n\n');

      const blob = new Blob([msgs], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vera-chat-${Date.now()}.txt`;
      a.click();
    });
  }

  // ─── Initialization ───
  function init() {
    el.backendUrl.value = state.backendUrl;
    el.welcomeTime.textContent = formatTime();
    setDevMode(state.devMode);
    initEvents();
    checkHealth();
  }

  init();
})();
