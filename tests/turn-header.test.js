import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STYLE_ROLES,
  buildTurnHeaderComponents,
  configureProjectionTheme,
  getDefaultProjectionTheme,
  renderTurnHeader,
  resetProjectionTheme
} from '../src/index.js';

const PROVIDER_TURNS = [
  {
    id: 'turn:chatgpt:user-1',
    role: 'user',
    source: {
      provider: 'chatgpt',
      records: [{ turn_id: 'chatgpt-user-source-id' }]
    }
  },
  {
    id: 'turn:chatgpt:final-1',
    role: 'assistant',
    source: {
      provider: 'chatgpt',
      records: [{ turn_id: 'chatgpt-assistant-source-id' }]
    }
  },
  {
    id: 'turn:claude:a-1',
    role: 'assistant',
    source: {
      provider: 'claude',
      records: [{ turn_id: 'claude-record-uuid' }]
    }
  },
  {
    id: 'turn:codex:a-1',
    role: 'assistant',
    source: {
      provider: 'codex',
      records: [{ turn_id: null }]
    }
  }
];

test('turn_id is optional and uses provider source identity', () => {
  const turn = PROVIDER_TURNS[1];

  assert.equal(renderTurnHeader(turn), '## ChatGPT');
  assert.equal(
    renderTurnHeader(turn, { showTurnId: true }),
    '## ChatGPT turn_id=chatgpt-assistant-source-id'
  );
  assert.doesNotMatch(
    renderTurnHeader(turn, { showTurnId: true }),
    /turn:chatgpt:final-1/
  );
});

test('timestamp, record number, and turn id compose independently', () => {
  const turn = PROVIDER_TURNS[2];

  assert.equal(
    renderTurnHeader(turn, {
      timestamp: '2026-01-02 12:00:02',
      recordNumber: 2,
      showTurnId: true
    }),
    '## Claude [2026-01-02 12:00:02]: 2: turn_id=claude-record-uuid'
  );

  assert.equal(
    renderTurnHeader(turn, { recordNumber: 2 }),
    '## Claude 2:'
  );
});

test('providers without a suitable source turn id omit the component', () => {
  assert.equal(
    renderTurnHeader(PROVIDER_TURNS[3], { showTurnId: true }),
    '## Codex'
  );
});

test('an explicit source turn id override can be projected when supplied', () => {
  assert.equal(
    renderTurnHeader(PROVIDER_TURNS[3], {
      showTurnId: true,
      turnId: 'explicit-source-id'
    }),
    '## Codex turn_id=explicit-source-id'
  );
});

test('structured components expose semantic roles without ANSI or CSS', () => {
  const components = buildTurnHeaderComponents(PROVIDER_TURNS[1], {
    timestamp: '2026-01-02 12:00:02',
    recordNumber: 2,
    showTurnId: true
  });

  assert.deepEqual(components.map(({ type, styleRole }) => ({ type, styleRole })), [
    { type: 'speaker', styleRole: STYLE_ROLES.ASSISTANT_HEADING },
    { type: 'timestamp', styleRole: STYLE_ROLES.TIMESTAMP },
    { type: 'record-number', styleRole: STYLE_ROLES.RECORD_NUMBER },
    { type: 'turn-id', styleRole: STYLE_ROLES.TURN_ID }
  ]);
});

test('default ANSI mapping preserves existing colours and gives turn id magenta', () => {
  resetProjectionTheme();
  const rendered = renderTurnHeader(PROVIDER_TURNS[1], {
    format: 'ansi',
    timestamp: '2026-01-02 12:00:02',
    recordNumber: 2,
    showTurnId: true
  });

  assert.equal(
    rendered,
    '\u001b[32m## ChatGPT\u001b[0m ' +
    '\u001b[36m[2026-01-02 12:00:02]:\u001b[0m ' +
    '\u001b[2m2:\u001b[0m ' +
    '\u001b[35mturn_id=chatgpt-assistant-source-id\u001b[0m'
  );
});

test('HTML uses stable semantic classes instead of ANSI concepts', () => {
  resetProjectionTheme();
  const rendered = renderTurnHeader(PROVIDER_TURNS[2], {
    format: 'html',
    timestamp: '2026-01-02 00:00:02',
    recordNumber: 2,
    showTurnId: true
  });

  assert.equal(
    rendered,
    '<h2><span class="transcript-assistant-heading">Claude</span> ' +
    '<span class="transcript-timestamp">[2026-01-02 00:00:02]:</span> ' +
    '<span class="transcript-record-number">2:</span> ' +
    '<span class="transcript-turn-id">turn_id=claude-record-uuid</span></h2>'
  );
});

test('global projection theme setup and per-render overrides are both exposed', () => {
  resetProjectionTheme();
  configureProjectionTheme({
    html: { [STYLE_ROLES.TURN_ID]: 'app-turn-id' }
  });

  assert.equal(getDefaultProjectionTheme().html[STYLE_ROLES.TURN_ID], 'app-turn-id');
  assert.match(
    renderTurnHeader(PROVIDER_TURNS[2], { format: 'html', showTurnId: true }),
    /class="app-turn-id"/
  );

  const overridden = renderTurnHeader(PROVIDER_TURNS[2], {
    format: 'html',
    showTurnId: true,
    theme: { html: { [STYLE_ROLES.TURN_ID]: 'one-render-turn-id' } }
  });
  assert.match(overridden, /class="one-render-turn-id"/);

  resetProjectionTheme();
});

test('theme getters return copies rather than mutable global state', () => {
  resetProjectionTheme();
  const theme = getDefaultProjectionTheme();
  theme.html[STYLE_ROLES.TURN_ID] = 'mutated';
  assert.equal(
    getDefaultProjectionTheme().html[STYLE_ROLES.TURN_ID],
    'transcript-turn-id'
  );
});
