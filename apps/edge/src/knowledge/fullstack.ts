/**
 * Full-stack engineering know-how Ghosty can look up with `study` (and search in the library):
 * clean architecture, authentication, CRUD APIs, database schemas, validation, working out the
 * backend a page implies, state and error handling, and the iPhone-first layout rules every
 * page Ghosty builds follows. Templates are complete and runnable as written.
 */
import type { Playbook } from './types';

export const FULLSTACK: Playbook[] = [
  {
    id: 'clean-architecture',
    title: 'Clean architecture: keep UI, business logic and data access apart',
    tags: ['architecture', 'clean architecture', 'separation of concerns', 'layers', 'full stack', 'fullstack', 'backend', 'structure', 'project structure', 'service', 'repository', 'mvc'],
    body: `THE RULE: every app has three layers, and code only ever calls DOWN:
  UI (components, pages, styles)  →  API / business logic (routes, services)  →  data access (repositories, models, SQL)
- UI never talks to the database and never holds business rules (prices, permissions, totals are computed by the server).
- Route handlers are thin: parse + validate the request, call ONE service function, map the result or error to an HTTP response.
- Services hold the rules ("an order total is the sum of its lines plus shipping", "only the owner may edit"). They take plain values and return plain values — no req/res objects, no SQL — so they can be tested without a server or database.
- Repositories are the only place SQL or ORM calls live. One per table/aggregate: findById, list({ page, filter }), create, update, remove.
- Dependencies are passed in (a db handle into the repository, a repository into the service), never imported as globals — so tests can pass fakes.

FOLDER LAYOUT (Node or Python, same shape)
  src/
    ui/            components, pages, styles (or a separate web/ app)
    api/           routes.ts | routes.py       HTTP only: validation, status codes
    services/      products.ts | products.py   business rules
    data/          db.ts, products.repo.ts | db.py, models.py, repos.py
    lib/           errors, validation, auth helpers
  migrations/      numbered SQL files: 001_init.sql, 002_add_orders.sql
  tests/           services tested with fake repos; one HTTP test per route

ERRORS CROSS LAYERS AS TYPES: the data layer throws NotFound / Conflict, the service throws Forbidden / Invalid, and ONE error middleware maps them to 404 / 409 / 403 / 422. Unknown errors → 500 with a request id; the stack trace goes to the log, never to the client.

CONFIG: read environment variables once in config.ts / settings.py, validate them at start-up and fail fast; secrets never in code or in the browser.

DEFINITION OF DONE for a feature: schema + migration, repository, service with its rules, validated route, UI with loading / empty / error states, and tests for the service rules and the unhappy paths (bad input, not found, not allowed).

study "auth", "crud api", "database schema", "validation", "ui to backend" for each layer in detail.`,
  },
  {
    id: 'auth',
    title: 'Secure user authentication: sessions or JWT, password hashing, cookies, CSRF',
    tags: ['auth', 'authentication', 'login', 'sign in', 'sign up', 'register', 'jwt', 'session', 'sessions', 'password', 'cookie', 'csrf', 'token', 'refresh token', 'oauth'],
    body: `CHOOSE
- Web app with its own backend → SERVER SESSIONS in an HttpOnly cookie (simplest, revocable, no token in JavaScript). Default choice.
- Separate API used by mobile apps or other services → short-lived JWT access token (10–15 min) + a long-lived refresh token stored server-side and ROTATED on every use.
- Never put a token in localStorage (any injected script can read it). Never roll your own crypto.

PASSWORDS: hash with argon2id (Python: argon2-cffi) or scrypt (Node: node:crypto) with a random 16-byte salt; compare with a constant-time check; minimum 8 characters, check against common-password lists, no maximum below 64. Same error for "no such user" and "wrong password". Rate-limit logins per IP and per account (e.g. 5 per minute), and lock out or add delay after repeated failures.

SESSION TABLE
  CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
  Store a SHA-256 hash of the token as the id, so a leaked database can't be used to log in.

COOKIE: Set-Cookie: sid=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
CSRF: SameSite=Lax blocks most of it; also require a custom header (X-Requested-With) or a CSRF token on every state-changing request, and check the Origin header.

NODE (Express) — scrypt + sessions
  import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from 'node:crypto';
  import { promisify } from 'node:util';
  const scrypt = promisify(_scrypt);
  export async function hashPassword(pw) {
    const salt = randomBytes(16);
    const key = await scrypt(pw, salt, 64);
    return salt.toString('hex') + ':' + key.toString('hex');
  }
  export async function verifyPassword(pw, stored) {
    const [salt, hex] = stored.split(':');
    const key = await scrypt(pw, Buffer.from(salt, 'hex'), 64);
    return timingSafeEqual(key, Buffer.from(hex, 'hex'));
  }
  const sha = (t) => createHash('sha256').update(t).digest('hex');
  export async function startSession(db, userId, res) {
    const token = randomBytes(32).toString('base64url');
    await db.run('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', sha(token), userId, Date.now() + 30 * 864e5, Date.now());
    res.cookie('sid', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30 * 864e5 });
  }
  export function requireUser(db) {
    return async (req, res, next) => {
      const token = req.cookies?.sid;
      const s = token && (await db.get('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?', sha(token), Date.now()));
      if (!s) return res.status(401).json({ error: 'sign in first' });
      req.userId = s.user_id;
      next();
    };
  }
  Logout: DELETE the session row and clear the cookie. Password change: delete ALL of that user's sessions.

PYTHON (FastAPI) — argon2 + JWT access/refresh
  from argon2 import PasswordHasher
  import jwt, secrets, time            # PyJWT
  ph = PasswordHasher()
  def hash_password(pw: str) -> str: return ph.hash(pw)
  def verify_password(stored: str, pw: str) -> bool:
      try: return ph.verify(stored, pw)
      except Exception: return False
  def access_token(user_id: int) -> str:
      now = int(time.time())
      return jwt.encode({"sub": str(user_id), "iat": now, "exp": now + 900}, settings.jwt_secret, algorithm="HS256")
  def current_user(authorization: str = Header(...)) -> int:
      try: return int(jwt.decode(authorization.removeprefix("Bearer "), settings.jwt_secret, algorithms=["HS256"])["sub"])
      except jwt.PyJWTError: raise HTTPException(401, "sign in first")
  Refresh: store sha256(refresh_token) in a refresh_tokens table with expiry; on /auth/refresh delete the old row and issue a new pair; if an already-used token comes back, delete every token of that user (it was stolen).

ALWAYS: authorisation on every route (check the row belongs to the user — "WHERE id = ? AND user_id = ?"), not just authentication; log sign-ins; email verification and password reset use single-use random tokens that expire in under an hour.`,
  },
  {
    id: 'crud-api',
    title: 'CRUD API routes with validation, pagination and an error middleware (Node and Python templates)',
    tags: ['crud', 'api', 'rest', 'route', 'routes', 'endpoint', 'endpoints', 'express', 'fastapi', 'flask', 'node', 'server', 'backend', 'pagination', 'middleware', 'error handling'],
    body: `REST SHAPE (one resource):
  GET    /api/products?page=1&limit=20&q=   → 200 { items, page, total }
  GET    /api/products/:id                  → 200 item | 404
  POST   /api/products            (body)    → 201 item + Location header | 422 invalid
  PATCH  /api/products/:id        (partial) → 200 item | 404 | 422
  DELETE /api/products/:id                  → 204 | 404
Status codes: 400 malformed, 401 not signed in, 403 not allowed, 404 missing, 409 conflict (duplicate), 422 invalid fields, 429 too many, 500 our fault. Error body always { error: "human message", fields?: { name: "required" } }.

NODE (Express, layered)
  // lib/errors.js
  export class HttpError extends Error { constructor(status, message, fields) { super(message); this.status = status; this.fields = fields; } }
  export const notFound = (what) => new HttpError(404, what + ' not found');
  // data/products.repo.js — the only place with SQL
  export const productsRepo = (db) => ({
    list: ({ limit, offset, q }) => db.all('SELECT * FROM products WHERE title LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?', '%' + q + '%', limit, offset),
    count: (q) => db.get('SELECT COUNT(*) AS n FROM products WHERE title LIKE ?', '%' + q + '%').then((r) => r.n),
    get: (id) => db.get('SELECT * FROM products WHERE id = ?', id),
    create: (p) => db.run('INSERT INTO products (title, price, images) VALUES (?, ?, ?)', p.title, p.price, JSON.stringify(p.images)).then((r) => r.lastID),
  });
  // services/products.js — rules, no HTTP, no SQL
  export const productsService = (repo) => ({
    async get(id) { const p = await repo.get(id); if (!p) throw notFound('product'); return { ...p, images: JSON.parse(p.images) }; },
    async create(input) { const id = await repo.create(input); return this.get(id); },
  });
  // api/routes.js — thin
  const asyncRoute = (fn) => (req, res, next) => fn(req, res).catch(next);
  router.get('/api/products/:id', asyncRoute(async (req, res) => res.json(await products.get(Number(req.params.id)))));
  router.post('/api/products', requireUser(db), asyncRoute(async (req, res) => res.status(201).json(await products.create(validateProduct(req.body)))));
  // the ONE error middleware, registered last
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, fields: err.fields });
    console.error(req.method, req.path, err);
    res.status(500).json({ error: 'Something went wrong on our side' });
  });

PYTHON (FastAPI + SQLAlchemy 2.0)
  class ProductIn(BaseModel):
      title: str = Field(min_length=1, max_length=200)
      price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
      images: list[HttpUrl] = Field(default_factory=list, max_length=20)
  class ProductOut(ProductIn):
      id: int
      model_config = ConfigDict(from_attributes=True)
  @router.get("/api/products/{pid}", response_model=ProductOut)
  def get_product(pid: int, db: Session = Depends(get_db)):
      p = db.get(Product, pid)
      if not p: raise HTTPException(404, "product not found")
      return p
  @router.post("/api/products", response_model=ProductOut, status_code=201)
  def create_product(body: ProductIn, db: Session = Depends(get_db), user: int = Depends(current_user)):
      p = Product(**body.model_dump(mode="json"), owner_id=user)
      db.add(p); db.commit(); db.refresh(p)
      return p
  FastAPI returns 422 with field errors automatically from the pydantic model.

PAGINATION: clamp limit to 1..100; offset pagination for small tables, cursor pagination (WHERE id < :last ORDER BY id DESC) for large or live ones. Never return unbounded lists.
IDEMPOTENCY: PUT/PATCH/DELETE are safe to retry; for POST that charges or sends, accept an Idempotency-Key header.`,
  },
  {
    id: 'database-schema',
    title: 'Database schema design: tables, types, keys, indexes and migrations',
    tags: ['database', 'schema', 'sql', 'table', 'tables', 'model', 'models', 'migration', 'migrations', 'postgres', 'sqlite', 'mysql', 'index', 'foreign key', 'relational', 'orm', 'prisma', 'sqlalchemy'],
    body: `DESIGN STEPS
1. List the nouns the app shows or stores (product, user, order, review). Each is a table, named in the plural.
2. Every table: id (INTEGER PRIMARY KEY or UUID), created_at, updated_at. Soft-delete with deleted_at only when undo/audit is needed.
3. Pick exact types: money → INTEGER pence/cents or NUMERIC(10,2) (NEVER float); time → TIMESTAMPTZ / integer epoch ms; true/false → BOOLEAN; fixed choices → TEXT with CHECK (status IN ('draft','live')) or an enum; free text → TEXT with a length limit in validation.
4. Relationships: one-to-many → a foreign key on the "many" side (orders.user_id REFERENCES users(id)); many-to-many → a join table (product_tags(product_id, tag_id, PRIMARY KEY (product_id, tag_id))). Choose ON DELETE CASCADE / RESTRICT / SET NULL deliberately.
5. Lists of simple values: a child table when you query or filter by them (product_images(product_id, url, position)); a JSON column (Postgres JSONB / SQLite TEXT with JSON) when they are only ever read with the parent. Postgres also has TEXT[].
6. Constraints in the database, not only the code: NOT NULL, UNIQUE (users.email), CHECK (price >= 0), foreign keys.
7. Index every foreign key and every column used in WHERE / ORDER BY on large tables; a UNIQUE index for natural keys (slug, email). Composite index order = equality columns first, then the range/sort column.

TEMPLATE (Postgres; SQLite: SERIAL → INTEGER PRIMARY KEY, NUMERIC → INTEGER pence, TIMESTAMPTZ → INTEGER)
  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'GBP',
    images TEXT[] NOT NULL DEFAULT '{}',
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','shipped','cancelled')),
    total NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE order_items (
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL,      -- copied at purchase time: prices change later
    PRIMARY KEY (order_id, product_id)
  );
  CREATE INDEX orders_user_created ON orders (user_id, created_at DESC);

MIGRATIONS: numbered, forward-only SQL files applied in order and recorded in a schema_migrations table; never edit one that has run; add a column as nullable or with a default, backfill, then add NOT NULL. Every query parameterised (? or $1) — never string-built.
ON CLOUDFLARE (free): D1 (SQLite) or a Durable Object's SQLite with the same schema; Postgres free tiers: Neon, Supabase.`,
  },
  {
    id: 'validation',
    title: 'Secure data validation at every edge (input, output, SQL, HTML)',
    tags: ['validation', 'validate', 'input', 'sanitize', 'sanitise', 'zod', 'pydantic', 'schema validation', 'xss', 'sql injection', 'injection', 'security', 'form', 'forms'],
    body: `PRINCIPLES
- Validate on the SERVER at the edge (the route), with a schema, before anything else touches the data. Browser checks are only for convenience.
- Allowlist, don't blocklist: say what IS allowed (type, length, range, pattern, enum) and reject the rest with 422 + per-field messages.
- Parse into a typed value, then use only the parsed value (strip unknown fields, so { "role": "admin" } in a body can't slip through — mass assignment).
- Limits on everything: body size (e.g. 100 KB), string lengths, array lengths, numeric ranges, page size.
- Output encoding is separate from validation: escape when rendering (textContent / framework templates, never innerHTML with data); parameterised SQL always; URL-encode query parts; JSON.stringify for JSON.

NODE WITHOUT A LIBRARY (a small reusable validator)
  export function validateProduct(b) {
    const fields = {};
    const title = typeof b?.title === 'string' ? b.title.trim() : '';
    if (!title || title.length > 200) fields.title = 'required, up to 200 characters';
    const price = Number(b?.price);
    if (!Number.isFinite(price) || price < 0 || price > 1e6) fields.price = 'a number from 0 to 1,000,000';
    const images = Array.isArray(b?.images) ? b.images : [];
    if (images.length > 20 || images.some((u) => typeof u !== 'string' || !/^https:\\/\\//.test(u))) fields.images = 'up to 20 https URLs';
    if (Object.keys(fields).length) throw new HttpError(422, 'Please fix the highlighted fields', fields);
    return { title, price: Math.round(price * 100) / 100, images };
  }
  With zod: const Product = z.object({ title: z.string().trim().min(1).max(200), price: z.coerce.number().min(0).max(1e6), images: z.array(z.string().url().startsWith('https://')).max(20).default([]) }); const p = Product.parse(req.body);

PYTHON: pydantic models (see "crud api") — EmailStr, HttpUrl, constr/Field(min_length, max_length, pattern), conint/Field(ge, le), Literal["a","b"] for enums; model_config = ConfigDict(extra="forbid") to reject unknown fields.

ALSO: uploads — check size and real type (magic bytes), store outside the web root with a random name; redirects — only to relative paths or an allowlist (no open redirects); emails — normalise to lowercase before UNIQUE checks; IDs from the URL — parse as integers and check ownership in the query.`,
  },
  {
    id: 'ui-to-backend',
    title: 'Reverse engineering: from a page\'s components to the backend models, tables and routes it needs',
    tags: ['reverse engineering', 'reverse engineer', 'ui to backend', 'data model', 'data models', 'deduce', 'infer', 'clone', 'recreate', 'rebuild', 'website', 'backend for', 'product card', 'component'],
    body: `METHOD: every REPEATED component on a page is a row from a table; every field visible on it is a column; every form is a POST route; every filter or sort control is a query parameter; every page with an id in its URL is a GET-by-id route; every "my …" area needs auth.

COMPONENT → MODEL (field: type)
- Product card → products: title TEXT, slug TEXT UNIQUE, price NUMERIC(10,2), compare_at_price NUMERIC NULL (a struck-through "was" price), currency CHAR(3), images TEXT[] (or product_images table), rating NUMERIC(2,1) + review_count INTEGER (stars), in_stock BOOLEAN / stock INTEGER, badge TEXT NULL ("New", "Sale"), category_id → categories. Variants (size/colour pickers) → product_variants(product_id, sku, size, colour, price, stock).
- Add to cart / basket count → carts(id, user_id NULL, session_id) + cart_items(cart_id, product_id, quantity). Checkout → orders + order_items (see "database schema"); payment via a provider (Stripe Checkout), never card numbers in your database.
- Blog/news card (title, excerpt, date, author, image) → posts: title, slug UNIQUE, excerpt, body TEXT, cover_url, published_at TIMESTAMPTZ NULL, author_id → authors/users; tags → tags + post_tags.
- Testimonial / review → reviews: product_id NULL, author_name, rating SMALLINT CHECK 1–5, body, approved BOOLEAN, created_at.
- Team member → people: name, role, photo_url, bio, position INTEGER (sort order).
- Event card (date, venue, ticket button) → events: title, starts_at, ends_at, venue, address, lat/lon, price, capacity, tickets_left; bookings(event_id, user_id, quantity).
- Pricing table → plans: name, price_monthly, price_yearly, features TEXT[] (or plan_features), highlighted BOOLEAN.
- FAQ accordion → faqs: question, answer, position. Gallery → images: url, alt, width, height, position.
- Menu (restaurant) → menu_sections + menu_items: name, description, price, dietary TEXT[] (vegan, gluten-free), available BOOLEAN.
- Property/car listing → listings: title, price, location, lat/lon, bedrooms/mileage…, images TEXT[], status.
- Contact form → contact_messages: name, email, phone NULL, message, created_at, handled BOOLEAN + POST /api/contact (validated, rate-limited, spam honeypot).
- Newsletter box → subscribers: email UNIQUE, confirmed_at NULL (double opt-in).
- Search box → GET /api/<items>?q= with a full-text index (Postgres tsvector, SQLite FTS5).
- Login / account menu → users + sessions (study "auth"); "saved"/"wishlist" heart → favourites(user_id, item_id, PRIMARY KEY both).

OUTPUT, IN THIS ORDER: (1) the models as SQL CREATE TABLE statements with types, keys and indexes; (2) the routes table (method, path, auth, body, response); (3) the service rules (who may do what, computed fields); (4) the UI rendering each repeated component from a data array, so swapping the array for a fetch of the API is a one-line change.

IN A REBUILT SINGLE-PAGE SITE (publish_site): keep the same separation inside the one file — the content as a JS data array (or a <script type="application/json" id="data"> block) shaped exactly like the deduced tables, small render functions that turn rows into elements, and event handlers separate from both. Published pages can't call a server, so give the owner the backend (schema + routes) as code in chat when they want it live.`,
  },
  {
    id: 'state-and-errors',
    title: 'Frontend state hooks, data fetching and robust error handling layers',
    tags: ['state', 'state management', 'hook', 'hooks', 'usestate', 'useeffect', 'react', 'store', 'fetch', 'data fetching', 'loading', 'error boundary', 'error handling', 'retry', 'frontend'],
    body: `EVERY PIECE OF REMOTE DATA HAS FOUR STATES: loading, error (with a retry), empty, and data. Render all four. Never leave a spinner forever: add a timeout.

REACT — a reusable data hook with cancellation
  function useResource(url) {
    const [state, setState] = useState({ status: 'loading', data: null, error: null });
    const [nonce, setNonce] = useState(0);
    useEffect(() => {
      const ctrl = new AbortController();
      setState((s) => ({ ...s, status: 'loading' }));
      fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
        .then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'HTTP ' + r.status); return r.json(); })
        .then((data) => setState({ status: data?.items?.length === 0 ? 'empty' : 'ready', data, error: null }))
        .catch((e) => { if (e.name !== 'AbortError') setState({ status: 'error', data: null, error: e.message }); });
      return () => ctrl.abort();
    }, [url, nonce]);
    return { ...state, retry: () => setNonce((n) => n + 1) };
  }
  Mutations: disable the button while sending, show the server's field errors next to the fields, optimistic update only when you can roll it back.
  Error boundary: a class component with static getDerivedStateFromError + componentDidCatch around each page, showing "Something went wrong — Reload".

VANILLA JS — a tiny store (what Ghosty's rebuilt pages use)
  function createStore(initial) {
    let state = initial; const subs = new Set();
    return {
      get: () => state,
      set(patch) { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }; subs.forEach((f) => f(state)); },
      subscribe(f) { subs.add(f); f(state); return () => subs.delete(f); },
    };
  }
  const cart = createStore({ items: [], open: false });
  cart.subscribe((s) => { badge.textContent = String(s.items.length); drawer.hidden = !s.open; });
  Persist small UI state (theme, last tab) only when storage is available: try { localStorage.setItem(k, v); } catch {}

SERVER-SIDE ERROR LAYERS
1. Validation at the route → 422 with fields.
2. Domain errors from services (NotFound, Forbidden, Conflict) → mapped by ONE error middleware.
3. Unexpected errors → 500 with a request id; log the stack with that id; alert on rate, not on each one.
4. Process level: process.on('unhandledRejection', log) in Node; never swallow errors with an empty catch.
5. Calls to other services: timeout (AbortSignal.timeout(8000)), retry only idempotent requests with exponential backoff + jitter (3 tries), and a fallback (cached value or a clear message).`,
  },
  {
    id: 'mobile-390',
    title: 'iPhone-first layout laws (390px viewport): fluid type, container queries, smooth 60fps scrolling',
    tags: ['mobile', 'iphone', 'iphone 13', '390', 'responsive', 'mobile first', 'viewport', 'safe area', 'fluid typography', 'container queries', 'scrolling', 'smooth', 'performance', 'css', 'layout', 'touch'],
    body: `DESIGN AT 390×844 FIRST (iPhone 12/13/14 in CSS pixels), then widen with min-width media/container queries.

HEAD
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#…">   (colours Safari's bars)

LAYOUT LAWS
1. No sideways scroll, ever: html, body { overflow-x: clip; } img, video, iframe { max-width: 100%; height: auto; } long words: overflow-wrap: anywhere. Test at 320px too.
2. Side gutters 16–20px; content max-width ~ 70ch on wide screens: .wrap { width: min(100% - 32px, 1100px); margin-inline: auto; }
3. Safe areas: padding-top: env(safe-area-inset-top) on fixed/sticky headers; padding-bottom: calc(16px + env(safe-area-inset-bottom)) on bottom bars.
4. Full-height sections use 100svh / 100dvh (not 100vh, which hides content behind Safari's toolbar).
5. Tap targets ≥ 44×44px with 8px between them; inputs font-size ≥ 16px (smaller makes iOS zoom in).
6. One column on the phone; grids that adapt without media queries: grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
7. Sticky compact header (≤ 56px + safe area) with a menu button that opens a full-width sheet; close on link tap and Escape.

FLUID TYPOGRAPHY
  :root { font-size: 100%; }
  body { font: 400 clamp(1rem, 0.95rem + 0.25vw, 1.125rem)/1.55 system-ui, -apple-system, sans-serif; -webkit-text-size-adjust: 100%; }
  h1 { font-size: clamp(2rem, 1.4rem + 3vw, 3.5rem); line-height: 1.1; text-wrap: balance; }
  h2 { font-size: clamp(1.5rem, 1.2rem + 1.5vw, 2.25rem); }
  p { text-wrap: pretty; max-width: 65ch; }

CONTAINER QUERIES (components that adapt to their box, not the screen — Safari 16+)
  .cards { container-type: inline-size; }
  .card { display: grid; gap: 12px; }
  @container (min-width: 480px) { .card { grid-template-columns: 160px 1fr; } }

SMOOTH SCROLLING (60fps on an A15)
- Animate ONLY transform and opacity (GPU-composited); never animate width/height/top/left/box-shadow/filter on scroll.
- will-change: transform only on elements that are about to animate, removed after.
- Scroll-linked effects with IntersectionObserver (reveal on enter) or CSS scroll-driven animations, never a scroll event handler doing layout reads + writes. Any touch/scroll listener: { passive: true }.
- Long pages: .section { content-visibility: auto; contain-intrinsic-size: auto 800px; } skips off-screen rendering.
- Heavy shadows/blur: prefer a solid or slightly translucent background over backdrop-filter on large areas; keep backdrop-filter to small bars.
- Carousels: CSS scroll-snap (scroll-snap-type: x mandatory; overflow-x: auto; overscroll-behavior-x: contain) instead of JS-dragged transforms.
- Images: width/height attributes (no layout shift), loading="lazy" + decoding="async" below the fold, fetchpriority="high" on the hero, srcset/sizes so the phone downloads ~800px-wide images, not 3000px.
- Fonts: system font stack, or at most 2 Google Font weights with display=swap.
- Respect @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
- Dark mode: @media (prefers-color-scheme: dark) with colour tokens on :root.

CHECK BEFORE SHIPPING: 390px wide with no horizontal scroll; header and bottom bar clear the notch and home indicator; every button reachable with a thumb; text readable without zoom; nothing jumps while images load.`,
  },
];
