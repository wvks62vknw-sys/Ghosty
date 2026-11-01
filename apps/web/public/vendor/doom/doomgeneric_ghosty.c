// doomgeneric_ghosty.c: Ghosty's platform layer for doomgeneric. GPL-2, as doomgeneric (LICENCE).
//
// The engine draws its own 320x200 frame; this hands each one to the page (apps/web/src/arcade/engines/doom.ts),
// which scales it pixel-sharp onto the arcade's canvas. The page feeds input the arcade's way, once a tic: key downs and
// ups (fire, use, weapon, map, run and the menu keys), turning as mouse motion, and the stick's own amount as analog
// movement (patches/analog-movement.diff). Sound effects are the WAD's own DMX sounds, played by the page through
// WebAudio on DOOM's eight channels; music is not played (SOURCE.md says why). Time is the page's clock, which stands
// still while the game is paused. Built by build.sh.

#include <stdint.h>
#include <string.h>
#include <emscripten.h>

#include "doomgeneric.h"
#include "doomkeys.h"
#include "doomstat.h"
#include "d_event.h"
#include "d_loop.h"
#include "d_player.h"
#include "deh_str.h"
#include "i_sound.h"
#include "i_system.h"
#include "m_config.h"
#include "m_controls.h"
#include "m_misc.h"
#include "w_wad.h"
#include "z_zone.h"

extern int dg_analog_forward, dg_analog_side; // g_game.c, patched
extern wbstartstruct_t wminfo;                 // g_game.c
extern int messageToPrint;                     // m_menu.c
extern boolean messageNeedsInput;

#define W DOOMGENERIC_RESX
#define H DOOMGENERIC_RESY

// ---- the page's side (Module.ghosty, set by doom.ts before the engine starts) ----

EM_JS(void, js_frame, (const uint8_t *px, int w, int h), { Module.ghosty.frame(HEAPU8.subarray(px, px + w * h * 4), w, h); });
EM_JS(double, js_clock, (void), { return Module.ghosty.clock(); });
EM_JS(void, js_sleep, (int ms), { Module.ghosty.sleep(ms); });
EM_JS(void, js_quit, (void), { Module.ghosty.quit(); });
EM_JS(int, js_sfx_known, (int id), { return Module.ghosty.sfxKnown(id) ? 1 : 0; });
EM_JS(void, js_sfx_start, (int ch, int id, const uint8_t *pcm, int len, int rate, int vol, int sep),
      { Module.ghosty.sfxStart(ch, id, len > 0 ? HEAPU8.subarray(pcm, pcm + len) : null, rate, vol, sep); });
EM_JS(void, js_sfx_params, (int ch, int vol, int sep), { Module.ghosty.sfxParams(ch, vol, sep); });
EM_JS(void, js_sfx_stop, (int ch), { Module.ghosty.sfxStop(ch); });
EM_JS(int, js_sfx_playing, (int ch), { return Module.ghosty.sfxPlaying(ch) ? 1 : 0; });

// ---- video ----

static uint32_t rgba[W * H];

void DG_DrawFrame(void)
{
    // The engine's pixels are 0x00RRGGBB; a canvas takes R, G, B, A bytes.
    const uint32_t *in = (const uint32_t *) DG_ScreenBuffer;
    int i;

    for (i = 0; i < W * H; ++i)
    {
        uint32_t p = in[i];
        rgba[i] = 0xff000000u | ((p & 0xffu) << 16) | (p & 0xff00u) | ((p >> 16) & 0xffu);
    }
    js_frame((const uint8_t *) rgba, W, H);
}

void DG_SetWindowTitle(const char *title)
{
}

// ---- time ----

uint32_t DG_GetTicksMs(void)
{
    return (uint32_t) js_clock();
}

// A page cannot sleep: the engine's few waiting loops move the page's clock on instead, so they always end.
void DG_SleepMs(uint32_t ms)
{
    js_sleep((int) ms);
}

// ---- input ----

