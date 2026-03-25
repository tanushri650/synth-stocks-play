import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ModuleProgress {
  moduleId: number;
  completed: boolean;
  score: number;
}

export interface ForumReply {
  author: string;
  content: string;
  timestamp: number;
}

export interface ForumPost {
  id: string;
  author: string;
  content: string;
  timestamp: number;
  likes: number;
  dislikes: number;
  replies: ForumReply[];
}

export interface Holding {
  symbol: string;
  name: string;
  shares: number;
  avgPrice: number;
}

export interface QuizMistake {
  moduleTitle: string;
  question: string;
  yourAnswer: string;
  correctAnswer: string;
  timestamp: number;
}

export interface TradeMistake {
  symbol: string;
  buyPrice: number;
  sellPrice: number;
  shares: number;
  loss: number;
  timestamp: number;
}

export interface User {
  username: string;
  coins: number;
  xp: number;
  level: number;
  joinedAt: number;
  modules: ModuleProgress[];
  holdings: Holding[];
  trades: number;
  badges: string[];
}

interface UserContextType {
  user: User | null;
  signup: (username: string) => void;
  logout: () => void;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  addXp: (amount: number) => void;
  completeModule: (moduleId: number, score: number) => void;
  updateHoldings: (holdings: Holding[]) => void;
  incrementTrades: () => void;
  addBadge: (badge: string) => void;
  forumPosts: ForumPost[];
  addForumPost: (content: string) => void;
  addReply: (postId: string, content: string) => void;
  likePost: (postId: string) => void;
  dislikePost: (postId: string) => void;
  deletePost: (postId: string) => void;
  quizMistakes: QuizMistake[];
  tradeMistakes: TradeMistake[];
  addQuizMistake: (mistake: Omit<QuizMistake, 'timestamp'>) => void;
  addTradeMistake: (mistake: Omit<TradeMistake, 'timestamp'>) => void;
}

const UserContext = createContext<UserContextType | null>(null);

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be within UserProvider');
  return ctx;
};

