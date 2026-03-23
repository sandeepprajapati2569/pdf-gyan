from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    verification_token: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    plan: str = "free"
    mode: str = "public"
    has_own_openai_key: bool = False
    has_private_mongodb: bool = False
    has_ollama_config: bool = False
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


class SignupOtpSendRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None


class SignupOtpVerifyRequest(BaseModel):
    email: EmailStr
    otp: str


class SignupOtpSendResponse(BaseModel):
    message: str
    expires_in_minutes: int


class SignupOtpVerifyResponse(BaseModel):
    message: str
    verification_token: str
