import { UpgradeType, UpgradeResult } from '../upgrades/UpgradeManager';

/**
 * RouletteWheel — visual roulette with spin animation and interaction.
 *
 * Flow:
 * 1. show() → displays wheel stopped with "Click/Tap to spin" prompt
 * 2. User clicks/taps → spin() starts animation toward predetermined result
 * 3. Animation eases out → stops exactly on target segment center
 * 4. Shows result text → "Continue" button appears
 * 5. User clicks Continue → onComplete callback fires → hide()
 */

interface WheelSegment {
  type: UpgradeType;
  color: string;
  label: string;
  resultLabel: string;
  iconSrc: { x: number; y: number; w: number; h: number };
}

const SEGMENTS: WheelSegment[] = [
  {
    type: UpgradeType.SWORD,
    color: '#c0392b',
    label: 'ATK',
    resultLabel: 'DAMAGE UP!',
    iconSrc: { x: 845, y: 315, w: 280, h: 325 },
  },
  {
    type: UpgradeType.SHIELD,
    color: '#2980b9',
    label: 'DEF',
    resultLabel: 'HP UP!',
    iconSrc: { x: 1225, y: 335, w: 260, h: 315 },
  },
  {
    type: UpgradeType.WINGED_BOOTS,
    color: '#27ae60',
    label: 'SPD',
    resultLabel: 'SPEED UP!',
    iconSrc: { x: 390, y: 340, w: 320, h: 290 },
  },
  {
    type: UpgradeType.GOLDEN_HEART,
    color: '#f39c12',
    label: 'HP',
    resultLabel: 'DEFENSE UP!',
    iconSrc: { x: 60, y: 365, w: 250, h: 240 },
  },
];

/** Spin animation config */
const SPIN_TOTAL_ROTATIONS = 4; // full rotations before landing
const SPIN_DURATION_MS = 3000;

export class RouletteWheel {
  private container: HTMLElement | null;
  private canvas: HTMLCanvasElement | null;
  private ctx: CanvasRenderingContext2D | null;
  private currentRotation: number = 0;
  private size: number = 0;
  private elementsImg: HTMLImageElement | null = null;
  private loaded: boolean = false;

  // Interaction state
  private isSpinning: boolean = false;
  private hasSpun: boolean = false;
  private onCompleteCallback: ((result: UpgradeResult) => void) | null = null;
  private pendingResult: UpgradeResult | null = null;
  private animationId: number | null = null;

  // HTML elements
  private promptEl: HTMLElement | null;
  private resultEl: HTMLElement | null;
  private continueBtn: HTMLElement | null;

  constructor() {
    this.container = document.getElementById('roulette-container');
    this.canvas = document.getElementById('roulette-canvas') as HTMLCanvasElement | null;
    this.ctx = this.canvas?.getContext('2d') ?? null;
    this.promptEl = document.getElementById('roulette-prompt');
    this.resultEl = document.getElementById('roulette-result');
    this.continueBtn = document.getElementById('roulette-btn-continue');

    // Load Elements.png for icons
    const img = new Image();
    img.src = '/luck/Elements.png';
    img.onload = () => {
      this.elementsImg = img;
      this.loaded = true;
      this.resize();
      this.draw(this.currentRotation);
    };

    if (this.canvas && this.ctx) {
      this.resize();
      this.draw(0);
    }

    window.addEventListener('resize', () => {
      this.resize();
      this.draw(this.currentRotation);
    });

    // Click/tap to spin
    this.canvas?.addEventListener('pointerdown', () => this.handleInteraction());

    // Continue button
    if (this.continueBtn) {
      this.continueBtn.onclick = () => this.handleContinue();
    }
  }

  /**
   * Show the roulette for a new upgrade phase.
   * @param result The predetermined upgrade result (from UpgradeManager)
   * @param onComplete Called when the player confirms the result
   */
  show(result: UpgradeResult, onComplete: (result: UpgradeResult) => void): void {
    this.pendingResult = result;
    this.onCompleteCallback = onComplete;
    this.isSpinning = false;
    this.hasSpun = false;
    this.currentRotation = 0;

    // Reset UI
    if (this.promptEl) {
      const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      this.promptEl.textContent = isMobile ? 'Tap to Spin!' : 'Click to Spin!';
      this.promptEl.style.display = 'block';
    }
    if (this.resultEl) {
      this.resultEl.textContent = '';
      this.resultEl.style.display = 'none';
    }
    if (this.continueBtn) {
      this.continueBtn.style.display = 'none';
    }

    const backdrop = document.getElementById('roulette-backdrop');
    backdrop?.classList.add('visible');
    this.resize();
    this.draw(0);
  }

