import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDate } from '../../shared/formatDate.js';
test('calendar dates share a padded Japanese representation in every timezone', () => {
  for (const timezone of ['Asia/Tokyo', 'America/Los_Angeles', 'UTC']) {
    const previous = process.env.TZ;
    process.env.TZ = timezone;
    try {
      assert.equal(formatDate('2026-09-28'), '2026年09月28日');
      assert.equal(formatDate(new Date('2026-09-28T00:00:00Z')), '2026年09月28日');
      assert.equal(formatDate(undefined), '');
      assert.equal(formatDate(new Date('2026-09-28T18:00:00Z'), 'Asia/Tokyo'), '2026年09月29日');
    } finally { if(previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
  }
});
