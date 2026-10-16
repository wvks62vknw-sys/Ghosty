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
  {
    id: 'javascript-web-platform',
    name: `JavaScript, TypeScript & the web platform`,
    why: `Almost everything a personal AI builds or explains for its owner ends up as a web page, a Worker or a script, so it must know the language, the DOM and the browser's security and performance model cold.`,
    t: `1|mdn|JavaScript language overview
1|mdn|Grammar and types
1|mdn|Control flow and error handling
1|mdn|Expressions and operators
1|mdn|Working with objects
1|mdn|Indexed collections
1|mdn|Keyed collections
1|mdn|Equality comparisons and sameness
1|mdn|Template literals (Template strings)
1|mdn|Destructuring
1|mdn|Arrow function expressions
1|mdn|Array.prototype.map()
1|mdn|Array.prototype.reduce()
1|mdn|Working with JSON
1|mdn|DOM scripting introduction
1|mdn|Introduction to events
1|mdn|CSS flexible box layout
1|mdn|CSS grid layout
1|mdn|Responsive web design
1|mdn|Overview of HTTP
2|mdn|Closures
2|mdn|this
2|mdn|Inheritance and the prototype chain
2|mdn|Using classes
2|mdn|Strict mode
2|mdn|Using promises
2|mdn|async function
2|mdn|JavaScript execution model
2|mdn|JavaScript modules
2|mdn|Iterators and generators
2|mdn|Regular expressions
2|mdn|Using the Fetch API
2|mdn|Client-side storage
2|mdn|IndexedDB API
2|mdn|Using Web Workers
2|mdn|Service Worker API
2|mdn|WebSocket API (WebSockets)
2|mdn|Canvas API
2|mdn|Web Components
2|wiki|TypeScript
2|wiki|Node.js
2|wiki|React (software)
3|mdn|Memory management
3|mdn|JavaScript typed arrays
3|mdn|Streams API
3|mdn|Same-origin policy
3|mdn|Cross-Origin Resource Sharing (CORS)
3|mdn|Content Security Policy (CSP)
3|mdn|HTTP caching
3|mdn|Populating the page: how browsers work
3|mdn|WebAssembly concepts
3|mdn|Web Crypto API
3|wiki|V8 (JavaScript engine)
3|wiki|Single-page application
3|wiki|Progressive web app
3|arxiv|Not So Fast Analyzing Performance WebAssembly Native`,
  },
  {
    id: 'python',
    name: `Python language, stdlib & ecosystem`,
    why: `Python is the language people reach for to script, analyse data and prototype, so an AI that writes, debugs and explains Python idiomatically is useful every day.`,
    t: `1|wiki|Python (programming language)
1|wikibooks|Python Programming/Variables and Strings
1|wikibooks|Python Programming/Data types
1|wikibooks|Python Programming/Lists
1|wikibooks|Python Programming/Tuples
1|wikibooks|Python Programming/Dictionaries
1|wikibooks|Python Programming/Conditional Statements
1|wikibooks|Python Programming/Loops
1|wikibooks|Python Programming/Functions
1|wikibooks|Python Programming/Scoping
1|wikibooks|Python Programming/Exceptions
1|wikibooks|Python Programming/Files
1|wikibooks|Python Programming/Modules
1|wikibooks|Python Programming/Classes
1|wiki|Zen of Python
1|wiki|List comprehension
2|wiki|Python syntax and semantics
2|wikibooks|Python Programming/Decorators
2|wikibooks|Python Programming/Context Managers
2|wikibooks|Python Programming/Regular Expression
2|wikibooks|Python Programming/Standard Library
2|wikibooks|Python Programming/Idioms
2|wiki|Docstring
2|wiki|Generator (computer programming)
2|wiki|Closure (computer programming)
2|wiki|Duck typing
2|wiki|Exception handling
2|wiki|Gradual typing
2|wiki|Pip (package manager)
2|wiki|Python Package Index
2|wiki|Conda (package manager)
2|wiki|Pytest
2|wikibooks|Python Programming/Threading
2|wiki|Requests (software)
2|wiki|NumPy
2|wiki|Pandas (software)
2|wiki|Matplotlib
2|wiki|Django (web framework)
2|wiki|FastAPI
2|wiki|Project Jupyter
2|wiki|Web Server Gateway Interface
3|wiki|CPython
3|wiki|Global interpreter lock
3|wiki|Garbage collection (computer science)
3|wiki|Reference counting
3|wiki|Metaclass
3|wiki|Coroutine
3|wiki|Async/await
3|wikibooks|Python Programming/Performance
3|wiki|Cython
3|wiki|PyPy
3|wiki|Scikit-learn
3|arxiv|Array programming with NumPy
3|arxiv|SciPy 1.0 fundamental algorithms scientific computing Python
3|arxiv|PyTorch imperative style high-performance deep learning library`,
  },
  {
    id: 'swift-ios',
    name: `Swift & iOS app architecture`,
    why: `The owner lives on a phone, so an AI that can design, write and reason about native iOS apps in Swift, and explain how Apple's platform works, is a practical builder rather than a web-only one.`,
    t: `1|swift|About Swift
1|swift|A Swift Tour
1|swift|The Basics
1|swift|Basic Operators
1|swift|Strings and Characters
1|swift|Collection Types
1|swift|Control Flow
1|swift|Functions
1|swift|Closures
1|swift|Enumerations
1|swift|Structures and Classes
1|swift|Properties
1|swift|Methods
1|swift|Inheritance
1|swift|Initialization
1|swift|Optional Chaining
1|swift|Error Handling
1|wiki|Swift (programming language)
1|wiki|IOS
1|wiki|Xcode
2|swift|Protocols
2|swift|Extensions
2|swift|Generics
2|swift|Type Casting
2|swift|Access Control
2|swift|Automatic Reference Counting
2|wiki|Value semantics
2|wiki|Objective-C
2|wiki|SwiftUI
2|wiki|UIKit
2|wiki|Declarative programming
2|wiki|Model–view–controller
2|wiki|Model–view–viewmodel
2|wiki|Delegation pattern
2|wiki|Observer pattern
2|wiki|Foundation Kit
2|wiki|Core Data
2|wiki|Grand Central Dispatch
2|wiki|Human interface guidelines
2|wiki|App Store (Apple)
3|swift|Concurrency
3|wiki|Structured concurrency
3|swift|Opaque and Boxed Protocol Types
3|swift|Advanced Operators
3|swift|Macros
3|wiki|Reactive programming
3|wiki|Dependency injection
3|wiki|Weak reference
3|wiki|Memory leak
3|wiki|Core Animation
3|wiki|Keychain (software)
3|wiki|Apple Push Notification service
3|wiki|CloudKit
3|wiki|ARKit
3|wiki|Darwin (operating system)
3|wiki|Instruments (software)`,
  },
  {
    id: 'rust-systems',
    name: `Rust & systems programming`,
    why: `Understanding ownership, memory, concurrency and what the OS and hardware actually do lets the AI write fast, safe low-level code and explain why programs crash, leak or stall.`,
    t: `1|wiki|Rust (programming language)
1|wiki|Memory safety
1|wiki|Call stack
1|wiki|C dynamic memory allocation
1|wiki|Manual memory management
1|wiki|Null pointer
1|wiki|Dangling pointer
1|wiki|Undefined behavior
1|wiki|Resource acquisition is initialization
1|wiki|Algebraic data type
1|wiki|Tagged union
1|wiki|Option type
1|wiki|Result type
1|wiki|Pattern matching
1|wiki|Trait (computer programming)
1|wiki|Generic programming
1|wiki|Type inference
1|wiki|Iterator pattern
2|wiki|Substructural type system
2|wiki|Smart pointer
2|wiki|Dynamic dispatch
2|wiki|Monomorphization
2|wiki|Macro (computer science)
2|wiki|Thread (computing)
2|wiki|Race condition
2|wiki|Mutual exclusion
2|wiki|Deadlock
2|wiki|Channel (programming)
2|wiki|Futures and promises
2|wiki|Asynchronous I/O
2|wiki|Event loop
2|wiki|Tokio (software)
2|wiki|System call
2|wiki|Virtual memory
2|wiki|CPU cache
2|wiki|Linker (computing)
2|wiki|Foreign function interface
2|wiki|LLVM
2|wiki|Profiling (computer programming)
2|wiki|Embedded system
3|wiki|Memory model (programming)
3|wiki|Memory ordering
3|wiki|Compare-and-swap
3|wiki|Non-blocking algorithm
3|wiki|Cache coherence
3|wiki|Single instruction, multiple data
3|wiki|Work stealing
3|wiki|Green thread
3|wiki|Epoll
3|wiki|Io uring
3|wiki|Code sanitizer
3|wiki|Formal verification
3|wiki|Rust for Linux
3|wiki|WebAssembly
3|arxiv|Oxide essence of Rust
3|arxiv|unsafe Achilles Heel safety requirements Rust`,
  },
  {
    id: 'security-crypto',
    name: `Security engineering & cryptography`,
    why: `An AI that holds its owner's keys and publishes their sites must know how attacks work and how real defences (TLS, hashing, auth, sandboxing) are built, so its advice keeps people safe rather than merely sounding safe.`,
    t: `1|wiki|Information security
1|wiki|Computer security
1|wiki|Threat model
1|wiki|STRIDE model
1|wiki|Attack surface
1|wiki|Defense in depth (computing)
1|wiki|Principle of least privilege
1|wiki|Cryptography
1|wiki|Symmetric-key algorithm
1|wiki|Public-key cryptography
1|wiki|Cryptographic hash function
1|wiki|Authentication
1|wiki|Multi-factor authentication
1|wiki|Kerckhoffs's principle
2|wiki|Advanced Encryption Standard
2|wiki|Block cipher mode of operation
2|wiki|Authenticated encryption
2|wiki|HMAC
2|wiki|SHA-2
2|wiki|Salt (cryptography)
2|wiki|Key derivation function
2|wiki|Argon2
2|wiki|RSA (cryptosystem)
2|wiki|Diffie–Hellman key exchange
2|wiki|Elliptic-curve cryptography
2|wiki|Digital signature
2|wiki|Cryptographically secure pseudorandom number generator
2|wiki|Transport Layer Security
2|wiki|Public key infrastructure
2|wiki|Forward secrecy
2|wiki|HTTP cookie
2|wiki|OAuth
2|wiki|JSON Web Token
2|wiki|WebAuthn
2|wiki|Cross-site scripting
2|wiki|Cross-site request forgery
2|wiki|SQL injection
2|wiki|Server-side request forgery
2|wiki|OWASP
2|wiki|Sandbox (computer security)
2|wiki|Secure Shell
2|wiki|Buffer overflow
2|wiki|Address space layout randomization
3|wiki|Return-oriented programming
3|wiki|Control-flow integrity
3|wiki|Timing attack
3|wiki|Side-channel attack
3|wiki|Padding oracle attack
3|wiki|Zero trust architecture
3|wiki|Supply chain attack
3|wiki|Fuzzing
3|wiki|Spectre (security vulnerability)
3|wiki|Signal Protocol
3|wiki|Post-quantum cryptography
3|wiki|ML-KEM
3|wiki|Zero-knowledge proof
3|wiki|Trusted execution environment
3|arxiv|Spectre Attacks Exploiting Speculative Execution Kocher
3|arxiv|Meltdown Lipp Schwarz Gruss Prescher`,
  },
  {
    id: 'graphics-games',
    name: `Computer graphics, game engines & simulation`,
    why: `From the 3D globe it renders to any game or visualisation its owner asks for, the AI needs the maths of transforms and lighting, the GPU pipeline, and the engine patterns that make interactive simulations run in real time.`,
    t: `1|wiki|Computer graphics
1|wiki|Rendering (computer graphics)
1|wiki|Rasterisation
1|wiki|Graphics pipeline
1|wiki|Shader
1|wiki|Transformation matrix
1|wiki|3D projection
1|wiki|Quaternions and spatial rotation
1|wiki|Gimbal lock
1|wiki|Polygon mesh
1|wiki|Texture mapping
1|wiki|Z-buffering
1|wiki|Game engine
1|wiki|Video game programming
2|wiki|Viewing frustum
2|wiki|Hidden-surface determination
2|wiki|Spatial anti-aliasing
2|wiki|Phong reflection model
2|wiki|Normal mapping
2|wiki|Shadow mapping
2|wiki|Deferred shading
2|wiki|Bounding volume hierarchy
2|wiki|OpenGL
2|wiki|OpenGL Shading Language
2|wiki|Vulkan
2|wiki|WebGL
2|wiki|WebGPU
2|wiki|Graphics processing unit
2|wiki|Bézier curve
2|wiki|Skeletal animation
2|wiki|Particle system
2|wiki|Collision detection
2|wiki|Physics engine
2|wiki|Rigid body dynamics
2|wiki|Entity component system
2|wiki|A* search algorithm
2|wiki|Navigation mesh
2|wiki|Behavior tree (artificial intelligence, robotics and control)
2|wiki|Procedural generation
2|wiki|Perlin noise
2|wiki|Unity (game engine)
2|wiki|Gamma correction
3|wiki|Physically based rendering
3|wiki|Bidirectional reflectance distribution function
3|wiki|Rendering equation
3|wiki|Ray tracing (graphics)
3|wiki|Path tracing
3|wiki|Global illumination
3|wiki|Tone mapping
3|wiki|Signed distance function
3|wiki|General-purpose computing on graphics processing units
3|wiki|Deep learning super sampling
3|wiki|Neural radiance field
3|wiki|Gaussian splatting
3|wiki|Smoothed-particle hydrodynamics
3|wiki|Netcode
3|wiki|Data-oriented design
3|arxiv|Representing Scenes Neural Radiance Fields View Synthesis
3|arxiv|3D Gaussian splatting real-time radiance field rendering`,
  },
  {
    id: 'hci-product',
    name: `Human–computer interaction, accessibility & product design`,
    why: `Every page, app and answer the AI produces is used by a human, so knowing how people perceive, decide and get frustrated, and how to design accessibly and measure what works, makes its output usable rather than merely correct.`,
    t: `1|wiki|Human–computer interaction
1|wiki|User interface
1|wiki|Graphical user interface
1|wiki|User experience
1|wiki|Usability
1|wiki|Interaction design
1|wiki|User-centered design
1|wiki|Affordance
1|wiki|Mental model
1|wiki|Gestalt psychology
1|openstax|/books/psychology-2e/pages/5-6-gestalt-principles-of-perception
1|wiki|Fitts's law
1|wiki|Hick's law
1|wiki|Cognitive load
1|wiki|The Design of Everyday Things
1|wiki|Accessibility
2|wiki|Usability testing
2|wiki|Heuristic evaluation
2|wiki|Jakob Nielsen (usability consultant)
2|wiki|System usability scale
2|wiki|Card sorting
2|wiki|Persona (user experience)
2|wiki|User story
2|wiki|Website wireframe
2|wiki|Information architecture
2|wiki|Design thinking
2|wiki|A/B testing
2|wiki|Web Content Accessibility Guidelines
2|wiki|Screen reader
2|mdn|WAI-ARIA basics
2|wiki|Assistive technology
2|wiki|Inclusive design
2|wiki|Color blindness
2|wiki|Contrast ratio
2|wiki|Typography
2|wiki|Design system
2|wiki|Material Design
2|wiki|Dark mode
2|wiki|Direct manipulation interface
2|wiki|Internationalization and localization
2|wiki|Product management
2|wiki|Minimum viable product
2|wiki|Lean startup
2|wiki|Product–market fit
2|wiki|Kano model
2|wiki|Funnel analysis
3|wiki|GOMS
3|wiki|Human processor model
3|wiki|Dark pattern
3|wiki|Nudge theory
3|wiki|Persuasive technology
3|wiki|Progressive disclosure
3|wiki|Calm technology
3|wiki|Value sensitive design
3|wiki|Human-in-the-loop
3|wiki|Automation bias
3|wiki|Goodhart's law
3|arxiv|Dark Patterns at Scale Findings Crawl Shopping Websites
3|arxiv|Human-Centered Artificial Intelligence Reliable Safe Trustworthy`,
  },
  {
    id: 'ml-fundamentals',
    name: `Machine learning fundamentals (supervised, unsupervised, evaluation, feature engineering)`,
    why: `Nearly every judgement a personal AI makes about data, predictions, trade-offs and model quality rests on these core methods and evaluation habits.`,
    t: `1|wiki|Machine learning
1|wiki|Supervised learning
1|wiki|Unsupervised learning
1|openstax|/books/principles-data-science/pages/6-1-what-is-machine-learning
1|wiki|Statistical classification
1|wiki|Regression analysis
1|wiki|Linear regression
1|openstax|/books/principles-data-science/pages/4-3-correlation-and-linear-regression-analysis
1|wiki|Logistic regression
1|wiki|K-nearest neighbors algorithm
1|wiki|Decision tree learning
1|wiki|Naive Bayes classifier
1|wiki|Feature (machine learning)
1|wiki|Training, validation, and test data sets
1|wiki|Overfitting
1|wiki|Confusion matrix
1|wiki|Precision and recall
1|wiki|Receiver operating characteristic
2|wiki|Bias–variance tradeoff
2|wiki|Cross-validation (statistics)
2|wiki|Loss function
2|wiki|Gradient descent
2|wiki|Stochastic gradient descent
2|wiki|Regularization (mathematics)
2|wiki|Feature engineering
2|wiki|Feature scaling
2|wiki|Feature selection
2|wiki|Missing data
2|wiki|Oversampling and undersampling in data analysis
2|wiki|Support vector machine
2|wiki|Ensemble learning
2|wiki|Random forest
2|wiki|Gradient boosting
2|wiki|XGBoost
2|wiki|K-means clustering
2|wiki|DBSCAN
2|wiki|Principal component analysis
2|wiki|T-distributed stochastic neighbor embedding
2|wiki|Expectation–maximization algorithm
2|wiki|Hyperparameter optimization
2|wiki|Anomaly detection
2|wiki|Calibration (statistics)
3|wiki|Reinforcement learning
3|wiki|Markov decision process
3|wiki|Semi-supervised learning
3|wiki|Active learning (machine learning)
3|wiki|Probably approximately correct learning
3|wiki|Vapnik–Chervonenkis dimension
3|wiki|Bayesian optimization
3|wiki|Leakage (machine learning)
3|wiki|Explainable artificial intelligence
3|wiki|Conformal prediction
3|wiki|Concept drift
3|wiki|Fairness (machine learning)`,
  },
  {
    id: 'deep-learning-llms',
    name: `Deep learning & large language models (architectures, training, scaling; use arxiv for landmark papers)`,
    why: `A personal AI should understand the architectures, training recipes and scaling results behind the models it is built from, so it can explain its own strengths, limits and costs.`,
    t: `1|wiki|Neural network (machine learning)
1|wiki|Perceptron
1|wiki|Multilayer perceptron
1|wiki|Activation function
1|wiki|Rectified linear unit
1|wiki|Softmax function
1|wiki|Backpropagation
1|openstax|/books/principles-data-science/pages/7-1-introduction-to-neural-networks
1|wiki|Deep learning
1|openstax|/books/principles-data-science/pages/7-3-introduction-to-deep-learning
1|wiki|Universal approximation theorem
1|wiki|Convolutional neural network
1|wiki|Recurrent neural network
1|wiki|Long short-term memory
1|wiki|Word embedding
2|wiki|Vanishing gradient problem
2|wiki|Batch normalization
2|wiki|Dropout (neural networks)
2|arxiv|Adam A Method for Stochastic Optimization
2|arxiv|Deep Residual Learning for Image Recognition
2|arxiv|Neural Machine Translation by Jointly Learning to Align
2|wiki|Attention (machine learning)
2|arxiv|Attention Is All You Need
2|wiki|Transformer (deep learning)
2|wiki|Byte-pair encoding
2|arxiv|BERT Pre-training of Deep Bidirectional Transformers
2|wiki|Generative pre-trained transformer
2|arxiv|Language Models are Few-Shot Learners
2|wiki|Large language model
2|wiki|Autoencoder
2|wiki|Generative adversarial network
2|wiki|Diffusion model
2|arxiv|Denoising Diffusion Probabilistic Models
2|arxiv|Transformers for Image Recognition at Scale
2|arxiv|Learning Transferable Visual Models From Natural Language Supervision
2|wiki|Transfer learning
2|wiki|Fine-tuning (deep learning)
2|wiki|Self-supervised learning
2|wiki|Deep reinforcement learning
3|arxiv|Scaling Laws for Neural Language Models
3|arxiv|Training Compute-Optimal Large Language Models
3|arxiv|RoFormer Enhanced Transformer with Rotary Position Embedding
3|arxiv|FlashAttention Fast and Memory-Efficient Exact Attention
3|wiki|Mixture of experts
3|arxiv|LoRA Low-Rank Adaptation of Large Language Models
3|wiki|Reinforcement learning from human feedback
3|arxiv|language models to follow instructions with human feedback
3|arxiv|Your Language Model is Secretly a Reward Model
3|arxiv|Constitutional AI Harmlessness from AI Feedback
3|arxiv|DeepSeek-R1 Incentivizing Reasoning Capability in LLMs
3|arxiv|Mamba Linear-Time Sequence Modeling with Selective State Spaces
3|wiki|Knowledge distillation
3|arxiv|Fast Inference from Transformers via Speculative Decoding
3|wiki|Mechanistic interpretability
3|arxiv|Toy Models of Superposition
3|wiki|Double descent`,
  },
  {
    id: 'ai-agents-rag',
    name: `AI agents, retrieval-augmented generation, prompting & evaluation (arxiv heavy)`,
    why: `These are the techniques a personal AI itself runs on: how to prompt, retrieve, use tools, plan, stay safe from injection, and measure whether it is actually getting better.`,
    t: `1|wiki|Intelligent agent
1|wiki|AI agent
1|wiki|Prompt engineering
1|wiki|Hallucination (artificial intelligence)
1|wiki|Information retrieval
1|wiki|Tf–idf
1|wiki|Okapi BM25
1|wiki|Cosine similarity
1|wiki|Sentence embedding
1|wiki|Nearest neighbor search
1|wiki|Vector database
1|wiki|Retrieval-augmented generation
1|wiki|Knowledge graph
1|wiki|Few-shot learning
2|arxiv|Chain-of-Thought Prompting Elicits Reasoning
2|arxiv|Large Language Models are Zero-Shot Reasoners
2|arxiv|Self-Consistency Improves Chain of Thought Reasoning
2|arxiv|Tree of Thoughts Deliberate Problem Solving
2|arxiv|ReAct Synergizing Reasoning and Acting in Language Models
2|arxiv|Language Models Can Teach Themselves to Use Tools
2|wiki|Model Context Protocol
2|arxiv|Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks
2|arxiv|Dense Passage Retrieval for Open-Domain Question Answering
2|wiki|Hierarchical navigable small world
2|arxiv|Precise Zero-Shot Dense Retrieval without Relevance Labels
2|arxiv|How Language Models Use Long Contexts
2|arxiv|Self-RAG Learning to Retrieve Generate and Critique
2|arxiv|A Graph RAG Approach to Query-Focused Summarization
2|arxiv|Retrieval-Augmented Generation for Large Language Models A Survey
2|wiki|Evaluation measures (information retrieval)
2|wiki|Discounted cumulative gain
2|arxiv|BEIR A Heterogeneous Benchmark for Zero-shot Evaluation
2|wiki|Language model benchmark
2|arxiv|Measuring Massive Multitask Language Understanding
2|arxiv|Evaluating Large Language Models Trained on Code
2|arxiv|Training Verifiers to Solve Math Word Problems
2|arxiv|Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena
2|wiki|Goodhart's law
3|arxiv|Reflexion Language Agents with Verbal Reinforcement Learning
3|arxiv|Generative Agents Interactive Simulacra of Human Behavior
3|arxiv|AutoGen Enabling Next-Gen LLM Applications via Multi-Agent Conversation
3|wiki|Multi-agent system
3|arxiv|Potential of Large Language Model Based Agents
3|arxiv|SWE-bench Can Language Models Resolve Real-World GitHub Issues
3|arxiv|Realistic Web Environment for Building Autonomous Agents
3|arxiv|GAIA a benchmark for General AI Assistants
3|arxiv|Let's Verify Step by Step
3|arxiv|STaR Bootstrapping Reasoning With Reasoning
3|wiki|Reasoning model
3|arxiv|DSPy Compiling Declarative Language Model Calls
3|wiki|Prompt injection
3|arxiv|Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection
3|arxiv|Transferable Adversarial Attacks on Aligned Language Models
3|arxiv|Red Teaming Language Models with Language Models
3|wiki|AI alignment`,
  },
  {
    id: 'quantum-computing',
    name: `Quantum computing & quantum information`,
    why: `Quantum computing will reshape cryptography, simulation and optimisation; a well-read AI should separate real results from hype and explain the maths cleanly.`,
    t: `1|wiki|Quantum computing
1|wiki|Qubit
1|wiki|Quantum superposition
1|wiki|Quantum entanglement
1|wiki|Bra–ket notation
1|wiki|Pauli matrices
1|wiki|Bloch sphere
1|wiki|Quantum logic gate
1|wiki|Controlled NOT gate
1|wiki|Quantum circuit
1|wiki|Measurement in quantum mechanics
1|wiki|Density matrix
1|wiki|No-cloning theorem
1|wiki|Bell state
1|wiki|Bell's theorem
1|wiki|Quantum decoherence
1|wiki|Quantum information
2|wiki|Quantum teleportation
2|wiki|Superdense coding
2|wiki|Quantum algorithm
2|wiki|Deutsch–Jozsa algorithm
2|wiki|Quantum Fourier transform
2|wiki|Quantum phase estimation algorithm
2|wiki|Shor's algorithm
2|arxiv|Polynomial-Time Algorithms for Prime Factorization and Discrete Logarithms
2|wiki|Grover's algorithm
2|wiki|Amplitude amplification
2|wiki|HHL algorithm
2|wiki|BQP
2|wiki|Quantum key distribution
2|wiki|BB84
2|wiki|Post-quantum cryptography
2|wiki|NIST Post-Quantum Cryptography Standardization
2|wiki|Quantum error correction
2|arxiv|Quantum Error Correction for Beginners
2|wiki|Stabilizer code
2|wiki|Surface code
2|wiki|Threshold theorem
2|wiki|Gottesman–Knill theorem
2|wiki|Von Neumann entropy
2|wiki|Quantum channel
2|wiki|Qiskit
3|wiki|Superconducting quantum computing
3|wiki|Trapped-ion quantum computer
3|wiki|Neutral atom quantum computer
3|wiki|Linear optical quantum computing
3|wiki|Topological quantum computer
3|wiki|Quantum annealing
3|wiki|Noisy intermediate-scale quantum computing
3|arxiv|Quantum Computing in the NISQ era and beyond
3|wiki|Variational quantum eigensolver
3|wiki|Quantum optimization algorithms
3|wiki|Hamiltonian simulation
3|wiki|Quantum machine learning
3|wiki|Quantum supremacy
3|arxiv|Characterizing Quantum Supremacy in Near-Term Devices
3|arxiv|Quantum error correction below the surface code threshold`,
  },
  {
    id: 'data-engineering-analytics',
    name: `Data engineering, analytics & visualisation`,
    why: `A personal AI that stores, cleans, queries and charts its owner's data needs sound database, pipeline and visualisation craft to be trustworthy.`,
    t: `1|wiki|Data engineering
1|wiki|Database
1|wiki|Relational database
1|wiki|SQL
1|wiki|Join (SQL)
1|wiki|Database normalization
1|wiki|Entity–relationship model
1|wiki|Database index
1|wiki|Database transaction
1|wiki|ACID
1|wiki|Comma-separated values
1|wiki|Data cleansing
1|openstax|/books/principles-data-science/pages/2-4-data-cleaning-and-preprocessing
1|wiki|Exploratory data analysis
1|wiki|Data and information visualization
1|wiki|Histogram
1|wiki|Box plot
1|wiki|Scatter plot
1|wiki|Pandas (software)
1|openstax|/books/principles-data-science/pages/9-1-encoding-univariate-data
2|wiki|Extract, transform, load
2|wiki|Data warehouse
2|wiki|Dimensional modeling
2|wiki|Star schema
2|wiki|Slowly changing dimension
2|wiki|Online analytical processing
2|wiki|Data orientation
2|wiki|Apache Parquet
2|wiki|Data lake
2|wiki|NoSQL
2|wiki|B-tree
2|wiki|Log-structured merge-tree
2|wiki|Window function (SQL)
2|wiki|Apache Spark
2|wiki|MapReduce
2|wiki|Apache Kafka
2|wiki|Stream processing
2|wiki|Apache Airflow
2|wiki|Change data capture
2|wiki|Data quality
2|wiki|Data governance
2|wiki|Time series
2|openstax|/books/principles-data-science/pages/5-3-time-series-forecasting-methods
2|wiki|A/B testing
2|wiki|Simpson's paradox
2|wiki|Anscombe's quartet
2|wiki|Misleading graph
2|wiki|Matplotlib
2|wiki|Cohort analysis
3|wiki|CAP theorem
3|wiki|Eventual consistency
3|wiki|Shard (database architecture)
3|wiki|Apache Iceberg
3|wiki|Apache Flink`,
  },
  {
    id: 'robotics-control',
    name: `Robotics, control theory & signal processing`,
    why: `Controlling anything physical, filtering any sensor stream or reasoning about feedback loops needs this toolkit, from PID to Kalman filters to SLAM.`,
    t: `1|wiki|Robotics
1|wiki|Control theory
1|wiki|Feedback
1|wiki|Open-loop controller
1|wiki|Closed-loop controller
1|wiki|PID controller
1|wiki|Signal processing
1|wiki|Digital signal processing
1|wiki|Sampling (signal processing)
1|wiki|Nyquist–Shannon sampling theorem
1|wiki|Aliasing
1|wiki|Fourier transform
1|wiki|Discrete Fourier transform
1|wiki|Fast Fourier transform
1|wiki|Convolution
1|wiki|Linear time-invariant system
1|wiki|Filter (signal processing)
1|wiki|Low-pass filter
1|wiki|Actuator
1|wiki|Servomotor
1|wiki|Inertial measurement unit
2|wiki|Laplace transform
2|wiki|Transfer function
2|wiki|Bode plot
2|wiki|Nyquist stability criterion
2|wiki|Root locus analysis
2|wiki|Z-transform
2|wiki|Finite impulse response
2|wiki|Infinite impulse response
2|wiki|Butterworth filter
2|wiki|State-space representation
2|wiki|Controllability
2|wiki|Observability
2|wiki|Lyapunov stability
2|wiki|Quaternions and spatial rotation
2|wiki|Forward kinematics
2|wiki|Inverse kinematics
2|wiki|Denavit–Hartenberg parameters
2|wiki|Rigid body dynamics
2|wiki|Motion planning
2|wiki|A* search algorithm
2|wiki|Rapidly exploring random tree
2|wiki|Kalman filter
2|wiki|Robot Operating System
3|wiki|Linear–quadratic regulator
3|wiki|Model predictive control
3|wiki|Robust control
3|wiki|Adaptive control
3|wiki|Extended Kalman filter
3|wiki|Particle filter
3|wiki|Simultaneous localization and mapping
3|wiki|Trajectory optimization
3|wiki|Robot learning
3|arxiv|Domain Randomization for Transferring Deep Neural Networks
3|arxiv|Diffusion Policy Visuomotor Policy Learning via Action Diffusion
3|arxiv|RT-2 Vision-Language-Action Models Transfer Web Knowledge`,
  },
  {
    id: 'osint-privacy-safety',
    name: `Open-source intelligence methods, privacy & digital safety (defensive, lawful: verification, geolocation of public imagery, metadata, scam recognition)`,
    why: `To verify claims, check images, spot scams and protect its owner's privacy, a personal AI needs the investigator's method and the defender's habits, inside the law.`,
    t: `1|wiki|Open-source intelligence
1|wiki|Source criticism
1|wiki|Fact-checking
1|wiki|Media literacy
1|wiki|Misinformation
1|wiki|Disinformation
1|wiki|Metadata
1|wiki|Exif
1|wiki|Geotagging
1|wiki|Reverse image search
1|wiki|Wayback Machine
1|wiki|WHOIS
1|wiki|Scam
1|wiki|Phishing
1|wiki|Social engineering (security)
1|wiki|Password manager
1|wiki|Multi-factor authentication
1|wiki|Internet privacy
1|wiki|Digital footprint
2|wiki|Bellingcat
2|wiki|Satellite imagery
2|wiki|Google Street View
2|wiki|OpenStreetMap
2|wiki|Position of the Sun
2|wiki|Photograph manipulation
2|wiki|Error level analysis
2|wiki|Deepfake
2|wiki|Content Authenticity Initiative
2|wiki|Certificate Transparency
2|wiki|Shodan (website)
2|wiki|Automatic Dependent Surveillance–Broadcast
2|wiki|Freedom of information
2|wiki|Sock puppet account
2|wiki|Astroturfing
2|wiki|Advance-fee scam
2|wiki|Romance scam
2|wiki|Pig butchering scam
2|wiki|Technical support scam
2|wiki|SIM swap attack
2|wiki|Authorised push payment fraud
2|wiki|Identity theft
2|wiki|Data breach
2|wiki|Data broker
2|wiki|Doxing
2|wiki|Stalkerware
2|wiki|Sextortion
3|wiki|Threat model
3|wiki|Operational security
3|wiki|End-to-end encryption
3|wiki|Tor (network)
3|wiki|Virtual private network
3|wiki|Data anonymization
3|wiki|Differential privacy
3|wiki|General Data Protection Regulation
3|wiki|Computer Misuse Act 1990
3|arxiv|PlaNet Photo Geolocation with Convolutional Neural Networks`,
  },
  {
    id: 'algebra-number-theory',
    name: `Algebra & number theory`,
    why: `Algebra is the grammar of every formula Ghosty manipulates, and number theory underlies the hashing, modular arithmetic and public-key cryptography it must explain and build on.`,
    t: `1|wiki|Algebra
1|wiki|Elementary algebra
1|openstax|/books/college-algebra-2e/pages/1-1-real-numbers-algebra-essentials
1|wiki|Polynomial
1|wiki|Quadratic equation
1|wiki|Factorization
1|wiki|Exponentiation
1|wiki|Logarithm
1|wiki|Complex number
1|wiki|Binomial theorem
1|wiki|Fundamental theorem of algebra
1|wiki|Number theory
1|wiki|Prime number
1|wiki|Greatest common divisor
1|wiki|Euclidean algorithm
1|wiki|Fundamental theorem of arithmetic
1|wiki|Modular arithmetic
2|wiki|Diophantine equation
2|wiki|Chinese remainder theorem
2|wiki|Fermat's little theorem
2|wiki|Euler's totient function
2|wiki|Euler's theorem
2|wiki|Modular exponentiation
2|wiki|Quadratic residue
2|wiki|Quadratic reciprocity
2|wiki|Continued fraction
2|wiki|Pell's equation
2|wiki|Group (mathematics)
2|wiki|Subgroup
2|wiki|Cyclic group
2|wiki|Lagrange's theorem (group theory)
2|wiki|Symmetric group
2|wiki|Group homomorphism
2|wiki|Normal subgroup
2|wiki|Quotient group
2|wiki|Ring (mathematics)
2|wiki|Ideal (ring theory)
2|wiki|Polynomial ring
2|wiki|Field (mathematics)
2|wiki|Finite field
3|wiki|Sylow theorems
3|wiki|Principal ideal domain
3|wiki|Unique factorization domain
3|wiki|Field extension
3|wiki|Galois theory
3|wiki|Algebraic number theory
3|wiki|p-adic number
3|wiki|Elliptic curve
3|wiki|Fermat's Last Theorem
3|wiki|Miller–Rabin primality test
3|wiki|Prime number theorem
3|wiki|Riemann zeta function
3|wiki|Riemann hypothesis
3|wiki|Dirichlet's theorem on arithmetic progressions`,
  },
  {
    id: 'calculus-analysis',
    name: `Calculus & real analysis`,
    why: `Derivatives, integrals and limits are how Ghosty models change, reasons about rates and convergence, and checks that the numerical and learning methods it uses actually work.`,
    t: `1|wiki|Calculus
1|wiki|Limit (mathematics)
1|wiki|Limit of a function
1|openstax|/books/calculus-volume-1/pages/2-2-the-limit-of-a-function
1|wiki|Continuous function
1|wiki|Derivative
1|wiki|Differentiation rules
1|wiki|Chain rule
1|wiki|Maximum and minimum
1|wiki|Mean value theorem
1|wiki|L'Hôpital's rule
1|wiki|Integral
1|wiki|Antiderivative
1|wiki|Fundamental theorem of calculus
1|wiki|Integration by parts
1|wiki|Integration by substitution
1|wiki|Improper integral
1|wiki|Sequence
1|wiki|Series (mathematics)
1|wiki|Convergence tests
1|wiki|Power series
1|wiki|Taylor series
2|wiki|Multivariable calculus
2|wiki|Partial derivative
2|wiki|Gradient
2|wiki|Jacobian matrix and determinant
2|wiki|Multiple integral
2|wiki|Vector calculus
2|wiki|Green's theorem
2|wiki|Divergence theorem
2|wiki|Stokes' theorem
2|wiki|Ordinary differential equation
2|wiki|Partial differential equation
2|wiki|Fourier series
2|wiki|Fourier transform
2|wiki|Laplace transform
2|wiki|Real analysis
2|wiki|Real number
2|wiki|Cauchy sequence
2|wiki|Bolzano–Weierstrass theorem
2|wiki|Intermediate value theorem
2|wiki|Uniform continuity
2|wiki|Uniform convergence
2|wiki|Riemann integral
3|wiki|Metric space
3|wiki|Compact space
3|wiki|Banach fixed-point theorem
3|wiki|Measure (mathematics)
3|wiki|Lebesgue integral
3|wiki|Dominated convergence theorem
3|wiki|Hilbert space
3|wiki|Functional analysis
3|wiki|Complex analysis
3|wiki|Residue theorem
3|wiki|Calculus of variations`,
  },
  {
    id: 'linear-algebra',
    name: `Linear algebra & matrices`,
    why: `Vectors, matrices and decompositions are the working language of graphics, data, embeddings and every model Ghosty runs or explains.`,
    t: `1|wiki|Linear algebra
1|wiki|Euclidean vector
1|wiki|Vector space
1|wiki|Matrix (mathematics)
1|wiki|Matrix multiplication
1|wiki|System of linear equations
1|wiki|Gaussian elimination
1|wiki|Row echelon form
1|wiki|Determinant
1|wiki|Invertible matrix
1|wiki|Dot product
1|wiki|Cross product
1|wiki|Linear independence
1|wiki|Linear span
1|wiki|Basis (linear algebra)
1|wiki|Linear subspace
1|wiki|Linear map
1|wiki|Rank (linear algebra)
1|wiki|Kernel (linear algebra)
1|wiki|Rank–nullity theorem
2|wiki|Change of basis
2|wiki|Eigenvalues and eigenvectors
2|wiki|Characteristic polynomial
2|wiki|Diagonalizable matrix
2|wiki|Inner product space
2|wiki|Orthogonality
2|wiki|Gram–Schmidt process
2|wiki|Orthogonal matrix
2|wiki|Projection (linear algebra)
2|wiki|Norm (mathematics)
2|wiki|Matrix norm
2|wiki|Trace (linear algebra)
2|wiki|Symmetric matrix
2|wiki|Definite matrix
2|wiki|Quadratic form
2|wiki|Spectral theorem
2|wiki|LU decomposition
2|wiki|QR decomposition
2|wiki|Cholesky decomposition
2|wiki|Singular value decomposition
2|wiki|Moore–Penrose inverse
2|wiki|Affine transformation
2|wiki|Rotation matrix
3|wiki|Jordan normal form
3|wiki|Cayley–Hamilton theorem
3|wiki|Dual space
3|wiki|Unitary matrix
3|wiki|Schur decomposition
3|wiki|Matrix exponential
3|wiki|Kronecker product
3|wiki|Tensor
3|wiki|Low-rank approximation
3|wiki|Perron–Frobenius theorem
3|wiki|Matrix calculus
3|arxiv|Finding structure with randomness probabilistic algorithms`,
  },
  {
    id: 'probability',
    name: `Probability theory`,
    why: `Probability lets Ghosty quantify uncertainty honestly, reason about randomness in systems and data, and understand the stochastic models behind modern AI.`,
    t: `1|wiki|Probability
1|wiki|Probability theory
1|wiki|Probability interpretations
1|wiki|Sample space
1|wiki|Event (probability theory)
1|wiki|Probability axioms
1|wiki|Conditional probability
1|wiki|Independence (probability theory)
1|wiki|Bayes' theorem
1|wiki|Law of total probability
1|wiki|Random variable
1|wiki|Probability distribution
1|wiki|Probability mass function
1|wiki|Probability density function
1|wiki|Cumulative distribution function
1|wiki|Expected value
1|wiki|Variance
1|wiki|Covariance
1|wiki|Correlation
1|wiki|Bernoulli distribution
1|wiki|Binomial distribution
1|wiki|Poisson distribution
1|wiki|Continuous uniform distribution
1|wiki|Normal distribution
1|wiki|Exponential distribution
1|wiki|Birthday problem
2|wiki|Joint probability distribution
2|wiki|Conditional expectation
2|wiki|Moment (mathematics)
2|wiki|Moment generating function
2|wiki|Characteristic function (probability theory)
2|wiki|Markov's inequality
2|wiki|Chebyshev's inequality
2|wiki|Jensen's inequality
2|wiki|Law of large numbers
2|wiki|Central limit theorem
2|wiki|Gamma distribution
2|wiki|Beta distribution
2|wiki|Multivariate normal distribution
2|wiki|Order statistic
2|wiki|Monte Carlo method
3|wiki|Probability space
3|wiki|σ-algebra
3|wiki|Convergence of random variables
3|wiki|Stochastic process
3|wiki|Markov chain
3|wiki|Random walk
3|wiki|Poisson point process
3|wiki|Martingale (probability theory)
3|wiki|Wiener process
3|wiki|Concentration inequality
3|wiki|Hoeffding's inequality
3|wiki|Large deviations theory
3|wiki|Queueing theory`,
  },
  {
    id: 'statistics-data',
    name: `Statistics & data analysis`,
    why: `Inference, regression, experiments and Bayesian methods are how Ghosty turns data into defensible conclusions and spots misleading claims.`,
    t: `1|wiki|Statistics
1|openstax|/books/introductory-statistics-2e/pages/1-1-definitions-of-statistics-probability-and-key-terms
1|wiki|Descriptive statistics
1|wiki|Average
1|wiki|Median
1|wiki|Quantile
1|wiki|Sampling (statistics)
1|wiki|Standard error
1|wiki|Exploratory data analysis
1|wiki|Pearson correlation coefficient
1|wiki|Correlation does not imply causation
1|wiki|Simpson's paradox
2|wiki|Statistical inference
2|wiki|Estimator
2|wiki|Bias of an estimator
2|wiki|Maximum likelihood estimation
2|wiki|Confidence interval
2|wiki|Statistical hypothesis test
2|wiki|p-value
2|wiki|Type I and type II errors
2|wiki|Power (statistics)
2|wiki|Student's t-test
2|wiki|Chi-squared test
2|wiki|Analysis of variance
2|wiki|Multiple comparisons problem
2|wiki|False discovery rate
2|wiki|Linear regression
2|wiki|Ordinary least squares
2|wiki|Logistic regression
2|wiki|Generalized linear model
2|wiki|Lasso (statistics)
2|wiki|Cross-validation (statistics)
2|wiki|Bootstrapping (statistics)
2|wiki|Design of experiments
2|wiki|Randomized controlled trial
2|wiki|A/B testing
2|wiki|Effect size
2|wiki|Bayesian inference
2|wiki|Prior probability
2|wiki|Conjugate prior
2|wiki|Bayes factor
2|wiki|Markov chain Monte Carlo
2|wiki|Metropolis–Hastings algorithm
3|wiki|Bayesian hierarchical modeling
3|arxiv|Variational Inference A Review for Statisticians
3|wiki|Expectation–maximization algorithm
3|wiki|Time series
3|wiki|Survival analysis
3|wiki|Causal inference
3|wiki|Instrumental variables
3|wiki|Difference in differences
3|wiki|Principal component analysis
3|wiki|Fisher information
3|wiki|Meta-analysis
3|wiki|Replication crisis`,
  },
  {
    id: 'discrete-logic',
    name: `Discrete mathematics, logic & proof`,
    why: `Sets, logic, combinatorics, graphs and proof are the foundations of programming, algorithms and rigorous argument that a building, explaining AI relies on daily.`,
    t: `1|wiki|Discrete mathematics
1|wiki|Set (mathematics)
1|wiki|Function (mathematics)
1|wiki|Binary relation
1|wiki|Equivalence relation
1|wiki|Partially ordered set
1|wiki|Propositional logic
1|wiki|Truth table
1|wiki|First-order logic
1|wiki|Quantifier (logic)
1|wiki|Mathematical proof
1|wiki|Reductio ad absurdum
1|wiki|Contraposition
1|wiki|Mathematical induction
1|wiki|Combinatorics
1|wiki|Permutation
1|wiki|Binomial coefficient
1|wiki|Pigeonhole principle
1|wiki|Inclusion–exclusion principle
1|wiki|Recurrence relation
1|wiki|Graph theory
1|wiki|Graph (discrete mathematics)
1|wiki|Tree (graph theory)
2|wiki|Generating function
2|wiki|Catalan number
2|wiki|Planar graph
2|wiki|Eulerian path
2|wiki|Graph coloring
2|wiki|Matching (graph theory)
2|wiki|Max-flow min-cut theorem
2|wiki|Ramsey's theorem
2|wiki|Big O notation
2|wiki|Boolean algebra
2|wiki|Lattice (order)
2|wiki|Cardinality
2|wiki|Countable set
2|wiki|Cantor's diagonal argument
2|wiki|Set theory
2|wiki|Zermelo–Fraenkel set theory
2|wiki|Axiom of choice
2|wiki|Peano axioms
2|wiki|Natural deduction
3|wiki|Gödel's completeness theorem
3|wiki|Gödel's incompleteness theorems
3|wiki|Compactness theorem
3|wiki|Model theory
3|wiki|Continuum hypothesis
3|wiki|Modal logic
3|wiki|Intuitionistic logic
3|wiki|Type theory
3|wiki|Curry–Howard correspondence
3|wiki|Proof assistant
3|wiki|Automated theorem proving
3|wiki|Probabilistic method
3|wiki|Category theory`,
  },
  {
    id: 'optimisation-numerical',
    name: `Optimisation & numerical methods`,
    why: `Optimisation and numerical methods are the engine behind fitting models, solving equations on real hardware and making trade-off decisions that Ghosty must carry out reliably.`,
    t: `1|wiki|Mathematical optimization
1|wiki|Numerical analysis
1|wiki|Floating-point arithmetic
1|wiki|Numerical stability
1|wiki|Condition number
1|wiki|Root-finding algorithm
1|wiki|Bisection method
1|wiki|Newton's method
1|wiki|Fixed-point iteration
1|wiki|Interpolation
1|wiki|Spline interpolation
1|wiki|Numerical integration
1|wiki|Trapezoidal rule
1|wiki|Simpson's rule
1|wiki|Gaussian quadrature
1|wiki|Finite difference
1|wiki|Euler method
1|wiki|Runge–Kutta methods
1|wiki|Numerical methods for ordinary differential equations
1|wiki|Least squares
1|wiki|Lagrange multiplier
2|wiki|Convex set
2|wiki|Convex function
2|wiki|Convex optimization
2|wiki|Linear programming
2|wiki|Simplex algorithm
2|wiki|Duality (optimization)
2|wiki|Karush–Kuhn–Tucker conditions
2|wiki|Gradient descent
2|wiki|Line search
2|wiki|Newton's method in optimization
2|wiki|Quasi-Newton method
2|wiki|Broyden–Fletcher–Goldfarb–Shanno algorithm
2|wiki|Conjugate gradient method
2|wiki|Gauss–Newton algorithm
2|wiki|Stochastic gradient descent
2|wiki|Iterative method
2|wiki|Jacobi method
2|wiki|QR algorithm
2|wiki|Sparse matrix
2|wiki|Fast Fourier transform
2|wiki|Monte Carlo integration
2|wiki|Finite element method
3|wiki|Interior-point method
3|wiki|Quadratic programming
3|wiki|Semidefinite programming
3|wiki|Integer programming
3|wiki|Branch and bound
3|wiki|Dynamic programming
3|wiki|Combinatorial optimization
3|wiki|Simulated annealing
3|wiki|Trust region
3|wiki|Proximal gradient method
3|wiki|Automatic differentiation
3|arxiv|Adam A Method for Stochastic Optimization`,
  },
];
