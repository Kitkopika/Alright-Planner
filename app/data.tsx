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
import { useT } from '../src/i18n';
import { ImportMode, ImportReport, parseDocument } from '../src/data/exchange';
import { colors, radius, spacing, typography } from '../src/theme';
import { Button, Card, Chip, ChipRow, EmptyState, SectionHeader } from '../src/components/ui';

export default function DataScreen() {
  styles = createStyles();
  const t = useT();
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
        t('importComplete'),
        `${t('added')} ${result.report.added} · ${t('updated')} ${result.report.updated} · ${t('conflicts')} ${result.report.conflicting} · ${t('deleted')} ${result.report.deleted} · ${t('invalid')} ${result.report.dropped + result.report.duplicates}`,
        [{ text: t('ok') }]
      );
    } catch (e) {
      Alert.alert(t('importFailed'), e instanceof Error ? e.message : String(e));
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
      Alert.alert(t('importFailed'), e instanceof Error ? e.message : String(e));
    }
  };

  const restoreBackup = async () => {
    setBusy(true);
    try {
      const { getDocumentStore } = await import('../src/data/persistence');
      const backup = await getDocumentStore().readBackup();
      if (!backup) {
        Alert.alert(t('noBackup'), 'There is no backup file on this device yet.');
        return;
      }
      await doImport(backup, 'replace');
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = () => {
    Alert.alert(t('eraseConfirmTitle'), t('eraseConfirmMsg'), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Erase',
        style: 'destructive',
        onPress: async () => {
          await resetAll();
          Alert.alert(t('erased'), t('erasedMsg'));
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={typography.body}>{t('dataIntro')}</Text>
        <Text style={[typography.caption, { marginTop: spacing.sm }]}>
          {t('deviceLabel')}: {device.name} ({device.id}){lastSavedAt ? ` · ${t('lastSaved')} ${lastSavedAt}` : ''}
        </Text>
      </Card>

      <SectionHeader title={t('exportAll')} />
      <Card>
        <Button title={t('exportAll')} onPress={() => void doExport()} disabled={busy} />
        <Text style={[typography.caption, { marginTop: spacing.sm }]}>{t('exportHint')}</Text>
      </Card>

      <SectionHeader title={t('importTitle')} />
      <Card>
        <ChipRow>
          <Chip label={t('merge')} selected={mode === 'merge'} onPress={() => setMode('merge')} />
          <Chip label={t('replace')} selected={mode === 'replace'} onPress={() => setMode('replace')} />
        </ChipRow>
        <Text style={[typography.caption, { marginTop: spacing.sm, marginBottom: spacing.md }]}>
          {mode === 'merge' ? t('mergeHint') : t('replaceHint')}
        </Text>
        <Button title={t('pickFile')} onPress={() => void pickAndImport()} disabled={busy} />
      </Card>

      <SectionHeader title={t('pasteTitle')} />
      <Card>
        <PasteImport onImport={(text) => void doImport(text, mode)} />
      </Card>

      {report && (
        <>
          <SectionHeader title={t('lastImport')} />
          <Card>
            <SummaryRow label={t('added')} value={report.added} />
            <SummaryRow label={t('updated')} value={report.updated} />
            <SummaryRow label={t('conflicts')} value={report.conflicting} />
            <SummaryRow label={t('deleted')} value={report.deleted} />
            <SummaryRow label={t('invalid')} value={report.dropped} />
            <SummaryRow label={t('duplicates')} value={report.duplicates} />
            <SummaryRow label={t('unchanged')} value={report.unchanged} />
          </Card>
        </>
      )}

      <SectionHeader title={t('backupDanger')} />
      <Card>
        <Button title={t('restoreBackup')} variant="ghost" onPress={() => void restoreBackup()} disabled={busy} style={{ marginBottom: spacing.sm }} />
        <Button title={t('eraseAll')} variant="danger" onPress={confirmReset} disabled={busy} />
      </Card>

      <EmptyState icon="shield-checkmark-outline" title={t('privateByDesign')} subtitle={t('privateSub')} />
    </ScrollView>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  styles = createStyles();
  return (
    <View style={styles.summaryRow}>
      <Text style={typography.body}>{label}</Text>
      <Text style={[typography.body, { fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

function PasteImport({ onImport }: { onImport: (text: string) => void }) {
  const t = useT();
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
        <Chip label={t('merge')} selected={mode === 'merge'} onPress={() => setMode('merge')} />
        <Chip label={t('replace')} selected={mode === 'replace'} onPress={() => setMode('replace')} />
      </ChipRow>
      <TextInputArea value={text} onChangeText={setText} placeholder={t('pastePlaceholder')} />
      <Button title={t('previewBtn')} variant="ghost" small onPress={preview} style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }} />
      {planText ? <Text style={[typography.caption, { marginTop: spacing.sm }]}>{planText}</Text> : null}
      <Button title={t('importPasted')} onPress={() => onImport(text)} disabled={!text.trim()} style={{ marginTop: spacing.sm }} />
    </View>
  );
}

function TextInputArea({ value, onChangeText, placeholder }: { value: string; onChangeText: (t: string) => void; placeholder: string }) {
  styles = createStyles();
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

let styles = createStyles();

function createStyles() {
  return StyleSheet.create({
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
}

