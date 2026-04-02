print("DEBUG: server.py execution started")
from fastapi import FastAPI, WebSocket

import asyncio
import json
import time
import os
import sys
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
from collections import defaultdict
import pandas as pd

# -------- LOAD ENV & PATHS --------
# server.py is in backend/backend/
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.dirname(CURRENT_DIR) # backend/

if BACKEND_ROOT not in sys.path:
    sys.path.append(BACKEND_ROOT)
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

print("DEBUG: Loading environment...", flush=True)
load_dotenv(os.path.join(BACKEND_ROOT, ".env"))

# Load keys from GEMINI_API_KEY (comma-separated) or GEMINI_API_KEY1, GEMINI_API_KEY2 etc.
API_KEYS = []
raw_keys = os.getenv("GEMINI_API_KEY", "")
if raw_keys:
    API_KEYS = [k.strip() for k in raw_keys.split(",") if k.strip()]

for i in range(1, 10):
    val = os.getenv(f"GEMINI_API_KEY{i}")
    if val and val not in API_KEYS:
        API_KEYS.append(val)

if not API_KEYS:
    print("⚠️ Warning: No GEMINI_API_KEY found in .env")
    API_KEYS = ["dummy_key"]


# -------- IMPORT YOUR SYSTEM --------
from market_engine import MarketEngine
from candle_engine import CandleEngine
from event_engine import EventEngine
from news_engine import NewsEngine, news_to_event
from state import state
from csv_loader import load_csv_history
from analytics.pattern_engine import PatternEngine
from analytics.risk_engine import RiskEngine

# -------- INITIALIZE SYSTEM --------
try:
    print("DEBUG: Initializing engines...", flush=True)
    event_engine = EventEngine(state.sector_map)
    engine = MarketEngine(state, event_engine)
    candle_engine = CandleEngine()
    news_engine = NewsEngine(API_KEYS)
    pattern_engine = PatternEngine()
    risk_engine = RiskEngine()
    clients = []
