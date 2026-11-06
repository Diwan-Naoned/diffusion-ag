# Spec Delta

## Purpose

Lets remote participants watch the AG with either the original room sound or the interpreted version, and lets participants in the room listen to the interpreter alone on their phone.

## ADDED Requirements

### Requirement: Two stream choices
The participant page SHALL embed a YouTube player and offer two choices: "Son de la salle" (stream A) and "Avec traduction en français" (stream B), with "Son de la salle" selected by default.

#### Scenario: Switching to the translated stream
- **WHEN** a participant selects "Avec traduction en français"
- **THEN** the player loads stream B, the choice is shown as selected, and a short text explains what this stream contains

### Requirement: Remembered stream choice
The participant's last stream choice SHALL be remembered on their device and restored when they reload the page.

#### Scenario: Reloading the page
- **WHEN** a participant who chose stream B reloads the page
- **THEN** stream B is selected and loaded

### Requirement: No chat
The participant page SHALL NOT display any YouTube chat, and SHALL explain that interventions go through the form to the Bureau.

#### Scenario: Looking for the chat
- **WHEN** a participant opens the participant page
- **THEN** no chat is shown and a notice points to the intervention form

### Requirement: Streams configured per AG
The YouTube video IDs of streams A and B SHALL be set by the Bureau for each AG; when an ID is missing, the player area SHALL show that the stream has not started yet instead of an error.

#### Scenario: Stream not configured yet
- **WHEN** a participant opens the page and stream A has no video ID
- **THEN** the player area shows "Le direct n'a pas encore commencé"

### Requirement: In-room interpretation listening page
The app SHALL provide a listening page, reachable from the participant page and through the room QR code, that plays the interpreter-only feed on a user action.

#### Scenario: Starting to listen
- **WHEN** a participant with access opens the listening page and presses "Écouter"
- **THEN** the interpretation feed starts playing and the page shows that it is playing

#### Scenario: Feed not available
- **WHEN** the interpretation feed is not live
- **THEN** the page says the interpretation is not currently being broadcast and retries automatically

### Requirement: Automatic reconnection of the listening page
When playback of the interpretation feed is interrupted, the listening page SHALL try to reconnect automatically and show its state while doing so.

#### Scenario: Network switch
- **WHEN** the phone switches from Wi-Fi to mobile data while listening
- **THEN** the page shows "Reconnexion…" and resumes playback without the user reloading

### Requirement: Listening guidance
The listening page SHALL tell users to keep the page open and the screen on if their device stops audio in the background, and to use headphones.

#### Scenario: Opening the listening page
- **WHEN** a participant opens the listening page
- **THEN** the guidance about headphones and keeping the page open is visible before playback
