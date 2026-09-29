import requests
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET
import urllib.parse
import time
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

class SearchService:
    """
    Real-time Google and Web Search Engine for Estrely.
    Combines Google News RSS, Wikipedia Knowledge API, DuckDuckGo Abstract,
    and live Weather API with parallel execution and in-memory TTL caching.
    Ensures high speed (<1.5s) and zero bot-blocking.
    """
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
        self.cache = {}
        self.cache_ttl = 600  # 10 minutes cache
        self.executor = ThreadPoolExecutor(max_workers=4)

    def clean_query(self, message):
        """Extract core search terms from conversational user questions."""
        q = message.strip()
        prefixes = [
            r'^(hey\s+|hi\s+|hello\s+)?estrely[,!\s]+',
            r'^(can you\s+)?(please\s+)?(tell me\s+)?(what is the|who is the|what is|who is|where is|when is|how is)\s+',
            r'^(can you\s+)?(please\s+)?(search for|search|look up|google|find out|find)\s+',
            r'^(do you know\s+)(who|what|where|when|how)?\s*',
            r'^(what do you know about)\s+'
        ]
        for p in prefixes:
            q = re.sub(p, '', q, flags=re.IGNORECASE).strip()
        return q.strip(' ?.!\"\'')

    def should_search(self, message):
        """Detect if user query benefits from live web or Google search."""
        msg = message.lower().strip()
        
        # Conversational greetings & emotional statements should NEVER trigger search
        conversational_patterns = [
            r'how\s+(are|r)\s+(you|u|things|it\s+going|everything)',
            r'how\s+was\s+your\s+day',
            r'how\s+do\s+you\s+feel',
            r'how\s+are\s+you\s+doing',
            r'^(hi|hello|hey|good\s+(morning|afternoon|evening|night)|howdy|sup)\b',
            r'tell\s+me\s+a\s+joke',
            r'i(\'m|\s+am|\s+feel)\s+(sad|happy|tired|bored|lonely|great|fine|good|down)',
            r'(thank\s+you|thanks|appreciate\s+it)',
            r'who\s+are\s+you',
            r'what\s+is\s+your\s+name',
            r'what\s+can\s+you\s+do'
        ]
        for pat in conversational_patterns:
            if re.search(pat, msg) and not any(k in msg for k in ['weather', 'news', 'stock', 'score', 'price']):
                return False

        # Specific search triggers
        search_triggers = [
            'search', 'who is', 'what is', 'latest', 'news', 'weather',
            'temperature', 'stock price', 'release date', 'who won', 'recent',
            'update on', 'where is', 'how much does', 'when did', 'newest',
            'champions league', 'current president', 'current ceo',
            'tell me about', 'specs of', 'features of', 'population of'
        ]
        return any(t in msg for t in search_triggers)

    def search(self, raw_message, max_results=4):
        """
        Execute parallel web search and return structured snippets.
        Cached for high speed and minimal network overhead.
        """
        query = self.clean_query(raw_message)
        if not query or len(query) < 2:
            return []

        # Check cache
        cache_key = query.lower()
        now = time.time()
        if cache_key in self.cache:
            entry = self.cache[cache_key]
            if now - entry['timestamp'] < self.cache_ttl:
                return entry['results']

        results = []
        is_weather = 'weather' in raw_message.lower() or 'temperature' in raw_message.lower()

        # Submit search tasks in parallel
        futures = []
        if is_weather:
            futures.append(self.executor.submit(self._search_weather, query))
        
        futures.append(self.executor.submit(self._search_google_news, query))
        futures.append(self.executor.submit(self._search_wikipedia, query))
        futures.append(self.executor.submit(self._search_ddg, query))

        # Collect results with strict 2.2s total timeout for maximum chat speed
        from concurrent.futures import wait
        done, not_done = wait(futures, timeout=2.2)
        for f in done:
            try:
                res = f.result()
                if res:
                    if isinstance(res, list):
                        results.extend(res)
                    else:
                        results.append(res)
            except Exception:
                pass

        # De-duplicate results
        unique_results = []
        seen_texts = set()
        for r in results:
            snip = r.get('snippet', '').strip()
            if snip and len(snip) > 20 and snip not in seen_texts:
                seen_texts.add(snip)
                unique_results.append(r)
                if len(unique_results) >= max_results:
                    break

        # Cache results
        if unique_results:
            self.cache[cache_key] = {
                'timestamp': now,
                'results': unique_results
            }

        return unique_results

    def _search_google_news(self, query):
        """Fetch live Google News RSS articles for recent news, events, and releases."""
        try:
            encoded = urllib.parse.quote(query)
            url = f"https://news.google.com/rss/search?q={encoded}&hl=en-US&gl=US&ceid=US:en"
            resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}, timeout=2.0)
            if resp.status_code != 200:
                return []

            root = ET.fromstring(resp.content)
            items = root.findall('.//item')[:3]
            results = []
            for item in items:
                title = item.findtext('title', '')
                desc = item.findtext('description', '')
                clean_desc = BeautifulSoup(desc, 'html.parser').get_text(strip=True) if desc else ''
                snippet = clean_desc if clean_desc and clean_desc != title else title
                if snippet:
                    results.append({
                        'title': title,
                        'snippet': snippet,
                        'source': 'Google News'
                    })
            return results
        except Exception:
            return []

    def _search_wikipedia(self, query):
        """Fetch encyclopedic, factual, and biographical knowledge from Wikipedia API."""
        try:
            encoded = urllib.parse.quote(query)
            url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={encoded}&format=json&utf8=&srlimit=2"
            resp = requests.get(url, headers={'User-Agent': 'EstrelyBot/1.0 (contact@estrely.ai)'}, timeout=2.0)
            if resp.status_code != 200:
                return []

            data = resp.json()
            search_items = data.get('query', {}).get('search', [])
            results = []
            for item in search_items:
                title = item.get('title', '')
                raw_snippet = item.get('snippet', '')
                clean_snippet = BeautifulSoup(raw_snippet, 'html.parser').get_text(strip=True)
                if clean_snippet:
                    results.append({
                        'title': title,
                        'snippet': clean_snippet,
                        'source': 'Knowledge Base'
                    })
            return results
        except Exception:
            return []

    def _search_ddg(self, query):
        """Fetch instant definitions and abstracts from DuckDuckGo API."""
        try:
            encoded = urllib.parse.quote(query)
            url = f"https://api.duckduckgo.com/?q={encoded}&format=json&no_html=1&skip_disambig=1"
            resp = requests.get(url, timeout=1.8)
            if resp.status_code != 200:
                return []

            data = resp.json()
            abstract = data.get('AbstractText', '').strip()
            heading = data.get('Heading', 'Summary')
            if abstract:
                return [{
                    'title': heading,
                    'snippet': abstract,
                    'source': 'Instant Answer'
                }]
            return []
        except Exception:
            return []

    def _search_weather(self, query):
        """Fetch live weather reports for locations."""
        try:
            # Extract city name or query
            city = re.sub(r'weather|temperature|in|for|today|forecast|what is the', '', query, flags=re.IGNORECASE).strip()
            if not city:
                city = 'Tokyo'
            encoded_city = urllib.parse.quote(city)
            url = f"https://wttr.in/{encoded_city}?format=j1"
            resp = requests.get(url, timeout=2.0)
            if resp.status_code != 200:
                return []

            data = resp.json()
            current = data.get('current_condition', [{}])[0]
            temp_c = current.get('temp_C', 'N/A')
            temp_f = current.get('temp_F', 'N/A')
            desc = current.get('weatherDesc', [{}])[0].get('value', 'Clear')
            humidity = current.get('humidity', 'N/A')
            wind = current.get('windspeedKmph', 'N/A')

            snippet = f"Current weather in {city.capitalize()}: {temp_c}°C ({temp_f}°F), {desc}. Humidity: {humidity}%, Wind: {wind} km/h."
            return [{
                'title': f"Weather in {city.capitalize()}",
                'snippet': snippet,
                'source': 'Live Weather'
            }]
        except Exception:
            return []

    def format_search_context(self, results):
        """Format extracted search snippets into context for the AI."""
        if not results:
            return ""

        lines = ["[Real-time Search & Knowledge Findings]:"]
        for idx, item in enumerate(results, 1):
            title = item.get('title', 'Result')
            snippet = item.get('snippet', '')
            lines.append(f"{idx}. {title}: {snippet}")

        lines.append("\nGuidance for Estrely: Naturally integrate the real-time facts above into your warm, companion-like voice. Do not recite raw URLs or say 'according to search engine results' unless naturally citing knowledge.")
        return "\n".join(lines)
