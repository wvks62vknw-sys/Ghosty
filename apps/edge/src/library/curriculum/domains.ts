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
3|arxiv|A Model for Learned Bloom Filters
2|wiki|Cache replacement policies
2|wiki|Suffix array
2|wiki|Hopcroft–Karp algorithm
2|wiki|Priority queue
2|wiki|Rabin–Karp algorithm`,
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
3|arxiv|Spectre Attacks Exploiting Speculative Execution
2|wiki|Direct memory access
2|wiki|Semaphore (programming)
2|wiki|Solid-state drive
2|wiki|Random-access memory`,
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
3|openstax|/books/introduction-computer-science/pages/11-1-modern-web-applications-architectures
2|wiki|Address Resolution Protocol
2|wiki|DMARC
2|wiki|Ethernet
2|wiki|Simple Mail Transfer Protocol
2|wiki|Wi-Fi
2|wiki|Firewall (computing)
2|wiki|Network socket`,
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
3|arxiv|Survey of Vector Database Management Systems
2|wiki|Backup
2|wiki|Schema migration
2|wiki|Two-phase locking`,
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
3|arxiv|SWE-bench Can Language Models Resolve Real-World GitHub Issues
2|wiki|Build automation
2|wiki|Regression testing
2|wiki|Logging (computing)
2|wiki|Package manager
2|wiki|Postmortem documentation`,
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
3|arxiv|practical linearity in a higher-order polymorphic language
2|wiki|C (programming language)
2|wiki|Data-flow analysis
2|wiki|Tail call
2|wiki|Recursive descent parser
2|wiki|Register allocation`,
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
2|wiki|Deadlock (computer science)
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
3|arxiv|Meltdown Lipp Schwarz Gruss Prescher
2|wiki|Common Vulnerabilities and Exposures
2|wiki|Disk encryption
2|wiki|Intrusion detection system
2|wiki|Malware
2|wiki|OpenID
2|wiki|Password strength
2|wiki|Ransomware`,
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
3|arxiv|3D Gaussian splatting real-time radiance field rendering
2|wiki|Color space
2|wiki|SRGB
2|wiki|Frame rate
2|wiki|Level of detail (computer graphics)
2|wiki|Mipmap`,
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
3|arxiv|Human-Centered Artificial Intelligence Reliable Safe Trustworthy
2|wiki|Customer attrition
2|wiki|User research
2|wiki|Net promoter score
2|wiki|Prototype`,
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
3|wiki|Fairness (machine learning)
2|wiki|Collaborative filtering
2|wiki|Curse of dimensionality
2|wiki|F-score
2|wiki|Kernel method
2|wiki|Learning rate
2|wiki|Mean squared error
2|wiki|Multi-armed bandit
2|wiki|Recommender system`,
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
3|wiki|Double descent
2|wiki|Beam search
2|wiki|Cross-entropy
2|wiki|Variational autoencoder
2|wiki|Graph neural network
2|wiki|Image segmentation
2|wiki|Normalization (machine learning)
2|wiki|Object detection`,
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
3|wiki|AI alignment
2|wiki|Semantic search`,
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
3|wiki|Apache Flink
2|wiki|Apache Avro
2|wiki|Data lineage
2|wiki|Lambda architecture
2|wiki|Partition (database)
2|wiki|Protocol Buffers`,
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
3|arxiv|RT-2 Vision-Language-Action Models Transfer Web Knowledge
2|wiki|Rotary encoder
2|wiki|Stepper motor
2|wiki|Zero-order hold
2|wiki|Full state feedback
2|wiki|Lidar
2|wiki|Occupancy grid mapping
2|wiki|Odometry`,
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
3|wiki|Dirichlet's theorem on arithmetic progressions
2|wiki|Discrete logarithm
2|wiki|Sieve of Eratosthenes
2|wiki|AM–GM inequality
2|wiki|Module (mathematics)
2|wiki|Partial fraction decomposition`,
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
3|wiki|Calculus of variations
2|wiki|Euler's formula
2|wiki|Separation of variables
2|wiki|Trigonometric functions
2|wiki|Heat equation
2|wiki|Implicit function
2|wiki|Line integral`,
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
3|wiki|Queueing theory
2|wiki|Bayesian network
2|wiki|Chi-squared distribution
2|wiki|Entropy (information theory)
2|wiki|Student's t-distribution
2|wiki|Geometric distribution
2|wiki|Inverse transform sampling
2|wiki|Kullback–Leibler divergence`,
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
3|wiki|Black-body radiation
2|wiki|International System of Units`,
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
2|wiki|Tenancy deposit scheme (England and Wales)
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
  {
    id: 'classic-texts',
    name: `Classic texts (Project Gutenberg)`,
    why: `The books people still argue from — philosophy, politics, science and the novels everyone refers to — read from the public domain itself, so Ghosty can quote the source rather than a summary of it.`,
    t: `1|gutenberg|21279 2 B R 0 2 B
1|gutenberg|46 A Christmas Carol in Prose; Being a Ghost Story of Christmas
1|gutenberg|1080 A Modest Proposal
1|gutenberg|98 A Tale of Two Cities
1|gutenberg|76 Adventures of Huckleberry Finn
1|gutenberg|11 Alice's Adventures in Wonderland
1|gutenberg|2446 An Enemy of the People
1|gutenberg|1250 Anthem
1|gutenberg|20203 Autobiography of Benjamin Franklin
1|gutenberg|147 Common Sense
1|gutenberg|3090 Complete Original Short Stories of Guy De Maupassant
1|gutenberg|345 Dracula
1|gutenberg|158 Emma
1|gutenberg|84 Frankenstein; or, the modern prometheus
1|gutenberg|1400 Great Expectations
1|gutenberg|2591 Grimms' Fairy Tales
1|gutenberg|829 Gulliver's Travels into Several Remote Nations of the World
1|gutenberg|1260 Jane Eyre: An Autobiography
1|gutenberg|37106 Little Women; Or, Meg, Jo, Beth, and Amy
1|gutenberg|7700 Lysistrata
1|gutenberg|5200 Metamorphosis
1|gutenberg|23 Narrative of the Life of Frederick Douglass, an American Slave
1|gutenberg|730 Oliver Twist
1|gutenberg|105 Persuasion
1|gutenberg|16 Peter Pan
1|gutenberg|1342 Pride and Prejudice
1|gutenberg|161 Sense and Sensibility
1|gutenberg|2500 Siddhartha
1|gutenberg|1661 The Adventures of Sherlock Holmes
1|gutenberg|74 The Adventures of Tom Sawyer, Complete
1|gutenberg|541 The Age of Innocence
1|gutenberg|16317 The Art of Public Speaking
1|gutenberg|132 The Art of War
1|gutenberg|1184 The Count of Monte Cristo
1|gutenberg|2852 The Hound of the Baskervilles
1|gutenberg|844 The Importance of Being Earnest: A Trivial Comedy for Serious People
1|gutenberg|140 The Jungle
1|gutenberg|521 The Life and Adventures of Robinson Crusoe
1|gutenberg|3268 The Mysteries of Udolpho
1|gutenberg|174 The Picture of Dorian Gray
1|gutenberg|1974 The Poetics of Aristotle
1|gutenberg|1065 The Raven
1|gutenberg|1155 The Secret Adversary
1|gutenberg|43 The strange case of Dr. Jekyll and Mr. Hyde
1|gutenberg|216 The Tao Teh King, or the Tao and its Characteristics
1|gutenberg|1257 The three musketeers
1|gutenberg|35 The Time Machine
1|gutenberg|36 The war of the worlds
1|gutenberg|55 The Wonderful Wizard of Oz
1|gutenberg|2148 The Works of Edgar Allan Poe — Volume 2
1|gutenberg|1952 The Yellow Wallpaper
1|gutenberg|120 Treasure Island
1|gutenberg|164 Twenty Thousand Leagues under the Sea
1|gutenberg|2376 Up from Slavery: An Autobiography
1|gutenberg|768 Wuthering Heights
2|gutenberg|19942 Candide
2|gutenberg|600 Notes from the Underground
3|gutenberg|38219 A General Introduction to Psychoanalysis
3|gutenberg|4705 A Treatise of Human Nature
3|gutenberg|3420 A Vindication of the Rights of Woman
3|gutenberg|4320 An Enquiry Concerning the Principles of Morals
3|gutenberg|10615 An Essay Concerning Humane Understanding, Volume 1
3|gutenberg|3300 An Inquiry into the Nature and Causes of the Wealth of Nations
3|gutenberg|1399 Anna Karenina
3|gutenberg|1656 Apology
3|gutenberg|4363 Beyond Good and Evil
3|gutenberg|1023 Bleak House
3|gutenberg|2554 Crime and Punishment
3|gutenberg|766 David Copperfield
3|gutenberg|59 Discourse on the Method of Rightly Conducting One's Reason and of Seeking Truth…
3|gutenberg|996 Don Quixote
3|gutenberg|2814 Dubliners
3|gutenberg|3600 Essays of Michel de Montaigne — Complete
3|gutenberg|3800 Ethics
3|gutenberg|1524 Hamlet
3|gutenberg|219 Heart of Darkness
3|gutenberg|1532 King Lear
3|gutenberg|1322 Leaves of Grass
3|gutenberg|135 Les Misérables
3|gutenberg|3207 Leviathan
3|gutenberg|1533 Macbeth
3|gutenberg|2680 Meditations
3|gutenberg|2701 Moby Dick; Or, The Whale
3|gutenberg|34901 On Liberty
3|gutenberg|1228 On the Origin of Species By Means of Natural Selection
3|gutenberg|2267 Othello
3|gutenberg|26 Paradise Lost
3|gutenberg|30155 Relativity: The Special and General Theory
3|gutenberg|1513 Romeo and Juliet
3|gutenberg|7370 Second Treatise of Government
3|gutenberg|1041 Shakespeare's Sonnets
3|gutenberg|3330 The Analects of Confucius (from the Chinese Classics)
3|gutenberg|28054 The Brothers Karamazov
3|gutenberg|2412 The Categories
3|gutenberg|61 The Communist Manifesto
3|gutenberg|100 The Complete Works of William Shakespeare
3|gutenberg|3296 The Confessions of St. Augustine
3|gutenberg|14328 The Consolation of Philosophy
3|gutenberg|4280 The Critique of Pure Reason
3|gutenberg|2300 The Descent of Man, and Selection in Relation to Sex
3|gutenberg|4200 The Diary of Samuel Pepys — Complete
3|gutenberg|8800 The divine comedy
3|gutenberg|1404 The Federalist Papers
3|gutenberg|25717 The History of the Decline and Fall of the Roman Empire
3|gutenberg|2638 The Idiot
3|gutenberg|6130 The Iliad
3|gutenberg|15399 The Interesting Narrative of the Life of Olaudah Equiano, Or Gustavus Vassa,…
3|gutenberg|1079 The life and opinions of Tristram Shandy, gentleman
3|gutenberg|8438 The Nicomachean ethics of Aristotle
3|gutenberg|1727 The Odyssey
3|gutenberg|2009 The Origin of Species
3|gutenberg|1232 The Prince
3|gutenberg|5827 The Problems of Philosophy
3|gutenberg|1497 The Republic
3|gutenberg|408 The Souls of Black Folk
3|gutenberg|27083 The Subjection of Women
3|gutenberg|944 The Voyage of the Beagle
3|gutenberg|38427 The World as Will and Idea (Vol. 1 of 3)
3|gutenberg|1998 Thus Spake Zarathustra: A Book for All and None
3|gutenberg|14725 Treatise on light : In which are explained the causes of that which occurs in…
3|gutenberg|4300 Ulysses
3|gutenberg|2130 Utopia
3|gutenberg|205 Walden, and On The Duty Of Civil Disobedience
3|gutenberg|2600 War and Peace`,
  },
  {
    id: 'religion-belief',
    name: `Religion and world belief systems`,
    why: `Birmingham is one of the most religiously diverse cities in Britain, so advising its owner well means knowing the faiths, scriptures, calendars and festivals that shape neighbours, holidays, food and daily life.`,
    t: `1|wiki|Religion
1|wiki|Islam
1|wiki|Christianity
1|wiki|Judaism
1|wiki|Hinduism
1|wiki|Sikhism
1|wiki|Buddhism
1|wiki|Five Pillars of Islam
1|wiki|Quran
1|wiki|Muhammad
1|wiki|Bible
1|wiki|Jesus
1|wiki|Torah
1|wiki|Guru Nanak
1|wiki|Guru Granth Sahib
1|wiki|The Buddha
1|wiki|Ramadan
1|wiki|Eid al-Fitr
1|wiki|Christmas
1|wiki|Easter
1|wiki|Diwali
1|wiki|Vaisakhi
1|wiki|Passover
2|wiki|Eid al-Adha
2|wiki|Sunni Islam
2|wiki|Shia Islam
2|wiki|Halal
2|wiki|Catholic Church
2|wiki|Protestantism
2|wiki|Eastern Orthodox Church
2|wiki|Church of England
2|wiki|Bhagavad Gita
2|wiki|Karma
2|wiki|Schools of Buddhism
2|wiki|Jainism
2|wiki|Taoism
2|wiki|Rastafari
2|wiki|Atheism
2|wiki|Islamic calendar
2|wiki|Hebrew calendar
2|wiki|Hindu calendar
2|wiki|Liturgical year
2|wiki|Religion in the United Kingdom
2|wiki|Religion in Birmingham
2|wiki|Birmingham Central Mosque
3|wiki|Comparative religion
3|wiki|Problem of evil
3|wiki|Sharia
3|wiki|Hadith
3|wiki|Sufism
3|wiki|Religious pluralism
3|wiki|Interfaith dialogue
3|wiki|Freedom of religion
3|wiki|Islamophobia
3|wiki|Antisemitism`,
  },
  {
    id: 'reproductive-health-parenting',
    name: `Reproductive and sexual health, pregnancy, parenting, child development, ageing and elder care`,
    why: `From contraception and pregnancy to toddlers, teenagers and ageing parents, these are the life stages the owner and their family will actually ask about, and the advice must match NHS evidence rather than folklore.`,
    t: `1|wiki|Sexual and reproductive health
1|wiki|Female reproductive system
1|wiki|Male reproductive system
1|wiki|Menstrual cycle
1|wiki|Puberty
1|wiki|Birth control
1|wiki|Condom
1|wiki|Combined oral contraceptive pill
1|wiki|Intrauterine device
1|wiki|Emergency contraception
1|wiki|Sexually transmitted infection
1|wiki|HIV/AIDS
1|wiki|HPV vaccine
1|wiki|Cervical screening
1|wiki|Pregnancy
1|wiki|Prenatal care
1|wiki|Childbirth
1|wiki|Midwifery
1|wiki|Breastfeeding
1|wiki|Child development
1|wiki|Parenting
1|wiki|Sex education
1|wiki|Menopause
1|wiki|Ageing
2|wiki|Sexual consent
2|wiki|Infertility
2|wiki|In vitro fertilisation
2|wiki|Miscarriage
2|wiki|Abortion in the United Kingdom
2|wiki|Prenatal testing
2|wiki|Preterm birth
2|wiki|Caesarean section
2|openstax|/books/anatomy-and-physiology-2e/pages/27-2-anatomy-and-physiology-of-the-ovarian-reproductive-system
2|openstax|/books/anatomy-and-physiology-2e/pages/28-3-fetal-development
2|openstax|/books/anatomy-and-physiology-2e/pages/28-4-changes-during-pregnancy-labor-and-birth
2|wiki|Postpartum depression
2|wiki|SIDS
2|wiki|Vaccination schedule
2|wiki|Attachment theory
2|wiki|Parenting styles
2|wiki|Child development stages
2|openstax|/books/psychology-2e/pages/9-3-stages-of-development
2|wiki|Adolescence
2|wiki|Autism
2|wiki|Attention deficit hyperactivity disorder
2|wiki|Endometriosis
2|wiki|Polyendocrine metabolic ovarian syndrome
2|wiki|Hormone replacement therapy
2|wiki|Dementia
2|wiki|Elderly care
3|wiki|Gerontology
3|wiki|Falls in older adults
3|wiki|Lasting power of attorney
3|wiki|Palliative care
3|wiki|Advance healthcare directive
3|wiki|Safeguarding`,
  },
  {
    id: 'agriculture-animals-pets',
    name: `Agriculture, food systems, animals and pets`,
    why: `Food prices, allotments, a family dog or cat, and the farm news on the radio all come back to how food is grown and how animals are kept, and UK welfare law tells an owner what they must do for any animal in their care.`,
    t: `1|wiki|Agriculture
1|wiki|Crop
1|wiki|Soil
1|wiki|Livestock
1|wiki|Cattle
1|wiki|Sheep
1|wiki|Pig
1|wiki|Chicken
1|wiki|Dairy farming
1|wiki|Horticulture
1|wiki|Allotment (gardening)
1|wiki|Pet
1|wiki|Dog
1|wiki|Cat
1|wiki|Domestic rabbit
1|wiki|Veterinary medicine
1|wiki|Animal welfare
1|wiki|Agriculture in the United Kingdom
1|wiki|Beekeeping
2|wiki|Crop rotation
2|wiki|Fertilizer
2|wiki|Pesticide
2|wiki|Organic farming
2|wiki|Genetically modified crops
2|wiki|Animal husbandry
2|wiki|Selective breeding
2|wiki|Aquaculture
2|wiki|Dog training
2|wiki|Dog breed
2|wiki|Cat behavior
2|wiki|Neutering
2|wiki|Microchip implant (animal)
2|wiki|Canine parvovirus
2|wiki|Rabies
2|wiki|Pet passport
2|wiki|Animal Welfare Act 2006
2|wiki|Dangerous Dogs Act 1991
2|wiki|RSPCA
2|wiki|People's Dispensary for Sick Animals
2|wiki|Department for Environment, Food and Rural Affairs
2|wiki|Mycobacterium bovis
2|wiki|Foot-and-mouth disease
2|wiki|Avian influenza
2|wiki|Food security
3|wiki|Soil erosion
3|wiki|Regenerative agriculture
3|wiki|Precision agriculture
3|wiki|Green Revolution
3|wiki|Intensive animal farming
3|wiki|Antibiotic use in livestock
3|wiki|Cultured meat
3|wiki|Zoonosis
3|wiki|One Health
3|wiki|Animal rights
3|wiki|Common Agricultural Policy`,
  },
  {
    id: 'screen-media-photography',
    name: `Film, television, video games as culture, and photography`,
    why: `Most of what the owner watches, plays and photographs on a phone sits in these traditions; knowing the craft and the history lets Ghosty recommend, critique and help take a better picture.`,
    t: `1|wiki|Film
1|wiki|History of film
1|wiki|Television
1|wiki|Video game
1|wiki|Photography
1|wiki|History of photography
1|wiki|Film genre
1|wiki|Cinematography
1|wiki|Film editing
1|wiki|Screenwriting
1|wiki|Documentary film
1|wiki|Animation
1|wiki|Camera
1|wiki|Exposure (photography)
1|wiki|Aperture
1|wiki|Shutter speed
1|wiki|Film speed
1|wiki|Depth of field
1|wiki|Composition (visual arts)
1|wiki|Rule of thirds
2|wiki|Silent film
2|wiki|Classical Hollywood cinema
2|wiki|Film noir
2|wiki|French New Wave
2|wiki|Italian neorealism
2|wiki|Cinema of the United Kingdom
2|wiki|Hindi cinema
2|wiki|Anime
2|wiki|Television in the United Kingdom
2|wiki|BBC
2|wiki|Sitcom
2|wiki|Soap opera
2|wiki|Reality television
2|wiki|Streaming television
2|wiki|Peaky Blinders (TV series)
2|wiki|History of video games
2|wiki|Video game genre
2|wiki|Video game development
2|wiki|Game design
2|wiki|Esports
2|wiki|Focal length
2|wiki|Raw image format
2|wiki|Color balance
2|wiki|Image editing
2|wiki|Photojournalism
3|wiki|Film theory
3|wiki|Auteur
3|wiki|Mise-en-scène
3|wiki|Montage (filmmaking)
3|wiki|Continuity editing
3|wiki|British Board of Film Classification
3|wiki|Visual effects
3|wiki|Color grading
3|wiki|Video game culture
3|wiki|Video game addiction
3|wiki|Loot box`,
  },
  {
    id: 'sport-games',
    name: `Sport and games`,
    why: `Sport is the small talk of the city, from Villa and Blues to Test matches at Edgbaston, and the owner will want rules explained, results put in context, chess and board games played, and training advice grounded in exercise science.`,
    t: `1|wiki|Sport
1|wiki|Association football
1|wiki|Laws of the Game (association football)
1|wiki|Cricket
1|wiki|Laws of Cricket
1|wiki|Rugby union
1|wiki|Rugby league
1|wiki|Sport of athletics
1|wiki|Tennis
1|wiki|Boxing
1|wiki|Competitive swimming
1|wiki|Olympic Games
1|wiki|Commonwealth Games
1|wiki|Chess
1|wiki|Rules of chess
1|wiki|Board game
1|wiki|Physical fitness
1|wiki|Aerobic exercise
2|wiki|Premier League
2|wiki|English Football League
2|wiki|FA Cup
2|wiki|FIFA World Cup
2|wiki|England national football team
2|wiki|Aston Villa F.C.
2|wiki|Birmingham City F.C.
2|wiki|Villa Park
2|wiki|Second City derby
2|wiki|Edgbaston Cricket Ground
2|wiki|Warwickshire County Cricket Club
2|wiki|Test cricket
2|wiki|The Ashes
2|wiki|Six Nations Championship
2|wiki|Wimbledon Championships
2|wiki|Formula One
2|wiki|Snooker
2|wiki|London Marathon
2|wiki|Parkrun
2|wiki|2022 Commonwealth Games
2|wiki|Chess opening
2|wiki|Go (game)
2|wiki|Dungeons & Dragons
2|wiki|Strength training
2|wiki|High-intensity interval training
2|wiki|Sports nutrition
3|wiki|Exercise physiology
3|wiki|VO2 max
3|wiki|Sport psychology
3|wiki|Doping in sport
3|wiki|Expected goals
3|wiki|Elo rating system
3|wiki|Duckworth–Lewis–Stern method
3|wiki|Video assistant referee
3|wiki|Bosman ruling
3|wiki|Hillsborough disaster
3|wiki|Women's association football
3|arxiv|mastering chess shogi self-play general reinforcement learning`,
  },
  {
    id: 'careers-education',
    name: `Careers and education`,
    why: `Helping the owner get a job, a qualification or a degree, and then learn efficiently for it, needs the UK system (GCSEs to UCAS to apprenticeships and chartered bodies) and the science of how people actually learn.`,
    t: `1|wiki|Career
1|wiki|Résumé
1|wiki|Cover letter
1|wiki|Job interview
1|wiki|Job hunting
1|wiki|Apprenticeship
1|wiki|GCSE
1|wiki|A-level
1|wiki|Business and Technology Education Council
1|wiki|T Level
1|wiki|UCAS
1|wiki|Bachelor's degree
1|wiki|Master's degree
1|wiki|Further education
1|wiki|Universities in the United Kingdom
1|wiki|Study skills
1|wiki|Note-taking
1|openstax|/books/college-success/pages/6-2-studying
2|wiki|Education in England
2|wiki|University of Birmingham
2|wiki|Aston University
2|wiki|Birmingham City University
2|wiki|Open University
2|wiki|Russell Group
2|wiki|Student loans and grants in the United Kingdom
2|wiki|Tuition fees in the United Kingdom
2|wiki|Doctor of Philosophy
2|wiki|Degree apprenticeship
2|wiki|Jobcentre Plus
2|wiki|Zero-hour contract
2|wiki|Gig economy
2|wiki|Self-employment
2|wiki|Institute of Chartered Accountants in England and Wales
2|wiki|Chartered Institute of Personnel and Development
2|wiki|Postgraduate Certificate in Education
2|wiki|Professional development
2|wiki|Spaced repetition
2|wiki|Testing effect
2|wiki|Forgetting curve
2|wiki|Pomodoro Technique
2|wiki|Metacognition
2|wiki|Time management
2|wiki|Procrastination
2|openstax|/books/psychology-2e/pages/8-1-how-memory-functions
2|openstax|/books/psychology-2e/pages/8-4-ways-to-enhance-memory
2|openstax|/books/college-success/pages/12-2-your-map-to-success-the-career-planning-cycle
3|wiki|Career development
3|wiki|Career counseling
3|wiki|Holland Codes
3|wiki|Situational judgement test
3|wiki|Myers–Briggs Type Indicator
3|wiki|Impostor syndrome
3|wiki|Desirable difficulty
3|wiki|Cognitive load
3|wiki|Bloom's taxonomy
3|wiki|Self-regulated learning`,
  },
  {
    id: 'uk-public-services-life-admin',
    name: `UK public services and life admin`,
    why: `The owner lives inside GOV.UK, the NHS, Birmingham City Council and the DWP, so Ghosty must know which service does what, what the owner is entitled to, and how to get a passport, a licence, a GP appointment or a refund without a wasted afternoon.`,
    t: `1|wiki|Gov.uk
1|wiki|National Health Service (England)
1|wiki|General practitioner
1|wiki|Emergency department
1|wiki|NHS 111
1|wiki|999 (emergency telephone number)
1|wiki|NHS app
1|wiki|Prescription charges
1|wiki|Dentistry in the United Kingdom
1|wiki|British passport
1|wiki|Driving licence in the United Kingdom
1|wiki|Driver and Vehicle Licensing Agency
1|wiki|MOT test
1|wiki|Council Tax
1|wiki|Birmingham City Council
1|wiki|Local government in England
1|wiki|Electoral roll
1|wiki|Elections in the United Kingdom
1|wiki|National Insurance number
1|wiki|Universal Credit
1|wiki|Citizens Advice
1|wiki|Technical support
2|wiki|HM Passport Office
2|wiki|United Kingdom driving test
2|wiki|Birmingham Clean Air Zone
2|wiki|Transport for West Midlands
2|wiki|West Midlands Police
2|wiki|Elections Act 2022
2|wiki|Absentee voting in the United Kingdom
2|wiki|HM Revenue and Customs
2|wiki|Pay-as-you-earn tax
2|wiki|Tax returns in the United Kingdom
2|wiki|Department for Work and Pensions
2|wiki|Personal Independence Payment
2|wiki|Child benefit
2|wiki|State Pension (United Kingdom)
2|wiki|Modern immigration to the United Kingdom
2|wiki|Visa policy of the United Kingdom
2|wiki|Indefinite leave to remain
2|wiki|British nationality law
2|wiki|Life in the United Kingdom test
2|wiki|European Union Settlement Scheme
2|wiki|Consumer Rights Act 2015
2|wiki|Trading Standards
2|wiki|Ofcom
2|wiki|Financial Ombudsman Service
2|wiki|Chargeback
2|wiki|Television licensing in the United Kingdom
2|wiki|Disabled parking permit
3|wiki|Social care in England
3|wiki|Care Quality Commission
3|wiki|National Institute for Health and Care Excellence
3|wiki|Renters' Rights Act 2025
3|wiki|Assured shorthold tenancy
3|wiki|Section 114 notice
3|wiki|National Fraud Intelligence Bureau
3|wiki|Public Service Ombudsman`,
  },
  {
    id: 'unix-shell-sysadmin',
    name: `Unix/Linux command line, shell scripting and basic system administration`,
    why: `Ghosty builds and deploys on servers and in terminals, so it must read, write and reason about shell commands, permissions, services and containers with confidence.`,
    t: `1|wiki|Unix shell
1|wiki|Command-line interface
1|wiki|Bash (Unix shell)
1|wiki|Unix filesystem
1|wiki|Filesystem Hierarchy Standard
1|wiki|GNU Core Utilities
1|wiki|Man page
1|wiki|Pipeline (Unix)
1|wiki|Redirection (computing)
1|wiki|Standard streams
1|wiki|Environment variable
1|wiki|Glob (programming)
1|wiki|File-system permissions
1|wiki|Chmod
1|wiki|Grep
1|wiki|Find (Unix)
1|wiki|Tar (computing)
1|wiki|Vim (text editor)
1|wiki|Symbolic link
1|wiki|Linux distribution
2|wiki|Shell script
2|wiki|Shebang (Unix)
2|wiki|Exit status
2|wiki|Sed
2|wiki|AWK
2|wiki|Xargs
2|wiki|Signal (IPC)
2|wiki|Job control (Unix)
2|wiki|Cron
2|wiki|Systemd
2|wiki|OpenSSH
2|wiki|Rsync
2|wiki|Package manager
2|wiki|APT (software)
2|wiki|Sudo
2|wiki|Mount (Unix)
2|wiki|Ext4
2|wiki|Inode
2|wiki|Setuid
2|wiki|Syslog
2|wiki|Tmux
2|wiki|Iptables
2|wiki|CURL
2|wiki|POSIX
2|wikibooks|Bash Shell Scripting
3|wiki|Cgroups
3|wiki|Linux namespaces
3|wiki|Containerization (computing)
3|wiki|Ansible (software)
3|wiki|Chroot
3|wiki|Strace
3|wiki|Procfs
3|wiki|SELinux
3|wiki|Logical Volume Manager (Linux)
3|wiki|Fail2ban
3|wiki|Linux Unified Key Setup`,
  },
  {
    id: 'computer-vision-imaging',
    name: `Computer vision and image processing`,
    why: `Ghosty sees through the owner's phone camera and reads documents, so it needs the theory behind filters, features, detection, OCR and 3D reconstruction to explain and improve what it sees.`,
    t: `1|wiki|Digital image
1|wiki|Pixel
1|wiki|Digital image processing
1|wiki|Computer vision
1|wiki|Image sensor
1|wiki|Bayer filter
1|wiki|HSL and HSV
1|wiki|Image noise
1|wiki|Image histogram
1|wiki|Histogram equalization
1|wiki|Kernel (image processing)
1|wiki|Gaussian blur
1|wiki|Median filter
1|wiki|Edge detection
1|wiki|Sobel operator
1|wiki|Canny edge detector
1|wiki|Thresholding (image processing)
1|wiki|Otsu's method
2|wiki|Mathematical morphology
2|wiki|Connected-component labeling
2|wiki|Image segmentation
2|wiki|Hough transform
2|wiki|Template matching
2|wiki|Harris corner detector
2|wiki|Scale-invariant feature transform
2|wiki|Oriented FAST and rotated BRIEF
2|wiki|Histogram of oriented gradients
2|wiki|Random sample consensus
2|wiki|Homography (computer vision)
2|wiki|Image stitching
2|wiki|Pinhole camera model
2|wiki|Camera resectioning
2|wiki|Distortion (optics)
2|wiki|Optical flow
2|wiki|Optical character recognition
2|wiki|Tesseract (software)
2|wiki|OpenCV
2|wiki|Object detection
2|wiki|Viola–Jones object detection framework
2|wiki|ImageNet
2|wiki|Data augmentation
2|wiki|QR code
3|wiki|Epipolar geometry
3|wiki|Computer stereo vision
3|wiki|Structure from motion
3|wiki|Bundle adjustment
3|wiki|Photogrammetry
3|wiki|Point cloud
3|wiki|Lidar
3|wiki|Region Based Convolutional Neural Networks
3|wiki|You Only Look Once
3|wiki|U-Net
3|wiki|Vision transformer
3|wiki|Super-resolution imaging
3|arxiv|U-Net Convolutional Networks for Biomedical Image Segmentation
3|arxiv|Segment Anything Kirillov Mintun Ravi`,
  },
  {
    id: 'information-theory-coding',
    name: `Information theory, data compression and character encoding`,
    why: `Every text Ghosty stores, every file it compresses or decodes and every noisy channel it sends data over rests on entropy, codes and encodings it should understand rather than guess at.`,
    t: `1|wiki|Information theory
1|wiki|A Mathematical Theory of Communication
1|wiki|Bit
1|wiki|Character encoding
1|wiki|ASCII
1|wiki|Windows-1252
1|wiki|Unicode
1|wiki|UTF-8
1|wiki|UTF-16
1|wiki|Byte order mark
1|wiki|Mojibake
1|wiki|Base64
1|wiki|Data compression
1|wiki|Lossless compression
1|wiki|Run-length encoding
1|wiki|Parity bit
1|wiki|Checksum
2|wiki|Mutual information
2|wiki|Kullback–Leibler divergence
2|wiki|Prefix code
2|wiki|Kraft–McMillan inequality
2|wiki|Shannon's source coding theorem
2|wiki|Huffman coding
2|wiki|Arithmetic coding
2|wiki|LZ77 and LZ78
2|wiki|Lempel–Ziv–Welch
2|wiki|Deflate
2|wiki|Burrows–Wheeler transform
2|wiki|Cyclic redundancy check
2|wiki|Hamming code
2|wiki|Error detection and correction
2|wiki|Channel capacity
2|wiki|Noisy-channel coding theorem
2|wiki|Shannon–Hartley theorem
2|wiki|Unicode equivalence
2|wiki|Quantization (signal processing)
2|wiki|Pulse-code modulation
2|wiki|Discrete cosine transform
2|wiki|JPEG
2|wiki|PNG
2|wiki|MP3
3|wiki|Asymmetric numeral systems
3|wiki|Rate–distortion theory
3|wiki|Reed–Solomon error correction
3|wiki|Convolutional code
3|wiki|Viterbi algorithm
3|wiki|Low-density parity-check code
3|wiki|Turbo code
3|wiki|Polar code (coding theory)
3|wiki|Kolmogorov complexity
3|wiki|Minimum description length
3|wiki|Advanced Video Coding
3|wiki|AV1
3|wiki|Opus (audio format)
3|arxiv|Language Modeling Is Compression
3|arxiv|Channel polarization constructing capacity-achieving codes`,
  },
  {
    id: 'automata-computability',
    name: `Automata, formal languages and computability`,
    why: `Regular expressions, parsers and the limits of what any program can decide are everyday tools and hard boundaries for an AI that writes and checks code.`,
    t: `1|wiki|Formal language
1|wiki|Alphabet (formal languages)
1|wiki|Kleene star
1|wiki|Automata theory
1|wiki|Deterministic finite automaton
1|wiki|Nondeterministic finite automaton
1|wiki|Powerset construction
1|wiki|Regular language
1|wiki|Regular grammar
1|wiki|Thompson's construction
1|wiki|Moore machine
1|wiki|Finite-state transducer
1|wiki|Formal grammar
1|wiki|Chomsky hierarchy
1|wiki|Backus–Naur form
2|wiki|Pumping lemma for regular languages
2|wiki|DFA minimization
2|wiki|Myhill–Nerode theorem
2|wiki|Pushdown automaton
2|wiki|Chomsky normal form
2|wiki|Ambiguous grammar
2|wiki|Pumping lemma for context-free languages
2|wiki|Deterministic context-free language
2|wiki|CYK algorithm
2|wiki|Earley parser
2|wiki|Parsing expression grammar
2|wiki|Context-sensitive grammar
2|wiki|Linear bounded automaton
2|wiki|Unrestricted grammar
2|wiki|Universal Turing machine
2|wiki|Turing completeness
2|wiki|Church–Turing thesis
2|wiki|Computable function
2|wiki|Undecidable problem
2|wiki|Recursively enumerable language
2|wiki|Entscheidungsproblem
2|wiki|Cellular automaton
2|wiki|Computability theory
3|wiki|Primitive recursive function
3|wiki|General recursive function
3|wiki|Ackermann function
3|wiki|Rice's theorem
3|wiki|Reduction (computability theory)
3|wiki|Oracle machine
3|wiki|Post correspondence problem
3|wiki|Busy beaver
3|wiki|Chaitin's constant
3|wiki|Rule 110
3|wiki|Hilbert's tenth problem
3|wiki|Büchi automaton
3|wiki|Model checking
3|wiki|Linear temporal logic
3|wiki|Arithmetical hierarchy
3|arxiv|Neural Networks and the Chomsky Hierarchy
3|arxiv|Transformers as recognizers of formal languages`,
  },
  {
    id: 'nlp-speech',
    name: `Natural language processing and speech`,
    why: `Language and voice are Ghosty's own medium; knowing how text is tokenised, parsed, translated, transcribed and evaluated lets it build and judge language tools honestly.`,
    t: `1|wiki|Natural language processing
1|wiki|Text corpus
1|wiki|Text segmentation
1|wiki|Stemming
1|wiki|Lemmatization
1|wiki|Stop word
1|wiki|Bag-of-words model
1|wiki|N-gram
1|wiki|Language model
1|wiki|Zipf's law
1|wiki|Levenshtein distance
1|wiki|Spell checker
1|wiki|Language identification
1|wiki|ELIZA
1|wiki|Georgetown–IBM experiment
2|wiki|Part-of-speech tagging
2|wiki|Hidden Markov model
2|wiki|Named-entity recognition
2|wiki|Conditional random field
2|wiki|Dependency grammar
2|wiki|Universal Dependencies
2|wiki|Word-sense disambiguation
2|wiki|WordNet
2|wiki|Coreference
2|wiki|Sentiment analysis
2|wiki|Document classification
2|wiki|Topic model
2|wiki|Latent Dirichlet allocation
2|wiki|Word2Vec
2|wiki|Machine translation
2|wiki|Neural machine translation
2|wiki|BLEU
2|wiki|Perplexity
2|wiki|Word error rate
2|wiki|Seq2seq
2|wiki|SpaCy
2|wiki|Speech recognition
2|wiki|Speech synthesis
2|wiki|Spectrogram
2|wiki|Mel-frequency cepstrum
3|wiki|Connectionist temporal classification
3|wiki|Vocoder
3|wiki|WaveNet
3|wiki|Speaker recognition
3|wiki|Speaker diarisation
3|wiki|Whisper (speech recognition system)
3|wiki|BERT (language model)
3|wiki|Question answering
3|wiki|Automatic summarization
3|wiki|Information extraction
3|wiki|Winograd schema challenge
3|wiki|Audio deepfake
3|arxiv|Neural Machine Translation Rare Words Subword Units
3|arxiv|wav2vec 2.0 Self-Supervised Learning Speech Representations
3|arxiv|Listen Attend and Spell
3|arxiv|GLUE Multi-Task Benchmark Natural Language Understanding`,
  },
  {
    id: 'geometry-trigonometry',
    name: `Geometry, trigonometry and measurement`,
    why: `Maps, measurements, camera geometry and unit conversions come up constantly in building, navigation and advice, and the UK mixes metric, imperial and the Ordnance Survey grid.`,
    t: `1|wiki|Euclidean geometry
1|wiki|Euclid's Elements
1|wiki|Angle
1|wiki|Triangle
1|wiki|Pythagorean theorem
1|wiki|Congruence (geometry)
1|wiki|Similarity (geometry)
1|wiki|Polygon
1|wiki|Circle
1|wiki|Area
1|wiki|Straightedge and compass construction
1|wiki|Trigonometry
1|wiki|Unit circle
1|wiki|Radian
1|wiki|Sine and cosine
1|wiki|International System of Units
1|wiki|Metric prefix
1|wiki|Imperial units
1|wiki|Significant figures
1|wiki|Accuracy and precision
1|wiki|Geographic coordinate system
1|openstax|/books/college-physics-2e/pages/1-2-physical-quantities-and-units
2|wiki|Parallel postulate
2|wiki|Inscribed angle
2|wiki|Platonic solid
2|wiki|Tessellation
2|wiki|Law of sines
2|wiki|Law of cosines
2|wiki|List of trigonometric identities
2|wiki|Inverse trigonometric functions
2|wiki|Polar coordinate system
2|wiki|Conic section
2|wiki|Ellipse
2|wiki|Parabola
2|wiki|Measurement uncertainty
2|openstax|/books/university-physics-volume-1/pages/1-4-dimensional-analysis
2|wiki|National Physical Laboratory (United Kingdom)
2|wiki|Metrication in the United Kingdom
2|wiki|Map projection
2|wiki|Mercator projection
2|wiki|Transverse Mercator projection
2|wiki|Ordnance Survey National Grid
2|wiki|Great-circle distance
2|wiki|Haversine formula
3|wiki|Spherical trigonometry
3|wiki|Non-Euclidean geometry
3|wiki|Hyperbolic geometry
3|wiki|Projective geometry
3|wiki|Buckingham pi theorem
3|wiki|Geodesy
3|wiki|Geodetic datum
3|wiki|World Geodetic System
3|wiki|Web Mercator projection
3|wiki|Tissot's indicatrix
3|wiki|2019 revision of the SI
3|wiki|Erlangen program`,
  },
  {
    id: 'accounting-business',
    name: `Accounting and business basics`,
    why: `An owner who sells, freelances or starts a company needs correct UK answers about the books, VAT, payroll, Companies House and pricing, and Ghosty should be able to give them.`,
    t: `1|wiki|Accounting
1|wiki|Bookkeeping
1|wiki|Double-entry bookkeeping
1|wiki|Debits and credits
1|wiki|General ledger
1|wiki|Accounting equation
1|wiki|Balance sheet
1|wiki|Income statement
1|wiki|Cash flow statement
1|wiki|Invoice
1|wiki|Reconciliation (accounting)
1|wiki|Sole proprietorship
1|wiki|Limited company
1|wiki|Companies House
1|wiki|Business plan
1|wiki|Marketing
1|wiki|Marketing mix
1|wiki|Pricing
1|wiki|Trial balance
2|wiki|Basis of accounting
2|wiki|Depreciation
2|wiki|Working capital
2|wiki|Management accounting
2|wiki|Break-even point
2|wiki|Financial ratio
2|wiki|Cash flow forecasting
2|openstax|/books/principles-financial-accounting/pages/3-5-use-journal-entries-to-record-transactions-and-post-to-t-accounts
2|wiki|Private company limited by shares
2|wiki|Limited liability partnership
2|wiki|Community interest company
2|wiki|Companies Act 2006
2|wiki|Articles of association
2|wiki|Value-added tax in the United Kingdom
2|wiki|United Kingdom corporation tax
2|wiki|Pay-as-you-earn tax
2|wiki|Payroll
2|wiki|Business rates in England
2|wiki|Making Tax Digital
2|wiki|SWOT analysis
2|wiki|Pricing strategy
2|wiki|Entrepreneurship
2|wiki|Business model
2|wiki|Statutory sick pay
3|wiki|International Financial Reporting Standards
3|wiki|Financial audit
3|wiki|IR35
3|wiki|Capital allowance
3|wiki|Seed Enterprise Investment Scheme
3|wiki|Angel investor
3|wiki|Crowdfunding
3|wiki|Porter's five forces analysis
3|wiki|Customer lifetime value
3|wiki|Subscription business model
3|wiki|Federation of Small Businesses
3|wiki|Generally Accepted Accounting Practice (UK)
3|wiki|British Chambers of Commerce`,
  },
  {
    id: 'architecture-interior-design',
    name: `Architecture, interior design and UK building regulations`,
    why: `The owner plans rooms, furniture and building work on the phone, and Ghosty's design reviews should rest on how rooms are drawn and lit, how people move through them, and what the Approved Documents ask for.`,
    t: `1|wiki|Architecture
1|wiki|Interior design
1|wiki|Floor plan
1|wiki|Architectural drawing
1|wiki|Room
1|wiki|Kitchen work triangle
1|wiki|Daylighting
1|wiki|Window
1|wiki|Door
1|wiki|Wall
1|wiki|Ceiling
1|wiki|Stairs
1|wiki|Building regulations in the United Kingdom
1|wiki|Planning permission in the United Kingdom
1|wiki|Load-bearing wall
1|wiki|Lintel
1|wiki|Open plan
1|wiki|Color scheme
1|wiki|Lighting design
1|wiki|Furniture
1|wiki|Bathroom
1|wiki|Bedroom
1|wiki|Living room
1|wiki|Ergonomics
1|wiki|Kitchen
1|wiki|Hallway
2|wiki|Approved Document
2|wiki|Building control body
2|wiki|Party Wall etc. Act 1996
2|wiki|Listed building
2|wiki|Loft conversion
2|wiki|Conservatory (greenhouse)
2|wiki|Permitted development rights
2|wiki|Means of escape
2|wiki|Fire door
2|wiki|Smoke detector
2|wiki|Universal design
2|wiki|Lifetime Homes Standard
2|wiki|Accessible housing
2|wiki|Proxemics
2|wiki|Damp (structural)
2|wiki|Building insulation
2|wiki|Thermal bridge
2|wiki|Ventilation (architecture)
2|wiki|Passive solar building design
2|wiki|Daylight factor
2|wiki|Insulated glazing
2|wiki|Thermal transmittance
2|wiki|Soundproofing
2|wiki|Structural engineering
2|wiki|Beam (structure)
2|wiki|Joist
2|wiki|Foundation (engineering)
2|wiki|Cavity wall
2|wiki|Timber framing
2|wiki|Brick
2|wiki|Plasterwork
2|wiki|Orthographic projection
2|wiki|Section (architecture)
2|wiki|Computer-aided design
2|wiki|Building information modeling
2|wiki|Handrail
2|wiki|Glazing (window)
2|wiki|Conservation area (United Kingdom)
2|wiki|Building code
2|wiki|Fire safety
2|wiki|Accessibility
3|wiki|A Pattern Language
3|wiki|Christopher Alexander
3|wiki|Le Corbusier
3|wiki|Modulor
3|wiki|Bauhaus
3|wiki|Brutalist architecture
3|wiki|Passive house
3|wiki|Building envelope
3|wiki|Interstitial condensation
3|wiki|Grenfell Tower fire
3|wiki|Environmental psychology
3|wiki|Biophilic design
3|wiki|Wayfinding
3|wiki|Space syntax
3|wiki|Isovist
3|wiki|Shape grammar
3|wiki|Generative design
3|wiki|Architects' Data
3|wiki|Human-centric lighting
3|wiki|Circadian rhythm
3|wiki|Prefabricated building
3|wiki|Modular building
3|wiki|Steel frame
3|wiki|Reinforced concrete
3|wiki|Building Research Establishment
3|wiki|Standard Assessment Procedure
3|wiki|Energy Performance Certificate (United Kingdom)
3|wiki|Royal Institute of British Architects
3|wiki|Parametric design`,
  },
];
