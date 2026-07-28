import Phaser from 'phaser';
import {
  DIFFICULTY_CONFIG,
  scaleValue,
  getEnemyCount,
  getEnemyHP,
  getEnemyDamage,
  getEnemySpeedMultiplier,
  getPlayerHP,
  getPlayerDamage,
} from '../config/difficulty-config';
import { UpgradeType, UPGRADE_BASE, UPGRADE_MULTIPLIER } from '../upgrades/UpgradeManager';

/**
 * A metric definition for the graph viewer.
 */
interface MetricDef {
  label: string;
  color: string;
  /** Function that returns the value for a given wave number */
  getValue: (wave: number) => number;
  category: string;
  /**
   * Optional range metric: returns { min, max } for a shaded band.
   * When present, getValue returns the "expected" (average) value,
   * and getRange provides the min/max bounds for shading.
   */
  getRange?: (wave: number) => { min: number; max: number };
}

/**
 * BalanceGraphScene — Full-screen debug scene that displays difficulty
 * scaling curves as graphs over wave progression.
 *
 * Layout:
 * - Left sidebar: clickable list of metrics (toggle visibility)
 * - Right area: canvas-drawn line graph (X = wave, Y = value)
 *
 * Controls:
 * - Click sidebar entries to toggle metric visibility
 * - Hover over graph to see crosshair + values at that wave
 * - Mouse wheel: scroll sidebar
 * - G or ESC: return to game
 *
 * Only available when DEV_TOOLS_ENABLED is true.
 */
export class BalanceGraphScene extends Phaser.Scene {
  private metrics: MetricDef[] = [];
  private activeMetrics: Set<number> = new Set();

  // Layout constants
  private readonly SIDEBAR_WIDTH = 220;
  private readonly GRAPH_PADDING = 50;
  private readonly MAX_WAVES = 50;

  // DOM elements
  private sidebarContainer!: HTMLDivElement;
  private graphCanvas!: HTMLCanvasElement;
  private graphCtx!: CanvasRenderingContext2D;
  private rootContainer!: HTMLDivElement;

  // Hover state
  private hoverX: number = -1;
  private hoverY: number = -1;
  private isHovering: boolean = false;

