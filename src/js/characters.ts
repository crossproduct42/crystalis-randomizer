
export class Sprite {
  readonly name: string;
  readonly converter: Map<number, number[]>;
  readonly image: string;
  readonly chrData: number[];
  readonly description?: string;
  constructor(name: string,
              converter: Map<number, number[]>,
              image: string,
              chrData: number[],
              description?: string) {
    this.name = name;
    this.converter = converter;
    this.image = image;
    this.chrData = chrData;
    this.description = description;
  }

  public isCustom = () => { return this.chrData.length != 0; }

  public applyPatch(rom: Uint8Array, expandedPRG: Boolean) {
    if (!this.isCustom()) {
      return;
    }
    for (let [src, dsts] of this.converter) {
      for (let dst of dsts) {
        for (let i=0; i<0x10; ++i) {
          const expandedOffset = expandedPRG ? 0x40000 : 0;
          rom[dst + i + expandedOffset] = this.chrData[src * 0x10 + i];
        }
      }
    }
  }
}

export class CharacterSet {
  private static instance: CharacterSet;
  private readonly simeaReplacements = new Array<Sprite>();

  static simea(): Sprite[] {
    if (!this.instance) this.instance = new CharacterSet();
    return [...this.instance.simeaReplacements];
  }

  constructor() {
    this.simeaReplacements.push(new Sprite("Simea", CustomTilesetMapping.simea(), "images/simea.png", [], "The original main character of Crystalis"));
    this.simeaReplacements.push(new Sprite("Mesia", CustomTilesetMapping.simea(), "images/mesia.png", mesia_patch_data, "Secondary protagonist Mesia takes the spotlight! Artwork by jroweboy"));
  }
}

function toAddr(chr_page: number, nametable: number, tile_number: number): number {
  const baseAddr = 0x40000 + 0x10; // added 0x10 to account for rom header
  return baseAddr + chr_page * 0x2000 + nametable * 0x1000 + tile_number * 0x10;
}

// Provides a lookup from the sample tileset to the CHRROM locations
class CustomTilesetMapping {
  private static instance: CustomTilesetMapping;
  private readonly simeaMapping: Map<number, number[]>;

  static simea() : Map<number, number[]> {
    if (!this.instance) this.instance = new CustomTilesetMapping();
    return this.instance.simeaMapping;
  }

  constructor() {
    this.simeaMapping = this.generatesimeaMapping();
  }

