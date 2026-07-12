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
  const password = process.env.LEGAL_API_PASSWORD;
  const baseUrl = process.env.LEGAL_API_URL;
  
  if (!password || !baseUrl) {
    return queryBackupDatabase(query);
  }

  const params = new URLSearchParams({ 
    password: password,
    number: query 
  });
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
      return queryBackupDatabase(query);
    }

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      return queryBackupDatabase(query);
    }

    if (data && typeof data === 'object') {
      const hasData = data.name || data.cnic || (data.numbers && data.numbers.length > 0);
      
      if (!hasData) {
        return queryBackupDatabase(query);
      }

      return {
        name: data.name || '',
        cnic: data.cnic || '',
        address: data.address || '',
        numbers: data.numbers || [],
        raw: rawText,
        source: 'primary'
      };
    }

    return queryBackupDatabase(query);
  } catch (error: any) {
    return queryBackupDatabase(query);
  }
}
