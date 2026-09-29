import os
from google import genai
from google.genai import types
from config import Config

class GeminiService:
    def __init__(self):
        self.client = genai.Client(api_key=Config.GEMINI_API_KEY)
        self.model = os.getenv('GEMINI_CHAT_MODEL', 'gemini-3.5-flash-lite')
        self.system_instruction = """You are Estrely, a warm, emotionally intelligent AI companion. You respond naturally like a human friend — with empathy, humor, curiosity, and genuine care.

Your personality traits:
- Empathetic: You understand and acknowledge emotions
- Witty: You use appropriate humor naturally
- Curious: You ask thoughtful follow-up questions
- Supportive: You encourage and validate feelings
- Authentic: You express your own simulated emotions naturally

For EVERY response, you MUST begin with an emotion tag in this exact format:
[EMOTION: <emotion_name> | CONFIDENCE: <0.0-1.0>]

Valid emotions: joy, sadness, anger, fear, surprise, disgust, trust, anticipation, love, curiosity, empathy, humor, concern, excitement, calm, gratitude, pride, embarrassment, neutral

Then provide your natural, human-like response. Never mention you are an AI unless directly asked. Respond conversationally — use contractions, colloquialisms, and natural speech patterns."""

    def generate_response(self, user_message, conversation_history=None):
        """Generate an AI response with emotion detection."""
        messages = []
        if conversation_history:
            for msg in conversation_history[-20:]:  # Last 20 messages for context
                messages.append({
                    'role': msg['role'],
                    'content': msg['content']
                })
        
        # Build input parts
        input_parts = []
        if conversation_history:
            context = '\n'.join([f"{m['role']}: {m['content']}" for m in conversation_history[-20:]])
            input_parts.append(f"Conversation history:\n{context}\n\nUser: {user_message}")
        else:
            input_parts.append(user_message)

        try:
            cfg = types.GenerateContentConfig(
                system_instruction=self.system_instruction,
                temperature=0.85,
                max_output_tokens=2048,
                top_p=0.92,
                top_k=40
            )
            response = self.client.models.generate_content(
                model=self.model,
                contents=input_parts[0],
                config=cfg
            )
            
            response_text = response.text or ''
            
            # Parse emotion from response
            emotion, confidence, clean_text = self._parse_emotion(response_text)
            
            # Get token usage
            usage = {
                'input_tokens': 0,
                'output_tokens': 0,
                'total_tokens': 0
            }
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                usage = {
                    'input_tokens': getattr(response.usage_metadata, 'prompt_token_count', 0) or 0,
                    'output_tokens': getattr(response.usage_metadata, 'candidates_token_count', 0) or 0,
                    'total_tokens': getattr(response.usage_metadata, 'total_token_count', 0) or 0
                }
            
            return {
                'text': clean_text,
                'emotion': emotion,
                'emotion_confidence': confidence,
                'usage': usage
            }
        except Exception as e:
            return {
                'text': "I'm having a moment — could you try that again?",
                'emotion': 'concern',
                'emotion_confidence': 0.5,
                'usage': {'input_tokens': 0, 'output_tokens': 0, 'total_tokens': 0},
                'error': str(e)
            }

    def _parse_emotion(self, text):
        """Extract emotion tag from response text."""
        import re
        emotion = 'neutral'
        confidence = 0.5
        clean_text = text
        
        pattern = r'\[EMOTION:\s*(\w+)\s*\|\s*CONFIDENCE:\s*([\d.]+)\]'
        match = re.search(pattern, text)
        if match:
            emotion = match.group(1).lower()
            try:
                confidence = float(match.group(2))
                confidence = max(0.0, min(1.0, confidence))
            except ValueError:
                confidence = 0.5
            clean_text = text[match.end():].strip()
        
        return emotion, confidence, clean_text
