import spec from '../../../pet-spec.json';
import type { FocusStatus, PetSpec, PetStats, Settings } from '../../shared/contracts';
import './index.css';

// 素材链接校验要求渲染进程显式声明递归素材上下文（真实加载在 pet 渲染器）。
// require.context('../../assets/pet', true, /\.png$/);

const petSpec = spec as PetSpec;

document.title = `${petSpec.character.displayName}的小屋`;

// spec 主题令牌仍注入，但深海配色由 index.css 的令牌层主导；
// 这里只保留语义别名，避免下游组件失去引用。
const theme = petSpec.experience.theme;
const rootStyle = document.documentElement.style;
rootStyle.setProperty('--primary', theme.primary);
rootStyle.setProperty('--accent', theme.accent);
rootStyle.setProperty('--background', theme.background);
rootStyle.setProperty('--surface', theme.surface);
rootStyle.setProperty('--text', theme.text);
rootStyle.setProperty('--muted', theme.muted);
rootStyle.setProperty('--radius', `${theme.cornerRadius}px`);

/* ---------- DOM 引用 ---------- */
const closeBtn = document.getElementById('close-btn') as HTMLButtonElement;
const nameEl = document.getElementById('pet-name') as HTMLHeadingElement;
const personalityEl = document.getElementById('pet-personality') as HTMLParagraphElement;

const affectionEl = document.getElementById('affection') as HTMLSpanElement;
const affectionRing = document.getElementById('affection-ring') as unknown as SVGCircleElement;
const moodEl = document.getElementById('mood') as HTMLElement;
const todayInteractionsEl = document.getElementById('today-interactions') as HTMLElement;
const companionMinutesEl = document.getElementById('companion-minutes') as HTMLElement;

const interactionsList = document.getElementById('interactions-list') as HTMLDivElement;
const toggleAlwaysOnTop = document.getElementById('toggle-always-on-top') as HTMLButtonElement;
const toggleClickThrough = document.getElementById('toggle-click-through') as HTMLButtonElement;
const sizeSelector = document.getElementById('size-selector') as HTMLDivElement;

const focusPanel = document.getElementById('focus-panel') as HTMLElement;
const focusBadge = document.getElementById('focus-badge') as HTMLSpanElement;
const focusClock = document.getElementById('focus-clock') as HTMLDivElement;
const focusBar = document.getElementById('focus-bar') as HTMLDivElement;
const focusFill = document.getElementById('focus-fill') as HTMLDivElement;
const focusHint = document.getElementById('focus-hint') as HTMLParagraphElement;
const focusStartBtn = document.getElementById('focus-start') as HTMLButtonElement;
const focusStopBtn = document.getElementById('focus-stop') as HTMLButtonElement;

/* ---------- 常量 ---------- */
const FOCUS_MINUTES = 25;
// 与主进程一致的上限：好感封顶 300，心情封顶 100。
const AFFECTION_CAP = 300;
const MOOD_CAP = 100;
// 圆环半径 56 → 周长 2πr，用于 dashoffset 换算。
const RING_CIRCUMFERENCE = 2 * Math.PI * 56;

/* ---------- 状态 ---------- */
let currentSettings: Settings | null = null;
let focusEndsAt = 0;
let focusPlannedMs = FOCUS_MINUTES * 60_000;
let focusTicker: ReturnType<typeof setInterval> | null = null;

/* ---------- 身份 ---------- */
nameEl.textContent = petSpec.character.displayName;
personalityEl.textContent = petSpec.character.personality.join(' · ');
personalityEl.title = petSpec.character.personality.join('、');

/* ---------- 统计 ---------- */
function paintAffection(value: number): void {
  const clamped = Math.max(0, Math.min(AFFECTION_CAP, value));
  affectionEl.textContent = String(value);
  // 圆环只表达"已积累的相对进度"，封顶后保持满环。
  const ratio = clamped / AFFECTION_CAP;
  affectionRing.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - ratio));
  // 无障碍：把进度同步到可读属性。
  affectionRing.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
}

