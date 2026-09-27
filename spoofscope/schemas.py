import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DomainCreate(BaseModel):
    name: str = Field(min_length=3, max_length=253)
    label: str | None = Field(default=None, max_length=120)
    authorized: bool

    @field_validator("name")
    @classmethod
    def clean_domain(cls, value: str):
        value = value.lower().strip().rstrip(".")
        if "://" in value or "/" in value or " " in value or "." not in value:
            raise ValueError("Use a bare registrable domain, for example example.com")
        try:
            ascii_value = value.encode("idna").decode("ascii")
        except UnicodeError as exc:
            raise ValueError("Invalid internationalized domain") from exc
        labels = ascii_value.split(".")
        if any(
            not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label) for label in labels
        ):
            raise ValueError(
                "Domain labels may contain only letters, numbers, and internal hyphens"
            )
        if labels[-1].isdigit():
            raise ValueError("The final domain label cannot be numeric")
        return ascii_value


class DomainOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    label: str | None
    active: bool
    created_at: datetime
    last_scan_at: datetime | None


class ScanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: str
    started_at: datetime | None
    finished_at: datetime | None
    error: str | None
    stats: dict[str, Any]
