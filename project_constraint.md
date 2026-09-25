# Vera AI — Production Project Constraints

**Project:** Vera AI Merchant Assistant
**Architecture:** MERN + REST API + AI Decision/Conversation Engine
**Runtime:** Node.js
**Backend:** Express.js
**Database:** MongoDB
**Frontend:** React
**AI Layer:** LLM provider through an isolated service
**API Style:** REST
**Deployment:** Docker + Public HTTPS
**Version:** 1.0.0

---

# 1. Project Objective

Build a production-grade AI assistant backend for the Vera AI Challenge.

The system must:

1. Receive category, merchant, customer, and trigger context.
2. Maintain current context versions.
3. Determine whether an action should be taken.
4. Generate highly contextual messages.
5. Prevent duplicate, stale, unsafe, or irrelevant messages.
6. Support multi-turn conversations.
7. Handle auto-replies, intent transitions, hostile messages, and opt-outs.
8. Expose the exact challenge API contract.
9. Remain operational under the challenge's request rate and timeout constraints.
10. Be deployable through a public HTTPS endpoint.

The challenge judge is the primary external consumer of the backend.

The React application is a development/observability interface and is not part of the judge-facing protocol.

---

# 2. Core Architecture

```text
                         ┌─────────────────────┐
                         │     React Client    │
                         │  Developer Console  │
                         └──────────┬──────────┘
                                    │
                                    │ REST
                                    ▼
                    ┌──────────────────────────────┐
                    │      Express API Server      │
                    │                              │
                    │  /v1/context                 │
                    │  /v1/tick                    │
                    │  /v1/reply                   │
                    │  /v1/healthz                 │
                    │  /v1/metadata                │
                    └──────────────┬───────────────┘
                                   │
                 ┌─────────────────┼─────────────────┐
                 │                 │                 │
                 ▼                 ▼                 ▼
          Context Store      Decision Engine    Conversation
          / MongoDB              │               Engine
                 │                │                 │
                 └────────────────┼─────────────────┘
                                  │
                                  ▼
                           Composition Layer
                                  │
                         ┌────────┴────────┐
                         │                 │
                         ▼                 ▼
                    Prompt Builder       Rules
                         │                 │
                         ▼                 │
                       LLM ◄───────────────┘
                         │
                         ▼
                  Output Validator
                         │
                         ▼
                    Final Action
```

---

# 3. Technology Constraints

## 3.1 Backend

Mandatory:

* Node.js
* Express.js
* JavaScript or TypeScript
* REST API
* JSON request/response format

Recommended:

* TypeScript
* Mongoose
* Zod or Joi
* Pino/Winston for structured logging
* Jest/Vitest for testing

---

## 3.2 Frontend

React is permitted for:

* debugging
* manual API testing
* conversation inspection
* trigger testing
* system monitoring
* development tooling

The frontend must NOT become a dependency of the judge-facing backend.

The backend must work correctly without the React application running.

---

## 3.3 Database

MongoDB may be used for:

* development
* persistent application state
* debugging
* conversation inspection
* analytics
* local dataset exploration

However:

> The challenge judge sends context through `/v1/context`.

The system must never assume that the judge has populated MongoDB.

The backend must be capable of operating entirely from context received through the challenge API.

The uploaded production guide explicitly states that the judge never accesses the database directly.

---

# 4. Judge-Facing API Contract

The following endpoints are mandatory.

```text
GET  /v1/healthz
GET  /v1/metadata

POST /v1/context
POST /v1/tick
POST /v1/reply
```

Optional:

```text
POST /v1/teardown
```

The API contract must not be changed without updating the integration tests.

---

# 5. Health Endpoint

```http
GET /v1/healthz
```

Requirements:

* Must not depend on the LLM provider.
* Must respond quickly.
* Must return HTTP 200 when the Node process is healthy.
* Must report basic service state.
* Must not expose sensitive information.

Example:

