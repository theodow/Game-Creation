import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Speech from 'expo-speech';

type Team = {
  id: number;
  names: string[];
};

const TEAM_COUNT = 30;

/**
 * Replace with your published Google Sheets CSV URL.
 * Example:
 * https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv&gid=0
 */
const GOOGLE_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/REPLACE_WITH_SHEET_ID/export?format=csv&gid=0';

const splitCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
};

const parseCsv = (text: string): string[][] => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map(splitCsvLine);
};

const buildTeamsFromRows = (rows: string[][]): Team[] => {
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.toLowerCase());
  const teamIndex = headers.findIndex((h) => ['team', 'team_number', 'group'].includes(h));
  const nameIndex = headers.findIndex((h) => ['name', 'names', 'player'].includes(h));

  const dataRows = rows.slice(1);

  if (teamIndex >= 0 && nameIndex >= 0) {
    const teamMap = new Map<number, string[]>();

    dataRows.forEach((row) => {
      const teamNumber = Number(row[teamIndex]);
      const rawName = row[nameIndex]?.trim();

      if (!Number.isInteger(teamNumber) || !rawName) {
        return;
      }

      const list = teamMap.get(teamNumber) ?? [];
      list.push(rawName);
      teamMap.set(teamNumber, list);
    });

    const teams: Team[] = [];
    for (let i = 1; i <= TEAM_COUNT; i += 1) {
      teams.push({ id: i, names: teamMap.get(i) ?? [] });
    }
    return teams;
  }

  const firstColumnNames = dataRows.map((row) => row[0]?.trim()).filter(Boolean) as string[];
  const namesPerTeam = Math.ceil(firstColumnNames.length / TEAM_COUNT);

  return Array.from({ length: TEAM_COUNT }).map((_, index) => {
    const start = index * namesPerTeam;
    const end = start + namesPerTeam;
    return {
      id: index + 1,
      names: firstColumnNames.slice(start, end),
    };
  });
};

export default function App() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [announcedTeams, setAnnouncedTeams] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [googleVoice, setGoogleVoice] = useState<string | undefined>(undefined);

  useEffect(() => {
    const initialize = async () => {
      try {
        const response = await fetch(GOOGLE_SHEET_CSV_URL);
        if (!response.ok) {
          throw new Error(`Sheet request failed: ${response.status}`);
        }

        const csvText = await response.text();
        const rows = parseCsv(csvText);
        const parsedTeams = buildTeamsFromRows(rows);

        if (parsedTeams.length === 0) {
          throw new Error('No team data found in sheet.');
        }

        setTeams(parsedTeams);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
      } finally {
        setLoading(false);
      }

      const voices = await Speech.getAvailableVoicesAsync();
      const selected = voices.find((voice) => {
        const name = voice.name?.toLowerCase() ?? '';
        const identifier = voice.identifier?.toLowerCase() ?? '';
        return name.includes('google') || identifier.includes('google');
      });

      if (selected) {
        setGoogleVoice(selected.identifier);
      }
    };

    initialize();
  }, []);

  const announcedLabel = useMemo(() => {
    if (announcedTeams.length === 0) {
      return 'None yet';
    }
    return announcedTeams.join(', ');
  }, [announcedTeams]);

  const onLongPressTeam = (team: Team) => {
    if (team.names.length === 0) {
      Alert.alert(`Team ${team.id}`, 'No names found for this team.');
      return;
    }

    Speech.stop();
    Speech.speak(team.names.join(', '), {
      voice: googleVoice,
      language: 'en-US',
      rate: 0.95,
      pitch: 1.0,
    });

    setAnnouncedTeams((current) => {
      if (current.includes(team.id)) {
        return current;
      }
      return [...current, team.id].sort((a, b) => a - b);
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading teams from Google Sheets...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>Failed to load teams: {error}</Text>
        <Text style={styles.errorSubText}>
          Update GOOGLE_SHEET_CSV_URL in App.tsx with your published sheet URL.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Team Name Announcer</Text>
      <Text style={styles.subtitle}>Long-press a team card to announce names</Text>
      <Text style={styles.announced}>Announced teams: {announcedLabel}</Text>

      <FlatList
        data={teams}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isAnnounced = announcedTeams.includes(item.id);
          return (
            <Pressable
              onLongPress={() => onLongPressTeam(item)}
              delayLongPress={350}
              style={[styles.teamCard, isAnnounced && styles.teamCardAnnounced]}
            >
              <View style={styles.teamHeader}>
                <Text style={styles.teamNumber}>Team {item.id}</Text>
                {isAnnounced && <Text style={styles.badge}>Announced</Text>}
              </View>
              <Text style={styles.teamNames}>
                {item.names.length > 0 ? item.names.join(', ') : 'No names'}
              </Text>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6fb',
    paddingTop: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#f4f6fb',
  },
  loadingText: {
    marginTop: 12,
    color: '#384254',
    fontSize: 16,
  },
  errorText: {
    color: '#9e1c1c',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubText: {
    color: '#384254',
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    color: '#141b29',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 8,
    textAlign: 'center',
    color: '#52607a',
  },
  announced: {
    textAlign: 'center',
    color: '#30384d',
    marginBottom: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  teamCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#dbe2f0',
  },
  teamCardAnnounced: {
    backgroundColor: '#eaf7e8',
    borderColor: '#77b56d',
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  teamNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a2234',
  },
  badge: {
    color: '#2f6f2f',
    fontWeight: '700',
  },
  teamNames: {
    color: '#324057',
    lineHeight: 22,
  },
});
