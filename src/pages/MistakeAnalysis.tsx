import { Layout } from '@/components/Layout';
import { AlertTriangle } from 'lucide-react';

const MistakeAnalysis = () => (
  <Layout>
    <div className="max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[50vh]">
      <div className="card-cyber text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse-glow" />
        <h2 className="font-display text-xl tracking-wider text-primary mb-2">Mistake Analysis</h2>
        <p className="font-mono text-xs text-muted-foreground">Track and learn from your trading mistakes. Coming soon.</p>
      </div>
    </div>
  </Layout>
);

export default MistakeAnalysis;
