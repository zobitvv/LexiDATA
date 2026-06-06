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
async function queryBackupDatabase(query: string): Promise<SearchResult> {
  // Removing trailing slash to avoid potential routing issues on the worker
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
        return { error: 'Backup service route not found (404). The API might have moved.' };
      }
      throw new Error(`Backup API responded with status ${response.status}`);
    }

    const data = await response.json();

    // Process the specific records format: { success: true, records: [...] }
    if (data && data.success && Array.isArray(data.records) && data.records.length > 0) {
      const firstRecord = data.records[0];
      
      // Collect all unique mobile numbers from all matching records
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

    return { error: 'No records found in backup service for this query.' };
  } catch (error: any) {
    return { error: error.message || 'Failed to connect to backup server' };
  }
}

export async function queryLegalDatabase(query: string): Promise<SearchResult> {
  const password = process.env.LEGAL_API_PASSWORD;
  const baseUrl = process.env.LEGAL_API_URL;
  
  // If primary API is not configured, immediately use backup
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
    
    // Explicitly handle server errors (like 500) by falling back to backup
    if (!response.ok) {
      console.error(`Primary API Error: ${response.status}`);
      return queryBackupDatabase(query);
    }

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      // If primary returns invalid JSON, try backup
      return queryBackupDatabase(query);
    }

    if (data && typeof data === 'object') {
      // Check if primary returned actual content
      const hasData = data.name || data.cnic || (data.numbers && data.numbers.length > 0);
      
      if (!hasData) {
        const backupResult = await queryBackupDatabase(query);
        // Only return backup if it actually found something, otherwise return the empty primary result
        if (!backupResult.error) return backupResult;
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
    // On connection failure to primary, use backup
    return queryBackupDatabase(query);
  }
}
