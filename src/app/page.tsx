import { LexiPulseSearch } from '@/components/LexiPulseSearch';

export default function Home() {
  return (
    <main className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center p-4 md:p-8">
      {/* Background patterns */}
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#2B5FD9_1px,transparent_1px)] [background-size:32px_32px]"></div>
      </div>
      
      {/* Abstract light effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-accent/10 blur-[150px] rounded-full pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-4xl">
        <LexiPulseSearch />
      </div>

      <footer className="fixed bottom-0 left-0 w-full p-4 text-center border-t bg-background/50 backdrop-blur-md z-10">
        <p className="text-[10px] font-code text-muted-foreground uppercase tracking-[0.2em]">
          Corporate Confidential — unauthorized access strictly prohibited — audit logs enabled
        </p>
      </footer>
    </main>
  );
}
