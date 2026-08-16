/**
 * Home layout editor — pick which sections appear on the Today screen, their
 * scale (small/medium/large, widget-style) and their order (drag the ≡
 * handle). Sections/widgets can be removed (they return to the "+" menu) and
 * new widgets (charts) are added through "+". "Save" persists the layout to
 * settings.json.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings, HomeSectionConfig, HomeSectionId, HomeSectionSize, DEFAULT_HOME_LAYOUT, HOME_SECTION_IDS } from '../data/settings';
import { TKey, useT } from '../i18n';
import { colors, radius, spacing, typography } from '../theme';
import { Button, Sheet } from './ui';
import { Reveal } from './motion';

const SECTION_LABELS: Record<HomeSectionId, TKey> = {
  progress: 'dailyProgress',
  stats: 'atAGlance',
  schedule: 'schedule',
  tasks: 'tasks',
  habits: 'habits',
  routines: 'routines',
  reminders: 'reminders',
  money: 'moneyToday',
  goals: 'goals',
  quicknote: 'quickNote',
  chartMoney: 'widgetChartMoney',
  chartHabits: 'widgetChartHabits',
  chartFocus: 'widgetChartFocus',
  chartTasks: 'widgetChartTasks',
  moneyBalance: 'widgetMoneyBalance',
  spendCat: 'widgetSpendCat',
};

const SECTION_ICONS: Record<HomeSectionId, keyof typeof Ionicons.glyphMap> = {
  progress: 'speedometer-outline',
  stats: 'grid-outline',
  schedule: 'calendar-outline',
  tasks: 'checkbox-outline',
  habits: 'repeat-outline',
  routines: 'refresh-outline',
  reminders: 'alarm-outline',
  money: 'wallet-outline',
  goals: 'flag-outline',
  quicknote: 'document-text-outline',
  chartMoney: 'bar-chart-outline',
  chartHabits: 'analytics-outline',
  chartFocus: 'timer-outline',
  chartTasks: 'checkbox-outline',
  moneyBalance: 'wallet-outline',
  spendCat: 'pie-chart-outline',
};

const SIZES: HomeSectionSize[] = ['small', 'medium', 'large'];

/** Preview box height mirrors the section's size, like a widget resize. */
function previewHeight(size: HomeSectionSize): number {
  return size === 'small' ? 26 : size === 'medium' ? 44 : 64;
}