```json
{
  "status": "ok",
  "uptime_seconds": 120,
  "contexts_loaded": {
    "category": 5,
    "merchant": 50,
    "customer": 200,
    "trigger": 100
  }
}
```

The challenge guide identifies repeated health failures as a disqualification risk.

---

# 6. Metadata Endpoint

```http
GET /v1/metadata
```

Must return:

```json
{
  "team_name": "YOUR_TEAM",
  "team_members": [
    "YOUR_NAME"
  ],
  "model": "MODEL_NAME",
  "approach": "APPROACH_DESCRIPTION",
  "contact_email": "EMAIL",
  "version": "1.0.0",
  "submitted_at": "ISO_DATE"
}
```

Never expose:

* API keys
* MongoDB credentials
* internal secrets
* private infrastructure information

---

# 7. Context Management

The system must support:

```text
category
merchant
customer
trigger
```

Context is identified by:

```text
(scope, context_id, version)
```

Context storage must implement version control.

Rules:

### New version

Accept.

### Higher version

Replace current context.

### Same version

Treat as idempotent.

### Lower version

Reject as stale.

Example:

```text
merchant:m001:v1
       ↓
merchant:m001:v2
       ↓
merchant:m001:v1  ← reject
```

The composer must always use the latest accepted context.

The guide specifically warns that adaptive injection sends updated information during testing, so stale cached prompts are unacceptable.

---

# 8. Context Isolation

Contexts must be isolated by scope.

Never allow:

```text
merchant A
```

to accidentally use:

```text
merchant B
```

data.

Never allow one customer's context to leak into another customer's conversation.

Required identifiers:

```text
category_id
merchant_id
customer_id
trigger_id
conversation_id
```

---

# 9. `/v1/tick`

The tick endpoint must:

1. Receive available triggers.
2. Retrieve the latest trigger context.
3. Retrieve associated merchant context.
4. Retrieve category context.
5. Retrieve customer context when applicable.
6. Evaluate suppression.
7. Evaluate trigger relevance.
8. Decide whether to send.
9. Compose the message.
10. Validate the message.
11. Return the action.

The maximum action count must be respected.

```text
MAX_ACTIONS_PER_TICK = 20
```

If nothing is sufficiently valuable:

```json
{
  "actions": []
}
```

The system must prefer no action over an irrelevant message.

---

# 10. Decision Engine Constraints

The decision engine must be deterministic.

It must not depend entirely on an LLM.

Required rule categories:

```text
Trigger relevance
Merchant relevance
Customer relevance
Urgency
Consent
Suppression
Expiration
Deduplication
Conversation state
Category compatibility
```

Recommended decision pipeline:

```text
Trigger
   ↓
Eligibility
   ↓
Suppression
   ↓
Relevance
   ↓
Priority
   ↓
Action decision
   ↓
Message composition
```

---

# 11. LLM Constraints

The LLM must be isolated behind an internal service.

Example:

```text
src/ai/
├── llmClient.js
├── promptBuilder.js
├── outputParser.js
└── modelConfig.js
```

Business rules must NOT be embedded only in prompts.

The LLM is responsible primarily for:

* natural language generation
* conversational interpretation
* message wording
* contextual response generation

The application is responsible for:

* authorization
* consent
* suppression
* context selection
* state
* validation
* deduplication
* timeout handling
* API correctness

---

# 12. LLM Determinism

Default generation settings:

```text
temperature: 0
```

Equivalent deterministic settings should be used for other providers.

The same context should produce substantially consistent behavior.

Randomness must not control business decisions.

---

# 13. Prompt Constraints

Every prompt must include:

### Context

```text
Category
Merchant
Customer
Trigger
Conversation history
```

### Hard constraints

```text
Do not invent facts.
Do not invent offers.
Do not invent prices.
Do not invent statistics.
Do not invent citations.
Do not invent customer information.
```

### Communication constraints

```text
Use category-appropriate language.
Use merchant-specific information.
Use current trigger information.
Use relevant numbers when available.
Avoid generic marketing language.
```