  /**
   * Hide the roulette overlay.
   */
  hide(): void {
    const backdrop = document.getElementById('roulette-backdrop');
    backdrop?.classList.remove('visible');
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  // ─── Interaction ───

  private handleInteraction(): void {
    if (this.isSpinning || this.hasSpun || !this.pendingResult) return;
    this.isSpinning = true;
    this.hasSpun = true;

    // Hide prompt
    if (this.promptEl) this.promptEl.style.display = 'none';

    // Start spin animation
    this.startSpinAnimation();
  }

  private handleContinue(): void {
    if (!this.pendingResult) return;
    const result = this.pendingResult;
    this.pendingResult = null;
    this.hide();
    this.onCompleteCallback?.(result);
  }

  // ─── Animation ───

  private startSpinAnimation(): void {
    if (!this.pendingResult) return;

    // Calculate target rotation to land on the correct segment
    const targetSegmentIdx = SEGMENTS.findIndex((s) => s.type === this.pendingResult!.type);
    // Target angle: segment center under pointer (top = 0°)
    // Segment 0 center is at 0°, segment 1 at 90°, etc.
    const segmentCenterDeg = targetSegmentIdx * 90;
    // Total rotation: full spins + landing angle
    const targetRotation = SPIN_TOTAL_ROTATIONS * 360 + segmentCenterDeg;

    const startTime = performance.now();
    const startRotation = this.currentRotation;
    const deltaRotation = targetRotation - startRotation;

    const animate = (now: number): void => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / SPIN_DURATION_MS, 1);

      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const rotation = startRotation + deltaRotation * eased;

      this.currentRotation = rotation;
      this.draw(rotation);

      if (progress < 1) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        // Animation complete
        this.isSpinning = false;
        this.currentRotation = targetRotation;
        this.draw(targetRotation);
        this.showResult();
      }
    };

    this.animationId = requestAnimationFrame(animate);
  }

  private showResult(): void {
    if (!this.pendingResult) return;

    const segment = SEGMENTS.find((s) => s.type === this.pendingResult!.type);
    if (!segment) return;

    // Format value string based on type
    let valueStr: string;
    let unitStr: string;
    if (this.pendingResult.type === UpgradeType.WINGED_BOOTS) {
      valueStr = `+${this.pendingResult.value.toFixed(1)}`;
      unitStr = 'PX/S';
    } else if (this.pendingResult.type === UpgradeType.GOLDEN_HEART) {
      valueStr = `+${Math.round(this.pendingResult.value)}`;
      unitStr = 'DEFENSE';
    } else if (this.pendingResult.type === UpgradeType.SHIELD) {
      valueStr = `+${Math.round(this.pendingResult.value)}`;
      unitStr = 'MAX HP';
    } else {
      valueStr = `+${Math.round(this.pendingResult.value)}`;
      unitStr = 'DAMAGE';
    }

    // Show result text
    if (this.resultEl) {
      this.resultEl.innerHTML = `<span class="roulette-result-title">${segment.resultLabel}</span><br><span class="roulette-result-value">${valueStr} ${unitStr}</span>`;
      this.resultEl.style.display = 'block';
    }

    // Show continue button
    if (this.continueBtn) {
      this.continueBtn.style.display = 'block';
    }
  }

  // ─── Rendering ───

  private resize(): void {
    if (!this.canvas || !this.container) return;

    const containerRect = this.container.getBoundingClientRect();
    const maxSize = Math.min(containerRect.width, containerRect.height, 400);
    this.size = maxSize;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = maxSize * dpr;
    this.canvas.height = maxSize * dpr;
    this.canvas.style.width = `${maxSize}px`;
    this.canvas.style.height = `${maxSize}px`;

    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }

  private draw(rotation: number): void {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const size = this.size;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.42;
    const segmentAngle = Math.PI / 2;

    ctx.clearRect(0, 0, size, size);

    const rotRad = (rotation * Math.PI) / 180;

    // Outer ring shadow
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Draw segments
    for (let i = 0; i < 4; i++) {
      const segment = SEGMENTS[i];
      const startAngle = rotRad + i * segmentAngle - Math.PI / 2 - segmentAngle / 2;
      const endAngle = startAngle + segmentAngle;

      // Segment fill
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = segment.color;
      ctx.fill();
      ctx.strokeStyle = '#2a1808';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Icon (stays upright)
      const midAngle = startAngle + segmentAngle / 2;
      const symbolRadius = radius * 0.55;
      const sx = cx + Math.cos(midAngle) * symbolRadius;
      const sy = cy + Math.sin(midAngle) * symbolRadius;
      const iconSize = size * 0.22;

      if (this.loaded && this.elementsImg) {
        const src = segment.iconSrc;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          this.elementsImg,
          src.x,
          src.y,
          src.w,
          src.h,
          sx - iconSize / 2,
          sy - iconSize / 2,
          iconSize,
          iconSize,
        );
        ctx.imageSmoothingEnabled = true;
      }

      // Label
      ctx.font = `${Math.round(size * 0.04)}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(segment.label, sx, sy + iconSize / 2 + size * 0.03);
    }

    // Outer ring border
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#4a2a0a';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center hub
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#4a2a0a';
    ctx.fill();
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.03, 0, Math.PI * 2);
    ctx.fillStyle = '#f0c040';
    ctx.fill();
  }
}
