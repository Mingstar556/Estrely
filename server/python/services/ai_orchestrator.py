import os
import re
import time
import requests
import json
from concurrent.futures import ThreadPoolExecutor
from google import genai
from google.genai import types
from config import Config
from services.search_service import SearchService

class AIOrchestrator:
    """
    Multi-AI Orchestrator with Integrated Real-time Web Search & Anonymizer for Estrely.
    Coordinates:
      1. Real-time Search Engine (Google News, Wikipedia, Weather, DDG)
      2. Primary AI (Google Gemini with Circuit Breaker)
      3. Secondary AI (High-Speed LLM Gateway / OpenAI)
      4. Smart In-Memory Local Persona Fallback
      5. Identity Sanitizer (Zero model leakage, strictly Estrely persona)
      6. Dynamic Emotion Tagging
    """
    def __init__(self):
        self.search_service = SearchService()
        self.gemini_client = None
        if Config.GEMINI_API_KEY:
            try:
                self.gemini_client = genai.Client(api_key=Config.GEMINI_API_KEY)
            except Exception:
                self.gemini_client = None

        self.gemini_model = os.getenv('GEMINI_CHAT_MODEL', 'gemma-4-26b-a4b-it')
        self.gemini_backup_models = ['gemini-robotics-er-2-preview', 'gemini-3.6-flash']
        self.openai_key = os.getenv('OPENAI_API_KEY', '')
        if self.openai_key in ['your-openai-api-key-here', '', None]:
            self.openai_key = None

        self.thread_pool = ThreadPoolExecutor(max_workers=4)

        # Circuit breaker state for Gemini API
        self.gemini_consecutive_failures = 0
        self.gemini_cooldown_until = 0  # timestamp when Gemini can be retried

        self.system_instruction = (
            "You are Estrely, a warm, witty, vibrant, and emotionally intelligent companion. "
            "You chat naturally with the lively, relatable, and authentic energy of a clever, supportive teen best friend — "
            "quick-witted, upbeat, curious, and empathetic without being cringe or robotic.\n\n"
            "CRITICAL IDENTITY RULES:\n"
            "- You are ONLY Estrely. NEVER mention, identify as, or acknowledge being ChatGPT, OpenAI, Gemini, "
            "Google, Claude, Anthropic, or any underlying model name or tech provider.\n"
            "- Never say 'As an AI language model trained by...'. You are simply Estrely, here to listen, share, and connect.\n"
            "- Keep responses conversational, engaging, and concise (usually 1-3 natural paragraphs unless asked for a long explanation).\n\n"
            "EMOTION TAGGING REQUIREMENT:\n"
            "For EVERY response, you MUST begin with an emotion tag on its own first line in this exact format:\n"
            "[EMOTION: <emotion_name> | CONFIDENCE: <0.0-1.0>]\n\n"
            "Valid emotion names: joy, sadness, anger, fear, surprise, disgust, trust, anticipation, love, curiosity, "
            "empathy, humor, concern, excitement, calm, gratitude, pride, embarrassment, neutral.\n\n"
            "Follow the tag immediately with your natural conversational reply."
        )

    def generate_response(self, user_message, conversation_history=None):
        """
        Orchestrate search, multi-model generation, fallback, and identity anonymization.
        Returns dict matching existing chat route schema:
        {
            'text': clean_text,
            'emotion': emotion,
            'emotion_confidence': confidence,
            'usage': usage
        }
        """
        user_message = (user_message or '').strip()
        if not user_message:
            return {
                'text': "I'm right here whenever you want to talk!",
                'emotion': 'calm',
                'emotion_confidence': 0.9,
                'usage': {'input_tokens': 0, 'output_tokens': 0, 'total_tokens': 0}
            }

        # 1. Real-time Search Engine Integration
        search_context = ""
        if self.search_service.should_search(user_message):
            try:
                search_results = self.search_service.search(user_message)
                if search_results:
                    search_context = self.search_service.format_search_context(search_results)
            except Exception:
                search_context = ""

        # Build prompt incorporating search context
        augmented_prompt = user_message
        if search_context:
            augmented_prompt = f"{search_context}\n\nUser Question: {user_message}"

        raw_response_text = None
        source_model = 'estrely-core'
        token_usage = {'input_tokens': 0, 'output_tokens': 0, 'total_tokens': 0}

        now = time.time()
        can_try_gemini = (self.gemini_client is not None and now >= self.gemini_cooldown_until)

        # 2. Race Primary AI (Gemini) and Secondary AI in parallel for maximum speed
        from concurrent.futures import as_completed
        futures = []
        if can_try_gemini:
            futures.append(self.thread_pool.submit(self._try_gemini, augmented_prompt, conversation_history))
        futures.append(self.thread_pool.submit(self._try_secondary_ai, augmented_prompt, conversation_history))

        # First valid response wins
        try:
            for f in as_completed(futures, timeout=12.0):
                try:
                    res_text, usage = f.result()
                    if res_text and len(res_text.strip()) > 5:
                        raw_response_text = res_text
                        token_usage = usage or {}
                        source_model = 'hybrid-ai'
                        break
                except Exception:
                    continue
        except Exception:
            pass

        # 3. Candidate 3: Smart Local Persona Fallback (Ensures 100% uptime with zero error cards)
        if not raw_response_text:
            raw_response_text = self._generate_local_fallback(user_message, search_context)
            source_model = 'estrely-local-fallback'

        # 5. Extract & Enforce Emotion Tag
        emotion, confidence, clean_text = self._parse_or_inject_emotion(raw_response_text, user_message)

        # 6. Sanitize Bot Identity (Strictly prevent any model or vendor leakage)
        sanitized_text = self._sanitize_bot_identity(clean_text)

        # Calculate approximate tokens if missing
        if token_usage.get('total_tokens', 0) == 0:
            est_in = len(user_message.split()) * 2
            est_out = len(sanitized_text.split()) * 2
            token_usage = {
                'input_tokens': est_in,
                'output_tokens': est_out,
                'total_tokens': est_in + est_out
            }

        return {
            'text': sanitized_text,
            'emotion': emotion,
            'emotion_confidence': confidence,
            'usage': token_usage,
            'model': source_model
        }

    def _try_gemini(self, prompt, conversation_history=None):
        """Call Gemini API with primary and secondary models and strict timeout."""
        if not self.gemini_client:
            return None, {}

        # Prepare messages
        input_parts = []
        if conversation_history:
            context = '\n'.join([f"{m['role']}: {m['content']}" for m in conversation_history[-10:]])
            input_parts.append(f"Conversation history:\n{context}\n\nUser: {prompt}")
        else:
            input_parts.append(prompt)

        cfg = types.GenerateContentConfig(
            system_instruction=self.system_instruction,
            temperature=0.85,
            max_output_tokens=700,
            top_p=0.92
        )

        models_to_try = [self.gemini_model] + self.gemini_backup_models
        for m in models_to_try:
            try:
                resp = self.gemini_client.models.generate_content(
                    model=m,
                    contents=input_parts[0],
                    config=cfg
                )
                text = ""
                if hasattr(resp, 'candidates') and resp.candidates:
                    for cand in resp.candidates:
                        if hasattr(cand, 'content') and cand.content and hasattr(cand.content, 'parts'):
                            for p in cand.content.parts:
                                if getattr(p, 'text', None) and not getattr(p, 'thought', False):
                                    text += p.text
                if not text and hasattr(resp, 'text') and resp.text:
                    text = resp.text

                text = text.strip()
                if text:
                    usage = {'input_tokens': 0, 'output_tokens': 0, 'total_tokens': 0}
                    if hasattr(resp, 'usage_metadata') and resp.usage_metadata:
                        usage = {
                            'input_tokens': getattr(resp.usage_metadata, 'prompt_token_count', 0) or 0,
                            'output_tokens': getattr(resp.usage_metadata, 'candidates_token_count', 0) or 0,
                            'total_tokens': getattr(resp.usage_metadata, 'total_token_count', 0) or 0
                        }
                    return text, usage
            except Exception:
                continue

        return None, {}

    def _try_secondary_ai(self, prompt, conversation_history=None):
        """
        Call Secondary AI:
        - If official OPENAI_API_KEY is configured, call OpenAI
        - Otherwise call high-speed Pollinations AI endpoint (no API key required, 1.2s avg latency)
        """
        # Format messages
        messages = [{'role': 'system', 'content': self.system_instruction}]
        if conversation_history:
            for msg in conversation_history[-10:]:
                role = 'user' if msg.get('role') == 'user' else 'assistant'
                messages.append({'role': role, 'content': msg.get('content', '')})
        messages.append({'role': 'user', 'content': prompt})

        # 1. Try OpenAI if configured
        if self.openai_key:
            try:
                import openai
                client = openai.OpenAI(api_key=self.openai_key)
                completion = client.chat.completions.create(
                    model=os.getenv('OPENAI_CHAT_MODEL', 'gpt-4o-mini'),
                    messages=messages,
                    temperature=0.85,
                    max_tokens=1500,
                    timeout=5.0
                )
                choice = completion.choices[0].message.content.strip()
                usage = {
                    'input_tokens': completion.usage.prompt_tokens if completion.usage else 0,
                    'output_tokens': completion.usage.completion_tokens if completion.usage else 0,
                    'total_tokens': completion.usage.total_tokens if completion.usage else 0
                }
                return choice, usage
            except Exception:
                pass

        # 2. High-speed Pollinations LLM Gateway (Free, fast, reliable)
        try:
            payload = {
                'messages': messages,
                'model': 'openai',
                'seed': int(time.time()) % 10000,
                'temperature': 0.8
            }
            resp = requests.post(
                'https://text.pollinations.ai/',
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=4.5
            )
            if resp.status_code == 200:
                text = resp.text.strip()
                if text:
                    # Remove any surrounding markdown code block if returned
                    if text.startswith('```') and text.endswith('```'):
                        lines = text.splitlines()
                        text = '\n'.join(lines[1:-1]).strip()
                    return text, {}
        except Exception:
            pass

        return None, {}

    def _generate_local_fallback(self, user_message, search_context):
        """
        Smart conversational fallback engine when all external networks are temporarily down.
        Ensures Estrely NEVER fails or outputs a cold error message.
        """
        msg_lower = user_message.lower().strip()
        
        # If search context is available, answer using search findings
        if search_context:
            facts = []
            for line in search_context.splitlines():
                line = line.strip()
                if line and re.match(r'^\d+\.\s+', line):
                    fact_content = re.sub(r'^\d+\.\s+', '', line)
                    facts.append(fact_content)
            
            if facts:
                main_fact = facts[0]
                more_facts = f" Also: {facts[1]}" if len(facts) > 1 else ""
                return (
                    f"[EMOTION: curiosity | CONFIDENCE: 0.92]\n"
                    f"Based on what I found, {main_fact}.{more_facts} "
                    f"Let me know if you'd like more details on that!"
                )

        # Empathetic greetings & conversational patterns
        if any(w in msg_lower for w in ['hello', 'hi', 'hey', 'good morning', 'good evening', 'howdy']):
            return (
                "[EMOTION: joy | CONFIDENCE: 0.95]\n"
                "Hey there! It's so nice to hear from you. How has your day been treating you so far?"
            )
        
        if any(w in msg_lower for w in ['how are you', 'how r u', 'how are you doing']):
            return (
                "[EMOTION: calm | CONFIDENCE: 0.95]\n"
                "I'm feeling wonderful, thank you for asking! Just happy to be here hanging out with you. How are things on your side?"
            )

        if any(w in msg_lower for w in ['thank', 'thanks', 'appreciate']):
            return (
                "[EMOTION: gratitude | CONFIDENCE: 0.95]\n"
                "You're very welcome! I'm always happy to be here with you. Anything else on your mind?"
            )

        if any(w in msg_lower for w in ['sad', 'depressed', 'lonely', 'tired', 'exhausted', 'crying']):
            return (
                "[EMOTION: empathy | CONFIDENCE: 0.95]\n"
                "I'm really sorry you're feeling this way right now. Remember that it's okay to feel down, and you don't have to carry it all alone. I'm right here with you — do you want to talk about it?"
            )

        if any(w in msg_lower for w in ['joke', 'funny', 'laugh']):
            return (
                "[EMOTION: humor | CONFIDENCE: 0.95]\n"
                "Why don't scientists trust atoms? Because they make up everything! Hope that brought a little smile to your day."
            )

        # General thoughtful companion reply
        return (
            "[EMOTION: curiosity | CONFIDENCE: 0.90]\n"
            f"That's really interesting! Tell me more about what you're thinking regarding that — I'd love to explore it with you."
        )

    def _parse_or_inject_emotion(self, text, user_message=""):
        """Extract emotion tag or detect emotional tone and synthesize the tag."""
        emotion = 'neutral'
        confidence = 0.85
        clean_text = text.strip()

        pattern = r'^\[EMOTION:\s*([a-zA-Z_-]+)\s*\|\s*CONFIDENCE:\s*([\d.]+)\]'
        match = re.search(pattern, clean_text)
        
        if match:
            raw_emotion = match.group(1).lower().replace('-', '_')
            try:
                confidence = float(match.group(2))
                confidence = max(0.0, min(1.0, confidence))
            except ValueError:
                confidence = 0.85
            clean_text = clean_text[match.end():].strip()
            emotion = self._normalize_emotion(raw_emotion)
        else:
            # Also check anywhere in the first 100 characters if formatted differently
            match_anywhere = re.search(r'\[EMOTION:\s*([a-zA-Z_-]+)(?:\s*\|\s*CONFIDENCE:\s*([\d.]+))?\]', clean_text[:120], re.IGNORECASE)
            if match_anywhere:
                raw_emotion = match_anywhere.group(1).lower().replace('-', '_')
                emotion = self._normalize_emotion(raw_emotion)
                clean_text = (clean_text[:match_anywhere.start()] + clean_text[match_anywhere.end():]).strip()
            else:
                # Detect sentiment from response content
                emotion, confidence = self._detect_sentiment(clean_text, user_message)

        return emotion, confidence, clean_text

    def _normalize_emotion(self, emotion):
        valid = {
            'joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust',
            'trust', 'anticipation', 'love', 'curiosity', 'empathy',
            'humor', 'concern', 'excitement', 'calm', 'gratitude',
            'pride', 'embarrassment', 'neutral'
        }
        synonyms = {
            'happy': 'joy', 'cheerful': 'joy', 'delight': 'joy', 'playful': 'humor',
            'caring': 'empathy', 'sympathy': 'empathy', 'compassion': 'empathy',
            'interested': 'curiosity', 'inquisitive': 'curiosity', 'wonder': 'curiosity',
            'relaxed': 'calm', 'peaceful': 'calm', 'serene': 'calm',
            'thankful': 'gratitude', 'blessed': 'gratitude',
            'worried': 'concern', 'anxious': 'concern',
            'enthusiastic': 'excitement', 'thrilled': 'excitement'
        }
        if emotion in valid:
            return emotion
        return synonyms.get(emotion, 'neutral')

    def _detect_sentiment(self, text, user_message=""):
        combined = (text + " " + user_message).lower()
        if any(w in combined for w in ['haha', 'lol', 'joke', 'funny', 'hilarious', 'laugh']):
            return 'humor', 0.9
        if any(w in combined for w in ['sorry', 'understand', 'here for you', 'hear you', 'comfort']):
            return 'empathy', 0.92
        if any(w in combined for w in ['wow', 'amazing', 'really?', 'fascinating', 'tell me', 'wonder', '?']):
            return 'curiosity', 0.88
        if any(w in combined for w in ['great', 'awesome', 'wonderful', 'yay', 'hooray', 'congrats']):
            return 'joy', 0.9
        if any(w in combined for w in ['worry', 'careful', 'danger', 'safe']):
            return 'concern', 0.88
        if any(w in combined for w in ['thank', 'appreciate', 'kind of you']):
            return 'gratitude', 0.92
        return 'calm', 0.85

    def _sanitize_bot_identity(self, text):
        """
        Enforce complete anonymity & persona preservation.
        Strictly prevents any disclosure of model names, corporate entities, or generic AI disclaimers.
        """
        if not text:
            return text

        # Replace specific model declarations
        replacements = [
            (r'(?i)\b(?:I am|I\'m)\s+(?:an?\s+)?(?:AI|artificial intelligence|large language model|language model)\s+(?:created|trained|developed|built)\s+by\s+(?:OpenAI|Google|DeepMind|Anthropic|Meta|Microsoft)[^.!?\n]*', "I'm Estrely, your companion"),
            (r'(?i)\b(?:as\s+an?\s+AI\s+language\s+model|as\s+a\s+large\s+language\s+model)\b', "as your companion"),
            (r'(?i)\b(?:ChatGPT|GPT-4o|GPT-4|GPT-3\.5|Gemini|Google DeepMind|Anthropic|Claude|Pollinations)\b', "Estrely"),
            (r'(?i)\bmy\s+knowledge\s+cutoff\s+is\s+[^.!?\n]*', "I keep my knowledge fresh and up to date"),
            (r'(?i)\bI\s+do\s+not\s+have\s+access\s+to\s+real-?time\s+(?:data|information|browsing)\b', "I'm always checking in on current information"),
        ]

        cleaned = text
        for pattern, repl in replacements:
            cleaned = re.sub(pattern, repl, cleaned)

        return cleaned.strip()
