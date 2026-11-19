import spec from '../../../pet-spec.json';
import type { PetSpec, Reminder } from '../../shared/contracts';
import './index.css';

const petSpec = spec as PetSpec;

// spec 主题令牌保留注入，深海配色由 index.css 令牌层主导。
const theme = petSpec.experience.theme;
const rootStyle = document.documentElement.style;
rootStyle.setProperty('--primary', theme.primary);
rootStyle.setProperty('--accent', theme.accent);
rootStyle.setProperty('--background', theme.background);
rootStyle.setProperty('--surface', theme.surface);
rootStyle.setProperty('--text', theme.text);
rootStyle.setProperty('--muted', theme.muted);
rootStyle.setProperty('--radius', `${theme.cornerRadius}px`);

/* ---------- DOM ---------- */
const textInput = document.getElementById('reminder-text') as HTMLInputElement;
const timeInput = document.getElementById('reminder-time') as HTMLInputElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
const dismissBtn = document.getElementById('dismiss-btn') as HTMLButtonElement;
const quickRow = document.getElementById('quick-row') as HTMLDivElement;
const hintEl = document.getElementById('compose-hint') as HTMLParagraphElement;

/* ---------- 时间工具 ---------- */
// datetime-local 需要本地时间字符串，不能用 toISOString（那是 UTC）。
function toLocalInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function setDefaultTime(minutesAhead = 60): void {
  const target = new Date();
  target.setMinutes(target.getMinutes() + minutesAhead);
  target.setSeconds(0, 0);
  timeInput.value = toLocalInputValue(target);
}

function paintQuickChips(activeMinutes: number | null): void {
  for (const chip of quickRow.querySelectorAll<HTMLButtonElement>('.chip')) {
    const value = Number(chip.dataset.minutes ?? '0');
    chip.classList.toggle('active', activeMinutes !== null && value === activeMinutes);
  }
}

function setHint(message: string, isError = false): void {
  hintEl.textContent = message;
  hintEl.classList.toggle('is-error', isError);
}

function clearHint(): void {
  hintEl.textContent = '';
  hintEl.classList.remove('is-error');
}

/* ---------- 表单复位 ---------- */
function resetCompose(): void {
  textInput.value = '';
  setDefaultTime();
  paintQuickChips(null);
  clearHint();
}

/* ---------- 快捷时间 ---------- */
quickRow.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  if (!target.classList.contains('chip')) return;
  const minutes = Number(target.dataset.minutes ?? '0');
  if (!Number.isFinite(minutes) || minutes <= 0) return;
  setDefaultTime(minutes);
  paintQuickChips(minutes);
  clearHint();
});

// 手动改时间后，快捷按钮的高亮就不再成立。
timeInput.addEventListener('input', () => paintQuickChips(null));

/* ---------- 保存 ---------- */
async function submit(): Promise<void> {
  const text = textInput.value.trim();
  const rawTime = timeInput.value;

  if (!text) {
    setHint('先写一句要提醒的事吧', true);
    textInput.focus();
    return;
  }

  if (!rawTime) {
    setHint('还需要一个时间', true);
    timeInput.focus();
    return;
  }

  const due = new Date(rawTime);
  if (Number.isNaN(due.getTime())) {
    setHint('这个时间读不出来，换一个试试', true);
    timeInput.focus();
    return;
  }

  if (due.getTime() <= Date.now()) {
    setHint('这个时间已经过去了，往后挪一点', true);
    timeInput.focus();
    return;
  }

  saveBtn.disabled = true;
  try {
    await window.petAPI?.reminders.save({ text, dueAt: due.toISOString() });
    setHint('已经放进海里了');
    resetCompose();
    await window.petAPI?.window.hideReminder();
  } catch (error) {
    console.error('Failed to save reminder:', error);
    setHint('没能保存，再试一次', true);
  } finally {
    saveBtn.disabled = false;
  }
}

saveBtn.addEventListener('click', () => void submit());

// 回车直接提交，符合"写一句话就走"的预期。
textInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    void submit();
  }
});

/* ---------- 关闭 ---------- */
async function dismiss(): Promise<void> {
  resetCompose();
  await window.petAPI?.window.hideReminder();
}

cancelBtn.addEventListener('click', () => void dismiss());
dismissBtn.addEventListener('click', () => void dismiss());

// Esc 关闭
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') void dismiss();
});

/* ---------- 入场编排 ---------- */
function playEntrance(): void {
  requestAnimationFrame(() => {
    for (const el of document.querySelectorAll<HTMLElement>('.reveal')) el.classList.add('in');
  });
}

/* ---------- 主进程事件 ---------- */
// 到点触发的提醒：把内容预填进表单，方便用户直接改期或确认。
window.petAPI?.events.onReminder((reminder: Reminder) => {
  textInput.value = reminder.text;
  const due = new Date(reminder.dueAt);
  if (!Number.isNaN(due.getTime())) timeInput.value = toLocalInputValue(due);
  paintQuickChips(null);
  setHint('这条已经到点了');
});

// 打开写信面板
window.petAPI?.events.onReminderCompose(() => {
  resetCompose();
  playEntrance();
  textInput.focus();
});

/* ---------- 初始化 ---------- */
resetCompose();
playEntrance();
