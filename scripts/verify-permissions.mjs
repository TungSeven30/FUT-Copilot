import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const extensionRoot = path.resolve('apps/chrome-extension');
const outputRoot = path.join(extensionRoot, '.output', 'chrome-mv3');
const manifestPath = path.join(outputRoot, 'manifest.json');
const expectedEaMatch =
  'https://www.ea.com/ea-sports-fc/ultimate-team/web-app/*';
const allowedPermissions = new Set(['storage', 'sidePanel']);
const forbiddenPermissions = new Set([
  '<all_urls>',
  'cookies',
  'debugger',
  'declarativeNetRequest',
  'history',
  'proxy',
  'tabs',
  'webRequest',
  'webRequestBlocking',
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function listApplicationSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listApplicationSourceFiles(entryPath);
      }
      return /\.(?:js|ts|tsx)$/.test(entryPath) ? [entryPath] : [];
    }),
  );
  return nested.flat();
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const permissions = manifest.permissions ?? [];
const unexpectedPermissions = permissions.filter(
  (permission) => !allowedPermissions.has(permission),
);
const explicitlyForbidden = permissions.filter((permission) =>
  forbiddenPermissions.has(permission),
);

assert(
  permissions.includes('storage') && permissions.includes('sidePanel'),
  'The generated manifest must include storage and sidePanel permissions.',
);
assert(
  !permissions.includes('commands'),
  'commands must be a top-level manifest entry, not a permission.',
);
assert(
  unexpectedPermissions.length === 0,
  `Unexpected permissions: ${unexpectedPermissions.join(', ')}`,
);
assert(
  explicitlyForbidden.length === 0,
  `Forbidden permissions: ${explicitlyForbidden.join(', ')}`,
);
assert(
  (manifest.host_permissions ?? []).length === 0,
  'The MVP must not declare host_permissions.',
);
assert(
  manifest.commands?._execute_action !== undefined,
  'The open-panel command is missing from the generated manifest.',
);
assert(
  Number(manifest.minimum_chrome_version) >= 114,
  'Side Panel support requires minimum_chrome_version 114 or newer.',
);

const contentMatches = (manifest.content_scripts ?? []).flatMap(
  (contentScript) => contentScript.matches ?? [],
);
assert(
  contentMatches.length === 1 && contentMatches[0] === expectedEaMatch,
  `Content-script matches must contain only ${expectedEaMatch}.`,
);
assert(
  manifest.side_panel?.default_path === 'sidepanel.html',
  'The generated side-panel entrypoint is missing.',
);
assert(manifest.oauth2 === undefined, 'OAuth configuration is not allowed.');
assert(
  manifest.externally_connectable === undefined,
  'External extension connections are not allowed.',
);

const applicationSourceFiles = (
  await Promise.all([
    listApplicationSourceFiles(path.join(extensionRoot, 'entrypoints')),
    listApplicationSourceFiles(path.resolve('packages')),
  ])
).flat();
const remoteRequestCall = /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/;
const remoteExecutableCode =
  /\b(?:eval\s*\(|new\s+Function\s*\(|importScripts\s*\(\s*['"]https?:)/;
for (const file of applicationSourceFiles) {
  const contents = await readFile(file, 'utf8');
  assert(
    !remoteRequestCall.test(contents),
    `Remote-request primitive found in runtime source ${path.relative(process.cwd(), file)}.`,
  );
  assert(
    !remoteExecutableCode.test(contents),
    `Remote or dynamic executable code found in runtime source ${path.relative(process.cwd(), file)}.`,
  );
}

for (const entrypoint of ['background.ts', 'content.ts']) {
  const entrypointPath = path.join(extensionRoot, 'entrypoints', entrypoint);
  const contents = await readFile(entrypointPath, 'utf8');
  assert(
    !/\.(?:click|requestSubmit|submit)\s*\(|\.dispatchEvent\s*\(/.test(
      contents,
    ),
    `${entrypoint} must not programmatically activate page controls.`,
  );
}

console.log('Generated Chrome manifest permission verification passed.');
