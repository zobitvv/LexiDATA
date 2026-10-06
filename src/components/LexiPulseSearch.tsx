'use client';

import * as React from 'react';
import { Search, Shield, History, MapPin, Phone, CreditCard, Loader2, AlertCircle, Copy, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { queryLegalDatabase, queryBackupDatabase, type SearchResult } from '@/app/actions';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function LexiPulseSearch() {
  const { toast } = useToast();
  const [query, setQuery] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);
  const [result, setResult] = React.useState<SearchResult | null>(null);
  const [history, setHistory] = React.useState<{ query: string; timestamp: number }[]>([]);
  const [status, setStatus] = React.useState<{ text: string; color: string }>({ text: 'System Ready', color: 'text-muted-foreground' });

  const supportNumber = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER || '9234098325287';

  React.useEffect(() => {
    const saved = localStorage.getItem('lexipulse_history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const saveToHistory = (q: string) => {
    const newHistory = [{ query: q, timestamp: Date.now() }, ...history.filter(h => h.query !== q)].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('lexipulse_history', JSON.stringify(newHistory));
  };

  const formatCNIC = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (clean.length === 13) {
      return `${clean.slice(0, 5)}-${clean.slice(5, 12)}-${clean.slice(12)}`;
    }
    return val;
  };

  const normalizeInput = (text: string) => {
    let clean = text.replace(/\D/g, '');
    if (clean.length === 13) return clean;
    if (clean.length >= 9 && clean.length <= 12) {
      if (clean.startsWith('92')) clean = clean.slice(2);
      while (clean.startsWith('0')) clean = clean.slice(1);
      return clean;
    }
    return clean;
  };

  const handleCopy = () => {
    if (!result) return;
    const cnicFormatted = result.cnic ? formatCNIC(result.cnic) : 'N/A';
    const numbersList = result.numbers?.join(', ') || 'N/A';
    const text = `--- LexiPulse Verified Record ---
Name: ${result.name || 'UNIDENTIFIED'}
CNIC: ${cnicFormatted}
Contact: ${numbersList}
Address: ${result.address || 'N/A'}

	Verified via ZOBITECH: https://zobitech.vercel.app
---------------------------------`.trim();
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: "Record details and ZOBITECH link copied successfully.",
    });
  };

  const handleSearch = async (val?: string) => {
    const searchVal = val || query;
    if (!searchVal.trim()) return;

    setIsSearching(true);
    setResult(null);
    setStatus({ text: `Protocol: Querying target [${searchVal}]...`, color: 'text-primary' });

    const normalized = normalizeInput(searchVal);
    const data = await queryLegalDatabase(normalized);

    // If a search returns a CNIC but was queried by phone, cross-reference it
    if (normalized.length < 13 && data.cnic && !data.error) {
      setStatus({ text: `Cross-Referencing: Matching record via CNIC...`, color: 'text-accent' });
      const cleanCnic = data.cnic.replace(/\D/g, '');
      const deepData = data.source === 'backup' 
        ? await queryBackupDatabase(cleanCnic)
        : await queryLegalDatabase(cleanCnic);
      processResult(deepData, searchVal);
    } else {
      processResult(data, searchVal);
    }
  };

  const processResult = (data: SearchResult, originalQuery: string) => {
    setResult(data);
    saveToHistory(originalQuery);
    
    const hasData = data.name || (data.numbers && data.numbers.length > 0);
    if (hasData) {
      setStatus({ text: `Match Confirmed: Protocol Complete (${data.source?.toUpperCase()})`, color: 'text-green-500' });
    } else {
      setStatus({ text: 'No Match Found: Subject unidentified', color: 'text-orange-500' });
    }
    setIsSearching(false);
  };

  const isNotFound = result && !result.name && (!result.numbers || result.numbers.length === 0);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 pb-20 pt-10">
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative flex items-center gap-2 p-2 bg-card border rounded-xl shadow-2xl">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter CNIC or Phone Number for verification..."
              className="pl-12 h-14 bg-background border-none text-lg font-body focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <Button 
            onClick={() => handleSearch()} 
            disabled={isSearching}
            className="h-14 px-8 font-headline text-lg bg-primary hover:bg-primary/90 rounded-lg"
          >
            {isSearching ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Shield className="w-5 h-5 mr-2" />}
            Verify
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className={cn("flex items-center gap-2 text-sm font-code", status.color)}>
          <div className={cn("w-2 h-2 rounded-full", isSearching ? "bg-accent animate-pulse" : status.color.replace('text-', 'bg-'))}></div>
          {status.text}
        </div>
      </div>

      {isSearching && (
        <Card className="border-dashed bg-primary/5 animate-pulse">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="font-headline text-lg text-primary">Analyzing Records...</p>
          </CardContent>
        </Card>
      )}

      {result && !isSearching && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {!isNotFound ? (
            <Card className="overflow-hidden border-primary/20 shadow-xl bg-gradient-to-br from-card to-background">
              <div className="h-2 bg-primary"></div>
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl font-headline font-bold text-foreground">
                      {result.name || "UNIDENTIFIED ENTITY"}
                    </CardTitle>
                    <CardDescription className="font-body">Verified Corporate Entity Profile</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleCopy}
                      className="font-code text-[10px] uppercase tracking-widest h-8 px-3 border-accent/50 text-accent hover:bg-accent/10"
                    >
                      <Copy className="w-3.5 h-3.5 mr-2" />
                      Copy Record
                    </Button>
                    <Badge variant="outline" className="font-code uppercase tracking-widest text-[10px] border-primary/50 text-primary bg-primary/5 px-2 py-0.5 h-8 flex items-center">
                      Secure Access
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <CreditCard className="w-3 h-3" />
                      Identification (CNIC)
                    </div>
                    <div className="text-xl font-code font-bold tracking-widest text-foreground bg-secondary/50 p-4 rounded-lg border">
                      {result.cnic ? formatCNIC(result.cnic) : "DATA_UNAVAILABLE"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      Contact Nodes
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.numbers && result.numbers.length > 0 ? (
                        result.numbers.map((num, i) => (
                          <Badge key={i} className="font-code text-sm py-1.5 px-3 bg-secondary hover:bg-secondary/80 text-foreground border-none">
                            {num}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground italic text-sm">No contact nodes recorded</span>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      Registered Physical Profile
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/30 border text-foreground font-body leading-relaxed">
                      {result.address || "No physical profile address found on file for this subject."}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-destructive/20 bg-destructive/5 shadow-lg">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-6">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-headline font-bold text-foreground">No Matching Record Found</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
                    The query <span className="text-foreground font-code">"{query}"</span> did not return any confirmed identity matches in our corporate database.
                  </p>
                </div>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                  <Button 
                    asChild
                    className="h-12 bg-[#25D366] hover:bg-[#128C7E] text-white border-none font-headline"
                  >
                    <a 
                      href={`https://wa.me/${supportNumber}?text=${encodeURIComponent(`Hi LexiPulse Support, I searched for "${query}" but no record was found. Can you help verify this?`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageSquare className="w-5 h-5 mr-2 fill-current" />
                      Contact on WhatsApp
                    </a>
                  </Button>
                  <p className="text-[10px] text-muted-foreground font-code uppercase tracking-tight">Manual Verification Request Required</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-4 pt-10 border-t border-border/20">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <History className="w-3 h-3" />
            Recent Audit Queries
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map((h, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery(h.query);
                  handleSearch(h.query);
                }}
                className="rounded-full bg-secondary/20 hover:bg-secondary/50 border-border/50 font-code text-xs px-4"
              >
                {h.query}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
