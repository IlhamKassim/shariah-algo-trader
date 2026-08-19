import re
from fastapi import APIRouter
from pydantic import BaseModel

from dashboard.api import db
from dashboard.api.email_service import send_email

public_router = APIRouter()


class WaitlistSignup(BaseModel):
    email: str


def is_valid_email(email: str) -> bool:
    """Basic email validation using regex."""
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(pattern, email) is not None


@public_router.post("/api/public/waitlist")
def join_waitlist(payload: WaitlistSignup) -> dict:
    """Public endpoint to join the waitlist with basic email validation."""
    email = payload.email.strip().lower()
    
    # Validate email format
    if not is_valid_email(email):
        return {"status": "ok"}  # Still return success for security (don't leak validation failures)
    
    added = db.add_waitlist_signup(email)
    if added:
        # Send notification email to owner
        send_email(
            subject="New waitlist signup",
            html_body=f"<p>New signup: <strong>{email}</strong></p>",
        )
    # Always return success for idempotency (don't leak whether email exists)
    return {"status": "ok"}
