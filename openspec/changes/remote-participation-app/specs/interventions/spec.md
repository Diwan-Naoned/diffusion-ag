# Spec Delta

## Purpose

Replaces the YouTube chat with written interventions that participants send to the Bureau, which decides which ones are read aloud in the room and tells each author what happened to theirs.

## ADDED Requirements

### Requirement: Submitting an intervention
While submissions are open, a participant with access SHALL be able to submit an intervention with a name (required, at most 100 characters), a school or structure (optional, at most 100 characters) and a text (required, at most the character limit currently set by the Bureau).

#### Scenario: Valid submission
- **WHEN** a participant submits a name and a non-empty text while submissions are open
- **THEN** the intervention is stored with status *queued* and its reception time, and it appears in their "Mes interventions"

#### Scenario: Submissions closed
- **WHEN** a participant tries to submit while submissions are closed or the AG has ended
- **THEN** the submission is refused and the form shows that interventions are closed

#### Scenario: Missing fields
- **WHEN** the name or the text is empty or only whitespace, or a field exceeds its limit
- **THEN** the submission is refused with a message naming the field

### Requirement: Light formatting
Intervention text SHALL support bold (`**…**`), italic (`*…*`) and bullet lists (lines starting with `- `), rendered as such for both the author and the Bureau; all other markup SHALL be displayed as plain text.

#### Scenario: Formatted text
- **WHEN** an intervention contains `**amendement**` and lines starting with `- `
- **THEN** "amendement" is shown in bold and those lines as a bulleted list

#### Scenario: HTML in the text
- **WHEN** an intervention contains `<script>` or other HTML
- **THEN** it is shown literally as text and never interpreted by the browser

### Requirement: Minimum delay between two proposals
A participant device SHALL NOT be able to submit a new intervention before the minimum delay currently set by the Bureau has elapsed since its previous submission; the form SHALL show the remaining time.

#### Scenario: Submitting too early
- **GIVEN** the minimum delay is 2 minutes
- **WHEN** a device submits an intervention 40 seconds after its previous one
- **THEN** the submission is refused and the form shows a countdown of the remaining 1:20

#### Scenario: No delay
- **GIVEN** the Bureau set the minimum delay to 0
- **WHEN** a device submits two interventions in a row
- **THEN** both are accepted

### Requirement: Anti-abuse ceiling per network address
Independently of the Bureau's settings, the app SHALL refuse submissions beyond a fixed ceiling of 30 per 10 minutes from the same network address, to stop automated clients that discard their cookies.

#### Scenario: Bot clearing its cookies
- **WHEN** a client submits a 31st intervention within 10 minutes from the same address, each time with a new device
- **THEN** the submission is refused with a message asking to wait

### Requirement: Bureau regulation settings
The Bureau SHALL be able to adjust from its dashboard, at any time during the AG, the minimum delay between two proposals (slider from 0 to 10 minutes, 30-second steps, default 1 minute) and the character limit of an intervention (slider from 100 to 2000, steps of 50, default 1000); each change SHALL record who made it and when.

#### Scenario: Lowering the character limit
- **WHEN** a Bureau member lowers the character limit to 400 while a participant has a 600-character draft open
- **THEN** the participant's form shows the new limit within 2 seconds, keeps the draft, and refuses to send it until it is shortened
- **AND** interventions already sent are not affected

#### Scenario: Raising the delay
- **WHEN** a Bureau member raises the minimum delay to 5 minutes
- **THEN** it applies to the next submissions of every device, and open forms update their countdown within 2 seconds

### Requirement: Author's own interventions
A participant SHALL see the interventions sent from their device, newest first, each with its reception time and status: "Pas encore lue", "Lue à HH:MM", or "Non retenue par le bureau" followed by the public rejection message; they SHALL NOT see anyone else's interventions.

#### Scenario: Intervention read aloud
- **WHEN** the Bureau marks an author's intervention as read at 14:32
- **THEN** the author's list shows "Lue à 14:32" for it within 2 seconds, without reloading

#### Scenario: Intervention rejected
- **WHEN** the Bureau rejects an intervention with the public message "Question déjà posée"
- **THEN** the author sees "Non retenue par le bureau — Question déjà posée"

#### Scenario: Another device
- **WHEN** the same person opens the app on another device
- **THEN** that device's "Mes interventions" does not show interventions sent from the first device

### Requirement: Bureau queue
The Bureau dashboard SHALL list the AG's interventions oldest first, filterable by *À lire* (queued), *Lues*, *Non retenues* and *Toutes*, with counts per status, and SHALL reflect changes made by other Bureau members within 2 seconds without reloading.

#### Scenario: New intervention arrives
- **WHEN** a participant submits an intervention
- **THEN** it appears in every open Bureau dashboard's *À lire* list within 2 seconds

#### Scenario: Another Bureau member acts
- **WHEN** one Bureau member marks an intervention as read
- **THEN** the other open dashboards show it as read within 2 seconds

### Requirement: Catch-up after reconnection
When a participant's or Bureau member's live connection drops, the page SHALL reconnect automatically and show the current state, including every change made during the interruption, without the user reloading.

#### Scenario: Network switch on a phone
- **GIVEN** a participant's phone loses its connection while switching from Wi-Fi to 5G
- **WHEN** the Bureau marks one of their interventions as read during the interruption
- **THEN** once the phone is connected again, the list shows it as read without a reload

### Requirement: Reading view
The Bureau SHALL be able to open an intervention in a large reading view with adjustable text size and previous/next navigation, from which it can be marked as read.

#### Scenario: Reading aloud
- **WHEN** a Bureau member opens an intervention in the reading view and presses "Marquer comme lue"
- **THEN** the intervention becomes *read* with the current time and the Bureau member's name

### Requirement: Rejecting with public and private reasons
Rejecting an intervention SHALL require a public message to the author (free text, with fixed French quick-pick suggestions that fill the field and stay editable; the message is stored and shown as written) and SHALL allow an optional private note visible only to the Bureau.

#### Scenario: Rejecting a duplicate
- **WHEN** a Bureau member picks "Déjà posée", edits the message and adds a private note, then confirms
- **THEN** the intervention becomes *rejected* with both texts, the time and the member's name

#### Scenario: Missing public message
- **WHEN** a Bureau member confirms a rejection with an empty public message
- **THEN** the rejection is refused until a message is given

### Requirement: Private note confidentiality
The private note SHALL never be sent to participants by any page or API.

#### Scenario: Author fetches their interventions
- **WHEN** the author's device requests its interventions
- **THEN** the response contains the public message but no private note field

### Requirement: Reversible moderation
Any intervention that is *read* or *rejected* SHALL be able to be put back to *queued*; every status change SHALL record the time and the Bureau member's name.

#### Scenario: Misclick
- **WHEN** a Bureau member puts a read intervention back in the queue
- **THEN** it becomes *queued* again, the author sees "Pas encore lue", and the change is recorded in the intervention's history
