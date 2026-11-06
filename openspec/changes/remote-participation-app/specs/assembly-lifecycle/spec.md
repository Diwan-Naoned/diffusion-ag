# Spec Delta

## Purpose

Governs an AG from preparation to the deletion of its data: when interventions can be sent, how the Bureau exports them for the minutes, and how the personal data is deleted only after a deliberate, cancellable decision.

## ADDED Requirements

### Requirement: AG states
An AG SHALL be in one of these states: *preparation*, *in progress*, *ended*, *deletion scheduled*, and at most one AG SHALL be outside *preparation* and not deleted at any time.

#### Scenario: Opening the AG
- **WHEN** the Bureau opens an AG that is in *preparation*
- **THEN** it becomes *in progress* with submissions open

#### Scenario: Second active AG
- **WHEN** the Bureau tries to open an AG while another one is *in progress*, *ended* or *deletion scheduled*
- **THEN** the action is refused with an explanation

### Requirement: Opening and closing submissions
While the AG is *in progress*, the Bureau SHALL be able to close and reopen submissions; participants SHALL see whether submissions are open, updated within 2 seconds without reloading.

#### Scenario: Closing submissions during a vote
- **WHEN** the Bureau closes submissions
- **THEN** within 2 seconds the open participant forms show that interventions are closed, and new submissions are refused

### Requirement: Ending the AG
The Bureau SHALL be able to end an AG that is *in progress*, which permanently closes submissions; an ended AG with no deletion scheduled SHALL be able to be reopened.

#### Scenario: Ending the AG
- **WHEN** the Bureau ends the AG
- **THEN** it becomes *ended*, submissions are refused, and within 2 seconds participants see "AG terminée" without reloading, with their own interventions still listed

#### Scenario: Ended too early
- **WHEN** the Bureau reopens an *ended* AG that has no deletion scheduled
- **THEN** it becomes *in progress* again

### Requirement: CSV export
Once the AG is *ended*, the Bureau SHALL be able to download a UTF-8 CSV, with French column headers whatever the interface language, of all its interventions with: reception time, name, school/structure, text, status, status time, Bureau member, public message and private note.

#### Scenario: Downloading the CSV
- **WHEN** a Bureau member requests the CSV export of an ended AG
- **THEN** a CSV file with one row per intervention and the columns above is downloaded, and it opens correctly in a spreadsheet with accented characters intact

### Requirement: Printable export
Once the AG is *ended*, the Bureau SHALL be able to open a printable page in French, whatever the interface language, of all interventions in reception order, which opens the browser's print dialog for saving as PDF; it SHALL show the AG name and date, the export time, and for each intervention its time, author, school/structure, formatted text, status and public message, and SHALL NOT show private notes.

#### Scenario: Saving the PDF
- **WHEN** a Bureau member opens the printable export
- **THEN** the browser's print dialog opens, and the printed result keeps each intervention on a single page when it fits and contains no buttons or navigation

### Requirement: Explicit export confirmation
Scheduling deletion SHALL only be possible after a Bureau member has confirmed "J'ai bien enregistré l'export" on an ended AG, after at least one export (CSV or printable) has been opened.

#### Scenario: No export yet
- **WHEN** no export has been opened for an ended AG
- **THEN** the confirmation and deletion actions are not available

#### Scenario: Export confirmed
- **WHEN** a Bureau member opened an export and confirms the copy is saved
- **THEN** the "Supprimer dans 7 jours" action becomes available, and the confirmation is recorded with the member's name and time

### Requirement: Scheduled deletion with grace period
Scheduling deletion SHALL set a deletion time 7 days later; until then the AG SHALL be *deletion scheduled*, exports SHALL remain available, every Bureau page SHALL show the deletion date, and any Bureau member SHALL be able to cancel it.

#### Scenario: Scheduling
- **WHEN** a Bureau member chooses "Supprimer dans 7 jours" on 5 November at 10:00
- **THEN** the AG shows "Suppression prévue le 12/11 à 10:00" on every Bureau page

#### Scenario: Cancelling
- **WHEN** a Bureau member cancels the scheduled deletion
- **THEN** the AG goes back to *ended* and no deletion happens

### Requirement: Deletion is never automatic otherwise
The app SHALL NOT delete AG data except at the time set by a scheduled deletion that has not been cancelled.

#### Scenario: AG left ended
- **WHEN** an AG stays *ended* for months without deletion being scheduled
- **THEN** its data is kept

### Requirement: Deletion survives restarts
The deletion time SHALL be stored persistently, and a deletion whose time passed while the app was stopped SHALL be carried out when the app starts again, never earlier.

#### Scenario: Redeploy during the grace period
- **WHEN** the app is redeployed on day 3 of the grace period
- **THEN** the deletion date is unchanged and the deletion happens on day 7

#### Scenario: App down at the deletion time
- **WHEN** the app was stopped at the deletion time and starts again afterwards
- **THEN** the deletion is carried out at startup

### Requirement: What deletion removes
Deletion SHALL permanently remove the AG's interventions, names, public messages, private notes, status history and access code, and SHALL invalidate all participant cookies for that AG; the AG may remain only as a name and date with no personal data.

#### Scenario: After deletion
- **WHEN** the deletion has run
- **THEN** no intervention data of that AG can be found in the database, exports are no longer available, and old participant links show the code entry page
