import { CaveShuffleAttempt, CaveShuffle } from './cave.js';
import { GridCoord, GridIndex, N, S } from './grid.js';
import { Monogrid, Cursor } from './monogrid.js';
import { Result, OK } from './maze.js';
import { Metalocation, Pos } from '../rom/metalocation.js';
import { Metascreen } from '../rom/metascreen.js';
import { TwoStageCaveShuffle } from './twostage.js';
import { seq } from '../rom/util.js';

type A = CaveShuffleAttempt;

export class RiverCaveShuffle extends TwoStageCaveShuffle {
  // basic problem: missing |- and -| pieces.
  //  one solution would be to just add them
  //  outside of that, we need to switch to a pathgen algo rather
  //  than refinement

  // simple pathgen should be pretty easy w/ grid

  // alternatively, trial removals are further-reaching?
  //  - if we remove a horizontal edge then also remove the
  //    opposite edges of any neighbors, continuing.
  //  - or remove a vertical edge of one...?
  early = 'r';
  maxAttempts = 250;
  validRiverScreens?: Set<number>;

  targetEarly() { return this.params.features?.river ?? 0; }

  // addEarlyFeatures(a: A): Result<void> {
  //   // fill with river and then refine down to the correct size.
  //   //this.fillCave(
  //   return
  // }

  // canRemove(c: string) {
  //   return c === 'c' || c === 'r';
  // }

  // removalMap(a: A, coord: GridCoord): Map<GridCoord, string> {
  //   if ((coord & 0x808) !== 0x800) return new Map([[coord, '']]);
  //   // need to be a little cleverer: horizontal branches are not
  //   // allowed (though we could add them, in which case this gets
  //   // a lot easier), so ensure we're left with a bend instead.
  //   const map = new Map([[coord, '']]);
  //   const left = coord - 8 as GridCoord;
  //   if (a.grid.get(left) === 'r') {
  //     const leftUp = left - 0x800 as GridCoord;
  //     const leftDown = left + 0x800 as GridCoord;
  //     const leftLeft = left - 8 as GridCoord;
  //     // may need to remove another neighbor.
  //     if (a.grid.get(leftUp) === 'r' && a.grid.get(leftDown) === 'r' &&
  //         a.grid.get(leftLeft) === 'r') {
  //       map.set(this.random.nextInt(2) ? leftUp : leftDown, '');
  //     }
  //   }
  //   const right = coord + 8 as GridCoord;
  //   if (a.grid.get(right) === 'r') {
  //     const rightUp = right - 0x800 as GridCoord;
  //     const rightDown = right + 0x800 as GridCoord;
  //     const rightRight = right + 8 as GridCoord;
  //     // may need to remove another neighbor.
  //     if (a.grid.get(rightUp) === 'r' && a.grid.get(rightDown) === 'r' &&
  //         a.grid.get(rightRight) === 'r') {
  //       map.set(this.random.nextInt(2) ? rightUp : rightDown, '');
  //     }
  //   }
  //   return map;
  // }

  preinfer(a: A): Result<void> {
    // Make sure river is actually necessary!
    if ([...this.orig.exits()].length < 2) return OK;
    const override = new Map<GridCoord, string>();
    for (let i = 0 as GridIndex; i < a.grid.data.length; i++) {
      if (a.grid.data[i] === 'r') override.set(a.grid.coord(i), '');
    }
    const parts = a.grid.partition(override);
    const stairParts: unknown[] = [];
    for (let i = 0 as GridIndex; i < a.grid.data.length; i++) {
      if (a.grid.data[i] === '<' || a.grid.data[i] === '>' ||
          (a.grid.data[i] && a.grid.isBorder(a.grid.coord(i)))) {
        stairParts.push(parts.get(a.grid.coord(i)));
      }
    }
    if (new Set(stairParts).size < stairParts.length) {
      //console.error(a.grid.show());
      return {ok: false, fail: `river didn't matter`};
    }
    return super.preinfer(a);
  }

  addLateFeatures(a: A): Result<void> {
    // console.error(a.grid.show());
    // return super.addLateFeatures(a);
    return OK;
  }

