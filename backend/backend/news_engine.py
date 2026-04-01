import time
import json
import re
import os
import dotenv
from google import genai

# Load environment variables from .env file
dotenv.load_dotenv()

class NewsEngine:
    def __init__(self):
        """
        Initializes the NewsEngine by loading multiple API keys 
        and setting up the first Gemini client.
        """
        # 1. Load keys from .env and clean them (remove spaces/newlines)
        api_keys_string = os.getenv("GEMINI_API_KEY", "")
        if not api_keys_string:
            raise ValueError("CRITICAL: GEMINI_API_KEY not found in your .env file.")
            
        # This handles 'key1, key2, key3' by stripping whitespace from each key
        self.api_keys = [k.strip() for k in api_keys_string.split(",") if k.strip()]
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

    def generate_news(self):
        """
        Main function to generate news. 
        Tries every available key if one hits a rate limit (429).
        """
        prompt = self._build_prompt()
        
        # We try at most as many times as we have keys
        for attempt in range(len(self.api_keys)):
            try:
                # API Call
                response = self.client.models.generate_content(
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
                    print(f"!!! [LIMIT] Key #{self.current_index + 1} exhausted.")
                    self._switch_key()
                    time.sleep(1) # Small buffer before retry
                    continue
                else:
                    # For other errors (Internet, Auth, etc.), log and wait
                    print(f"!!! [ERROR] Unexpected: {e}")
                    time.sleep(2)
        
        print("!!! [FATAL] All API keys are exhausted for the day.")
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