  private generatesimeaMapping() : Map<number, number[]> {
    // For most of the mappings, there is only one location to write it to, but for some, its split across several CHRROM banks.
    // so thats why its a map of tileset number to a list of addresses

    // A CHR tileset is 16 tiles wide, the left 8 tiles are the no armor sprites, the right 8 are the armor sprites
    const ARMOR_TILESET_OFFSET = 0x08;
    // In the original game, the game swaps the two 0x20 size CHR banks for sprites to switch armor/no armor sprites
    const CHR_PAGE_OFFSET = 0x400;

    const mapping = new Map<number, number[]>();
    //////////
    // Walking Down
    // top left
    mapping.set(0x00, [toAddr(8,0,0x1a)]);
    // top right
    mapping.set(0x01, [toAddr(8,0,0x1b)]);
    // mid left
    mapping.set(0x10, [toAddr(8,0,0x00)]);
    // mid right
    mapping.set(0x11, [toAddr(8,0,0x01)]);
    // bot left
    mapping.set(0x20, [toAddr(8,0,0x20)]);
    // bot right
    mapping.set(0x21, [toAddr(8,0,0x21)]);

    //////////
    // Walking Left
    // top left
    mapping.set(0x02, [toAddr(8,0,0x1c)]);
    // top right
    mapping.set(0x03, [toAddr(8,0,0x1d)]);
    // mid left
    mapping.set(0x12, [toAddr(8,0,0x02)]);
    // mid right
    mapping.set(0x13, [toAddr(8,0,0x03)]);
    // mid arm left
    mapping.set(0x14, [toAddr(8,0,0x04)]);
    // mid arm right
    mapping.set(0x15, [toAddr(8,0,0x05)]);
    // bot left
    mapping.set(0x22, [toAddr(8,0,0x22)]);
    // bot right
    mapping.set(0x23, [toAddr(8,0,0x23)]);
    // bot leg left
    mapping.set(0x24, [toAddr(8,0,0x24)]);
    // bot leg right
    mapping.set(0x25, [toAddr(8,0,0x25)]);

    //////////
    // Walking Up
    // Up top left
    mapping.set(0x06, [toAddr(8,0,0x1e)]);
    // Up top right
    mapping.set(0x07, [toAddr(8,0,0x1f)]);
    // Up mid left
    mapping.set(0x16, [toAddr(8,0,0x06)]);
    // Up mid right
    mapping.set(0x17, [toAddr(8,0,0x07)]);
    // Up bot left
    mapping.set(0x26, [toAddr(8,0,0x26)]);
    // Up bot right
    mapping.set(0x27, [toAddr(8,0,0x27)]);

    //////////
    // Up attack
    // Frame 1
    // mid left
    mapping.set(0x40, [toAddr(8,0,0x14)]);
    // mid right
    mapping.set(0x41, [toAddr(8,0,0x15)]);
    // bot left
    mapping.set(0x50, [toAddr(8,0,0x34)]);
    // bot right
    mapping.set(0x51, [toAddr(8,0,0x35)]);

    // Frame 2
    // top left
    mapping.set(0x32, [toAddr(8,0,0x3c)]);
    // top right
    mapping.set(0x33, [toAddr(8,0,0x3d)]);
    // mid left
    mapping.set(0x42, [toAddr(8,0,0x18)]);
    // mid right
    mapping.set(0x43, [toAddr(8,0,0x19)]);
    // bot left
    mapping.set(0x52, [toAddr(8,0,0x38)]);
    // bot right
    mapping.set(0x53, [toAddr(8,0,0x27)]);

    // Frame 3
    // mid left
    mapping.set(0x44, [toAddr(8,0,0x16)]);
    // mid right
    mapping.set(0x45, [toAddr(8,0,0x17)]);
    // bot left
    mapping.set(0x54, [toAddr(8,0,0x36)]);

    ////////
    // Left attack
    // Frame 1
    // mid left
    mapping.set(0x70, [toAddr(8,0,0x0e)]);
    // mid right
    mapping.set(0x71, [toAddr(8,0,0x0f)]);
    // bot left
    mapping.set(0x80, [toAddr(8,0,0x2e)]);
    // bot right
    mapping.set(0x81, [toAddr(8,0,0x2f)]);

    // Frame 2
    // mid left
    mapping.set(0x72, [toAddr(8,0,0x12)]);
    // mid right
    mapping.set(0x73, [toAddr(8,0,0x13)]);
    // bot left
    mapping.set(0x82, [toAddr(8,0,0x30)]);
    // bot right
    mapping.set(0x83, [toAddr(8,0,0x33)]);

    // Frame 3
    // mid left
    mapping.set(0x74, [toAddr(8,0,0x10)]);
    // mid right
    mapping.set(0x75, [toAddr(8,0,0x11)]);
    // bot right
    mapping.set(0x85, [toAddr(8,0,0x31)]);

    //////////
    // Down attack
    // Frame 1
    // mid left
    mapping.set(0xa0, [toAddr(8,0,0x08)]);
    // mid right
    mapping.set(0xa1, [toAddr(8,0,0x09)]);
    // bot left
    mapping.set(0xb0, [toAddr(8,0,0x28)]);

    // Frame 2
    // top left
    mapping.set(0x92, [toAddr(8,0,0x3a)]);
    // top right
    mapping.set(0x93, [toAddr(8,0,0x3b)]);
    // mid left
    mapping.set(0xa2, [toAddr(8,0,0x0c)]);
    // mid right
    mapping.set(0xa3, [toAddr(8,0,0x0d)]);
    // bot left
    mapping.set(0xb2, [toAddr(8,0,0x2c)]);
    // bot right
    mapping.set(0xb3, [toAddr(8,0,0x2d)]);

    // Frame 3
    // mid left
    mapping.set(0xa4, [toAddr(8,0,0x0a)]);
    // mid right
    mapping.set(0xa5, [toAddr(8,0,0x0b)]);
    // bot right
    mapping.set(0xb5, [toAddr(8,0,0x2b)]);

    // Armor mappings
    // Create the armor mappings by using the hardcoded sprite mappings but with the armor offsets
    const noarmor_mappings = new Map(mapping);
    for (let [key, value] of noarmor_mappings) {
      const armor_key = key + ARMOR_TILESET_OFFSET;
      const armor_val = value.map((k) => k + CHR_PAGE_OFFSET);
      mapping.set(armor_key, armor_val);
    }

    /////////
    // The following no armor animations have an armor counterpart, but its unused in the original game.
    // The sprite sheet is arranged so that if we fix it so armor shows in these scenes (death, holding sword, telepathy)
    // Then we can reuse the armor mapping code above.

    // Death
    // Frame 1
    // top left
    mapping.set(0xc0, [toAddr(11,1,0x00)]);
    // top right
    mapping.set(0xc1, [toAddr(11,1,0x01)]);
    // mid left
    mapping.set(0xd0, [toAddr(11,1,0x02)]);
    // mid right
    mapping.set(0xd1, [toAddr(11,1,0x03)]);
    // bot left
    mapping.set(0xe0, [toAddr(11,1,0x04)]);
    // bot right
    mapping.set(0xe1, [toAddr(11,1,0x05)]);

    // Frame 2
    // top left
    mapping.set(0xc2, [toAddr(11,1,0x24)]);
    // top right
    mapping.set(0xc3, [toAddr(11,1,0x25)]);
    // mid left
    mapping.set(0xd2, [toAddr(11,1,0x06)]);
    // mid right
    mapping.set(0xd3, [toAddr(11,1,0x07)]);
    // bot left
    mapping.set(0xe2, [toAddr(11,1,0x26)]);
    // bot right
    mapping.set(0xe3, [toAddr(11,1,0x27)]);

    // Frame 3
    // top left
    mapping.set(0xc4, [toAddr(11,1,0x20)]);
    // top right
    mapping.set(0xc5, [toAddr(11,1,0x21)]);
    // mid left
    mapping.set(0xd4, [toAddr(11,1,0x22)]);
    // mid right
    mapping.set(0xd5, [toAddr(11,1,0x23)]);

    // Frame 4
    // mid left
    mapping.set(0xd6, [toAddr(11,1,0x14)]);
    // mid right
    mapping.set(0xd7, [toAddr(11,1,0x15)]);
    // bot left
    mapping.set(0xe6, [toAddr(11,1,0x16)]);
    // bot right
    mapping.set(0xe7, [toAddr(11,1,0x17)]);

    // Holding sword
    // top left
    mapping.set(0x36, [toAddr(11,1,0x0c)]);
    // top right
    mapping.set(0x37, [toAddr(11,1,0x0d)]);
    // mid left
    mapping.set(0x46, [toAddr(11,1,0x32)]);
    // mid right
    mapping.set(0x47, [toAddr(11,1,0x33)]);
    // bot left
    mapping.set(0x56, [toAddr(11,1,0x2e)]);
    // bot right
    mapping.set(0x57, [toAddr(11,1,0x2f)]);

    // Telepathy
    // Frame 1
    // top left
    mapping.set(0x66, [toAddr(11,1,0x14)]);
    // top right
    mapping.set(0x67, [toAddr(11,1,0x15)]);
    // mid left
    mapping.set(0x76, [toAddr(11,1,0x08)]);
    // mid right
    mapping.set(0x77, [toAddr(11,1,0x09)]);
    // bot left
    mapping.set(0x86, [toAddr(11,1,0x28)]);
    // bot right
    mapping.set(0x87, [toAddr(11,1,0x29)]);

    // Frame 2
    // mid left
    mapping.set(0xa6, [toAddr(11,1,0x0a)]);
    // mid right
    mapping.set(0xa7, [toAddr(11,1,0x0b)]);
    // bot left
    mapping.set(0xb6, [toAddr(11,1,0x2a)]);
    // bot right
    mapping.set(0xb7, [toAddr(11,1,0x2b)]);


    //////////
    // Misc
    // Each sword has their own page of sprites, so apply the change to all pages.
    let copyToAllWeaponPages = (tile: number) => {
      return [
        toAddr(8, 0, tile) + CHR_PAGE_OFFSET * 2,
        toAddr(8, 0, tile) + CHR_PAGE_OFFSET * 3,
        toAddr(8, 1, tile),
        toAddr(8, 1, tile) + CHR_PAGE_OFFSET,
        toAddr(8, 1, tile) + CHR_PAGE_OFFSET * 2,
      ]
    }
    // Swords
    // diagonal left top
    mapping.set(0xf0, copyToAllWeaponPages(0x10));
    // diagonal left bot
    mapping.set(0xf1, copyToAllWeaponPages(0x11));
    // down top
    mapping.set(0xf2, copyToAllWeaponPages(0x12));
    // down bot
    mapping.set(0xf3, copyToAllWeaponPages(0x13));
    // left left
    mapping.set(0xf4, copyToAllWeaponPages(0x14));
    // left right
    mapping.set(0xf5, copyToAllWeaponPages(0x15));
    // TODO: ???
    mapping.set(0xf6, copyToAllWeaponPages(0x16));
    // ???
    mapping.set(0xf7, copyToAllWeaponPages(0x17));
    // Hilt - is only in the page with mesia since its only used in the tower
    mapping.set(0xf8, [toAddr(8, 1, 0xed)]);
    // full length blade
    mapping.set(0xf9, copyToAllWeaponPages(0x19));
    // diagonal right
    mapping.set(0xfa, copyToAllWeaponPages(0x1a));

    // Shields
    // Down
    mapping.set(0xfc, copyToAllWeaponPages(0x30));
    // Left
    mapping.set(0xfd, copyToAllWeaponPages(0x31));
    // Up top
    mapping.set(0xfe, copyToAllWeaponPages(0x32));
    // Up bot
    mapping.set(0xff, copyToAllWeaponPages(0x33));

    return mapping;
  }
}


const mesia_spritesheet_chr = "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";
const mesia_patch_data = Array.from(atob(mesia_spritesheet_chr), c => c.charCodeAt(0))