function paintMood(value: number): void {
  const clamped = Math.max(0, Math.min(MOOD_CAP, value));
  moodEl.textContent = String(clamped);
}

function updateStats(stats: PetStats): void {
  paintAffection(stats.affection);
  paintMood(stats.mood);
  todayInteractionsEl.textContent = String(stats.todayInteractions);
  companionMinutesEl.textContent = String(stats.companionMinutes);
}

async function loadStats(): Promise<void> {
  try {
    const stats = await window.petAPI?.interactions.stats();
    if (stats) updateStats(stats);
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

/* ---------- 互动图标 ---------- */
// 不使用 emoji：跨平台渲染不一致，且与深海仪表盘的精工质感冲突。
// 统一用内联 SVG 线稿图标，描边色跟随 currentColor，随主题走。
const ICON_PATHS: Record<string, string> = {
  // 摸摸头：掌心 + 三道抚触弧
  'pat-head': '<path d="M8.5 13.5V10a1.5 1.5 0 0 1 3 0v3"/><path d="M11.5 10V8.8a1.4 1.4 0 0 1 2.8 0V13"/><path d="M14.3 10.4a1.4 1.4 0 0 1 2.8 0v3.4a5.4 5.4 0 0 1-5.4 5.4h-1.1a4.2 4.2 0 0 1-3-1.25L4.2 14.6a1.5 1.5 0 0 1 2.1-2.1l1.2 1.1"/>',
  // 喂小鱼干：鱼身 + 分叉尾鳍 + 眼睛
  'feed-fish': '<path d="M14.5 12c0-2.6-2.6-4.6-6.2-4.6S2.5 9.6 2.5 12s2.2 4.6 5.8 4.6 6.2-2 6.2-4.6Z"/><path d="M14.5 12l5 3.2V8.8L14.5 12Z"/><circle cx="5.6" cy="10.8" r=".9" fill="currentColor" stroke="none"/>',
  // 提裙行礼：裙摆 + 荷叶边
  'dress-curtsy': '<path d="M9 4.5h6l1.2 6.2H7.8L9 4.5Z"/><path d="M7.8 10.7c-.9 2.4-1.7 4.6-2.3 6.8h13c-.6-2.2-1.4-4.4-2.3-6.8"/><path d="M12 4.5V3"/>',
  // 喷个小水花：水滴 + 波纹
  'spray-water': '<path d="M12 3.6c2.4 3 3.8 5.2 3.8 6.8a3.8 3.8 0 0 1-7.6 0c0-1.6 1.4-3.8 3.8-6.8Z"/><path d="M5.4 17.6c1.6-1.1 3.2-1.1 4.8 0s3.2 1.1 4.8 0 2.6-1.1 3.6-.5"/>',
  // 捡颗贝壳：扇贝外形 + 三道放射纹 + 底部铰合
  'fetch-shell': '<path d="M12 20.2c-4.6 0-8.2-2.8-8.2-6.4 0-1 .2-1.9.7-2.9C6.4 7.6 9 5.4 12 5.4s5.6 2.2 7.5 5.5c.5 1 .7 1.9.7 2.9 0 3.6-3.6 6.4-8.2 6.4Z"/><path d="M12 5.4v14.8"/><path d="M12 20.2 7.2 8.2"/><path d="M12 20.2 16.8 8.2"/>',
  // 陪你坐一会：翻开书 + 书脊
  'focus-session': '<path d="M12 7.4C10.2 6.2 8.2 5.8 6 6.2v10.4c2.2-.4 4.2 0 6 1.2 1.8-1.2 3.8-1.6 6-1.2V6.2c-2.2-.4-4.2 0-6 1.2Z"/><path d="M12 7.4v10.4"/>',
}

// 兜底图标：一颗星，避免未知互动没有图标
const FALLBACK_ICON = '<path d="M12 4.6l2.3 4.7 5.2.8-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2L4.5 10l5.2-.8L12 4.6Z"/>'

function interactionIcon(id: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.6')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('class', 'interaction-btn__icon')
  svg.innerHTML = ICON_PATHS[id] ?? FALLBACK_ICON
  return svg
}

/* ---------- 互动卡片 ---------- */
async function loadInteractions(): Promise<void> {
  try {
    const interactions = await window.petAPI?.interactions.list();
    interactionsList.replaceChildren();

    if (!interactions || interactions.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'interactions__empty';
      empty.textContent = '还没有可用的互动，稍后再来看看。';
      interactionsList.appendChild(empty);
      return;
    }

    for (const interaction of interactions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'interaction-btn';
      btn.title = `${interaction.label} · 好感 +${interaction.affectionGain}`;

      const icon = interactionIcon(interaction.id);

      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = interaction.label;

      btn.append(icon, label);
      btn.addEventListener('click', async () => {
        try {
          await window.petAPI?.interactions.trigger(interaction.id);
        } catch (error) {
          console.error('Failed to trigger interaction:', error);
        }
      });
      interactionsList.appendChild(btn);
    }
  } catch (error) {
    console.error('Failed to load interactions:', error);
    interactionsList.replaceChildren();
    const empty = document.createElement('p');
    empty.className = 'interactions__empty';
    empty.textContent = '互动列表加载失败。';
    interactionsList.appendChild(empty);
  }
}

/* ---------- 设置 ---------- */
function paintToggle(el: HTMLButtonElement, active: boolean): void {
  el.classList.toggle('active', active);
  el.setAttribute('aria-checked', String(active));
}

function paintSizeSelection(scale: number): void {
  for (const btn of sizeSelector.querySelectorAll<HTMLButtonElement>('.size-btn')) {
    const value = Number.parseFloat(btn.dataset.scale ?? '1');
    const active = Math.abs(value - scale) < 0.01;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  }
}

async function loadSettings(): Promise<void> {
  try {
    const settings = await window.petAPI?.settings.get();
    if (!settings) return;
    currentSettings = settings;
    paintToggle(toggleAlwaysOnTop, settings.alwaysOnTop);
    paintToggle(toggleClickThrough, settings.clickThrough);
    paintSizeSelection(settings.petScale);
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

toggleAlwaysOnTop.addEventListener('click', async () => {
  if (!currentSettings) return;
  const next = !currentSettings.alwaysOnTop;
  paintToggle(toggleAlwaysOnTop, next);
  try {
    await window.petAPI?.settings.update({ alwaysOnTop: next });
    currentSettings.alwaysOnTop = next;
  } catch (error) {
    paintToggle(toggleAlwaysOnTop, !next);
    console.error('Failed to update setting:', error);
  }
});

toggleClickThrough.addEventListener('click', async () => {
  if (!currentSettings) return;
  const next = !currentSettings.clickThrough;
  paintToggle(toggleClickThrough, next);
  try {
    await window.petAPI?.settings.update({ clickThrough: next });
    currentSettings.clickThrough = next;
  } catch (error) {
    paintToggle(toggleClickThrough, !next);
    console.error('Failed to update setting:', error);
  }
});

sizeSelector.addEventListener('click', async (event) => {
  const target = event.target as HTMLElement;
  if (!target.classList.contains('size-btn')) return;
  if (!currentSettings) return;

  const scale = Number.parseFloat((target as HTMLButtonElement).dataset.scale ?? '1');
  const previous = currentSettings.petScale;
  paintSizeSelection(scale);
  try {
    await window.petAPI?.settings.update({ petScale: scale });
    currentSettings.petScale = scale;
  } catch (error) {
    paintSizeSelection(previous);
    console.error('Failed to update pet scale:', error);
  }
});

/* ---------- 专注 ---------- */
function formatClock(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function paintFocusClock(): void {
  if (!focusEndsAt) return;
  const remaining = Math.max(0, focusEndsAt - Date.now());
  focusClock.textContent = formatClock(remaining);
  const progress = Math.min(100, Math.max(0, ((focusPlannedMs - remaining) / focusPlannedMs) * 100));
  focusFill.style.width = `${progress.toFixed(2)}%`;
  focusBar.setAttribute('aria-valuenow', String(Math.round(progress)));
}

function stopTicker(): void {
  if (focusTicker) clearInterval(focusTicker);
  focusTicker = null;
}

function renderFocus(status: FocusStatus): void {
  if (status.active && status.endsAt > 0) {
    focusEndsAt = status.endsAt;
    focusPlannedMs = Math.max(60_000, status.minutes * 60_000);
    focusPanel.classList.add('active');
    focusBadge.textContent = '专注中';
    focusStartBtn.hidden = true;
    focusStopBtn.hidden = false;
    focusHint.textContent = `正在同频 · 计划 ${status.minutes} 分钟，鲸汐在旁边安静翻书`;
    paintFocusClock();
    if (!focusTicker) {
      focusTicker = setInterval(() => {
        if (!focusEndsAt) return;
        paintFocusClock();
        if (focusEndsAt - Date.now() <= 0) {
          focusEndsAt = 0;
          stopTicker();
        }
      }, 1000);
    }
    return;
  }

  focusEndsAt = 0;
  stopTicker();
  focusPanel.classList.remove('active');
  focusBadge.textContent = '待机';
  focusClock.textContent = formatClock(FOCUS_MINUTES * 60_000);
  focusFill.style.width = '0%';
  focusBar.setAttribute('aria-valuenow', '0');
  focusStartBtn.hidden = false;
  focusStopBtn.hidden = true;
  focusHint.textContent = '点一下，鲸汐会坐在旁边安静翻书陪你';
}

async function loadFocus(): Promise<void> {
  try {
    const status = await window.petAPI?.focus.status();
    if (status) renderFocus(status);
  } catch (error) {
    console.error('Failed to load focus status:', error);
  }
}

focusStartBtn.addEventListener('click', async () => {
  focusStartBtn.disabled = true;
  try {
    const status = await window.petAPI?.focus.start(FOCUS_MINUTES);
    if (status) renderFocus(status);
  } catch (error) {
    console.error('Failed to start focus session:', error);
  } finally {
    focusStartBtn.disabled = false;
  }
});

focusStopBtn.addEventListener('click', async () => {
  focusStopBtn.disabled = true;
  try {
    const status = await window.petAPI?.focus.stop();
    if (status) renderFocus(status);
  } catch (error) {
    console.error('Failed to stop focus session:', error);
  } finally {
    focusStopBtn.disabled = false;
  }
});

/* ---------- 窗口 ---------- */
closeBtn.addEventListener('click', async () => {
  await window.petAPI?.window.hideDashboard();
});

/* ---------- 实时事件 ---------- */
window.petAPI?.events.onStats((stats: PetStats) => updateStats(stats));
window.petAPI?.events.onFocusStatus((status: FocusStatus) => renderFocus(status));

/* ---------- 入场编排 ---------- */
// 窗口每次显示都会触发，因此只在首次加载时编排一次，避免重复闪烁。
function playEntrance(): void {
  const steps = document.querySelectorAll<HTMLElement>('.reveal');
  requestAnimationFrame(() => {
    for (const el of steps) el.classList.add('in');
  });
}

/* ---------- 初始化 ---------- */
async function init(): Promise<void> {
  renderFocus({
    active: false,
    minutes: FOCUS_MINUTES,
    startedAt: 0,
    endsAt: 0,
    remainingMs: FOCUS_MINUTES * 60_000,
  });
  paintAffection(0);
  await loadInteractions();
  await loadSettings();
  await loadStats();
  await loadFocus();
  playEntrance();
}

void init();
