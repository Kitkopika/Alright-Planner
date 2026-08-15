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
import { useSettings } from '../../src/data/settings';
import { Category, TransactionKind } from '../../src/core/types';
import { buildSummaries, formatMoney } from '../../src/features/finance';
import { transactionsToCSV } from '../../src/features/financeCsv';
import { dateKey, formatDateKeyDDMM, isoCompare, isoDateTime } from '../../src/core/time';
import { colors, radius, spacing, typography } from '../../src/theme';
import { Badge, Button, Card, Chip, ChipRow, EmptyState, Field, SectionHeader, TextBox } from '../../src/components/ui';
import { DateField, MoneyField, TimeField, combineDateTime, splitDateTime } from '../../src/components/form';
import { DonutChart } from '../../src/components/charts';

type Range = 'today' | 'week' | 'month' | 'year';

export default function MoneyScreen() {
  const data = useLifeOS((s) => s.data);
  const create = useLifeOS((s) => s.create);
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);

  const [range, setRange] = useState<Range>('month');
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<string | null>(null);
  const [txnEditorOpen, setTxnEditorOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionKind>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');

  const summaries = useMemo(() => buildSummaries(data.collections.transactions, data.collections.categories), [data]);
  const summary = summaries[range];

  const txns = useMemo(() => {
    const list = [...data.collections.transactions].filter((t) => !t.deletedAt);
    return list
      .filter((t) => (typeFilter === 'all' ? true : t.kind2 === typeFilter))
      .filter((t) => (categoryFilter === 'all' ? true : t.categoryId === categoryFilter))
      .sort((a, b) => isoCompare(b.occurredAt, a.occurredAt));
  }, [data, typeFilter, categoryFilter]);

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
      <ChipRow style={styles.filters}>
        {(['all', 'expense', 'income'] as const).map((t) => (
          <Chip key={t} label={t === 'all' ? 'All' : t[0].toUpperCase() + t.slice(1)} selected={typeFilter === t} onPress={() => setTypeFilter(t)} />
        ))}
        <Chip label="All categories" selected={categoryFilter === 'all'} onPress={() => setCategoryFilter('all')} />
        {data.collections.categories
          .filter((c) => !c.deletedAt && (typeFilter === 'all' || c.kind2 === typeFilter))
          .map((c) => (
            <Chip key={c.id} label={c.name} selected={categoryFilter === c.id} onPress={() => setCategoryFilter(categoryFilter === c.id ? 'all' : c.id)} />
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
            <View style={styles.donutWrap}>
              <DonutChart
                data={summary.byCategory.map((s) => ({ value: s.cents, color: s.color }))}
                centerLabel={`${Math.round(summary.byCategory[0].pct * 100)}%`}
              />
              <View style={styles.donutLegend}>
                {summary.byCategory.slice(0, 5).map((slice) => (
                  <View key={slice.categoryId || 'none'} style={styles.legendRow}>
                    <View style={[styles.catDot, { backgroundColor: slice.color }]} />
                    <Text style={[typography.caption, { flex: 1 }]} numberOfLines={1}>{slice.name}</Text>
                    <Text style={[typography.caption, { fontWeight: '700' }]}>{formatMoney(slice.cents)}</Text>
                  </View>
                ))}
              </View>
            </View>
            {summary.byCategory.length > 5 ? <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>+{summary.byCategory.length - 5} more</Text> : null}
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
              <Text style={styles.dayLabel}>{formatDateKeyDDMM(day)}</Text>
              {items.map((t) => {
                const cat = data.collections.categories.find((c) => c.id === t.categoryId);
                return (
                  <Card
                    key={t.id}
                    style={styles.txnRow}
                    onPress={() => { setEditingTxn(t.id); setTxnEditorOpen(true); }}
                    onLongPress={() => remove('transactions', t.id)}
                  >
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
      <TransactionEditorModal txnId={editingTxn} visible={txnEditorOpen} onClose={() => setTxnEditorOpen(false)} />
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
  const currency = useSettings((s) => s.currency);
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
      currency,
      categoryId: categoryId || null,
      occurredAt: isoDateTime(new Date()),
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

function TransactionEditorModal({ txnId, visible, onClose }: { txnId: string | null; visible: boolean; onClose: () => void }) {
  const data = useLifeOS((s) => s.data);
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);
  const editing = txnId ? data.collections.transactions.find((t) => t.id === txnId && !t.deletedAt) : undefined;

  const [cents, setCents] = useState(0);
  const [kind2, setKind2] = useState<TransactionKind>('expense');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setCents(editing.amountCents);
      setKind2(editing.kind2);
      setCategoryId(editing.categoryId || null);
      setNote(editing.note || '');
      const { date: d, time: t } = splitDateTime(editing.occurredAt);
      setDate(d);
      setTime(t);
    } else {
      setCents(0);
      setKind2('expense');
      setCategoryId(null);
      setNote('');
      setDate(dateKey(new Date()));
      setTime('');
    }
  }, [visible, editing]);

  const cats = data.collections.categories.filter((c) => !c.deletedAt && c.kind2 === kind2);

  const save = () => {
    if (!editing || cents <= 0) return;
    const occurredAt = combineDateTime(date, time);
    if (!occurredAt) return;
    update('transactions', editing.id, {
      amountCents: cents,
      kind2,
      categoryId: categoryId || null,
      note: note.trim() || undefined,
      occurredAt,
    });
    onClose();
  };

  const del = () => {
    if (editing) {
      remove('transactions', editing.id);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Edit transaction</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <MoneyField cents={cents} onChange={setCents} label="Amount" />
            <Field label="Type">
              <ChipRow>
                <Chip label="Expense" selected={kind2 === 'expense'} onPress={() => { setKind2('expense'); setCategoryId(null); }} />
                <Chip label="Income" selected={kind2 === 'income'} onPress={() => { setKind2('income'); setCategoryId(null); }} />
              </ChipRow>
            </Field>
            <Field label="Category">
              <ChipRow>
                <Chip label="None" selected={!categoryId} onPress={() => setCategoryId(null)} />
                {cats.map((c) => (
                  <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
                ))}
              </ChipRow>
            </Field>
            <Field label="Note">
              <TextBox value={note} onChangeText={setNote} placeholder="Note" />
            </Field>
            <DateField label="Date" value={date} onChange={setDate} />
            <TimeField label="Time" value={time} onChange={setTime} allowClear />
            <View style={styles.actions}>
              <Button title="Delete" variant="danger" onPress={del} style={{ flex: 1 }} />
              <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
              <Button title="Save" onPress={save} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
  donutWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  donutLegend: { flex: 1, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  catAdd: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
});
