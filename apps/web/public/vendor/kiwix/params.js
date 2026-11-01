// Ghosty's own (not from kiwix-js): Kiwix's reader keeps its decoders' status on a page-wide `params` object made in
// kiwix-js www/js/init.js. Ghosty has no such global, so this module is that object, for these files only.
export default {
    decompressorAPI: {
        assemblerMachineType: null,
        decompressorLastUsed: null,
        errorStatus: null
    }
};