  addArenas(a: A, arenas: number): boolean {
    // This version works a little differently, since it runs as an early
    // feature (before refinement) rather than late.  We look for a 3x1
    // block of 'c' screens, zero out all but the middle (which gets the
    // arena), and then afterwards we prune away any newly-disconnected
    // land screens.
    if (!arenas) return true;
    const g = a.grid;
    for (const c of this.random.ishuffle(a.grid.screens())) {
      const middle = (c | 0x808) as GridCoord;
      const left = (middle - 8) as GridCoord;
      const left2 = (left - 8) as GridCoord;
      const right = (middle + 8) as GridCoord;
      const right2 = (right + 8) as GridCoord;
      const up = middle - 0x800 as GridCoord;
      const down = middle + 0x800 as GridCoord;
      if (g.get(middle) !== 'c') continue;
      if (g.get(up) !== 'c') continue;
      if (g.get(down) !== 'c') continue;
      const leftTile =
          g.isBorder(left) ? '' : this.extract(g, left2 - 0x808 as GridCoord);
      const rightTile =
          g.isBorder(right) ? '' : this.extract(g, right2 - 0x808 as GridCoord);
      if (/[^ c]/.test(leftTile + rightTile)) continue;
      if (!g.isBorder(left)) {
        g.set(left, '');
        g.set(left2, '');
        g.set(left2 - 8 as GridCoord, '');
        g.set(left2 - 0x800 as GridCoord, '');
        g.set(left2 + 0x800 as GridCoord, '');
      }
      if (!g.isBorder(right)) {
        g.set(right, '');
        g.set(right2, '');
        g.set(right2 + 8 as GridCoord, '');
        g.set(right2 - 0x800 as GridCoord, '');
        g.set(right2 + 0x800 as GridCoord, '');
      }
      a.fixed.add(middle);
      a.fixed.add(up);
      a.fixed.add(down);
      g.set(middle, 'a');
      arenas--;
      if (!arenas) {
        this.pruneDisconnected(a);
        return true;
      }
    }
    //console.error('could not add arena');
    return false;
  }
}

export class WaterfallRiverCaveShuffle extends RiverCaveShuffle {

  addBlocks = false;

  initialFillEarly(a: A): Result<void> {
    const g = new Monogrid(a.h, a.w, this.getValidEarlyScreens());
    const x0 = 2 + this.random.nextInt(a.w - 4);
    const x1 = 2 + this.random.nextInt(a.w - 4);
    const c = new Cursor(g, a.h - 1, x1);
    c.go(0);
    c.directedPath(this.random, 1, x0);
    c.go(0);

    a.grid.data = g.toGrid('r').data;
    this.addAllFixed(a);
    return OK;
  }

  addEdges(a: A): Result<void> {
    let r = -1;
    const h = (a.h - 1) << 12 | 0x808;
    for (let x = 0; x < a.w; x++) {
      if (a.grid.get((h | (x << 4)) as GridCoord) === 'r') r = x;
    }
    if (r < 0) throw new Error(`no river on bottom edge`);
    const c0 = (h | this.random.nextInt(r) << 4) as GridCoord;
    const c1 =
        (h | (r + 1 + this.random.nextInt(a.w - 1 - r)) << 4) as GridCoord;
    a.grid.set(c0, '>');
    a.grid.set(c0 - 8 as GridCoord, '');
    a.grid.set(c0 + 8 as GridCoord, '');
    a.grid.set(c1, '>');
    a.grid.set(c1 - 8 as GridCoord, '');
    a.grid.set(c1 + 8 as GridCoord, '');
    a.fixed.add(c0);
    a.fixed.add(c1);
    return OK;
  }

  addStairs(): Result<void> { return OK; }

  checkMeta(meta: Metalocation, repl?: Map<Pos, Metascreen>): boolean {
    const opts = repl ? {flight: true, with: repl} : {flight: true};
    const parts = meta.traverse(opts);
    return new Set(parts.values()).size === this.maxPartitions;
  }
}

export class StyxRiverCaveShuffle2 extends RiverCaveShuffle {
  //maxPartitions = 1;
  //addBlocks = false;


  // TODO - come back to the version where it's split
  //      - use the extruding variant to ensure something reasonable?

