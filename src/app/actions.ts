
'use server';

export type SearchResult = {
  name?: string;
  cnic?: string;
  address?: string;
  numbers?: string[];
  raw?: string;
  error?: string;
};

export async function queryLegalDatabase(query: string): Promise<SearchResult> {
  const password = process.env.LEGAL_API_PASSWORD;
  const baseUrl = process.env.LEGAL_API_URL;
  
  if (!password || !baseUrl) {
    return { error: 'Server configuration error: Missing API credentials' };
  }

  const apiUrl = `${baseUrl}?password=${password}&number=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      next: { revalidate: 3600 } // Cache for 1 hour
    });
    
    if (!response.ok) {
      throw new Error(`External API responded with status ${response.status}`);
    }

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      return { raw: rawText };
    }

    if (data && typeof data === 'object') {
      return {
        name: data.name || '',
        cnic: data.cnic || '',
        address: data.address || '',
        numbers: data.numbers || [],
        raw: rawText
      };
    }

    return { raw: rawText };
  } catch (error: any) {
    return { error: error.message || 'Failed to connect to verification server' };
  }
}
