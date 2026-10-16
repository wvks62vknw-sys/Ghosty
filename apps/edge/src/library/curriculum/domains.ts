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
  {
    id: 'physics-classical-modern',
    name: `Physics: mechanics, electromagnetism, thermodynamics, waves`,
    why: `Nearly every practical question about motion, energy, electricity, heat, sound and light reduces to these laws, so a personal AI that explains, builds or advises on anything physical needs them cold.`,
    t: `1|wiki|Physics
1|wiki|Classical mechanics
1|wiki|Kinematics
1|wiki|Newton's laws of motion
1|wiki|Force
1|wiki|Momentum
1|wiki|Energy
1|wiki|Work (physics)
1|wiki|Conservation of energy
1|wiki|Friction
1|wiki|Newton's law of universal gravitation
1|wiki|Torque
1|wiki|Angular momentum
1|wiki|Simple harmonic motion
1|wiki|Pressure
1|wiki|Buoyancy
1|wiki|Temperature
1|wiki|Wave
1|wiki|Sound
1|wiki|Doppler effect
1|wiki|Electric charge
1|wiki|Electric field
1|wiki|Electric potential
1|wiki|Electric current
1|wiki|Ohm's law
1|wiki|Magnetic field
2|wiki|Lagrangian mechanics
2|wiki|Hamiltonian mechanics
2|wiki|Fluid dynamics
2|wiki|Thermodynamics
2|wiki|Laws of thermodynamics
2|wiki|Entropy
2|wiki|Heat transfer
2|wiki|Ideal gas law
2|wiki|Kinetic theory of gases
2|wiki|Carnot cycle
2|wiki|Lorentz force
2|wiki|Faraday's law of induction
2|wiki|Maxwell's equations
2|wiki|Electromagnetic radiation
2|wiki|Optics
2|wiki|Diffraction
2|wiki|Wave interference
2|wiki|Resonance
2|wiki|RLC circuit
2|wiki|Alternating current
2|wiki|Dimensional analysis
3|wiki|Statistical mechanics
3|wiki|Phase transition
3|wiki|Noether's theorem
3|wiki|Chaos theory
3|wiki|Navier–Stokes equations
3|wiki|Wave equation
3|wiki|Plasma (physics)
3|wiki|Laser
3|wiki|Black-body radiation`,
  },
  {
    id: 'quantum-relativity',
    name: `Quantum mechanics, relativity & particle physics`,
    why: `Modern technology (lasers, semiconductors, GPS, nuclear power) and modern cosmology rest on quantum theory and relativity, and a knowledgeable AI must explain them accurately rather than by pop-science analogy.`,
    t: `1|wiki|Quantum mechanics
1|wiki|Introduction to quantum mechanics
1|wiki|Photoelectric effect
1|wiki|Wave–particle duality
1|wiki|Double-slit experiment
1|wiki|Uncertainty principle
1|wiki|Photon
1|wiki|Bohr model
1|wiki|Atomic orbital
1|wiki|Radioactive decay
1|wiki|Nuclear fission
1|wiki|Nuclear fusion
1|wiki|Special relativity
1|wiki|Mass–energy equivalence
1|wiki|Time dilation
1|wiki|Standard Model
2|wiki|Schrödinger equation
2|wiki|Wave function
2|wiki|Quantum superposition
2|wiki|Quantum entanglement
2|wiki|Quantum tunnelling
2|wiki|Spin (physics)
2|wiki|Pauli exclusion principle
2|wiki|Lorentz transformation
2|wiki|Spacetime
2|wiki|General relativity
2|wiki|Black hole
2|wiki|Gravitational wave
2|wiki|Quark
2|wiki|Fermion
2|wiki|Boson
2|wiki|Neutrino
2|wiki|Antimatter
2|wiki|Higgs boson
2|wiki|Weak interaction
2|wiki|Large Hadron Collider
3|wiki|Quantum field theory
3|wiki|Feynman diagram
3|wiki|Quantum electrodynamics
3|wiki|Quantum chromodynamics
3|wiki|Dirac equation
3|wiki|Path-integral formulation
3|wiki|Renormalization
3|wiki|Gauge theory
3|wiki|Higgs mechanism
3|wiki|Bell's theorem
3|wiki|Quantum decoherence
3|wiki|Interpretations of quantum mechanics
3|wiki|Einstein field equations
3|wiki|Schwarzschild metric
3|wiki|Hawking radiation
3|wiki|Quantum gravity
3|wiki|String theory
3|wiki|Neutrino oscillation
3|arxiv|"new boson at a mass of 125 GeV"
3|arxiv|GW150914 "Observation of Gravitational Waves"`,
  },
  {
    id: 'chemistry',
    name: `Chemistry (general, organic, physical, materials)`,
    why: `Cooking, cleaning, batteries, medicines, plastics and materials choices all come down to chemistry, so the AI needs bonding, reactions, kinetics and the organic and materials vocabulary to advise and explain.`,
    t: `1|wiki|Chemistry
1|wiki|Atom
1|wiki|Chemical element
1|wiki|Periodic table
1|wiki|Electron configuration
1|wiki|Chemical bond
1|wiki|Covalent bond
1|wiki|Ionic bonding
1|wiki|Molecule
1|wiki|Mole (unit)
1|wiki|Chemical reaction
1|wiki|Stoichiometry
1|wiki|State of matter
1|wiki|Solution (chemistry)
1|wiki|Acid
1|wiki|PH
1|wiki|Redox
1|wiki|Chemical equilibrium
1|wiki|Intermolecular force
2|wiki|Organic chemistry
2|wiki|Functional group
2|wiki|Alkane
2|wiki|Aromaticity
2|wiki|Stereochemistry
2|wiki|Nucleophilic substitution
2|wiki|Reaction mechanism
2|wiki|Chemical kinetics
2|wiki|Catalysis
2|wiki|Enthalpy
2|wiki|Gibbs free energy
2|wiki|Le Chatelier's principle
2|wiki|Electrochemistry
2|wiki|Galvanic cell
2|wiki|VSEPR theory
2|wiki|Molecular orbital theory
2|wiki|Nuclear magnetic resonance spectroscopy
2|wiki|Mass spectrometry
2|wiki|Chromatography
2|wiki|Titration
2|wiki|Crystal structure
2|wiki|Materials science
2|wiki|Polymer
2|wiki|Semiconductor
3|wiki|Quantum chemistry
3|wiki|Density functional theory
3|wiki|Transition state theory
3|wiki|Coordination complex
3|wiki|Organometallic chemistry
3|wiki|Diels–Alder reaction
3|wiki|Retrosynthetic analysis
3|wiki|Haber process
3|wiki|Lithium-ion battery
3|wiki|Graphene
3|wiki|Metal–organic framework
3|wiki|Green chemistry
3|wiki|Click chemistry`,
  },
  {
    id: 'biology-genetics',
    name: `Biology, genetics & evolution`,
    why: `Questions about health, food, pets, gardens, ancestry and biotech all depend on how cells, genes and evolution work, and an AI should reason from the real mechanisms.`,
    t: `1|wiki|Biology
1|wiki|Cell (biology)
1|wiki|Eukaryote
1|wiki|Mitochondria
1|wiki|DNA
1|wiki|RNA
1|wiki|Gene
1|wiki|Chromosome
1|wiki|Protein
1|wiki|Enzyme
1|wiki|Metabolism
1|wiki|Photosynthesis
1|wiki|Cellular respiration
1|wiki|Meiosis
1|wiki|Evolution
1|wiki|Natural selection
1|wiki|Bacteria
1|wiki|Virus
1|wiki|Ecology
2|wiki|Genetics
2|wiki|Mendelian inheritance
2|wiki|DNA replication
2|wiki|Transcription (biology)
2|wiki|Translation (biology)
2|wiki|Genetic code
2|wiki|Mutation
2|wiki|Gene expression
2|wiki|Regulation of gene expression
2|wiki|Epigenetics
2|wiki|Genome
2|wiki|Polymerase chain reaction
2|wiki|DNA sequencing
2|wiki|CRISPR gene editing
2|wiki|Population genetics
2|wiki|Genetic drift
2|wiki|Speciation
2|wiki|Phylogenetics
2|wiki|Common descent
2|wiki|Sexual selection
2|wiki|Cell signaling
2|wiki|Stem cell
2|wiki|Developmental biology
2|wiki|Biodiversity
3|wiki|Modern synthesis (20th century)
3|wiki|Neutral theory of molecular evolution
3|wiki|Horizontal gene transfer
3|wiki|Symbiogenesis
3|wiki|Abiogenesis
3|wiki|Genome-wide association study
3|wiki|Synthetic biology
3|wiki|Protein structure prediction
3|wiki|Non-coding RNA
3|wiki|Extinction event
3|wiki|Human evolution
3|wiki|Evolutionary developmental biology
3|wiki|Bioinformatics`,
  },
  {
    id: 'anatomy-medicine',
    name: `Human anatomy, physiology & medicine basics`,
    why: `People ask their AI about symptoms, medicines, fitness and emergencies; it must know how the body works and how medicine reasons about evidence so it can explain clearly and know when to say see a doctor.`,
    t: `1|openstax|/books/anatomy-and-physiology-2e/pages/1-1-overview-of-anatomy-and-physiology
1|openstax|/books/anatomy-and-physiology-2e/pages/1-2-structural-organization-of-the-human-body
1|openstax|/books/anatomy-and-physiology-2e/pages/1-5-homeostasis
1|openstax|/books/anatomy-and-physiology-2e/pages/1-6-anatomical-terminology
1|openstax|/books/anatomy-and-physiology-2e/pages/4-1-types-of-tissues
1|openstax|/books/anatomy-and-physiology-2e/pages/6-3-bone-structure
1|openstax|/books/anatomy-and-physiology-2e/pages/10-2-skeletal-muscle
1|wiki|Medicine
1|wiki|Vital signs
1|wiki|Blood pressure
1|wiki|First aid
1|wiki|Cardiopulmonary resuscitation
1|wiki|Nutrition
1|wiki|Infection
2|openstax|/books/anatomy-and-physiology-2e/pages/10-3-muscle-fiber-contraction-and-relaxation
2|openstax|/books/anatomy-and-physiology-2e/pages/12-1-basic-structure-and-function-of-the-nervous-system
2|openstax|/books/anatomy-and-physiology-2e/pages/15-1-divisions-of-the-autonomic-nervous-system
2|openstax|/books/anatomy-and-physiology-2e/pages/17-2-hormones
2|openstax|/books/anatomy-and-physiology-2e/pages/17-9-the-endocrine-pancreas
2|openstax|/books/anatomy-and-physiology-2e/pages/18-1-an-overview-of-blood
2|openstax|/books/anatomy-and-physiology-2e/pages/19-1-heart-anatomy
2|openstax|/books/anatomy-and-physiology-2e/pages/19-2-cardiac-muscle-and-electrical-activity
2|openstax|/books/anatomy-and-physiology-2e/pages/19-3-cardiac-cycle
2|openstax|/books/anatomy-and-physiology-2e/pages/20-2-blood-flow-blood-pressure-and-resistance
2|openstax|/books/anatomy-and-physiology-2e/pages/21-2-barrier-defenses-and-the-innate-immune-response
2|openstax|/books/anatomy-and-physiology-2e/pages/21-3-the-adaptive-immune-response-t-lymphocytes-and-their-functional-types
2|openstax|/books/anatomy-and-physiology-2e/pages/21-4-the-adaptive-immune-response-b-lymphocytes-and-antibodies
2|openstax|/books/anatomy-and-physiology-2e/pages/22-3-the-process-of-breathing
2|openstax|/books/anatomy-and-physiology-2e/pages/22-4-gas-exchange
2|openstax|/books/anatomy-and-physiology-2e/pages/23-1-overview-of-the-digestive-system
2|openstax|/books/anatomy-and-physiology-2e/pages/23-6-accessory-organs-in-digestion-the-liver-pancreas-and-gallbladder
2|openstax|/books/anatomy-and-physiology-2e/pages/24-5-metabolic-states-of-the-body
2|openstax|/books/anatomy-and-physiology-2e/pages/25-5-physiology-of-urine-formation
2|openstax|/books/anatomy-and-physiology-2e/pages/26-4-acid-base-balance
2|wiki|Pharmacology
2|wiki|Antibiotic
2|wiki|Vaccine
2|wiki|Inflammation
2|wiki|Pathology
2|wiki|Epidemiology
2|wiki|Medical diagnosis
2|wiki|Cardiovascular disease
2|wiki|Myocardial infarction
2|wiki|Stroke
2|wiki|Diabetes
2|wiki|Cancer
3|wiki|Evidence-based medicine
3|wiki|Randomized controlled trial
3|wiki|Pharmacokinetics
3|wiki|Sepsis
3|wiki|Antimicrobial resistance
3|wiki|Anesthesia
3|wiki|Differential diagnosis
3|wiki|Public health`,
  },
  {
    id: 'neuroscience-mind',
    name: `Neuroscience & the mind`,
    why: `To explain memory, attention, sleep, mood and learning, and to reason about minds (including its own), the AI needs real neuroscience plus the leading theories of cognition and consciousness.`,
    t: `1|wiki|Neuroscience
1|wiki|Neuron
1|wiki|Human brain
1|wiki|Synapse
1|wiki|Neurotransmitter
1|wiki|Action potential
1|wiki|Glia
1|wiki|Cerebral cortex
1|wiki|Hippocampus
1|wiki|Amygdala
1|wiki|Basal ganglia
1|wiki|Dopamine
1|wiki|Cognition
1|wiki|Memory
1|wiki|Perception
1|wiki|Attention
1|wiki|Emotion
1|wiki|Sleep
1|wiki|Consciousness
2|wiki|Neuroplasticity
2|wiki|Long-term potentiation
2|wiki|Hebbian theory
2|wiki|Visual system
2|wiki|Prefrontal cortex
2|wiki|Default mode network
2|wiki|Reward system
2|wiki|Working memory
2|wiki|Broca's area
2|wiki|Cognitive neuroscience
2|wiki|Theory of mind
2|wiki|Dual process theory
2|wiki|Cognitive bias
2|wiki|Functional magnetic resonance imaging
2|wiki|Optogenetics
2|wiki|Circadian rhythm
2|wiki|Neural oscillation
2|wiki|Mental disorder
2|wiki|Major depressive disorder
2|wiki|Alzheimer's disease
2|wiki|Addiction
3|wiki|Computational neuroscience
3|wiki|Hodgkin–Huxley model
3|wiki|Neural coding
3|wiki|Place cell
3|wiki|Predictive coding
3|wiki|Free energy principle
3|wiki|Global workspace theory
3|wiki|Hard problem of consciousness
3|wiki|Connectome
3|wiki|Brain–computer interface
3|wiki|Philosophy of mind
3|wiki|Embodied cognition
3|wiki|Chinese room
3|wiki|Lateralization of brain function
3|arxiv|"integration of deep learning and neuroscience"`,
  },
  {
    id: 'earth-climate-weather',
    name: `Earth science, climate & weather (meteorology for forecasts)`,
    why: `Forecasting the weather, explaining a storm or an earthquake, and answering climate questions honestly require real meteorology, geology and climate science rather than headlines.`,
    t: `1|wiki|Earth science
1|wiki|Internal structure of Earth
1|wiki|Plate tectonics
1|wiki|Rock cycle
1|wiki|Earthquake
1|wiki|Volcano
1|wiki|Erosion
1|wiki|Water cycle
1|wiki|Ocean current
1|wiki|Atmosphere of Earth
1|wiki|Weather
1|wiki|Climate
1|wiki|Cloud
1|wiki|Precipitation
1|wiki|Wind
1|wiki|Atmospheric pressure
1|wiki|Geologic time scale
2|wiki|Meteorology
2|wiki|Weather forecasting
2|wiki|Numerical weather prediction
2|wiki|Weather front
2|wiki|Extratropical cyclone
2|wiki|Tropical cyclone
2|wiki|Thunderstorm
2|wiki|Tornado
2|wiki|Jet stream
2|wiki|Coriolis force
2|wiki|Atmospheric circulation
2|wiki|El Niño–Southern Oscillation
2|wiki|Dew point
2|wiki|Lapse rate
2|wiki|Convective available potential energy
2|wiki|Weather radar
2|wiki|Greenhouse effect
2|wiki|Climate change
2|wiki|Carbon cycle
2|wiki|Milankovitch cycles
2|wiki|Radiometric dating
2|wiki|Groundwater
2|wiki|Glacier
2|wiki|Flood
2|wiki|Drought
2|wiki|Seismology
2|wiki|Earth's magnetic field
3|wiki|Ensemble forecasting
3|wiki|Lorenz system
3|wiki|Climate model
3|wiki|Climate sensitivity
3|wiki|Radiative forcing
3|wiki|Climate change mitigation
3|wiki|Tipping points in the climate system
3|wiki|Thermohaline circulation
3|wiki|Sea level rise
3|wiki|Atmospheric river
3|wiki|Polar vortex
3|wiki|Paleoclimatology
3|arxiv|GraphCast learning skillful medium-range global weather forecasting`,
  },
  {
    id: 'astronomy-space',
    name: `Astronomy, spaceflight & satellites`,
    why: `From naming what is in tonight's sky to explaining how GPS, launches and orbits work and what the universe is made of, the AI needs astronomy, cosmology and the engineering of spaceflight.`,
    t: `1|wiki|Astronomy
1|wiki|Solar System
1|wiki|Sun
1|wiki|Moon
1|wiki|Planet
1|wiki|Star
1|wiki|Galaxy
1|wiki|Milky Way
1|wiki|Celestial sphere
1|wiki|Telescope
1|wiki|Orbit
1|wiki|Kepler's laws of planetary motion
1|wiki|Mars
1|wiki|Spaceflight
1|wiki|Rocket
1|wiki|Satellite
1|wiki|International Space Station
2|wiki|Stellar evolution
2|wiki|Hertzsprung–Russell diagram
2|wiki|Stellar nucleosynthesis
2|wiki|Supernova
2|wiki|Exoplanet
2|wiki|Methods of detecting exoplanets
2|wiki|Big Bang
2|wiki|Cosmic microwave background
2|wiki|Hubble's law
2|wiki|Dark matter
2|wiki|Dark energy
2|wiki|Cosmic distance ladder
2|wiki|Formation and evolution of the Solar System
2|wiki|Orbital mechanics
2|wiki|Hohmann transfer orbit
2|wiki|Delta-v
2|wiki|Tsiolkovsky rocket equation
2|wiki|Geostationary orbit
2|wiki|Low Earth orbit
2|wiki|Orbital elements
2|wiki|Global Positioning System
2|wiki|Earth observation satellite
2|wiki|James Webb Space Telescope
2|wiki|Apollo program
2|wiki|Falcon 9
2|wiki|Space weather
3|wiki|Lambda-CDM model
3|wiki|Cosmic inflation
3|wiki|Supermassive black hole
3|wiki|Gravitational-wave astronomy
3|wiki|Habitable zone
3|wiki|Gravity assist
3|wiki|Lagrange point
3|wiki|Space debris
3|wiki|Spacecraft attitude determination and control
3|wiki|Ion thruster
3|wiki|Two-line element set
3|wiki|Satellite constellation
3|arxiv|"Planck 2018 results" "cosmological parameters"
3|arxiv|Event Horizon Telescope M87 shadow supermassive black hole`,
  },
  {
    id: 'microeconomics',
    name: `Microeconomics`,
    why: `Explaining prices, incentives, market failures and strategic behaviour lets a personal AI reason about why things cost what they do, how firms and people respond to rules, and what policy or business advice actually follows from the evidence.`,
    t: `1|openstax|/books/principles-microeconomics-3e/pages/1-1-what-is-economics-and-why-is-it-important
1|openstax|/books/principles-microeconomics-3e/pages/2-1-how-individuals-make-choices-based-on-their-budget-constraint
1|openstax|/books/principles-microeconomics-3e/pages/2-2-the-production-possibilities-frontier-and-social-choices
1|openstax|/books/principles-microeconomics-3e/pages/3-1-demand-supply-and-equilibrium-in-markets-for-goods-and-services
1|openstax|/books/principles-microeconomics-3e/pages/3-2-shifts-in-demand-and-supply-for-goods-and-services
1|openstax|/books/principles-microeconomics-3e/pages/3-4-price-ceilings-and-price-floors
1|openstax|/books/principles-microeconomics-3e/pages/3-5-demand-supply-and-efficiency
1|openstax|/books/principles-microeconomics-3e/pages/5-1-price-elasticity-of-demand-and-price-elasticity-of-supply
1|openstax|/books/principles-microeconomics-3e/pages/6-1-consumption-choices
1|openstax|/books/principles-microeconomics-3e/pages/6-3-behavioral-economics-an-alternative-framework-for-consumer-choice
1|openstax|/books/principles-microeconomics-3e/pages/7-3-costs-in-the-short-run
1|openstax|/books/principles-microeconomics-3e/pages/7-5-costs-in-the-long-run
2|openstax|/books/principles-microeconomics-3e/pages/8-2-how-perfectly-competitive-firms-make-output-decisions
2|openstax|/books/principles-microeconomics-3e/pages/9-2-how-a-profit-maximizing-monopoly-chooses-output-and-price
2|openstax|/books/principles-microeconomics-3e/pages/10-1-monopolistic-competition
2|openstax|/books/principles-microeconomics-3e/pages/10-2-oligopoly
2|openstax|/books/principles-microeconomics-3e/pages/13-3-public-goods
2|openstax|/books/principles-microeconomics-3e/pages/14-1-the-theory-of-labor-markets
2|openstax|/books/principles-microeconomics-3e/pages/15-4-income-inequality-measurement-and-causes
2|openstax|/books/principles-microeconomics-3e/pages/16-1-the-problem-of-imperfect-information-and-asymmetric-information
2|openstax|/books/principles-microeconomics-3e/pages/19-1-absolute-and-comparative-advantage
2|openstax|/books/principles-microeconomics-3e/pages/20-1-protectionism-an-indirect-subsidy-from-consumers-to-producers
2|wiki|Indifference curve
2|wiki|Economic surplus
2|wiki|Tax incidence
2|wiki|Deadweight loss
2|wiki|Price discrimination
2|wiki|Monopsony
2|wiki|Externality
2|wiki|Pigouvian tax
2|wiki|Tragedy of the commons
2|wiki|Market failure
2|wiki|Game theory
2|wiki|Nash equilibrium
2|wiki|Prisoner's dilemma
2|wiki|Adverse selection
2|wiki|Moral hazard
2|wiki|Pareto efficiency
2|wiki|Nudge theory
3|wiki|Cournot competition
3|wiki|Bertrand competition
3|wiki|Coase theorem
3|wiki|The Market for Lemons
3|wiki|Signalling (economics)
3|wiki|Principal–agent problem
3|wiki|Mechanism design
3|wiki|Auction theory
3|wiki|General equilibrium theory
3|wiki|Fundamental theorems of welfare economics
3|wiki|Arrow's impossibility theorem
3|wiki|Prospect theory
3|wiki|Two-sided market
3|wiki|Difference in differences
3|arxiv|Optimal auctions through deep learning`,
  },
  {
    id: 'macroeconomics-money',
    name: `Macroeconomics, money & central banking`,
    why: `Understanding GDP, inflation, unemployment, how banks create money and what central banks and governments actually do lets a personal AI explain the news, interest-rate moves and recessions, and advise sensibly on how they touch savings, jobs and prices.`,
    t: `1|openstax|/books/principles-macroeconomics-3e/pages/6-1-measuring-the-size-of-the-economy-gross-domestic-product
1|openstax|/books/principles-macroeconomics-3e/pages/7-1-the-relatively-recent-arrival-of-economic-growth
1|openstax|/books/principles-macroeconomics-3e/pages/7-2-labor-productivity-and-economic-growth
1|openstax|/books/principles-macroeconomics-3e/pages/8-1-how-economists-define-and-compute-unemployment-rate
1|openstax|/books/principles-macroeconomics-3e/pages/9-1-tracking-inflation
1|openstax|/books/principles-macroeconomics-3e/pages/14-1-defining-money-by-its-functions
1|openstax|/books/principles-macroeconomics-3e/pages/14-4-how-banks-create-money
1|openstax|/books/principles-macroeconomics-3e/pages/15-3-how-a-central-bank-executes-monetary-policy
2|openstax|/books/principles-macroeconomics-3e/pages/11-2-building-a-model-of-aggregate-demand-and-aggregate-supply
2|openstax|/books/principles-macroeconomics-3e/pages/12-2-the-building-blocks-of-keynesian-analysis
2|openstax|/books/principles-macroeconomics-3e/pages/12-3-the-phillips-curve
2|openstax|/books/principles-macroeconomics-3e/pages/13-1-the-building-blocks-of-neoclassical-analysis
2|openstax|/books/principles-macroeconomics-3e/pages/15-4-monetary-policy-and-economic-outcomes
2|openstax|/books/principles-macroeconomics-3e/pages/16-1-how-the-foreign-exchange-market-works
2|openstax|/books/principles-macroeconomics-3e/pages/16-4-exchange-rate-policies
2|openstax|/books/principles-macroeconomics-3e/pages/17-3-federal-deficits-and-the-national-debt
2|openstax|/books/principles-macroeconomics-3e/pages/17-4-using-fiscal-policy-to-fight-recession-unemployment-and-inflation
2|openstax|/books/principles-macroeconomics-3e/pages/19-2-improving-countries-standards-of-living
2|wiki|Business cycle
2|wiki|IS–LM model
2|wiki|Monetarism
2|wiki|Inflation targeting
2|wiki|Bank of England
2|wiki|Federal Reserve
2|wiki|European Central Bank
2|wiki|Fractional-reserve banking
2|wiki|Lender of last resort
2|wiki|Bank run
2|wiki|Yield curve
2|wiki|Quantitative easing
2|wiki|Great Depression
2|wiki|Stagflation
2|wiki|2008 financial crisis
2|wiki|Gold standard
2|wiki|Bretton Woods system
2|wiki|Balance of payments
3|wiki|Solow–Swan model
3|wiki|Endogenous growth theory
3|wiki|NAIRU
3|wiki|Rational expectations
3|wiki|Lucas critique
3|wiki|New Keynesian economics
3|wiki|Dynamic stochastic general equilibrium
3|wiki|Taylor rule
3|wiki|Zero lower bound
3|wiki|Liquidity trap
3|wiki|Basel III
3|wiki|Shadow banking system
3|wiki|Eurozone crisis
3|wiki|Hyperinflation
3|wiki|Impossible trinity
3|wiki|Fiscal multiplier
3|wiki|Sovereign default
3|wiki|Modern Monetary Theory
3|wiki|Central bank digital currency`,
  },
  {
    id: 'finance-investing-uk',
    name: `Finance, investing & UK personal finance`,
    why: `Knowing how compounding, markets, pensions, ISAs, UK tax, mortgages and credit actually work lets a personal AI give its owner grounded, specific money advice instead of generic platitudes, and spot when a product or plan is a bad deal.`,
    t: `1|wiki|Personal finance
1|wiki|Personal budget
1|wiki|Emergency fund
1|wiki|Compound interest
1|wiki|Annual percentage rate
1|wiki|Credit score
1|wiki|Credit card
1|wiki|Individual savings account
1|wiki|Premium Bonds
1|wiki|Stock
1|wiki|Bond (finance)
1|wiki|Dividend
1|wiki|Index fund
1|wiki|Exchange-traded fund
2|wiki|Diversification (finance)
2|wiki|Asset allocation
2|wiki|Passive management
2|wiki|Dollar-cost averaging
2|wiki|Gilt-edged securities
2|wiki|Price–earnings ratio
2|wiki|Financial statement
2|wiki|Net present value
2|wiki|Pensions in the United Kingdom
2|wiki|State Pension (United Kingdom)
2|wiki|Automatic enrolment
2|wiki|Self-invested personal pension
2|wiki|Annuity
2|wiki|Taxation in the United Kingdom
2|wiki|National Insurance
2|wiki|Capital gains tax in the United Kingdom
2|wiki|Inheritance tax in the United Kingdom
2|wiki|Council Tax
2|wiki|Stamp duty in the United Kingdom
2|wiki|Student loans and grants in the United Kingdom
2|wiki|Universal Credit
2|wiki|Mortgage
2|wiki|Mortgage industry of the United Kingdom
2|wiki|Fixed-rate mortgage
2|wiki|Payday loan
2|wiki|Financial Conduct Authority
2|wiki|Financial Services Compensation Scheme
2|wiki|Financial Ombudsman Service
2|wiki|Individual voluntary arrangement
2|wiki|Bankruptcy in the United Kingdom
2|wiki|Life insurance
3|wiki|Modern portfolio theory
3|wiki|Capital asset pricing model
3|wiki|Efficient-market hypothesis
3|wiki|Behavioural finance
3|wiki|Sharpe ratio
3|wiki|Option (finance)
3|wiki|Black–Scholes model
3|wiki|Income drawdown
3|wiki|Cryptocurrency
3|arxiv|Deep hedging derivatives neural networks`,
  },
  {
    id: 'psychology',
    name: `Psychology: cognitive, social, developmental, clinical basics`,
    why: `Knowing how people learn, remember, decide, develop and go wrong lets a personal AI explain its owner's own mind to them, teach in ways that stick, and recognise when to point toward real help rather than guess.`,
    t: `1|openstax|/books/psychology-2e/pages/1-1-what-is-psychology
1|openstax|/books/psychology-2e/pages/1-2-history-of-psychology
1|openstax|/books/psychology-2e/pages/2-2-approaches-to-research
1|openstax|/books/psychology-2e/pages/2-3-analyzing-findings
1|openstax|/books/psychology-2e/pages/3-4-the-brain-and-spinal-cord
1|openstax|/books/psychology-2e/pages/4-2-sleep-and-why-we-sleep
1|openstax|/books/psychology-2e/pages/5-1-sensation-versus-perception
1|openstax|/books/psychology-2e/pages/6-2-classical-conditioning
1|openstax|/books/psychology-2e/pages/6-3-operant-conditioning
1|openstax|/books/psychology-2e/pages/7-1-what-is-cognition
1|openstax|/books/psychology-2e/pages/8-1-how-memory-functions
1|openstax|/books/psychology-2e/pages/9-3-stages-of-development
1|openstax|/books/psychology-2e/pages/10-1-motivation
1|openstax|/books/psychology-2e/pages/10-4-emotion
1|openstax|/books/psychology-2e/pages/12-1-what-is-social-psychology
2|openstax|/books/psychology-2e/pages/8-3-problems-with-memory
2|openstax|/books/psychology-2e/pages/9-2-lifespan-theories
2|openstax|/books/psychology-2e/pages/12-3-attitudes-and-persuasion
2|openstax|/books/psychology-2e/pages/12-4-conformity-compliance-and-obedience
2|openstax|/books/psychology-2e/pages/12-5-prejudice-and-discrimination
2|openstax|/books/psychology-2e/pages/14-1-what-is-stress
2|openstax|/books/psychology-2e/pages/15-2-diagnosing-and-classifying-psychological-disorders
2|openstax|/books/psychology-2e/pages/15-4-anxiety-disorders
2|openstax|/books/psychology-2e/pages/15-7-depressive-bipolar-and-related-disorders
2|openstax|/books/psychology-2e/pages/15-8-schizophrenia
2|openstax|/books/psychology-2e/pages/16-2-types-of-treatment
2|wiki|Cognitive bias
2|wiki|Confirmation bias
2|wiki|Working memory
2|wiki|Spaced repetition
2|wiki|Testing effect
2|wiki|Attachment theory
2|wiki|Theory of mind
2|wiki|Big Five personality traits
2|wiki|Cognitive dissonance
2|wiki|Fundamental attribution error
2|wiki|Milgram experiment
2|wiki|Bystander effect
2|wiki|Self-determination theory
2|wiki|Cognitive behavioral therapy
2|wiki|Mindfulness
2|wiki|Placebo
3|wiki|Dual process theory
3|wiki|Baddeley's model of working memory
3|wiki|Executive functions
3|wiki|Neuroplasticity
3|wiki|Replication crisis
3|wiki|Psychometrics
3|wiki|Intelligence quotient
3|wiki|Flynn effect
3|wiki|Emotional self-regulation
3|wiki|Evolutionary psychology
3|wiki|Dunning–Kruger effect
3|arxiv|Using cognitive psychology to understand GPT-3`,
  },
  {
    id: 'sociology-politics',
    name: `Sociology, political science & government (UK and comparative)`,
    why: `Understanding how societies are structured, how power is won and exercised, and how the UK state and its peers actually work lets a personal AI explain elections, institutions and social change accurately and advise on engaging with them.`,
    t: `1|wiki|Sociology
1|wiki|Culture
1|wiki|Socialization
1|wiki|Social structure
1|wiki|Social stratification
1|wiki|Social class
1|wiki|Social mobility
1|wiki|Politics
1|wiki|State (polity)
1|wiki|Democracy
1|wiki|Constitution
1|wiki|Political party
2|wiki|Émile Durkheim
2|wiki|Max Weber
2|wiki|Karl Marx
2|wiki|Structural functionalism
2|wiki|Conflict theories
2|wiki|Symbolic interactionism
2|wiki|Cultural capital
2|wiki|Bureaucracy
2|wiki|Deviance (sociology)
2|wiki|Demographic transition
2|wiki|Social movement
2|wiki|Separation of powers
2|wiki|Liberal democracy
2|wiki|Authoritarianism
2|wiki|Parliamentary system
2|wiki|Federalism
2|wiki|Electoral system
2|wiki|First-past-the-post voting
2|wiki|Proportional representation
2|wiki|Liberalism
2|wiki|Conservatism
2|wiki|Socialism
2|wiki|Populism
2|wiki|Nationalism
2|wiki|Welfare state
2|wiki|International relations
2|wiki|United Nations
2|wiki|European Union
2|wiki|Politics of the United Kingdom
2|wiki|Parliament of the United Kingdom
2|wiki|Prime Minister of the United Kingdom
2|wiki|Devolution in the United Kingdom
2|wiki|Elections in the United Kingdom
2|wiki|Brexit
2|wiki|Politics of the United States
3|wiki|Pierre Bourdieu
3|wiki|Intersectionality
3|wiki|Constitution of the United Kingdom
3|wiki|Parliamentary sovereignty
3|wiki|Comparative politics
3|wiki|Political polarization
3|wiki|Democratic backsliding
3|wiki|Duverger's law`,
  },
  {
    id: 'uk-law-rights',
    name: `UK law & everyday rights`,
    why: `Knowing the real statutes and procedures behind consumer refunds, tenancies, dismissal, data rights, police powers and driving offences lets a personal AI tell its owner what they are actually entitled to and which steps and bodies to use, while knowing when a solicitor is needed.`,
    t: `1|wiki|Law of the United Kingdom
1|wiki|English law
1|wiki|Common law
1|wiki|Precedent
1|wiki|Courts of England and Wales
1|wiki|Rule of law
1|wiki|Citizens Advice
1|wiki|Human Rights Act 1998
1|wiki|Equality Act 2010
1|wiki|The Highway Code
2|wiki|Consumer Rights Act 2015
2|wiki|Consumer Credit Act 1974
2|wiki|Consumer protection in the United Kingdom
2|wiki|County Court (England and Wales)
2|wiki|English contract law
2|wiki|English tort law
2|wiki|Negligence
2|wiki|Assured shorthold tenancy
2|wiki|Section 21 notice
2|wiki|Tenancy deposit scheme
2|wiki|Leasehold estate
2|wiki|United Kingdom labour law
2|wiki|Employment Rights Act 1996
2|wiki|Unfair dismissal in the United Kingdom
2|wiki|Employment tribunal
2|wiki|National Minimum Wage Act 1998
2|wiki|Working Time Regulations 1998
2|wiki|Zero-hour contract
2|wiki|Data Protection Act 2018
2|wiki|General Data Protection Regulation
2|wiki|Information Commissioner's Office
2|wiki|Right of access to personal data
2|wiki|Road Traffic Act 1988
2|wiki|Driving licence in the United Kingdom
2|wiki|Road speed limits in the United Kingdom
2|wiki|Drunk driving law by country
2|wiki|MOT test
2|wiki|Vehicle insurance
2|wiki|Police and Criminal Evidence Act 1984
2|wiki|Powers of the police in England and Wales
2|wiki|Right to silence in England and Wales
2|wiki|Magistrates' court (England and Wales)
2|wiki|Crown Court
2|wiki|Legal aid
2|wiki|Will and testament
2|wiki|Intestacy
2|wiki|Lasting power of attorney
2|wiki|Divorce in England and Wales
2|wiki|Common-law marriage
3|wiki|Renters' Rights Act 2025
3|wiki|Employment Rights Act 2025
3|wiki|Public Interest Disclosure Act 1998
3|wiki|Online Safety Act 2023
3|wiki|Judicial review in English law
3|wiki|Supreme Court of the United Kingdom`,
  },
  {
    id: 'world-history',
    name: `World history (landmark events, eras, civilisations)`,
    why: `A working map of civilisations, turning points and long-run causes lets a personal AI place any question, place or institution in context, explain how the present came about, and draw honest analogies rather than inventing them.`,
    t: `1|wiki|Human history
1|wiki|Neolithic Revolution
1|wiki|Cradle of civilization
1|wiki|Mesopotamia
1|wiki|Ancient Egypt
1|wiki|Indus Valley Civilisation
1|wiki|Ancient Greece
1|wiki|Roman Empire
1|wiki|Middle Ages
1|wiki|Renaissance
1|wiki|Industrial Revolution
1|wiki|World War I
1|wiki|World War II
1|wiki|Cold War
2|wiki|Late Bronze Age collapse
2|wiki|Achaemenid Empire
2|wiki|Alexander the Great
2|wiki|Han dynasty
2|wiki|Maurya Empire
2|wiki|Byzantine Empire
2|wiki|Early Muslim conquests
2|wiki|Islamic Golden Age
2|wiki|Crusades
2|wiki|Mongol Empire
2|wiki|Black Death
2|wiki|Ottoman Empire
2|wiki|Mali Empire
2|wiki|Aztec Empire
2|wiki|Inca Empire
2|wiki|Age of Discovery
2|wiki|Columbian exchange
2|wiki|Reformation
2|wiki|Atlantic slave trade
2|wiki|Scientific Revolution
2|wiki|Mughal Empire
2|wiki|Qing dynasty
2|wiki|Age of Enlightenment
2|wiki|American Revolution
2|wiki|French Revolution
2|wiki|Meiji Restoration
2|wiki|Scramble for Africa
2|wiki|British Empire
2|wiki|Russian Revolution
2|wiki|The Holocaust
2|wiki|Decolonization
2|wiki|Partition of India
2|wiki|Chinese Communist Revolution
2|wiki|Dissolution of the Soviet Union
2|wiki|September 11 attacks
3|wiki|Great Divergence
3|wiki|Silk Road
3|wiki|Peace of Westphalia
3|wiki|Haitian Revolution
3|wiki|Rwandan genocide
3|wiki|Arab Spring`,
  },
  {
    id: 'british-history-birmingham',
    name: `British history and Birmingham & the West Midlands (industrial revolution, the city, its transport and institutions)`,
    why: `Its owner lives in the West Midlands, so knowing how Britain and Birmingham came to be lets the AI explain the places, institutions and history around them with real local depth.`,
    t: `1|wiki|History of England
1|wiki|Roman Britain
1|wiki|Anglo-Saxons
1|wiki|Norman Conquest
1|wiki|Magna Carta
1|wiki|Wars of the Roses
1|wiki|Tudor period
1|wiki|English Reformation
1|wiki|English Civil War
1|wiki|Glorious Revolution
1|wiki|Acts of Union 1707
1|wiki|Industrial Revolution
1|wiki|British Empire
1|wiki|Victorian era
1|wiki|Birmingham
1|wiki|History of Birmingham
1|wiki|West Midlands (county)
1|wiki|Black Country
2|wiki|Lunar Society of Birmingham
2|wiki|Matthew Boulton
2|wiki|James Watt
2|wiki|Soho Manufactory
2|wiki|Joseph Priestley
2|wiki|Priestley Riots
2|wiki|Birmingham Canal Navigations
2|wiki|Jewellery Quarter
2|wiki|Birmingham Small Arms Company
2|wiki|Birmingham Political Union
2|wiki|Reform Act 1832
2|wiki|Joseph Chamberlain
2|wiki|Birmingham Town Hall
2|wiki|Cadbury
2|wiki|Bournville
2|wiki|Ironbridge Gorge
2|wiki|Wolverhampton
2|wiki|Birmingham New Street railway station
2|wiki|Spaghetti Junction, Birmingham
2|wiki|West Midlands Metro
2|wiki|Transport for West Midlands
2|wiki|University of Birmingham
2|wiki|Birmingham Museum and Art Gallery
2|wiki|Birmingham Back to Backs
2|wiki|Peaky Blinders
3|wiki|Birmingham Blitz
3|wiki|Coventry Blitz
3|wiki|Post-war Britain (1945–1979)
3|wiki|National Health Service
3|wiki|Longbridge plant
3|wiki|British Leyland
3|wiki|Birmingham pub bombings
3|wiki|Thatcherism
3|wiki|Balti (food)
3|wiki|Birmingham City Council
3|wiki|2022 Commonwealth Games
3|wiki|Brexit`,
  },
  {
    id: 'philosophy-ethics',
    name: `Philosophy, ethics & critical thinking`,
    why: `Sound reasoning, spotting fallacies and weighing ethical trade-offs are what let a personal AI give honest, well-argued advice rather than confident nonsense.`,
    t: `1|wiki|Philosophy
1|openstax|/books/introduction-philosophy/pages/1-1-what-is-philosophy
1|wiki|Epistemology
1|wiki|Metaphysics
1|wiki|Ethics
1|wiki|Logic
1|wiki|Critical thinking
1|wiki|Socrates
1|wiki|Plato
1|wiki|Aristotle
1|wiki|Socratic method
1|wiki|Stoicism
1|wiki|Argument
1|wiki|Fallacy
1|openstax|/books/introduction-philosophy/pages/5-5-informal-fallacies
1|wiki|Deductive reasoning
1|wiki|Inductive reasoning
1|wiki|Abductive reasoning
2|wiki|Validity (logic)
2|wiki|Propositional logic
2|wiki|First-order logic
2|wiki|Occam's razor
2|wiki|Falsifiability
2|wiki|Problem of induction
2|wiki|Philosophy of science
2|wiki|The Structure of Scientific Revolutions
2|wiki|Empiricism
2|wiki|David Hume
2|wiki|Immanuel Kant
2|wiki|Categorical imperative
2|wiki|Utilitarianism
2|wiki|Deontology
2|wiki|Virtue ethics
2|openstax|/books/introduction-philosophy/pages/9-2-consequentialism
2|wiki|Social contract
2|wiki|A Theory of Justice
2|wiki|Existentialism
2|wiki|Friedrich Nietzsche
2|wiki|Ludwig Wittgenstein
2|wiki|Trolley problem
2|wiki|Gettier problem
3|wiki|Philosophy of mind
3|wiki|Hard problem of consciousness
3|wiki|Free will
3|wiki|Compatibilism
3|wiki|Personal identity
3|wiki|Moral relativism
3|wiki|Metaethics
3|wiki|Is–ought problem
3|wiki|Bioethics
3|wiki|Ethics of artificial intelligence
3|wiki|Effective altruism
3|wiki|Chinese room
3|arxiv|Concrete Problems in AI Safety
3|arxiv|alignment problem from a deep learning perspective`,
  },
  {
    id: 'linguistics-languages',
    name: `Linguistics & how languages work`,
    why: `An AI that works in language should understand how sounds, words, grammar and meaning are built, how languages change, and why its owner's Brummie English is the way it is.`,
    t: `1|wiki|Linguistics
1|wiki|Language
1|wiki|Phonetics
1|wiki|International Phonetic Alphabet
1|wiki|Syllable
1|wiki|Phonology
1|wiki|Phoneme
1|wiki|Morphology (linguistics)
1|wiki|Morpheme
1|wiki|Syntax
1|wiki|Semantics
1|wiki|Pragmatics
1|wiki|Grammar
1|wiki|Part of speech
1|wiki|English grammar
2|wiki|Historical linguistics
2|wiki|Comparative method
2|wiki|Indo-European languages
2|wiki|Proto-Indo-European language
2|wiki|Grimm's law
2|wiki|Great Vowel Shift
2|wiki|History of English
2|wiki|Language family
2|wiki|Sociolinguistics
2|wiki|Dialect
2|wiki|Code-switching
2|wiki|Brummie dialect
2|wiki|Languages of the United Kingdom
2|wiki|Language acquisition
2|wiki|Second-language acquisition
2|wiki|Noam Chomsky
2|wiki|Generative grammar
2|wiki|Universal grammar
2|wiki|Linguistic typology
2|wiki|Word order
2|wiki|Grammatical aspect
2|wiki|Writing system
2|wiki|Etymology
2|wiki|Loanword
2|wiki|Speech act
2|wiki|Cooperative principle
2|wiki|Implicature
2|wiki|Creole language
3|wiki|Linguistic relativity
3|wiki|Psycholinguistics
3|wiki|Corpus linguistics
3|wiki|Computational linguistics
3|wiki|Language death
3|wiki|Minimalist program
3|wiki|Construction grammar
3|wiki|Conceptual metaphor
3|wiki|Discourse analysis
3|arxiv|Syntactic Structure from Deep Learning
3|arxiv|BERT Rediscovers the Classical NLP Pipeline`,
  },
  {
    id: 'literature-writing',
    name: `Literature, rhetoric & clear writing`,
    why: `Everything the AI produces is writing, so it needs the craft of clear prose and persuasion plus the literary knowledge to discuss, quote and recommend books well.`,
    t: `1|wiki|Literature
1|wiki|Rhetoric
1|wiki|Modes of persuasion
1|wiki|Narrative
1|wiki|Plot (narrative)
1|wiki|Character (arts)
1|wiki|Theme (narrative)
1|wiki|Literary genre
1|wiki|Poetry
1|wiki|Novel
1|wiki|Essay
1|wiki|Drama
1|wiki|Figure of speech
1|wiki|Metaphor
1|wiki|Irony
1|wiki|Paragraph
1|wiki|Thesis statement
1|wiki|Writing style
1|wiki|Plain language
1|wiki|Punctuation
2|wiki|Rhetoric (Aristotle)
2|wiki|Inventio
2|wiki|The Elements of Style
2|wiki|Politics and the English Language
2|wiki|Active voice
2|wiki|Copy editing
2|wiki|Style guide
2|wiki|Technical writing
2|wiki|Writing process
2|wiki|Show, don't tell
2|wiki|Narration
2|wiki|Unreliable narrator
2|wiki|Hero's journey
2|wiki|Three-act structure
2|wiki|Satire
2|wiki|Epic poetry
2|wiki|Iliad
2|wiki|The Canterbury Tales
2|wiki|William Shakespeare
2|wiki|Romantic poetry
2|wiki|Jane Austen
2|wiki|Charles Dickens
2|wiki|Sonnet
2|wiki|Readability
2|wiki|Inverted pyramid (journalism)
2|openstax|/books/writing-guide/pages/10-1-making-a-case-defining-a-position-argument
2|openstax|/books/writing-guide/pages/11-1-developing-your-sense-of-logic
3|wiki|Literary modernism
3|wiki|Stream of consciousness
3|wiki|Postmodern literature
3|wiki|Literary criticism
3|wiki|Literary theory
3|wiki|Deconstruction
3|wiki|Postcolonial literature
3|wiki|Close reading`,
  },
  {
    id: 'music-theory-art',
    name: `Music theory, art & design history`,
    why: `Being able to explain why a chord progression works or why a design feels balanced lets the AI help with music, visual projects and taste, not just facts.`,
    t: `1|wiki|Music theory
1|wiki|Pitch (music)
1|wiki|Scale (music)
1|wiki|Major scale
1|wiki|Minor scale
1|wiki|Interval (music)
1|wiki|Chord (music)
1|wiki|Key (music)
1|wiki|Rhythm
1|wiki|Time signature
1|wiki|Musical notation
1|wiki|Melody
1|wiki|Harmony
1|wiki|Art history
1|wiki|Elements of art
1|wiki|Composition (visual arts)
1|wiki|Color theory
1|wiki|Perspective (graphical)
1|wiki|Typography
2|wiki|Circle of fifths
2|wiki|Chord progression
2|wiki|Cadence
2|wiki|Counterpoint
2|wiki|Tonality
2|wiki|Modulation (music)
2|wiki|Twelve-bar blues
2|wiki|Roman numeral analysis
2|wiki|Sonata form
2|wiki|Baroque music
2|wiki|Johann Sebastian Bach
2|wiki|Jazz
2|wiki|Renaissance art
2|wiki|Leonardo da Vinci
2|wiki|Romanticism
2|wiki|Impressionism
2|wiki|Post-Impressionism
2|wiki|Pre-Raphaelite Brotherhood
2|wiki|Arts and Crafts movement
2|wiki|Art Nouveau
2|wiki|Bauhaus
2|wiki|Graphic design
2|wiki|Principles of grouping
2|wiki|Golden ratio
3|wiki|Jazz harmony
3|wiki|Twelve-tone technique
3|wiki|Minimal music
3|arxiv|Music Transformer generating music with long-term structure
3|wiki|Cubism
3|wiki|Surrealism
3|wiki|Abstract expressionism
3|wiki|Pop art
3|wiki|Modern art
3|wiki|Swiss Style (design)
3|wiki|Dieter Rams
3|wiki|Brutalist architecture`,
  },
  {
    id: 'communication-negotiation-productivity',
    name: `Communication, negotiation, decision-making & productivity`,
    why: `Advising a person well means knowing how people listen, bargain, decide under bias and get things done, so the AI's suggestions actually work in real life.`,
    t: `1|wiki|Communication
1|wiki|Interpersonal communication
1|wiki|Active listening
1|wiki|Nonverbal communication
1|wiki|Public speaking
1|wiki|Assertiveness
1|wiki|Emotional intelligence
1|wiki|Persuasion
1|wiki|Negotiation
1|wiki|Decision-making
1|wiki|Time management
1|wiki|Goal setting
2|wiki|Best alternative to a negotiated agreement
2|wiki|Getting to Yes
2|wiki|Zone of possible agreement
2|wiki|Conflict resolution
2|wiki|Nonviolent Communication
2|wiki|Crucial Conversations: Tools for Talking When Stakes Are High
2|wiki|Influence: Science and Practice
2|openstax|/books/organizational-behavior/pages/14-4-negotiation-behavior
2|wiki|Cognitive bias
2|wiki|List of cognitive biases
2|wiki|Confirmation bias
2|wiki|Anchoring effect
2|wiki|Sunk cost
2|wiki|Loss aversion
2|wiki|Planning fallacy
2|wiki|Groupthink
2|wiki|Thinking, Fast and Slow
2|openstax|/books/principles-management/pages/2-4-barriers-to-effective-decision-making
2|wiki|Getting Things Done
2|wiki|Procrastination
2|wiki|Flow (psychology)
2|wiki|SMART criteria
2|wiki|Objectives and key results
2|wiki|Five whys
2|wiki|Spaced repetition
2|wiki|Testing effect
2|wiki|Zettelkasten
2|wiki|Metacognition
2|wiki|Barbara Minto
3|wiki|Game theory
3|wiki|Prisoner's dilemma
3|wiki|Nash equilibrium
3|wiki|Decision theory
3|wiki|Expected utility hypothesis
3|wiki|Bounded rationality
3|wiki|Prospect theory
3|wiki|Nudge theory
3|wiki|Multiple-criteria decision analysis
3|wiki|Pre-mortem
3|wiki|The Good Judgment Project
3|wiki|Cynefin framework
3|openstax|/books/principles-management/pages/2-6-group-decision-making
3|arxiv|Deal or No Deal end-to-end learning negotiation dialogues`,
  },
  {
    id: 'geography-transport-uk',
    name: `Geography & transport systems (UK roads, rail, aviation, shipping, how traffic and transit networks work)`,
    why: `The AI reads live West Midlands traffic and transit feeds, so it must understand how UK roads, railways, airports and ports are organised and why networks jam or flow.`,
    t: `1|wiki|Geography
1|wiki|Physical geography
1|wiki|Human geography
1|wiki|Geography of the United Kingdom
1|wiki|Regions of England
1|wiki|Ordnance Survey
1|wiki|Transport in the United Kingdom
1|wiki|Roads in the United Kingdom
1|wiki|Public transport
1|wiki|Rail transport in Great Britain
1|wiki|Aviation in the United Kingdom
2|wiki|Great Britain road numbering scheme
2|wiki|List of motorways in the United Kingdom
2|wiki|M6 motorway
2|wiki|The Highway Code
2|wiki|National Highways
2|wiki|Smart motorway
2|wiki|Traffic congestion
2|wiki|Traffic flow
2|wiki|Transportation planning
2|wiki|Bus deregulation in Great Britain
2|wiki|National Express
2|wiki|History of rail transport in Great Britain
2|wiki|Beeching cuts
2|wiki|Privatisation of British Rail
2|wiki|Network Rail
2|wiki|Great British Railways
2|wiki|Railway signalling
2|wiki|High Speed 2
2|wiki|London Underground
2|wiki|Heathrow Airport
2|wiki|Birmingham Airport
2|wiki|Maritime transport
2|wiki|Port of Felixstowe
2|wiki|Channel Tunnel
2|wiki|Canals of the United Kingdom
2|wiki|Postcodes in the United Kingdom
2|wiki|Geographic information system
2|wiki|GTFS
2|wiki|Road safety
3|wiki|Induced demand
3|wiki|Braess's paradox
3|wiki|Fundamental diagram of traffic flow
3|wiki|Nagel–Schreckenberg model
3|wiki|Split Cycle Offset Optimisation Technique
3|wiki|Transportation forecasting
3|wiki|Route assignment
3|wiki|Vehicle routing problem
3|wiki|European Train Control System
3|wiki|Railway electrification in Great Britain
3|wiki|Air traffic control
3|wiki|Congestion pricing
3|wiki|Low traffic neighbourhood
3|wiki|Transport economics
3|arxiv|Diffusion convolutional recurrent neural network traffic forecasting`,
  },
  {
    id: 'electronics-electrical',
    name: `Electronics & electrical engineering`,
    why: `Circuits, components, power and signals underpin every device the AI is asked to debug, design or explain, from a blown fuse to a microcontroller project.`,
    t: `1|wiki|Electrical engineering
1|wiki|Electric current
1|wiki|Voltage
1|wiki|Electrical resistance and conductance
1|wiki|Ohm's law
1|wiki|Electric power
1|wiki|Series and parallel circuits
1|wiki|Kirchhoff's circuit laws
1|openstax|/books/university-physics-volume-2/pages/10-3-kirchhoffs-rules
1|wiki|Resistor
1|wiki|Capacitor
1|wiki|Inductor
1|wiki|Alternating current
1|wiki|Multimeter
1|wiki|Soldering
1|wiki|Ground (electricity)
2|wiki|Thévenin's theorem
2|wiki|RC circuit
2|wiki|RLC circuit
2|wiki|Electrical impedance
2|wiki|Transformer
2|wiki|Semiconductor
2|wiki|Diode
2|wiki|Bipolar junction transistor
2|wiki|MOSFET
2|wiki|Amplifier
2|wiki|Operational amplifier
2|wiki|Operational amplifier applications
2|wiki|Negative feedback
2|wiki|Digital electronics
2|wiki|Flip-flop (electronics)
2|wiki|Analog-to-digital converter
2|wiki|Microcontroller
2|wiki|Arduino
2|wiki|Printed circuit board
2|wiki|Oscilloscope
2|wiki|Electromagnetic induction
2|wiki|Electric motor
2|wiki|Three-phase electric power
2|wiki|Power factor
2|wiki|Voltage regulator
2|wiki|Switched-mode power supply
2|wiki|Pulse-width modulation
2|wiki|Light-emitting diode
2|wiki|Electronic oscillator
3|wiki|Maxwell's equations
3|wiki|Integrated circuit
3|wiki|Semiconductor device fabrication
3|wiki|Electronic filter
3|wiki|Bode plot
3|wiki|Noise (electronics)
3|wiki|Transmission line
3|wiki|Antenna (radio)
3|wiki|Signal modulation
3|wiki|Electromagnetic compatibility
3|wiki|Field-programmable gate array
3|wiki|Power electronics`,
  },
  {
    id: 'mechanical-civil-aero',
    name: `Mechanical, civil & aerospace engineering`,
    why: `Forces, materials, fluids and structures are how the physical world is built and why things break, so the AI can reason about anything from a shelf bracket to a rocket.`,
    t: `1|wiki|Mechanical engineering
1|wiki|Civil engineering
1|wiki|Aerospace engineering
1|wiki|Engineering design process
1|wiki|Statics
1|wiki|Free body diagram
1|wiki|Stress (mechanics)
1|wiki|Strain (mechanics)
1|wiki|Hooke's law
1|openstax|/books/university-physics-volume-1/pages/12-3-stress-strain-and-elastic-modulus
1|wiki|Torque
1|wiki|Gear
1|wiki|Beam (structure)
1|wiki|Truss
1|wiki|Strength of materials
2|wiki|Euler–Bernoulli beam theory
2|wiki|Buckling
2|wiki|Fatigue (material)
2|wiki|Factor of safety
2|wiki|Von Mises yield criterion
2|wiki|Heat transfer
2|wiki|Heat exchanger
2|wiki|Fluid mechanics
2|wiki|Bernoulli's principle
2|wiki|Reynolds number
2|wiki|Boundary layer
2|wiki|Lift (force)
2|wiki|Drag (physics)
2|wiki|Airfoil
2|wiki|Aircraft flight dynamics
2|wiki|Jet engine
2|wiki|Rocket engine
2|wiki|Tsiolkovsky rocket equation
2|wiki|Orbital mechanics
2|wiki|Reinforced concrete
2|wiki|Structural engineering
2|wiki|Geotechnical engineering
2|wiki|Foundation (engineering)
2|wiki|Bridge
2|wiki|Surveying
2|wiki|Machining
2|wiki|Welding
2|wiki|Computer-aided design
2|wiki|3D printing
2|wiki|Four-bar linkage
2|wiki|Composite material
2|wiki|Vibration
3|wiki|Fracture mechanics
3|wiki|Navier–Stokes equations
3|wiki|Computational fluid dynamics
3|wiki|Turbulence
3|wiki|Compressible flow
3|wiki|Shock wave
3|wiki|Hohmann transfer orbit
3|wiki|Spacecraft propulsion
3|wiki|Spacecraft attitude determination and control
3|wiki|Atmospheric entry
3|wiki|Earthquake engineering`,
  },
  {
    id: 'energy-environment',
    name: `Energy systems & the environment`,
    why: `How power is generated, stored, moved and priced, and how it changes the climate, is behind most questions about bills, batteries, policy and the planet.`,
    t: `1|wiki|Energy
1|wiki|Energy density
1|wiki|World energy supply and consumption
1|wiki|Fossil fuel
1|wiki|Electricity generation
1|wiki|Electrical grid
1|wiki|Renewable energy
1|wiki|Solar energy
1|wiki|Wind power
1|wiki|Hydroelectricity
1|wiki|Nuclear power
1|wiki|Greenhouse effect
1|wiki|Greenhouse gas
1|wiki|Climate change
1|wiki|Efficient energy use
1|wiki|Air pollution
2|wiki|Heat engine
2|openstax|/books/university-physics-volume-2/pages/4-2-heat-engines
2|wiki|Combined-cycle power plant
2|wiki|Solar cell
2|wiki|Wind turbine
2|wiki|Nuclear reactor
2|wiki|Radioactive waste
2|wiki|Geothermal energy
2|wiki|Biofuel
2|wiki|Heat pump
2|wiki|Lithium-ion battery
2|wiki|Electric vehicle
2|wiki|Electric power transmission
2|wiki|Capacity factor
2|wiki|Levelized cost of electricity
2|wiki|Carbon footprint
2|wiki|Life-cycle assessment
2|wiki|Emissions trading
2|wiki|Climate change mitigation
2|wiki|Paris Agreement
2|wiki|Intergovernmental Panel on Climate Change
2|wiki|Earth's energy budget
2|wiki|Carbon cycle
2|wiki|Water pollution
2|wiki|Deforestation
2|wiki|Biodiversity loss
2|wiki|Ozone depletion
2|wiki|Sustainability
3|wiki|Fusion power
3|wiki|Small modular reactor
3|wiki|Perovskite solar cell
3|wiki|Hydrogen economy
3|wiki|Smart grid
3|wiki|Grid energy storage
3|wiki|Variable renewable energy
3|wiki|Energy transition
3|wiki|Carbon capture and storage
3|wiki|Carbon dioxide removal
3|wiki|General circulation model
3|wiki|Planetary boundaries`,
  },
  {
    id: 'health-nutrition-firstaid',
    name: `Health, nutrition, fitness & first aid (evidence-based)`,
    why: `People ask their AI about food, training, sleep, symptoms and emergencies constantly, and sound advice needs the physiology, the evidence hierarchy and the first-aid steps that save lives.`,
    t: `1|wiki|Human nutrition
1|wiki|Carbohydrate
1|wiki|Protein (nutrient)
1|wiki|Fat
1|wiki|Dietary fiber
1|wiki|Vitamin
1|wiki|Mineral (nutrient)
1|wiki|Food energy
1|wiki|Healthy diet
1|wiki|Physical fitness
1|wiki|Aerobic exercise
1|wiki|Strength training
1|wiki|Sleep hygiene
1|wiki|First aid
1|wiki|Cardiopulmonary resuscitation
1|wiki|Automated external defibrillator
1|wiki|Heimlich maneuver
1|wiki|Recovery position
1|wiki|Bleeding
1|wiki|Burn
1|wiki|Bone fracture
2|openstax|/books/anatomy-and-physiology-2e/pages/24-7-nutrition-and-diet
2|wiki|Basal metabolic rate
2|wiki|Obesity
2|wiki|Mediterranean diet
2|wiki|Glycemic index
2|wiki|Vitamin D
2|wiki|Ultra-processed food
2|wiki|High-intensity interval training
2|wiki|Muscle hypertrophy
2|openstax|/books/anatomy-and-physiology-2e/pages/10-6-exercise-and-muscle-performance
2|wiki|Vaccine
2|wiki|Hypertension
2|wiki|Type 2 diabetes
2|wiki|Cardiovascular disease
2|wiki|Smoking cessation
2|wiki|Health effects of alcohol
2|wiki|Major depressive disorder
2|wiki|Cognitive behavioral therapy
2|wiki|Stroke
2|wiki|Myocardial infarction
2|wiki|Anaphylaxis
2|wiki|Hypothermia
2|wiki|Heat stroke
2|wiki|Concussion
2|wiki|Drowning
2|wiki|Opioid overdose
3|wiki|Evidence-based medicine
3|wiki|Hierarchy of evidence
3|wiki|Placebo
3|wiki|Systematic review
3|wiki|Number needed to treat
3|wiki|Screening (medicine)
3|wiki|Epidemiology
3|wiki|Gut microbiota
3|wiki|Intermittent fasting
3|wiki|Insulin resistance
3|wiki|Antimicrobial resistance`,
  },
  {
    id: 'cooking-food-science',
    name: `Cooking & food science`,
    why: `Knowing why heat, salt, acid, time and microbes transform food lets the AI rescue a dinner, adapt a recipe safely and explain what is happening in the pan.`,
    t: `1|wiki|Cooking
1|wiki|Food science
1|wiki|Kitchen knife
1|wiki|Mise en place
1|wiki|Taste
1|wiki|Salt
1|wiki|Cooking oil
1|wiki|Eggs as food
1|wiki|Meat
1|wiki|Doneness
1|wiki|Bread
1|wiki|Rice
1|wiki|Stock (food)
1|wiki|Food safety
1|wiki|Danger zone (food safety)
1|wiki|Foodborne illness
2|wiki|Maillard reaction
2|wiki|Caramelization
2|wiki|Starch gelatinization
2|wiki|Denaturation (biochemistry)
2|wiki|Emulsion
2|wiki|Gluten
2|wiki|Leavening agent
2|wiki|Yeast
2|wiki|Baking
2|wiki|Sourdough
2|wiki|Roux
2|wiki|French mother sauces
2|wiki|Braising
2|wiki|Roasting
2|wiki|Deep frying
2|wiki|Stir frying
2|wiki|Grilling
2|wiki|Brining
2|wiki|Smoking (cooking)
2|wiki|Custard
2|wiki|Chocolate
2|wiki|Sugar
2|wiki|Umami
2|wiki|Spice
3|wiki|Sous vide
3|wiki|Fermentation in food processing
3|wiki|Pasteurization
3|wiki|Food preservation
3|wiki|Canning
3|wiki|Pickling
3|wiki|Curing (food preservation)
3|wiki|Cheesemaking
3|wiki|Brewing
3|wiki|Coffee preparation
3|wiki|Hazard Analysis Critical Control Point
3|wiki|Molecular gastronomy
3|wiki|Nixtamalization
3|wiki|Food additive
3|wiki|On Food and Cooking`,
  },
  {
    id: 'home-diy-practical',
    name: `Home, DIY, cars & practical skills`,
    why: `Fixing a leak, wiring a socket safely, keeping a car running and knowing what is dangerous in a house are the everyday problems a personal AI is asked about most.`,
    t: `1|wiki|Do it yourself
1|wiki|Home improvement
1|wiki|Hand tool
1|wiki|Power tool
1|wiki|Screw
1|wiki|Wall plug
1|wiki|Drywall
1|wiki|Paint
1|wiki|Caulk
1|wiki|Plumbing
1|wiki|Flush toilet
1|wiki|Trap (plumbing)
1|wiki|Smoke detector
1|wiki|Carbon monoxide detector
1|wiki|Fire extinguisher
1|wiki|Personal protective equipment
1|wiki|Knot
1|wiki|Car
1|wiki|Tire
1|wiki|Motor oil
2|wiki|Electrical wiring
2|wiki|Circuit breaker
2|wiki|Residual-current device
2|wiki|AC power plugs and sockets
2|wiki|Water heating
2|wiki|Heating, ventilation, and air conditioning
2|wiki|Thermostat
2|wiki|Thermal insulation
2|wiki|Indoor mold
2|wiki|Roof
2|wiki|Carpentry
2|wiki|Joinery
2|wiki|Framing (construction)
2|wiki|Tile
2|wiki|Flooring
2|wiki|Gardening
2|wiki|Pest control
2|wiki|Sewing
2|wiki|Internal combustion engine
2|wiki|Transmission (mechanical device)
2|wiki|Disc brake
2|wiki|Automotive battery
2|wiki|Jump start (vehicle)
2|wiki|Spark plug
2|wiki|Service (motor vehicle)
2|wiki|Defensive driving
2|wiki|Bicycle
3|wiki|Building code
3|wiki|Radon
3|wiki|Asbestos
3|wiki|Weatherization
3|wiki|On-board diagnostics
3|wiki|Wheel alignment
3|wiki|Catalytic converter
3|wiki|Hybrid vehicle
3|wiki|Survival kit`,
  },
  {
    id: 'law-of-computing-ethics',
    name: `Technology law, AI ethics & responsible computing`,
    why: `An AI that builds software and advises people must know what it may copy, store and say, and how to recognise bias, harm and unsafe behaviour in systems like itself.`,
    t: `1|wiki|Information technology law
1|wiki|Intellectual property
1|wiki|Copyright
1|wiki|Fair use
1|wiki|Patent
1|wiki|Trade secret
1|wiki|Open-source license
1|wiki|GNU General Public License
1|wiki|Creative Commons license
1|wiki|Terms of service
1|wiki|Privacy
1|wiki|Information privacy
1|wiki|Personal data
1|wiki|Computer ethics
1|wiki|Ethics of artificial intelligence
1|wiki|Web accessibility
2|wiki|Digital Millennium Copyright Act
2|wiki|Software patent
2|wiki|Google LLC v. Oracle America, Inc.
2|wiki|Authors Guild, Inc. v. Google, Inc.
2|wiki|Artificial intelligence and copyright
2|wiki|Privacy law
2|wiki|California Consumer Privacy Act
2|wiki|Health Insurance Portability and Accountability Act
2|wiki|Data breach notification laws
2|wiki|Computer Fraud and Abuse Act
2|wiki|Section 230
2|wiki|Digital Services Act
2|wiki|Net neutrality
2|wiki|Content moderation
2|wiki|Carpenter v. United States
2|wiki|Coordinated vulnerability disclosure
2|wiki|Algorithmic bias
2|wiki|COMPAS (software)
2|wiki|Automated decision-making
2|wiki|Attention economy
2|wiki|Facebook–Cambridge Analytica data scandal
2|wiki|Facial recognition system
2|wiki|Synthetic media
2|wiki|Regulation of artificial intelligence
2|wiki|Artificial Intelligence Act
2|wiki|Privacy by design
2|wiki|De-identification
2|wiki|Therac-25
2|wiki|Right to repair
3|wiki|AI safety
3|wiki|Machine ethics
3|wiki|Existential risk from artificial intelligence
3|wiki|Surveillance capitalism
3|wiki|Crypto Wars
3|wiki|Lethal autonomous weapon
3|wiki|EU–US Data Privacy Framework
3|arxiv|Datasheets Datasets Gebru
3|arxiv|Amodei Olah Steinhardt Concrete Problems AI Safety
3|arxiv|Mitchell Zaldivar Vasserman Model Cards Reporting
3|arxiv|Bai Kadavath Constitutional AI Harmlessness Feedback
3|arxiv|Kleinberg Mullainathan Raghavan Fair Determination Risk Scores`,
  },
];
