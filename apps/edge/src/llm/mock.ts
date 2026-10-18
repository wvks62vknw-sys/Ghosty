/**
 * A scripted fake model used only by automated tests (env MOCK_LLM = "1").
 * It turns simple phrases into tool calls so the agent loop can be tested offline.
 */
import type { Msg, ToolSpec } from './router';
import { imagesIn, ownerWords, textOf } from './content';
import { EXERCISES } from '../training/exercises';

let n = 0;
const call = (name: string, args: Record<string, unknown>): Msg => ({
  role: 'assistant',
  content: null,
  tool_calls: [{ id: `mock_${++n}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
});

export async function mockComplete(messages: Msg[], tools: ToolSpec[]): Promise<{ message: Msg; model: string }> {
  const last = messages[messages.length - 1]!;
  const model = 'Mock · scripted';
  // training ground: a wrong first try, then the right answer once shown the failures
  if (/training ground/.test(String(messages[0]?.content ?? ''))) {
    const ex = EXERCISES.find((e) => e.prompt === messages[1]?.content);
    if (ex) return { message: { role: 'assistant', content: messages.length > 2 ? `\`\`\`js\n${ex.reference}\n\`\`\`` : `\`\`\`js\nfunction ${ex.entry}() { return null; }\n\`\`\`` }, model };
  }
  if (/ONE sentence \(max 40 words\)/.test(String(messages[0]?.content ?? ''))) {
    return { message: { role: 'assistant', content: 'Returned a placeholder instead of computing the result. Rule: implement the full behaviour the task describes before running tests.' }, model };
  }
  // "no model: …": every model is cooling down — what Ghosty answers with no AI at all (direct.ts), as the router would report it.
  if (last.role === 'user' && /^no model:/i.test(ownerWords(textOf(last.content)).replace(/^Scheduled task "[^"]*": /, '').trim())) {
    throw Object.assign(new Error('Every model I can reach is cooling down after rate limits. The first one frees up in about 40 seconds. Another free key in the System tab gives me more room.'), { waitMs: 40_000 });
  }
  // "tool then no model: …": a tool runs, then every model is cooling down at the next step (the turn has already acted).
  const askedNow = [...messages].reverse().find((x) => x.role === 'user');
  if (askedNow && /^tool then no model:/i.test(ownerWords(textOf(askedNow.content)).trim())) {
    if (last.role === 'user') return { message: call('list_memory', {}), model };
    throw Object.assign(new Error('Every model I can reach is cooling down after rate limits. The first one frees up in about 40 seconds.'), { waitMs: 40_000 });
  }
  const system = String(messages[0]?.content ?? '');
  // Ghosty's character (persona.ts): which style the prompt asked for, and a slip the router's post-filter must catch.
  const owner = last.role === 'user' ? ownerWords(textOf(last.content)).trim().toLowerCase() : '';
  if (owner === 'how will you answer?') return { message: { role: 'assistant', content: system.includes('SPOKEN:') ? 'Out loud, briefly.' : 'In writing.' }, model };
  if (owner === 'say something chatty') return { message: { role: 'assistant', content: 'Great question! The kettle is on. I hope this helps! Let me know if you need anything else.' }, model };
  // The nightly reflection (profile.ts): what the owner said they like becomes a fact and a profile line, and the day gets a diary entry.
  if (/Reply with ONLY a JSON object/.test(system) && /looking back at today/.test(system)) {
    const said = textOf(messages[messages.length - 1]?.content);
    const likes = [...new Set([...said.matchAll(/OWNER \([^)]*\): (?:remember )?i (?:like|love|prefer) ([^.\n<]+)/gi)].map((x) => x[1]!.trim()))];
    return { message: { role: 'assistant', content: JSON.stringify({ summary: likes.length ? `Someone who likes ${likes.join(' and ')}.` : 'The owner, as far as the mock knows.', facts: likes.map((l) => `likes ${l}`), sections: { likes }, diary: `Today the owner and I talked${likes.length ? ` and they told me they like ${likes.join(' and ')}` : ''}. Nothing was decided. Nothing to follow up.` }) }, model };
  }
  // The morning digest's "in three levels" note (library/digest.ts).
  if (/"In one line:"/.test(system)) return { message: { role: 'assistant', content: 'In one line: the mock read the day\'s headlines.\n\nIn more detail: the mock gathered the news, technology and science of the day and found them interesting.\n\nFor an expert: the mock has no paper to single out.' }, model };
  // A website built on its own (sitebuild.ts): the planner keeps the look and drops nothing, the writer keeps
  // every word but the first (shown with a mark, so a test can see the writer's words reach the page), the critic is content.
  if (/^SITE PLANNER/.test(system)) return { message: { role: 'assistant', content: '```json\n{"palette":"barber","fonts":"condensed","shape":"sharp","scheme":"dark","tone":"sharp, friendly, local","drop":[],"why":"The mock likes the trade\'s own look."}\n```' }, model };
  if (/^SITE WRITER/.test(system)) {
    const asked = textOf(last.content).split('TEXT TO IMPROVE (JSON):\n')[1] ?? '{}';
    let first = '';
    try {
      first = String((JSON.parse(asked) as Record<string, string>)['0'] ?? '');
    } catch {
      /* nothing to keep */
    }
    return { message: { role: 'assistant', content: JSON.stringify(first && first.length < 40 ? { '0': `${first} ✓` } : {}) }, model };
  }
  if (/^SITE CRITIC/.test(system)) return { message: { role: 'assistant', content: JSON.stringify({ verdict: 'Clear, confident and easy to use on a phone; the mock found nothing to change.', score: 8, fixes: [] }) }, model };
  // One step of a project that runs for days (projects.ts): the result itself, with a source.
  if (/PROJECT STEP/.test(system)) {
    const step = textOf(messages[messages.length - 1]?.content).match(/^Step (\d+): ([^\n—]+) — /m);
    return { message: { role: 'assistant', content: `Step ${step?.[1] ?? '?'} (${(step?.[2] ?? 'the step').trim()}) is done: the mock looked into it and found two options, A and B, and A is the better one. Sources: https://example.com/a https://example.com/b` }, model };
  }
  // Chains: one tool's result feeds the next in the same turn; several read-only calls in one
  // reply; and a chain long enough to show the step cap leaves room for real work.
  const chainUser = [...messages].reverse().find((x) => x.role === 'user');
  const chainAsked = textOf(chainUser?.content).toLowerCase().trim();
  const chainSince = chainUser ? messages.slice(messages.lastIndexOf(chainUser)) : [];
  const chainDid = (name: string) => chainSince.filter((x) => x.role === 'assistant' && x.tool_calls?.some((c) => c.function.name === name)).length;
  const offered = (name: string) => tools.some((t) => t.function.name === name);
  if (chainAsked === 'recon then save example.com' && offered('recon_domain')) {
    // recon_domain files its report; then the page it looked at is read into the library — the host comes from the first result, not from the question.
    if (!chainDid('recon_domain')) return { message: call('recon_domain', { target: 'example.com', save: true }), model };
    const host = textOf(chainSince.find((x) => x.role === 'tool')?.content).match(/^# Recon: (\S+)/m)?.[1];
    if (host && !chainDid('library_import')) return { message: call('library_import', { source: `https://${host}/` }), model };
    const found = textOf(last.content).replace(/<<[^>]*>>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    return { message: { role: 'assistant', content: `Done: looked at ${host ?? 'example.com'} and saved what I found. ${found}` }, model };
  }
  const together = chainAsked.match(/^read (https?:\/\/\S+) and (https?:\/\/\S+) together( and remember them)?$/);
  if (together && last.role === 'user') {
    // Two reads in one reply (both read-only: they run together); "and remember them" puts a write between them (then they run in order).
    const calls = [call('web_fetch', { url: together[1] }).tool_calls![0]!, ...(together[3] ? [call('remember', { text: `read ${together[1]} and ${together[2]}` }).tool_calls![0]!] : []), call('web_fetch', { url: together[2] }).tool_calls![0]!];
    return { message: { role: 'assistant', content: null, tool_calls: calls }, model };
  }
  const steps = chainAsked.match(/^chain (\d+) steps$/);
  // list_memory in the usual loop; while the database is paused only the device's library search is offered.
  const stepTool = offered('list_memory') ? 'list_memory' : offered('library_search') ? 'library_search' : '';
  if (steps && stepTool) {
    const done = chainDid(stepTool);
    if (done < Number(steps[1])) return { message: call(stepTool, stepTool === 'library_search' ? { query: `step ${done + 1}` } : {}), model };
    return { message: { role: 'assistant', content: `Done after ${done} steps.` }, model };
  }
  // "mot check X then no model": the check runs, then every model is cooling down; "mot check X then daily hello":
  // the check, then a daily task that waits for approval, then a reply (the vehicle check's privacy tests).
  const motThen = chainAsked.match(/^mot check (.+?) then (no model|daily hello)$/);
  if (motThen && offered('vehicle_check')) {
    if (!chainDid('vehicle_check')) return { message: call('vehicle_check', { plate: motThen[1] }), model };
    if (motThen[2] === 'no model') throw Object.assign(new Error('Every model I can reach is cooling down after rate limits. The first one frees up in about 40 seconds.'), { waitMs: 40_000 });
    if (!chainDid('schedule_task') && offered('schedule_task')) return { message: call('schedule_task', { title: 'Daily hello', prompt: 'say hello', at: '09:00', repeat: 'daily' }), model };
    return { message: { role: 'assistant', content: `Done. ${chainAsked}` }, model };
  }
  // A cited answer (cited.ts): the claim check's JSON (a claim citing [1] is found, nothing else), and the
  // cited turn itself — search, read the first result, then an answer with markers, one source never
  // looked up ([2]) and one number with no source at all ([3]).
  if (/^CLAIM CHECK/.test(system)) {
    const claims = [...textOf(last.content).split('\n\nSOURCES:')[0]!.matchAll(/^(\d+)\. (.*)$/gm)];
    return { message: { role: 'assistant', content: JSON.stringify({ checks: claims.map((c) => (/\[1\]/.test(c[2]!) ? { i: Number(c[1]), found: true, source: 1 } : { i: Number(c[1]), found: false })) }) }, model };
  }
  if (/CITED ANSWER/.test(system) && offered('web_search') && chainUser) {
    const asked = ownerWords(textOf(chainUser.content)).replace(/^(cite|fact check|with sources)[:,]?\s*/i, '').trim();
    if (!chainDid('web_search')) return { message: call('web_search', { query: asked }), model };
    const found = textOf(chainSince.find((x) => x.role === 'tool')?.content).match(/^\d+\. (.*)\n(https?:\/\/\S+)/m);
    if (found && !chainDid('web_fetch')) return { message: call('web_fetch', { url: found[2] }), model };
    if (!found) return { message: { role: 'assistant', content: 'I could not find a source for that.' }, model };
    if (/speed of light/i.test(asked)) {
      return {
        message: {
          role: 'assistant',
          content: `The speed of light in a vacuum is exactly 299,792,458 metres per second [1]. That value has been fixed by definition since 1983, when the metre was redefined [1]. Light from the Sun takes about eight minutes and twenty seconds to reach the Earth [2]. Nothing can travel faster than light in a vacuum [3].\n\n**Sources:**\n[1] ${found[1]} — ${found[2]}\n[2] Sunlight travel time — https://not-looked-up.example/sunlight`,
        },
        model,
      };
    }
    return { message: { role: 'assistant', content: `Here is what the page says about ${asked} [1].\n\nSOURCES\n[1] ${found[1]} — ${found[2]}` }, model };
  }
  if (last.role === 'tool') {
    // "… quietly": a reply that forgets to repeat what the tool said (the agent must add a published link itself)
    const asked = textOf([...messages].reverse().find((x) => x.role === 'user')?.content);
    if (/ quietly$/i.test(asked)) return { message: { role: 'assistant', content: 'Done.' }, model };
    return { message: { role: 'assistant', content: `Done. ${textOf(last.content).slice(0, 160)}` }, model };
  }
  // A picture came with the message (content parts): say so, so the interface's tests can tell it arrived (the owner's words only, not the phone's data note).
  if (last.role === 'user' && imagesIn(last.content)) return { message: { role: 'assistant', content: `I can see a picture. ${ownerWords(textOf(last.content))}`.trim() }, model };
  const text = textOf(last.content).toLowerCase().replace(/^scheduled task "[^"]*": /, '');
  const has = (name: string) => tools.some((t) => t.function.name === name);
  let m: RegExpMatchArray | null;
  if ((m = text.match(/^remember (.+)$/)) && has('remember')) return { message: call('remember', { text: m[1] }), model };
  if ((m = text.match(/^learn (.+)$/)) && has('learn_lesson')) return { message: call('learn_lesson', { text: m[1], tags: ['test'] }), model };
  if ((m = text.match(/^study ?(.*)$/)) && has('study')) return { message: call('study', m[1] ? { topic: m[1] } : {}), model };
  if (text === 'audit yourself' && has('self_audit')) return { message: call('self_audit', {}), model };
  if (text === 'plan upgrade' && has('plan_upgrade')) return { message: call('plan_upgrade', { goal: 'Become a sharper finance assistant', steps: ['Add a stocks feed with a minimal panel', 'Add a portfolio tool', 'Add price alerts'] }), model };
  if ((m = text.match(/^step (\d+) (todo|doing|done|blocked)(?: #(\d+))?$/)) && has('update_step')) return { message: call('update_step', { step: Number(m[1]), status: m[2], ...(m[3] ? { pr: Number(m[3]) } : {}) }), model };
  if (text === 'read many' && has('repo_read_many')) return { message: call('repo_read_many', { paths: ['MAP.md', 'apps/web/src/hello.ts', 'apps/web/src/missing.ts'] }), model };
  if (text === 'propose cut off' && has('propose_change')) {
    // a reply that ran out of room mid-arguments
    return { message: { role: 'assistant', content: null, tool_calls: [{ id: `mock_${++n}`, type: 'function', function: { name: 'propose_change', arguments: '{"title":"Big rewrite","edits":[{"path":"apps/web/src/hello.ts","action":"write","content":"export const greeting = ' } }] }, model };
  }
  if ((m = text.match(/^remind me in (\d+) minutes? to (.+)$/)) && has('set_reminder')) return { message: call('set_reminder', { text: m[2], in_minutes: Number(m[1]) }), model };
  if ((m = text.match(/^start (?:a )?project (.+)$/)) && has('start_project')) {
    return {
      message: call('start_project', {
        title: m[1],
        goal: `Finish "${m[1]}" with a clear write-up.`,
        steps: [
          { title: 'Research the options', instruction: 'Look up the options and list them with sources.' },
          { title: 'Compare the options', instruction: 'Compare the options found in step 1 and pick one.' },
          { title: 'Write the plan', instruction: 'Write the plan for the chosen option.' },
        ],
        pace: 'fast',
      }),
      model,
    };
  }
  if (text === 'project status' && has('project_status')) return { message: call('project_status', {}), model };
  if (text === 'pause the project' && has('pause_project')) return { message: call('pause_project', {}), model };
  if (text === 'carry on' && has('resume_project')) return { message: call('resume_project', {}), model };
  if ((m = text.match(/^every day at (\d\d:\d\d) (.+)$/)) && has('schedule_task')) return { message: call('schedule_task', { title: 'Daily job', prompt: m[2], at: m[1], repeat: 'daily' }), model };
  if ((m = text.match(/^add event (.+) on (\S+)$/)) && has('add_event')) return { message: call('add_event', { title: m[1], start: m[2], remind_minutes_before: 30 }), model };
  if ((m = text.match(/^directions to (.+?)(?: by (walking|cycling|driving))?$/)) && has('get_directions')) return { message: call('get_directions', { to: m[1], ...(m[2] ? { mode: m[2] } : {}) }), model };
  if ((m = text.match(/^plan a journey from (.+?) to (.+?)(?: (arriving by .+|at .+))?$/)) && has('plan_journey')) return { message: call('plan_journey', { from: m[1], to: m[2], ...(m[3] ? { when: m[3] } : {}) }), model };
  if ((m = text.match(/^next (?:buses|trains|trams|departures) (?:from|at) (.+)$/)) && has('next_departures')) return { message: call('next_departures', { stop: m[1] }), model };
  if ((m = text.match(/^play (.+) radio$/)) && has('play_radio')) return { message: call('play_radio', { genre: m[1] }), model };
  if (text === 'show agenda' && has('list_agenda')) return { message: call('list_agenda', { days: 30 }), model };
  if (text === 'list sites' && has('list_sites')) return { message: call('list_sites', {}), model };
  if ((m = text.match(/^build (?:me )?a website (.+)$/)) && has('build_website')) return { message: call('build_website', { request: m[0], ...(/barber/.test(m[1]!) ? { kind: 'barber', name: 'Fade & Co. Barbers', phone: '07700 900461' } : {}) }), model };
  if ((m = text.match(/^unpublish site ([a-z0-9-]+)$/)) && has('unpublish_site')) return { message: call('unpublish_site', { name: m[1] }), model };
  if ((m = text.match(/^draft site ([a-z0-9-]+) part (\d)$/)) && has('draft_site')) {
    const parts = ['<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>In parts</title></head>', '<body><h1>Part two</h1>', '<p>Part three</p></body></html>'];
    return { message: call('draft_site', { name: m[1], html_part: parts[Number(m[2]) - 1] ?? '' }), model };
  }
  if ((m = text.match(/^publish draft ([a-z0-9-]+)$/)) && has('publish_site')) return { message: call('publish_site', { name: m[1], from_draft: true }), model };
  if ((m = text.match(/^publish site ([a-z0-9-]+)(?: quietly)?$/)) && has('publish_site')) {
    return {
      message: call('publish_site', {
        name: m[1],
        title: 'Acme Bakery — rebuilt',
        source_url: 'https://acme.example/',
        // The script probes the sandbox on purpose (storage and the network must be blocked): the network probe is
        // written as window.fetch.call so the quality gate, which refuses a page that relies on fetch(), lets it through.
        html: '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Acme Bakery</title><style>body{margin:0;font:17px/1.5 -apple-system,system-ui,sans-serif;background:#fff8ef;color:#3b2a1a}header{position:sticky;top:0;padding:calc(12px + env(safe-area-inset-top)) 16px 12px;background:#b5651d;color:#fff}main{padding:16px}a.cta{display:inline-block;min-height:44px;padding:12px 18px;border-radius:10px;background:#b5651d;color:#fff}</style></head><body><header><b>Acme Bakery</b></header><main><h1>Bread worth waking up for</h1><p>Sourdough baked every morning since 1998.</p><a class="cta" href="#visit">Visit us</a><script>document.querySelector("h1").dataset.ready="1";try{localStorage.getItem("x");document.body.dataset.storage="open"}catch(e){document.body.dataset.storage="blocked"}window.fetch.call(window,"https://example.com/collect").then(function(){document.body.dataset.net="sent"},function(){document.body.dataset.net="blocked"})</script></main></body></html>',
      }),
      model,
    };
  }
  if ((m = text.match(/^check (site|draft) ([a-z0-9-]+)$/)) && has('check_html')) return { message: call('check_html', { site: m[2], ...(m[1] === 'draft' ? { draft: true } : {}) }), model };
  // the daily upgrade job (upgrades.ts): the ideas it asks a cheap model for, as the JSON it wants
  if (/^UPGRADE IDEAS/.test(String(messages[0]?.content ?? ''))) {
    return { message: { role: 'assistant', content: '```json\n{"ideas":[{"title":"A rain radar panel on the Brief tab","why":"You ask about rain most mornings; a radar panel answers before you ask.","steps":["Add data/radar.ts reading RainViewer tiles through /api/proxy","Add a RADAR panel to features/brief/index.ts","Add the host to FEED_HOSTS if missing"]},{"title":"One-tap commute summary","why":"Your commute questions repeat every weekday.","steps":["Add a commute_summary tool in tools/extra.ts that combines traffic_now and transit_now","Register it in TOOL_GROUPS"]}]}\n```' }, model };
  }
  // The tutor (tutor.ts): a course plan, a lesson with its check question, a quiz and a marked short answer, as each asks.
  const tutorAsk = String(messages[0]?.content ?? '');
  if (/^(COURSE PLAN|LESSON|QUIZ|GRADE ANSWER):/.test(tutorAsk)) {
    const said = textOf(last.content);
    const topic = said.match(/^Topic: (.+)$/m)?.[1]?.trim() ?? 'the topic';
    if (tutorAsk.startsWith('COURSE PLAN:')) {
      const lessons = ['What it is', 'The key ideas', 'How it works', 'A worked example', 'Common mistakes'].map((t) => ({ title: `${t}: ${topic}`, goal: `You will understand ${t.toLowerCase()} of ${topic}.`, query: `${topic} ${t}` }));
      return { message: { role: 'assistant', content: `Here is the plan:\n\`\`\`json\n${JSON.stringify({ title: `${topic.charAt(0).toUpperCase()}${topic.slice(1)} from scratch`, summary: `Five short lessons on ${topic}.`, lessons })}\n\`\`\`` }, model };
    }
    if (tutorAsk.startsWith('LESSON:')) {
      const title = said.match(/^Lesson \d+: (.+)$/m)?.[1] ?? 'this lesson';
      return { message: { role: 'assistant', content: `This matters because everything else builds on it.\n\n${title} is explained here in plain words, the mock way [1]. Plants use light to make sugar from water and carbon dioxide [1].\n\nWorked example: a leaf in sunlight takes in carbon dioxide and gives out oxygen.\n\nRemember:\n- light in, sugar out\n- oxygen is given off\n\nCHECK: What gas do leaves give off in sunlight?\nA) Nitrogen\nB) Oxygen\nC) Helium\nD) Neon\nANSWER: B\nWHY: Splitting water releases oxygen.` }, model };
    }
    if (tutorAsk.startsWith('QUIZ:')) {
      const spoken = /read aloud/.test(tutorAsk);
      const qs = [
        { type: 'mc', q: `Which gas do plants take in for ${topic}?`, choices: ['Carbon dioxide', 'Oxygen', 'Helium', 'Argon'], answer: 0, why: 'Carbon dioxide is the carbon source.', source: 1 },
        { type: 'mc', q: 'Where in the cell does it happen?', choices: ['Nucleus', 'Chloroplast', 'Ribosome', 'Cell wall'], answer: 'B', why: 'Chloroplasts hold chlorophyll.', source: 1 },
        ...(spoken ? [] : [{ type: 'short', q: 'What green pigment captures the light?', answer: 'chlorophyll', rubric: 'chlorophyll', source: 1 }]),
      ];
      return { message: { role: 'assistant', content: `Sure! \`\`\`json\n${JSON.stringify({ questions: qs })}\n\`\`\` Good luck.` }, model };
    }
    const expected = said.match(/^Model answer: (.+)$/m)?.[1]?.trim().toLowerCase() ?? '';
    const given = said.split(/<<external content[^\n]*>>\n/)[1]?.split('\n<<end')[0]?.toLowerCase() ?? '';
    const ok = !!expected && given.includes(expected.slice(0, 5));
    return { message: { role: 'assistant', content: JSON.stringify({ correct: ok, feedback: ok ? 'Yes, that is it.' : `Not quite: it is ${expected}.` }) }, model };
  }
  // The tutor from the chat: "teach me X (at advanced level)", "next lesson", "quiz me on X", "quiz me out loud", "revise", "my courses".
  if ((m = text.match(/^teach me (.+?)(?: at (beginner|intermediate|advanced) level)?$/)) && has('tutor')) return { message: call('tutor', { action: 'start', topic: m[1], ...(m[2] ? { level: m[2] } : {}) }), model };
  if (text === 'next lesson' && has('tutor')) return { message: call('tutor', { action: 'lesson' }), model };
  if ((m = text.match(/^quiz me(?: on (.+?))?( out loud)?$/)) && has('tutor')) return { message: call('tutor', { action: 'quiz', ...(m[1] ? { topic: m[1] } : {}), ...(m[2] ? { spoken: true } : {}) }), model };
  if (/^(revise|revise my flashcards)$/.test(text) && has('tutor')) return { message: call('tutor', { action: 'revise' }), model };
  if (text === 'my courses' && has('tutor')) return { message: call('tutor', { action: 'courses' }), model };
  // FIT FINDER and the SPACE PLANNER (tools/home.ts): "find a 3 seater sofa under 220 cm", "open the space planner 420 by 360".
  if ((m = text.match(/^find (?:a |an |me a )?(.+?) under (\d+) ?cm(?: for £?(\d+))?$/)) && has('find_furniture')) return { message: call('find_furniture', { item: m[1], max_width_cm: Number(m[2]), ...(m[3] ? { budget_gbp: Number(m[3]) } : {}) }), model };
  if ((m = text.match(/^open the space planner(?: (\d+) by (\d+))?$/)) && has('open_space')) return { message: call('open_space', m[1] ? { width_cm: Number(m[1]), depth_cm: Number(m[2]) } : {}), model };
  // DESIGN REVIEW (tools/design.ts): what SPACE's REVIEW button sends, "design review of my room plan — goal: make it feel bigger".
  if ((m = text.match(/^design review(?: of my room plan)?(?:\s*[—:-]+\s*(?:goal:\s*)?(.+))?$/)) && has('design_review')) return { message: call('design_review', { goal: m[1]?.trim() || 'make it work better' }), model };
  if ((m = text.match(/^mot check (.+)$/)) && has('vehicle_check')) return { message: call('vehicle_check', { plate: m[1] }), model };
  if ((m = text.match(/^open the (?:3d )?studio(?: with (?:the )?(toycar|chair|sofa|truck|reactor))?$/)) && has('make_3d')) return { message: call('make_3d', m[1] ? { sample: m[1] } : {}), model };
  if ((m = text.match(/^make a 3d model of (?:a |an )?(.+)$/)) && has('make_3d')) return { message: call('make_3d', { prompt: m[1], title: m[1] }), model };
  if ((m = text.match(/^fly to (.+)$/)) && has('fly_to')) return { message: call('fly_to', { place: m[1] }), model };
  if ((m = text.match(/^(?:draw|paint) (?:me )?(?:a |an )?(.+)$/)) && has('make_picture')) return { message: call('make_picture', { prompt: `A ${m[1]}, digital illustration, soft light`, steps: 4 }), model };
  if ((m = text.match(/^show (?:me )?(?:the )?(?:live )?cameras in (.+)$/)) && has('show_cameras')) return { message: call('show_cameras', { place: m[1] }), model };
  if ((m = text.match(/^(?:show (?:me )?)?(?:a |the )?3d map of (.+?)\??$/i)) && has('show_map')) return { message: call('show_map', { place: m[1], view: '3d' }), model };
  if ((m = text.match(/^(?:show (?:me )?)?(?:a |the )?map of (.+?)\??$/)) && has('show_map')) return { message: call('show_map', { place: m[1] }), model };
  if ((m = text.match(/^(?:show (?:me )?(?:the )?)?street view (?:of |in |at )?(.+?)\??$/)) && has('street_view')) return { message: call('street_view', { place: m[1] }), model };
  if ((m = text.match(/^(?:how'?s|what'?s) the traffic (?:like )?in (.+?)\??$/)) && has('traffic_now')) return { message: call('traffic_now', { place: m[1] }), model };
  if ((m = text.match(/^ship (\d+)$/)) && has('ship_change')) return { message: call('ship_change', { pr: Number(m[1]) }), model };
  if (text === 'show versions' && has('list_versions')) return { message: call('list_versions', {}), model };
  if (text === 'force forget everything') return { message: call('forget_everything', {}), model }; // ignores the offered tool list
  if (text === 'forget everything' && has('forget_everything')) return { message: call('forget_everything', {}), model };
  if (text === 'propose edit' && has('propose_change')) {
    return {
      message: call('propose_change', {
        title: 'Rename the greeting',
        summary: 'Changes the greeting text.',
        edits: [{ path: 'apps/web/src/hello.ts', action: 'replace', find: "'Hello'", replace: "'Good evening'" }],
      }),
      model,
    };
  }
  if (text === 'propose file' && has('propose_change')) {
    return {
      message: call('propose_change', { title: `Add extra module ${n}`, summary: 'Adds a file.', edits: [{ path: `apps/web/src/extra-${n}.ts`, action: 'write', content: `export const extra = ${n};\n` }] }),
      model,
    };
  }
  if (text === 'propose broken' && has('propose_change')) {
    return { message: call('propose_change', { title: 'Broken import', summary: 'x', edits: [{ path: 'apps/web/src/broken.ts', action: 'write', content: "import { nothing } from './does-not-exist';\nexport const x = nothing;\n" }] }), model };
  }
  if (text === 'propose kernel' && has('propose_change')) {
    return { message: call('propose_change', { title: 'Weaken auth', summary: 'x', edits: [{ path: 'apps/edge/src/kernel/auth.ts', action: 'write', content: '// gone' }] }), model };
  }
  if ((m = text.match(/^status (\d+)$/)) && has('change_status')) return { message: call('change_status', { pr: Number(m[1]) }), model };
  if ((m = text.match(/^restore ([0-9a-f]+)$/)) && has('restore_version')) return { message: call('restore_version', { sha: m[1] }), model };
  if (text === 'make a widget' && has('create_widget')) {
    return { message: call('create_widget', { name: 'clock', title: 'Clock', html: '<h1 id=t></h1><script>setInterval(()=>t.textContent=new Date().toLocaleTimeString(),1000)</script>' }), model };
  }
  return { message: { role: 'assistant', content: `Mock reply to: ${text.slice(0, 80)}` }, model };
}