#define KEYQ 64
static uint16_t keyq[KEYQ];
static unsigned int keyr, keyw;

EMSCRIPTEN_KEEPALIVE void dg_key(int pressed, int key)
{
    unsigned int next = (keyw + 1) % KEYQ;

    if (next == keyr)
        return; // full: drop it rather than overwrite one not read yet
    keyq[keyw] = (uint16_t) ((pressed ? 0x100 : 0) | (key & 0xff));
    keyw = next;
}

int DG_GetKey(int *pressed, unsigned char *key)
{
    uint16_t d;

    if (keyr == keyw)
        return 0;
    d = keyq[keyr];
    keyr = (keyr + 1) % KEYQ;
    *pressed = d >> 8;
    *key = (unsigned char) (d & 0xff);
    return 1;
}

// This tic's analog movement (forwardmove and sidemove units) and turn (mouse units, + right).
EMSCRIPTEN_KEEPALIVE void dg_input(int forward, int side, int turn)
{
    dg_analog_forward = forward;
    dg_analog_side = side;
    if (turn != 0)
    {
        event_t ev;

        memset(&ev, 0, sizeof(ev));
        ev.type = ev_mouse;
        ev.data2 = turn;
        D_PostEvent(&ev);
    }
}

EMSCRIPTEN_KEEPALIVE void dg_tick(void)
{
    doomgeneric_Tick();
}

// What the page reads after a tic: the screen it is on, the player and, during an intermission, the level's tally.
EMSCRIPTEN_KEEPALIVE int *dg_state(void)
{
    static int s[24];
    player_t *p = &players[consoleplayer];
    wbplayerstruct_t *me = &wminfo.plyr[consoleplayer];

    s[0] = gamestate;
    s[1] = menuactive;
    s[2] = messageToPrint && messageNeedsInput;
    s[3] = p->damagecount;
    s[4] = p->health;
    s[5] = p->mo ? p->mo->x : 0;
    s[6] = p->mo ? p->mo->y : 0;
    s[7] = p->mo ? (int) (p->mo->angle >> 16) : 0;
    s[8] = gameepisode;
    s[9] = gamemap;
    s[10] = gamemode == commercial;
    s[11] = demoplayback;
    s[12] = paused;
    s[13] = gametic;
    s[14] = wminfo.epsd;
    s[15] = wminfo.last;
    s[16] = wminfo.maxkills;
    s[17] = wminfo.maxitems;
    s[18] = wminfo.maxsecret;
    s[19] = me->skills;
    s[20] = me->sitems;
    s[21] = me->ssecret;
    s[22] = me->stime;
    s[23] = wminfo.partime;
    return s;
}

// The menu's settings, written now (the page keeps them with the saved games).
EMSCRIPTEN_KEEPALIVE void dg_save_config(void)
{
    M_SaveDefaults();
}

static void bind_keys(void)
{
    // The previous and next weapon keys have no default in the original; the arcade's WEAPON buttons use these.
    key_nextweapon = ']';
    key_prevweapon = '[';
}

static void quit_now(void)
{
    js_quit();
}

void DG_Init(void)
{
    bind_keys();
    // Run last on QUIT GAME (after the engine's own exit work, which writes the settings), never on an error.
    I_AtExit(quit_now, false);
}

// ---- sound effects ----

// Settings the SDL sound module owns, which i_sound.c lists among the saved settings (unused here).
int use_libsamplerate = 0;
float libsamplerate_scale = 0.65f;

static boolean sfx_prefix;
static snddevice_t sfx_devices[] = {
    SNDDEVICE_SB, SNDDEVICE_PAS, SNDDEVICE_GUS, SNDDEVICE_WAVEBLASTER, SNDDEVICE_SOUNDCANVAS, SNDDEVICE_AWE32,
};

static boolean Snd_Init(boolean use_sfx_prefix)
{
    sfx_prefix = use_sfx_prefix;
    return true;
}

static void Snd_Shutdown(void)
{
}

