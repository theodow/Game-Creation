# Team Name Announcer (Android + iOS)

A React Native (Expo) app that:

- Loads names from Google Sheets.
- Divides names into 30 teams (or uses a Team column if present).
- Shows each team's number and names in the UI.
- Announces a team's names on **long press** using text-to-speech.
- Tracks and displays all teams that have already been announced.

## 1) Setup

```bash
npm install
```

## 2) Configure Google Sheets

1. In Google Sheets, prepare data in one of these formats:
   - **Preferred:** columns named `Team` and `Name`
   - **Fallback:** first column contains only names (the app auto-divides into 30 teams)
2. Publish the sheet as CSV or make it publicly accessible.
3. Copy CSV URL and set `GOOGLE_SHEET_CSV_URL` in `App.tsx`.

Example URL:

```text
https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv&gid=0
```

## 3) Run

```bash
npm run android
npm run ios
```

## Behavior

- Long press any team card to announce names.
- Announced teams are highlighted and listed at the top.
- App tries to select a Google-branded TTS voice if available on the device.
