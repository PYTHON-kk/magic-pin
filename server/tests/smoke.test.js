// Quick smoke test for all endpoints
const BASE = 'http://localhost:8080';

async function test() {
  console.log('\n=== Vera Bot Smoke Test ===\n');

  // 1. Healthz
  console.log('1. GET /v1/healthz');
  let r = await fetch(`${BASE}/v1/healthz`);
  let d = await r.json();
  console.log(`   Status: ${r.status}`, d);
  console.assert(r.status === 200 && d.status === 'ok', 'FAIL: healthz');

  // 2. Metadata
  console.log('\n2. GET /v1/metadata');
  r = await fetch(`${BASE}/v1/metadata`);
  d = await r.json();
  console.log(`   Status: ${r.status}`, d.team_name, d.model);
  console.assert(r.status === 200 && d.team_name, 'FAIL: metadata');

  // 3. Context push (new)
  console.log('\n3. POST /v1/context (new category)');
  r = await fetch(`${BASE}/v1/context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: 'category', context_id: 'dentists', version: 1,
      payload: { slug: 'dentists', voice: { tone: 'peer_clinical', vocab_allowed: [], vocab_taboo: [] } },
      delivered_at: '2026-04-26T10:00:00Z'
    })
  });
  d = await r.json();
  console.log(`   Status: ${r.status}`, d);
  console.assert(r.status === 200 && d.accepted === true, 'FAIL: context new');

  // 4. Context push (same version = idempotent)
  console.log('\n4. POST /v1/context (same version = idempotent)');
  r = await fetch(`${BASE}/v1/context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: 'category', context_id: 'dentists', version: 1,
      payload: { slug: 'dentists' }, delivered_at: '2026-04-26T10:01:00Z'
    })
  });
  d = await r.json();
  console.log(`   Status: ${r.status}`, d);
  console.assert(r.status === 200 && d.accepted === true, 'FAIL: context idempotent');

  // 5. Context push (stale version = 409)
  console.log('\n5. POST /v1/context (higher version first)');
  await fetch(`${BASE}/v1/context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: 'category', context_id: 'dentists', version: 3,
      payload: { slug: 'dentists', voice: { tone: 'peer_clinical', vocab_allowed: [], vocab_taboo: [] } },
      delivered_at: '2026-04-26T10:02:00Z'
    })
  });
  r = await fetch(`${BASE}/v1/context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: 'category', context_id: 'dentists', version: 2,
      payload: { slug: 'dentists' }, delivered_at: '2026-04-26T10:03:00Z'
    })
  });
  d = await r.json();
  console.log(`   Status: ${r.status}`, d);
  console.assert(r.status === 409 && d.accepted === false, 'FAIL: context stale');

  // 6. Context push (invalid scope = 400)
  console.log('\n6. POST /v1/context (invalid scope = 400)');
  r = await fetch(`${BASE}/v1/context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: 'invalid', context_id: 'test', version: 1,
      payload: {}, delivered_at: '2026-04-26T10:00:00Z'
    })
  });
  d = await r.json();
  console.log(`   Status: ${r.status}`, d);
  console.assert(r.status === 400, 'FAIL: context invalid scope');

  // 7. Tick with empty triggers
  console.log('\n7. POST /v1/tick (empty triggers)');
  r = await fetch(`${BASE}/v1/tick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ now: '2026-04-26T10:30:00Z', available_triggers: [] })
  });
  d = await r.json();
  console.log(`   Status: ${r.status}`, d);
  console.assert(r.status === 200 && Array.isArray(d.actions), 'FAIL: tick empty');

  // 8. Reply (no context yet, should return wait)
  console.log('\n8. POST /v1/reply (basic)');
  r = await fetch(`${BASE}/v1/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation_id: 'conv_test_001', merchant_id: 'm_001',
      from_role: 'merchant', message: 'Hello', received_at: '2026-04-26T10:45:00Z', turn_number: 1
    })
  });
  d = await r.json();
  console.log(`   Status: ${r.status}`, d);
  console.assert(r.status === 200 && d.action, 'FAIL: reply');

  // 9. Healthz again (should show context counts)
  console.log('\n9. GET /v1/healthz (after context pushes)');
  r = await fetch(`${BASE}/v1/healthz`);
  d = await r.json();
  console.log(`   Status: ${r.status}`, d);
  console.assert(d.contexts_loaded.category === 1, 'FAIL: healthz context count');

  // 10. Teardown
  console.log('\n10. POST /v1/teardown');
  r = await fetch(`${BASE}/v1/teardown`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  d = await r.json();
  console.log(`   Status: ${r.status}`, d);
  console.assert(r.status === 200 && d.ok === true, 'FAIL: teardown');

  // Verify teardown cleared state
  r = await fetch(`${BASE}/v1/healthz`);
  d = await r.json();
  console.assert(d.contexts_loaded.category === 0, 'FAIL: teardown did not clear');

  console.log('\n=== All smoke tests passed! ===\n');
}

test().catch(e => { console.error('Test error:', e.message); process.exit(1); });