  // It should be relatively easy to actually extrude one tile at a time...?
  //   - this seems to make overall less interesting structures, but
  //     for totally-separate maps, it works better.
  //   - might be more viable for cases where we want to have a nonempty nucleus



  maxAttempts = 250; // NOTE: this is a very hard shuffle.

  refineMetascreens(a: A, meta: Metalocation): Result<void> {
    let result = super.refineMetascreens(a, meta);
    if (!result.ok) return result;
    // Last step: try to split the river with a pair of dead ends and
    // ensure that it creates 3 separate partitions!
    for (const pos of meta.allPos()) {
      const scr = meta.get(pos);
      const edge = scr.edgeIndex('r');
      let deadEnd: Metascreen|undefined;
      if (edge === 5) {
        deadEnd = meta.rom.metascreens.riverCave_deadEndsNS;
      } else if (edge === 10) {
        deadEnd = meta.rom.metascreens.riverCave_deadEndsWE;
      }
      if (!deadEnd) continue;
      const repl = new Map([[pos, deadEnd]]);

      // Check that there's two separately-reachable screens
      const fly = meta.traverse({with: repl, flight: true});
      const flySets = new Set(fly.values());
      if (flySets.size !== 2) continue;
      const edges =
          [...meta.exits()].filter(e => e[1] === 'edge:bottom').map(e => e[0]);
      if (edges.length !== 2) throw new Error(`bad edges`);
      if (fly.get(edges[0]) === fly.get(edges[1])) continue;

      // Check that there's an area only accessible with flight
      const nofly = meta.traverse({with: repl, flight: false});
      const noflySets = new Set(nofly.values());
      if (noflySets.size < 3) continue;

      meta.set(pos, deadEnd);
      return OK;
    }
    return {ok: false, fail: `could not split map into two\n${meta.show()}`};
  }
}


export class StyxRiverCaveShuffle3 extends CaveShuffle {
  maxPartitions = 3;
  //addBlocks = false;

  fillGrid(a: A): Result<void> {
    // make 2 bottom edge exits
    const edges: number[] = [];
    let size = 0;
    for (const x of this.random.ishuffle(seq(a.w - 2, x => x + 1))) {
      if (edges.length === 1 && (x - edges[0]) ** 2 === 1) continue;
      const c = ((a.h - 1) << 12 | x << 4 | 0x808) as GridCoord;
      a.grid.set(c, 'c');
      a.grid.set(N(c), 'c');
      a.grid.set(S(c), 'n');
      a.fixed.add(c);
      a.fixed.add(N(c));
      a.fixed.add(S(c));
      edges.push(x);
      size++;
      if (edges.length === 2) break;
    }
    // make a river across the bottom.
    let rivers = a.w;
    for (let i = 1; i < 2 * a.w; i++) {
      a.grid.set(((a.h - 2) << 12 | i << 3 | 0x800) as GridCoord, 'r');
    }

    // cut the river between the exits
    const cut =
        this.random.nextInt(Math.abs(edges[0] - edges[1]) - 1) +
        Math.min(edges[0], edges[1]) + 1;
    a.grid.set(((a.h - 1) << 12 | cut << 4 | 0x808) as GridCoord, '');
    // TODO - use 'fixed' more?

    // extend river.
    const riversTarget = this.params.features!.river;
    while (rivers < riversTarget) {
      const added = this.tryExtrude(a, 'r', riversTarget - rivers, 1);
      if (!added) return {ok: false, fail: `failed to extrude river\n${a.grid.show()}`};
      rivers += added;
      size += added;
    }
console.log(a.grid.show());
    // extrude cave.
    const sizeTarget = this.params.size;
    while (size < sizeTarget) {
      const added = this.tryExtrude(a, 'c', sizeTarget - size, 10);
      if (!added) return {ok: false, fail: `failed to extrude cave`};
      size += added;
    }

    return this.addStairs(a, ...(this.params.stairs ?? []));
  }

