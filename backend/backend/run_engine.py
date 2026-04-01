import sys
import os
import time
from dotenv import load_dotenv

# Load environment variables (API keys, etc.)
load_dotenv()

# Ensure the system can find your project modules
sys.path.append("D:/stocksimulator")

# Module Imports
from market_engine import MarketEngine
from candle_engine import CandleEngine
from state import state
from analytics.risk_engine import RiskEngine
from analytics.pattern_engine import PatternEngine
from event_engine import EventEngine
from news_engine import NewsEngine, news_to_event
from csv_loader import load_csv_history

# -------- INIT SYSTEM --------
# Pass sector_map from state to the EventEngine
event_engine = EventEngine(state.sector_map)

engine = MarketEngine(state, event_engine)
candle_engine = CandleEngine()

risk_engine = RiskEngine()
pattern_engine = PatternEngine()

# ✅ FIX: NewsEngine() now handles its own keys from .env. 
# No need to pass 'API_KEYS' here.
news_engine = NewsEngine()

# Initialize historical data
load_csv_history()

# -------- RATE CONTROL --------
last_news_time = 0
# ✅ UPDATED: Setting this to 20 seconds as per your requirement
NEWS_INTERVAL = 20  


# -------- MAIN LOOP --------
print("--- [STARTING] Stock Simulator Run Engine ---")

while True:
    # -------- STEP 1: MARKET UPDATE --------
    # Generates a price tick and updates candles
    engine.generate_tick(candle_engine)

    # -------- STEP 2: EVENT CLEANUP --------
    event_engine.cleanup()

    # -------- CONSOLE SNAPSHOT (Optional: Clear screen for cleaner UI) --------
    # os.system('cls' if os.name == 'nt' else 'clear') 
    
    print(f"\n========== MARKET SNAPSHOT [{time.strftime('%H:%M:%S')}] ==========")

    print("\nLive Prices:")
    for stock, price in state.stock_prices.items():
        print(f"{stock:12}: {round(price, 2)}")

    if state.tick_data:
        last = state.tick_data[-1]
        print(f"\nLatest Tick: {last['stock']} | Volume: {last['volume']}")

    print("\nAnalytics & Patterns:")
    for stock in state.stock_prices:
        ratio = risk_engine.get_ratio(stock)
        pattern = pattern_engine.detect(stock)
        print(f"{stock:12} | Risk: {round(ratio, 4):<8} | Pattern: {pattern}")

    print(f"\nActive Events: {len(event_engine.active_events)}")

    # -------- STEP 3: AI NEWS GENERATION --------
    current_time = time.time()

    if current_time - last_news_time > NEWS_INTERVAL:
        print("\n🧠 [AI] Generating News Items...")

        # This calls your new rotation logic internally
        news_list = news_engine.generate_news()

        if news_list and isinstance(news_list, list):
            for i, news in enumerate(news_list[:4]):
                if news_engine.validate(news):
                    print(f"📰 NEWS {i+1}: {news['headline']}")
                    
                    # Convert dict to MarketEvent and inject into the engine
                    event = news_to_event(news)
                    event_engine.add_event(event)
                else:
                    print(f"⚠️ Invalid news structure received for item {i+1}")
        else:
            print("⚠️ News generation skipped (Possible limit reached or empty response)")

        last_news_time = time.time()

    # -------- LOOP DELAY --------
    # Tick speed (1 second per tick)
    time.sleep(1)