# Spec Delta

## Purpose

Defines what remote members see on the live stream of a Diwan general assembly: the scenes the operator switches between, their content and languages, and how the overlays behave on the day.

## ADDED Requirements

### Requirement: Scene set
The operator SHALL have these scenes, each a full 1920×1080 composition: Avant (before the start), Présentation (slides and tribune camera), Débat (cameras, in its two camera layouts), Pause, Incident technique and Fin.

#### Scenario: Every phase of the AG has a scene
- **WHEN** the operator opens the scene collection
- **THEN** a scene exists for each phase above and each one renders its overlays and sources without a missing-source warning

### Requirement: Bilingual on-screen text
Every text shown by an overlay SHALL be given in Breton and in French, the Breton line first, the French line after it in italics, with no asterisks. No text SHALL refer to one audio version (room sound or translation), since both YouTube streams carry the same picture.

#### Scenario: Title on the waiting scene
- **WHEN** the Avant scene is shown
- **THEN** it reads "Emvod meur dreistordinal" followed by "Assemblée générale extraordinaire" in italics, then the date and place in both languages

#### Scenario: No audio-specific wording
- **WHEN** any scene is shown on YouTube stream A or B
- **THEN** no text names "traduction", "VF", "son de la salle" or an equivalent

### Requirement: Diwan identity
Overlays SHALL use only the Diwan charter's colours, the Danoise Diwan font for names and short titles, the unmodified logo files (except the quarter-round behind the signature, drawn in the screen accent so it matches the other accent shapes), flat fills with no gradient or shadow, and the charter's two shapes (oval, rectangle rounded on its top-left and bottom-right corners). The signature logo SHALL sit in the bottom-left corner of every scene.

#### Scenario: Logo unchanged
- **WHEN** a scene shows a Diwan logo
- **THEN** it is one of the charter's files, not stretched or cut, and at least 94 px wide; only the signature's quarter-round ground is recoloured, to the screen accent

### Requirement: Waiting scene
The Avant scene SHALL show the assembly title, the date and place, a countdown to the announced start time, and all five assembly rules at once.

#### Scenario: Countdown reaches zero
- **WHEN** the countdown reaches the announced start time
- **THEN** it shows 00:00 and stays there, without hiding the rest of the scene

### Requirement: Assembly rules
The five rules SHALL be, in this order: no chat; interventions are proposed (through the app or at the microphone); the Bureau moderates; respect; constructive proposals. Their Breton text SHALL be approved by a Breton speaker of the association before the AG.

#### Scenario: Same rules everywhere
- **WHEN** the rules appear on the Avant scene or in the rules strip
- **THEN** they are the same five rules, numbered 1 to 5 in the same order

### Requirement: Rules strip
The Présentation and Débat scenes SHALL show a strip listing the five numbered rules in short form, which the operator can hide and show. Switching between these two scenes SHALL NOT replay or move the strip.

#### Scenario: Switching from presentation to debate
- **GIVEN** the rules strip is visible on Présentation
- **WHEN** the operator switches to Débat
- **THEN** the strip stays in place without its entry animation playing again

#### Scenario: Hiding the strip
- **WHEN** the operator toggles the strip off
- **THEN** it disappears from both scenes until toggled on again

### Requirement: Presentation scene
The Présentation scene SHALL show the Google Slides presentation window at 16:9 and the tribune camera at 16:9 beside it, neither cropped to another aspect ratio, together with the assembly title.

#### Scenario: Slide readable
- **WHEN** a slide with 24 pt body text is shown on the 1080p stream
- **THEN** its text is readable on a laptop screen in the YouTube player at 1080p

### Requirement: Debate scene
The Débat scene SHALL show one camera full frame and the other in a 16:9 inset, and the operator SHALL be able to swap which camera is full frame.

#### Scenario: Someone in the room speaks
- **WHEN** the operator selects the room-camera layout
- **THEN** the room camera fills the frame and the tribune camera is in the inset

#### Scenario: The Bureau answers
- **WHEN** the operator selects the tribune-camera layout
- **THEN** the tribune camera fills the frame and the room camera is in the inset

### Requirement: Room vote banner
The operator SHALL be able to show, over the Débat scene, a banner saying the vote happens in the room and only members present vote.

#### Scenario: Vote in progress
- **WHEN** a vote starts in the room and the operator shows the banner
- **THEN** remote viewers read "Votadeg er sal *" and "* Vote en salle : seuls les membres présents votent" until the operator hides it

### Requirement: Interlude scenes
The Pause scene SHALL show a countdown to the restart time; the Incident technique scene SHALL tell viewers the stream will resume and they do not need to reload; the Fin scene SHALL thank viewers. None of them SHALL show a live camera.

#### Scenario: Technical problem
- **WHEN** the operator switches to Incident technique
- **THEN** viewers see "Kudenn deknikel *" and "* Problème technique" with the resume message, and no camera image

### Requirement: Restrained motion
Overlay animations SHALL only play when a scene or element appears, each lasting at most one second, apart from the countdowns and an optional slow movement of the Diwan characters illustration. Nothing SHALL move over the slide area.

#### Scenario: Long presentation
- **GIVEN** the Présentation scene has been on screen for one minute
- **WHEN** a viewer watches the stream
- **THEN** no overlay element is moving

### Requirement: Works offline
The overlays SHALL render fully, fonts included, with the Mac's network disconnected.

#### Scenario: Venue switches to 5G or loses Internet
- **WHEN** the Mac has no Internet access and OBS reloads the overlays
- **THEN** every scene renders exactly as with network access

### Requirement: Audio unaffected by scene switches
Switching scene SHALL NOT change which audio sources feed tracks 1, 2 and 3 as defined in the OBS settings of the relay.

#### Scenario: Switch during interpretation
- **GIVEN** the interpreter is speaking
- **WHEN** the operator switches from Présentation to Débat or to Pause
- **THEN** tracks 2 and 3 keep the interpreter's voice without a gap

### Requirement: Keyboard operation
Every scene and toggle (rules strip, vote banner, debate camera swap) SHALL be reachable from a hotkey on the Mac, without the mouse and without taking focus away from the slides remote control.

#### Scenario: Show the vote banner
- **WHEN** the operator presses the vote banner hotkey
- **THEN** the banner appears on the stream and the slides keep responding to the presenter's remote
