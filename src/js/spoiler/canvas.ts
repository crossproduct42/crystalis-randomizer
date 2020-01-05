import {die} from '../assert.js';
import {Rom} from '../rom.js';

// Wrapper around a canvas with built-in capability to do some useful
// things like displaying specific sprites and text.  Also understands
// the ROM's built-in palettes.

export class Canvas {

  readonly element: HTMLDivElement;
  overlay: Uint32Array;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly palettes: Uint32Array;

  private _height: number;
  private _width: number;
  private _minY: number;
  private _maxY: number;
  private _minX: number;
  private _maxX: number;
  private data: Uint32Array;

  constructor(readonly rom: Rom, height: number, width: number) {
    this._width = width;
    this._height = height;
    this.element = document.createElement('div');
    this.canvas = document.createElement('canvas');
    this.element.appendChild(this.canvas);
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d') || die();
    this._minX = this._minY = Infinity;
    this._maxX = this._maxY = -Infinity;
    this.data = new Uint32Array(width * height);
    this.overlay = new Uint32Array(width * height);
    this.palettes = new Uint32Array(0x400);

    // initialize palettes
    for (let i = 0; i < 0x100; i++) {
      for (let j = 0; j < 4; j++) {
        const color = COLORS[rom.palettes[i].color(j)];
        this.palettes[i << 2 | j] = color | 0xff000000;
      }
    }
  }

  private resizeWidth(arr: Uint32Array, width: number): Uint32Array {
    const data = new Uint32Array(width * this._height);
    const min = Math.min(width, this._width);
    for (let y = 0; y < this._height; y++) {
      data.subarray(y * width, y + width + min)
          .set(arr.subarray(y * this._width, y * this._width + min));
    }
    return data;
  }

  private resizeHeight(arr: Uint32Array, height: number): Uint32Array {
    const data = new Uint32Array(this._width * height);
    const min = this._width * Math.min(height, this._height);
    data.subarray(0, min).set(arr.subarray(0, min));
    return data;
  }

  get width() { return this._width; }
  set width(width: number) {
    this.data = this.resizeWidth(this.data, width);
    if (this.overlay) this.overlay = this.resizeWidth(this.overlay, width);
    this._width = width;
    this.canvas.width = width;
  }

  get height() { return this._height; }
  set height(height: number) {
    this.data = this.resizeHeight(this.data, height);
    if (this.overlay) this.overlay = this.resizeHeight(this.overlay, height);
    this._height = height;
    this.canvas.height = height;
  }

  get minX() { return this._minX; }
  get maxX() { return this._maxX; }
  get minY() { return this._minY; }
  get maxY() { return this._maxY; }

  clear(background?: number) {
    this._minX = this._minY = Infinity;
    this._maxX = this._maxY = -Infinity;
    const fillColor = background != null ? this.palettes[background << 2] : 0;
    this.data.fill(fillColor);
    //this.overlay = undefined;
    //this.overlay.fill(0);
  }

  toDataUrl(cropToContent: boolean = false) {
    // TODO - how to crop to content?  get a data url for subset?
    // https://stackoverflow.com/questions/34242155/how-to-crop-canvas-todataurl
    return this.canvas.toDataURL('image/png');
  }

  render() {
    const data = this.ctx.getImageData(0, 0, this._width, this._height);
    const uint8 = new Uint8Array(this.data.buffer);
    data.data.set(uint8);
    this.ctx.putImageData(data, 0, 0);

    // Add overlay if present
    if (this.overlay == null) return;
    const c2 = document.createElement('canvas');
    c2.width = this.canvas.width;
    c2.height = this.canvas.height;
    const ctx2 = c2.getContext('2d') || die();
    const data2 = ctx2.getImageData(0, 0, c2.width, c2.height);
    const uint8_2 = new Uint8Array(this.overlay.buffer);
    data2.data.set(uint8_2);
    ctx2.putImageData(data2, 0, 0);
    this.ctx.drawImage(c2, 0, 0);
  }

  // attr = palette << 2 | vflip << 1 | hflip
  tile(x: number, y: number, id: number, attr: number) {
    if (x < 0 || y < 0 || x + 8 >= this._width || y + 8 >= this._height) return;
    const pat = this.rom.patterns[id].flip(attr << 6);
    for (let r = 0; r < 8; r++) {
      let hi = pat.pixels[8 | r] << 1;
      let lo = pat.pixels[r];
      for (let c = 7; c >= 0; c--) {
        const z = hi & 2 | lo & 1;
        hi >>>= 1; lo >>>= 1;
        if (z) {
          this.data[(y + r) * this._width + x + c] =
              this.palettes[attr & 0x3fc | z];
        }
      }
    }
    this._minX = Math.min(this._minX, x);
    this._maxX = Math.max(this._maxX, x + 8);
    this._minY = Math.min(this._minY, y);
    this._maxY = Math.max(this._maxY, y + 8);
  }

