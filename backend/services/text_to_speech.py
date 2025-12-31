from config import Config, Client

def synthesize(text: str) -> bytes:
    """
    Convert text to audio bytes using ElevenLabs API

    Args:
        text:str - Text to convert to audio bytes
    
    Return:
        bytes - audio bytes converted from text to audio using API
    
    """
    client = Client.get_elevenlabs_client()
    
    audio = client.text_to_speech.convert(
        text=text,
        voice_id=Config.ELEVENLABS_VOICE_ID,
        model_id=Config.ELEVENLABS_TTS_MODEL_ID
    )
    return b"".join(chunk for chunk in audio)