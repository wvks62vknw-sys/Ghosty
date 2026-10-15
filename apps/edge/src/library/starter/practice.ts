/** Starter library: writing production code, debugging, and security. */
import type { StarterDoc } from './types';

export const PRACTICE: StarterDoc[] = [
  {
    id: 'production-code',
    title: 'Production Code from Top Open-Source Projects: Idioms in Python, C++, Rust, Go and TypeScript',
    text: `# What well-run projects have in common

Small focused modules with clear public interfaces; consistent formatting enforced by tools (Black/Ruff, clang-format, rustfmt, gofmt, Prettier); linters in CI; tests next to the code they test, run on every change; descriptive commit messages and code review; documentation of why, not what; semantic versioning and changelogs; no warnings tolerated; reproducible builds with pinned dependencies.

# Python

Use type hints and check them (mypy or pyright). Prefer dataclasses or attrs (or pydantic for validated input) over raw dicts for structured data. Use pathlib, f-strings, enumerate and zip, comprehensions, context managers (with) for resources, and generators for streaming. Raise specific exceptions; never use bare except. Keep functions pure where possible. Organise as a package with pyproject.toml; tests with pytest and fixtures; logging module rather than print. Avoid mutable default arguments. For performance, push loops into NumPy or vectorised libraries, use functools.lru_cache for pure functions, and profile with cProfile.

# C++

Modern C++ (17/20/23): RAII for every resource; std::unique_ptr for ownership, std::shared_ptr only when ownership is truly shared; never raw new/delete in application code. Pass large objects by const reference, move when transferring ownership. Prefer std::vector and std::array; std::span and std::string_view for non-owning views. Use const and constexpr generously. The rule of zero (let members manage resources) or rule of five. Enable warnings (-Wall -Wextra -Werror) and sanitizers (AddressSanitizer, UndefinedBehaviorSanitizer, ThreadSanitizer) in tests. Avoid undefined behaviour: signed overflow, out-of-bounds access, data races, dangling references.

# Rust

Ownership and borrowing: each value has one owner; any number of shared references or exactly one mutable reference at a time; the compiler enforces it. Use Result<T, E> and the ? operator for errors (thiserror for libraries, anyhow for applications); Option for absence; avoid unwrap in library code. Model state with enums and exhaustive match. Iterators with closures compile to fast loops. Traits for shared behaviour; generics for zero-cost abstraction. Concurrency: Send and Sync markers, Arc<Mutex<T>>, channels, or async with tokio. Run cargo clippy and cargo test; keep unsafe blocks tiny, documented and justified.

# Go

Simplicity: small interfaces defined by the consumer ("accept interfaces, return structs"); errors are values — check every error and wrap with context using fmt.Errorf("doing x: %w", err); errors.Is and errors.As to inspect. Goroutines and channels for concurrency, with context.Context for cancellation and deadlines passed as the first parameter; never start a goroutine without knowing how it ends. sync.WaitGroup, sync.Mutex, errgroup. Table-driven tests with t.Run. Run go vet and the race detector (go test -race). Keep packages cohesive and avoid package-level mutable state.

# TypeScript

strict mode on; prefer unknown over any and narrow it; discriminated unions for state; readonly where possible; exhaustive switch with a never check; zod or similar to validate external data at the edges; async/await with proper error handling; small modules with explicit exports; ESLint plus Prettier; tests with vitest or node:test.`,
  },
  {
    id: 'debugging-case-studies',
    title: 'Debugging Case Studies: Bug, Explanation, Fix',
    text: `# How experienced developers debug

Reproduce the bug reliably; read the actual error message and stack trace; form a hypothesis; test it with the smallest experiment (a log line, a breakpoint, a failing unit test); fix the root cause; add a regression test; check for the same bug elsewhere. Use git bisect to find the commit that introduced a regression.

# Case: off-by-one in pagination

Symptom: the last item on each page also appeared first on the next page. Cause: page start computed as page * size - 1 while the end was inclusive. Fix: start = page * size, end exclusive = start + size; add a test that pages never overlap and together cover all items.

# Case: race condition in a counter

Symptom: a visit counter lost increments under load. Cause: read-modify-write (read value, add 1, write) from concurrent requests without synchronisation. Fix: an atomic increment in the database (UPDATE counters SET n = n + 1) or a lock; test with many concurrent requests.

# Case: timezone bug

Symptom: events showed one hour early for half the year. Cause: the code added a fixed UTC offset instead of using the time zone's rules, so daylight saving time was ignored. Fix: store UTC timestamps and convert with the IANA time zone at display time.

# Case: floating point money

Symptom: invoice totals were off by a cent. Cause: 0.1 + 0.2 is 0.30000000000000004 in binary floating point; rounding was applied at the wrong step. Fix: store money as integer cents (or a decimal type) and round once at defined points.

# Case: N+1 queries

Symptom: a page took 4 seconds with 200 rows. Cause: one query for the list, then one query per row for related data. Fix: fetch related data in one query with a join or IN (...) batch; add a test or log that counts queries.

# Case: memory leak in a long-running service

Symptom: memory grew until the process was killed. Cause: an in-memory cache keyed by request id with no eviction, and event listeners added on every request without removal. Fix: bounded LRU cache with TTL; remove listeners or attach them once; verify with heap snapshots before and after.

# Case: stale closure in a UI

Symptom: a timer always showed the initial value. Cause: the interval callback captured the variable's value at creation time. Fix: read current state inside the callback (or store it in a mutable reference) and clear the interval on teardown.

# Case: works locally, fails in CI

Symptom: tests passed on the developer's machine but failed in CI. Causes found: tests depended on execution order and shared state; the CI machine used a different time zone and locale; a dependency floated to a new version. Fixes: isolate test state, set TZ and locale explicitly, pin dependencies with a lockfile.

# Case: unhandled promise rejection

Symptom: a background job silently stopped. Cause: an async function threw, its promise was never awaited or caught, and the error was swallowed. Fix: await every promise or attach catch; add a global handler that logs unhandled rejections; surface failures to the user or monitoring.

# Case: cache invalidation

Symptom: users saw old profile data for minutes after updating it. Cause: the write updated the database but not the cache. Fix: delete the cache entry on write (and keep a short TTL as a safety net); be careful with races between a slow read refilling the cache with old data and the delete.`,
  },
  {
    id: 'security-cves',
    title: 'Security: OWASP Top 10, Dangerous Code Patterns and Famous CVEs',
    text: `# OWASP Top 10 (web application risks)

Broken access control (users reaching data or actions they should not; check authorisation on every request, server-side, deny by default); cryptographic failures (weak or missing encryption, home-made crypto; use TLS everywhere and vetted libraries; hash passwords with argon2, bcrypt or scrypt); injection (SQL, NoSQL, OS command, LDAP — use parameterised queries and never build commands from user input); insecure design; security misconfiguration (default credentials, verbose errors, open storage buckets); vulnerable and outdated components; identification and authentication failures (credential stuffing, weak session handling — use MFA, rate limiting, secure cookies); software and data integrity failures (unsigned updates, insecure deserialisation, untrusted CI pipelines); security logging and monitoring failures; server-side request forgery (SSRF: the server fetches attacker-chosen URLs, reaching internal services — allowlist destinations).

# Dangerous patterns (CWE)

Cross-site scripting (CWE-79): inserting untrusted text into HTML without escaping — use textContent, templating that escapes by default, and a Content Security Policy. SQL injection (CWE-89). OS command injection (CWE-78): pass arguments as an array, never through a shell string. Path traversal (CWE-22): normalise and confine file paths ("../"). Out-of-bounds read/write and use-after-free (CWE-125, CWE-787, CWE-416) in memory-unsafe languages. Missing authorisation (CWE-862) and authentication (CWE-306). Cross-site request forgery (CWE-352): use SameSite cookies, CSRF tokens, and check Origin/Sec-Fetch-Site. Unrestricted file upload (CWE-434). Deserialisation of untrusted data (CWE-502). Hard-coded credentials (CWE-798). Integer overflow (CWE-190). Race conditions / TOCTOU (CWE-367). Regular expression denial of service (ReDoS) from nested quantifiers like (a+)+. Prototype pollution in JavaScript when merging untrusted objects into plain objects (block __proto__, constructor, prototype keys). Timing attacks on secret comparison (use constant-time comparison).

# Famous vulnerabilities and their lessons

Heartbleed (CVE-2014-0160, OpenSSL): the TLS heartbeat handler trusted the length field sent by the peer and copied that many bytes back, leaking up to 64 KB of server memory per request, including private keys. Lesson: validate lengths against the actual received data; memory-safe languages prevent this class.

Shellshock (CVE-2014-6271, GNU Bash): Bash executed commands appended after a function definition stored in an environment variable, reachable through CGI headers. Lesson: never pass untrusted data into an interpreter's environment or code path.

POODLE (CVE-2014-3566): a padding-oracle attack on SSL 3.0 CBC mode. Lesson: retire legacy protocols; prevent downgrade.

Dirty COW (CVE-2016-5195, Linux kernel): a race condition in copy-on-write handling let unprivileged users write to read-only memory mappings and gain root. Lesson: concurrency bugs are security bugs.

Apache Struts (CVE-2017-5638): a crafted Content-Type header was evaluated as an OGNL expression, giving remote code execution; it was exploited in the 2017 Equifax breach after a patch had been available for two months. Lesson: patch quickly; never evaluate input as code.

EternalBlue (CVE-2017-0144, Windows SMBv1): remote code execution used by the WannaCry and NotPetya worms. Lesson: disable legacy services, segment networks, patch.

Spectre and Meltdown (CVE-2017-5753, CVE-2017-5715, CVE-2017-5754): speculative execution in CPUs leaves traces in the cache that leak data across security boundaries. Lesson: hardware optimisations can break isolation; mitigations include retpolines, kernel page-table isolation and site isolation in browsers.

Drupalgeddon2 (CVE-2018-7600): insufficient input sanitisation in Drupal's Form API allowed remote code execution. Lesson: frameworks need strict handling of nested, user-controlled structures.

Log4Shell (CVE-2021-44228, Apache Log4j 2): log messages were scanned for lookups, so logging a string like a jndi:ldap reference to an attacker's server made the application load and run remote code. Lesson: never interpret data that is being logged; reduce features enabled by default; know your dependencies (software bill of materials).

PwnKit (CVE-2021-4034, polkit pkexec): mishandling of an empty argument list let local users escalate to root. Spring4Shell (CVE-2022-22965): data binding exposed class loader properties, enabling remote code execution on some deployments.

MOVEit Transfer (CVE-2023-34362): SQL injection in a file transfer product, mass-exploited for data theft. Citrix Bleed (CVE-2023-4966): a buffer over-read in NetScaler leaked session tokens, letting attackers hijack sessions even after patching unless sessions were reset.

xz Utils backdoor (CVE-2024-3094): a long-running social-engineering campaign got a malicious maintainer into the xz project; versions 5.6.0 and 5.6.1 contained a hidden backdoor in liblzma, injected through obfuscated build scripts and test files, targeting OpenSSH servers on some Linux distributions. Lesson: supply-chain security — review build scripts and release artefacts, not just source; reproducible builds.

regreSSHion (CVE-2024-6387, OpenSSH): a signal-handler race in sshd allowed remote code execution on glibc Linux; it was a regression of a bug fixed in 2006. Lesson: regression tests for security fixes.

# Habits that prevent most bugs

Validate and normalise all input at the boundary; encode output for its context; least privilege for every token and service; secrets in a vault, never in code, logs or URLs; dependencies updated and scanned; security headers (Content-Security-Policy, HSTS, X-Content-Type-Options); rate limits and audit logs; threat-model new features ("what could an attacker do with this?").`,
  },
];
