/**
 * GO capture puzzles on small boards: Black to play and capture the White group through the target point
 * within n Black moves, whatever White does (White may pass). Proved by exhaustive search in go.ts
 * (`captures`, `capturingMoves`). One per line: board size | points row by row from the top-left (. X O) |
 * a stone of the target group (point index) | n | every first move that does it (point indices).
 * gym2.test.mjs re-proves them.
 */
export const GO_PUZZLES: string[] = [
  "5|XXO...X...X..OXO...XOOX..|15|1|16",
  "7|OOX..X..O.X..OXX.X....XXOX.X..XO.O..OOXO.OO.O...X|24|1|32",
  "6|.X.XOOX....XXOO..X.X....X.X.X.....O.|4|1|10",
  "5|X.XX.OOX..XX.......X.O..O|5|1|1",
  "6|O.X.XO..XOXO.OOXX.OO.X.XO.........X.|5|1|17",
  "7|.O..XX.OOOOXOO.OO..XX.O...X...X...X....O...OX..OX|12|1|6",
  "6|X..O.X....X........X.O..XX.XXXOO....|30|1|32",
  "6|.XXO.O...X..OXX...OO..O....XX..O.XOO|34|1|29",
  "5|X..X.OXX.XOX.OX......X...|5|1|15",
  "5|OXO.OO.X..XO...XO.....X.X|0|1|6",
  "7|OOO..OO.....X...X.XO...XXOOO..O...O.O..OOOO....OO|5|2|4",
  "6|.X....OO.XOOO...XX...O.O..X..OX.OO.O|10|2|4",
  "5|.OOX..X.XXXOX.....O...X..|1|2|7",
  "5|..O....OOO.XX.X.OXOO..XX.|18|2|13",
  "6|X.X.OO.O..X.OO...X....X.XO.X..O.O.X.|4|2|3,11",
  "6|.XXOOO..X.OO..O.X..O.......X.OO.....|3|2|9,17",
  "6|....XX..XOOO....X.X.OOX.O..OXOO..O..|24|2|25",
  "7|.O..OOO.....O.OXOXO.OO.X..OXXXX.......O......X.OO|14|2|7",
  "5|...XOX.......X.OO.XO....O|19|2|14,23",
  "5|XX.X.X.O.....XO.XX.OOO..X|20|2|15,22",
  "7|.....O.X.........XX.OO..X..OOX..X..O..XO.OOOXX.O.|21|3|22",
  "7|.OO.OO....XX.X.OOX...........O..X..XOX...X.X..XXX|4|3|3",
  "6|XX...OX.O.O..X.OXXO..X...XX..OXXX..O|29|3|28",
  "5|.XXX....O..XOO.O.XX..X..X|8|3|7",
  "6|.OXO..O..XXO..O..O.XO...O.O..XO.XO..|11|3|16",
  "7|.XXO.X.O...XXO..X.X.XO.X..X....X..XX.O...XXOO..OO|47|3|46",
  "6|.....OOXX.X.O.O....X.O....OX.X.X.X.X|6|3|13",
  "5|.X....X..X..X.X.OX.....OO|23|3|22",
];
