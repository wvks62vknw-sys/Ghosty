/**
 * CHESS tactics: positions with a forced mate in 1, 2 or 3 for the side to move, found in games between
 * the reference engines and proved by exhaustive search (every move and every reply) in chess.ts
 * (`matesIn`, `matingMoves`). One per line: the position (FEN) | mate in n | every first move (UCI) that
 * forces it. gym2.test.mjs re-proves them.
 */
export const CHESS_TACTICS: string[] = [
  "r5k1/1pp3bp/p7/2nppb2/7N/P2q4/KP6/3B4 b - - 5 36|1|d3b1",
  "1k4r1/2p3pp/1p2R3/1P1q4/8/6nP/1PK1p1P1/3r4 b - - 9 46|1|d5d3,d5c4",
  "1r4kr/1pp2pp1/6q1/7p/4b3/2B1P3/PP3PPP/2RB1RK1 b - - 3 25|1|g6g2",
  "7r/5k1p/3p2p1/3N4/4P3/Pn6/2p2PPP/6K1 b - - 2 34|1|c2c1q,c2c1r",
  "2kr3r/p4ppp/8/3P4/4pb2/3bP2P/PBq2P2/4K3 b - - 2 27|1|c2e2",
  "5r1r/1pp1k2p/p2n4/3b4/8/2P5/1P6/K7 b - - 5 43|1|f8f1",
  "3r2k1/6p1/p6P/8/8/8/p5q1/4K3 b - - 0 57|1|a2a1q,a2a1r",
  "r5k1/8/8/8/P7/2q5/K7/3r4 b - - 0 67|1|d1a1,a8a4",
  "4r1k1/1pp2pp1/1q2p2p/3pNb2/3P4/4B3/K3PPPP/5B1R b - - 12 29|1|e8a8",
  "1k6/7p/8/1p2p3/6q1/5p2/5P1K/8 b - - 1 43|1|g4g2",
  "5k1r/prp2p2/7p/4p3/4Rb2/8/5PP1/6KR b - - 1 31|2|b7b1",
  "5rk1/pRp2pp1/3b3p/8/8/3r1P1P/5PP1/4K2R b - - 0 23|2|f8e8",
  "2kr1b1r/ppp2ppp/8/3p4/3P2P1/1P6/P1bQP2q/R3KBR1 b Q - 1 16|2|h2h4",
  "1k4r1/1pp2p1B/8/p3P3/8/2q5/2P4P/3K4 b - - 0 31|2|g8g2",
  "3r2k1/pp3pp1/6b1/6q1/2P1n3/4b2B/PP6/1K1R4 b - - 1 32|2|e4c3",
  "3rr1k1/2q2p2/4b1p1/6P1/3B4/p1p5/P1P4b/R3R2K b - - 13 40|2|e6d5",
  "1r4k1/ppp2pp1/3qp2p/3p4/1b1Pb3/1P2B1P1/K3PPP1/3R1B1R b - - 0 22|2|d6a6",
  "r5kr/p1p2ppp/4p3/8/3PbBP1/8/PPq1P1P1/K2R1B1R b - - 1 18|2|c2d1,a8b8",
  "1k1r4/1pp2pp1/p3b1p1/b7/3p4/6P1/1K1p4/7r b - - 1 42|2|d2d1q,a5c3",
  "1k1r4/1pp2ppB/6P1/2P5/8/p6r/P6P/1K6 b - - 0 35|2|h3c3",
  "5rk1/1p3p1p/6P1/p7/3qP3/P7/2r3P1/7K b - - 0 32|3|d4e4,d4d2,d4f2",
  "3rkb1r/ppp1pppp/8/3QPb1n/6P1/P3B3/2PKPP1P/q4B1R b k g3 0 13|3|d8d5",
  "6k1/5ppp/4p3/3p4/K7/3r4/6rP/8 b - - 1 53|3|g2b2",
  "8/6kp/8/2q5/8/7P/3r4/4R2K b - - 12 69|3|c5d5,c5c6",
  "3r2k1/ppp2ppp/5b2/q7/1P3P2/P2P3P/K1R3P1/4rBR1 b - b3 0 32|3|e1a1",
  "8/5kpp/R7/8/2P5/7r/PKP5/6q1 b - - 0 39|3|g1d4",
  "1r1r3k/p1p2ppp/2b1p3/q7/2pPpPP1/2P5/P1PBP1BP/K2RR3 b - - 27 28|3|d8d5",
  "8/5p1k/p6p/8/5K2/3r4/1r6/8 b - - 0 55|3|b2b4",
  "1k6/p1p2pp1/p7/5bPp/3b3P/K7/7r/8 b - - 9 44|3|f5e6,c7c5",
  "3r2k1/p4ppp/8/8/2p2q2/P6P/P1P2PP1/1K3R2 b - - 1 32|3|d8b8",
];
