/**
 * THE FIRST RUN, on the phone (BRIEF-REST-B part 4): what main.ts shows instead of the sign-in when the brain says it has no
 * owner yet. The steps are features/system/firstrun.ts; this draws them. It makes the key here (crypto.getRandomValues, on this
 * phone), shows it and its fingerprint (OWNER_KEY_HASH for Cloudflare), pairs with the app's own pairing code (api/brain.ts
 * ownerKey + brain.status), then names the owner, saves Home and says three things to try. State for the specs at
 * window.__ghostyFirstRun; the specs may give it a key to make (window.__ghostyFirstRunKey, only under a test runner).
 */
import { clear, h } from '../../core/dom';
import { AuthError, brain, ownerKey } from '../../api/brain';
import { settings } from '../../state/app';
import { button } from '../../ui/components';
import type { PlaceCandidate } from '../../../../../packages/shared/src/places';
import { advance, type Event, type FirstRun, HASH_VARIABLE, loadFirstRun, makeKey, newFirstRun, saveFirstRun, sha256Hex, THREE_THINGS, validKey } from './firstrun';

export const firstRunState = { step: 'welcome' as string, key: '', hash: '', paired: false, name: '', home: false, message: '', shown: false };

/**
 * The wizard. Resolves true when this phone has been paired (the app goes on as signed in), false when the owner chose to sign
 * in with a key he already has (`pair` is the app's own sign-in form, handed in, and the app goes on as it always did).
 */
