/**
 * Safety rules — auto-reply detection, hostile message detection, STOP/opt-out.
 *
 * These target the 3 specific Phase 4 replay scenarios:
 * 1. Auto-reply hell: same canned text repeated 3+ times
 * 2. Hostile/off-topic: abusive language or completely unrelated questions
 * 3. STOP/opt-out: explicit refusal to continue
 */

/* ─── Auto-reply detection ─── */

/**
 * Detect if the merchant is sending canned WhatsApp Business auto-replies.
 * Challenge brief: "same message verbatim 3+ times = auto-reply"
 * Production Vera's biggest pain point (#1 in brief §3).
 *
 * @param {string[]} merchantMessages - Array of merchant messages in conversation order
 * @returns {boolean}
 */
function detectAutoReply(merchantMessages, currentMessage) {
  const autoPatterns = [
    /thank you for (?:contacting|reaching|messaging)/i,
    /our team will (?:respond|get back|reply|contact)/i,
    /aapki (?:jaankari|jankari).*(?:shukriya|dhanyawad)/i,
    /(?:hamari|humari) team.*(?:pahuncha|forward|connect)/i,
    /(?:automated|auto).*(?:reply|response|message)/i,
    /main ek automated assistant/i,
    /we will get back to you/i,
    /your (?:query|request|message) (?:has been|is) (?:received|noted|forwarded)/i,
  ];

  // If a single message string is provided
  if (typeof currentMessage === 'string' && currentMessage.trim()) {
    if (autoPatterns.some((p) => p.test(currentMessage))) return true;
  }

  if (typeof merchantMessages === 'string') {
    return autoPatterns.some((p) => p.test(merchantMessages));
  }

  if (!Array.isArray(merchantMessages) || merchantMessages.length === 0) {
    return false;
  }

  const last = merchantMessages[merchantMessages.length - 1]?.trim().toLowerCase();
  if (!last) return false;

  if (autoPatterns.some((p) => p.test(last))) return true;

  // Check if same message repeated 2+ times
  let repeatCount = 0;
  for (let i = merchantMessages.length - 1; i >= 0; i--) {
    if (merchantMessages[i]?.trim().toLowerCase() === last) {
      repeatCount++;
    } else {
      break;
    }
  }

  return repeatCount >= 2;
}

/* ─── Hostile / abusive message detection ─── */

/**
 * Detect hostile, abusive, or aggressive messages.
 */
function detectHostile(message) {
  if (!message || typeof message !== 'string') return false;

  const hostile = [
    /\b(fuck|fk|f\*ck|bitch|bastard|asshole|chutiya|madarchod|bc|mc|bhosdike)\b/i,
    /\b(useless|fraud|scam|scamming|cheating|liar|loot|dhokha|fake)\b/i,
    /\b(spam|spamming|stop\s*spamming|harassing|harassment)\b/i,
    /\b(shut\s*up|get\s*lost|go\s*away|band\s*karo|bakwas|bekaar)\b/i,
    /\b(worst|terrible|horrible|pathetic|disgusting)\b/i,
  ];

  return hostile.some((p) => p.test(message));
}

/* ─── STOP / Opt-out detection ─── */

/**
 * Detect explicit opt-out signals. These MUST override normal business logic.
 */
function detectOptOut(message) {
  if (!message || typeof message !== 'string') return false;

  const optOut = [
    /\bstop\b/i,
    /\bunsubscribe\b/i,
    /\bnot\s*interested\b/i,
    /\bdon'?t\s*(?:contact|message|msg|text|disturb|send)\b/i,
    /\bremove\s*(?:me|my\s*number)\b/i,
    /\bnahi\s*chahiye\b/i,
    /\bband\s*karo\b/i,
    /\bmat\s*(?:bhejo|karo|send)\b/i,
    /\bi\s*don'?t\s*want\b/i,
    /\bplease\s*stop\b/i,
  ];

  return optOut.some((p) => p.test(message));
}

/* ─── Off-topic detection ─── */

/**
 * Detect if a message is completely off-topic for Vera's scope.
 */
function detectOffTopic(message) {
  if (!message || typeof message !== 'string') return false;

  const offTopic = [
    /\b(?:GST|income\s*tax|ITR|filing|tax\s*return)\b/i,
    /\b(?:loan|EMI|credit\s*card|mortgage)\b/i,
    /\b(?:weather|cricket\s*score|movie)\b/i,
    /\b(?:personal|private|family)\s*(?:matter|issue|problem)\b/i,
  ];

  // Only flag as off-topic if it's CLEARLY unrelated AND the message is a question
  const isQuestion = /\?/.test(message) || /\b(can you|could you|help me|kya|how to)\b/i.test(message);
  return isQuestion && offTopic.some((p) => p.test(message));
}

module.exports = {
  detectAutoReply,
  detectHostile,
  detectOptOut,
  detectOffTopic,
};