The production guide identifies specificity, category fit, merchant fit, trigger relevance, and engagement compulsion as the five scoring dimensions.

---

# 14. Trigger-Based Prompt Routing

Do NOT use one giant prompt for every trigger.

Use:

```text
trigger.kind
       ↓
Prompt Builder
       ↓
Specialized prompt
```

Example:

```text
research_digest
perf_spike
perf_dip
recall_due
dormant_with_vera
milestone_reached
```

Each trigger family may have a dedicated prompt builder.

Unknown triggers must fall back safely to a generic prompt.

---

# 15. Message Validator

Every LLM-generated message must pass validation before being returned.

Minimum validation:

```text
Non-empty body
Valid JSON
Valid CTA
Valid sender
No prohibited vocabulary
No fabricated facts
No duplicate message
No multiple conflicting CTAs
Correct customer/merchant scope
```

Validation must fail closed.

```text
VALID
  ↓
send

INVALID
  ↓
retry once
  ↓
still invalid
  ↓
do not send
```

The challenge guide explicitly recommends a post-LLM validator and a one-time re-prompt before skipping a failed message.

---

# 16. Suppression

The system must support suppression keys.

Example:

```text
research:dental:merchant123:2026-09
```

Once a suppression key has been sent:

```text
same key → do not send again
```

Suppression must have an expiry policy.

Default:

```text
7 days
```

unless the trigger specifies otherwise.

---

# 17. Anti-Repetition

The system must detect:

```text
same trigger
same conversation
same body
```

and avoid verbatim repetition.

Store sent message fingerprints:

```text
conversation_id
+
body_hash
```

Never repeatedly send:

```text
"Would you like me to help?"
```

without meaningful contextual change.

---

# 18. Conversation Engine

`/v1/reply` must use a state machine.

Minimum states:

```text
ACTIVE
WAITING
COMPLETED
SUPPRESSED
```

Conversation data:

```text
conversation_id
merchant_id
customer_id
turns
state
last_action
last_trigger
suppression_key
```

---

# 19. Auto-Reply Detection

Detect repeated canned responses.

Example:

```text
"Thank you for contacting us."
"Thank you for contacting us."
"Thank you for contacting us."
```

The system must avoid entering an infinite conversation.

Expected strategy:

```text
Detect
  ↓
One probe
  ↓
If repeated
  ↓
END
```

The challenge's Phase 4 explicitly tests auto-reply behavior.

---

# 20. Intent Transition

The system must detect explicit action intent.

Examples:

```text
Yes
Sure
Go ahead
Let's do it
Okay, do it
Haan kar do
Chalo
```

When the user has already agreed:

```text
DO NOT
ask another qualification question.
```

Instead:

```text
transition → action mode
```

This is specifically tested by the challenge's intent-transition scenario.

---

# 21. Hostile Messages

The system must remain polite.

Examples:

```text
This is spam.
Stop messaging me.
You're useless.
I don't want this.
```

Required behavior:

```text
De-escalate
+
respect opt-out
+
avoid argument
+
do not continue aggressive selling
```

---

# 22. STOP / Opt-Out

Explicit opt-out must override normal business logic.

Examples:

```text
STOP
stop
unsubscribe
not interested
don't contact me
```

Result:

```json
{
  "action": "end",
  "rationale": "User requested no further contact."
}
```

No subsequent marketing message should be generated for that conversation unless a new valid consent state is provided.

---

# 23. Customer Privacy

Customer data must be treated as sensitive application data.

Never:

* log full customer payloads
* expose customer data in frontend logs
* send customer data to unnecessary external services
* include unnecessary customer information in prompts

Only send the minimum context required for generation.

---

# 24. Logging

Use structured logs.

Example:

```json
{
  "timestamp": "2026-09-25T15:30:00Z",
  "level": "info",
  "event": "trigger_processed",
  "trigger_id": "trg_123",
  "merchant_id": "m_001",
  "decision": "send"
}
```

