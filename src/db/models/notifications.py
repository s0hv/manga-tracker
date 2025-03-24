from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from src.enums import NotificationType


class NotificationOptions(BaseModel):
    destination: str
    group_by_manga: bool


class PartialNotificationInfo(BaseModel):
    notification_id: int
    manga_id: int
    service_id: Optional[int] = None


class InputField(BaseModel):
    name: str
    value: str
    optional: bool
    override_id: Optional[int] = None


class UserNotification(NotificationOptions):
    notification_id: int
    notification_type: NotificationType
    user_id: int
    times_run: int
    times_failed: int
    failed_in_row: int
    disabled: bool
    created: datetime


class NotificationField(BaseModel):
    field_id: int
    notification_type: NotificationType
    name: str
    optional: bool
