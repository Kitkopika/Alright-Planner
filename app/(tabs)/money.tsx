/**
 * Money — income & expenses with categories, day/week/month/year summaries,
 * spending statistics, quick entry, and CSV/JSON export.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useLifeOS } from '../../src/data/store';
import { Category, TransactionKind } from '../../src/core/types';
import { buildSummaries, formatMoney } from '../../src/features/finance';
import { transactionsToCSV } from '../../src/features/financeCsv';
import { dateKey, isoCompare } from '../../src/core/time';
import { colors, radius, spacing, typography } from '../../src/theme';
import { Badge, Button, Card, Chip, ChipRow, EmptyState, Field, ProgressBar, SectionHeader, TextBox } from '../../src/components/ui';
import { MoneyField } from '../../src/components/form';

type Range = 'today' | 'week' | 'month' | 'year';

export default function MoneyScreen() {
  const data = useLifeOS((s) => s.data);
  const create = useLifeOS((s) => s.create);
  const remove = useLifeOS((s) => s.remove);

  const [range, setRange] = useState<Range>('month');
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const summaries = useMemo(() => buildSummaries(data.collections.transactions, data.collections.categories), [data]);
  const summary = summaries[range];

  const txns = useMemo(
    () => [...data.collections.transactions].filter((t) => !t.deletedAt).sort((a, b) => isoCompare(b.occurredAt, a.occurredAt)),
    [data]
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof txns>();
    for (const t of txns) {
      const key = dateKey(new Date(t.occurredAt));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    return [...groups.entries()];
  }, [txns]);

  const exportCSV = () => {
    const csv = transactionsToCSV(txns, data.collections.categories);
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'transactions.csv';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const f = new File(Paths.cache, 'transactions.csv');
      f.write(csv);
      void Sharing.isAvailableAsync().then((ok) => {
        if (ok) return Sharing.shareAsync(f.uri, { mimeType: 'text/csv', dialogTitle: 'Export transactions' });
      });
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={typography.title}>Money</Text>
        <View style={styles.headerActions}>
          <Button title="CSV" small variant="ghost" onPress={exportCSV} />
          <Button title="Categories" small variant="ghost" onPress={() => setCategoriesOpen(true)} />
        </View>
      </View>

      <ChipRow style={styles.filters}>
        {(['today', 'week', 'month', 'year'] as Range[]).map((r) => (
          <Chip key={r} label={r[0].toUpperCase() + r.slice(1)} selected={range === r} onPress={() => setRange(r)} />
        ))}
      </ChipRow>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Summary */}
        <Card>
          <View style={styles.summaryRow3}>
            <SummaryCol label="Income" value={formatMoney(summary.incomeCents)} color={colors.success} />
            <SummaryCol label="Spent" value={formatMoney(summary.expenseCents)} color={colors.danger} />
            <SummaryCol label="Net" value={formatMoney(summary.netCents)} color={summary.netCents >= 0 ? colors.text : colors.danger} />
          </View>
          {summary.count > 0 && (
            <Text style={[typography.caption, { marginTop: spacing.sm }]}>{summary.count} transactions</Text>
          )}
        </Card>

        {/* Category breakdown */}
        <SectionHeader title="Spending by category" />
        {summary.byCategory.length === 0 ? (
          <EmptyState icon="pie-chart-outline" title="No spending in this range" />
        ) : (
          <Card>
            {summary.byCategory.map((slice) => (
              <View key={slice.categoryId || 'none'} style={styles.catRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.catHeader}>
                    <View style={[styles.catDot, { backgroundColor: slice.color }]} />
                    <Text style={typography.body}>{slice.name}</Text>
                    <Text style={[typography.body, { fontWeight: '700' }]}>{formatMoney(slice.cents)}</Text>
                  </View>
                  <ProgressBar pct={slice.pct * 100} color={slice.color} height={5} style={{ marginTop: 4 }} />
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Quick entry */}
        <SectionHeader title="Quick entry" />
        <QuickEntry
          categories={data.collections.categories.filter((c) => !c.deletedAt)}
          onSubmit={(payload) => create('transactions', payload)}
        />

        {/* Transactions */}
        <SectionHeader title="Transactions" />
        {grouped.length === 0 ? (
          <EmptyState icon="wallet-outline" title="No transactions yet" />
        ) : (
          grouped.map(([day, items]) => (
            <View key={day}>
              <Text style={styles.dayLabel}>{day}</Text>
              {items.map((t) => {
                const cat = data.collections.categories.find((c) => c.id === t.categoryId);
                return (
                  <Card key={t.id} style={styles.txnRow}>
                    <View style={[styles.txnIcon, { backgroundColor: t.kind2 === 'income' ? colors.successSoft : colors.dangerSoft }]}>
                      <Ionicons name={t.kind2 === 'income' ? 'arrow-down' : 'arrow-up'} size={16} color={t.kind2 === 'income' ? colors.success : colors.danger} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={typography.body} numberOfLines={1}>
                        {t.note || cat?.name || 'Uncategorized'}
                      </Text>
                      <Text style={typography.caption}>{cat?.name || ''}</Text>
                    </View>
                    <Text style={[typography.body, { fontWeight: '700', color: t.kind2 === 'income' ? colors.success : colors.text }]}>
                      {t.kind2 === 'income' ? '+' : '−'}{formatMoney(t.amountCents)}
                    </Text>
                    <Pressable onPress={() => remove('transactions', t.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                    </Pressable>
                  </Card>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      <CategoriesModal visible={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
    </View>
  );
}

function SummaryCol({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={typography.caption}>{label}</Text>
      <Text style={[typography.body, { fontWeight: '700', color }]}>{value}</Text>
    </View>
  );
}

function QuickEntry({ categories, onSubmit }: { categories: Category[]; onSubmit: (p: Record<string, unknown>) => void }) {
  const [cents, setCents] = useState(0);
  const [kind2, setKind2] = useState<TransactionKind>('expense');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const cats = categories.filter((c) => c.kind2 === kind2);

  const submit = () => {
    if (cents <= 0) return;
    onSubmit({
      kind2,
      amountCents: cents,
      currency: 'USD',
      categoryId: categoryId || null,
      occurredAt: new Date().toISOString().slice(0, 16),
      note: note.trim() || undefined,
    });
    setCents(0);
    setNote('');
  };

  return (
    <Card>
      <ChipRow>
        <Chip label="Expense" selected={kind2 === 'expense'} onPress={() => { setKind2('expense'); setCategoryId(null); }} />
        <Chip label="Income" selected={kind2 === 'income'} onPress={() => { setKind2('income'); setCategoryId(null); }} />
      </ChipRow>
      <View style={styles.quickRow}>
        <View style={{ flex: 1 }}>
          <MoneyField cents={cents} onChange={setCents} label="Amount" />
        </View>
        <View style={{ flex: 1.5 }}>
          <Field label="Category">
            <ChipRow>
              <Chip label="—" selected={!categoryId} onPress={() => setCategoryId(null)} />
              {cats.slice(0, 6).map((c) => (
                <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
              ))}
            </ChipRow>
          </Field>
        </View>
      </View>
      <View style={styles.quickRow}>
        <TextBox value={note} onChangeText={setNote} placeholder="Note (optional)" style={{ flex: 1 }} />
        <Button title="Add" onPress={submit} />
      </View>
    </Card>
  );
}

function CategoriesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const data = useLifeOS((s) => s.data);
  const create = useLifeOS((s) => s.create);
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);
  const [name, setName] = useState('');
  const [kind2, setKind2] = useState<TransactionKind>('expense');
  const [budget, setBudget] = useState('');

  const save = () => {
    if (!name.trim()) return;
    create('categories', {
      name: name.trim(),
      kind2,
      monthlyBudgetCents: budget.trim() ? Math.round(parseFloat(budget) * 100) : null,
    });
    setName('');
    setBudget('');
  };

  const cats = data.collections.categories.filter((c) => !c.deletedAt);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Categories</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <ChipRow>
              <Chip label="Expense" selected={kind2 === 'expense'} onPress={() => setKind2('expense')} />
              <Chip label="Income" selected={kind2 === 'income'} onPress={() => setKind2('income')} />
            </ChipRow>
            <View style={styles.catAdd}>
              <TextBox value={name} onChangeText={setName} placeholder="New category name" style={{ flex: 1 }} />
              <Button title="Add" small onPress={save} />
            </View>
            {cats.map((c) => (
              <View key={c.id} style={styles.catRow}>
                <View style={[styles.catDot, { backgroundColor: c.color || colors.accent }]} />
                <Text style={[typography.body, { flex: 1 }]}>{c.name}</Text>
                <Badge text={c.kind2} color={c.kind2 === 'income' ? colors.success : colors.danger} bg={c.kind2 === 'income' ? colors.successSoft : colors.dangerSoft} />
                <Pressable onPress={() => remove('categories', c.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </Pressable>
              </View>
            ))}
            <Button title="Close" variant="ghost" onPress={onClose} style={{ marginTop: spacing.md }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  filters: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  content: { padding: spacing.lg, paddingBottom: 120 },
  summaryRow3: { flexDirection: 'row' },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'space-between' },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  dayLabel: { ...typography.label, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm, paddingVertical: spacing.md },
  txnIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, alignItems: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '80%',
  },
  sheetTitle: { ...typography.title, marginBottom: spacing.lg },
  catAdd: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
});
