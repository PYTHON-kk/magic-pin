/**
 * Intent detection rules — detects when a merchant signals action intent.
 *
 * Challenge Pattern D explicitly penalizes asking another qualifying question
 * when the merchant has already agreed. This detector catches:
 * - "yes", "go ahead", "let's do it", "sure", "ok"
 * - Hindi equivalents: "haan kar do", "chalo", "theek hai"
 */

const INTENT_PATTERNS = [
  /\b(yes|yeah|yep|yup|sure|ok|okay|go\s*ahead|let'?s\s*do\s*it|do\s*it|let'?s\s*go)\b/i,
  /\b(haan|han|haa|chalo|theek\s*hai|thik\s*hai|kar\s*do|karo|bilkul|zaroor|ji\s*haan)\b/i,
  /\b(sounds?\s*good|great\s*idea|perfect|definitely|absolutely|please\s*do|go\s*for\s*it)\b/i,
  /\b(send\s*(it|me)|show\s*me|tell\s*me|i\s*want|mujhe\s*chahiye|bhej\s*do)\b/i,
];

/**
 * Detect if the message contains explicit action intent.
 * @param {string} message
 * @returns {boolean}
 */
function detectIntentTransition(message) {
  if (!message || typeof message !== 'string') return false;
  const cleaned = message.trim();
  // Short affirmative messages are strongest signals
  if (cleaned.length < 30) {
    return INTENT_PATTERNS.some((p) => p.test(cleaned));
  }
  // Longer messages: check but be more conservative
  return INTENT_PATTERNS.slice(0, 2).some((p) => p.test(cleaned));
}

module.exports = { detectIntentTransition };
