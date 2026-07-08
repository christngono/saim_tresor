from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration lue depuis l'environnement (.env à la racine du monorepo)."""

    model_config = SettingsConfigDict(env_file="../../.env", extra="ignore")

    database_url: str

    # LLM — extraction (Together AI / Qwen2.5-VL) + fallback / narration (Groq)
    together_api_key: str = ""
    together_vision_model: str = "Qwen/Qwen2.5-VL-72B-Instruct"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # Stockage R2 (compatible S3) / MinIO en local
    r2_endpoint: str = "http://localhost:9000"
    r2_access_key_id: str = "minioadmin"
    r2_secret_access_key: str = "minioadmin"
    r2_bucket: str = "saim-documents"
    r2_region: str = "auto"


settings = Settings()  # type: ignore[call-arg]
