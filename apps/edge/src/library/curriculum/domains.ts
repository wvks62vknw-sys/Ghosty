/**
 * The domains and their topics (see index.ts for the line format). Authored once, kept small:
 * every entry is `level|kind|title`. New domains go at the end; the study cursor is per domain,
 * so reordering changes nothing already learned.
 */
export interface DomainText {
  id: string;
  name: string;
  why: string;
  t: string;
}

export const DOMAIN_TEXT: DomainText[] = [
  {
    id: 'foundations',
    name: 'Foundations for a builder',
    why: 'The web platform, algorithms, security and AI basics Ghosty needs to build well.',
    t: `1|mdn|JavaScript event loop
1|mdn|Promise
1|mdn|async function
1|mdn|Canvas API
1|mdn|requestAnimationFrame
2|mdn|WebGL API
2|mdn|Web Audio API
2|mdn|Gamepad API
1|mdn|Pointer events
2|mdn|Web Workers API
2|mdn|IndexedDB API
1|mdn|Fetch API
1|mdn|CSS Grid layout
1|mdn|CSS flexbox
2|mdn|Content Security Policy
1|wiki|Game programming
1|wiki|Game loop
2|wiki|Collision detection
2|wiki|A* search algorithm
2|wiki|Procedural generation
2|wiki|Perlin noise
2|wiki|Entity component system
2|wiki|Quadtree
2|wiki|Verlet integration
1|wiki|Sprite (computer graphics)
2|wiki|Minimax
3|wiki|Alpha–beta pruning
1|wiki|Finite-state machine
1|wiki|Tetris
1|wiki|Breakout clone
1|wiki|Binary search algorithm
1|wiki|Hash table
2|wiki|Dynamic programming
2|wiki|Dijkstra's algorithm
2|wiki|Union–find
2|wiki|Trie
2|wiki|Heap (data structure)
3|wiki|Red–black tree
1|wiki|Big O notation
1|wiki|Regular expression
1|wiki|Test-driven development
2|wiki|Software design pattern
2|wiki|SOLID
1|wiki|Code refactoring
1|wiki|Version control
1|wiki|HTTP
2|wiki|WebSocket
1|wiki|REST
2|wiki|OAuth
2|wiki|Cross-site scripting
2|wiki|SQL injection
2|wiki|Public-key cryptography
2|wiki|Database index
2|wiki|ACID
3|wiki|CAP theorem
1|wiki|Linear algebra
3|wiki|Quaternion
2|wiki|Bézier curve
3|wiki|Fast Fourier transform
2|wiki|Bayes' theorem
2|wiki|Transformer (deep learning architecture)
2|wiki|Attention (machine learning)
2|wiki|Retrieval-augmented generation
2|wiki|Reinforcement learning
1|wiki|Large language model
3|arxiv|chain-of-thought prompting large language models
3|arxiv|program synthesis large language models code generation
3|arxiv|self-refine iterative refinement feedback
3|arxiv|tool use language model agents
3|arxiv|retrieval augmented generation knowledge-intensive`,
  },
  {
    id: 'algorithms-data-structures',
    name: `Algorithms & data structures`,
    why: `Choosing the right structure and algorithm is what lets an AI write code that is correct and fast, explain why a solution scales, and reason about what is computable at all.`,
    t: `1|openstax|/books/introduction-computer-science/pages/3-1-introduction-to-data-structures-and-algorithms
1|wiki|Algorithm
1|wiki|Data structure
1|wiki|Big O notation
1|wiki|Analysis of algorithms
1|wiki|Array (data structure)
1|wiki|Linked list
1|wiki|Stack (abstract data type)
1|wiki|Queue (abstract data type)
1|wiki|Hash function
1|wiki|Hash table
1|wiki|Recursion (computer science)
1|wiki|Binary search
1|wiki|Sorting algorithm
1|wiki|Merge sort
1|wiki|Quicksort
1|wiki|Heap (data structure)
1|wiki|Binary search tree
1|wiki|Tree traversal
2|openstax|/books/introduction-computer-science/pages/3-4-algorithmic-paradigms
2|wiki|Graph (abstract data type)
2|wiki|Breadth-first search
2|wiki|Depth-first search
2|wiki|Dijkstra's algorithm
2|wiki|Topological sorting
2|wiki|Minimum spanning tree
2|wiki|Dynamic programming
2|wiki|Greedy algorithm
2|wiki|Divide-and-conquer algorithm
2|wiki|Master theorem (analysis of algorithms)
2|wiki|Amortized analysis
2|wiki|Self-balancing binary search tree
2|wiki|Red–black tree
2|wiki|B-tree
2|wiki|Trie
2|wiki|Disjoint-set data structure
2|wiki|Bloom filter
2|wiki|String-searching algorithm
2|wiki|Knuth–Morris–Pratt algorithm
2|wiki|Backtracking
2|wiki|Randomized algorithm
2|wiki|A* search algorithm
2|wiki|Bellman–Ford algorithm
2|wiki|Floyd–Warshall algorithm
3|wiki|Maximum flow problem
3|wiki|Turing machine
3|wiki|Halting problem
3|wiki|Computational complexity theory
3|wiki|NP-completeness
3|wiki|P versus NP problem
3|wiki|Approximation algorithm
3|wiki|Fast Fourier transform
3|wiki|Segment tree
3|wiki|HyperLogLog
3|arxiv|A Model for Learned Bloom Filters`,
  },
  {
    id: 'computer-architecture-os',
    name: `Computer architecture & operating systems`,
    why: `Knowing how CPUs, memory, and kernels actually execute programs lets an AI explain performance, diagnose crashes and leaks, and advise on what hardware and OS features a workload needs.`,
    t: `1|openstax|/books/introduction-computer-science/pages/5-1-computer-systems-organization
1|wiki|Computer architecture
1|wiki|Central processing unit
1|wiki|Von Neumann architecture
1|wiki|Two's complement
1|wiki|Floating-point arithmetic
1|wiki|IEEE 754
1|wiki|Logic gate
1|wiki|Instruction set architecture
1|wiki|Assembly language
1|wiki|Memory hierarchy
1|wiki|CPU cache
1|wiki|Endianness
1|openstax|/books/introduction-computer-science/pages/6-1-what-is-an-operating-system
1|wiki|Operating system
1|wiki|Kernel (operating system)
1|wiki|Process (computing)
1|wiki|Thread (computing)
1|wiki|File system
2|wiki|Instruction pipelining
2|wiki|Branch predictor
2|wiki|Out-of-order execution
2|wiki|Cache coherence
2|wiki|Virtual memory
2|wiki|Memory paging
2|wiki|Translation lookaside buffer
2|openstax|/books/introduction-computer-science/pages/6-4-memory-management
2|wiki|Memory management
2|wiki|Scheduling (computing)
2|wiki|Context switch
2|wiki|System call
2|wiki|Interrupt
2|wiki|Mutual exclusion
2|wiki|Lock (computer science)
2|wiki|Deadlock (computer science)
2|wiki|Inter-process communication
2|wiki|Linker (computing)
2|wiki|Device driver
2|wiki|X86-64
2|wiki|ARM architecture family
2|wiki|RISC-V
3|wiki|Memory ordering
3|wiki|Compare-and-swap
3|wiki|Simultaneous multithreading
3|wiki|Non-uniform memory access
3|wiki|Virtual machine
3|wiki|Hypervisor
3|wiki|Linux kernel
3|wiki|Copy-on-write
3|wiki|Journaling file system
3|wiki|Graphics processing unit
3|wiki|Single instruction, multiple data
3|wiki|Amdahl's law
3|wiki|Booting
3|arxiv|Spectre Attacks Exploiting Speculative Execution`,
  },
  {
    id: 'networking-web',
    name: `Networking & the web (protocols, DNS, HTTP, TLS, CDNs)`,
    why: `Every fetch, API call and deployed site an AI makes rides on these protocols, so understanding them is what makes its web code robust and its debugging of slow or broken connections accurate.`,
    t: `1|mdn|How the web works
1|wiki|Computer network
1|wiki|Internet protocol suite
1|wiki|OSI model
1|wiki|Internet Protocol
1|wiki|IP address
1|wiki|IPv6
1|wiki|Transmission Control Protocol
1|wiki|User Datagram Protocol
1|wiki|Domain Name System
1|wiki|HTTP
1|mdn|Overview of HTTP
1|wiki|URL
1|wiki|Router (computing)
1|wiki|Port (computer networking)
1|wiki|Network address translation
1|wiki|Dynamic Host Configuration Protocol
1|wiki|JSON
2|wiki|Classless Inter-Domain Routing
2|wiki|Internet Control Message Protocol
2|wiki|Routing
2|wiki|Border Gateway Protocol
2|wiki|Autonomous system (Internet)
2|wiki|TCP congestion control
2|wiki|Transport Layer Security
2|wiki|Public key certificate
2|wiki|Certificate authority
2|wiki|HTTPS
2|wiki|Automatic Certificate Management Environment
2|mdn|HTTP messages
2|mdn|HTTP request methods
2|mdn|HTTP response status codes
2|mdn|HTTP caching
2|mdn|Using HTTP cookies
2|mdn|Connection management in HTTP/1.x
2|wiki|Same-origin policy
2|mdn|Cross-Origin Resource Sharing (CORS)
2|wiki|REST
2|mdn|Using the Fetch API
2|wiki|Content delivery network
2|wiki|Reverse proxy
2|wiki|Virtual private network
3|mdn|Evolution of HTTP
3|wiki|HTTP/2
3|wiki|HTTP/3
3|wiki|QUIC
3|wiki|WebSocket
3|mdn|Using server-sent events
3|wiki|Domain Name System Security Extensions
3|wiki|DNS over HTTPS
3|wiki|Server Name Indication
3|wiki|HTTP Strict Transport Security
3|mdn|Content Security Policy (CSP)
3|wiki|Anycast
3|openstax|/books/introduction-computer-science/pages/11-1-modern-web-applications-architectures`,
  },
  {
    id: 'databases',
    name: `Databases & data modelling (SQL, indexes, transactions, NoSQL, SQLite)`,
    why: `An AI that stores memories and builds apps must model data well, write correct SQL, and know how indexes and transactions behave under load, or its advice and its own library will quietly go wrong.`,
    t: `1|openstax|/books/introduction-computer-science/pages/8-3-relational-database-management-systems
1|wiki|Database
1|wiki|Relational database
1|wiki|Relational model
1|wiki|SQL
1|wiki|Primary key
1|wiki|Foreign key
1|wiki|Join (SQL)
1|wiki|Select (SQL)
1|wiki|Database schema
1|wiki|Entity–relationship model
1|wiki|Database normalization
1|wiki|SQLite
1|wiki|Database index
1|wiki|Database transaction
1|wiki|ACID
1|wiki|Null (SQL)
1|wiki|View (SQL)
2|wiki|Relational algebra
2|wiki|Query optimization
2|wiki|Query plan
2|wiki|Isolation (database systems)
2|wiki|Concurrency control
2|wiki|Multiversion concurrency control
2|wiki|Write-ahead logging
2|wiki|B+ tree
2|openstax|/books/introduction-computer-science/pages/8-4-nonrelational-database-management-systems
2|wiki|NoSQL
2|wiki|Document-oriented database
2|wiki|Key–value database
2|wiki|Wide-column store
2|wiki|Graph database
2|wiki|Online analytical processing
2|wiki|Data warehouse
2|wiki|Star schema
2|wiki|Object–relational mapping
2|wiki|Stored procedure
2|wiki|Denormalization
2|wiki|Shard (database architecture)
2|wiki|PostgreSQL
2|wiki|Redis
2|wiki|SQL injection
2|wiki|Prepared statement
2|wiki|Window function (SQL)
3|wiki|Log-structured merge-tree
3|wiki|Snapshot isolation
3|wiki|Database transaction schedule
3|wiki|Time series database
3|wiki|Vector database
3|wiki|Nearest neighbor search
3|wiki|Inverted index
3|wiki|Apache Parquet
3|wiki|DuckDB
3|arxiv|The Case for Learned Index Structures
3|arxiv|Survey of Vector Database Management Systems`,
  },
  {
    id: 'software-engineering',
    name: `Software engineering, design & testing`,
    why: `Building software people can trust is mostly process and design discipline, so an AI needs the vocabulary of testing, architecture, and delivery to produce maintainable code and give sound engineering advice.`,
    t: `1|openstax|/books/introduction-computer-science/pages/9-1-software-engineering-fundamentals
1|wiki|Software engineering
1|wiki|Software development process
1|wiki|Version control
1|wiki|Git
1|wiki|Software testing
1|wiki|Unit testing
1|wiki|Debugging
1|wiki|Code review
1|wiki|Software documentation
1|wiki|Don't repeat yourself
1|wiki|Separation of concerns
1|wiki|Coupling (computer programming)
1|wiki|Cohesion (computer science)
1|wiki|Code refactoring
1|wiki|Technical debt
1|wiki|Agile software development
1|wiki|Scrum (project management)
2|openstax|/books/introduction-computer-science/pages/9-2-software-engineering-process
2|wiki|Requirements analysis
2|wiki|User story
2|wiki|Test-driven development
2|wiki|Integration testing
2|wiki|Code coverage
2|wiki|Mock object
2|wiki|Continuous integration
2|wiki|Continuous delivery
2|wiki|DevOps
2|wiki|Software design pattern
2|wiki|SOLID
2|wiki|Dependency injection
2|wiki|Domain-driven design
2|wiki|Model–view–controller
2|wiki|Software architecture
2|wiki|API
2|wiki|Software versioning
2|wiki|Code smell
2|wiki|Static program analysis
2|wiki|Software maintenance
2|wiki|Feature toggle
2|wiki|Defensive programming
2|wiki|Branching (version control)
2|wiki|Monorepo
3|wiki|Fuzzing
3|wiki|QuickCheck
3|wiki|Mutation testing
3|wiki|Formal methods
3|wiki|Design by contract
3|wiki|Hexagonal architecture (software)
3|wiki|Profiling (computer programming)
3|wiki|The Mythical Man-Month
3|wiki|Conway's law
3|wiki|Twelve-Factor App methodology
3|arxiv|Evaluating Large Language Models Trained on Code
3|arxiv|SWE-bench Can Language Models Resolve Real-World GitHub Issues`,
  },
  {
    id: 'languages-compilers',
    name: `Programming languages, type systems & compilers`,
    why: `Understanding how languages are designed, typed and compiled lets an AI reason precisely about code in any language, explain compiler errors and undefined behaviour, and pick the right abstraction.`,
    t: `1|openstax|/books/introduction-computer-science/pages/7-1-programming-language-foundations
1|wiki|Programming language
1|wiki|Imperative programming
1|wiki|Functional programming
1|wiki|Object-oriented programming
1|wiki|Compiler
1|wiki|Interpreter (computing)
1|wiki|Syntax (programming languages)
1|wiki|Semantics (programming languages)
1|wiki|Data type
1|wiki|Type system
1|wiki|Scope (computer programming)
1|wiki|Closure (computer programming)
1|wiki|Exception handling
1|wiki|Garbage collection (computer science)
1|wiki|Pointer (computer programming)
2|openstax|/books/introduction-computer-science/pages/7-4-programming-language-implementation
2|wiki|Lexical analysis
2|wiki|Parsing
2|wiki|Context-free grammar
2|wiki|Regular expression
2|wiki|Abstract syntax tree
2|wiki|LR parser
2|wiki|Intermediate representation
2|wiki|Static single-assignment form
2|wiki|Optimizing compiler
2|wiki|Just-in-time compilation
2|wiki|Bytecode
2|wiki|LLVM
2|wiki|Type inference
2|wiki|Generic programming
2|wiki|Polymorphism (computer science)
2|wiki|Algebraic data type
2|wiki|Pattern matching
2|wiki|Lazy evaluation
2|wiki|Async/await
2|wiki|Memory safety
2|wiki|Rust (programming language)
2|swift|Automatic Reference Counting
2|swift|Concurrency
2|wiki|WebAssembly
2|wiki|TypeScript
2|wiki|Undefined behavior
3|wiki|Lambda calculus
3|wiki|Hindley–Milner type system
3|wiki|Curry–Howard correspondence
3|wiki|Dependent type
3|wiki|Gradual typing
3|wiki|Monad (functional programming)
3|wiki|Operational semantics
3|wiki|Logic programming
3|wiki|Structure and Interpretation of Computer Programs
3|wiki|Compilers: Principles, Techniques, and Tools
3|swift|Memory Safety
3|arxiv|practical linearity in a higher-order polymorphic language`,
  },
  {
    id: 'distributed-cloud',
    name: `Distributed systems, cloud & serverless`,
    why: `Ghosty itself runs as serverless code at the edge, so knowing how distributed systems fail, agree and scale is essential to building reliable services and advising on cloud architecture honestly.`,
    t: `1|openstax|/books/introduction-computer-science/pages/12-1-introduction-to-cloud-native-applications
1|wiki|Distributed computing
1|wiki|Client–server model
1|wiki|Cloud computing
1|wiki|Scalability
1|wiki|Fault tolerance
1|wiki|High availability
1|wiki|Replication (computing)
1|wiki|Load balancing (computing)
1|wiki|Message queue
1|wiki|Publish–subscribe pattern
1|wiki|Remote procedure call
1|wiki|Serialization
1|wiki|Serverless computing
1|wiki|OS-level virtualization
1|wiki|Docker (software)
2|wiki|Kubernetes
2|wiki|Microservices
2|wiki|Idempotence
2|wiki|Rate limiting
2|wiki|Circuit breaker design pattern
2|wiki|CAP theorem
2|wiki|Consistency model
2|wiki|Eventual consistency
2|wiki|Linearizability
2|wiki|Lamport timestamp
2|wiki|Vector clock
2|wiki|Consistent hashing
2|wiki|Gossip protocol
2|wiki|Two-phase commit protocol
2|wiki|Apache Kafka
2|wiki|MapReduce
2|wiki|Object storage
2|wiki|Cloudflare
2|wiki|Edge computing
2|wiki|Infrastructure as code
2|wiki|GRPC
2|wiki|Site reliability engineering
2|wiki|Observability (software)
2|wiki|Service-level objective
3|wiki|Consensus (computer science)
3|wiki|Paxos (computer science)
3|wiki|Raft (algorithm)
3|wiki|Byzantine fault
3|wiki|Fallacies of distributed computing
3|wiki|Conflict-free replicated data type
3|wiki|Actor model
3|wiki|Google File System
3|wiki|Dynamo (storage system)
3|wiki|Spanner (database)
3|wiki|Apache ZooKeeper
3|wiki|Chaos engineering
3|arxiv|Berkeley View on Serverless Computing
3|arxiv|Conflict-free Replicated Data Types An Overview`,
  },
];
