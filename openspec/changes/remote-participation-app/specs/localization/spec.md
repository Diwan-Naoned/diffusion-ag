# Spec Delta

## Purpose

Lets every user of the AG web app, participants and Bureau alike, use its interface in French or in Breton, independently of which stream they watch.

## ADDED Requirements

### Requirement: French and Breton interface
Every page of the app (code entry, participant page, listening page, Bureau pages) SHALL be available in French and in Breton, except the exports, which are always in French.

#### Scenario: Breton interface
- **WHEN** a participant uses the Breton interface
- **THEN** all labels, buttons, statuses and system messages of the pages they see are in Breton

#### Scenario: Export from a Breton interface
- **WHEN** a Bureau member using the Breton interface opens the CSV or printable export
- **THEN** the export is in French

### Requirement: Language selector on every page
Every page except the exports SHALL show a language selector (FR / BR), including the code entry page shown before access is granted.

#### Scenario: Switching language before entering the code
- **WHEN** a visitor without access selects BR on the code entry page
- **THEN** the code entry page is shown in Breton

### Requirement: Remembered language
The chosen language SHALL be remembered on the device; without a stored choice, the interface SHALL be in Breton if the browser's preferred languages include Breton, and in French otherwise.

#### Scenario: First visit with a Breton browser
- **WHEN** a person without a stored choice opens the app with a browser set to prefer Breton
- **THEN** the interface is in Breton

#### Scenario: Returning visit
- **WHEN** a person who chose French returns to the app
- **THEN** the interface is in French whatever the browser's settings

### Requirement: Language independent from the stream choice
The interface language and the stream choice SHALL be independent settings: changing one SHALL NOT change the other.

#### Scenario: Breton interface with the translated stream
- **WHEN** a participant with the Breton interface selects "with translation into French"
- **THEN** the translated stream plays and the interface stays in Breton

#### Scenario: Changing language while watching
- **WHEN** a participant watching stream A switches the interface to French
- **THEN** stream A stays selected

### Requirement: User content is not translated
Intervention texts, names, schools or structures, rejection messages and the rejection quick-pick suggestions SHALL be shown as written, whatever the interface language.

#### Scenario: Reading a French intervention on a Breton interface
- **WHEN** a Bureau member using the Breton interface opens an intervention written in French
- **THEN** the intervention text is shown in French, with the surrounding interface in Breton

### Requirement: Language-aware formatting
Times, dates and counts SHALL follow the rules of the interface language, including Breton plural forms.

#### Scenario: Counts in Breton
- **WHEN** the Bureau dashboard shows the number of queued interventions in Breton
- **THEN** the noun takes the Breton form appropriate to that number

### Requirement: Missing translation fallback
If a Breton string is missing, the app SHALL show the French string instead and keep working.

#### Scenario: Untranslated label
- **WHEN** a label has no Breton translation and the interface is in Breton
- **THEN** that label is shown in French and the rest of the page in Breton