  metatile(y: number, x: number, id: number, locid: number, frame = 0) {
    const loc = this.rom.locations[locid];
    const patterns = [...loc.tilePatterns];
    if (loc.animation) {
      // NOTE: This will automatically take care of corrupted desert graphcis
      patterns[1] = this.rom.tileAnimations[loc.animation].pages[frame & 7];
    }
    const palettes = [...loc.tilePalettes, 0x7f];
    const tileset = this.rom.tilesets[(loc.tileset & 0x7f) >>> 2];
    const palette = palettes[tileset.attrs[id]];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const tile = tileset.tiles[r << 1 | c][id];
        const pattern = patterns[tile & 0x80 ? 1 : 0] << 6 | tile & 0x7f;
        const x1 = x + (c << 3);
        const y1 = y + (r << 3);
        this.tile(x1, y1, pattern, palette << 2);
      }
    }
  }

  /**
   * @param offset usually 0 or 0x40, but sometimes is a one-off.
   * @param frame animation frame.
   */
  metasprite(y: number, x: number, id: number, locid: number,
             offset = 0, frame = 0) {
    const loc = this.rom.locations[locid];
    let metasprite = this.rom.metasprites[id];
    // NOTE: this is sword of wind - else pat[1] and pal[1] get +1,2,3 added
    const patterns = [0, 1, ...loc.spritePatterns];
    const palettes = [0x40, 0x42, ...loc.spritePalettes];
    let mirrored = false;
    if (metasprite.mirrored != null) {
      metasprite = this.rom.metasprites[metasprite.mirrored];
      mirrored = true;
    }
    if (!metasprite || !metasprite.used) return;
    const version = frame & metasprite.frameMask;
    for (let [dx, dy, attr, tile] of metasprite.sprites[version]) {
      //  becomes attr byte, maybe with #$20 (priority) ORed in
      if (dx == 0x80) break;
      dx = signed(dx);
      dy = signed(dy);
      tile = (tile + offset) & 0xff;
      const patternPage = patterns[tile >> 6];
      const palette = palettes[attr & 3];
      const pattern = patternPage << 6 | tile & 0x3f;
      if (mirrored) {
        dx = -8 - dx;
        attr ^= 0x40;
      }
      this.tile(x + dx, y + dy, pattern, palette << 2 | attr >> 6);
    }
  }

  text(y: number, x: number, text: string, palette = 0x12) {
    for (let i = 0; i < text.length; i++) {
      this.tile(
          x + 8 * i, y, text.charCodeAt(i) | 0xf00, palette << 2);
    }            
  }
}

const COLORS = [
  0x525252, 0xB40000, 0xA00000, 0xB1003D, 0x740069, 0x00005B, 0x00005F, 0x001840,
  0x002F10, 0x084A08, 0x006700, 0x124200, 0x6D2800, 0x000000, 0x000000, 0x000000,
  0xC4D5E7, 0xFF4000, 0xDC0E22, 0xFF476B, 0xD7009F, 0x680AD7, 0x0019BC, 0x0054B1,
  0x006A5B, 0x008C03, 0x00AB00, 0x2C8800, 0xA47200, 0x000000, 0x000000, 0x000000,
  0xF8F8F8, 0xFFAB3C, 0xFF7981, 0xFF5BC5, 0xFF48F2, 0xDF49FF, 0x476DFF, 0x00B4F7,
  0x00E0FF, 0x00E375, 0x03F42B, 0x78B82E, 0xE5E218, 0x787878, 0x000000, 0x000000,
  0xFFFFFF, 0xFFF2BE, 0xF8B8B8, 0xF8B8D8, 0xFFB6FF, 0xFFC3FF, 0xC7D1FF, 0x9ADAFF,
  0x88EDF8, 0x83FFDD, 0xB8F8B8, 0xF5F8AC, 0xFFFFB0, 0xF8D8F8, 0x000000, 0x000000,
];

function signed(x: number): number {
  return x < 0x80 ? x : x - 0x100;
}