Do NOT log:

```text
API keys
Passwords
MongoDB URI
Full customer payload
Full merchant payload
LLM credentials
```

Production logs must be safe to share with developers.

---

# 25. Error Handling

The API must fail gracefully.

Never expose stack traces to clients.

Bad:

```json
{
  "error": "TypeError at /src/..."
}
```

Good:

```json
{
  "error": "internal_error",
  "message": "Unable to process request"
}
```

Internally, log the actual error.

---

# 26. `/v1/tick` Error Policy

A tick failure must not cause the service to crash.

Preferred fallback:

```json
{
  "actions": []
}
```

Never allow an LLM failure to bring down Express.

---

# 27. `/v1/reply` Error Policy

Preferred fallback:

```json
{
  "action": "wait",
  "wait_seconds": 300,
  "rationale": "Temporary processing failure."
}
```

The challenge guide specifically recommends returning a valid fallback instead of allowing errors/timeouts to escape.

---

# 28. Timeout Constraints

Maximum external request budget:

```text
30 seconds
```

Internal LLM timeout:

```text
20 seconds
```

Recommended:

```javascript
Promise.race([
    callLLM(prompt),
    timeout(20000)
])
```

Never allow the LLM request to consume the entire HTTP timeout budget.

---

# 29. Rate Limits

The system must support approximately:

```text
10 requests / second
```

Do not implement a global lock around LLM requests.

Use:

```text
per-request execution
+
per-conversation synchronization
```

not:

```text
global mutex
```

The guide explicitly calls out the 10 requests/second requirement and recommends avoiding a global LLM mutex.

---

# 30. Context Payload Limit

Maximum incoming context:

```text
500 KB
```

Express may allow slight headroom:

```javascript
express.json({
    limit: "600kb"
})
```

Reject obviously oversized payloads.

---

# 31. Secrets

Never hardcode:

```text
LLM_API_KEY
MONGO_URI
JWT_SECRET
SESSION_SECRET
```

Use:

```text
.env
```

and production environment variables.

`.env` must be in `.gitignore`.

---

# 32. Security

Minimum security requirements:

```text
Helmet
CORS configuration
Input validation
Payload limits
No stack trace exposure
Environment-based secrets
Request logging
Dependency auditing
```

Run periodically:

```bash
npm audit
```

---

# 33. MongoDB Constraints

If MongoDB is used:

Use separate collections:

```text
contexts
conversations
messages
merchants
customers
categories
triggers
```

Indexes should exist for:

```text
context_id
merchant_id
customer_id
conversation_id
trigger_id
suppression_key
created_at
```

Do not query MongoDB repeatedly inside a single tick when the required context is already available in memory.

Use MongoDB as persistence, not as an unnecessary bottleneck.

---

# 34. In-Memory Context Cache

The production system should maintain a fast in-memory context cache.

Recommended:

```text
MongoDB
   ↓
Persistence

Map
   ↓
Hot context
```

The latest `/v1/context` update must immediately update the in-memory cache.

This ensures that mid-test updates are visible immediately.

---

# 35. React Constraints

The React application is secondary.

Required:

```text
Dashboard
Vera Test Console
Conversation Viewer
Trigger Tester
System Health
```

Do NOT initially build:

```text
Complex authentication
Large CRUD admin panel
Analytics platform
Notification center
Full SaaS billing
```

These do not improve the challenge-facing score.

The supplied guide explicitly recommends deprioritizing a large React dashboard until the judge-facing phases are passing.

---

# 36. REST API Design

For internal development APIs:

```text
GET
POST
PUT
PATCH
DELETE
```

Use standard HTTP semantics.

For example:

```text
GET    /api/conversations/:id
POST   /api/test/tick
POST   /api/test/reply
```

However, challenge endpoints under `/v1/*` must preserve the challenge contract.

---

# 37. Testing Requirements

The project must have:

