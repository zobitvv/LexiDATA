
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
 * Backup API handler for the second service (no password required).
 * Aggregates multiple records into a single SearchResult.
 */
async function queryBackupDatabase(query: string): Promise<SearchResult> {
  const baseUrl = process.env.BACKUP_API_URL;
  
  if (!baseUrl) {
    return { error: 'Backup service not configured' };
  }

  // The backup API structure: URL?number=QUERY or similar
  // Adjusting to common pattern: baseUrl should include the query param key if needed
  const apiUrl = baseUrl.includes('?') 
    ? `${baseUrl}&number=${encodeURIComponent(query)}`
    : `${baseUrl}?number=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      next: { revalidate: 3600 }
    });
    
    if (!response.ok) {
      throw new Error(`Backup API responded with status ${response.status}`);
    }

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      return { raw: rawText, error: 'Invalid JSON from backup service' };
    }

    // Process the specific 2nd API format provided by user
    if (data && data.success && Array.isArray(data.records) && data.records.length > 0) {
      const firstRecord = data.records[0];
      // Aggregate all mobile numbers from all records
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
        raw: rawText,
        source: 'backup'
      };
    }

    return { raw: rawText, error: 'No records found in backup service' };
  } catch (error: any) {
    return { error: error.message || 'Failed to connect to backup server' };
  }
}

export async function queryLegalDatabase(query: string): Promise<SearchResult> {
  const password = process.env.LEGAL_API_PASSWORD;
  const baseUrl = process.env.LEGAL_API_URL;
  
  if (!password || !baseUrl) {
    // If primary isn't configured, immediately try backup
    return queryBackupDatabase(query);
  }

  const apiUrl = `${baseUrl}?password=${password}&number=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      next: { revalidate: 3600 }
    });
    
    // If primary fails, fallback to backup instead of returning error immediately
    if (!response.ok) {
      return queryBackupDatabase(query);
    }

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      // If parsing fails, it might be raw text or an error, try backup
      const backup = await queryBackupDatabase(query);
      if (!backup.error) return backup;
      return { raw: rawText };
    }

    if (data && typeof data === 'object') {
      // Check if data is actually useful (has a name or CNIC)
      const hasData = data.name || data.cnic || (data.numbers && data.numbers.length > 0);
      
      if (!hasData) {
        // Primary returned empty results, try backup
        const backup = await queryBackupDatabase(query);
        if (!backup.error && (backup.name || backup.cnic)) return backup;
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

    // Fallback if structure is unknown
    return queryBackupDatabase(query);
  } catch (error: any) {
    // On any connection error to primary, use backup
    return queryBackupDatabase(query);
  }
}
