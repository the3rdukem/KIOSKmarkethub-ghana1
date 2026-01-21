import { query } from '../index';

export interface SiteSetting {
  key: string;
  value: string;
  updated_by: string | null;
  updated_at: string;
}

export async function getSetting(key: string): Promise<string | null> {
  const result = await query<SiteSetting>(
    'SELECT value FROM site_settings WHERE key = $1',
    [key]
  );
  return result.rows[0]?.value ?? null;
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query<SiteSetting>(
    `SELECT key, value FROM site_settings WHERE key IN (${placeholders})`,
    keys
  );
  
  const settings: Record<string, string> = {};
  for (const row of result.rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const result = await query<SiteSetting>(
    'SELECT key, value FROM site_settings'
  );
  
  const settings: Record<string, string> = {};
  for (const row of result.rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

export async function setSetting(
  key: string,
  value: string,
  updatedBy?: string
): Promise<void> {
  await query(
    `INSERT INTO site_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [key, value, updatedBy ?? null]
  );
}

export async function setSettings(
  settings: Record<string, string>,
  updatedBy?: string
): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    await setSetting(key, value, updatedBy);
  }
}

export async function deleteSetting(key: string): Promise<void> {
  await query('DELETE FROM site_settings WHERE key = $1', [key]);
}
