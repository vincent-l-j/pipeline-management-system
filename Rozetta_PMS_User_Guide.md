# Rozetta PMS — User Guide

**Rozetta Institute Pipeline Management System**
Version 1.0 | April 2026

---

## Contents

1. [What is Rozetta PMS?](#1-what-is-rozetta-pms)
2. [Logging In](#2-logging-in)
3. [Finding Your Way Around](#3-finding-your-way-around)
4. [The Dashboard](#4-the-dashboard)
5. [The Pipeline Board](#5-the-pipeline-board)
6. [Pitches](#6-pitches)
7. [Organisations](#7-organisations)
8. [Contacts](#8-contacts)
9. [Meetings](#9-meetings)
10. [The AI Notetaker](#10-the-ai-notetaker)
11. [Assessments](#11-assessments)
12. [Search](#12-search)
13. [Reports and CSV Export](#13-reports-and-csv-export)
14. [User Management (Admins Only)](#14-user-management-admins-only)
15. [Roles and Permissions](#15-roles-and-permissions)
16. [Quick Reference — Pipeline Stages](#16-quick-reference--pipeline-stages)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. What is Rozetta PMS?

Rozetta PMS is a web-based tool for tracking research and innovation initiatives ("pitches") as they move through Rozetta Institute's evaluation pipeline. It helps you:

- Record and track incoming pitches from submission through to a final decision
- Log meetings and capture notes (with optional AI-powered note parsing)
- Score pitches using a structured assessment framework
- Monitor the health of the pipeline at a glance
- Export data to spreadsheets for reporting

You access it through your web browser — there is nothing to install.

---

## 2. Logging In

Open your browser and go to:

> **http://localhost:5173**

You will see the Rozetta login page.

### For everyday use (Microsoft login)

Click **"Sign in with Microsoft"**. You will be taken to the Microsoft login screen. Sign in with your `@rozettainstitute.com` email and password. Once verified, you will be automatically taken to the Dashboard.

> Only `@rozettainstitute.com` accounts can log in. If you see an error, check that you are using your Rozetta email address.

### For testing and development

If Microsoft login has not been configured yet (for example, when running the system locally for the first time), click **"Dev Login (Admin)"** instead. This creates a test admin account and logs you straight in. This option is for testing purposes only and will be removed before the system goes live.

### Signing out

Click **"Sign out"** at the bottom of the left-hand sidebar to log out.

---

## 3. Finding Your Way Around

Once logged in, you will see a dark navy sidebar on the left side of the screen. This is your main navigation. It stays visible on every page.

| Sidebar item     | What it shows you                                        |
|------------------|----------------------------------------------------------|
| **Dashboard**    | Overview of the whole pipeline — counts, charts, activity |
| **Pipeline**     | Visual board (Kanban) or list of all pitches by stage     |
| **Pitches**      | A table listing every pitch in the system                 |
| **Organisations**| Organisations linked to pitches                          |
| **Contacts**     | External people linked to pitches and meetings            |
| **Meetings**     | All recorded meetings                                     |
| **Assessments**  | All scoring assessments                                   |
| **Search**       | Find anything across the entire system                    |
| **Reports**      | Pipeline summary table, metrics, and CSV downloads        |
| **Users**        | Manage staff accounts and roles (Admins only)            |

Your name and role are shown at the bottom of the sidebar.

---

## 4. The Dashboard

The Dashboard is your home screen. It gives you a snapshot of the pipeline without needing to click into individual records.

### What you will see

**Top row — four summary cards:**

| Card                    | What it tells you                                          |
|-------------------------|------------------------------------------------------------|
| Total in Pipeline       | How many pitches are currently active across all stages     |
| Advanced to Assessment  | How many pitches have progressed to a formal assessment     |
| Completed               | How many initiatives have been completed                    |
| Declined                | How many pitches were declined, and the decline rate        |

**Pipeline by Stage:** A grid showing exactly how many pitches sit in each of the 10 pipeline stages (Received, Initial Screen, Discovery Meeting, and so on).

**Pitches per Month:** A bar chart showing how many new pitches were received each month. If no pitches have been added yet, you will see a placeholder message.

**Last 30 Days:** Four activity metrics for the past month — new pitches added, meetings logged, assessments created, and stage transitions (how many times a pitch moved from one stage to another).

---

## 5. The Pipeline Board

Click **"Pipeline"** in the sidebar. This is the heart of the system — it shows every pitch and where it sits in the evaluation process.

### Two ways to view the pipeline

At the top-right of the page you will see two buttons: **Board** and **List**. Click either one to switch views.

### Board view (Kanban) — the default

The Board view shows your pipeline as a set of columns, one for each stage. Each pitch appears as a card in the column matching its current stage.

**Each card shows:**
- The pitch title (click it to open the full pitch record)
- A short description (if one was entered)
- The source (e.g. Referral, Website, Event)
- The funding pathway
- Domain tags (e.g. Climate, Health, Digital)
- The submission date
- A red "Confidential" label if the pitch is marked as confidential

**Moving a pitch to a new stage:** Click and hold a pitch card, then drag it to a different stage column and release. The system will immediately update the pitch's stage and record the change in the pitch's activity history.

### List view

The List view shows the same pitches in a traditional table format. Columns include Title, Stage, Source, Funding Pathway, Domain, and Submitted date. Click any row to open the pitch.

### Filtering and sorting

Above the board/list you will find filter dropdowns:

| Filter   | Options                                                                |
|----------|------------------------------------------------------------------------|
| Stage    | All stages, or pick one specific stage                                 |
| Source   | All sources, Referral, Website, Event, Cold Outreach, Internal         |
| Domain   | All domains, Climate, Health, Digital, Forestry, Agri, Education, Other |
| Lead     | All leads, or pick a specific staff member                             |
| Sort     | Newest first, Oldest first, Title A-Z, Title Z-A                       |

If any filters are active, a **"Clear Filters"** button will appear. Click it to reset everything.

---

## 6. Pitches

### Viewing all pitches

Click **"Pitches"** in the sidebar to see a simple table of every pitch in the system. The table shows:

- **Title** — the name of the pitch (with a red "Confidential" label if applicable)
- **Stage** — the current pipeline stage, shown as a coloured badge
- **Source** — how the pitch came to Rozetta
- **Submitted** — the date the pitch was received

Click any row to open the full pitch record.

### The pitch detail page

When you open a pitch, you will see two sections side by side:

**Left side — Pitch information and history:**

- **Pitch details card** showing the stage, source, funding pathway, Rozetta lead, submission date, linked organisation, domain tags, and masterplan alignment notes
- **Activity Timeline** — a chronological log of everything that has happened with this pitch: when it was created, every stage change, meetings logged, and assessments completed. Meeting and assessment entries are clickable — click them to jump to the full record.

**Right side — Related records:**

- **Meetings** — a list of all meetings linked to this pitch. Click any meeting to view it. Click **"Log"** to record a new meeting for this pitch.
- **Assessments** — a list of all assessments for this pitch, showing the version number, date, and recommendation (Proceed, Park, or Decline). Click **"+ New"** to create a new assessment.
- **Linked Files** — file references (paths to documents stored on your network or shared drive). Click **"+ Add File"** to add a reference by entering the file path, an optional label, and an optional description.

### Adding a new pitch

You can add a new pitch in two ways:

1. **From the Pitches page:** Click the **"New Pitch"** button at the top-right
2. **From the Pipeline page:** Click the **"New Pitch"** button next to the Board/List toggle

Both take you to the same form. Fill in the details:

| Field                  | Required? | What to enter                                                  |
|------------------------|-----------|----------------------------------------------------------------|
| Title                  | Yes       | The name of the initiative, e.g. "AgriTech Soil Sensor Initiative" |
| Short Description      | No        | A brief summary (one or two sentences)                          |
| Submission Date        | No        | The date the pitch was received (defaults to today)             |
| Source                 | No        | How it came to you: Referral, Website, Event, Cold Outreach, or Internal |
| Funding Pathway        | No        | Expected funding route: CRC Bid, RDTI, Philanthropic, Government Grant, Private, or Other |
| Organisation           | No        | Select from organisations already in the system                 |
| Rozetta Lead           | No        | The staff member who will lead this pitch                       |
| Domains                | No        | Click to select one or more: Climate, Health, Digital, Forestry, Agri, Education, Other. Selected domains are highlighted in teal. |
| Masterplan Alignment   | No        | Notes on how this fits Rozetta's strategic research agenda      |
| Mark as confidential   | No        | Tick this box if the pitch is sensitive or confidential          |

Click **"Add Pitch"** when you are done. You will be taken to the new pitch's detail page.

Click **"Cancel"** to go back without saving.

> The "New Pitch" button is only visible to users with the Admin or Assessor role.

---

## 7. Organisations

Click **"Organisations"** in the sidebar to see all organisations linked to pitches and contacts.

The table shows:

| Column | What it means                                                |
|--------|--------------------------------------------------------------|
| Name   | The organisation's name                                       |
| Type   | The kind of organisation (Startup, University, NGO, Government, Consortium, Research Centre, or Other) |
| Sector | The industry or sector the organisation operates in           |
| State  | The Australian state or territory where the organisation is based |

Organisations are linked to pitches. When you view a pitch, you will see which organisation submitted it.

---

## 8. Contacts

Click **"Contacts"** in the sidebar to see all external contacts — people outside Rozetta who are connected to pitches or attend meetings.

The table shows:

| Column         | What it means                              |
|----------------|--------------------------------------------|
| Name           | The person's full name                      |
| Role           | Their job title or role                     |
| Email          | Their email address                         |
| Last Contacted | The date you last had contact with them     |

Contacts can be linked to pitches and added as meeting attendees.

---

## 9. Meetings

### Viewing all meetings

Click **"Meetings"** in the sidebar. You will see a table of every meeting that has been recorded:

| Column    | What it means                                                |
|-----------|--------------------------------------------------------------|
| Title     | The name or subject of the meeting                            |
| Date      | When the meeting took place                                   |
| Platform  | How the meeting was held (Microsoft Teams, Zoom, In Person, Phone, or Other) |
| Follow-up | The date of any scheduled follow-up (or "—" if none)          |
| AI Notes  | Whether AI note parsing has been used on this meeting         |

Click any row to open the meeting details.

### Logging a new meeting

You can start a new meeting in two ways:

1. **From the Meetings page:** Click the **"Log Meeting"** button at the top-right
2. **From a Pitch detail page:** Click the **"Log Meeting"** button at the top of the page (this will automatically link the meeting to that pitch)

You will see a form with these fields:

| Field          | Required? | What to enter                                           |
|----------------|-----------|--------------------------------------------------------|
| Meeting Title  | Yes       | A short description, e.g. "Discovery call with AgriTech Co" |
| Linked Pitch   | Yes       | Select the pitch this meeting relates to                |
| Date           | Yes       | The date of the meeting (defaults to today)              |
| Time           | No        | The time the meeting started                             |
| Platform       | Yes       | Microsoft Teams, Zoom, In Person, Phone, or Other        |
| Summary        | No        | A brief summary of what was discussed                    |
| Key Points     | No        | The main discussion points (put each point on a new line) |
| Action Items   | No        | Follow-up tasks and next steps (one per line)            |
| Follow-up Date | No        | When the next follow-up is due                           |
| Recording Link | No        | A URL to the meeting recording (if available)            |

Click **"Save Meeting"** when you are done. You will be taken to the meeting detail page.

Click **"Cancel"** to go back without saving.

### Viewing and editing a meeting

Open any meeting to see its full details. The page shows:

**Left side:**
- Summary, Key Points, and Action Items
- The AI Notetaker import tool (see next section)

**Right side:**
- Meeting details (date, time, platform, follow-up date, recording link)
- Attendees list

**To edit a meeting:** Click **"Edit Meeting"** at the top of the page. The summary, key points, action items, follow-up date, and recording link become editable. Make your changes and click **"Save Changes"**.

### Managing attendees

On the right side of the meeting detail page, you will see the **Attendees** section.

**To add an attendee:**
1. Click the **"+ Add"** button
2. Choose whether the person is a **Rozetta Staff** member or an **External Contact**
3. Select the person from the dropdown
4. Click **"Add"**

**To remove an attendee:** Click the remove button next to their name.

---

## 10. The AI Notetaker

The AI Notetaker helps you turn raw meeting notes — whether from a transcription service (like Otter.ai or Microsoft Teams transcription), a recording summary, or your own handwritten notes — into structured meeting records.

### How to use it

1. Open the detail page of the meeting you want to add notes to
2. Look for the **"Import Meeting Notes"** section below the meeting summary. Click the header to expand it.
3. **Paste your raw notes** into the text box. These can be in any format — a transcript, bullet points, a paragraph of notes, anything.
4. Click **"Parse Notes"**
5. The system will analyse your notes and extract:
   - A **Summary** of what was discussed
   - **Key Points** (the main topics covered)
   - **Action Items** (tasks and next steps)
   - A suggested **Follow-up Date** (if one was mentioned)
   - **Attendees** (names of people mentioned in the notes)

6. **Review the results.** The AI does its best, but always check the output before applying it.

7. You have three options:
   - **"Apply to Meeting"** — copies the parsed results into the meeting's edit form so you can review and adjust before saving
   - **"Re-parse"** — try again with the same notes (useful if you edited them)
   - **"Discard"** — throw away the results and start over

8. After clicking "Apply to Meeting", the meeting form will open in edit mode with the parsed data filled in. **Review it**, make any corrections, and click **"Save Changes"**.

### Important notes about the AI Notetaker

- The AI Notetaker never saves anything automatically. You always get to review and edit before saving.
- If the Claude AI service is not configured, the system uses a basic text parser instead. Results labelled **"Parsed Results (Basic Parser)"** come from this simpler fallback — they may be less accurate.
- The AI works best with reasonably detailed notes. Very short or vague notes may produce limited results.

---

## 11. Assessments

Assessments are structured evaluations of a pitch. Each assessment scores the pitch against six criteria and records a recommendation (Proceed, Park, or Decline).

### Key concept — versioning

Assessments are **versioned**. Each time someone creates a new assessment for a pitch, it gets a new version number (v1, v2, v3, and so on). **Previous versions are never overwritten or deleted.** This gives you a complete history of how a pitch has been evaluated over time.

### Viewing all assessments

Click **"Assessments"** in the sidebar. The table shows:

| Column         | What it means                                              |
|----------------|------------------------------------------------------------|
| Pitch          | Which pitch was assessed                                    |
| Assessor       | The staff member who completed the assessment               |
| Date           | When the assessment was done                                |
| Avg Score      | The average of all six criteria scores (out of 5)           |
| Recommendation | The overall recommendation: Proceed (green), Park (amber), or Decline (red) |
| Version        | The version number (v1, v2, etc.)                           |

Click any row to view the full assessment.

### Creating a new assessment

You can start a new assessment in two ways:

1. **From the Assessments page:** Click **"New Assessment"** at the top-right
2. **From a Pitch detail page:** Click **"New Assessment"** at the top of the page (the pitch will be pre-selected)

### The assessment form

**Step 1 — Select the pitch and date**

- Choose the pitch you are assessing from the dropdown (or it will be pre-filled if you came from a pitch page)
- Set the assessment date (defaults to today)

**Step 2 — Score the six criteria**

You will see six scoring rows. For each one, click a number from 1 to 5:

| Score | Meaning    |
|-------|------------|
| 1     | Very Low   |
| 2     | Low        |
| 3     | Moderate   |
| 4     | High       |
| 5     | Very High  |

The six criteria are:

| Criterion                    | What you are evaluating                                    |
|------------------------------|------------------------------------------------------------|
| **National Impact Potential**    | The scale and significance of impact for Australia          |
| **Translation Readiness**        | How close the idea is to real-world application             |
| **Team Capability**              | The track record, expertise, and ability to deliver         |
| **Ecosystem Fit**                | How well this aligns with Rozetta's network and initiatives |
| **Funding Pathway Clarity**      | Whether there is a realistic and identified funding route   |
| **Masterplan Alignment**         | How well this fits Rozetta's strategic research agenda      |

As you score each criterion, the **average score** updates in real time at the top of the scoring card.

**Step 3 — Make a recommendation**

Choose one of three options:

- **Proceed** (green) — the pitch should advance
- **Park** (amber) — the pitch has merit but should be put on hold for now
- **Decline** (red) — the pitch should not proceed

**Step 4 — Add a rationale (optional)**

Write a short explanation of your reasoning. This is optional but recommended — it helps colleagues understand the thinking behind the recommendation.

**Step 5 — Submit**

Click **"Submit Assessment"**. You must have scored all six criteria and selected a recommendation. If anything is missing, you will see an error message telling you what to complete.

A note at the bottom of the form reminds you: *"This creates a new assessment version. Prior assessments for this pitch are preserved and always viewable."*

### Viewing an assessment

The assessment detail page shows:

**Left side:**
- The full scoring card with all six criteria and scores
- The recommendation (as a coloured badge)
- The assessor's name, assessment date, and average score
- The rationale (if one was entered)

**Right side:**
- **Assessment History** — every version of assessments for this pitch. Click any version to view it. The one you are currently viewing is marked "(viewing)".
- **Linked Pitch** — the pitch title, description, and current stage. Click the title to go to the pitch.

---

## 12. Search

Click **"Search"** in the sidebar to open the search page.

### How to search

1. Type your search term in the box at the top. You need at least **2 characters**.
2. Results will appear automatically after you stop typing (there is a brief delay).
3. Results are grouped by type:
   - **Pitches**
   - **Organisations**
   - **Contacts**
   - **Meetings**
   - **Assessments**

Each result shows a title and a brief description. The number of results in each category is shown in brackets.

4. Click any result to go directly to that record.

### Tips

- Search looks across titles, names, descriptions, and other text fields — you do not need to know which section something is in.
- If you get no results, try a shorter or different search term.
- Search is not case-sensitive — "agritech" and "AgriTech" will find the same results.

---

## 13. Reports and CSV Export

Click **"Reports"** in the sidebar.

### What you will see

**CSV Export section (top):** Five download buttons — one for each type of data. Clicking any of these will immediately download a CSV file to your computer. CSV files open in Microsoft Excel, Google Sheets, or any spreadsheet application.

| Button               | What it downloads                                           |
|----------------------|-------------------------------------------------------------|
| Export Pitches        | All pitches with their details, stages, and dates            |
| Export Organisations  | All organisations with type, sector, and location            |
| Export Contacts       | All contacts with roles, emails, and last-contacted dates    |
| Export Meetings       | All meetings with dates, platforms, summaries, and attendees |
| Export Assessments    | All assessments with scores, recommendations, and rationale  |

**Conversion Metrics:** Five cards showing headline numbers:
- Total Pitches
- Advanced to Assessment (with advancement rate as a percentage)
- Completed
- Parked
- Declined (with decline rate as a percentage)

**Pipeline Summary Table:** A table showing every pitch with its stage, lead, organisation, source, funding pathway, and submission date.

### Filtering the summary table

Use the **stage dropdown** above the table to show only pitches in a particular stage. The dropdown shows the count for each stage. Select "All stages" to show everything again.

### Printing

Click the **"Print View"** button at the top-right of the page. This hides the filter controls and export buttons, then opens your browser's print dialog. You can print to paper or save as a PDF.

---

## 14. User Management (Admins Only)

If you are an Admin, you will see a **"Users"** item in the sidebar under an "Admin" heading. Click it to see all staff accounts.

The table shows:

| Column | What it means                                              |
|--------|------------------------------------------------------------|
| Name   | The staff member's display name                             |
| Email  | Their email address                                         |
| Role   | Their role: Admin (purple badge), Assessor (blue), or Viewer (grey) |
| Status | Whether the account is Active (green) or Inactive (red)     |

---

## 15. Roles and Permissions

Every user has one of three roles. Here is what each role can do:

| Action                              | Admin | Assessor | Viewer |
|-------------------------------------|-------|----------|--------|
| View the Dashboard                  | Yes   | Yes      | Yes    |
| View the Pipeline, Pitches, and all records | Yes   | Yes      | Yes    |
| Search across the system            | Yes   | Yes      | Yes    |
| View Reports                        | Yes   | Yes      | Yes    |
| Download CSV exports                | Yes   | Yes      | Yes    |
| Drag pitches between stages         | Yes   | Yes      | No     |
| Log meetings                        | Yes   | Yes      | No     |
| Use the AI Notetaker                | Yes   | Yes      | No     |
| Create assessments                  | Yes   | Yes      | No     |
| Add file references to pitches      | Yes   | Yes      | No     |
| Add/remove meeting attendees        | Yes   | Yes      | No     |
| Manage user accounts                | Yes   | No       | No     |

**In short:** Viewers can see everything but cannot change anything. Assessors can view and create records. Admins can do everything, including managing user accounts.

---

## 16. Quick Reference — Pipeline Stages

Every pitch moves through these stages. They are listed in order from start to finish:

| #  | Stage              | What it means                                              | Colour  |
|----|--------------------|------------------------------------------------------------|---------|
| 1  | Received           | The pitch has been submitted and is waiting to be reviewed  | Blue    |
| 2  | Initial Screen     | A first-pass review is underway                             | Sky Blue |
| 3  | Discovery Meeting  | A meeting has been held to learn more                       | Cyan    |
| 4  | Deep Assessment    | A detailed evaluation is in progress                        | Teal    |
| 5  | Due Diligence      | Background checks and verification are happening            | Amber   |
| 6  | Decision Pending   | All assessments are complete; a decision is awaited          | Orange  |
| 7  | Active Support     | Rozetta is actively supporting this initiative               | Green   |
| 8  | Parked             | The pitch has merit but is on hold for now                   | Grey    |
| 9  | Declined           | The pitch has been declined                                  | Red     |
| 10 | Completed          | The initiative has been successfully completed               | Emerald |

---

## 17. Troubleshooting

**I cannot log in.**
- Make sure you are using your `@rozettainstitute.com` email address.
- If Microsoft login is not yet configured, use the **"Dev Login (Admin)"** button.
- If the page does not load at all, the application may not be running. Ask your system administrator to check.

**I cannot see the "Log Meeting" or "New Assessment" buttons.**
- These buttons are only visible to users with the **Admin** or **Assessor** role. If you are a Viewer, you have read-only access. Ask an Admin to change your role if needed.

**I cannot drag pitches on the Pipeline board.**
- Drag-and-drop is only available to Admins and Assessors.
- Make sure you are on the **Board** view (not the List view).

**The AI Notetaker says "Basic Parser" instead of "AI-Parsed Results".**
- This means the Claude AI service has not been configured. The basic parser still works but produces simpler results. Ask your system administrator to add the Anthropic API key to the system configuration.

**My CSV export did not download.**
- Check your browser's download settings. Some browsers block automatic downloads — look for a notification bar at the top or bottom of your browser window.
- Try a different browser if the problem persists.

**I see a blank page or an error.**
- Try refreshing the page (press F5 or Ctrl+R).
- If that does not help, sign out and sign back in.
- If the problem continues, ask your system administrator to check the application logs.

---

*This guide was prepared for the Rozetta Institute team. For technical support or system administration queries, contact your system administrator.*