  constructor() {
    super({ key: 'BalanceGraphScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#12121a');

    this.buildMetrics();

    // Start with first two metrics active (Player HP vs Enemy HP)
    this.activeMetrics.add(0);
    this.activeMetrics.add(4);

    this.createDOM();
    this.renderSidebar();
    this.renderGraph();
    this.setupInput();
  }

  shutdown(): void {
    this.rootContainer?.remove();
  }

  // ─── Metrics Definition ───

  private buildMetrics(): void {
    /* eslint-disable @typescript-eslint/explicit-function-return-type */
    this.metrics = [
      // Player (order: HP, ATK, DEF, Speed)
      {
        label: 'Player Max HP',
        color: '#44cc44',
        getValue: (w) => getPlayerHP(w),
        category: 'Player',
      },
      {
        label: 'Player Damage',
        color: '#88ff88',
        getValue: (w) => getPlayerDamage(w),
        category: 'Player',
      },
      {
        label: 'Player Defense',
        color: '#11bb88',
        getValue: () => 0,
        category: 'Player',
      },
      {
        label: 'Player Speed',
        color: '#22ee99',
        getValue: () => 120,
        category: 'Player',
      },

      // Enemies (order: HP, ATK, DEF, Speed, Count)
      {
        label: 'Enemy HP',
        color: '#ff4444',
        getValue: (w) => getEnemyHP(w),
        category: 'Enemies',
      },
      {
        label: 'Enemy Damage',
        color: '#ff8844',
        getValue: (w) => getEnemyDamage(w),
        category: 'Enemies',
      },
      {
        label: 'Enemy Defense',
        color: '#ff5577',
        getValue: () => 0,
        category: 'Enemies',
      },
      {
        label: 'Enemy Speed',
        color: '#ffaa44',
        getValue: (w) => {
          const baseEnemySpeed = 108;
          return baseEnemySpeed * getEnemySpeedMultiplier(w);
        },
        category: 'Enemies',
      },
      {
        label: 'Enemy Count',
        color: '#ff6666',
        getValue: (w) => getEnemyCount(w),
        category: 'Enemies',
      },

      // Multipliers (order: HP, ATK, Speed)
      {
        label: 'Enemy HP Mult',
        color: '#dd4466',
        getValue: (w) => Math.pow(DIFFICULTY_CONFIG.ENEMY_HP_MULTIPLIER, w - 1),
        category: 'Multipliers',
      },
      {
        label: 'Enemy ATK Mult',
        color: '#dd8844',
        getValue: (w) => Math.pow(DIFFICULTY_CONFIG.ENEMY_DAMAGE_MULTIPLIER, w - 1),
        category: 'Multipliers',
      },
      {
        label: 'Enemy Speed Mult',
        color: '#ddaa44',
        getValue: (w) => getEnemySpeedMultiplier(w),
        category: 'Multipliers',
      },

      // Gameplay
      {
        label: 'Heart Drop %',
        color: '#ff44ff',
        getValue: () => DIFFICULTY_CONFIG.HEALTH_PICKUP_DROP_CHANCE * 100,
        category: 'Gameplay',
      },
      {
        label: 'Aggro Cooldown (s)',
        color: '#44ffff',
        getValue: (w) => Math.max(15, 60 - w * 2),
        category: 'Gameplay',
      },
      {
        label: 'Score Reward',
        color: '#ffff44',
        getValue: (w) =>
          Math.round(
            scaleValue(
              DIFFICULTY_CONFIG.ENEMY_SCORE_REWARD_BASE,
              DIFFICULTY_CONFIG.ENEMY_SCORE_REWARD_MULTIPLIER,
              w,
            ),
          ),
        category: 'Gameplay',
      },

      // Roulette Upgrades (order: HP, ATK, DEF, Speed)
      {
        label: 'Roulette: Max HP (Shield)',
        color: '#2980b9',
        getValue: (w) => {
          const basePlayerHP = DIFFICULTY_CONFIG.PLAYER_HP_BASE;
          const prob = 0.25;
          let sum = 0;
          for (let i = 1; i <= w; i++) {
            sum += UPGRADE_BASE[UpgradeType.SHIELD] * Math.pow(UPGRADE_MULTIPLIER[UpgradeType.SHIELD], i - 1);
          }
          return basePlayerHP + Math.round(sum * prob * 100) / 100;
        },
        getRange: (w) => {
          const basePlayerHP = DIFFICULTY_CONFIG.PLAYER_HP_BASE;
          let max = 0;
          for (let i = 1; i <= w; i++) {
            max += UPGRADE_BASE[UpgradeType.SHIELD] * Math.pow(UPGRADE_MULTIPLIER[UpgradeType.SHIELD], i - 1);
          }
          return { min: basePlayerHP, max: basePlayerHP + Math.round(max * 100) / 100 };
        },
        category: 'Roulette',
      },
      {
        label: 'Roulette: ATK (Sword)',
        color: '#c0392b',
        getValue: (w) => {
          const basePlayerDmg = DIFFICULTY_CONFIG.PLAYER_DAMAGE_BASE;
          const prob = 0.25;
          let sum = 0;
          for (let i = 1; i <= w; i++) {
            sum += UPGRADE_BASE[UpgradeType.SWORD] * Math.pow(UPGRADE_MULTIPLIER[UpgradeType.SWORD], i - 1);
          }
          return basePlayerDmg + Math.round(sum * prob * 100) / 100;
        },
        getRange: (w) => {
          const basePlayerDmg = DIFFICULTY_CONFIG.PLAYER_DAMAGE_BASE;
          let max = 0;
          for (let i = 1; i <= w; i++) {
            max += UPGRADE_BASE[UpgradeType.SWORD] * Math.pow(UPGRADE_MULTIPLIER[UpgradeType.SWORD], i - 1);
          }
          return { min: basePlayerDmg, max: basePlayerDmg + Math.round(max * 100) / 100 };
        },
        category: 'Roulette',
      },
      {
        label: 'Roulette: DEF (Heart)',
        color: '#f39c12',
        getValue: (w) => {
          const basePlayerDef = 0;
          const prob = 0.25;
          let sum = 0;
          for (let i = 1; i <= w; i++) {
            sum += UPGRADE_BASE[UpgradeType.GOLDEN_HEART] * Math.pow(UPGRADE_MULTIPLIER[UpgradeType.GOLDEN_HEART], i - 1);
          }
          return basePlayerDef + Math.round(sum * prob * 100) / 100;
        },
        getRange: (w) => {
          const basePlayerDef = 0;
          let max = 0;
          for (let i = 1; i <= w; i++) {
            max += UPGRADE_BASE[UpgradeType.GOLDEN_HEART] * Math.pow(UPGRADE_MULTIPLIER[UpgradeType.GOLDEN_HEART], i - 1);
          }
          return { min: basePlayerDef, max: basePlayerDef + Math.round(max * 100) / 100 };
        },
        category: 'Roulette',
      },
      {
        label: 'Roulette: SPD (Boots)',
        color: '#27ae60',
        getValue: (w) => {
          const basePlayerSpeed = 120;
          const prob = 0.25;
          let sum = 0;
          for (let i = 1; i <= w; i++) {
            sum += UPGRADE_BASE[UpgradeType.WINGED_BOOTS] * Math.pow(UPGRADE_MULTIPLIER[UpgradeType.WINGED_BOOTS], i - 1);
          }
          return basePlayerSpeed + Math.round(sum * prob * 100) / 100;
        },
        getRange: (w) => {
          const basePlayerSpeed = 120;
          let max = 0;
          for (let i = 1; i <= w; i++) {
            max += UPGRADE_BASE[UpgradeType.WINGED_BOOTS] * Math.pow(UPGRADE_MULTIPLIER[UpgradeType.WINGED_BOOTS], i - 1);
          }
          return { min: basePlayerSpeed, max: basePlayerSpeed + Math.round(max * 100) / 100 };
        },
        category: 'Roulette',
      },
    ];
    /* eslint-enable @typescript-eslint/explicit-function-return-type */
  }

  // ─── DOM Creation ───

  private createDOM(): void {
    // Root overlay container
    this.rootContainer = document.createElement('div');
    this.rootContainer.id = 'balance-graph-root';
    this.rootContainer.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      display: flex;
      z-index: 20000;
      font-family: 'Courier New', monospace;
    `;

    // Sidebar
    this.sidebarContainer = document.createElement('div');
    this.sidebarContainer.style.cssText = `
      width: ${this.SIDEBAR_WIDTH}px;
      min-width: ${this.SIDEBAR_WIDTH}px;
      height: 100%;
      background: #1a1a2e;
      border-right: 1px solid #333;
      overflow-y: auto;
      padding: 10px 0;
    `;
    this.rootContainer.appendChild(this.sidebarContainer);

    // Graph area
    const graphArea = document.createElement('div');
    graphArea.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #12121a;
      padding: 10px;
    `;

    // Title bar
    const titleBar = document.createElement('div');
    titleBar.style.cssText =
      'color: #ffcc00; font-size: 13px; font-weight: bold; margin-bottom: 8px; padding: 4px 8px; background: #00000066; border-radius: 4px;';
    titleBar.textContent =
      'Balance Graphs — Click metrics to toggle | Hover for values | G / ESC to return';
    graphArea.appendChild(titleBar);

    // Canvas
    this.graphCanvas = document.createElement('canvas');
    this.graphCanvas.style.cssText =
      'flex: 1; width: 100%; border-radius: 4px; background: #0a0a14; cursor: crosshair;';
    graphArea.appendChild(this.graphCanvas);

    this.rootContainer.appendChild(graphArea);
    document.body.appendChild(this.rootContainer);

    // Mouse hover events for crosshair
    this.graphCanvas.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = this.graphCanvas.getBoundingClientRect();
      this.hoverX = e.clientX - rect.left;
      this.hoverY = e.clientY - rect.top;
      this.isHovering = true;
      this.renderGraph();
    });

