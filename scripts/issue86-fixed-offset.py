from pathlib import Path

source = Path('src/projections/heading-metadata.js')
text = source.read_text(encoding='utf-8')
old = """export function formatHeadingTimestamp(raw, timeZone = null) {
  const date = sourceDate(raw);
  if (!date) return null;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    ...(timeZone ? { timeZone } : {})
  });
"""
new = """export function formatHeadingTimestamp(raw, timeZone = null) {
  const date = sourceDate(raw);
  if (!date) return null;
  const offsetMatch = typeof timeZone === 'string'
    ? timeZone.match(/^([+-])(\\d{2}):(\\d{2})$/)
    : null;
  if (offsetMatch) {
    const hours = Number(offsetMatch[2]);
    const minutes = Number(offsetMatch[3]);
    if (hours > 23 || minutes > 59) {
      throw new RangeError(`Invalid fixed-offset timezone: ${timeZone}`);
    }
    const sign = offsetMatch[1] === '-' ? -1 : 1;
    const offsetMinutes = sign * ((hours * 60) + minutes);
    const shifted = new Date(date.getTime() + (offsetMinutes * 60_000));
    return shifted.toISOString().slice(0, 19).replace('T', ' ');
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    ...(timeZone ? { timeZone } : {})
  });
"""
count = text.count(old)
if count != 1:
  raise SystemExit(f'expected one heading timestamp formatter body, found {count}')
source.write_text(text.replace(old, new), encoding='utf-8')

test = Path('tests/heading-metadata-projection.test.js')
text = test.read_text(encoding='utf-8')
marker = "test('caller semantic heading metadata cannot override Core source provenance', () => {\n"
addition = """test('Core-derived timestamp supports fixed-offset presentation timezones', () => {
  const event = messageEvent('chatgpt', 'fixed-offset-message', {}, {
    timestamp: '2026-08-31T15:00:00Z'
  });
  assert.match(
    renderCanonicalMarkdown([event], {
      heading: { timestamp: true, timeZone: '-04:00' }
    }),
    /^## User \\[2026-08-31 11:00:00\\]:$/m
  );
  assert.match(
    renderCanonicalMarkdown([event], {
      heading: { timestamp: true, timeZone: '+05:30' }
    }),
    /^## User \\[2026-08-31 20:30:00\\]:$/m
  );
});

"""
count = text.count(marker)
if count != 1:
  raise SystemExit(f'expected one insertion marker, found {count}')
test.write_text(text.replace(marker, addition + marker), encoding='utf-8')
