# Backup, upgrade, and rollback

## Backup first

1. Open FUT Copilot and choose **settings**.
2. Select **Export local JSON backup**.
3. Keep the downloaded file somewhere outside the repository.

The backup envelope is schema version 2 and is validated at import. It contains
only normalized FUT Copilot records, not EA HTML, credentials, cookies, tokens,
or authenticated network responses.

## Upgrade

1. Export a backup.
2. Pull or check out the desired trusted commit.
3. Run `pnpm install` and `pnpm verify`.
4. Open `chrome://extensions` and select **Reload** on FUT Copilot.
5. Confirm the settings compatibility card and existing local record count.

IndexedDB upgrades automatically from schema version 1 to 2. Duplicate states,
older market transaction names, and SBC proposal validation metadata are
migrated without deleting records.

## Restore data

In settings, select a FUT Copilot JSON backup and review the parsed record
count. Choose:

- **Merge** to preserve unrelated local records; imported primary keys win on
  conflicts.
- **Replace + backup** to download the current database and then replace all
  tables with the imported backup.

## Roll back code

1. Export a current backup.
2. Check out the prior trusted commit or release tag.
3. Run `pnpm install`, `pnpm verify`, and reload the unpacked extension.

Do not import a schema-version-2 backup into code that supports only schema
version 1. Keep the backup for a later forward upgrade instead. Removing the
extension from Chrome can delete its local browser data, so never remove it as
a rollback step before exporting.
