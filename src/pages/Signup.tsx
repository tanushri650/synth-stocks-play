import { useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const Signup = () => {
  const { user, signup } = useUser();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');

  if (user) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().length < 2) return;
    signup(username.trim());
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-grid scanline">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-cyber max-w-md w-full mx-4"
      >
        <h1 className="font-display text-3xl tracking-widest text-center mb-2 text-primary text-glow-cyan">
          STOCK<span className="text-secondary">Z</span>
        </h1>
        <p className="text-center text-muted-foreground text-sm mb-8 font-mono">
          Virtual Trading Academy
        </p>

        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <label className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-wider">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-muted border border-border rounded-md px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              placeholder="Enter your callsign..."
              minLength={2}
              required
            />
          </div>
          <button type="submit" className="w-full btn-cyber-primary">
            Initialize Account
          </button>
          <p className="text-center text-xs text-muted-foreground font-mono">
            Start with <span className="text-primary">0</span> coins — earn them through modules & trading!
          </p>
        </form>
      </motion.div>
    </div>
  );
};

export default Signup;
