/** The pantry's and the recipe book's words (features/kitchen/larder.ts), pure so the chat's tables can read them. */
export const LARDER_ADD = /^(?:add|put) (.+?) (?:to|in|into) (?:the |my )?(pantry|fridge|freezer|cupboard)$/i;
export const LARDER_LIST = /^(?:what'?s|what is) in (?:the |my )?(pantry|fridge|freezer|cupboard)\??$|^(?:open|show(?: me)?) (?:the |my )?(pantry|recipes|recipe book)$/i;
/** "add milk to the pantry", "put chicken in the freezer", "what's in my fridge?", "open my recipes". */
export const larderAsked = (t: string): boolean => LARDER_ADD.test(t.trim().replace(/[.!]+$/, '')) || LARDER_LIST.test(t.trim().replace(/’/g, "'"));
