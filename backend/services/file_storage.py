import os
from abc import ABC, abstractmethod
from pathlib import Path

import aiofiles


class FileStorage(ABC):
    @abstractmethod
    async def save_file(self, key: str, content: bytes, content_type: str | None = None) -> str:
        raise NotImplementedError

    @abstractmethod
    async def delete_file(self, key: str) -> None:
        raise NotImplementedError


class LocalFileStorage(FileStorage):
    def __init__(self, root_dir: str = "backend/uploads"):
        self.root_dir = Path(root_dir).resolve()  # Resolve to absolute path
        self.root_dir.mkdir(parents=True, exist_ok=True)

    def _validate_key(self, key: str) -> Path:
        """Validate key to prevent path traversal attacks"""
        # Remove any path traversal attempts
        if ".." in key or key.startswith("/"):
            raise ValueError("Invalid file key: path traversal detected")
        
        target = (self.root_dir / key).resolve()
        
        # Ensure target is within root_dir
        try:
            target.relative_to(self.root_dir)
        except ValueError:
            raise ValueError("Invalid file key: outside storage directory")
        
        return target

    async def save_file(self, key: str, content: bytes, content_type: str | None = None) -> str:
        target = self._validate_key(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(target, "wb") as f:
            await f.write(content)
        return f"/uploads/{key}"

    async def delete_file(self, key: str) -> None:
        target = self._validate_key(key)
        if target.exists():
            target.unlink()


class S3FileStorage(FileStorage):
    async def save_file(self, key: str, content: bytes, content_type: str | None = None) -> str:
        raise NotImplementedError("S3 storage is not configured yet. Set FILE_STORAGE_DRIVER=local for MVP")

    async def delete_file(self, key: str) -> None:
        return None


def get_file_storage() -> FileStorage:
    driver = os.environ.get("FILE_STORAGE_DRIVER", "local").lower()
    if driver == "s3":
        return S3FileStorage()
    default_uploads = str((Path(__file__).resolve().parent.parent / "uploads"))
    uploads_dir = os.environ.get("LOCAL_UPLOADS_DIR", default_uploads)
    return LocalFileStorage(root_dir=uploads_dir)
