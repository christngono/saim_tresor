"""Stockage de fichiers — Cloudflare R2 (API S3), MinIO en local."""
import boto3
from botocore.config import Config

from app.config import settings

_client = boto3.client(
    "s3",
    endpoint_url=settings.r2_endpoint,
    aws_access_key_id=settings.r2_access_key_id,
    aws_secret_access_key=settings.r2_secret_access_key,
    region_name=settings.r2_region,
    # Échec rapide : un stockage indisponible ne doit pas faire traîner l'appel
    # (ni, a fortiori, expirer une transaction en base).
    config=Config(
        signature_version="s3v4",
        connect_timeout=2,
        read_timeout=5,
        retries={"max_attempts": 1},
    ),
)


def put_object(key: str, body: bytes, content_type: str) -> str:
    _client.put_object(
        Bucket=settings.r2_bucket, Key=key, Body=body, ContentType=content_type
    )
    return key


def get_object(key: str) -> bytes:
    resp = _client.get_object(Bucket=settings.r2_bucket, Key=key)
    return resp["Body"].read()


def presigned_url(key: str, expires: int = 3600) -> str:
    return _client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.r2_bucket, "Key": key},
        ExpiresIn=expires,
    )
