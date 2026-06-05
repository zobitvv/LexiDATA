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
 * Backup API handler for the second service.
 * Aggregates multiple records into a single SearchResult.
 */
async function queryBackupDatabase(query: string): Promise<SearchResult> {
  const baseUrl = process.env.BACKUP_API_URL;
  
  if (!baseUrl) {
    return { error: 'Backup service not configured' };
  }

  // Determine query parameter based on URL structure
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

    const data = await response.json();

    // Process the specific records format from the 2nd API
    if (data && data.success && Array.isArray(data.records) && data.records.length > 0) {
      const firstRecord = data.records[0];
      
      // Collect all unique mobile numbers from all records
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
      // If primary returned a valid object but potentially empty data, try backup
      const hasData = data.name || data.cnic || (data.numbers && data.numbers.length > 0);
      
      if (!hasData) {
        const backup = await queryBackupDatabase(query);
        if (!backup.error) return backup;
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
    // On any connection error or timeout to primary, use backup
    return queryBackupDatabase(query);
  }
}