except Exception as e:
    print(f"❌ CRITICAL INITIALIZATION ERROR: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)


# -------- BROADCAST FUNCTION --------
async def broadcast(data):
    for client in clients:
        try:
            await client.send_text(json.dumps(data))
        except:
            pass 


# -------- LIFESPAN AND SIMULATION LOOP --------
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("📊 STEP 2: Loading CSV datasets...", flush=True)
    try:
        load_csv_history()
        print("✅ CSV Datasets Loaded.", flush=True)
    except Exception as e:
        print(f"❌ Error loading CSVs: {e}", flush=True)

    async def loop():
        try:
            # STEP 1: INITIAL NEWS GENERATION
            print("🚀 STEP 1: Generating Initial Market News...", flush=True)
            try:
                # Use await because news_engine.generate_news is now async
                initial_news = await news_engine.generate_news()
                if initial_news:
                    valid_news = []
                    for news in initial_news[:4]:
                        if news_engine.validate(news):
                            event = news_to_event(news)
                            event_engine.add_event(event)
                            valid_news.append({
                                "headline": news["headline"],
                                "description": news["description"],
                                "target": news["target"]
                            })
                    if valid_news:
                        state.current_news = valid_news
                        await broadcast({"type": "news_batch", "news": valid_news, "time": time.time()})
                        print(f"✅ News Broadcasted: {len(valid_news)} items.", flush=True)
            except Exception as e:
                print(f"⚠️ News Generator Error: {e}", flush=True)
            
            last_news_time = time.time()
            tick_counter = 0
            tick_buffers = defaultdict(list)

            print("📈 STEP 4/5: Starting Live Simulation Loop...", flush=True)
            while True:
                # -------- TICK UPDATE (Every 1s) --------
                for stock in ["TCS", "INFY", "HDFCBANK", "MARUTI"]:
                    tick = engine.get_streaming_tick(stock)
                    if tick:
                        tick_buffers[stock].append(tick)
                        await broadcast({
                            "type": "tick",
                            "stock": stock,
                            "price": tick["price"],
                            "time": tick["time"]
                        })
                        
                        pattern = pattern_engine.detect(stock)
                        risk_reward = risk_engine.get_ratio(stock)
                        await broadcast({
                            "type": "analytics",
                            "stock": stock,
                            "pattern": pattern,
                            "riskReward": risk_reward,
                            "time": tick["time"]
                        })

                # -------- CANDLE UPDATE (Every 5s) --------
                tick_counter += 1
                if tick_counter >= 5:
                    for stock in ["TCS", "INFY", "HDFCBANK", "MARUTI"]:
                        candle = engine.aggregate_candle(stock, tick_buffers[stock])
                        if candle:
                            await broadcast({
                                "type": "candle",
                                "stock": stock,
                                "open": candle["open"],
                                "high": candle["high"],
                                "low": candle["low"],
                                "close": candle["close"],
                                "volume": candle["volume"],
                                "time": candle["time"]
                            })
                    tick_buffers = defaultdict(list)
                    tick_counter = 0

                # -------- PERIODIC NEWS (Every 10 mins) --------
                current_time = time.time()
                if current_time - last_news_time > 600:
                    new_news = await news_engine.generate_news()
                    if new_news:
                        valid_news = []
                        for news in new_news[:4]:
                            if news_engine.validate(news):
                                event = news_to_event(news)
                                event_engine.add_event(event)
                                valid_news.append({
                                    "headline": news["headline"],
                                    "description": news["description"],
                                    "target": news["target"]
                                })
                        if valid_news:
                            state.current_news = valid_news
                            await broadcast({"type": "news_batch", "news": valid_news, "time": current_time})
                    last_news_time = current_time

                event_engine.cleanup()
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            print("🛑 Server Loop Cancelled.", flush=True)
            raise
        except Exception as e:
            print(f"❌ Unhandled Simulation Error: {e}", flush=True)

    task = asyncio.create_task(loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


# -------- APP INIT --------
app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import time

# -------- LIVE TRADING DATA API --------
@app.get("/api/live-trading/data/{symbol}")
async def get_live_trading_data(symbol: str):
    # Map symbols to CSV filenames
    mapping = {
        "TCS": "TCS.csv",
        "INFOSYS": "INFOSYS.csv",
        "HDFCBANK": "HDFCBANK.csv",
        "RELIANCE": "RELIANCE.csv",
        "TATA_MOTORS": "TATA_MOTORS.csv"
    }
    
    filename = mapping.get(symbol.upper())
    if not filename:
        return {"error": f"Invalid symbol: {symbol}"}

    current_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(os.path.dirname(current_dir), "live_trading", "data", filename)

    if not os.path.exists(data_path):
        return {"error": f"Data file not found: {filename}"}

    try:
        # yfinance CSVs have 3 header rows. 
        df = pd.read_csv(data_path, skiprows=3, names=['Datetime', 'Close', 'High', 'Low', 'Open', 'Volume'])
        
        # --- SYNTHESIZED TIME LOGIC ---
        # Requirement: Ignore CSV timestamps. 
        # Last point = Current Time.
        # Spacing = Exactly 1 second per point.
        now = int(time.time())
        num_points = len(df)
        
        # Generate strictly increasing 1-second intervals ending at 'now'
        # Formula: time_at_index_i = now - (last_index - i)
        synthesized_times = [now - (num_points - 1 - i) for i in range(num_points)]
        
        # Format for frontend
        data = []
        for i, (_, row) in enumerate(df.iterrows()):
            data.append({
                "time": synthesized_times[i],
                "open": float(row['Open']),
                "high": float(row['High']),
                "low": float(row['Low']),
                "close": float(row['Close']),
                "volume": int(row['Volume'])
            })
        
        return {"symbol": symbol, "data": data}
    except Exception as e:
        print(f"❌ Error parsing {filename}: {e}")
        return {"error": str(e)}


# -------- WEBSOCKET ENDPOINT --------
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.append(ws)

    for stock in ["TCS", "INFY", "HDFCBANK", "MARUTI"]:
        if state.candle_data[stock]:
            await ws.send_text(json.dumps({
                "type": "history",
                "stock": stock,
                "data": state.candle_data[stock]
            }))
    
    if state.current_news:
        await ws.send_text(json.dumps({
            "type": "news_batch",
            "news": state.current_news,
            "time": time.time()
        }))

    try:
        while True:
            await asyncio.sleep(1)
    except:
        if ws in clients:
            clients.remove(ws)


# -------- ENTRY POINT --------
if __name__ == "__main__":
    # Render assigns a port via the PORT environment variable.
    # Default to 8080 for local development.
    port = int(os.getenv("PORT", 10000 if os.getenv("RENDER") else 8080))
    print(f"🚀 Starting server on port {port}...", flush=True)
    
    # Use the app instance directly if possible, or uvicorn.run("server:app")
    # For local dev with reload=True, the string approach is better.
    try:
        uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
    except KeyboardInterrupt:
        print("\n👋 Server stopped manually.", flush=True)
    except Exception as e:
        print(f"❌ Server Runtime Error: {e}", flush=True)