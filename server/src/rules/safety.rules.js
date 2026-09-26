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

  // Whitelist of regular user actions, questions, or chips that should NEVER be flagged as auto-replies
  const interactiveExclusions = [
    /how to increase calls/i,
    /show active offers/i,
    /compare to peers/i,
    /launch new offer/i,
    /boost profile calls/i,
    /edit current pricing/i,
    /yes/i,
    /no/i,
    /hello/i,
    /hi/i,
    /not right now/i,
  ];

  const msgToCheck = (typeof currentMessage === 'string' && currentMessage.trim())
    ? currentMessage.trim()
    : (Array.isArray(merchantMessages) && merchantMessages.length > 0)
    ? merchantMessages[merchantMessages.length - 1]?.trim()
    : (typeof merchantMessages === 'string' ? merchantMessages.trim() : '');

  if (!msgToCheck) return false;

  // Never flag known user interactive chips/queries
  if (interactiveExclusions.some((p) => p.test(msgToCheck))) {
    return false;
  }

  // 1. Explicit pattern match for canned WhatsApp Business auto-replies
  if (autoPatterns.some((p) => p.test(msgToCheck))) {
    return true;
  }

  if (!Array.isArray(merchantMessages) || merchantMessages.length < 3) {
    return false;
  }

  const last = msgToCheck.toLowerCase();

  // 2. Challenge brief: same message verbatim 3+ times = auto-reply (only if substantial text)
  if (last.length < 15) return false;

  let repeatCount = 0;
  for (let i = merchantMessages.length - 1; i >= 0; i--) {
    if (merchantMessages[i]?.trim().toLowerCase() === last) {
      repeatCount++;
    } else {
      break;
    }
  }

  return repeatCount >= 3;
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

/* ─── Decline / Hesitation detection ─── */

/**
 * Detect explicit or soft decline ("not right now", "maybe later", "no thanks").
 * Prevents aggressive pitch looping when user declines a suggestion.
 */
function detectDecline(message) {
  if (!message || typeof message !== 'string') return false;
  const clean = message
    .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}✅🔴📤↩️📊🏷️💬📞📅]\s*/u, '')
    .trim()
    .toLowerCase();

  const declinePatterns = [
    /^not\s*right\s*now\b/i,
    /^not\s*now\b/i,
    /^maybe\s*later\b/i,
    /^later\b/i,
    /^not\s*today\b/i,
    /^not\s*this\s*week\b/i,
    /^no\s*thanks?\b/i,
    /^no\s*thank\s*you\b/i,
    /^no\s*,?\s*not\s*now\b/i,
    /^nahi\s*abhi\s*nahi\b/i,
    /^abhi\s*nahi\b/i,
    /^skip\b/i,
    /^leave\s*it\b/i,
    /^don'?t\s*do\s*it\b/i,
    /^no\b$/i,
    /^nah\b$/i,
    /^nope\b$/i,
  ];

  return declinePatterns.some((p) => p.test(clean));
}

/* ─── Greeting detection ─── */

/**
 * Detect friendly greetings ("hello", "hi", "hey", "good morning") to avoid
 * hallucinating non-existent past requests on casual check-ins.
 */
function isGreeting(message) {
  if (!message || typeof message !== 'string') return false;
  const clean = message
    .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}✅🔴📤↩️📊🏷️💬📞📅]\s*/u, '')
    .trim()
    .toLowerCase();

  const greetingPatterns = [
    /^(hello|hi|hey|heya|good\s*(?:morning|afternoon|evening)|namaste|greetings)\b/i,
    /^(hi|hello)\s+vera\b/i,
  ];

  return greetingPatterns.some((p) => p.test(clean)) && clean.length < 25;
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
  detectDecline,
  isGreeting,
  detectOffTopic,
};
