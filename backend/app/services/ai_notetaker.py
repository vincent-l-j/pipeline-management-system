"""
AI Notetaker — Mode 1: Manual paste → Claude API parsing → structured fields.

When the Claude API key is available, set ANTHROPIC_API_KEY in your .env file
and this service will automatically switch from mock parsing to real AI parsing.
"""

import os
import json
import re

# Try to import the Anthropic SDK — it's optional until the API key is ready
try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False


PARSE_PROMPT = """You are an assistant that extracts structured meeting information from raw meeting notes or AI-generated meeting summaries.

Given the following raw meeting notes, extract and return a JSON object with these fields:

- "summary": A concise 2-3 sentence summary of what was discussed
- "key_points": A list of the most important points discussed (as a JSON array of strings)
- "action_items": A list of action items or next steps (as a JSON array of strings, each starting with who is responsible if mentioned)
- "follow_up_date": The next meeting or follow-up date if mentioned (as "YYYY-MM-DD" string, or null if not mentioned)
- "attendees": A list of people mentioned as attending (as a JSON array of strings), or empty array if not clear

Return ONLY valid JSON, no other text.

Raw meeting notes:
---
{notes}
---"""


def parse_meeting_notes(raw_notes: str) -> dict:
    """
    Parse raw meeting notes into structured fields.

    If ANTHROPIC_API_KEY is set and the SDK is installed, uses Claude API.
    Otherwise, falls back to a basic mock parser for development.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")

    if api_key and HAS_ANTHROPIC:
        return _parse_with_claude(raw_notes, api_key)
    else:
        return _parse_mock(raw_notes)


def _parse_with_claude(raw_notes: str, api_key: str) -> dict:
    """Parse using Claude API — activated when ANTHROPIC_API_KEY is set."""
    client = anthropic.Anthropic(api_key=api_key)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": PARSE_PROMPT.format(notes=raw_notes),
            }
        ],
    )

    # Extract the JSON from Claude's response
    response_text = message.content[0].text
    try:
        parsed = json.loads(response_text)
    except json.JSONDecodeError:
        # Try to find JSON within the response
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            parsed = json.loads(json_match.group())
        else:
            raise ValueError("Could not parse Claude's response as JSON")

    return _normalize_parsed(parsed)


def _parse_mock(raw_notes: str) -> dict:
    """
    Basic mock parser for development — extracts what it can from the text
    without AI. This runs when no Claude API key is configured.

    The mock does a reasonable job of pulling out structure, but the real
    Claude parser will be significantly better at understanding context.
    """
    lines = raw_notes.strip().split('\n')
    lines = [l.strip() for l in lines if l.strip()]

    summary_lines = []
    key_points = []
    action_items = []
    attendees = []
    follow_up_date = None
    current_section = None

    for line in lines:
        lower = line.lower()

        # Detect section headers
        if any(h in lower for h in ['summary', 'overview', 'tldr', 'tl;dr']):
            current_section = 'summary'
            # If the header line itself has content after a colon, capture it
            if ':' in line:
                content = line.split(':', 1)[1].strip()
                if content:
                    summary_lines.append(content)
            continue
        elif any(h in lower for h in ['key point', 'key takeaway', 'main point', 'highlights', 'discussion']):
            current_section = 'key_points'
            continue
        elif any(h in lower for h in ['action item', 'action:', 'next step', 'todo', 'to do', 'tasks']):
            current_section = 'action_items'
            continue
        elif any(h in lower for h in ['attendee', 'participant', 'present', 'who was there']):
            current_section = 'attendees'
            continue
        elif any(h in lower for h in ['follow up', 'follow-up', 'next meeting']):
            current_section = 'follow_up'
            # Try to find a date
            date_match = re.search(r'(\d{4}-\d{2}-\d{2})', line)
            if date_match:
                follow_up_date = date_match.group(1)
            continue

        # Clean bullet points and numbering
        clean = re.sub(r'^[\-\*\•\d\.]+\s*', '', line).strip()
        if not clean:
            continue

        # Assign to current section
        if current_section == 'summary':
            summary_lines.append(clean)
        elif current_section == 'key_points':
            key_points.append(clean)
        elif current_section == 'action_items':
            action_items.append(clean)
        elif current_section == 'attendees':
            # Split comma-separated names
            for name in clean.split(','):
                name = name.strip()
                if name:
                    attendees.append(name)
        elif current_section is None:
            # Before any section is detected, treat as summary
            summary_lines.append(clean)

    # Look for dates anywhere in the text if not found in a section
    if not follow_up_date:
        for line in lines:
            date_match = re.search(r'(\d{4}-\d{2}-\d{2})', line)
            if date_match:
                follow_up_date = date_match.group(1)
                break

    return {
        "summary": ' '.join(summary_lines[:3]) if summary_lines else "Meeting notes imported — please review and edit the summary.",
        "key_points": key_points if key_points else ["No key points extracted — please add manually."],
        "action_items": action_items if action_items else [],
        "follow_up_date": follow_up_date,
        "attendees": attendees,
        "ai_parsed": False,  # Indicates this was mock-parsed, not AI-parsed
        "notice": "Parsed without AI — Claude API key not configured. Set ANTHROPIC_API_KEY in .env to enable AI parsing.",
    }


def _normalize_parsed(parsed: dict) -> dict:
    """Ensure consistent field types from either parser."""
    return {
        "summary": parsed.get("summary", ""),
        "key_points": parsed.get("key_points", []),
        "action_items": parsed.get("action_items", []),
        "follow_up_date": parsed.get("follow_up_date"),
        "attendees": parsed.get("attendees", []),
        "ai_parsed": True,
    }