    this.graphCanvas.addEventListener('mouseleave', () => {
      this.isHovering = false;
      this.renderGraph();
    });

    // Size the canvas to its actual pixel size
    // Use a short delay to let the layout settle
    requestAnimationFrame(() => {
      const r = this.graphCanvas.getBoundingClientRect();
      this.graphCanvas.width = r.width * window.devicePixelRatio;
      this.graphCanvas.height = r.height * window.devicePixelRatio;
      this.graphCtx = this.graphCanvas.getContext('2d')!;
      this.graphCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
      this.renderGraph();
    });

    this.graphCtx = this.graphCanvas.getContext('2d')!;
  }

  // ─── Sidebar ───

  private renderSidebar(): void {
    this.sidebarContainer.innerHTML = '';

    let lastCategory = '';

    this.metrics.forEach((metric, index) => {
      // Category header
      if (metric.category !== lastCategory) {
        lastCategory = metric.category;
        const header = document.createElement('div');
        header.style.cssText =
          'color: #6688cc; font-size: 11px; font-weight: bold; padding: 8px 12px 2px; text-transform: uppercase;';
        header.textContent = metric.category;
        this.sidebarContainer.appendChild(header);
      }

      // Metric entry
      const entry = document.createElement('div');
      const isActive = this.activeMetrics.has(index);
      entry.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 12px;
        cursor: pointer;
        font-size: 12px;
        color: ${isActive ? '#fff' : '#666'};
        background: ${isActive ? '#ffffff10' : 'transparent'};
        transition: background 0.1s;
      `;
      entry.addEventListener('mouseenter', () => {
        entry.style.background = '#ffffff18';
      });
      entry.addEventListener('mouseleave', () => {
        entry.style.background = isActive ? '#ffffff10' : 'transparent';
      });

      // Color indicator dot
      const dot = document.createElement('div');
      dot.style.cssText = `
        width: 10px; height: 10px;
        border-radius: 50%;
        background: ${isActive ? metric.color : '#333'};
        border: 1px solid ${metric.color};
        flex-shrink: 0;
      `;

      // Label
      const label = document.createElement('span');
      label.textContent = metric.label;

      entry.appendChild(dot);
      entry.appendChild(label);

      entry.addEventListener('click', () => {
        if (this.activeMetrics.has(index)) {
          this.activeMetrics.delete(index);
        } else {
          this.activeMetrics.add(index);
        }
        this.renderSidebar();
        this.renderGraph();
      });

      this.sidebarContainer.appendChild(entry);
    });
  }

  // ─── Graph Rendering ───

  private renderGraph(): void {
    if (!this.graphCtx) return;

    const canvas = this.graphCanvas;
    const ctx = this.graphCtx;
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;
    const pad = this.GRAPH_PADDING;

    // Clear
    ctx.clearRect(0, 0, w, h);

    const graphW = w - pad * 2;
    const graphH = h - pad * 2;

    if (graphW <= 0 || graphH <= 0) return;

    // Calculate all active series
    const series: { metric: MetricDef; values: number[] }[] = [];
    this.activeMetrics.forEach((idx) => {
      const metric = this.metrics[idx];
      const values: number[] = [];
      for (let wave = 1; wave <= this.MAX_WAVES; wave++) {
        values.push(metric.getValue(wave));
      }
      series.push({ metric, values });
    });

    if (series.length === 0) {
      ctx.fillStyle = '#555';
      ctx.font = '14px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('Select metrics from the sidebar to display', w / 2, h / 2);
      return;
    }

    // Find global min/max Y across all active series (including range bands)
    let minY = Infinity;
    let maxY = -Infinity;
    for (const s of series) {
      for (let i = 0; i < s.values.length; i++) {
        const v = s.values[i];
        if (v < minY) minY = v;
        if (v > maxY) maxY = v;
        // Also consider range bounds for Y scaling
        if (s.metric.getRange) {
          const range = s.metric.getRange(i + 1);
          if (range.min < minY) minY = range.min;
          if (range.max > maxY) maxY = range.max;
        }
      }
    }

    // Add 10% padding to Y range
    const yRange = maxY - minY || 1;
    minY -= yRange * 0.05;
    maxY += yRange * 0.05;

    // ─── Draw grid ───
    ctx.strokeStyle = '#ffffff15';
    ctx.lineWidth = 1;

    // Horizontal grid lines (5 lines)
    const ySteps = 5;
    ctx.font = '10px Courier New';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#666';
    for (let i = 0; i <= ySteps; i++) {
      const y = pad + graphH - (i / ySteps) * graphH;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(pad + graphW, y);
      ctx.stroke();

      const val = minY + (i / ySteps) * (maxY - minY);
      ctx.fillText(this.formatValue(val), pad - 5, y + 3);
    }

    // Vertical grid lines (every 5 waves)
    ctx.textAlign = 'center';
    for (let wave = 1; wave <= this.MAX_WAVES; wave += 5) {
      const x = pad + ((wave - 1) / (this.MAX_WAVES - 1)) * graphW;
      ctx.beginPath();
      ctx.moveTo(x, pad);
      ctx.lineTo(x, pad + graphH);
      ctx.stroke();
      ctx.fillText(`${wave}`, x, pad + graphH + 14);
    }

    // X-axis label
    ctx.fillStyle = '#888';
    ctx.font = '11px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Wave', pad + graphW / 2, h - 5);

    // ─── Draw shaded range bands (behind lines) ───
    for (const s of series) {
      if (!s.metric.getRange) continue;

      const minValues: number[] = [];
      const maxValues: number[] = [];
      for (let wave = 1; wave <= this.MAX_WAVES; wave++) {
        const range = s.metric.getRange(wave);
        minValues.push(range.min);
        maxValues.push(range.max);
      }

      // Draw filled area between min and max
      ctx.beginPath();
      // Top edge (max values, left to right)
      for (let i = 0; i < this.MAX_WAVES; i++) {
        const x = pad + (i / (this.MAX_WAVES - 1)) * graphW;
        const y = pad + graphH - ((maxValues[i] - minY) / (maxY - minY)) * graphH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      // Bottom edge (min values, right to left)
      for (let i = this.MAX_WAVES - 1; i >= 0; i--) {
        const x = pad + (i / (this.MAX_WAVES - 1)) * graphW;
        const y = pad + graphH - ((minValues[i] - minY) / (maxY - minY)) * graphH;
        ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Semi-transparent fill using the metric's color
      ctx.fillStyle = s.metric.color + '25'; // ~15% opacity
      ctx.fill();

      // Dashed border on max edge
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = s.metric.color + '55'; // ~33% opacity
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < this.MAX_WAVES; i++) {
        const x = pad + (i / (this.MAX_WAVES - 1)) * graphW;
        const y = pad + graphH - ((maxValues[i] - minY) / (maxY - minY)) * graphH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // ─── Draw series ───
    for (const s of series) {
      ctx.strokeStyle = s.metric.color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let i = 0; i < s.values.length; i++) {
        const x = pad + (i / (this.MAX_WAVES - 1)) * graphW;
        const y = pad + graphH - ((s.values[i] - minY) / (maxY - minY)) * graphH;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Draw label at end of line
      const lastVal = s.values[s.values.length - 1];
      const lastX = pad + graphW;
      const lastY = pad + graphH - ((lastVal - minY) / (maxY - minY)) * graphH;
      ctx.fillStyle = s.metric.color;
      ctx.font = '10px Courier New';
      ctx.textAlign = 'left';
      ctx.fillText(` ${s.metric.label}`, lastX + 4, lastY + 3);
    }

    // ─── Draw axes ───
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad, pad + graphH);
    ctx.lineTo(pad + graphW, pad + graphH);
    ctx.stroke();

    // ─── Draw hover crosshair + tooltip ───
    if (this.isHovering) {
      this.drawHoverOverlay(ctx, pad, graphW, graphH, w, h, series, minY, maxY);
    }
  }

  /**
   * Draw crosshair lines, axis value highlights, and tooltip at hover position.
   */
  private drawHoverOverlay(
    ctx: CanvasRenderingContext2D,
    pad: number,
    graphW: number,
    graphH: number,
    _canvasW: number,
    _canvasH: number,
    series: { metric: MetricDef; values: number[] }[],
    minY: number,
    maxY: number,
  ): void {
    const mx = this.hoverX;
    const my = this.hoverY;

    // Only draw if inside graph area
    if (mx < pad || mx > pad + graphW || my < pad || my > pad + graphH) return;

    // Calculate wave and Y value at cursor
    const waveFloat = ((mx - pad) / graphW) * (this.MAX_WAVES - 1) + 1;
    const wave = Math.round(Phaser.Math.Clamp(waveFloat, 1, this.MAX_WAVES));
    const waveIndex = wave - 1;

    const yValue = minY + ((pad + graphH - my) / graphH) * (maxY - minY);

    // Snap X to nearest wave position
    const snappedX = pad + (waveIndex / (this.MAX_WAVES - 1)) * graphW;

    // ─── Dashed crosshair lines ───
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#ffffff55';
    ctx.lineWidth = 1;

    // Vertical line (from X axis up to cursor Y)
    ctx.beginPath();
    ctx.moveTo(snappedX, pad + graphH);
    ctx.lineTo(snappedX, pad);
    ctx.stroke();

    // Horizontal line (from Y axis to cursor X)
    ctx.beginPath();
    ctx.moveTo(pad, my);
    ctx.lineTo(pad + graphW, my);
    ctx.stroke();

    ctx.restore();

    // ─── Highlighted axis values ───
    // Wave number on X axis (white, bold)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Courier New';
    ctx.textAlign = 'center';
    ctx.fillRect(snappedX - 14, pad + graphH + 4, 28, 14);
    ctx.fillStyle = '#000';
    ctx.fillText(`${wave}`, snappedX, pad + graphH + 14);

    // Y value on Y axis (white, bold)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pad - 42, my - 7, 38, 14);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 10px Courier New';
    ctx.textAlign = 'right';
    ctx.fillText(this.formatValue(yValue), pad - 6, my + 4);

    // ─── Data points and tooltip ───
    // Collect values at this wave for all active series
    const tooltipLines: { color: string; label: string; value: string }[] = [];

    for (const s of series) {
      const val = s.values[waveIndex];
      const pointY = pad + graphH - ((val - minY) / (maxY - minY)) * graphH;

      // Draw dot on the line at this wave
      ctx.beginPath();
      ctx.arc(snappedX, pointY, 4, 0, Math.PI * 2);
      ctx.fillStyle = s.metric.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Include range info in tooltip if available
      let valueText = this.formatValue(val);
      if (s.metric.getRange) {
        const range = s.metric.getRange(wave);
        valueText = `${valueText} [${this.formatValue(range.min)}–${this.formatValue(range.max)}]`;
      }

      tooltipLines.push({
        color: s.metric.color,
        label: s.metric.label,
        value: valueText,
      });
    }

    // ─── Tooltip box ───
    if (tooltipLines.length > 0) {
      const tooltipX = snappedX + 12;
      const tooltipY = Math.max(pad, my - 10);
      const lineHeight = 16;
      const tooltipPadding = 8;
      const tooltipH = tooltipLines.length * lineHeight + tooltipPadding * 2 + 16;
      const tooltipW = 240;

      // Adjust position if too close to right edge
      const finalX = tooltipX + tooltipW > pad + graphW ? snappedX - tooltipW - 12 : tooltipX;
      const finalY = tooltipY + tooltipH > pad + graphH ? pad + graphH - tooltipH : tooltipY;

      // Background
      ctx.fillStyle = 'rgba(10, 10, 20, 0.92)';
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(finalX, finalY, tooltipW, tooltipH, 4);
      ctx.fill();
      ctx.stroke();

      // Header: Wave number
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 11px Courier New';
      ctx.textAlign = 'left';
      ctx.fillText(`Wave ${wave}`, finalX + tooltipPadding, finalY + tooltipPadding + 10);

      // Values
      tooltipLines.forEach((line, i) => {
        const rowY = finalY + tooltipPadding + 24 + i * lineHeight;

        // Color dot
        ctx.beginPath();
        ctx.arc(finalX + tooltipPadding + 4, rowY - 3, 3, 0, Math.PI * 2);
        ctx.fillStyle = line.color;
        ctx.fill();

        // Label
        ctx.fillStyle = '#ccc';
        ctx.font = '10px Courier New';
        ctx.textAlign = 'left';
        ctx.fillText(line.label, finalX + tooltipPadding + 12, rowY);

        // Value (right-aligned)
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Courier New';
        ctx.textAlign = 'right';
        ctx.fillText(line.value, finalX + tooltipW - tooltipPadding, rowY);
      });
    }
  }

  private formatValue(val: number): string {
    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}k`;
    if (Math.abs(val) >= 100) return `${Math.round(val)}`;
    if (Math.abs(val) >= 10) return `${val.toFixed(1)}`;
    return `${val.toFixed(2)}`;
  }

  // ─── Input ───

  private setupInput(): void {
    this.input.keyboard?.on('keydown-G', () => this.returnToGame());
    this.input.keyboard?.on('keydown-ESC', () => this.returnToGame());
  }

  private returnToGame(): void {
    this.rootContainer?.remove();
    this.scene.stop('BalanceGraphScene');
    this.scene.wake('GameScene');
  }
}