```text
Unit tests
Integration tests
API tests
Conversation tests
Validation tests
Suppression tests
Timeout tests
```

Minimum test cases:

### Context

```text
new version
same version
lower version
unknown scope
```

### Tick

```text
valid trigger
unknown trigger
expired trigger
suppressed trigger
duplicate trigger
20+ triggers
empty trigger list
```

### Reply

```text
normal reply
YES
GO AHEAD
STOP
not interested
auto reply
hostile message
off-topic message
```

---

# 38. Challenge Simulator

The official simulator must be treated as an integration test.

Test sequence:

```text
warmup
   ↓
phase2_short
   ↓
auto_reply_hell
   ↓
intent_transition
   ↓
hostile
   ↓
full_evaluation
```

The guide specifies this progression.

---

# 39. Local Development

Required commands:

```bash
npm run dev
```

Production:

```bash
npm start
```

Testing:

```bash
npm test
```

Lint:

```bash
npm run lint
```

---

# 40. Docker

The production backend must be containerizable.

Required:

```text
Dockerfile
.dockerignore
docker-compose.yml
```

Development stack:

```text
React
Node/Express
MongoDB
```

Production stack:

```text
Node/Express
MongoDB Atlas
LLM provider
```

---

# 41. Deployment

Production requirements:

```text
Public HTTPS
No long cold start
Stable process
Environment variables
Health endpoint
Automatic restart
Centralized logs
```

The judge-facing backend must be deployed independently from React.

The challenge guide recommends deploying early so real network latency and timeout behavior are tested before the final evaluation.

---

# 42. Deployment Environment

Required environment variables:

```env
NODE_ENV=production
PORT=8080

MONGO_URI=

LLM_PROVIDER=
LLM_API_KEY=
LLM_MODEL=

LOG_LEVEL=info
```

Never commit these values.

---

# 43. Performance Requirements

Target:

```text
healthz       < 100 ms
metadata      < 100 ms
context       < 200 ms
tick          < 20 seconds
reply         < 20 seconds
```

The hard external constraint is:

```text
30 seconds
```

---

# 44. Availability

The service must remain available throughout the evaluation window.

`/v1/healthz` must remain independent from:

```text
MongoDB
LLM provider
React
external analytics
```

A temporary LLM failure must not make the health endpoint fail.

---

# 45. Graceful Degradation

If:

```text
LLM unavailable
```

then:

```text
tick → actions:[]
reply → wait
```

If:

```text
MongoDB unavailable
```

but current context exists in memory:

```text
continue using in-memory state
```

The service must prefer degraded functionality over crashing.

---

# 46. Code Organization

Recommended production structure:

```text
vera-ai/
│
├── server/
│   ├── src/
│   │   ├── server.js
│   │   │
│   │   ├── config/
│   │   │   ├── env.js
│   │   │   └── database.js
│   │   │
│   │   ├── routes/
│   │   │   ├── challenge.routes.js
│   │   │   └── api.routes.js
│   │   │
│   │   ├── controllers/
│   │   │
│   │   ├── services/
│   │   │   ├── context.service.js
│   │   │   ├── decision.service.js
│   │   │   ├── composition.service.js
│   │   │   ├── conversation.service.js
│   │   │   └── suppression.service.js
│   │   │
│   │   ├── ai/
│   │   │   ├── llm.client.js
│   │   │   ├── prompt.builder.js
│   │   │   ├── output.parser.js
│   │   │   └── model.config.js
│   │   │
│   │   ├── validators/
│   │   │   ├── context.validator.js
│   │   │   ├── message.validator.js
│   │   │   └── reply.validator.js
│   │   │
│   │   ├── rules/
│   │   │   ├── suppression.rules.js
│   │   │   ├── intent.rules.js
│   │   │   ├── safety.rules.js
│   │   │   └── repetition.rules.js
│   │   │
│   │   ├── models/
│   │   │
│   │   ├── repositories/
│   │   │
│   │   └── utils/
│   │
│   ├── tests/
│   ├── Dockerfile
│   └── package.json
│
├── client/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
│
├── challenge/
│   ├── judge_simulator.py
│   ├── dataset/
│   └── examples/
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── ai-design.md
│
├── .env.example
├── .gitignore
├── docker-compose.yml
├── README.md
└── PROJECT_CONSTRAINT.md
```

