/**
 * The standard gamepad's button indices, on their own: input.ts re-exports them, and the games made by us
 * (games/shelf.ts) read them while their module loads to build their own pad maps, which input.ts in turn reads. A
 * module with no imports breaks that loop: whichever of the two loads first, these are already here.
 */

/** The standard mapping's button indices (W3C Gamepad, "Remapping"). */
export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;
