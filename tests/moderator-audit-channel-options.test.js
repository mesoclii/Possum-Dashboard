const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('moderator audit channel picker excludes category and voice channels', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app/dashboard/moderator/ModeratorClient.tsx'), 'utf8');
  const picker = source.match(/<label>Log Channel<\/label>[\s\S]*?<\/select>/);
  assert.ok(picker, 'moderator audit log channel picker exists');
  assert.match(picker[0], /textChannels\.map\(/);
  assert.doesNotMatch(picker[0], /channels\.map\(/);
  assert.match(source, /\[0, 5\]\.includes\(Number\(channel\.type \|\| 0\)\)/);
});
