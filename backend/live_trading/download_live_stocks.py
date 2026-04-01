import yfinance as yf
import os
import pandas as pd
from datetime import datetime, timedelta

def download_stocks():
    # symbols used in NSE (India)
    stocks = {
        "TCS": "TCS.NS",
        "HDFCBANK": "HDFCBANK.NS",
        "TATA_MOTORS": "TATAMOTORS.NS",
        "INFOSYS": "INFY.NS",
        "RELIANCE": "RELIANCE.NS"
    }

    # Ensure output directory exists
    output_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(output_dir, "data")
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)

    print(f"🚀 Starting download for {len(stocks)} stocks...")

    for name, ticker in stocks.items():
        print(f"📥 Downloading {name} ({ticker})...")
        try:
            # Download 1-minute interval data (max 7 days from yfinance)
            # This is ideal for your 'Live' simulation logic.
            data = yf.download(
                tickers=ticker,
                period="7d",
                interval="1m",
                progress=False
            )

            if not data.empty:
                # Standardize format for your CSV loader
                # Date, Close, High, Low, Open, Volume
                file_path = os.path.join(data_dir, f"{name}.csv")
                data.to_csv(file_path)
                print(f"✅ Saved to: {file_path}")
            else:
                print(f"⚠️ No data found for {ticker}")

        except Exception as e:
            print(f"❌ Error downloading {name}: {e}")

    print("\n🎉 Download process complete.")

if __name__ == "__main__":
    download_stocks()
