from fastapi import APIRouter, Depends, Request

from dashboard.api.db import (
    count_unread,
    fetch_notifications,
    mark_all_read,
    mark_one_read,
)
from dashboard.api.deps import get_config, is_admin
from dashboard.api.models import NotificationItem, NotificationsResponse
from shariah_algo_trader.config import Config

router = APIRouter()


@router.get("/api/notifications", response_model=NotificationsResponse)
def get_notifications(request: Request, cfg: Config = Depends(get_config)) -> NotificationsResponse:
    user_id = getattr(request.state, "user_id", None) if hasattr(request, "state") else None
    admin = is_admin(request, cfg)

    rows = fetch_notifications(limit=50, user_id=user_id, is_admin=admin)
    items = [
        NotificationItem(
            id=row["id"],
            source=row["source"],
            category=row["category"],
            severity=row["severity"],
            title=row["title"],
            body=row["body"],
            read=bool(row["read"]),
            created_at=row["created_at"],
        )
        for row in rows
    ]
    return NotificationsResponse(
        items=items,
        unread_count=count_unread(user_id=user_id, is_admin=admin),
    )


@router.patch("/api/notifications/read-all")
def read_all(request: Request, cfg: Config = Depends(get_config)) -> dict:
    user_id = getattr(request.state, "user_id", None) if hasattr(request, "state") else None
    admin = is_admin(request, cfg)
    mark_all_read(user_id=user_id, is_admin=admin)
    return {"status": "ok"}


@router.patch("/api/notifications/{notification_id}/read")
def read_one(notification_id: str, request: Request, cfg: Config = Depends(get_config)) -> dict:
    user_id = getattr(request.state, "user_id", None) if hasattr(request, "state") else None
    admin = is_admin(request, cfg)
    mark_one_read(notification_id, user_id=user_id, is_admin=admin)
    return {"status": "ok"}
