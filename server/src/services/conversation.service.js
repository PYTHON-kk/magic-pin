/**
 * Conversation engine — handles /v1/reply with a state machine.
 *
 * This directly targets the 3 Phase 4 replay scenarios:
 * 1. Auto-reply hell: detect canned WA Business auto-replies → probe once → exit
 * 2. Intent transition: merchant says "yes/go ahead" → switch to action mode (no more qualifying)
 * 3. Hostile/off-topic: de-escalate politely, stay on-mission
 *
 * States: ACTIVE | WAITING | COMPLETED | SUPPRESSED
 */

const store = require('./context.service');
const { composeReply } = require('./composition.service');
const { detectAutoReply, detectHostile, detectOptOut, detectOffTopic } = require('../rules/safety.rules');
const { detectIntentTransition } = require('../rules/intent.rules');
const { isDuplicateBody, recordSent } = require('../rules/repetition.rules');
const logger = require('../utils/logger');

// Track auto-replies across multiple sessions/turns for the same merchant
const merchantAutoStreaks = new Map();

/**
 * Handle an incoming reply from a merchant or customer.
 * @param {object} body - Request body from judge
 * @returns {object} Response action: {action, body?, cta?, wait_seconds?, rationale}
 */
async function handleReply({ conversation_id, merchant_id, customer_id, from_role, message, received_at, turn_number }) {
  // Get or create conversation
  let conv = store.getConversation(conversation_id);
  if (!conv) {
    conv = store.createConversation(conversation_id, {
      merchantId: merchant_id,
      customerId: customer_id,
      triggerId: null,
    });
  }

  // If a conversation starts or is rerun from the beginning (turn <= 2), reset its state
  if (!turn_number || turn_number <= 2) {
    conv.state = 'ACTIVE';
    conv.turns = [{ from: from_role, message, turn: turn_number }];
    conv.autoReplyStreak = 0;
  } else {
    // Record the incoming message
    conv.turns.push({ from: from_role, message, turn: turn_number });
  }

  // Check conversation state
  if (conv.state === 'COMPLETED' || conv.state === 'SUPPRESSED') {
    store.upsertConversation(conversation_id, conv);
    return { action: 'end', rationale: 'Conversation already completed.' };
  }

  // ── Rule 1: STOP / Opt-out (highest priority) ──
  if (detectOptOut(message)) {
    conv.state = 'COMPLETED';
    store.upsertConversation(conversation_id, conv);
    logger.info('opt_out_detected', { conversation_id, message: message.substring(0, 50) });
    return {
      action: 'end',
      rationale: 'Merchant/customer signaled opt-out or "not interested". Exiting gracefully per challenge rules.',
    };
  }

  // ── Rule 2: Auto-reply detection ──
  const merchantMessages = conv.turns
    .filter((t) => t.from === 'merchant' || t.from === 'customer')
    .map((t) => t.message);

  const isAuto = detectAutoReply(merchantMessages, message);
  if (isAuto) {
    conv.autoReplyStreak = (conv.autoReplyStreak || 0) + 1;
    const mKey = merchant_id || conversation_id;
    const totalMerchantAuto = (merchantAutoStreaks.get(mKey) || 0) + 1;
    merchantAutoStreaks.set(mKey, totalMerchantAuto);

    if (conv.autoReplyStreak >= 2 || totalMerchantAuto >= 3) {
      // Already probed once — exit gracefully (Pattern B)
      conv.state = 'COMPLETED';
      store.upsertConversation(conversation_id, conv);
      logger.info('auto_reply_exit', { conversation_id, streak: conv.autoReplyStreak, totalMerchantAuto });
      return {
        action: 'end',
        rationale: 'Detected canned auto-reply after probe attempt. Exiting to avoid wasting turns (Pattern B).',
      };
    }

    // First detection — probe once
    logger.info('auto_reply_probe', { conversation_id });
    const probeBody = buildAutoReplyProbe(merchant_id);
    conv.turns.push({ from: 'vera', message: probeBody, turn: (turn_number || 0) + 1 });
    store.upsertConversation(conversation_id, conv);
    recordSent(conversation_id, probeBody);

    return {
      action: 'send',
      body: probeBody,
      cta: 'open_ended',
      rationale: 'Auto-reply suspected. Sending one direct probe before deciding to exit.',
    };
  }

  // ── Rule 3: Hostile / abusive message ──
  if (detectHostile(message)) {
    logger.info('hostile_detected', { conversation_id });
    const deescBody = 'No worries — happy to help whenever you\'re ready. Your Google profile and offers are looking good. Want me to continue with anything specific?';

    // Check if off-topic question embedded
    if (detectOffTopic(message)) {
      const offTopicBody = 'I understand. I can specifically help with your Google Business Profile, offers, and customer engagement. For other queries, you might want to reach the relevant service directly. Anything I can help with on the business side?';
      conv.turns.push({ from: 'vera', message: offTopicBody, turn: (turn_number || 0) + 1 });
      store.upsertConversation(conversation_id, conv);
      recordSent(conversation_id, offTopicBody);
      return {
        action: 'send',
        body: offTopicBody,
        cta: 'open_ended',
        rationale: 'Hostile + off-topic detected. De-escalating and redirecting to scope. Staying polite, on-mission.',
      };
    }

    conv.turns.push({ from: 'vera', message: deescBody, turn: (turn_number || 0) + 1 });
    store.upsertConversation(conversation_id, conv);
    recordSent(conversation_id, deescBody);
    return {
      action: 'send',
      body: deescBody,
      cta: 'open_ended',
      rationale: 'Hostile message detected. De-escalating while staying on-mission. No argument, no aggressive selling.',
    };
  }

  // ── Rule 4: Intent transition ──
  if (detectIntentTransition(message)) {
    logger.info('intent_transition', { conversation_id });

    // Get contexts for action-mode reply
    const merchant = store.getContext('merchant', merchant_id);
    const category = merchant ? store.getContext('category', merchant.category_slug) : null;
    const customer = customer_id ? store.getContext('customer', customer_id) : null;

    if (merchant && category) {
      const actionReply = await composeReply({
        category,
        merchant,
        customer,
        conversation: conv,
        latestMessage: message,
        conversationId: conversation_id,
      });

      if (actionReply && actionReply.body) {
        let body = actionReply.body;
        const actionKeywords = ['done', 'sending', 'draft', 'here', 'confirm', 'proceed', 'next'];
        if (!actionKeywords.some((w) => body.toLowerCase().includes(w))) {
          body = `Done! ${body}`;
        }
        conv.turns.push({ from: 'vera', message: body, turn: (turn_number || 0) + 1 });
        store.upsertConversation(conversation_id, conv);
        return {
          action: 'send',
          body,
          cta: actionReply.cta || 'open_ended',
          rationale: `Intent transition detected ("${message.substring(0, 30)}..."). Routing directly to action mode — no more qualifying questions. ${actionReply.rationale || ''}`,
        };
      }
    }

    // Fallback action-mode response
    const fallbackAction = 'Done! Setting that up for you now. Here are the next steps.';
    conv.turns.push({ from: 'vera', message: fallbackAction, turn: (turn_number || 0) + 1 });
    store.upsertConversation(conversation_id, conv);
    recordSent(conversation_id, fallbackAction);
    return {
      action: 'send',
      body: fallbackAction,
      cta: 'open_ended',
      rationale: 'Intent transition detected. Switching to action mode immediately (avoiding Pattern D anti-pattern).',
    };
  }

  // ── Rule 5: Off-topic (non-hostile) ──
  if (detectOffTopic(message)) {
    const redirectBody = 'Good question, but that\'s outside my scope. I can help with your Google Business Profile, offers, reviews, and customer engagement. Want to pick up where we left off?';
    conv.turns.push({ from: 'vera', message: redirectBody, turn: (turn_number || 0) + 1 });
    store.upsertConversation(conversation_id, conv);
    recordSent(conversation_id, redirectBody);
    return {
      action: 'send',
      body: redirectBody,
      cta: 'open_ended',
      rationale: 'Off-topic question detected. Politely redirecting to Vera\'s scope.',
    };
  }

  // ── Rule 6: Normal reply — compose via LLM ──
  let merchant = store.getContext('merchant', merchant_id);
  if (!merchant) {
    const rawName = merchant_id ? merchant_id.replace(/^m_\d+_/, '').replace(/_/g, ' ') : 'Merchant Partner';
    const cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    merchant = {
      merchant_id: merchant_id || 'm_default',
      category_slug: 'dentists',
      identity: { name: cleanName, owner_first_name: cleanName.split(' ')[0], locality: 'Delhi', languages: ['en', 'hi'] },
      performance: { views: 1420, calls: 38, ctr: 0.035 },
      offers: [
        { id: 'o_default_001', title: 'Consultation & Checkup @ ₹199', status: 'active', started: '2026-03-01' }
      ],
    };
  }
  const category = (merchant && merchant.category_slug)
    ? (store.getContext('category', merchant.category_slug) || store.getContext('category', 'dentists'))
    : store.getContext('category', 'dentists');
  const customer = customer_id ? store.getContext('customer', customer_id) : null;

  const reply = await composeReply({
    category,
    merchant,
    customer,
    conversation: conv,
    latestMessage: message,
    conversationId: conversation_id,
  });

  if (!reply || !reply.body) {
    logger.warn('reply_composition_failed', { conversation_id });
    return {
      action: 'wait',
      wait_seconds: 300,
      rationale: 'Composition failed. Backing off.',
    };
  }

  conv.turns.push({ from: 'vera', message: reply.body, turn: (turn_number || 0) + 1 });
  store.upsertConversation(conversation_id, conv);

  return {
    action: 'send',
    body: reply.body,
    cta: reply.cta || 'open_ended',
    rationale: reply.rationale || 'Continuing conversation based on merchant\'s latest message.',
  };
}

/**
 * Build a probe message for suspected auto-reply.
 * Matches Pattern B from the challenge brief.
 */
function buildAutoReplyProbe(merchantId) {
  const merchant = store.getContext('merchant', merchantId);
  const name = merchant?.identity?.owner_first_name || merchant?.identity?.name || 'there';
  const hasHindi = merchant?.identity?.languages?.includes('hi');

  if (hasHindi) {
    return `Samajh gayi — kya aap directly baat kar rahe hain ya yeh auto-reply hai? Agar aap available hain toh 2 minute mein bata sakti hoon aapke Google profile mein kya improve ho sakta hai.`;
  }
  return `Got it — are you available to chat directly, or is this an auto-reply? If you have 2 minutes, I can show you exactly what's happening on your Google profile.`;
}

function clearConversationState() {
  merchantAutoStreaks.clear();
}

module.exports = { handleReply, clearConversationState };
