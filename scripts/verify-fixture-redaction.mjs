import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const fixtureRoot = path.resolve('fixtures');
const inspectedExtensions = new Set(['.html', '.htm', '.json']);
const prohibitedPatterns = [
  {
    label: 'email address',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  },
  { label: 'authorization header', pattern: /\bauthorization\s*[:=]/i },
  { label: 'bearer token', pattern: /\bbearer\s+[A-Z0-9._~+/-]+=*/i },
  { label: 'cookie data', pattern: /\b(?:set-cookie|cookie)\s*[:=]/i },
  { label: 'access token', pattern: /\baccess[_-]?token\s*[:=]/i },
  { label: 'refresh token', pattern: /\brefresh[_-]?token\s*[:=]/i },
  {
    label: 'session identifier',
    pattern: /\bsession[_-]?(?:id|key|token)\s*[:=]/i,
  },
  { label: 'csrf data', pattern: /\b(?:csrf|xsrf)[_-]?token\s*[:=]/i },
  {
    label: 'EA persona identifier',
    pattern: /\b(?:persona|nucleus|account)[_-]?id\s*[:=]/i,
  },
  { label: 'personal club name', pattern: /\bclub[_-]?name\s*[:=]/i },
  { label: 'coin balance', pattern: /\bcoin[_-]?balance\s*[:=]/i },
  { label: 'long numeric account-like value', pattern: /\b\d{20,}\b/ },
];

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    }),
  );
  return nested.flat();
}

const files = (await listFiles(fixtureRoot)).filter((file) =>
  inspectedExtensions.has(path.extname(file)),
);
const failures = [];

for (const file of files) {
  const contents = await readFile(file, 'utf8');
  for (const prohibited of prohibitedPatterns) {
    if (prohibited.pattern.test(contents)) {
      failures.push(
        `${path.relative(process.cwd(), file)}: ${prohibited.label}`,
      );
    }
  }
}

if (failures.length > 0) {
  throw new Error(
    `Fixture redaction verification failed:\n${failures.join('\n')}`,
  );
}

console.log(`Fixture redaction verification passed (${files.length} files).`);
