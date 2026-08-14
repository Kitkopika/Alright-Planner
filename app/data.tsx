/**
 * Data & Backup: export the whole app to a portable JSON file, import JSON
 * from another device (merge or replace, with a dry-run preview), restore
 * from the rotating backup file, or reset everything.
 *
 * This is the Device A → personal-data.json → Device B flow.
 */

import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useLifeOS } from '../src/data/store';
import { ImportMode, ImportReport, parseDocument } from '../src/data/exchange';
import { colors, radius, spacing, typography } from '../src/theme';
import { Button, Card, Chip, ChipRow, EmptyState, SectionHeader } from '../src/components/ui';

export default function DataScreen() {
  const exportJSON = useLifeOS((s) => s.exportJSON);
  const importJSON = useLifeOS((s) => s.importJSON);
  const previewImport = useLifeOS((s) => s.previewImport);
  const resetAll = useLifeOS((s) => s.resetAll);
  const device = useLifeOS((s) => s.device);
  const lastSavedAt = useLifeOS((s) => s.lastSavedAt);

  const [mode, setMode] = useState<ImportMode>('merge');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const doExport = async () => {
    const text = exportJSON();
    try {
      const file = new File(Paths.cache, 'personal-data.json');
      file.write(text);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export Life OS data' });
        return;
      }
      downloadOnWeb(text, 'personal-data.json');
    } catch (e) {
      console.warn('export failed', e);
      downloadOnWeb(text, 'personal-data.json');
    }
  };

  const downloadOnWeb = (text: string, name: string) => {
    if (Platform.OS !== 'web') return;
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const readPickedText = async (asset: DocumentPicker.DocumentPickerAsset): Promise<string> => {
    if (Platform.OS === 'web' && asset.file) {
      return await asset.file.text();
    }
    if (asset.uri) {
      const f = new File(asset.uri);
      return await f.text();
    }
    throw new Error('No file content.');
  };

  const doImport = async (text: string, importMode: ImportMode) => {
    setBusy(true);
    try {
      const result = await importJSON(text, importMode);
      setReport(result.report);
      Alert.alert(
        'Import complete',
        `Added ${result.report.added} · Updated ${result.report.updated} · Conflicts resolved ${result.report.conflicting} · Deleted ${result.report.deleted} · Skipped ${result.report.unchanged + result.report.dropped + result.report.duplicates}`,
        [{ text: 'OK' }]
      );
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const pickAndImport = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', 'application/octet-stream'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.length) return;
      const text = await readPickedText(picked.assets[0]);
      await doImport(text, mode);
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : String(e));
    }
  };

  const restoreBackup = async () => {
    setBusy(true);
    try {
      const { getDocumentStore } = await import('../src/data/persistence');
      const backup = await getDocumentStore().readBackup();
      if (!backup) {
        Alert.alert('No backup found', 'There is no backup file on this device yet.');
        return;
      }
      await doImport(backup, 'replace');
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = () => {
    Alert.alert('Erase all data?', 'This deletes everything on this device (the JSON file and its backup). Consider exporting first.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Erase',
        style: 'destructive',
        onPress: async () => {
          await resetAll();
          Alert.alert('Erased', 'All local data has been removed.');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={typography.body}>Your data lives in a single portable JSON file on this device. Move it to another device by exporting and importing — IDs and relationships are preserved.</Text>
        <Text style={[typography.caption, { marginTop: spacing.sm }]}>
          Device: {device.name} ({device.id}){lastSavedAt ? ` · Last saved ${lastSavedAt}` : ''}
        </Text>
      </Card>

      <SectionHeader title="Export" />
      <Card>
        <Button title="Export all data (JSON)" onPress={() => void doExport()} disabled={busy} />
        <Text style={[typography.caption, { marginTop: spacing.sm }]}>Shares `personal-data.json` (or downloads it on web).</Text>
      </Card>

      <SectionHeader title="Import" />
      <Card>
        <ChipRow>
          <Chip label="Merge" selected={mode === 'merge'} onPress={() => setMode('merge')} />
          <Chip label="Replace" selected={mode === 'replace'} onPress={() => setMode('replace')} />
        </ChipRow>
        <Text style={[typography.caption, { marginTop: spacing.sm, marginBottom: spacing.md }]}>
          {mode === 'merge'
            ? 'Merge adds/updates entries by ID; newer data wins, nothing local is lost.'
            : 'Replace wipes local data and loads the file as-is (restore).'}
        </Text>
        <Button title="Pick a JSON file…" onPress={() => void pickAndImport()} disabled={busy} />
      </Card>

      <SectionHeader title="Paste JSON" />
      <Card>
        <PasteImport onImport={(text) => void doImport(text, mode)} />
      </Card>

      {report && (
        <>
          <SectionHeader title="Last import summary" />
          <Card>
            <SummaryRow label="Added" value={report.added} />
            <SummaryRow label="Updated" value={report.updated} />
            <SummaryRow label="Conflicts resolved (newer won)" value={report.conflicting} />
            <SummaryRow label="Deleted (newer tombstone)" value={report.deleted} />
            <SummaryRow label="Invalid entries dropped" value={report.dropped} />
            <SummaryRow label="Duplicate IDs collapsed" value={report.duplicates} />
            <SummaryRow label="Unchanged" value={report.unchanged} />
          </Card>
        </>
      )}

      <SectionHeader title="Backup & danger zone" />
      <Card>
        <Button title="Restore from backup file" variant="ghost" onPress={() => void restoreBackup()} disabled={busy} style={{ marginBottom: spacing.sm }} />
        <Button title="Erase all data" variant="danger" onPress={confirmReset} disabled={busy} />
      </Card>

      <EmptyState icon="shield-checkmark-outline" title="Private by design" subtitle="Everything stays on your device. No cloud, no account." />
    </ScrollView>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={typography.body}>{label}</Text>
      <Text style={[typography.body, { fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

function PasteImport({ onImport }: { onImport: (text: string) => void }) {
  const [text, setText] = useState('');
  const previewImport = useLifeOS((s) => s.previewImport);
  const [planText, setPlanText] = useState('');
  const [mode, setMode] = useState<ImportMode>('merge');

  const preview = () => {
    if (!text.trim()) return;
    const plan = previewImport(text, mode);
    if (!plan) {
      const parsed = parseDocument(text);
      Alert.alert('Invalid file', parsed.error || 'Could not parse.');
      return;
    }
    setPlanText(
      `Merge preview → added ${plan.report.added}, updated ${plan.report.updated}, deleted ${plan.report.deleted}, conflicts ${plan.report.conflicting}, duplicates ${plan.report.duplicates}.`
    );
  };

  return (
    <View>
      <ChipRow>
        <Chip label="Merge" selected={mode === 'merge'} onPress={() => setMode('merge')} />
        <Chip label="Replace" selected={mode === 'replace'} onPress={() => setMode('replace')} />
      </ChipRow>
      <TextInputArea value={text} onChangeText={setText} placeholder="Paste the JSON here…" />
      <Button title="Preview" variant="ghost" small onPress={preview} style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }} />
      {planText ? <Text style={[typography.caption, { marginTop: spacing.sm }]}>{planText}</Text> : null}
      <Button title="Import pasted JSON" onPress={() => onImport(text)} disabled={!text.trim()} style={{ marginTop: spacing.sm }} />
    </View>
  );
}

function TextInputArea({ value, onChangeText, placeholder }: { value: string; onChangeText: (t: string) => void; placeholder: string }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      multiline
      style={styles.pasteArea}
      placeholderTextColor={colors.textMuted}
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 80 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  pasteArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 110,
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: 13,
    fontFamily: 'monospace',
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
  },
});