  refineMetascreens(a: A, meta: Metalocation): Result<void> {
    let result = super.refineMetascreens(a, meta);
    if (!result.ok) {console.log(meta.show());return result;}
    // Last step: try to split the river with a pair of dead ends and
    // ensure that it creates 3 separate partitions!
    for (const pos of meta.allPos()) {
      const scr = meta.get(pos);
      const edge = scr.edgeIndex('r');
      let deadEnd: Metascreen|undefined;
      if (edge === 5) {
        deadEnd = meta.rom.metascreens.riverCave_deadEndsNS;
      } else if (edge === 10) {
        deadEnd = meta.rom.metascreens.riverCave_deadEndsWE;
      }
      if (!deadEnd) continue;
      const repl = new Map([[pos, deadEnd]]);

      // Check that there's two separately-reachable screens
      const fly = meta.traverse({with: repl, flight: true});
      const flySets = new Set(fly.values());
      if (flySets.size !== 2) continue;
      const edges =
          [...meta.exits()].filter(e => e[1] === 'edge:bottom').map(e => e[0]);
      if (edges.length !== 2) throw new Error(`bad edges`);
      if (fly.get(edges[0]) === fly.get(edges[1])) continue;

      // Check that there's an area only accessible with flight
      const nofly = meta.traverse({with: repl, flight: false});
      const noflySets = new Set(nofly.values());
      if (noflySets.size < 3) continue;

      meta.set(pos, deadEnd);
      return OK;
    }
    return {ok: false, fail: `could not split map into two\n${meta.show()}`};
  }
}

export class StyxRiverCaveShuffle extends RiverCaveShuffle {
  addBlocks = false;

  fillGrid(a: A): Result<void> {
    // make 2 bottom edge exits
    const edges: number[] = [];
    let size = 0;
    for (const x of this.random.ishuffle(seq(a.w - 2, x => x + 1))) {
      if (edges.length === 1 && (x - edges[0]) ** 2 <= 1) continue;
      const c = ((a.h - 1) << 12 | x << 4 | 0x808) as GridCoord;
      a.grid.set(c, 'c');
      a.grid.set(N(c), 'c');
      a.grid.set(S(c), 'n');
      a.fixed.add(c);
      a.fixed.add(N(c));
      a.fixed.add(S(c));
      edges.push(x);
      size++;
      if (edges.length === 2) break;
    }
    if (edges.length < 2) return {ok: false, fail: `initial edges`};
    // make a river across the bottom.
    let rivers = a.w;
    const cut =
        this.random.nextInt(Math.abs(edges[0] - edges[1]) - 1) +
        Math.min(edges[0], edges[1]) + 1;
    for (let i = 1; i < 2 * a.w; i++) {
      if (i === 2 * cut + 1) continue;
      a.grid.set(((a.h - 2) << 12 | i << 3 | 0x800) as GridCoord, 'r');
      a.fixed.add(((a.h - 1) << 12 | i << 3 | 0x800) as GridCoord);
    }
    // extend river.
    const riversTarget = this.params.features!.river;
    while (rivers < riversTarget) {
      const added = this.tryAdd(a, {char: 'r'});
      if (!added) return {ok: false, fail: `failed to extrude river\n${a.grid.show()}`};
      rivers += added;
      size += added;
    }
    // extrude cave.
    const sizeTarget = this.params.size;
    while (size < sizeTarget) {
      const added = this.tryAdd(a);
      if (!added) return {ok: false, fail: `failed to extrude cave`};
      size += added;
    }

    return this.addStairs(a, ...(this.params.stairs ?? []));
  }

  // Flight may be required for anything.
  checkMeta() { return true; }

  refineMetascreens(a: A, meta: Metalocation): Result<void> {
    const result = super.refineMetascreens(a, meta);
    if (!result.ok) return result;
    // Check simple conditions: (1) there's an accessible bridge,
    // (2) flight is required for some tile.
    function accessible(map: Map<number, Set<number>>): number {
      let count = 0;
      for (let x = 0; x < meta.width; x++) {
        const pos = (meta.height - 1) << 4 | x
        if (meta.get(pos).isEmpty()) continue;
        count += map.get(pos << 8 | 2)!.size;
      }
      return count;
    }
    const parts1 = accessible(meta.traverse({noFlagged: true}));
    const parts2 = accessible(meta.traverse());
    if (parts1 === parts2) return {ok: false, fail: `bridge didn't matter`};
    const parts3 = accessible(meta.traverse({flight: true}));
    if (parts2 === parts3) return {ok: false, fail: `flight not required`};
    return OK;
  }
}