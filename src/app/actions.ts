'use server';

export type SearchResult = {
  name?: string;
  cnic?: string;
  address?: string;
  numbers?: string[];
  raw?: string;
  error?: string;
  source?: 'primary' | 'backup';
};

type ApiRecord = {
  name?: string;
  mobile?: string;
  cnic?: string;
  address?: string;
};

type RecordsResponse = {
  success?: boolean;
  records?: ApiRecord[];
};

function normalizeRecordsResponse(data: RecordsResponse, rawText: string): SearchResult {
  if (!data?.success || !Array.isArray(data.records) || data.records.length === 0) {
    return { error: 'No records found', name: '', raw: rawText, source: 'primary' };
  }

  const firstRecord = data.records[0];
  const numbers = Array.from(new Set(
    data.records
      .map((record) => record.mobile?.trim())
      .filter((mobile): mobile is string => Boolean(mobile))
  ));

  return {
    name: firstRecord.name || '',
    cnic: firstRecord.cnic || '',
    address: firstRecord.address || '',
    numbers,
    raw: rawText,
    source: 'primary',
  };
}

/**
 * Backup API handler for the SIM Info service.
 * Aggregates multiple records into a single profile.
 */
export async function queryBackupDatabase(query: string): Promise<SearchResult> {
  const baseUrl = 'https://sim-info-api.wasif-ali.workers.dev';
  const params = new URLSearchParams({ search: query });
  const apiUrl = `${baseUrl}?${params.toString()}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LexiPulse/1.1',
      },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        // Treat 404 as "No records found" so the UI shows the WhatsApp contact card
        return { error: 'No records found', name: '', source: 'backup' };
      }
      throw new Error(`Backup API responded with status ${response.status}`);
    }

    const data = await response.json();

    if (data && data.success && Array.isArray(data.records) && data.records.length > 0) {
      const firstRecord = data.records[0];
      const allNumbers = Array.from(new Set(
        data.records
          .map((r: any) => r.mobile)
          .filter((m: any) => !!m)
      )) as string[];

      return {
        name: firstRecord.name || '',
        cnic: firstRecord.cnic || '',
        address: firstRecord.address || '',
        numbers: allNumbers,
        raw: JSON.stringify(data, null, 2),
        source: 'backup'
      };
    }

    return { error: 'No records found', name: '', source: 'backup' };
  } catch (error: any) {
    return { error: error.message || 'Failed to connect to backup server', name: '', source: 'backup' };
  }
}

export async function queryLegalDatabase(query: string): Promise<SearchResult> {
  const apiKey = process.env.LEGAL_API_KEY || process.env.Legal_API_Key;
  const baseUrl = process.env.LEGAL_API_URL;

  // The legal API uses an API key and does not require a password.
  if (!apiKey || !baseUrl) {
    return queryBackupDatabase(query);
  }

  const params = new URLSearchParams({
    number: query,
    api_key: apiKey,
  });
  const apiUrl = baseUrl.includes('?')
    ? `${baseUrl}&${params.toString()}`
    : `${baseUrl}?${params.toString()}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LexiPulse/1.1',
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Key': apiKey,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return queryBackupDatabase(query);
    }

    const rawText = await response.text();
    let data: RecordsResponse;
    try {
      data = JSON.parse(rawText) as RecordsResponse;
    } catch {
      return queryBackupDatabase(query);
    }

    const result = normalizeRecordsResponse(data, rawText);
    if (result.error) {
      return queryBackupDatabase(query);
    }
    return result;
  } catch {
    return queryBackupDatabase(query);
  }
}
