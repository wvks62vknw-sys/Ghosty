/** Starter library: computer science foundations (algorithms, systems, compilers, hardware). */
import type { StarterDoc } from './types';

export const CS: StarterDoc[] = [
  {
    id: 'algorithms-advanced',
    title: 'Advanced Algorithms and Data Structures',
    text: `# Graph theory essentials

A graph G = (V, E) has vertices V and edges E. Store sparse graphs as adjacency lists (Map from node to neighbour list), dense graphs as an adjacency matrix. Directed vs undirected, weighted vs unweighted decide the algorithm.

Breadth-first search (BFS) visits nodes in order of distance (number of edges) from the start, using a FIFO queue and a visited set. Time O(V + E). It finds shortest paths in unweighted graphs. Proof idea: when a node is first dequeued, every node at a smaller distance has already been dequeued, so its recorded distance is minimal.

Depth-first search (DFS) explores as deep as possible first, using recursion or an explicit stack. Time O(V + E). Uses: cycle detection (a back edge to a node on the current recursion stack means a cycle in a directed graph), topological sorting (reverse post-order), connected components, articulation points and bridges (Tarjan's low-link values), strongly connected components.

Strongly connected components (SCC): Tarjan's algorithm (one DFS with low-link values and a stack) or Kosaraju's (DFS on G for finish order, then DFS on the transposed graph in reverse finish order). Both O(V + E). Condensing SCCs gives a DAG.

Topological sort orders a DAG so every edge goes forward. Kahn's algorithm repeatedly removes nodes with in-degree 0; if nodes remain, the graph has a cycle. Used for build systems, task scheduling, spreadsheet recalculation.

# Shortest paths

Dijkstra's algorithm (non-negative weights): keep a min-priority queue of (distance, node). Pop the closest unfinished node; relax each edge (if dist[u] + w < dist[v], update and push). With a binary heap O((V + E) log V). Correctness relies on non-negative weights: once popped, a node's distance cannot improve.

Bellman-Ford handles negative weights: relax every edge V - 1 times, O(VE). A further improvement on the V-th pass proves a negative cycle.

Floyd-Warshall computes all-pairs shortest paths in O(V^3): for k, for i, for j: d[i][j] = min(d[i][j], d[i][k] + d[k][j]).

A* search is Dijkstra ordered by g(n) + h(n), where h is a heuristic estimate of the remaining cost. If h never overestimates (admissible) A* returns an optimal path; if it is also consistent (h(u) <= w(u, v) + h(v)) no node is expanded twice. Grids: Manhattan distance for 4-way moves, octile or Chebyshev for 8-way.

# Minimum spanning trees and flows

Minimum spanning tree (connect all nodes with least total weight): Kruskal sorts edges and adds each one that joins two different components, using union-find (O(E log E)). Prim grows one tree from a start node with a priority queue. Both are justified by the cut property: the lightest edge crossing any cut belongs to some MST.

Union-find (disjoint set union): parent array; find with path compression, union by rank or size. Near-constant amortised time per operation (inverse Ackermann).

Maximum flow: Ford-Fulkerson augments along paths in the residual graph; Edmonds-Karp uses BFS paths, O(V E^2); Dinic's algorithm uses level graphs and blocking flows, O(V^2 E) and much faster in practice. Max-flow equals min-cut. Bipartite matching is max flow with unit capacities (or Hopcroft-Karp in O(E sqrt V)).

# Trees

Binary search tree: left < node < right; search, insert, delete O(height). Unbalanced trees degrade to O(n). Self-balancing trees keep height O(log n): AVL trees (heights of children differ by at most 1, rotations after updates), red-black trees (colour rules guarantee height <= 2 log2(n + 1); used by many standard library maps).

B-trees and B+ trees keep many keys per node so the tree is shallow; each node fits a disk page. Databases and file systems index with B+ trees: all values in leaves, leaves linked for range scans.

Heaps (binary heap in an array: children of i at 2i + 1 and 2i + 2) give O(log n) push/pop and O(1) peek of the minimum. Heapify an array in O(n). Priority queues, scheduling, top-k, Dijkstra.

Tries store strings by prefix; lookups O(length). Uses: autocomplete, dictionaries, IP routing (radix/Patricia tries).

Segment trees answer range queries (sum, min, max) and point or range updates in O(log n); lazy propagation for range updates. Fenwick trees (binary indexed trees) do prefix sums with point updates in O(log n) using i & -i.

# Dynamic programming

DP solves problems with optimal substructure and overlapping subproblems. Recipe: define the state, the transition, the base cases and the answer; then compute top-down with memoisation or bottom-up with a table, and reduce memory if a row only depends on the previous one.

Classics: 0/1 knapsack dp[i][w] = max(dp[i-1][w], dp[i-1][w - wi] + vi); longest common subsequence dp[i][j] = dp[i-1][j-1] + 1 if a[i] == b[j] else max(dp[i-1][j], dp[i][j-1]); edit (Levenshtein) distance with insert/delete/replace costs; longest increasing subsequence in O(n log n) with patience sorting and binary search; coin change (number of ways vs minimum coins); matrix-chain multiplication (interval DP); bitmask DP for travelling salesman on small n (O(n^2 2^n)); DP on trees (post-order, combine children).

# Search, strings and number theory

Binary search on a monotone predicate finds a boundary in O(log n); "binary search on the answer" solves optimisation problems whose feasibility is monotone.

String matching: KMP precomputes a failure function so the text is scanned once, O(n + m). Z-algorithm computes the longest common prefix with the pattern at every position. Rabin-Karp uses rolling hashes (watch for collisions). Suffix arrays plus LCP arrays answer many substring queries; Aho-Corasick matches many patterns at once.

Number theory: Euclid's gcd(a, b) = gcd(b, a mod b); extended Euclid gives modular inverses; fast exponentiation by squaring computes a^n mod m in O(log n); the sieve of Eratosthenes finds primes up to n in O(n log log n).

# Complexity and proofs

Big O is an upper bound on growth, Omega a lower bound, Theta both. Comparison sorting needs Omega(n log n) comparisons (a decision tree has n! leaves, height >= log2 n!). Amortised analysis (aggregate, accounting or potential method) shows that dynamic arrays append in O(1) amortised because doubling makes total copying O(n). Proving an algorithm correct: state a loop invariant, show it holds initially, is maintained by each iteration, and implies the result at termination. NP-complete problems (SAT, travelling salesman decision version, graph colouring, subset sum) have no known polynomial algorithms; use approximation, heuristics, branch and bound, or exponential algorithms for small inputs.`,
  },
  {
    id: 'system-design',
    title: 'System Design and Software Architecture Patterns',
    text: `# Scaling basics

Start simple: one server and one database scale further than people expect. Scale vertically (bigger machine) first, horizontally (more machines) when needed. Stateless application servers behind a load balancer scale horizontally easily; state lives in databases, caches and object storage.

Back-of-the-envelope numbers: L1 cache reference about 1 ns; main memory about 100 ns; reading 1 MB sequentially from memory about 10-50 microseconds; SSD random read about 100 microseconds; a round trip within a data centre about 0.5 ms; a cross-continent round trip about 70-150 ms. A day has 86,400 seconds, so 1 million requests per day is about 12 per second on average (plan for peaks of 5-10x).

# Data

Replication copies data to several nodes for availability and read scaling: leader-follower (writes to the leader, reads from followers, risk of replication lag), multi-leader, or leaderless quorum systems (write to W replicas, read from R, with R + W > N for overlap).

Sharding (partitioning) splits data across nodes by key: range partitioning keeps ranges together (good for scans, risk of hot spots); hash partitioning spreads load evenly; consistent hashing minimises data movement when nodes are added or removed.

CAP theorem: during a network partition a system must choose between consistency and availability. PACELC extends it: else (no partition) choose between latency and consistency. Consistency models from strongest: linearizable, sequential, causal, read-your-writes, eventual.

Transactions: ACID (atomicity, consistency, isolation, durability). Isolation levels: read committed, repeatable read / snapshot isolation, serializable. Distributed transactions use two-phase commit (blocking if the coordinator fails) or sagas (a sequence of local transactions with compensating actions).

Choosing storage: relational databases for structured data with relations and transactions; key-value stores for simple fast lookups; document stores for flexible nested records; wide-column stores for huge write volumes; search engines (inverted indexes) for text search; time-series databases for metrics; object storage for files and blobs; vector indexes for similarity search.

# Caching

Cache-aside: read the cache, on a miss read the database and fill the cache. Write-through writes cache and database together; write-back writes the cache and flushes later (fast, risk of loss). Eviction: LRU, LFU, TTL. Problems: stale data (invalidate on write or use short TTLs), thundering herd on a popular expired key (lock or request coalescing), cache penetration by keys that do not exist (cache negative results). CDNs cache static and public content near users.

# Communication

Synchronous request/response (REST, gRPC) is simple but couples availability: if B is down, A fails. Asynchronous messaging (queues, logs) decouples producers from consumers, absorbs spikes and enables retries. Message queues deliver each message to one consumer; publish/subscribe and logs (Kafka-style) let many consumers read independently and replay.

Delivery semantics: at-most-once, at-least-once (most common, so consumers must be idempotent), exactly-once (only within a system that supports transactions end to end). Make handlers idempotent with idempotency keys or by recording processed message ids.

Resilience: timeouts on every network call, retries with exponential backoff and jitter, circuit breakers that stop calling a failing dependency, bulkheads that isolate resources, rate limiting (token bucket or leaky bucket), load shedding, graceful degradation.

# Architecture styles

Monolith: one deployable unit; simplest to build, test and deploy; a modular monolith with clear internal boundaries is often the best start. Microservices: independently deployable services owned by small teams, each with its own data; costs are network calls, distributed failures, data consistency, observability and operational overhead. Split along business capabilities (bounded contexts from domain-driven design), not technical layers.

Event-driven architecture: services emit events ("OrderPlaced") and others react. Event sourcing stores the sequence of events as the source of truth and derives current state by replaying them (full audit history, temporal queries; harder schema evolution). CQRS separates the write model from read models optimised for queries.

Other patterns: layered (presentation, domain, data), hexagonal / ports and adapters (domain core independent of frameworks and I/O), serverless functions, the strangler fig pattern to replace a legacy system piece by piece, the backends-for-frontends pattern, the outbox pattern to publish events reliably with a database write.

# Memory management

Manual management (C): malloc/free; risks leaks, double free, use-after-free. RAII (C++, Rust): resources are released when the owning object goes out of scope; Rust's ownership and borrowing rules prove memory safety at compile time. Reference counting (Swift, Python's primary mechanism) frees objects when the count reaches zero; cycles need a cycle collector or weak references. Tracing garbage collection (Java, Go, JavaScript, .NET) marks reachable objects from roots and frees the rest; generational collectors exploit that most objects die young; concurrent collectors reduce pauses. Arenas / region allocation free many objects at once and are very fast for request-scoped data. Memory layout matters for speed: contiguous arrays are cache-friendly, pointer-chasing linked structures are not.

# Observability and operations

Logs (structured, with request ids), metrics (counters, gauges, histograms; RED: rate, errors, duration; USE: utilisation, saturation, errors) and traces (spans across services). Define SLIs and SLOs and alert on symptoms users feel. Deploy safely with feature flags, canary releases, blue-green deployments and automatic rollback. Back up data and test restores.`,
  },
  {
    id: 'compilers-low-level',
    title: 'Compilers, Low-Level Operations and Performance',
    text: `# How code becomes machine instructions

A compiler pipeline: the lexer turns characters into tokens; the parser builds an abstract syntax tree (AST) using a grammar (recursive descent, Pratt parsing for operator precedence, or generated LR parsers); semantic analysis resolves names, checks types and builds symbol tables; the program is lowered to an intermediate representation (IR); optimisation passes transform the IR; the backend selects instructions, allocates registers and emits machine code or assembly; the linker combines object files and libraries into an executable.

Interpreters execute an AST or bytecode directly. JIT compilers (V8, HotSpot, PyPy, LuaJIT) start by interpreting, profile hot code, then compile it to machine code using the observed types, with deoptimisation if assumptions break.

# LLVM

LLVM is a reusable compiler infrastructure. Front ends (Clang for C/C++, rustc, Swift, Zig and many others) emit LLVM IR: a typed, low-level, static single assignment (SSA) representation organised into modules, functions, basic blocks and instructions. In SSA every value is assigned exactly once; where control flow merges, phi nodes choose a value depending on the predecessor block. SSA makes data flow explicit and simplifies optimisations.

The middle end runs passes over IR: mem2reg (promote stack slots to SSA registers), instruction combining, constant folding and propagation, dead code elimination, common subexpression elimination / global value numbering, function inlining, loop-invariant code motion, loop unrolling, induction variable simplification, scalar replacement of aggregates, auto-vectorisation (loop and SLP vectorisers) and tail call elimination. Optimisation levels -O1 to -O3 choose pass pipelines; link-time optimisation (LTO) optimises across translation units.

The back end lowers IR to a SelectionDAG or GlobalISel representation, performs instruction selection, scheduling and register allocation (graph colouring or linear scan, spilling to the stack when registers run out), then emits target machine code through the MC layer. MLIR generalises the idea with multiple dialects and is used by ML compilers.

# What the CPU does

Modern CPUs are pipelined and superscalar, executing several instructions per cycle out of order. Branch predictors guess the direction of branches; a misprediction flushes the pipeline (around 15-20 cycles), so unpredictable branches in hot loops are expensive; branchless code (conditional moves, arithmetic masks) can help.

The memory hierarchy: registers, L1 (about 32-64 KB per core, ~4 cycles), L2 (~12 cycles), L3 (shared, ~40 cycles), RAM (~100 ns). Data moves in 64-byte cache lines. Spatial locality (use neighbouring data) and temporal locality (reuse data soon) make code fast. Structure-of-arrays layouts often beat array-of-structures for numeric loops. False sharing happens when threads write different variables on the same cache line.

SIMD (SSE, AVX2, AVX-512 on x86; NEON and SVE on ARM) applies one instruction to many values at once. Compilers auto-vectorise simple loops without dependencies between iterations; intrinsics give manual control.

# Writing fast code

Measure first with a profiler (perf, Instruments, VTune, Chrome DevTools, py-spy); optimise the hot path only. Biggest wins come from better algorithms and data structures, then from memory access patterns, then from avoiding allocation in hot loops, then from parallelism, and only then from micro-optimisation. Avoid unnecessary copies; reuse buffers; batch I/O; prefer contiguous containers; precompute; cache results. For parallelism, divide work into independent chunks, minimise shared mutable state and synchronisation, and watch Amdahl's law: the serial fraction limits speed-up.

# Concurrency at the low level

Threads share memory; data races cause undefined behaviour in C and C++. Synchronise with mutexes, read-write locks, condition variables, or atomics with the right memory ordering (acquire/release, sequentially consistent). Lock-free structures use compare-and-swap loops but face the ABA problem. Async/await runtimes multiplex many tasks on few threads for I/O-bound work.

# WebAssembly

WebAssembly is a portable stack-based bytecode with a sandboxed linear memory, run by browsers and runtimes such as Wasmtime. C, C++, Rust, Go and others compile to it; it runs near native speed and is used for heavy computation in browsers and for plug-in systems.`,
  },
];
