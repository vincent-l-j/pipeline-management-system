"""Unit tests for the ai_notetaker service — mock parser and Claude path."""
import os
from unittest.mock import MagicMock, patch

import pytest

from app.services.ai_notetaker import parse_meeting_notes, _parse_mock, _normalize_parsed


# --- Mock parser (no API key) ---

def test_mock_parser_returns_required_fields():
    result = _parse_mock("Some meeting notes here.")
    for field in ("summary", "key_points", "action_items", "follow_up_date", "attendees"):
        assert field in result


def test_mock_parser_extracts_summary():
    notes = "Summary: We discussed the prototype results and next steps."
    result = _parse_mock(notes)
    assert "prototype results" in result["summary"]


def test_mock_parser_extracts_key_points():
    notes = """
Key points:
- Strong initial data
- Need more field testing
- Budget approved
"""
    result = _parse_mock(notes)
    assert len(result["key_points"]) == 3


def test_mock_parser_extracts_action_items():
    notes = """
Action items:
- John: book the demo room
- Alice: prepare the slide deck
"""
    result = _parse_mock(notes)
    assert len(result["action_items"]) == 2


def test_mock_parser_extracts_date():
    notes = "Follow up: next meeting on 2026-07-15"
    result = _parse_mock(notes)
    assert result["follow_up_date"] == "2026-07-15"


def test_mock_parser_extracts_attendees():
    notes = """
Attendees:
Alice, Bob, Charlie
"""
    result = _parse_mock(notes)
    assert "Alice" in result["attendees"]
    assert "Bob" in result["attendees"]
    assert "Charlie" in result["attendees"]


def test_mock_parser_ai_parsed_flag_is_false():
    result = _parse_mock("Meeting notes.")
    assert result["ai_parsed"] is False


def test_parse_meeting_notes_uses_mock_when_no_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    result = parse_meeting_notes("Some notes here.")
    assert result["ai_parsed"] is False


# --- Normalize helper ---

def test_normalize_parsed_fills_missing_fields():
    sparse = {"summary": "Hello"}
    result = _normalize_parsed(sparse)
    assert result["key_points"] == []
    assert result["action_items"] == []
    assert result["attendees"] == []
    assert result["follow_up_date"] is None
    assert result["ai_parsed"] is True


# --- Claude path (monkeypatched) ---

def test_parse_with_claude_path(monkeypatch):
    """Verify Claude path is taken when API key is set and SDK is available."""
    import app.services.ai_notetaker as module

    fake_response_text = """{
        "summary": "Discussed project status.",
        "key_points": ["On track", "Budget approved"],
        "action_items": ["Alice: write report"],
        "follow_up_date": "2026-07-01",
        "attendees": ["Alice", "Bob"]
    }"""

    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=fake_response_text)]

    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_message

    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-fake-key")
    monkeypatch.setattr(module, "HAS_ANTHROPIC", True)

    with patch("app.services.ai_notetaker.anthropic") as mock_anthropic:
        mock_anthropic.Anthropic.return_value = mock_client
        result = parse_meeting_notes("Let's discuss the project.")

    assert result["summary"] == "Discussed project status."
    assert result["key_points"] == ["On track", "Budget approved"]
    assert result["ai_parsed"] is True
    assert result["follow_up_date"] == "2026-07-01"
