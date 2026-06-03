from pydantic import BaseModel
from uuid import UUID
from datetime import date, time, datetime
from app.models.meeting import MeetingPlatform


class MeetingCreate(BaseModel):
    title: str
    meeting_date: date
    meeting_time: time | None = None
    platform: MeetingPlatform | None = None
    summary: str | None = None
    key_points: str | None = None
    action_items: str | None = None
    follow_up_date: date | None = None
    recording_link: str | None = None
    transcript_path: str | None = None
    pitch_id: UUID


class MeetingUpdate(BaseModel):
    title: str | None = None
    meeting_date: date | None = None
    meeting_time: time | None = None
    platform: MeetingPlatform | None = None
    summary: str | None = None
    key_points: str | None = None
    action_items: str | None = None
    follow_up_date: date | None = None
    recording_link: str | None = None
    transcript_path: str | None = None


class MeetingAttendeeAdd(BaseModel):
    user_id: UUID | None = None
    contact_id: UUID | None = None
    is_internal: bool = True


class MeetingAttendeeOut(BaseModel):
    id: UUID
    user_id: UUID | None
    contact_id: UUID | None
    is_internal: bool

    model_config = {"from_attributes": True}


class MeetingOut(BaseModel):
    id: UUID
    title: str
    meeting_date: date
    meeting_time: time | None
    platform: MeetingPlatform | None
    summary: str | None
    key_points: str | None
    action_items: str | None
    follow_up_date: date | None
    recording_link: str | None
    transcript_path: str | None
    ai_import_status: str | None
    pitch_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class AINoteParseRequest(BaseModel):
    raw_notes: str


class AINoteParseResponse(BaseModel):
    summary: str
    key_points: list[str]
    action_items: list[str]
    follow_up_date: str | None = None
    attendees: list[str]
    ai_parsed: bool = False
    notice: str | None = None
