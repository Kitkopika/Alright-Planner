/**
 * Minimal i18n: English + Thai for the main navigation and key labels.
 * `useT()` reads the current language from Settings.
 */

import { useSettings } from './data/settings';

export const translations = {
  en: {
    appName: 'Alright',
    today: 'Today',
    calendar: 'Calendar',
    tasks: 'Tasks',
    routines: 'Routines',
    money: 'Money',
    goals: 'Goals',
    notes: 'Notes',
    insights: 'Insights',
    settings: 'Settings',
    dataBackup: 'Data & Backup',
    quickNote: 'Quick note',
    schedule: 'Schedule',
    habits: 'Habits',
    reminders: 'Reminders',
    darkMode: 'Dark mode',
    lightMode: 'Light mode',
    systemMode: 'System',
    language: 'Language',
    currency: 'Currency',
    appearance: 'Appearance',
    accentColor: 'Accent color',
    theme: 'Theme',
    about: 'About',
    version: 'Version',
    delete: 'Delete',
    cancel: 'Cancel',
    save: 'Save',
    todayLabel: 'Today',
  },
  th: {
    appName: 'Alright',
    today: 'วันนี้',
    calendar: 'ปฏิทิน',
    tasks: 'งาน',
    routines: 'กิจวัตร',
    money: 'เงิน',
    goals: 'เป้าหมาย',
    notes: 'บันทึก',
    insights: 'สถิติ',
    settings: 'ตั้งค่า',
    dataBackup: 'ข้อมูลและการสำรอง',
    quickNote: 'โน้ตด่วน',
    schedule: 'ตารางเวลา',
    habits: 'นิสัย',
    reminders: 'การแจ้งเตือน',
    darkMode: 'โหมดมืด',
    lightMode: 'โหมดสว่าง',
    systemMode: 'ตามระบบ',
    language: 'ภาษา',
    currency: 'สกุลเงิน',
    appearance: 'รูปลักษณ์',
    accentColor: 'สีหลัก',
    theme: 'ธีม',
    about: 'เกี่ยวกับ',
    version: 'เวอร์ชัน',
    delete: 'ลบ',
    cancel: 'ยกเลิก',
    save: 'บันทึก',
    todayLabel: 'วันนี้',
  },
} as const;

export type TKey = keyof typeof translations.en;

export function useT(): (key: TKey) => string {
  const language = useSettings((s) => s.language);
  return (key: TKey) => translations[language][key] ?? key;
}
