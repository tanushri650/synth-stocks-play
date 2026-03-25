import { useState } from 'react';
import { Bot, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const quickAnswers: Record<string, string> = {
  'stock': 'A stock represents ownership in a company. When you buy shares, you own a piece of that company.',
  'diversification': 'Diversification means spreading your investments across different assets to reduce risk.',
  'candlestick': 'Candlestick charts show open, high, low, and close prices. Green = price up, Red = price down.',
  'stop loss': 'A stop-loss order automatically sells a stock when it drops to a certain price to limit losses.',
  'bull': 'A bull market is when stock prices are rising or expected to rise. Opposite of a bear market.',
  'bear': 'A bear market is when stock prices are falling or expected to fall. Opposite of a bull market.',
  'ipo': 'IPO (Initial Public Offering) is when a company first sells shares to the public on a stock exchange.',
  'dividend': 'A dividend is a payment made by a company to its shareholders from its profits.',
  'portfolio': 'A portfolio is the collection of all your investments including stocks, bonds, and other assets.',
  'risk': 'Never risk more than 2% of your portfolio on a single trade. Use stop-losses and diversify.',
};

export function ChatSearchBar() {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const q = query.toLowerCase();
    const match = Object.entries(quickAnswers).find(([key]) => q.includes(key));
    setAnswer(match ? match[1] : "I don't have an answer for that yet. Try searching for: stock, diversification, candlestick, stop loss, bull, bear, IPO, dividend, portfolio, or risk.");
    setIsOpen(true);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <AnimatePresence>
        {isOpen && answer && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="max-w-2xl mx-auto mb-2 px-4"
          >
            <div className="card-cyber relative">
              <button onClick={() => { setIsOpen(false); setAnswer(null); }} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
              <div className="flex gap-2 items-start">
                <Bot className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="font-mono text-xs text-foreground leading-relaxed">{answer}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="bg-card border-t border-border py-3 px-4">
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Ask StockZ AI anything..."
              className="w-full bg-muted border border-border rounded-md pl-10 pr-4 py-2.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <button type="submit" className="btn-cyber-primary text-xs py-2.5">
            <Bot className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
