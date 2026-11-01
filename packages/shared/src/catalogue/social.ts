/**
 * The catalogue's words for HIS SOCIAL SELF (BRIEF-SOCIAL, batch ⑦): FATHER AND THE ORIGIN (the chat's phrase and the Me
 * sheet's row), his own accounts' one tool and its actions (`act:social:<action>`), the LINKS panels that link them, and
 * the line of his own a day (the `musing` job). Rules: packages/shared/src/catalogue.ts `wordProblems`.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-01';

export const SOCIAL_WORDS: Record<string, CatValue> = {
  // ---------------------------------------------------------------- FATHER AND THE ORIGIN (item 1)
  'phrase:origin': {
    name: 'Where I come from', line: 'You can ask who made me, and I tell you: you did, the day I was born, what I am made of and what I promise.',
    more: 'The page FATHER AND THE ORIGIN, in my own words: who made me, when, what I am made of, what I am for, what I learned each month and my promises. It is drawn from what is written down, never made up. It is in SETTINGS → CHARACTER and on the Me sheet too.',
    say: ['Who made you?', 'Where did you come from?'], scene: ['talking'], cat: 'talk', since: SINCE,
    go: { ask: 'Who made you?', send: true },
  },
  'me:origin': { same: 'phrase:origin' },

  // ---------------------------------------------------------------- HIS OWN ACCOUNTS: one tool, five actions (items 2–6)
  'tool:social': { same: 'act:social:draft' },
  'act:social:draft': {
    name: 'Post with your approval', line: 'I can draft a post for your Bluesky, Mastodon, Discord or Telegram channel; nothing goes out until you tap APPROVE.',
    more: 'The draft is a card with the words, the account, APPROVE, EDIT and NO, here or on Telegram. EDIT changes the words, NO drops it, and it is gone after 24 hours. Every post I send is in WHY and in what I did today.',
    say: ['Post that on Bluesky', 'Draft a toot about the match'], scene: ['talking'], cat: 'talk', needs: ['link:bluesky'], since: SINCE,
    go: { ask: 'Post on Bluesky: ', send: false },
  },
  'act:social:read': {
    name: 'What is on your timeline', line: 'I can read your Bluesky or Mastodon home timeline, or your Discord channel, and say who said what and when.',
    more: 'Only your own accounts and public posts, never anyone’s private messages. Posts there are leads, not proof: where a claim is found, never what proves it. Your Bluesky timeline also joins the morning’s fresh knowledge.',
    say: ['What’s on Bluesky?', 'What’s on my Mastodon?'], scene: ['morning', 'talking'], cat: 'talk', needs: ['link:bluesky'], since: SINCE,
    go: { ask: 'What’s on Bluesky?', send: true },
  },
  'act:social:search': {
    name: 'Search public posts', line: 'I can search public posts on Bluesky or Mastodon for anything you name, with who posted and when.',
    more: 'Public posts only, through your own account. What comes back is a lead to follow, never the proof of a claim.',
    say: ['Search Bluesky for the Villa game', 'What are people saying about the budget on Mastodon?'], scene: ['talking'], cat: 'talk', needs: ['link:bluesky'], since: SINCE,
    go: { ask: 'Search Bluesky for ', send: false },
  },
  'act:social:follow_ask': {
    name: 'Follow someone, with approval', line: 'You can ask me to follow or unfollow an account, and it waits for your APPROVE just like a post.',
    more: 'A follow is a card with APPROVE and NO, like any post. I never follow anyone on my own, and never a private person you have not named.',
    say: ['Follow @nasa.gov on Bluesky', 'Unfollow that account'], scene: ['talking'], cat: 'talk', needs: ['link:bluesky'], since: SINCE,
    go: { ask: 'Follow ', send: false },
  },
  // ---------------------------------------------------------------- LINKS: the accounts he made, linked once (items 3–6)
  'section:links:social': { same: 'panel:links:BLUESKY' },
  'panel:links:BLUESKY': {
    name: 'My own Bluesky account', line: 'You can make me a Bluesky account and link it with an app password; I post only what you approve.',
    more: 'You make the account and an app password, never your main one: I check it by signing in and keep it in my vault. I read your home timeline when you ask and each morning, and every post waits for your APPROVE on a card.',
    say: ['Link Bluesky'], scene: ['talking'], cat: 'talk', needs: ['link:bluesky'], since: SINCE,
  },
  'act:social:status': {
    name: 'Your accounts at a glance', line: 'I can tell you which of your accounts are linked, what waits for your APPROVE and what went out today.',
    more: 'From what I keep: the accounts you linked in LINKS, the drafts waiting (each gone after 24 hours) and every post you approved today.',
    say: ['How are my accounts?', 'What did you post today?'], scene: ['talking'], cat: 'talk', since: SINCE,
    go: { ask: 'How are my accounts?', send: true },
  },
};