export function firstRun(pair: (reason: string) => Promise<void>): Promise<boolean> {
  return new Promise((resolve) => {
    let st: FirstRun = loadFirstRun();
    // a wizard that was paired is from a brain that has since been reset: start again
    if (st.paired) {
      st = newFirstRun();
      saveFirstRun(st);
    }
    (window as unknown as { __ghostyFirstRun?: unknown }).__ghostyFirstRun = firstRunState;
    const box = h('div#firstrun', { role: 'dialog', 'aria-label': 'Set up your Ghosty', 'aria-modal': 'true' });
    document.body.append(box);
    firstRunState.shown = true;
    const msg = h('p.note.frmsg', { 'aria-live': 'polite' });
    const say = (t: string) => {
      msg.textContent = t;
      firstRunState.message = t;
    };
    const go = (e: Event) => {
      const r = advance(st, e);
      if (r.error) say(r.error);
      else {
        st = r.state;
        saveFirstRun(st);
        say('');
      }
      paint();
    };
    const copy = (text: string, what: string) =>
      button(`COPY ${what}`, async () => {
        try {
          await navigator.clipboard.writeText(text);
          say(`${what[0]!.toUpperCase()}${what.slice(1).toLowerCase()} copied.`);
        } catch {
          say(`Your browser would not copy it: press and hold the ${what.toLowerCase()} to select it.`);
        }
      });

    // ---------------------------------------------------------------------------------------- the steps
    const welcome = () => [
      h('h2', 'WELCOME'),
      h('p', 'This Ghosty has no owner yet. Let’s make you its owner: it takes a few minutes. Everything here is yours alone: your own brain on your own Cloudflare account, nothing shared, nothing carried over from anyone.'),
      h('div.row.wrap', button('START', () => go({ t: 'start' }), 'on'), button('I ALREADY HAVE A KEY', async () => {
        box.remove();
        firstRunState.shown = false;
        await pair('Enter the owner key you already have.');
        resolve(false);
      })),
    ];

    const makeIt = async () => {
      // (a test runner may hand in the key to make, so a spec can sign in to the preview brain; it is used as it is)
      const w = window as unknown as { __ghostyFirstRunKey?: string };
      const key = navigator.webdriver && w.__ghostyFirstRunKey ? w.__ghostyFirstRunKey : makeKey((n) => crypto.getRandomValues(new Uint8Array(n)));
      go({ t: 'made', key, hash: await sha256Hex(key) });
    };

    const keyStep = () => {
      if (!st.key) {
        return [
          h('h2', 'MAKE YOUR KEY'),
          h('p', 'Your key is a long random password that only you will have. It is made here, on this phone, and it never leaves it: Cloudflare is only told its fingerprint.'),
          h('div.row.wrap', button('MAKE MY KEY', () => void makeIt(), 'on'), button('BACK', () => go({ t: 'back' }))),
        ];
      }
      return [
        h('h2', 'YOUR KEY'),
        h('p', 'Copy this into Passwords (or any password manager) now. It is the only way into your Ghosty, and nobody can recover it for you.'),
        h('code.frcode.frkey', { 'aria-label': 'Your key', tabIndex: 0 }, st.key),
        h('div.row.wrap', copy(st.key, 'KEY')),
        h('h2', 'TELL CLOUDFLARE IT IS YOURS'),
        h('p', `In the Cloudflare dashboard open your Worker, then Settings, Variables and secrets, Add: name ${HASH_VARIABLE}, type Secret, and this value (the fingerprint of your key), then Deploy.`),
        h('code.frcode.frhash', { 'aria-label': 'The fingerprint to give Cloudflare', tabIndex: 0 }, st.hash),
        h('div.row.wrap', copy(st.hash, 'FINGERPRINT')),
        h('p.note', `The variable’s name must be exactly ${HASH_VARIABLE}.`),
        h('div.row.wrap', button('I ADDED IT', () => void added(), 'on')),
      ];
    };

    const added = async () => {
      say('Checking with your Worker…');
      const health = await brain.health();
      if (!health) return say('I can’t reach your Worker: check the connection and try again.');
      if (!health.secured) return say(`Your Worker doesn’t know the fingerprint yet. Check the variable’s name (${HASH_VARIABLE}) and its value, deploy it, wait a minute and press I ADDED IT again.`);
      if (!validKey(st.key)) return say('There is no key yet: press BACK and make one.');
      ownerKey.set(st.key);
      try {
        await brain.status();
      } catch (e) {
        ownerKey.set('');
        return say(e instanceof AuthError ? 'That key is not accepted yet: the variable’s value must be exactly the fingerprint above, with no spaces. Fix it, deploy, wait a minute and try again.' : `Your Worker did not answer: ${(e as Error).message}`);
      }
      go({ t: 'paired' });
    };

    const nameStep = () => {
      const input = h('input', { type: 'text', 'aria-label': 'Your name', placeholder: 'Your name', autocomplete: 'given-name', maxlength: '60', value: st.name }) as HTMLInputElement;
      const done = async () => {
        const name = input.value.trim();
        if (name) {
          settings.set({ name });
          await brain.addMemory(`My name is ${name}.`).catch(() => undefined);
        }
        go(name ? { t: 'named', name } : { t: 'skipName' });
      };
      input.addEventListener('keydown', (e) => e.key === 'Enter' && void done());
      return [h('h2', 'YOUR NAME'), h('p', 'What should I call you?'), input, h('div.row.wrap', button('CONTINUE', () => void done(), 'on'), button('SKIP', () => go({ t: 'skipName' })))];
    };

    let found: PlaceCandidate | null = null;
    const homeStep = () => {
      const input = h('input', { type: 'text', 'aria-label': 'Your home address or postcode', placeholder: 'Your address or postcode', autocomplete: 'street-address' }) as HTMLInputElement;
      const result = h('p.note.frfound', { 'aria-live': 'polite' }, found ? found.address : '');
      const find = async () => {
        const q = input.value.trim();
        if (!q) return say('Type an address or a postcode first.');
        say('Looking…');
        try {
          found = (await brain.placeFind('home', q)).found;
          result.textContent = found.address;
          say('Is this it? KEEP IT saves it as your Home, in your own brain only.');
          keep.hidden = false;
        } catch (e) {
          say(`I couldn’t find that: ${(e as Error).message}`);
        }
      };
      const keep = button('KEEP IT', async () => {
        if (!found) return;
        try {
          await brain.placeKeep(found);
          go({ t: 'homed' });
        } catch (e) {
          say(`I couldn’t save it: ${(e as Error).message}`);
        }
      }, 'on');
      keep.hidden = !found;
      input.addEventListener('keydown', (e) => e.key === 'Enter' && void find());
      return [h('h2', 'HOME'), h('p', 'Where is home? It is used for the weather, your commute and the map, and stays in your own brain. You can skip this and add it later in Memory.'), input, h('div.row.wrap', button('FIND IT', () => void find()), keep, button('SKIP', () => go({ t: 'skipHome' }))), result];
    };

    const tryStep = () => [h('h2', 'THREE THINGS TO TRY'), h('ol.frthree', ...THREE_THINGS.map((t) => h('li', t))), h('div.row.wrap', button('DONE', () => go({ t: 'finish' }), 'on'))];

    const paint = () => {
      firstRunState.step = st.step;
      firstRunState.key = st.key;
      firstRunState.hash = st.hash;
      firstRunState.paired = st.paired;
      firstRunState.name = st.name;
      firstRunState.home = st.home;
      if (st.step === 'done') {
        box.remove();
        firstRunState.shown = false;
        resolve(true);
        return;
      }
      const n = ['welcome', 'key', 'name', 'home', 'try'].indexOf(st.step) + 1;
      const body = st.step === 'welcome' ? welcome() : st.step === 'key' ? keyStep() : st.step === 'name' ? nameStep() : st.step === 'home' ? homeStep() : tryStep();
      clear(box, h('div.frbox', h('small.frstep', { dataset: { case: 'keep' } }, `STEP ${n} OF 5`), ...body, msg));
    };
    paint();
  });
}
