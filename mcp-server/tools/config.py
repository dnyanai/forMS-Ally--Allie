# Config to get env for mcp tools 
import os
from dotenv import load_dotenv
from google.cloud import bigquery

load_dotenv()

class Config:
    # Google Cloud
    GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
    BIGQUERY_DATASET = os.getenv("BIGQUERY_DATASET")
    
    # Gemini (for embeddings)
    # GOOGLE_GENAI_API_KEY = os.getenv("GOOGLE_GENAI_API_KEY")
    # EMBEDDING_MODEL = "text-embedding-004"
    
    # Google Search
    GOOGLE_SEARCH_API_KEY = os.getenv("GOOGLE_SEARCH_API_KEY")
    GOOGLE_SEARCH_CX = os.getenv("GOOGLE_SEARCH_CX")
    
    # Table references
    TABLE_TRKR = f"{GOOGLE_CLOUD_PROJECT}.{BIGQUERY_DATASET}.tbl_trkr"
    TABLE_CONV = f"{GOOGLE_CLOUD_PROJECT}.{BIGQUERY_DATASET}.tbl_conv"
    # TABLE_EMBD = f"{GOOGLE_CLOUD_PROJECT}.{BIGQUERY_DATASET}.tbl_embd"

    #PORT
    PORT = os.getenv("PORT")

    # BigQuery client method
    _bq_client = None

    @staticmethod
    def get_bq_client():
        """BigQuery client - uses Cloud Run service account automatically."""
        if Config._bq_client is None:
                    Config._bq_client = bigquery.Client( 
                        project=Config.GOOGLE_CLOUD_PROJECT
                        )
        return Config._bq_client