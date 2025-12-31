from io import BytesIO
from config import Config, Client


def transcribe(audio_bytes: bytes) -> str:
    """
    Convert audio to text using ElevenLabs API 
    
    Args:
        audio_bytes: bytes - audio bytes 
        language_code: str - language for transcribing 
    
    Returns:
        result.text: str - result of the audio transcribed from audio to text
    """
    client = Client.get_elevenlabs_client()
    
    audio_file = BytesIO(audio_bytes)
    
    result = client.speech_to_text.convert(
        file=audio_file,
        model_id=Config.ELEVENS_STT_MODEL_ID,
        language_code=Config.LANGUAGE_CODE
    )
    return result.text