export function HomeLayoutModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const layout = useSettings((s) => s.homeLayout);
  const setHomeLayout = useSettings((s) => s.setHomeLayout);
  const [draft, setDraft] = useState<HomeSectionConfig[]>(layout);
  const [addOpen, setAddOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dy, setDy] = useState(0);

  // Refs so the once-created PanResponders never see stale values.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const heightsRef = useRef<number[]>([]);
  const dragIndexRef = useRef(0);
  const handlersRef = useRef({ start: (_i: number) => {}, move: (_dy: number) => {}, end: () => {} });

  useEffect(() => {
    if (visible) {
      setDraft(layout);
      setAddOpen(false);
      setDragIdx(null);
      setDy(0);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const startDrag = (index: number) => {
    dragIndexRef.current = index;
    setDragIdx(index);
    setDy(0);
  };
  const moveDrag = (gestureDy: number) => {
    setDy(gestureDy);
    const from = dragIndexRef.current;
    const heights = heightsRef.current;
    if (heights.length === 0) return;
    // Absolute position of the dragged row's midpoint (rows may vary in height).
    let topBefore = 0;
    for (let k = 0; k < from; k++) topBefore += heights[k] || 0;
    const rowMid = topBefore + gestureDy + (heights[from] || 0) / 2;
    // Find which row's vertical span contains the midpoint.
    let acc = 0;
    let target = heights.length - 1;
    for (let k = 0; k < heights.length; k++) {
      const h = heights[k] || 0;
      if (rowMid <= acc + h) {
        target = k;
        break;
      }
      acc += h;
    }
    if (target !== from) {
      const next = [...draftRef.current];
      const [item] = next.splice(from, 1);
      next.splice(target, 0, item);
      draftRef.current = next;
      setDraft(next);
      const hs = [...heights];
      const [h] = hs.splice(from, 1);
      hs.splice(target, 0, h);
      heightsRef.current = hs;
      dragIndexRef.current = target;
    }
  };
  const endDrag = () => {
    setHomeLayout(draftRef.current); // persist the final order
    setDragIdx(null);
    setDy(0);
  };
  handlersRef.current = { start: startDrag, move: moveDrag, end: endDrag };

  const set = (index: number, patch: Partial<HomeSectionConfig>) => {
    commit(draft.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const removeSection = (index: number) => {
    commit(draft.filter((_, i) => i !== index));
  };

  const addSection = (id: HomeSectionId) => {
    if (draft.some((s) => s.id === id)) return;
    commit([...draft, { id, enabled: true, size: 'medium' as const }]);
    setAddOpen(false);
  };

  const resetLayout = () => {
    commit(DEFAULT_HOME_LAYOUT.map((id) => ({ id, enabled: true, size: 'large' as const })));
  };

  const commit = (next: HomeSectionConfig[]) => {
    setDraft(next);
    setHomeLayout(next); // live: Today re-renders + persists to settings.json
  };

  const addable = HOME_SECTION_IDS.filter((id) => !draft.some((s) => s.id === id));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Sheet style={{ maxHeight: '85%' }}>
          <View style={styles.header}>
            <Text style={typography.title}>{t('homeLayout')}</Text>
            <Button title={t('done')} small onPress={onClose} />
          </View>
          <ScrollView style={{ flex: 1 }} scrollEnabled={dragIdx === null} contentContainerStyle={{ paddingBottom: spacing.lg }}>
            {draft.map((section, i) => (
              <LayoutRow
                key={section.id}
                section={section}
                index={i}
                isDragging={dragIdx === i}
                dragDy={dy}
                onRowLayout={(h) => {
                  heightsRef.current[i] = h;
                }}
                handlersRef={handlersRef}
                onSet={(patch) => set(i, patch)}
                onRemove={() => removeSection(i)}
              />
            ))}
          </ScrollView>

          {addOpen && (
            <Reveal key="addmenu" distance={8}>
            <View style={styles.addMenu}>
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>{t('addWidget')}</Text>
              {addable.length === 0 ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>{t('allWidgetsAdded')}</Text>
              ) : (
                addable.map((id) => (
                  <Pressable key={id} style={styles.addRow} onPress={() => addSection(id)}>
                    <Ionicons name={SECTION_ICONS[id]} size={16} color={colors.accent} />
                    <Text style={[typography.body, { flex: 1, fontSize: 14 }]}>{t(SECTION_LABELS[id])}</Text>
                    <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                  </Pressable>
                ))
              )}
            </View>
            </Reveal>
          )}

          <View style={styles.footer}>
            <Button title={`+ ${t('addWidget')}`} small variant={addOpen ? 'primary' : 'ghost'} onPress={() => setAddOpen((v) => !v)} />
            <Button title={t('reset')} small variant="ghost" onPress={resetLayout} />
          </View>
        </Sheet>
      </View>
    </Modal>
  );
}

function LayoutRow({
  section,
  index,
  isDragging,
  dragDy,
  onRowLayout,
  handlersRef,
  onSet,
  onRemove,
}: {
  section: HomeSectionConfig;
  index: number;
  isDragging: boolean;
  dragDy: number;
  onRowLayout?: (h: number) => void;
  handlersRef: React.MutableRefObject<{ start: (i: number) => void; move: (dy: number) => void; end: () => void }>;
  onSet: (patch: Partial<HomeSectionConfig>) => void;
  onRemove: () => void;
}) {
  styles = createStyles();
  const t = useT();
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => handlersRef.current.start(indexRef.current),
      onPanResponderMove: (_e, g) => handlersRef.current.move(g.dy),
      onPanResponderRelease: () => handlersRef.current.end(),
      onPanResponderTerminate: () => handlersRef.current.end(),
    })
  ).current;

  return (
    <View
      onLayout={onRowLayout ? (e) => onRowLayout(e.nativeEvent.layout.height) : undefined}
      style={[styles.row, isDragging && styles.rowDragging, isDragging && { transform: [{ translateY: dragDy }] }]}
    >
      <View style={styles.previewWrap}>
        <View style={[styles.preview, { height: previewHeight(section.size) }]}>
          <Ionicons name={SECTION_ICONS[section.id]} size={14} color={colors.accent} />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.body, { fontSize: 14 }]}>{t(SECTION_LABELS[section.id])}</Text>
        <View style={styles.sizeChips}>
          {SIZES.map((size) => (
            <Pressable key={size} onPress={() => onSet({ size })} style={[styles.sizeChip, section.size === size && { backgroundColor: colors.accent }]}>
              <Text style={[styles.sizeChipText, section.size === size && { color: '#fff' }]}>{size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Pressable onPress={onRemove} hitSlop={8} style={styles.iconBtn} accessibilityLabel={t('removeSection')}>
        <Ionicons name="trash-outline" size={19} color={colors.danger} />
      </Pressable>
      <View {...pan.panHandlers} style={styles.dragHandle} accessibilityLabel={t('dragReorder')}>
        <Ionicons name="reorder-three-outline" size={22} color={colors.textSecondary} />
      </View>
    </View>
  );
}

let styles = createStyles();

function createStyles() {
  return StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  rowDragging: { zIndex: 10, elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  previewWrap: { width: 34, justifyContent: 'center', alignItems: 'center' },
  preview: {
    width: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeChips: { flexDirection: 'row', gap: 4, marginTop: 5 },
  sizeChip: {
    width: 30,
    height: 24,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  iconBtn: { padding: 4 },
  dragHandle: { padding: 8, marginLeft: 2 },
  addMenu: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    gap: 2,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
  },
  footer: { marginTop: spacing.md, flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  });
}
