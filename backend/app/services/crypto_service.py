from cryptography.fernet import Fernet
from app.config import settings


class CryptoService:
    def __init__(self):
        self._fernet = None

    @property
    def fernet(self):
        if self._fernet is None:
            key = settings.ENCRYPTION_KEY
            # Ensure proper Fernet key format (32 url-safe base64 bytes)
            self._fernet = Fernet(key.encode())
        return self._fernet

    def encrypt(self, plaintext: str) -> str:
        return self.fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        return self.fernet.decrypt(ciphertext.encode()).decode()


crypto_service = CryptoService()
