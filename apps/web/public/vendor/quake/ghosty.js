// ghosty.js: Ghosty's platform layer for WebQuake, in place of its Sys.js. GPL-2, as WebQuake (LICENCE).
//
// build.sh puts this last inside quake.js's one function, after WebQuake's own scripts, so `host` is that function's
// argument (given by apps/web/src/arcade/engines/quake.ts) and every name below is that function's own: each start
// is a fresh Quake and nothing is left on the page. What WebQuake reads of the browser is answered here: the canvas
// the arcade gave it, at its own size and a pixel ratio the page caps; the GLSL shaders index.htm carried; the game's
// files in memory (patches/memory-files.diff); saved games and settings through a stand-in for localStorage that the
// page keeps in the arcade's SaveStore; nothing from the network. The page drives Quake one frame at a time and reads
// back what it needs (the menu, the level, the tally, the player) through the small API returned at the end.

var QUIT = { ghostyQuit: true };
var canvas = host.canvas;

window = {
	console: console,
	get devicePixelRatio() { return host.ratio(); }
};

// The arcade's canvas, with WebGL asked for the way a phone draws fastest; the engine may not restyle it.
var unstyled = {};
var mainwindow = new Proxy(canvas, {
	get: function (t, k)
	{
		if (k === 'style')
			return unstyled;
		if (k === 'getContext')
			return function (type, attrs)
			{
				return t.getContext(type, Object.assign({alpha: false, antialias: false, depth: true, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance'}, attrs));
			};
		var v = t[k];
		return (typeof v === 'function') ? v.bind(t) : v;
	},
	set: function (t, k, v)
	{
		if (k !== 'style')
			t[k] = v;
		return true;
	}
});

document = {
	location: {protocol: 'https:', search: '', href: 'https://ghosty.invalid/quake'},
	body: {style: {}},
	documentElement: {
		get clientWidth() { return canvas.clientWidth || canvas.width; },
		get clientHeight() { return canvas.clientHeight || canvas.height; }
	},
	createElement: function (tag) { return host.document.createElement(tag); },
	getElementById: function (id)
	{
		if (id === 'mainwindow')
			return mainwindow;
		if (SHADERS[id] != null)
			return {text: SHADERS[id]};
		return {style: {}, src: ''}; // the start page's progress line, loading picture and end screens: not shown
	}
};

// Saved games ('Quake.id1/s0.sav') and settings ('Quake.id1/config.cfg'), as text, kept by the page.
localStorage = {
	getItem: function (k) { return host.saves.has(k) ? host.saves.get(k) : null; },
	setItem: function (k, v) { v = String(v); host.saves.set(k, v); host.kept(k, v); },
	removeItem: function (k) { host.saves.delete(k); host.kept(k, null); }
};

// Nothing goes to the network: the CD music check finds no tracks, the remote console goes nowhere.
XMLHttpRequest = function () { this.status = 404; this.responseText = ''; };
XMLHttpRequest.prototype.open = function () {};
XMLHttpRequest.prototype.send = function () {};
XMLHttpRequest.prototype.setRequestHeader = function () {};
XMLHttpRequest.prototype.overrideMimeType = function () {};
Audio = function () { this.paused = true; };
Audio.prototype.play = function () {};
Audio.prototype.pause = function () {};
Audio.prototype.cloneNode = function () { return new Audio(); };
alert = function (text) { host.print(String(text) + '\n'); };
confirm = function () { return true; };
open = function () { return null; };

Sys = {};

Sys.files = host.files;
Sys.audio = host.audio;
Sys.audioOut = host.audioOut;
Sys.WavBuffer = host.wavBuffer;

Sys.Quit = function()
{
	if ((Host.initialized === true) && (Host.isdown !== true))
		Host.Shutdown();
	host.quit();
	throw QUIT;
};

Sys.Print = function(text)
{
	host.print(text);
};

Sys.Error = function(text)
{
	if ((Host.initialized === true) && (Host.isdown !== true))
	{
		try { Host.Shutdown(); } catch (e) {}
	}
	host.error(text);
	throw new Error(text);
};

// Seconds of play, on the page's clock (it stands still while the game is paused).
Sys.FloatTime = function()
{
	return host.clock();
};

// IN.Move (patches/intent-input.diff): the page turns the view and moves the player by the arcade's Intent.
Sys.Move = function(cmd, angles)
{
	host.move(cmd, angles);
	V.StopPitchDrift();
};

// A hit: the server told the client about damage (the screen's red flash).
var parseDamage = V.ParseDamage;
V.ParseDamage = function()
{
	parseDamage();
	host.hit();
};

// Each sound effect started, counted for the page.
var startSound = S.StartSound;
S.StartSound = function(entnum, entchannel, sfx, origin, vol, attenuation)
{
	startSound(entnum, entchannel, sfx, origin, vol, attenuation);
	if ((S.nosound.value === 0) && (sfx != null))
		host.sound();
};

return {
	QUIT: QUIT,
	keys: Key.k,
	start: function (argv)
	{
		Q.isNaN = Number.isNaN;
		COM.InitArgv(argv);
		Host.Init();
	},
	frame: function ()
	{
		Host.Frame();
	},
	key: function (k, down)
	{
		Key.Event(k, down === true);
	},
	command: function (text)
	{
		Cmd.ExecuteString(text);
	},
	shutdown: function ()
	{
		if ((Host.initialized === true) && (Host.isdown !== true))
			Host.Shutdown();
	},
	state: function ()
	{
		var s = CL.state, st = s.stats || [], me = CL.entities[s.viewentity];
		return {
			dest: Key.dest.value === Key.dest.game ? 'game' : Key.dest.value === Key.dest.menu ? 'menu' : Key.dest.value === Key.dest.console ? 'console' : 'message',
			ask: (Key.dest.value === Key.dest.menu) && (M.state.value === M.state.quit), // "quit? y/n"
			demo: CL.cls.demoplayback === true,
			playing: (CL.cls.state === CL.active.connected) && (CL.cls.signon === 4) && (CL.cls.demoplayback !== true),
			intermission: s.intermission | 0,
			map: (s.worldmodel != null) ? s.worldmodel.name.replace(/^maps\//, '').replace(/\.bsp$/, '') : null,
			levelname: s.levelname || '',
			time: s.time || 0,
			completed: s.completed_time || 0,
			kills: st[Def.stat.monsters] | 0,
			totalKills: st[Def.stat.totalmonsters] | 0,
			secrets: st[Def.stat.secrets] | 0,
			totalSecrets: st[Def.stat.totalsecrets] | 0,
			health: st[Def.stat.health] | 0,
			pos: (me != null && me.origin != null) ? [me.origin[0], me.origin[1], me.origin[2]] : null,
			yaw: s.viewangles[1],
			pitch: s.viewangles[0]
		};
	}
};