static int Snd_GetSfxLumpNum(sfxinfo_t *sfx)
{
    char name[9];

    if (sfx->link != NULL)
        sfx = sfx->link;
    if (sfx_prefix)
        M_snprintf(name, sizeof(name), "ds%s", DEH_String(sfx->name));
    else
        M_StringCopy(name, DEH_String(sfx->name), sizeof(name));
    return W_CheckNumForName(name); // -1 when the WAD has no such sound: it is then not played
}

static void Snd_Update(void)
{
}

static void Snd_UpdateSoundParams(int channel, int vol, int sep)
{
    js_sfx_params(channel, vol, sep);
}

// A DMX sound lump: format 3, the rate, the sample count, then 8-bit unsigned samples with 16 bytes of padding at
// each end.
static int Snd_StartSound(sfxinfo_t *sfx, int channel, int vol, int sep)
{
    int lump = sfx->lumpnum;
    const uint8_t *data;
    int len, rate;
    uint32_t n;

    if (lump < 0)
        return -1;
    if (js_sfx_known(lump))
    {
        js_sfx_start(channel, lump, NULL, 0, 0, vol, sep);
        return channel;
    }
    len = W_LumpLength(lump);
    if (len < 8)
        return -1;
    data = W_CacheLumpNum(lump, PU_STATIC);
    if (data[0] != 3 || data[1] != 0)
    {
        W_ReleaseLumpNum(lump);
        return -1;
    }
    rate = data[2] | (data[3] << 8);
    n = (uint32_t) data[4] | ((uint32_t) data[5] << 8) | ((uint32_t) data[6] << 16) | ((uint32_t) data[7] << 24);
    if (n > (uint32_t) (len - 8))
        n = (uint32_t) (len - 8);
    if (n > 32)
        js_sfx_start(channel, lump, data + 8 + 16, (int) n - 32, rate, vol, sep);
    else
        js_sfx_start(channel, lump, data + 8, (int) n, rate, vol, sep);
    W_ReleaseLumpNum(lump);
    return channel;
}

static void Snd_StopSound(int channel)
{
    js_sfx_stop(channel);
}

static boolean Snd_SoundIsPlaying(int channel)
{
    return js_sfx_playing(channel) != 0;
}

static void Snd_CacheSounds(sfxinfo_t *sounds, int num_sounds)
{
}

sound_module_t DG_sound_module = {
    sfx_devices,
    arrlen(sfx_devices),
    Snd_Init,
    Snd_Shutdown,
    Snd_GetSfxLumpNum,
    Snd_Update,
    Snd_UpdateSoundParams,
    Snd_StartSound,
    Snd_StopSound,
    Snd_SoundIsPlaying,
    Snd_CacheSounds,
};

// ---- music: none in this build (the page starts the engine with -nomusic) ----

static boolean Mus_Init(void) { return false; }
static void Mus_Shutdown(void) {}
static void Mus_SetMusicVolume(int volume) {}
static void Mus_PauseMusic(void) {}
static void Mus_ResumeMusic(void) {}
static void *Mus_RegisterSong(void *data, int len) { return NULL; }
static void Mus_UnRegisterSong(void *handle) {}
static void Mus_PlaySong(void *handle, boolean looping) {}
static void Mus_StopSong(void) {}
static boolean Mus_MusicIsPlaying(void) { return false; }

music_module_t DG_music_module = {
    NULL,
    0,
    Mus_Init,
    Mus_Shutdown,
    Mus_SetMusicVolume,
    Mus_PauseMusic,
    Mus_ResumeMusic,
    Mus_RegisterSong,
    Mus_UnRegisterSong,
    Mus_PlaySong,
    Mus_StopSong,
    Mus_MusicIsPlaying,
    NULL,
};

// The page's start: the command line (kept for the whole game, as the engine keeps pointers into it), then the engine
// loads the WAD, sets everything up and draws its first frame.
EMSCRIPTEN_KEEPALIVE void dg_create(int argc, char **argv)
{
    doomgeneric_Create(argc, argv);
    bind_keys(); // again, over any older settings file
}
