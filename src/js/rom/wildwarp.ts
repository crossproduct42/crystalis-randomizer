import {Rom} from '../rom.js';
import {tuple} from './util.js';
import {Writer} from './writer.js';
import {Assembler} from '../asm/assembler.js';

// List of wild warp locations.
export class WildWarp {

  locations: number[];

  constructor(readonly rom: Rom) {
    this.locations = tuple(rom.prg, ADDRESS, COUNT);
  }

  write(w: Writer): void {
    const a = new Assembler();
    a.segment(...SEGMENTS);
    a.org(ORG);
    a.label('WildWarpLocations');
    a.byte(...this.locations);
    a.org(0xcbd9);
    a.instruction('lda', 'WildWarpLocations,y');
    w.modules.push(a.module());
  }
}

const SEGMENTS = ['fe', 'ff'];
const ORG = 0xcbec;

const ADDRESS = 0x3cbec;
const COUNT = 16;
