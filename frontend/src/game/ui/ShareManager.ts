/**
 * ShareManager — handles sharing game results via Web Share API with fallbacks.
 *
 * Capabilities:
 * 1. Captures the game over screen as an image (html2canvas-free approach using Canvas API)
 * 2. Shares via Web Share API (with file support on mobile)
 * 3. Falls back to text-only Web Share if files not supported
 * 4. Falls back to clipboard copy if Web Share not available
 */

const GAME_URL = window.location.origin + window.location.pathname;

export class ShareManager {
  private toast: HTMLElement | null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.toast = document.getElementById('share-toast');
  }

  /**
   * Share the game results. Attempts in order:
   * 1. Web Share API with screenshot file
   * 2. Web Share API text-only (if files not supported)
   * 3. Copy text to clipboard (if Web Share not available)
   */
  async share(score: number, wave: number): Promise<void> {
    const text = this.buildShareText(score, wave);

    // Try capturing screenshot
    let imageFile: File | null = null;
    try {
      imageFile = await this.captureScreenshot();
    } catch {
      // Screenshot capture failed — proceed without image
    }

    // Try Web Share API with file
    if (navigator.share && imageFile) {
      try {
        const shareData: ShareData = {
          title: 'Horde Battle: Graveyard Guard',
          text,
          url: GAME_URL,
          files: [imageFile],
        };

        // Check if the browser can share files
        if (navigator.canShare && navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      } catch (err: unknown) {
        // User cancelled or error — fall through to text-only
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    // Try Web Share API text-only
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Horde Battle: Graveyard Guard',
          text,
          url: GAME_URL,
        });
        return;
      } catch (err: unknown) {
        // User cancelled
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(`${text}\n${GAME_URL}`);
      this.showToast('Copied to clipboard!');
    } catch {
      // Last resort: select text in a prompt
      this.showToast('Could not share. Try manually copying.');
    }
  }

  // ─── Private ───

  private buildShareText(score: number, wave: number): string {
    const formattedScore = score.toLocaleString('en-US');
    return `🏆 Supera mi puntuación!\n\n⚔️ Wave: ${wave}\n💀 Score: ${formattedScore}\n\nHorde Battle: Graveyard Guard`;
  }

  /**
   * Capture a styled results card as a PNG image using Canvas.
   * Mirrors the loading screen terrain/character layout for visual consistency.
   *
   * Loading screen terrain uses plains.png at 3x scale (48px tiles):
   *   - Row pattern: top-edge → surface × 3 → bottom-fill
   *   - Columns: left-edge, center × N, right-edge
   *   - Tile coords (col, row) at native 16px:
   *     top:     (1,4), (2,4), (3,4)  = left, center, right
   *     surface: (1,5), (2,5), (3,5)
   *     bottom:  (1,6), (2,6), (3,6)
   */
  private async captureScreenshot(): Promise<File> {
    const width = 600;
    const height = 700;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get canvas context');

    // Load game sprite images
    const [playerImg, skeletonImg, slimeImg, objectsImg, plainsImg] = await Promise.all([
      this.loadImage('/characters/player.png'),
      this.loadImage('/characters/skeleton_swordless.png'),
      this.loadImage('/characters/slime.png'),
      this.loadImage('/objects/objects.png'),
      this.loadImage('/tilesets/plains.png'),
    ]);

    // ─── Background ───
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#12122a');
    gradient.addColorStop(1, '#0a0a15');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // ─── Terrain (matching loading screen exactly) ───
    const T = 16; // native tile size
    const S = 3; // scale factor (same as loading screen)
    const ST = T * S; // 48px scaled tile
    // Fit terrain within border margins (16px each side)
    const terrainMargin = 20;
    const terrainWidth = width - terrainMargin * 2;
    const cols = Math.floor(terrainWidth / ST); // tiles that fit inside margins
    const terrainX = (width - cols * ST) / 2; // center the terrain strip

    // Terrain positioned in lower portion (5 rows like loading screen)
    const terrainBottom = height - 60; // leave space for title below
    const terrainRows = 5; // top + surface×3 + bottom
    const terrainTopY = terrainBottom - terrainRows * ST;

    ctx.imageSmoothingEnabled = false;

    for (let col = 0; col < cols; col++) {
      // Determine source column: first=left(1), last=right(3), middle=center(2)
      const srcCol = col === 0 ? 1 : col === cols - 1 ? 3 : 2;

      // Row 0: Top edge (row 4 in plains.png)
      ctx.drawImage(plainsImg, srcCol * T, 4 * T, T, T, terrainX + col * ST, terrainTopY, ST, ST);

      // Rows 1-3: Surface fill (row 5 in plains.png)
      for (let r = 1; r <= 3; r++) {
        ctx.drawImage(
          plainsImg,
          srcCol * T,
          5 * T,
          T,
          T,
          terrainX + col * ST,
          terrainTopY + r * ST,
          ST,
          ST,
        );
      }

      // Row 4: Bottom fill (row 6 in plains.png)
      ctx.drawImage(
        plainsImg,
        srcCol * T,
        6 * T,
        T,
        T,
        terrainX + col * ST,
        terrainTopY + 4 * ST,
        ST,
        ST,
      );
    }

    // ─── Surface line (where characters/objects rest) ───
    const surfaceY = terrainTopY + ST; // just below the top-edge row

    // ─── Objects on terrain ───
    // Tombstone — left side
    ctx.drawImage(objectsImg, 6 * T, 0, T, T, terrainX + ST, surfaceY - ST + 12, ST, ST);

    // Skull — right side
    ctx.drawImage(
      objectsImg,
      8 * T,
      0,
      T,
      T,
      terrainX + (cols - 2) * ST,
      surfaceY - ST + 12,
      ST,
      ST,
    );

    // Rock — far left on surface
    ctx.drawImage(objectsImg, 0, 1 * T, T, T, terrainX + 4, surfaceY - ST + 16, ST, ST);

    // Rock — far right on surface
    ctx.drawImage(
      objectsImg,
      0,
      1 * T,
      T,
      T,
      terrainX + (cols - 1) * ST - 4,
      surfaceY - ST + 16,
      ST,
      ST,
    );

    // ─── Characters on terrain ───
    const charSize = 48 * S; // 144px

    // Player — left, feet resting on surface
    ctx.drawImage(
      playerImg,
      0,
      0,
      48,
      48,
      terrainX + ST * 2,
      surfaceY - charSize + 24,
      charSize,
      charSize,
    );

    // Skeleton — right side
    ctx.drawImage(
      skeletonImg,
      0,
      0,
      48,
      48,
      terrainX + (cols - 2) * ST - charSize + ST,
      surfaceY - charSize + 24,
      charSize,
      charSize,
    );

    // Slime — center
    const slimeSize = 32 * S; // 96px
    ctx.drawImage(
      slimeImg,
      0,
      0,
      32,
      32,
      terrainX + (cols * ST) / 2 - slimeSize / 2 + 20,
      surfaceY - slimeSize + 16,
      slimeSize,
      slimeSize,
    );

    ctx.imageSmoothingEnabled = true;

    // ─── Game title on terrain surface (like loading screen — below characters, on the green) ───
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillStyle = '#c0392b';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    const titleY = surfaceY + ST * 1.5; // on the green surface area
    ctx.fillText('Horde Battle', terrainX + (cols * ST) / 2, titleY);
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillStyle = '#8e8e8e';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillText('Graveyard Guard', terrainX + (cols * ST) / 2, titleY + 22);
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = '#555';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillText('by D-EXP Team', terrainX + (cols * ST) / 2, titleY + 38);

    // ─── Decorative border ───
    ctx.strokeStyle = '#4a2a0a';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, width - 12, height - 12);
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, width - 24, height - 24);

    // ─── Title: GAME OVER ───
    ctx.font = '30px "Press Start 2P", monospace';
    ctx.fillStyle = '#c0392b';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.fillText('GAME OVER', width / 2, 60);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // ─── Stats ───
    const waveValue = document.getElementById('results-wave-value')?.textContent || '0';
    const scoreValue = document.getElementById('results-score-value')?.textContent || '0';

    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText('WAVE', width / 2 - 100, 115);
    ctx.font = '24px "Press Start 2P", monospace';
    ctx.fillStyle = '#f0c040';
    ctx.fillText(waveValue, width / 2 - 100, 148);

    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText('SCORE', width / 2 + 100, 115);
    ctx.font = '24px "Press Start 2P", monospace';
    ctx.fillStyle = '#f0c040';
    ctx.fillText(scoreValue, width / 2 + 100, 148);

    // ─── Divider ───
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    const divGrad = ctx.createLinearGradient(60, 0, width - 60, 0);
    divGrad.addColorStop(0, 'transparent');
    divGrad.addColorStop(0.5, '#4a2a0a');
    divGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = divGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 170);
    ctx.lineTo(width - 60, 170);
    ctx.stroke();

    // ─── Leaderboard ───
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#f0c040';
    ctx.textAlign = 'center';
    ctx.fillText('Leaderboard', width / 2, 195);

    // Table header
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'left';
    ctx.fillText('#', 50, 216);
    ctx.fillText('Player', 85, 216);
    ctx.textAlign = 'right';
    ctx.fillText('Score', width - 100, 216);
    ctx.fillText('Wave', width - 40, 216);

    // Leaderboard entries
    const lbList = document.getElementById('results-lb-list');
    const lbStartY = 236;
    const rowHeight = 22;

    if (lbList) {
      const rows = lbList.querySelectorAll('.lb-row');
      ctx.font = '8px "Press Start 2P", monospace';
      const maxRows = Math.min(rows.length, 7);

      for (let i = 0; i < maxRows; i++) {
        const row = rows[i];
        const y = lbStartY + i * rowHeight;
        const isCurrent = row.classList.contains('results-lb-current');

        if (isCurrent) {
          ctx.fillStyle = 'rgba(76, 175, 80, 0.15)';
          ctx.fillRect(40, y - 12, width - 80, rowHeight - 2);
          ctx.strokeStyle = 'rgba(76, 175, 80, 0.4)';
          ctx.lineWidth = 1;
          ctx.strokeRect(40, y - 12, width - 80, rowHeight - 2);
        } else if (i < 3) {
          const colors = [
            'rgba(240, 192, 64, 0.08)',
            'rgba(192, 192, 192, 0.06)',
            'rgba(205, 127, 50, 0.06)',
          ];
          ctx.fillStyle = colors[i];
          ctx.fillRect(40, y - 12, width - 80, rowHeight - 2);
        }

        const rankEl = row.querySelector('.lb-col-rank');
        const nameEl = row.querySelector('.lb-col-name');
        const scoreEl = row.querySelector('.lb-col-score');
        const waveEl = row.querySelector('.lb-col-wave');

        ctx.textAlign = 'left';
        ctx.fillStyle = i === 0 ? '#f0c040' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#888';
        ctx.fillText(rankEl?.textContent || '', 50, y);
        ctx.fillStyle = isCurrent ? '#4caf50' : '#ccc';
        ctx.fillText(nameEl?.textContent || '', 85, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#f0c040';
        ctx.fillText(scoreEl?.textContent || '', width - 100, y);
        ctx.fillStyle = '#aaa';
        ctx.fillText(waveEl?.textContent || '', width - 40, y);
      }
    }

    // ─── Call to action ───
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillStyle = '#7ecbff';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillText('🏆 Supera mi puntuación!', width / 2, terrainTopY - 15);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Convert to blob then file
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/png');
    });

    return new File([blob], 'horde-battle-results.png', { type: 'image/png' });
  }

  /**
   * Load an image from URL and return it as an HTMLImageElement.
   */
  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }

  private showToast(message: string): void {
    if (!this.toast) return;
    this.toast.textContent = message;
    this.toast.classList.add('visible');

    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast?.classList.remove('visible');
    }, 3000);
  }
}
