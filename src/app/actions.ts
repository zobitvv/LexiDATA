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
  const baseUrl = process.env.BACKUP_API_URL || 'https://sim-info-api.wasif-ali.workers.dev/?search=';
  
  // The backup API expects ?search= as provided in the URL
  const apiUrl = `${baseUrl}${encodeURIComponent(query)}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      next: { revalidate: 3600 }
    });
    
    if (!response.ok) {
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

    return { error: 'No records found in backup service' };
  } catch (error: any) {
    return { error: error.message || 'Failed to connect to backup server' };
  }
}

export async function queryLegalDatabase(query: string): Promise<SearchResult> {
  const password = process.env.LEGAL_API_PASSWORD;
  const baseUrl = process.env.LEGAL_API_URL;
  
  // If primary API is not fully configured, immediately use backup
  if (!password || !baseUrl) {
    return queryBackupDatabase(query);
  }

  const apiUrl = `${baseUrl}?password=${password}&number=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      next: { revalidate: 3600 }
    });
    
    // Explicitly handle 500 or any non-OK status by falling back to backup
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
      // Check if primary returned data. If empty, try backup.
      const hasData = data.name || data.cnic || (data.numbers && data.numbers.length > 0);
      
      if (!hasData) {
        const backupResult = await queryBackupDatabase(query);
        // Only return backup if it actually found something, otherwise return empty primary result
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
