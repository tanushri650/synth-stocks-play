import time
import json
import re
import os
import dotenv
import asyncio
from google import genai

# Load environment variables from .env file
dotenv.load_dotenv()

class NewsEngine:
    def __init__(self, api_keys=None):
        """
        Initializes the NewsEngine by loading multiple API keys 
        and setting up the first Gemini client.
        """
        # 1. User provided keys take precedence
        if api_keys:
            self.api_keys = api_keys
        else:
            # Fallback to loading from .env
            api_keys_string = os.getenv("GEMINI_API_KEY", "")
            # Handle comma-separated list
            self.api_keys = [k.strip() for k in api_keys_string.split(",") if k.strip()]
            
            # Also check for individual keys GEMINI_API_KEY1, GEMINI_API_KEY2, etc.
            for i in range(1, 10):
                key = os.getenv(f"GEMINI_API_KEY{i}")
                if key and key not in self.api_keys:
                    self.api_keys.append(key)

        if not self.api_keys:
            print("⚠️ Warning: No GEMINI_API_KEY found in .env")
            self.api_keys = ["dummy_key"]
            
        self.current_index = 0
        
        # 2. Initialize the first client
        self._init_client()


    def _init_client(self):
        """Sets up the Gemini client with the current active key."""
        current_key = self.api_keys[self.current_index]
        print(f"--- [SYSTEM] Using Gemini API Key #{self.current_index + 1} ---")
        # Initialize using the newer Google GenAI SDK syntax
        self.client = genai.Client(api_key=current_key)

    def _switch_key(self):
        """Rotates to the next available API key in the list."""
        self.current_index = (self.current_index + 1) % len(self.api_keys)
        self._init_client()

    async def generate_news(self):
        """
        Main function to generate news. 
        Tries every available key if one hits a rate limit (429).
        """
        prompt = self._build_prompt()
        
        # We try at most as many times as we have keys
        for attempt in range(len(self.api_keys)):
            try:
                # Use to_thread to keep the event loop responsive during the network call
                response = await asyncio.to_thread(
                    self.client.models.generate_content,
                    model="gemini-2.0-flash", 
                    contents=prompt
                )

                raw_text = (response.text or "").strip()
                if not raw_text:
                    continue

                # Parse the AI response into Python objects
                parsed_data = self._safe_parse(raw_text)

                if parsed_data:
                    # Ensure we always return a list of items
                    return parsed_data if isinstance(parsed_data, list) else [parsed_data]
                
            except Exception as e:
                error_str = str(e).lower()
                
                # Check for "Too Many Requests" (429) or Quota limits
                if "429" in error_str or "quota" in error_str or "limit" in error_str:
                    print(f"!!! [LIMIT] Key #{self.current_index + 1} exhausted.", flush=True)
                    self._switch_key()
                    await asyncio.sleep(1) # Async sleep instead of time.sleep
                    continue
                else:
                    # For other errors (Internet, Auth, etc.), log and wait
                    print(f"!!! [ERROR] Unexpected: {e}", flush=True)
                    await asyncio.sleep(2)
        
        print("!!! [FATAL] All API keys are exhausted for the day.", flush=True)
        return None


    def _build_prompt(self):
        """Constructs the prompt for the Gemini model."""
        return """
Generate exactly 4 realistic financial news items about the Indian stock market.
Focus on these companies: ["TCS", "INFY", "HDFCBANK", "RELIANCE", "TATA_MOTORS"].

STRICT RULES:
- Output ONLY a valid JSON Array containing EXACTLY 4 objects.
- Each object must have: "headline", "description", and "target".
- "target" MUST be exactly one of: "TCS", "INFY", "HDFCBANK", "RELIANCE", "TATA_MOTORS".
- Provide specific, realistic details.

JSON FORMAT:
[
  {
    "headline": "Example Headline",
    "description": "Example Description",
    "target": "RELIANCE"
  }
]
"""

    def _safe_parse(self, text):
        """Attempts to parse JSON, handling common AI formatting issues."""
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # If AI wraps JSON in markdown blocks (```json ... ```), extract the middle
            match = re.search(r"\[.*\]", text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except:
                    return None
        return None

    def validate(self, data):
        """Validates that the returned news item has all required fields."""
        if not data or not isinstance(data, dict):
            return False
        
        required = ["headline", "description", "target"]
        if not all(k in data for k in required):
            return False

        valid_targets = ["TCS", "INFY", "HDFCBANK", "RELIANCE", "TATA_MOTORS"]
        if data["target"] not in valid_targets:
            # Fallback to a default target if the AI hallucinated a symbol
            data["target"] = "TCS"

        return True

# Helper function to convert news dict to your MarketEvent object
def news_to_event(news_item):
    """
    Transforms a single news dictionary into a MarketEvent instance.
    """
    # Import inside the function to prevent potential circular import issues
    from event_engine import MarketEvent
    
    return MarketEvent(
        sentiment=0.0,  # You can add logic later to calculate this
        impact=0.0,
        duration=1800,
        target=news_item.get("target", "TCS"),
        volume_spike=0.0
    )