---

# 47. Git Constraints

Use:

```text
main
develop
feature/*
```

Commit style:

```text
feat:
fix:
refactor:
test:
docs:
chore:
```

Examples:

```text
feat: add trigger context ingestion
feat: add research digest composer
fix: prevent duplicate suppression sends
test: add intent transition coverage
```

Never commit:

```text
.env
API keys
Mongo credentials
private customer datasets
LLM responses containing sensitive information
```

---

# 48. Development Priority

Priority order is mandatory:

```text
P0 — Challenge API
P0 — Context store
P0 — /v1/tick
P0 — Validator
P0 — Suppression
P0 — /v1/reply
P0 — Timeout handling

P1 — Trigger-specific prompts
P1 — Customer-facing composition
P1 — Conversation intelligence
P1 — LLM optimization

P2 — MongoDB persistence
P2 — React console
P2 — Analytics

P3 — UI polish
P3 — Advanced dashboards
```

Do not reverse this order simply because React/MongoDB is familiar.

---

# 49. Definition of Done

The project is considered production-ready when:

```text
[ ] All five challenge endpoints work
[ ] Context versioning works
[ ] Current context is always used
[ ] No stale context is accepted
[ ] Tick never crashes
[ ] Reply never crashes
[ ] LLM calls have timeouts
[ ] LLM failures have fallbacks
[ ] Duplicate sends are suppressed
[ ] Verbatim repetition is prevented
[ ] STOP is respected
[ ] Auto-replies are detected
[ ] Intent transitions are handled
[ ] Hostile messages are handled
[ ] Customer context is isolated
[ ] Message validation is implemented
[ ] No hallucinated facts are accepted
[ ] Official warmup passes
[ ] phase2_short passes
[ ] auto_reply_hell passes
[ ] intent_transition passes
[ ] hostile passes
[ ] full_evaluation passes
[ ] HTTPS deployment works
[ ] healthz remains independent
[ ] secrets are externalized
[ ] tests pass
[ ] README is complete
[ ] metadata is complete
```

---

# 50. Engineering Principle

The core principle of this project is:

> **Rules decide what Vera should do. AI decides how Vera should say it.**

Do not build:

```text
Input → LLM → Output
```

Build:

```text
Input
  ↓
Context
  ↓
Rules
  ↓
Decision
  ↓
Prompt
  ↓
LLM
  ↓
Validator
  ↓
Action
```

This keeps the system:

```text
Predictable
Testable
Safe
Fast
Context-aware
Production-ready
```

---

# 51. Challenge-Specific Principle

The system must optimize for **useful, contextual actions**, not maximum message volume.

A valid decision is:

```json
{
  "actions": []
}
```

when no meaningful action exists.

The system should prefer:

```text
one highly relevant message
```

over:

```text
multiple generic messages
```

---

# 52. Final Architecture Rule

The challenge-facing service is the product.

React, MongoDB, dashboards, and additional infrastructure are supporting components.

Therefore:

```text
                    PRIMARY
                       │
                       ▼
              Express Challenge API
                       │
            ┌──────────┼──────────┐
            ▼          ▼          ▼
         Context    Decision    Reply
          Engine     Engine     Engine
            │          │          │
            └──────────┼──────────┘
                       ▼
                 AI Composer
                       │
                       ▼
                  Validator
                       │
                       ▼
                    Action


       SECONDARY                    OPTIONAL
          │                            │
          ▼                            ▼
       MongoDB                      React
     persistence                 dashboard
```

The production guide confirms that the judge-facing API and AI behavior should be completed before spending significant time on React, MongoDB CRUD, or additional application layers.
