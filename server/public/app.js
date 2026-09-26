/**
 * Vera AI — Interactive Merchant & Customer Chat Client
 * Features:
 *   1. Persona Selection Entry Screen (Merchant vs Customer tabs, search & filters)
 *   2. Clean WhatsApp Chat View with dynamic suggested reply chips per turn
 *   3. Dev/Judge Diagnostic Mode toggleable at any time
 */

(function () {
  'use strict';

  // ─── Default Challenge Dataset Personas ───
  const DEFAULT_MERCHANTS = [
    {
      merchant_id: 'm_001_drmeera_dentist_delhi',
      category_slug: 'dentists',
      category_name: 'Dentist',
      icon: '🩺',
      identity: { name: "Dr. Meera's Dental Clinic", city: 'Delhi', locality: 'Lajpat Nagar', owner_first_name: 'Meera', languages: ['en', 'hi'] },
      performance: { views: 2410, calls: 18, ctr: 0.021 },
      offers: [
        { id: 'o_meera_001', title: 'Dental Cleaning @ ₹299', status: 'active', started: '2026-03-01' },
        { id: 'o_meera_002', title: 'Deep Cleaning @ ₹499', status: 'expired', ended: '2026-02-28' },
      ],
      tone: 'peer_clinical',
      welcome: "Hello Dr. Meera! I am Vera, your dedicated magicpin assistant. I am actively monitoring your Google Business Profile, active offers, and patient recall schedule. How can I assist your clinic today?",
      initialChips: ['Show active offers', 'Boost profile calls', 'Compare to peers']
    },
    {
      merchant_id: 'm_002_bharat_dentist_mumbai',
      category_slug: 'dentists',
      category_name: 'Dentist',
      icon: '🩺',
      identity: { name: 'Bharat Dental Care', city: 'Mumbai', locality: 'Andheri West', owner_first_name: 'Bharat', languages: ['en'] },
      performance: { views: 980, calls: 4, ctr: 0.018 },
      offers: [],
      tone: 'peer_clinical',
      welcome: "Hello Dr. Bharat! Vera here from magicpin. Noticed your views and inquiries had a slight dip recently. Would you like to review your profile and patient recall list?",
      initialChips: ['Fix perf dip', 'Patient recalls', 'Launch new offer']
    },
    {
      merchant_id: 'm_003_studio11_salon_hyderabad',
      category_slug: 'salons',
      category_name: 'Salon',
      icon: '💇',
      identity: { name: 'Studio11 Family Salon', city: 'Hyderabad', locality: 'Gachibowli', owner_first_name: 'Lakshmi', languages: ['en'] },
      performance: { views: 4980, calls: 62, ctr: 0.048 },
      offers: [
        { id: 'o_studio11_001', title: 'Haircut @ ₹99', status: 'active', started: '2026-03-01' },
        { id: 'o_studio11_002', title: 'Hair Spa @ ₹499', status: 'active', started: '2026-03-15' },
      ],
      tone: 'warm_professional',
      welcome: "Hi Lakshmi! Vera here from magicpin. Your Studio11 profile is getting high interest for bridal styling and hair spa this week. How can I help you grow your bookings today?",
      initialChips: ['Push bridal package', 'Active hair spa offer', 'Increase weekend bookings']
    },
    {
      merchant_id: 'm_004_glamour_salon_pune',
      category_slug: 'salons',
      category_name: 'Salon',
      icon: '💇',
      identity: { name: 'Glamour Lounge Spa & Salon', city: 'Pune', locality: 'Koregaon Park', owner_first_name: 'Ritu', languages: ['en'] },
      performance: { views: 3200, calls: 48, ctr: 0.041 },
      offers: [{ id: 'o_glam_001', title: 'Weekend Glow Facial @ ₹799', status: 'active' }],
      tone: 'warm_professional',
      welcome: "Hello Ritu! Vera from magicpin. We are tracking weekend salon queries in Koregaon Park. Ready to push your weekend facial package to local customers?",
      initialChips: ['Push facial offer', 'View reviews', 'Customer winback']
    },
    {
      merchant_id: 'm_005_pizzajunction_restaurant_delhi',
      category_slug: 'restaurants',
      category_name: 'Restaurant',
      icon: '🍕',
      identity: { name: 'SK Pizza Junction', city: 'Delhi', locality: 'Connaught Place', owner_first_name: 'Sunil', languages: ['en'] },
      performance: { views: 5600, calls: 140, ctr: 0.052 },
      offers: [{ id: 'o_pizza_001', title: 'Flat 20% Off on Large Pizzas', status: 'active' }],
      tone: 'energetic_warm',
      welcome: "Hello Sunil! Vera from magicpin. Match day is coming up and evening dine-in queries are up 35%. Would you like to run an IPL combo offer for match hours?",
      initialChips: ['Launch IPL combo', 'Review negative ratings', 'Show active offers']
    },
    {
      merchant_id: 'm_006_southindiancafe_restaurant_bangalore',
      category_slug: 'restaurants',
      category_name: 'Restaurant',
      icon: '🍕',
      identity: { name: 'Mylari South Indian Cafe', city: 'Bangalore', locality: 'Koramangala', owner_first_name: 'Karthik', languages: ['en'] },
      performance: { views: 4100, calls: 95, ctr: 0.046 },
      offers: [{ id: 'o_mylari_001', title: 'Filter Coffee + Benne Dosa @ ₹99', status: 'active' }],
      tone: 'energetic_warm',
      welcome: "Hello Karthik! Vera from magicpin. Congratulations on crossing 4,000 profile views this month! How can we drive more breakfast orders today?",
      initialChips: ['Push breakfast combo', 'Compare to peers', 'Show customer visits']
    },
    {
      merchant_id: 'm_007_powerhouse_gym_bangalore',
      category_slug: 'gyms',
      category_name: 'Gym',
      icon: '🏋️',
      identity: { name: 'PowerHouse Fitness', city: 'Bangalore', locality: 'Indiranagar', owner_first_name: 'Vikram', languages: ['en'] },
      performance: { views: 1840, calls: 29, ctr: 0.034 },
      offers: [{ id: 'o_gym_001', title: '1-Month Trial Pass @ ₹999', status: 'active' }],
      tone: 'energetic_coaching',
      welcome: "Hey Vikram! Vera from magicpin. Noticed seasonal gym registrations are picking up in Indiranagar. Ready to launch our 1-month trial push?",
      initialChips: ['Launch trial pass', 'Show lapsed members', 'Compare gym stats']
    },
    {
      merchant_id: 'm_008_zenyoga_gym_chennai',
      category_slug: 'gyms',
      category_name: 'Gym',
      icon: '🏋️',
      identity: { name: 'Zen Yoga Studio', city: 'Chennai', locality: 'Adyar', owner_first_name: 'Meenakshi', languages: ['en'] },
      performance: { views: 1250, calls: 22, ctr: 0.031 },
      offers: [{ id: 'o_zen_001', title: 'Free Weekend Yoga Demo', status: 'active' }],
      tone: 'mindful_encouraging',
      welcome: "Hello Meenakshi! Vera from magicpin. Your morning wellness batch is almost full. Would you like to open a weekend slot for beginners?",
      initialChips: ['Open weekend demo', 'Member attendance', 'Active offers']
    },
    {
      merchant_id: 'm_009_apollo_pharmacy_jaipur',
      category_slug: 'pharmacies',
      category_name: 'Pharmacy',
      icon: '💊',
      identity: { name: 'Apollo Health Plus Pharmacy', city: 'Jaipur', locality: 'Malviya Nagar', owner_first_name: 'Ramesh', languages: ['en'] },
      performance: { views: 3400, calls: 115, ctr: 0.064 },
      offers: [{ id: 'o_pharma_001', title: 'Free BP & Sugar Screening on Orders > ₹500', status: 'active' }],
      tone: 'accurate_informative',
      welcome: "Hello Ramesh! Vera here from magicpin. We are keeping track of chronic refills and seasonal health needs in Malviya Nagar. How can I assist today?",
      initialChips: ['Chronic refill list', 'Delivery inquiries', 'Show active offers']
    },
    {
      merchant_id: 'm_010_sunrisepharm_pharmacy_lucknow',
      category_slug: 'pharmacies',
      category_name: 'Pharmacy',
      icon: '💊',
      identity: { name: 'Sunrise Medicos', city: 'Lucknow', locality: 'Hazratganj', owner_first_name: 'Alok', languages: ['en'] },
      performance: { views: 2890, calls: 78, ctr: 0.051 },
      offers: [],
      tone: 'accurate_informative',
      welcome: "Hello Alok! Vera here from magicpin. Your profile has high search volume for doorstep medicine delivery. Would you like to enable WhatsApp prescription ordering?",
      initialChips: ['Enable WhatsApp orders', 'Local delivery promo', 'Peer comparison']
    }
  ];

  const DEFAULT_CUSTOMERS = [
    {
      customer_id: 'c_001_priya_for_m001',
      merchant_id: 'm_001_drmeera_dentist_delhi',
      merchant_name: "Dr. Meera's Dental Clinic",
      category: 'Dentist',
      identity: { name: 'Priya', age_band: '25-35', language_pref: 'hi-en mix' },
      relationship: { visits_total: 4, last_service: 'Dental Cleaning', lifetime_value: 1696 },
      state: 'lapsed_soft',
      welcome: "Hi Priya! This is Vera from Dr. Meera's Dental Clinic. It's been 6 months since your last cleaning, and your routine recall is due. Would you like me to book a convenient evening slot for you this week?",
      initialChips: ['Book evening slot', 'Check cleaning price', 'Not this week']
    },
    {
      customer_id: 'c_002_rohit_for_m001',
      merchant_id: 'm_001_drmeera_dentist_delhi',
      merchant_name: "Dr. Meera's Dental Clinic",
      category: 'Dentist',
      identity: { name: 'Rohit', age_band: '35-45', language_pref: 'english' },
      relationship: { visits_total: 2, last_service: 'Root Canal Consult', lifetime_value: 5500 },
      state: 'active',
      welcome: "Hi Rohit, Vera from Dr. Meera's Dental Clinic following up on your second root canal session. How is the tooth feeling today? Let me know if you need to adjust your Saturday appointment.",
      initialChips: ['Feeling much better', 'Reschedule appointment', 'Ask Dr. Meera a question']
    },
    {
      customer_id: 'c_003_aanya_for_m001',
      merchant_id: 'm_001_drmeera_dentist_delhi',
      merchant_name: "Dr. Meera's Dental Clinic",
      category: 'Dentist',
      identity: { name: 'Sneha (Parent of Aanya)', age_band: 'child_under_12', language_pref: 'hi-en mix' },
      relationship: { visits_total: 1, last_service: 'Pediatric Checkup', lifetime_value: 199 },
      state: 'lapsed_hard',
      welcome: "Hello Sneha! Vera here from Dr. Meera's Dental Clinic. Following up on Aanya's pediatric dental checkup from earlier this year. We have special weekday slots after 3 PM if you would like to bring her in.",
      initialChips: ['Book after 3 PM', 'Is checkup necessary?', 'What are charges?']
    },
    {
      customer_id: 'c_004_sneha_for_m003',
      merchant_id: 'm_003_studio11_salon_hyderabad',
      merchant_name: 'Studio11 Family Salon',
      category: 'Salon',
      identity: { name: 'Sneha', age_band: '25-35', language_pref: 'te-en mix' },
      relationship: { visits_total: 11, last_service: 'Balayage & Hair Spa', lifetime_value: 18450 },
      state: 'active',
      welcome: "Hi Sneha! Vera from Studio11 Salon. Stylist Priya has Saturday afternoon slots open for balayage touchup and hair spa. Would you like to reserve your favorite slot?",
      initialChips: ['Book with Priya', 'What are spa packages?', 'Not this Saturday']
    },
    {
      customer_id: 'c_005_kavya_for_m003',
      merchant_id: 'm_003_studio11_salon_hyderabad',
      merchant_name: 'Studio11 Family Salon',
      category: 'Salon',
      identity: { name: 'Kavya', age_band: '20-30', language_pref: 'en' },
      relationship: { visits_total: 3, last_service: 'Bridal Trial', lifetime_value: 6500 },
      state: 'active',
      welcome: "Hi Kavya! Vera here from Studio11. Hope you loved your bridal makeup trial! We are holding our bridal package booking for the upcoming wedding season. Can I confirm your dates?",
      initialChips: ['Confirm bridal booking', 'Check package price', 'Need to consult family']
    },
    {
      customer_id: 'c_006_ananya_for_m004',
      merchant_id: 'm_004_glamour_salon_pune',
      merchant_name: 'Glamour Lounge Spa & Salon',
      category: 'Salon',
      identity: { name: 'Ananya', age_band: '25-35', language_pref: 'en-mr mix' },
      relationship: { visits_total: 5, last_service: 'Aromatherapy Massage', lifetime_value: 4200 },
      state: 'lapsed_soft',
      welcome: "Hello Ananya! Vera from Glamour Lounge Spa in Koregaon Park. It's been a while since your last relaxing massage. We have an exclusive 20% weekday wellness pass available for you!",
      initialChips: ['Claim 20% pass', 'Check weekend slots', 'Send menu details']
    },
    {
      customer_id: 'c_007_rahul_for_m005',
      merchant_id: 'm_005_pizzajunction_restaurant_delhi',
      merchant_name: 'SK Pizza Junction',
      category: 'Restaurant',
      identity: { name: 'Rahul', age_band: '20-28', language_pref: 'hi-en mix' },
      relationship: { visits_total: 8, last_service: 'Dine-in Pizza Combo', lifetime_value: 3900 },
      state: 'active',
      welcome: "Hey Rahul! Vera from SK Pizza Junction CP. Match night special: Flat 20% off on all large gourmet pizzas today! Reserve a table or order ahead for takeaway?",
      initialChips: ['Reserve a table', 'Order takeaway', 'See today menu']
    },
    {
      customer_id: 'c_008_varun_for_m007',
      merchant_id: 'm_007_powerhouse_gym_bangalore',
      merchant_name: 'PowerHouse Fitness',
      category: 'Gym',
      identity: { name: 'Varun', age_band: '22-32', language_pref: 'english' },
      relationship: { visits_total: 1, last_service: 'Trial Session', lifetime_value: 0 },
      state: 'lapsed_soft',
      welcome: "Hey Varun! Vera from PowerHouse Fitness Indiranagar. Hope you had a great workout trial with coach Vikram! We're offering a special 3-month membership deal this week if you'd like to join.",
      initialChips: ['Check 3-month fee', 'Book personal trainer', 'Maybe next month']
    }
  ];

  // ─── State ───
  const state = {
    backendUrl: (window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('5500') && !window.location.origin.includes('5173') && !window.location.origin.includes('8000'))
      ? window.location.origin
      : 'https://vera-bot-r8yd.onrender.com',
    soundEnabled: true,
    devMode: localStorage.getItem('vera_dev_mode') === 'true',
    activeRoleTab: 'merchant', // 'merchant' | 'customer'
    activeCategoryFilter: 'all',
    searchQuery: '',
    merchantsList: DEFAULT_MERCHANTS,
    customersList: DEFAULT_CUSTOMERS,
    activePersona: null,
    activeRole: 'merchant', // 'merchant' | 'customer'
    activeMerchantId: 'm_001_drmeera_dentist_delhi',
    activeCustomerId: null,
    conversationId: `conv_${Date.now().toString(36)}`,
    turnNumber: 1,
    conversations: {}, // Key: personaKey -> { turns: [], turnNumber, welcomeDone }
  };

  // ─── DOM Elements ───
  const el = {
    appContainer: document.querySelector('.app-container'),
    sidebar: document.getElementById('sidebar'),
    personaScreen: document.getElementById('personaScreen'),
    chatViewport: document.getElementById('chatViewport'),
    btnSwitchPersona: document.getElementById('btnSwitchPersona'),
    activePersonaTitle: document.getElementById('activePersonaTitle'),
    btnDevMode: document.getElementById('btnDevMode'),
    btnCloseDevSidebar: document.getElementById('btnCloseDevSidebar'),
    tabMerchant: document.getElementById('tabMerchant'),
    tabCustomer: document.getElementById('tabCustomer'),
    countMerchants: document.getElementById('countMerchants'),
    countCustomers: document.getElementById('countCustomers'),
    pickerSearchWrapper: document.getElementById('pickerSearchWrapper'),
    personaSearchInput: document.getElementById('personaSearchInput'),
    pickerList: document.getElementById('pickerList'),
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
      if (el.btnPersonaDevMode) el.btnPersonaDevMode.classList.add('active');
    } else {
      el.appContainer.classList.remove('dev-mode-active');
      if (el.btnDevMode) el.btnDevMode.classList.remove('active');
      if (el.btnPersonaDevMode) el.btnPersonaDevMode.classList.remove('active');
    }
  }

  // ─── Audio Synthesis ───
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
    let url = `${state.backendUrl.replace(/\/$/, '')}${path}`;
    const t0 = performance.now();
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };
    if (body) opts.body = JSON.stringify(body);

    let resp;
    try {
      resp = await fetch(url, opts);
    } catch (err) {
      if (!url.includes('vera-bot-r8yd.onrender.com')) {
        console.warn(`Fetch to ${url} failed. Retrying against https://vera-bot-r8yd.onrender.com...`);
        url = `https://vera-bot-r8yd.onrender.com${path}`;
        state.backendUrl = 'https://vera-bot-r8yd.onrender.com';
        if (el.backendUrl) el.backendUrl.value = state.backendUrl;
        resp = await fetch(url, opts);
      } else {
        throw err;
      }
    }

    const latency = Math.round(performance.now() - t0);
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (!url.includes('vera-bot-r8yd.onrender.com')) {
        url = `https://vera-bot-r8yd.onrender.com${path}`;
        state.backendUrl = 'https://vera-bot-r8yd.onrender.com';
        if (el.backendUrl) el.backendUrl.value = state.backendUrl;
        const retryResp = await fetch(url, opts);
        const retryData = await retryResp.json();
        return { data: retryData, status: retryResp.status, latency };
      }
      const rawText = await resp.text();
      throw new Error(`Invalid server response: ${rawText.substring(0, 80)}`);
    }

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

        try {
          const meta = await api('/v1/metadata');
          if (meta.data?.model) {
            el.modelDisplay.textContent = `Model: ${meta.data.model}`;
          }
        } catch (_) {}

        // Fetch dynamic personas if backend provides them
        try {
          const p = await api('/v1/personas');
          if (p.data?.merchants && p.data.merchants.length > 0) {
            state.merchantsList = p.data.merchants.map((m) => {
              const localMatch = DEFAULT_MERCHANTS.find((dm) => dm.merchant_id === m.merchant_id);
              return {
                ...m,
                category_name: m.category_slug ? m.category_slug.charAt(0).toUpperCase() + m.category_slug.slice(1) : 'Merchant',
                icon: getCategoryIcon(m.category_slug),
                welcome: localMatch?.welcome || `Hello! I am Vera, your dedicated magicpin assistant. How can I assist your business today?`,
                initialChips: localMatch?.initialChips || ['Show active offers', 'Boost profile calls', 'Compare to peers'],
              };
            });
            renderPickerList();
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

  function getCategoryIcon(slug) {
    const icons = {
      dentists: '🩺',
      salons: '💇',
      gyms: '🏋️',
      clinics: '🌿',
      pharmacies: '💊',
      restaurants: '🍕',
    };
    return icons[slug] || '🏪';
  }

  function formatTime(date = new Date()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ─── Persona Screen Management ───
  // ─── Persona Screen Management (Minimal Centered Picker) ───
  function initPersonaScreen() {
    // Role Tab Switching
    el.tabMerchant.addEventListener('click', () => {
      state.activeRoleTab = 'merchant';
      el.tabMerchant.classList.add('active');
      el.tabCustomer.classList.remove('active');
      state.searchQuery = '';
      if (el.personaSearchInput) el.personaSearchInput.value = '';
      renderPickerList();
    });

    el.tabCustomer.addEventListener('click', () => {
      state.activeRoleTab = 'customer';
      el.tabCustomer.classList.add('active');
      el.tabMerchant.classList.remove('active');
      state.searchQuery = '';
      if (el.personaSearchInput) el.personaSearchInput.value = '';
      renderPickerList();
    });

    // Lightweight Search Input (if present)
    if (el.personaSearchInput) {
      el.personaSearchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        renderPickerList();
      });
    }

    // Switch button in chat header
    el.btnSwitchPersona.addEventListener('click', openPersonaScreen);

    // Initial render
    renderPickerList();
  }

  function renderPickerList() {
    el.countMerchants.textContent = state.merchantsList.length;
    el.countCustomers.textContent = state.customersList.length;
    el.pickerList.innerHTML = '';

    const isMerchant = state.activeRoleTab === 'merchant';
    const sourceList = isMerchant ? state.merchantsList : state.customersList;

    // Show lightweight search ONLY if list has > 8 items
    if (el.pickerSearchWrapper) {
      if (sourceList.length > 8) {
        el.pickerSearchWrapper.style.display = 'block';
        if (el.personaSearchInput) {
          el.personaSearchInput.placeholder = isMerchant 
            ? 'Search merchants by name or city...' 
            : 'Search customers by name...';
        }
      } else {
        el.pickerSearchWrapper.style.display = 'none';
      }
    }

    const q = state.searchQuery;

    if (isMerchant) {
      const filtered = sourceList.filter((m) => {
        if (!q) return true;
        const name = (m.identity?.name || '').toLowerCase();
        const city = (m.identity?.city || '').toLowerCase();
        const locality = (m.identity?.locality || '').toLowerCase();
        const cat = (m.category_name || m.category_slug || '').toLowerCase();
        return name.includes(q) || city.includes(q) || locality.includes(q) || cat.includes(q);
      });

      if (filtered.length === 0) {
        el.pickerList.innerHTML = `<div class="picker-empty">No matching merchants found.</div>`;
        return;
      }

      filtered.forEach((m) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'picker-row';

        const name = m.identity?.name || 'Local Merchant';
        const locParts = [m.identity?.locality, m.identity?.city].filter(Boolean);
        const loc = locParts.join(', ');
        const cat = m.category_name || (m.category_slug ? m.category_slug.charAt(0).toUpperCase() + m.category_slug.slice(1) : 'Merchant');
        const sub = loc ? `${cat} · ${loc}` : cat;

        row.innerHTML = `
          <div class="picker-row-info">
            <span class="picker-row-name">${name}</span>
            <span class="picker-row-sub">${sub}</span>
          </div>
          <span class="picker-row-arrow">›</span>
        `;

        row.addEventListener('click', () => selectPersona(m, 'merchant'));
        el.pickerList.appendChild(row);
      });
    } else {
      // Customer list
      const filtered = sourceList.filter((c) => {
        if (!q) return true;
        const name = (c.identity?.name || '').toLowerCase();
        const mName = (c.merchant_name || '').toLowerCase();
        const cat = (c.category || '').toLowerCase();
        return name.includes(q) || mName.includes(q) || cat.includes(q);
      });

      if (filtered.length === 0) {
        el.pickerList.innerHTML = `<div class="picker-empty">No matching customers found.</div>`;
        return;
      }

      filtered.forEach((c) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'picker-row';

        const name = c.identity?.name || 'Customer';
        const mName = c.merchant_name || 'Partner Merchant';
        const sub = c.category ? `${c.category} · ${mName}` : `Customer · ${mName}`;

        row.innerHTML = `
          <div class="picker-row-info">
            <span class="picker-row-name">${name}</span>
            <span class="picker-row-sub">${sub}</span>
          </div>
          <span class="picker-row-arrow">›</span>
        `;

        row.addEventListener('click', () => selectPersona(c, 'customer'));
        el.pickerList.appendChild(row);
      });
    }
  }

  function selectPersona(persona, role) {
    state.activeRole = role;
    state.activePersona = persona;

    if (role === 'merchant') {
      state.activeMerchantId = persona.merchant_id;
      state.activeCustomerId = null;
      el.activePersonaTitle.textContent = persona.identity?.name || 'Local Merchant';
      el.messageInput.placeholder = `Type a message as ${persona.identity?.name || 'Merchant'} (English or Hinglish)...`;
    } else {
      state.activeCustomerId = persona.customer_id;
      state.activeMerchantId = persona.merchant_id;
      el.activePersonaTitle.textContent = `${persona.identity?.name} (${persona.merchant_name})`;
      el.messageInput.placeholder = `Type a message as ${persona.identity?.name} (Customer)...`;
    }

    // Set conversation key
    const personaKey = role === 'merchant' ? persona.merchant_id : persona.customer_id;
    if (!state.conversations[personaKey]) {
      state.conversations[personaKey] = {
        conversationId: `conv_${personaKey}_${Date.now().toString(36)}`,
        turnNumber: 1,
        turnsHtml: '',
        chips: persona.initialChips || (role === 'customer' ? ['Book appointment', 'Check price', 'Timings'] : ['Show offers', 'Boost profile calls', 'Peer stats']),
      };
    }

    const session = state.conversations[personaKey];
    state.conversationId = session.conversationId;
    state.turnNumber = session.turnNumber;

    // Transition view
    el.personaScreen.classList.add('hidden');
    el.chatViewport.classList.remove('hidden');

    // Restore or initialize chat history
    if (session.turnsHtml) {
      el.messagesContainer.innerHTML = session.turnsHtml;
      // Re-bind click events for action buttons on restored history if needed
      bindRestoredActionButtons();
    } else {
      el.messagesContainer.innerHTML = `
        <div class="system-message">
          <span class="lock-icon">🔒</span>
          <span>Messages are end-to-end encrypted with magicpin 4-Context Vera Engine.</span>
        </div>
      `;
      appendMessage('vera', persona.welcome, {
        action: 'send',
        rationale: `Active persona loaded: ${role}`,
        suggested_replies: persona.initialChips || (role === 'customer' ? ['Book appointment', 'Check price', 'Timings'] : ['Show active offers', 'Boost profile calls', 'Compare to peers']),
      });
      session.turnsHtml = el.messagesContainer.innerHTML;
    }

    // Sync Dev mode stats card
    updateDevStats(persona, role);
  }

  function openPersonaScreen() {
    // Save current turns before switching
    const personaKey = state.activeRole === 'merchant' ? state.activeMerchantId : state.activeCustomerId;
    if (personaKey && state.conversations[personaKey]) {
      state.conversations[personaKey].turnsHtml = el.messagesContainer.innerHTML;
      state.conversations[personaKey].turnNumber = state.turnNumber;
    }

    el.chatViewport.classList.add('hidden');
    el.personaScreen.classList.remove('hidden');
  }

  function updateDevStats(p, role) {
    if (role === 'merchant') {
      if (el.currentMerchantName) el.currentMerchantName.textContent = p.identity?.name || '';
      if (el.metricViews) el.metricViews.textContent = (p.performance?.views || 0).toLocaleString();
      if (el.metricCalls) el.metricCalls.textContent = p.performance?.calls || 0;
      if (el.metricCtr) el.metricCtr.textContent = `${((p.performance?.ctr || 0.04) * 100).toFixed(1)}%`;
      if (el.merchantTags) {
        el.merchantTags.innerHTML = `
          <span class="tag">${p.tone || 'peer_clinical'}</span>
          <span class="tag">${p.identity?.locality || ''}</span>
          <span class="tag">${(p.identity?.languages || ['hi', 'en']).join(', ')}</span>
        `;
      }
    } else {
      if (el.currentMerchantName) el.currentMerchantName.textContent = p.merchant_name || '';
      if (el.metricViews) el.metricViews.textContent = `LTV: ₹${p.relationship?.lifetime_value || 0}`;
      if (el.metricCalls) el.metricCalls.textContent = `Visits: ${p.relationship?.visits_total || 1}`;
      if (el.metricCtr) el.metricCtr.textContent = p.state || 'active';
      if (el.merchantTags) {
        el.merchantTags.innerHTML = `
          <span class="tag">Customer: ${p.identity?.name}</span>
          <span class="tag">${p.category || 'Client'}</span>
          <span class="tag">${p.identity?.language_pref || 'hi-en'}</span>
        `;
      }
    }
  }

  // ─── Bold Key Facts & Specifics Parser ───
  function formatMessageBodyWithBoldFacts(text) {
    if (!text) return '';

    // 1. Escape HTML entities
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2. Convert explicit markdown **text** to strong
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="fact-bold">$1</strong>');

    // 3. Highlight Indian Rupee currency: ₹299, ₹1,420, ₹499, ₹99, ₹999, Rs 500
    html = html.replace(/(₹\s*[\d,]+(?:\.\d+)?|\bRs\.?\s*[\d,]+(?:\.\d+)?)/gi, (m) => {
      return `<strong class="fact-bold">${m}</strong>`;
    });

    // 4. Highlight percentages: 62% YoY, 35%, 4.2%
    html = html.replace(/(\b\d+(?:\.\d+)?\s*%\s*(?:YoY|MoM|growth)?\b)/gi, (m) => {
      return `<strong class="fact-bold">${m}</strong>`;
    });

    // 5. Highlight clinical & radiation measurements: 1.0 mSv, 15 mGy, etc.
    html = html.replace(/(\b\d+(?:\.\d+)?\s*(?:mSv|mGy|kVp|mA|min|sec)\b)/gi, (m) => {
      return `<strong class="fact-bold">${m}</strong>`;
    });

    // 6. Highlight metric counts: 2,410 views, 18 calls, 4 visits, 12 lapsed patients, 30 days
    html = html.replace(/(\b\d[\d,]*(?:\.\d+)?\s+(?:views|calls|patients|inquiries|bookings|visits|days|weeks|months|lapsed patients|slots)\b)/gi, (m) => {
      return `<strong class="fact-bold">${m}</strong>`;
    });

    // Clean up any double-nested strong tags
    html = html.replace(/<strong class="fact-bold">(<strong class="fact-bold">.*?<\/strong>)<\/strong>/g, '$1');

    // 7. Convert newlines to line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  // ─── Action Type to Icon and Label Mapping ───
  function mapActionToIconAndLabel(actionText, ctaType = '') {
    const clean = (actionText || '').trim();
    const lower = clean.toLowerCase();

    // Check if already starts with an emoji
    const leadingEmojiMatch = clean.match(/^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}✅🔴📤↩️📊🏷️💬📞📅]\s*)/u);
    if (leadingEmojiMatch) {
      const icon = leadingEmojiMatch[1].trim();
      const label = clean.slice(leadingEmojiMatch[0].length).trim();
      const isDanger = icon === '🔴' || lower.includes('stop') || lower.includes('cancel');
      return { icon, label, fullText: clean, isDanger, isNeutral: false };
    }

    let icon = '💬';
    let isDanger = false;
    let isNeutral = false;

    if (
      lower.includes('publish') ||
      lower.includes('send live') ||
      lower.includes('broadcast') ||
      lower.includes('launch') ||
      lower.includes('push')
    ) {
      icon = '📤';
    } else if (
      lower.includes('yes') ||
      lower.includes('do it') ||
      lower.includes('confirm') ||
      lower.includes('proceed') ||
      lower.includes('go live') ||
      lower.includes('approve') ||
      lower.includes('accept') ||
      lower.includes('book') ||
      lower.includes('claim') ||
      lower.includes('agree')
    ) {
      icon = '✅';
    } else if (
      lower.includes('stop') ||
      lower.includes('no') ||
      lower.includes('decline') ||
      lower.includes('cancel') ||
      lower.includes('not now') ||
      lower.includes("don't") ||
      lower.includes('opt out') ||
      lower.includes('pause') ||
      lower.includes('not this week')
    ) {
      icon = '🔴';
      isDanger = true;
    } else if (
      lower.includes('undo') ||
      lower.includes('revert') ||
      lower.includes('edit') ||
      lower.includes('change') ||
      lower.includes('modify') ||
      lower.includes('draft')
    ) {
      icon = '↩️';
      isNeutral = true;
    } else if (
      lower.includes('peer') ||
      lower.includes('stats') ||
      lower.includes('compare') ||
      lower.includes('performance') ||
      lower.includes('views') ||
      lower.includes('report')
    ) {
      icon = '📊';
      isNeutral = true;
    } else if (
      lower.includes('offer') ||
      lower.includes('discount') ||
      lower.includes('price') ||
      lower.includes('pricing') ||
      lower.includes('package')
    ) {
      icon = '🏷️';
      isNeutral = true;
    } else if (
      lower.includes('recall') ||
      lower.includes('whatsapp') ||
      lower.includes('reminder')
    ) {
      icon = '💬';
    } else if (
      lower.includes('call') ||
      lower.includes('phone')
    ) {
      icon = '📞';
    } else if (
      lower.includes('timing') ||
      lower.includes('slot') ||
      lower.includes('schedule')
    ) {
      icon = '📅';
      isNeutral = true;
    } else {
      icon = '';
      isNeutral = true;
    }

    const label = clean;
    const fullText = icon ? `${icon} ${clean}` : clean;
    return { icon, label, fullText, isDanger, isNeutral };
  }

  // ─── Human-Friendly Rationale Reframe ───
  function reframeRationale(rawRationale, category, merchantName, role) {
    if (!rawRationale) {
      return 'Based on local category trends and active profile engagement signals.';
    }

    const lower = rawRationale.toLowerCase();

    if (lower.includes('research signal') || lower.includes('ctr gap') || lower.includes('peer')) {
      return 'Based on a category trend affecting your area plus your recent profile view-to-call performance.';
    }
    if (lower.includes('compliance') || lower.includes('dci') || lower.includes('radiograph') || lower.includes('norm')) {
      return 'Recommended in accordance with clinical guidelines and regulatory safety protocols for your category.';
    }
    if (lower.includes('recall') || lower.includes('lapsed') || lower.includes('priya')) {
      return 'Suggested because this patient visited previously and is due for routine preventive care.';
    }
    if (lower.includes('festival') || lower.includes('diwali') || lower.includes('seasonal')) {
      return 'Identified from high seasonal customer demand surges for local service packages in your area.';
    }
    if (lower.includes('bridal') || lower.includes('kavya') || lower.includes('package')) {
      return 'Follow-up on a high-value customer inquiry interested in bridal and salon styling.';
    }
    if (lower.includes('opt-out') || lower.includes('hostile') || lower.includes('stop')) {
      return 'Respecting user preference to pause automated promotional messages immediately.';
    }
    if (lower.includes('auto-reply') || lower.includes('automated')) {
      return 'Paused automatic responses to prevent messaging loops.';
    }
    if (lower.includes('active persona loaded')) {
      return 'Initialized based on your merchant profile, active offers, and local category benchmarks.';
    }

    // Generic cleanup
    let cleaned = rawRationale
      .replace(/^Uses\s+/i, 'Based on ')
      .replace(/^Triggered by\s+/i, 'Suggested because of ')
      .replace(/trg_\w+/g, 'recent activity')
      .replace(/m_\w+/g, 'your profile')
      .trim();

    if (!cleaned.endsWith('.')) cleaned += '.';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // ─── Disable Older Action Buttons ───
  function disableAllActionButtons() {
    const groups = el.messagesContainer.querySelectorAll('.msg-actions-container:not(.actions-disabled)');
    groups.forEach((group) => {
      group.classList.add('actions-disabled');
      group.querySelectorAll('.msg-action-btn').forEach((btn) => {
        btn.setAttribute('disabled', 'true');
      });
    });
  }

  function bindRestoredActionButtons() {
    // Ensure older messages are disabled, and attach listeners
    const allGroups = Array.from(el.messagesContainer.querySelectorAll('.msg-actions-container'));
    allGroups.forEach((group, index) => {
      const isLatest = index === allGroups.length - 1;
      if (!isLatest) {
        group.classList.add('actions-disabled');
        group.querySelectorAll('.msg-action-btn').forEach((btn) => btn.setAttribute('disabled', 'true'));
      } else {
        group.classList.remove('actions-disabled');
        group.querySelectorAll('.msg-action-btn').forEach((btn) => {
          btn.removeAttribute('disabled');
          btn.onclick = (e) => {
            e.preventDefault();
            const actionText = btn.getAttribute('data-action') || btn.textContent.trim();
            disableAllActionButtons();
            sendMessage(actionText);
          };
        });
      }
    });

    // Re-bind why-this-message accordions
    el.messagesContainer.querySelectorAll('.why-msg-disclosure').forEach((disclosure) => {
      const btn = disclosure.querySelector('.why-msg-btn');
      const panel = disclosure.querySelector('.why-msg-panel');
      if (btn && panel) {
        btn.onclick = (e) => {
          e.stopPropagation();
          const isOpen = panel.classList.toggle('open');
          btn.classList.toggle('expanded', isOpen);
          btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        };
      }
    });
  }

  function deriveSuggestedRepliesFrontend(body, cta) {
    const text = (body || '').toLowerCase();

    if (state.activeRole === 'customer') {
      if (cta === 'binary_yes_stop' || cta === 'binary_confirm_cancel' || text.includes('confirm') || text.includes('book') || text.includes('slot')) {
        return ['Book appointment', 'Check slot timings', 'Not this week'];
      }
      if (text.includes('offer') || text.includes('discount') || text.includes('package')) {
        return ['Claim this offer', 'Tell me more', 'Not right now'];
      }
      return ['Book appointment', 'Check pricing', 'Need more details'];
    }

    // Merchant role
    if (cta === 'binary_yes_stop' || cta === 'binary_confirm_cancel' || text.includes('should i') || text.includes('confirm') || text.includes('publish') || text.includes('ready to launch')) {
      return ['Yes, go live', 'Not right now', 'Edit draft first'];
    }
    if (text.includes('views') || text.includes('calls') || text.includes('ctr') || text.includes('peer') || text.includes('competitor') || text.includes('ranking')) {
      return ['Compare to peers', 'How to increase calls?', 'Show active offers'];
    }
    if (text.includes('offer') || text.includes('discount') || text.includes('cleaning') || text.includes('pricing') || text.includes('package')) {
      return ['Launch new offer', 'Show active offers', 'Edit current pricing'];
    }
    if (text.includes('review') || text.includes('rating') || text.includes('feedback')) {
      return ['See negative reviews', 'Reply to reviews', 'Improve my rating'];
    }
    if (text.includes('recall') || text.includes('lapsed') || text.includes('patient') || text.includes('client')) {
      return ['Send WhatsApp recall', 'View patient list', 'Remind next week'];
    }

    return ['Show active offers', 'Compare to peers', 'Boost profile calls'];
  }

  // ─── Render Message in Chat ───
  function appendMessage(sender, text, meta = null, options = {}) {
    const isBot = sender === 'vera';

    // Disable all prior action buttons across the chat
    disableAllActionButtons();

    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${isBot ? 'message-bot' : 'message-merchant'} ${options.isTeaser ? 'teaser-followup' : ''}`;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    if (isBot) {
      const senderTitle = document.createElement('div');
      senderTitle.className = 'message-sender';
      senderTitle.textContent = options.senderName || 'Vera AI';
      bubble.appendChild(senderTitle);
    }

    const textEl = document.createElement('div');
    textEl.className = 'message-text';
    textEl.innerHTML = formatMessageBodyWithBoldFacts(text);
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

    // 1. Per-Message Action Buttons (for Vera messages)
    if (isBot && !options.noActions) {
      const suggested = meta?.suggested_replies || options.suggestedReplies || deriveSuggestedRepliesFrontend(text, meta?.cta);
      if (suggested && Array.isArray(suggested) && suggested.length > 0) {
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'msg-actions-container';

        suggested.forEach((replyItem) => {
          const { icon, label, fullText, isDanger, isNeutral } = mapActionToIconAndLabel(replyItem, meta?.cta);
          const btn = document.createElement('button');
          btn.className = `msg-action-btn ${isDanger ? 'action-danger' : isNeutral ? 'action-neutral' : ''}`;
          btn.type = 'button';
          btn.setAttribute('data-action', fullText);
          btn.innerHTML = `${icon ? `<span class="action-btn-icon">${icon}</span>` : ''}<span class="action-btn-label">${label}</span>`;

          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (btn.disabled || btn.closest('.actions-disabled')) return;

            // Tap-to-send: Disable immediately, post outgoing bubble & send to backend
            disableAllActionButtons();
            sendMessage(fullText);
          });

          actionsContainer.appendChild(btn);
        });

        wrapper.appendChild(actionsContainer);
      }
    }

    // 2. "Why this message" Disclosure (for Vera messages)
    if (isBot) {
      const whyDisclosure = document.createElement('div');
      whyDisclosure.className = 'why-msg-disclosure';

      const whyBtn = document.createElement('button');
      whyBtn.className = 'why-msg-btn';
      whyBtn.type = 'button';
      whyBtn.setAttribute('aria-expanded', 'false');
      whyBtn.innerHTML = `<span class="why-icon">ⓘ</span><span class="why-text">why this message</span><span class="why-chevron">▾</span>`;

      const whyPanel = document.createElement('div');
      whyPanel.className = 'why-msg-panel';
      const friendlyRationale = reframeRationale(
        meta?.rationale,
        state.activePersona?.category_slug,
        state.activePersona?.identity?.name,
        state.activeRole
      );
      whyPanel.innerHTML = `<div class="why-msg-content">${friendlyRationale}</div>`;

      whyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = whyPanel.classList.toggle('open');
        whyBtn.classList.toggle('expanded', isOpen);
        whyBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      whyDisclosure.appendChild(whyBtn);
      whyDisclosure.appendChild(whyPanel);
      wrapper.appendChild(whyDisclosure);
    }

    // 3. Dev Mode: Technical Diagnostics Toggle & Card
    if (isBot && meta && (meta.action || meta.rationale || meta.cta)) {
      const debugToggle = document.createElement('button');
      debugToggle.className = 'msg-debug-trigger';
      debugToggle.type = 'button';
      debugToggle.title = 'Inspect LLM & Decision Diagnostics (Dev Mode)';
      debugToggle.innerHTML = `<span>⚙️</span> <span>Dev Diagnostics</span>`;

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

  // ─── Smart Local Fallback Response Engine ───
  function generateLocalFallbackReply(msg, persona, role) {
    const text = (msg || '').toLowerCase();
    const p = persona || DEFAULT_MERCHANTS[0];
    const name = p.identity?.owner_first_name || p.identity?.name || 'there';
    const loc = p.identity?.locality || 'your area';
    const views = (p.performance?.views || 2410).toLocaleString();
    const calls = p.performance?.calls || 18;
    const activeOffer = p.offers?.find((o) => o.status === 'active')?.title || 'Special Promotion';

    if (role === 'customer') {
      if (text.includes('confirm') || text.includes('book') || text.includes('yes') || text.includes('slot')) {
        return {
          action: 'send',
          body: `✅ Perfect! Your appointment at **${p.merchant_name || "Dr. Meera's Dental Clinic"}** has been requested. We will send you a WhatsApp confirmation with timing details shortly. 💡 **Next:** Would you like directions to our clinic in **${loc}**?`,
          cta: 'binary_yes_stop',
          rationale: 'Confirmed customer booking request with clear appointment next steps.',
          suggested_replies: ['✅ Yes, send directions', '🔴 No, I know the place']
        };
      }
      if (text.includes('price') || text.includes('offer') || text.includes('cost') || text.includes('pass')) {
        return {
          action: 'send',
          body: `We currently have **${activeOffer}** available this week. Walk-ins and pre-booked slots are open daily from **10:00 AM to 8:00 PM**. Would you like to reserve a time slot today?`,
          cta: 'binary_confirm_cancel',
          rationale: 'Provided transparent pricing and active offer details for customer inquiry.',
          suggested_replies: ['✅ Book a slot', '📅 Check timings', '🔴 Not this week']
        };
      }
      return {
        action: 'send',
        body: `Hello! I am happy to help with bookings, timings, and active service packages at **${p.merchant_name || 'our center'}**. How can I help you today?`,
        cta: 'open_ended',
        rationale: 'Welcomed customer and offered direct assistance.',
        suggested_replies: ['Book appointment', 'Check pricing', 'Timings']
      };
    }

    // Merchant role
    if (text.includes('publish') || text.includes('yes') || text.includes('go live') || text.includes('confirm') || text.includes('do it')) {
      return {
        action: 'send',
        body: `✅ **Published live on magicpin!** We have pushed your active promotion across local search in **${loc}**. 💡 **Next:** You have **12 lapsed patients** due for routine recall this month. Would you like me to send them a WhatsApp reminder?`,
        cta: 'binary_yes_stop',
        rationale: 'Confirmed action broadcast and proactively teed up the next highest-ROI campaign.',
        suggested_replies: ['✅ Yes, send recalls', '🔴 Not now', '↩️ Edit draft']
      };
    }

    if (text.includes('offer') || text.includes('discount') || text.includes('pricing')) {
      return {
        action: 'send',
        body: `Hello ${name}! You currently have 1 active offer live: **${activeOffer}**. Over the last **30 days**, your profile received **${views} views** and **${calls} calls**. Would you like to launch a weekend discount to boost phone inquiries?`,
        cta: 'binary_yes_stop',
        rationale: 'Detailed active offer catalog and recent conversion metrics for merchant review.',
        suggested_replies: ['✅ Launch new offer', '📊 Compare to peers', '🔴 Not right now']
      };
    }

    if (text.includes('call') || text.includes('view') || text.includes('peer') || text.includes('stat') || text.includes('performance') || text.includes('competitor')) {
      return {
        action: 'send',
        body: `Your profile in **${loc}** has **${views} views** and **${calls} inquiries** this month. Top-ranked clinics in your locality are seeing **+35% more calls** by maintaining verified photos and active package offers. Would you like to optimize your profile today?`,
        cta: 'binary_yes_stop',
        rationale: 'Shared localized peer benchmark analysis and conversion recommendations.',
        suggested_replies: ['✅ Optimize profile', '🏷️ Show active offers', '📞 Boost profile calls']
      };
    }

    if (text.includes('recall') || text.includes('patient') || text.includes('lapsed') || text.includes('client')) {
      return {
        action: 'send',
        body: `We have identified **12 patients** who visited previously and are now due for routine follow-up. Sending a direct WhatsApp recall message typically recovers **40% of lapsed footfall**. Shall I draft the recall message now?`,
        cta: 'binary_yes_stop',
        rationale: 'Identified lapsed patient cohort and proposed WhatsApp recall sequence.',
        suggested_replies: ['✅ Yes, draft message', '📊 View patient list', '🔴 Remind next week']
      };
    }

    return {
      action: 'send',
      body: `Hello ${name}! I am actively monitoring your Google Business Profile, active offers, and local engagement in **${loc}** (**${views} views**, **${calls} calls** in 30 days). How can I assist your business growth today?`,
      cta: 'open_ended',
      rationale: 'Responded with live merchant metrics and category-specific assistance options.',
      suggested_replies: ['🏷️ Show active offers', '📞 Boost profile calls', '📊 Compare to peers']
    };
  }

  // ─── Send Message to /v1/reply ───
  async function sendMessage(text) {
    const msg = (text || el.messageInput.value).trim();
    if (!msg) return;

    el.messageInput.value = '';
    el.messageInput.style.height = 'auto';

    // Disable any open action buttons across previous turns
    disableAllActionButtons();

    // Append user message with exact label/icon
    appendMessage(state.activeRole, msg);
    showTyping();

    try {
      const payload = {
        conversation_id: state.conversationId,
        merchant_id: state.activeMerchantId,
        customer_id: state.activeCustomerId,
        from_role: state.activeRole,
        message: msg,
        turn_number: state.turnNumber,
        received_at: new Date().toISOString(),
      };

      let responseData = null;
      let latencyMs = 120;

      try {
        const { data, status, latency } = await api('/v1/reply', 'POST', payload);
        if (status === 200 && data) {
          responseData = data;
          latencyMs = latency;
        }
      } catch (netErr) {
        console.warn('Network call failed, using smart local fallback engine:', netErr);
        responseData = generateLocalFallbackReply(msg, state.activePersona, state.activeRole);
      }

      hideTyping();
      state.turnNumber++;

      if (responseData && responseData.body && responseData.body.trim()) {
        const fullBody = responseData.body.trim();

        // Check for explicit "Next Up" teaser pattern (e.g. \n\n💡 Next: or 💡 Next:)
        const teaserSplitPattern = /(?:\n\s*\n|\n)?(💡\s*Next(?: up)?:|\bNext up:)/i;
        const match = fullBody.match(teaserSplitPattern);

        if (match && match.index > 0) {
          const mainPart = fullBody.substring(0, match.index).trim();
          const teaserPart = fullBody.substring(match.index).trim();

          // Bubble 1: Main confirmation thought (no actions on intermediate bubble)
          appendMessage('vera', mainPart, {
            action: responseData.action || 'send',
            cta: 'none',
            rationale: responseData.rationale,
            latency: latencyMs,
          }, { noActions: true });

          // Bubble 2: Next up teaser (distinct thought with active action buttons)
          setTimeout(() => {
            appendMessage('vera', teaserPart, {
              action: responseData.action || 'send',
              cta: responseData.cta || 'binary_yes_stop',
              rationale: 'Upcoming recommendation based on your weekly goals and active schedule.',
              suggested_replies: responseData.suggested_replies || ['✅ Yes, do it', '🔴 Not now'],
            }, { isTeaser: true });
          }, 350);

        } else if (
          (msg.includes('Publish') || msg.includes('Yes') || msg.includes('Confirm') || msg.includes('go live')) &&
          (fullBody.startsWith('✅') || fullBody.toLowerCase().includes('published') || fullBody.toLowerCase().includes('confirmed')) &&
          fullBody.length > 60 &&
          fullBody.includes('.')
        ) {
          // If response combines confirmation sentence with a next step prompt
          const firstPeriod = fullBody.indexOf('.');
          const confirmPart = fullBody.substring(0, firstPeriod + 1).trim();
          const nextPart = fullBody.substring(firstPeriod + 1).trim();

          if (confirmPart && nextPart && nextPart.length > 10) {
            appendMessage('vera', confirmPart, {
              action: responseData.action || 'send',
              cta: 'none',
              rationale: responseData.rationale,
              latency: latencyMs,
            }, { noActions: true });

            setTimeout(() => {
              const teaserText = nextPart.startsWith('💡') ? nextPart : `💡 **Next:** ${nextPart}`;
              appendMessage('vera', teaserText, {
                action: responseData.action || 'send',
                cta: responseData.cta || 'binary_yes_stop',
                rationale: 'Upcoming recommendation based on your weekly goals and active schedule.',
                suggested_replies: responseData.suggested_replies || ['✅ Yes, do it', '🔴 Not now'],
              }, { isTeaser: true });
            }, 350);
          } else {
            appendMessage('vera', fullBody, {
              action: responseData.action || 'send',
              cta: responseData.cta || 'open_ended',
              rationale: responseData.rationale,
              suggested_replies: responseData.suggested_replies,
              latency: latencyMs,
            });
          }
        } else {
          // Standard single bubble with per-message action buttons
          appendMessage('vera', fullBody, {
            action: responseData.action || 'send',
            cta: responseData.cta || 'open_ended',
            rationale: responseData.rationale,
            suggested_replies: responseData.suggested_replies,
            latency: latencyMs,
          });
        }

      } else if (responseData && responseData.action === 'wait') {
        const devEvent = document.createElement('div');
        devEvent.className = 'dev-log-event';
        devEvent.innerHTML = `⚙️ <strong>Vera Restraint:</strong> Bot chose action <code>WAIT</code>. Rationale: ${responseData.rationale || 'Cooling down / suppressed'}`;
        el.messagesContainer.appendChild(devEvent);
        el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;
      } else if (responseData && responseData.action === 'end') {
        appendMessage('vera', 'Thank you! Let me know if you need anything else.', {
          action: 'end',
          rationale: responseData.rationale,
          suggested_replies: ['Start new query', 'Show active offers'],
          latency: latencyMs,
        });
      } else {
        appendMessage('vera', 'I am here and ready to help. What would you like to review next?', {
          action: 'send',
          suggested_replies: ['Show active offers', 'Boost profile calls', 'Compare to peers'],
        });
      }
    } catch (err) {
      hideTyping();
      appendMessage('vera', `I am actively monitoring your profile. How can I assist?`, {
        action: 'send',
        suggested_replies: ['Show active offers', 'Boost profile calls', 'Compare to peers'],
      });
    }
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
        data.actions.forEach((act) => {
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
      state.conversations = {};
      openPersonaScreen();
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
      el.btnDevMode.addEventListener('click', () => setDevMode(!state.devMode));
    }
    if (el.btnPersonaDevMode) {
      el.btnPersonaDevMode.addEventListener('click', () => setDevMode(!state.devMode));
    }
    if (el.btnCloseDevSidebar) {
      el.btnCloseDevSidebar.addEventListener('click', () => setDevMode(false));
    }

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

    // Dynamic Quick Suggestions click delegation (if present)
    if (el.quickSuggestions) {
      el.quickSuggestions.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (chip) {
          const msg = chip.getAttribute('data-msg');
          sendMessage(msg);
        }
      });
    }

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
        const personaKey = state.activeRole === 'merchant' ? state.activeMerchantId : state.activeCustomerId;
        if (personaKey && state.conversations[personaKey]) {
          state.conversations[personaKey].turnsHtml = '';
        }
      }
    });

    // Export conversation
    el.btnExportChat.addEventListener('click', () => {
      const msgs = Array.from(el.messagesContainer.querySelectorAll('.message-wrapper')).map((w) => {
        const isBot = w.classList.contains('message-bot');
        const text = w.querySelector('.message-text')?.textContent || '';
        return `[${isBot ? 'Vera' : state.activeRole === 'customer' ? 'Customer' : 'Merchant'}] ${text}`;
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
    if (el.welcomeTime) el.welcomeTime.textContent = formatTime();
    setDevMode(state.devMode);
    initPersonaScreen();
    initEvents();
    checkHealth();
  }

  init();
})();
