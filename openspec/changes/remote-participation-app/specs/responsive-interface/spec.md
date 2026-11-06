# Spec Delta

## Purpose

Ensures every screen of the AG web app is comfortable to use on phones, tablets and desktops, for remote participants, listeners in the room and Bureau members alike.

## ADDED Requirements

### Requirement: Every screen adapts from phone to desktop
Every screen of the app (code entry, participant page, listening page, Bureau login, dashboard, reading view, AG settings) SHALL be usable at any viewport width from 320 px to desktop without horizontal page scrolling and with text readable without zooming; the print export is excluded.

#### Scenario: Small phone
- **WHEN** any screen is displayed at 320 px wide
- **THEN** all content and controls are reachable by vertical scrolling only, and body text is at least 16 px

#### Scenario: Desktop
- **WHEN** any screen is displayed at 1280 px wide
- **THEN** the content uses a constrained width and the layout matches the mockup

### Requirement: Touch-friendly controls
Every interactive control SHALL offer a touch target of at least 44×44 px, and no feature SHALL depend on hovering.

#### Scenario: Using the sliders on a phone
- **WHEN** a Bureau member adjusts the Régulation sliders on a touch screen
- **THEN** each slider can be grabbed and set to every step by touch, and its current value stays visible

#### Scenario: Language and stream choices
- **WHEN** a participant taps the FR | BR selector or a stream choice on a phone
- **THEN** each option is a separate target of at least 44×44 px

### Requirement: Phone layout of the participant page
On narrow screens, the participant page SHALL stack its content in this order: stream choice and player, intervention form, then "Mes interventions".

#### Scenario: Participant on a phone
- **WHEN** a participant opens the participant page on a phone
- **THEN** the player is at the top at full width with a 16:9 ratio, followed by the form and their interventions

### Requirement: Reading view on phones and tablets
The Bureau reading view SHALL fill the screen on phones and tablets, keep the text-size and previous/next controls visible without scrolling, and not be cut off by the browser's toolbars.

#### Scenario: Reading at the microphone from a phone
- **WHEN** a Bureau member opens an intervention in the reading view on a phone
- **THEN** the view fills the screen, the text scrolls inside it, and the size, previous/next and "mark as read" controls stay visible

### Requirement: Dialogs and Bureau controls on small screens
On narrow screens, dialogs (reject, confirmations) SHALL be shown full screen, and the Bureau tabs, chips and action buttons SHALL wrap instead of overflowing.

#### Scenario: Rejecting from a phone
- **WHEN** a Bureau member opens the reject dialog on a phone
- **THEN** it fills the screen, the chips wrap over several lines, and the confirm button is reachable

### Requirement: On-screen keyboard and orientation
Forms SHALL remain usable with the on-screen keyboard open, and every screen SHALL work in portrait and landscape.

#### Scenario: Typing an intervention on a phone
- **WHEN** a participant types an intervention with the on-screen keyboard open
- **THEN** the character counter, the countdown and the send button can be reached without closing the keyboard

#### Scenario: Rotating the phone
- **WHEN** a participant rotates their phone while watching the stream
- **THEN** the layout adapts without losing the current stream, draft or scroll position
