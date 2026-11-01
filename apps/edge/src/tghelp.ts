/**
 * What he can do on Telegram, as /start lists it (telegram.ts builds its help and reads its commands from these). A list of
 * its own, so the ABILITIES catalogue reads it too (abilities.ts; packages/shared/src/catalogue): a thing added here is said
 * in the help and listed on the ABILITIES screen by itself.
 */
export const TELEGRAM_CAN = [
  { id: 'ask', what: 'ask me anything, by text or a voice note' },
  { id: 'photo', what: 'send a photo with a question' },
  { id: 'forward', what: 'forward me a message with a link in it, and I check it for a scam' },
  { id: 'notices', what: 'get my reminders and the results of tasks I ran for you' },
] as const;

/** The commands, as the hook reads them and /start lists them (`start` is the help itself). */
export const TELEGRAM_COMMANDS = [
  { cmd: 'start', what: 'this help' },
  { cmd: 'status', what: 'what is ready' },
  { cmd: 'stop', what: 'stop what I am doing' },
  { cmd: 'unpair', what: 'forget this chat' },
] as const;
