from fastapi import APIRouter

from dashboard.api.db import (
    count_unread,
    fetch_notifications,
    mark_all_read,
    mark_one_read,
)
from dashboard.api.models import NotificationItem, NotificationsResponse

router = APIRouter()


@router.get("/api/notifications", response_model=NotificationsResponse)
def get_notifications() -> NotificationsResponse:
    rows = fetch_notifications(limit=50)
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
    return NotificationsResponse(items=items, unread_count=count_unread())


@router.patch("/api/notifications/read-all")
def read_all() -> dict:
    mark_all_read()
    return {"status": "ok"}


@router.patch("/api/notifications/{notification_id}/read")
def read_one(notification_id: str) -> dict:
    mark_one_read(notification_id)
    return {"status": "ok"}