const STORAGE_KEY = 'stockz_user';
const FORUM_KEY = 'stockz_forum';
const QUIZ_MISTAKES_KEY = 'stockz_quiz_mistakes';
const TRADE_MISTAKES_KEY = 'stockz_trade_mistakes';

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  const defaultPosts: ForumPost[] = [
    { id: 'dummy-1', author: 'CyberTrader99', content: 'Just completed the Risk Management module. The 2% rule is a game changer! 🚀', timestamp: Date.now() - 3600000, likes: 12, dislikes: 1, replies: [
      { author: 'NeonBull', content: 'Agreed! It saved me from huge losses in mock trading.', timestamp: Date.now() - 3000000 },
      { author: 'PixelWhale', content: 'Which module did you do next?', timestamp: Date.now() - 2400000 },
    ]},
    { id: 'dummy-2', author: 'NeonBull', content: 'Anyone else think CYBR stock is overvalued in mock trading? Sitting at 340 coins per share seems high.', timestamp: Date.now() - 7200000, likes: 8, dislikes: 3, replies: [
      { author: 'DataMiner42', content: 'It\'s been pumping since yesterday. I\'d wait for a dip.', timestamp: Date.now() - 6000000 },
    ]},
    { id: 'dummy-3', author: 'PixelWhale', content: 'Pro tip: Always diversify your mock portfolio. Don\'t put all coins into one stock! 📊', timestamp: Date.now() - 14400000, likes: 24, dislikes: 0, replies: [] },
    { id: 'dummy-4', author: 'DataMiner42', content: 'The candlestick chart module was really helpful. Now I can read patterns much better.', timestamp: Date.now() - 28800000, likes: 15, dislikes: 2, replies: [
      { author: 'CyberTrader99', content: 'Wait until you try applying it in live charts!', timestamp: Date.now() - 25200000 },
      { author: 'AlphaVolt', content: 'The doji pattern explanation was 🔥', timestamp: Date.now() - 21600000 },
    ]},
    { id: 'dummy-5', author: 'AlphaVolt', content: 'Just hit Level 5! The grind is real but worth it. Veteran badge unlocked 🏆', timestamp: Date.now() - 43200000, likes: 31, dislikes: 0, replies: [] },
  ];

  const [forumPosts, setForumPosts] = useState<ForumPost[]>(() => {
    const saved = localStorage.getItem(FORUM_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ForumPost[];
      // Merge: keep default posts if not already present
      const ids = new Set(parsed.map(p => p.id));
      const missing = defaultPosts.filter(dp => !ids.has(dp.id));
      return [...parsed, ...missing];
    }
    return defaultPosts;
  });

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  useEffect(() => {
    localStorage.setItem(FORUM_KEY, JSON.stringify(forumPosts));
  }, [forumPosts]);

  const signup = (username: string) => {
    setUser({
      username, coins: 0, xp: 0, level: 1,
      joinedAt: Date.now(), modules: [], holdings: [],
      trades: 0, badges: ['Newcomer'],
    });
  };

  const logout = () => setUser(null);

  const addCoins = (amount: number) => setUser(u => u ? { ...u, coins: u.coins + amount } : u);

  const spendCoins = (amount: number) => {
    if (!user || user.coins < amount) return false;
    setUser(u => u ? { ...u, coins: u.coins - amount } : u);
    return true;
  };

  const addXp = (amount: number) => setUser(u => {
    if (!u) return u;
    const newXp = u.xp + amount;
    const newLevel = Math.floor(newXp / 500) + 1;
    const newBadges = [...u.badges];
    if (newLevel >= 5 && !newBadges.includes('Veteran')) newBadges.push('Veteran');
    if (newLevel >= 10 && !newBadges.includes('Elite')) newBadges.push('Elite');
    return { ...u, xp: newXp, level: newLevel, badges: newBadges };
  });

  const completeModule = (moduleId: number, score: number) => setUser(u => {
    if (!u) return u;
    const existing = u.modules.find(m => m.moduleId === moduleId);
    if (existing && existing.completed) return u;
    const modules = existing
      ? u.modules.map(m => m.moduleId === moduleId ? { ...m, completed: true, score } : m)
      : [...u.modules, { moduleId, completed: true, score }];
    const newBadges = [...u.badges];
    if (modules.filter(m => m.completed).length >= 3 && !newBadges.includes('Scholar')) newBadges.push('Scholar');
    return { ...u, modules, badges: newBadges };
  });

  const updateHoldings = (holdings: Holding[]) => setUser(u => u ? { ...u, holdings } : u);

  const incrementTrades = () => setUser(u => {
    if (!u) return u;
    const trades = u.trades + 1;
    const newBadges = [...u.badges];
    if (trades >= 5 && !newBadges.includes('Trader')) newBadges.push('Trader');
    if (trades >= 20 && !newBadges.includes('Day Trader')) newBadges.push('Day Trader');
    return { ...u, trades, badges: newBadges };
  });

  const addBadge = (badge: string) => setUser(u => {
    if (!u || u.badges.includes(badge)) return u;
    return { ...u, badges: [...u.badges, badge] };
  });

  const addForumPost = (content: string) => {
    if (!user) return;
    setForumPosts(p => [{
      id: crypto.randomUUID(), author: user.username,
      content, timestamp: Date.now(), likes: 0, dislikes: 0, replies: [],
    }, ...p]);
  };

  const addReply = (postId: string, content: string) => {
    if (!user) return;
    setForumPosts(posts => posts.map(p =>
      p.id === postId ? { ...p, replies: [...p.replies, { author: user.username, content, timestamp: Date.now() }] } : p
    ));
  };

  const likePost = (postId: string) => {
    setForumPosts(posts => posts.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p));
  };

  const dislikePost = (postId: string) => {
    setForumPosts(posts => posts.map(p => p.id === postId ? { ...p, dislikes: p.dislikes + 1 } : p));
  };

  const deletePost = (postId: string) => {
    setForumPosts(posts => posts.filter(p => p.id !== postId));
  };

  const [quizMistakes, setQuizMistakes] = useState<QuizMistake[]>(() => {
    const saved = localStorage.getItem(QUIZ_MISTAKES_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [tradeMistakes, setTradeMistakes] = useState<TradeMistake[]>(() => {
    const saved = localStorage.getItem(TRADE_MISTAKES_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(QUIZ_MISTAKES_KEY, JSON.stringify(quizMistakes));
  }, [quizMistakes]);

  useEffect(() => {
    localStorage.setItem(TRADE_MISTAKES_KEY, JSON.stringify(tradeMistakes));
  }, [tradeMistakes]);

  const addQuizMistake = (mistake: Omit<QuizMistake, 'timestamp'>) => {
    setQuizMistakes(prev => [{ ...mistake, timestamp: Date.now() }, ...prev]);
  };

  const addTradeMistake = (mistake: Omit<TradeMistake, 'timestamp'>) => {
    setTradeMistakes(prev => [{ ...mistake, timestamp: Date.now() }, ...prev]);
  };

  return (
    <UserContext.Provider value={{
      user, signup, logout, addCoins, spendCoins, addXp,
      completeModule, updateHoldings, incrementTrades, addBadge,
      forumPosts, addForumPost, addReply, likePost, dislikePost, deletePost,
      quizMistakes, tradeMistakes, addQuizMistake, addTradeMistake,
    }}>
      {children}
    </UserContext.Provider>
  );
};
