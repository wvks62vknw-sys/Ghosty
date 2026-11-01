/* quake.js: WebQuake (https://github.com/Triang3l/webquake at 917617ffdfe42fa9dca41bf1762f16a2e71f2d7b, GPL-2: LICENCE)
   for Ghosty's arcade: its client's scripts with the patches in patches/ and Ghosty's platform file ghosty.js in
   place of Sys.js, written by build.sh (bundle.mjs). Do not edit; rebuild. See SOURCE.md. */
self.GhostyQuake = function (host) {
var window, document, localStorage, XMLHttpRequest, Audio, alert, confirm, open;
var CDAudio, CL, COM, CRC, Chase, Cmd, Con, Cvar, Def, Draw, ED, GL, Host, IN, Key, Loop, M, MSG, Mod, NET, PF, PR, Protocol, Q, R, S, SCR, SV, SZ, Sbar, Sys, V, VID, Vec, W, WEBS, gl;
var SHADERS = {"vshAlias":"\nuniform vec3 uOrigin;\nuniform mat3 uAngles;\nuniform vec3 uViewOrigin;\nuniform mat3 uViewAngles;\nuniform mat4 uPerspective;\nuniform vec3 uLightVec;\nattribute vec3 aPosition;\nattribute vec3 aNormal;\nattribute vec2 aTexCoord;\nvarying vec2 vTexCoord;\nvarying float vLightDot;\nvoid main(void)\n{\n\tvec3 position = uViewAngles * (uAngles * aPosition + uOrigin - uViewOrigin);\n\tgl_Position = uPerspective * vec4(position.xz, -position.y, 1.0);\n\tvTexCoord = aTexCoord;\n\tvLightDot = dot(aNormal, uLightVec);\n}\n","fshAlias":"\n#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform float uGamma;\nuniform float uAmbientLight;\nuniform float uShadeLight;\nuniform sampler2D tTexture;\nvarying vec2 vTexCoord;\nvarying float vLightDot;\nvoid main(void)\n{\n\tvec4 texture = texture2D(tTexture, vTexCoord);\n\tgl_FragColor = vec4(texture.rgb * mix(1.0, vLightDot * uShadeLight + uAmbientLight, texture.a), 1.0);\n\tgl_FragColor.r = pow(gl_FragColor.r, uGamma);\n\tgl_FragColor.g = pow(gl_FragColor.g, uGamma);\n\tgl_FragColor.b = pow(gl_FragColor.b, uGamma);\n}\n","vshBrush":"\nuniform vec3 uOrigin;\nuniform mat3 uAngles;\nuniform vec3 uViewOrigin;\nuniform mat3 uViewAngles;\nuniform mat4 uPerspective;\nattribute vec3 aPosition;\nattribute vec4 aTexCoord;\nattribute vec4 aLightStyle;\nvarying vec4 vTexCoord;\nvarying vec4 vLightStyle;\nvoid main(void)\n{\n\tvec3 position = uViewAngles * (uAngles * aPosition + uOrigin - uViewOrigin);\n\tgl_Position = uPerspective * vec4(position.xz, -position.y, 1.0);\n\tvTexCoord = aTexCoord;\n\tvLightStyle = aLightStyle;\n}\n","fshBrush":"\n#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform float uGamma;\nuniform sampler2D tTexture;\nuniform sampler2D tLightmap;\nuniform sampler2D tDlight;\nuniform sampler2D tLightStyle;\nvarying vec4 vTexCoord;\nvarying vec4 vLightStyle;\nvoid main(void)\n{\n\tvec4 texture = texture2D(tTexture, vTexCoord.xy);\n\tgl_FragColor = vec4(texture.rgb *\n\t\tmix(1.0, dot(texture2D(tLightmap, vTexCoord.zw), vec4(\n\t\t\ttexture2D(tLightStyle, vec2(vLightStyle.x, 0.0)).a,\n\t\t\ttexture2D(tLightStyle, vec2(vLightStyle.y, 0.0)).a,\n\t\t\ttexture2D(tLightStyle, vec2(vLightStyle.z, 0.0)).a,\n\t\t\ttexture2D(tLightStyle, vec2(vLightStyle.w, 0.0)).a)\n\t\t* 43.828125) + texture2D(tDlight, vTexCoord.zw).a, texture.a), 1.0);\n\tgl_FragColor.r = pow(gl_FragColor.r, uGamma);\n\tgl_FragColor.g = pow(gl_FragColor.g, uGamma);\n\tgl_FragColor.b = pow(gl_FragColor.b, uGamma);\n}\n","vshCharacter":"\nuniform vec2 uCharacter;\nuniform vec2 uDest;\nuniform mat4 uOrtho;\nattribute vec2 aPosition;\nvarying vec2 vTexCoord;\nvoid main(void)\n{\n\tgl_Position = uOrtho * vec4(aPosition * 8.0 + uDest, 0.0, 1.0);\n\tvTexCoord = (aPosition + uCharacter) * 0.0625;\n}\n","fshCharacter":"\n#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform sampler2D tTexture;\nvarying vec2 vTexCoord;\nvoid main(void)\n{\n\tgl_FragColor = texture2D(tTexture, vTexCoord);\n}\n","vshDlight":"\nuniform vec3 uOrigin;\nuniform vec3 uViewOrigin;\nuniform mat3 uViewAngles;\nuniform mat4 uPerspective;\nuniform float uRadius;\nattribute vec3 aPosition;\nvarying float vAlpha;\nvoid main(void)\n{\n\tvec3 position = aPosition * 0.35 * uRadius + uViewAngles * (uOrigin - uViewOrigin);\n\tgl_Position = uPerspective * vec4(position.xz, -position.y, 1.0);\n\tvAlpha = aPosition.y * -0.2;\n}\n","fshDlight":"\n#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform float uGamma;\nvarying float vAlpha;\nvoid main(void)\n{\n\tgl_FragColor = vec4(pow(1.0, uGamma), pow(0.5, uGamma), 0.0, vAlpha);\n}\n","vshFill":"\nuniform mat4 uOrtho;\nattribute vec2 aPosition;\nattribute vec4 aColor;\nvarying vec4 vColor;\nvoid main(void)\n{\n\tgl_Position = uOrtho * vec4(aPosition, 0.0, 1.0);\n\tvColor = aColor;\n}\n","fshFill":"\n#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nvarying vec4 vColor;\nvoid main(void)\n{\n\tgl_FragColor = vColor;\n}\n","vshParticle":"\nuniform vec3 uViewOrigin;\nuniform mat3 uViewAngles;\nuniform mat4 uPerspective;\nuniform float uScale;\nattribute vec3 aOrigin;\nattribute vec2 aCoord;\nattribute float aScale;\nattribute vec3 aColor;\nvarying vec2 vCoord;\nvarying vec3 vColor;\nvoid main(void)\n{\n\tvec2 point = aCoord * aScale;\n\tvec3 position = vec3(point.x, 0.0, point.y) + uViewAngles * (aOrigin - uViewOrigin);\n\tgl_Position = uPerspective * vec4(position.xz, -position.y, 1.0);\n\tvCoord = aCoord;\n\tvColor = aColor;\n}\n","fshParticle":"\n#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform float uGamma;\nvarying vec2 vCoord;\nvarying vec3 vColor;\nvoid main(void)\n{\n\tgl_FragColor = vec4(vColor, 1.0 - smoothstep(0.75, 1.0, length(vCoord)));\n\tgl_FragColor.r = pow(gl_FragColor.r, uGamma);\n\tgl_FragColor.g = pow(gl_FragColor.g, uGamma);\n\tgl_FragColor.b = pow(gl_FragColor.b, uGamma);\n}\n","vshPic":"\nuniform mat4 uOrtho;\nattribute vec2 aPosition;\nattribute vec2 aTexCoord;\nvarying vec2 vTexCoord;\nvoid main(void)\n{\n\tgl_Position = uOrtho * vec4(aPosition, 0.0, 1.0);\n\tvTexCoord = aTexCoord;\n}\n","fshPic":"\n#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform sampler2D tTexture;\nvarying vec2 vTexCoord;\nvoid main(void)\n{\n\tgl_FragColor = texture2D(tTexture, vTexCoord);\n}\n","vshPicTranslate":"\nuniform mat4 uOrtho;\nattribute vec2 aPosition;\nattribute vec2 aTexCoord;\nvarying vec2 vTexCoord;\nvoid main(void)\n{\n\tgl_Position = uOrtho * vec4(aPosition, 0.0, 1.0);\n\tvTexCoord = aTexCoord;\n}\n","fshPicTranslate":"\n#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform vec3 uTop;\nuniform vec3 uBottom;\nuniform sampler2D tTexture;\nuniform sampler2D tTrans;\nvarying vec2 vTexCoord;\nvoid main(void)\n{\n\tvec4 texture = texture2D(tTexture, vTexCoord);\n\tvec4 trans = texture2D(tTrans, vTexCoord);\n\tgl_FragColor = vec4(mix(mix(texture.rgb, uTop * trans.x, trans.y), uBottom * trans.z, trans.w), texture.a);\n}\n","vshPlayer":"\nuniform vec3 uOrigin;\nuniform mat3 uAngles;\nuniform vec3 uViewOrigin;\nuniform mat3 uViewAngles;\nuniform mat4 uPerspective;\nuniform vec3 uLightVec;\nattribute vec3 aPosition;\nattribute vec3 aNormal;\nattribute vec2 aTexCoord;\nvarying vec2 vTexCoord;\nvarying float vLightDot;\nvoid main(void)\n{\n\tvec3 position = uViewAngles * (uAngles * aPosition + uOrigin - uViewOrigin);\n\tgl_Position = uPerspective * vec4(position.xz, -position.y, 1.0);\n\tvTexCoord = aTexCoord;\n\tvLightDot = dot(aNormal, uLightVec);\n}\n","fshPlayer":"\n#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform float uGamma;\nuniform float uAmbientLight;\nuniform float uShadeLight;\nuniform vec3 uTop;\nuniform vec3 uBottom;\nuniform sampler2D tTexture;\nuniform sampler2D tPlayer;\nvarying vec2 vTexCoord;\nvarying float vLightDot;\nvoid main(void)\n{\n\tvec4 texture = texture2D(tTexture, vTexCoord);\n\tvec4 player = texture2D(tPlayer, vTexCoord);\n\tgl_FragColor = vec4(\n\t\tmix(mix(texture.rgb, uTop * (1.0 / 191.25) * player.x, player.y), uBottom * (1.0 / 191.25) * player.z, player.w)\n\t\t* mix(1.0, vLightDot * uShadeLight + uAmbientLight, texture.a), 1.0);\n\tgl_FragColor.r = pow(gl_FragColor.r, uGamma);\n\tgl_FragColor.g = pow(gl_FragColor.g, uGamma);\n\tgl_FragColor.b = pow(gl_FragColor.b, uGamma);\n}\n","vshSky":"\nuniform mat3 uViewAngles;\nuniform mat4 uPerspective;\nuniform vec3 uScale;\nattribute vec3 aPosition;\nvarying vec2 vTexCoord;\nvoid main(void)\n{\n\tvec3 position = uViewAngles * (aPosition * uScale * 18918.0);\n\tgl_Position = uPerspective * vec4(position.xz, -position.y, 1.0);\n\tvTexCoord = aPosition.xy * uScale.xy * 1.5;\n}\n","fshSky":"\n#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform float uGamma;\nuniform vec2 uTime;\nuniform sampler2D tSolid;\nuniform sampler2D tAlpha;\nvarying vec2 vTexCoord;\nvoid main(void)\n{\n\tvec4 alpha = texture2D(tAlpha, vTexCoord + uTime.x);\n\tgl_FragColor = vec4(mix(texture2D(tSolid, vTexCoord + uTime.y).rgb, alpha.rgb, alpha.a), 1.0);\n\tgl_FragColor.r = pow(gl_FragColor.r, uGamma);\n\tgl_FragColor.g = pow(gl_FragColor.g, uGamma);\n\tgl_FragColor.b = pow(gl_FragColor.b, uGamma);\n}\n","vshSkyChain":"\nuniform vec3 uViewOrigin;\nuniform mat3 uViewAngles;\nuniform mat4 uPerspective;\nattribute vec3 aPosition;\nvoid main(void)\n{\n\tvec3 position = uViewAngles * (aPosition - uViewOrigin);\n\tgl_Position = uPerspective * vec4(position.xz, -position.y, 1.0);\n}\n","fshSkyChain":"\n#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nvoid main(void)\n{\n}\n","vshSprite":"\nuniform vec4 uRect;\nuniform vec3 uViewOrigin;\nuniform mat3 uViewAngles;\nuniform mat4 uPerspective;\nattribute vec3 aPosition;\nattribute vec2 aTexCoord;\nvarying vec2 vTexCoord;\nvoid main(void)\n{\n\tvec3 position = uViewAngles * (aPosition - uViewOrigin);\n\tgl_Position = uPerspective * vec4(position.xz, -position.y, 1.0);\n\tvTexCoord = aTexCoord;\n}\n","fshSprite":"\n#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform float uGamma;\nuniform sampler2D tTexture;\nvarying vec2 vTexCoord;\nvoid main(void)\n{\n\tgl_FragColor = texture2D(tTexture, vTexCoord);\n\tgl_FragColor.r = pow(gl_FragColor.r, uGamma);\n\tgl_FragColor.g = pow(gl_FragColor.g, uGamma);\n\tgl_FragColor.b = pow(gl_FragColor.b, uGamma);\n}\n","vshTurbulent":"\nuniform vec3 uOrigin;\nuniform mat3 uAngles;\nuniform vec3 uViewOrigin;\nuniform mat3 uViewAngles;\nuniform mat4 uPerspective;\nattribute vec3 aPosition;\nattribute vec2 aTexCoord;\nvarying vec2 vTexCoord;\nvoid main(void)\n{\n\tvec3 position = uViewAngles * (uAngles * aPosition + uOrigin - uViewOrigin);\n\tgl_Position = uPerspective * vec4(position.xz, -position.y, 1.0);\n\tvTexCoord = aTexCoord;\n}\n","fshTurbulent":"\n#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform float uGamma;\nuniform float uTime;\nuniform sampler2D tTexture;\nvarying vec2 vTexCoord;\nvoid main(void)\n{\n\tgl_FragColor = vec4(texture2D(tTexture, vTexCoord + vec2(sin(vTexCoord.t * 3.141593 + uTime), sin(vTexCoord.s * 3.141593 + uTime)) * 0.125).rgb, 1.0);\n\tgl_FragColor.r = pow(gl_FragColor.r, uGamma);\n\tgl_FragColor.g = pow(gl_FragColor.g, uGamma);\n\tgl_FragColor.b = pow(gl_FragColor.b, uGamma);\n}\n","vshWarp":"\nuniform mat4 uOrtho;\nattribute vec2 aPosition;\nattribute vec2 aTexCoord;\nvarying vec2 vTexCoord;\nvoid main(void)\n{\n\tgl_Position = uOrtho * vec4(aPosition, 0.0, 1.0);\n\tvTexCoord = aTexCoord;\n}\n","fshWarp":"\n#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform float uTime;\nuniform sampler2D tTexture;\nvarying vec2 vTexCoord;\nvoid main(void)\n{\n\tgl_FragColor = texture2D(tTexture, vTexCoord + vec2(sin(vTexCoord.t * 15.70796 + uTime) * 0.003125, sin(vTexCoord.s * 9.817477 + uTime) * 0.005));\n}\n"};
// ---- WebQuake/CDAudio.js ----
CDAudio = {};

CDAudio.known = [];

CDAudio.Play = function(track, looping)
{
	if ((CDAudio.initialized !== true) || (CDAudio.enabled !== true))
		return;
	track -= 2;
	if (CDAudio.playTrack === track)
	{
		if (CDAudio.cd != null)
		{
			CDAudio.cd.loop = looping;
			if ((looping === true) && (CDAudio.cd.paused === true))
				CDAudio.cd.play();
		}
		return;
	}
	if ((track < 0) || (track >= CDAudio.known.length))
	{
		Con.DPrint('CDAudio.Play: Bad track number ' + (track + 2) + '.\n');
		return;
	}
	CDAudio.Stop();
	CDAudio.playTrack = track;
	CDAudio.cd = new Audio(CDAudio.known[track]);
	CDAudio.cd.loop = looping;
	CDAudio.cd.volume = CDAudio.cdvolume;
	CDAudio.cd.play();
};

CDAudio.Stop = function()
{
	if ((CDAudio.initialized !== true) || (CDAudio.enabled !== true))
		return;
	if (CDAudio.cd != null)
		CDAudio.cd.pause();
	CDAudio.playTrack = null;
	CDAudio.cd = null;
};

CDAudio.Pause = function()
{
	if ((CDAudio.initialized !== true) || (CDAudio.enabled !== true))
		return;
	if (CDAudio.cd != null)
		CDAudio.cd.pause();
};

CDAudio.Resume = function()
{
	if ((CDAudio.initialized !== true) || (CDAudio.enabled !== true))
		return;
	if (CDAudio.cd != null)
		CDAudio.cd.play();
};

CDAudio.CD_f = function()
{
	if ((CDAudio.initialized !== true) || (Cmd.argv.length <= 1))
		return;
	var command = Cmd.argv[1].toLowerCase();
	switch (command)
	{
	case 'on':
		CDAudio.enabled = true;
		return;
	case 'off':
		CDAudio.Stop();
		CDAudio.enabled = false;
		return;
	case 'play':
		CDAudio.Play(Q.atoi(Cmd.argv[2]), false);
		return;
	case 'loop':
		CDAudio.Play(Q.atoi(Cmd.argv[2]), true);
		return;
	case 'stop':
		CDAudio.Stop();
		return;
	case 'pause':
		CDAudio.Pause();
		return;
	case 'resume':
		CDAudio.Resume();
		return;
	case 'info':
		Con.Print(CDAudio.known.length + ' tracks\n');
		if (CDAudio.cd != null)
		{
			if (CDAudio.cd.paused !== true)
				Con.Print('Currently ' + (CDAudio.cd.loop === true ? 'looping' : 'playing') + ' track ' + (CDAudio.playTrack + 2) + '\n');
		}
		Con.Print('Volume is ' + CDAudio.cdvolume + '\n');
		return;
	}
};

CDAudio.Update = function()
{
	if ((CDAudio.initialized !== true) || (CDAudio.enabled !== true))
		return;
	if (S.bgmvolume.value === CDAudio.cdvolume)
		return;
	if (S.bgmvolume.value < 0.0)
		Cvar.SetValue('bgmvolume', 0.0);
	else if (S.bgmvolume.value > 1.0)
		Cvar.SetValue('bgmvolume', 1.0);
	CDAudio.cdvolume = S.bgmvolume.value;
	if (CDAudio.cd != null)
		CDAudio.cd.volume = CDAudio.cdvolume;
};

CDAudio.Init = function()
{
	Cmd.AddCommand('cd', CDAudio.CD_f);
	if (COM.CheckParm('-nocdaudio') != null)
		return;
	var i, j, track;
	var xhr = new XMLHttpRequest();
	for (i = 1; i <= 99; ++i)
	{
		track = '/media/quake' + (i <= 9 ? '0' : '') + i + '.ogg';
		for (j = COM.searchpaths.length - 1; j >= 0; --j)
		{
			xhr.open('HEAD', COM.searchpaths[j].filename + track, false);
			xhr.send();
			if ((xhr.status >= 200) && (xhr.status <= 299))
			{
				CDAudio.known[i - 1] = COM.searchpaths[j].filename + track;
				break;
			}
		}
		if (j < 0)
			break;
	}
	if (CDAudio.known.length === 0)
		return;
	CDAudio.initialized = CDAudio.enabled = true;
	CDAudio.Update();
	Con.Print('CD Audio Initialized\n');
};

// ---- WebQuake/Chase.js ----
Chase = {};

Chase.Init = function()
{
	Chase.back = Cvar.RegisterVariable('chase_back', '100');
	Chase.up = Cvar.RegisterVariable('chase_up', '16');
	Chase.right = Cvar.RegisterVariable('chase_right', '0');
	Chase.active = Cvar.RegisterVariable('chase_active', '0');
};

Chase.Update = function()
{
	var forward = [], right = [];
	Vec.AngleVectors(CL.state.viewangles, forward, right);
	var trace = {plane: {}}, org = R.refdef.vieworg;
	SV.RecursiveHullCheck(CL.state.worldmodel.hulls[0], 0, 0.0, 1.0, org, [
		org[0] + 4096.0 * forward[0],
		org[1] + 4096.0 * forward[1],
		org[2] + 4096.0 * forward[2]], trace);
	var stop = trace.endpos;
	stop[2] -= org[2];
	var dist = (stop[0] - org[0]) * forward[0] + (stop[1] - org[1]) * forward[1] + stop[2] * forward[2];
	if (dist < 1.0)
		dist = 1.0;
	R.refdef.viewangles[0] = Math.atan(stop[2] / dist) / Math.PI * -180.0;
	org[0] -= forward[0] * Chase.back.value + right[0] * Chase.right.value;
	org[1] -= forward[1] * Chase.back.value + right[1] * Chase.right.value;
	org[2] += Chase.up.value;
};

// ---- WebQuake/CL.js ----
CL = {};

CL.cshift = {
	contents: 0,
	damage: 1,
	bonus: 2,
	powerup: 3
};

CL.active = {
	disconnected: 0,
	connecting: 1,
	connected: 2
};

// demo

CL.StopPlayback = function()
{
	if (CL.cls.demoplayback !== true)
		return;
	CL.cls.demoplayback = false;
	CL.cls.demofile = null;
	CL.cls.state = CL.active.disconnected;
	if (CL.cls.timedemo === true)
		CL.FinishTimeDemo();
};

CL.WriteDemoMessage = function()
{
	var len = CL.cls.demoofs + 16 + NET.message.cursize;
	if (CL.cls.demofile.byteLength < len)
	{
		var src = new Uint8Array(CL.cls.demofile, 0, CL.cls.demoofs);
		CL.cls.demofile = new ArrayBuffer(CL.cls.demofile.byteLength + 16384);
		(new Uint8Array(CL.cls.demofile)).set(src);
	}
	var f = new DataView(CL.cls.demofile, CL.cls.demoofs, 16);
	f.setInt32(0, NET.message.cursize, true);
	f.setFloat32(4, CL.state.viewangles[0], true);
	f.setFloat32(8, CL.state.viewangles[1], true);
	f.setFloat32(12, CL.state.viewangles[2], true);
	(new Uint8Array(CL.cls.demofile)).set(new Uint8Array(NET.message.data, 0, NET.message.cursize), CL.cls.demoofs + 16);
	CL.cls.demoofs = len;
};

CL.GetMessage = function()
{
	if (CL.cls.demoplayback === true)
	{
		if (CL.cls.signon === 4)
		{
			if (CL.cls.timedemo === true)
			{
				if (Host.framecount === CL.cls.td_lastframe)
					return 0;
				CL.cls.td_lastframe = Host.framecount;
				if (Host.framecount === (CL.cls.td_startframe + 1))
					CL.cls.td_starttime = Host.realtime;
			}
			else if (CL.state.time <= CL.state.mtime[0])
				return 0;
		}
		if ((CL.cls.demoofs + 16) >= CL.cls.demosize)
		{
			CL.StopPlayback();
			return 0;
		}
		var view = new DataView(CL.cls.demofile);
		NET.message.cursize = view.getUint32(CL.cls.demoofs, true);
		if (NET.message.cursize > 8000)
			Sys.Error('Demo message > MAX_MSGLEN');
		CL.state.mviewangles[1] = CL.state.mviewangles[0];
		CL.state.mviewangles[0] = [view.getFloat32(CL.cls.demoofs + 4, true), view.getFloat32(CL.cls.demoofs + 8, true), view.getFloat32(CL.cls.demoofs + 12, true)];
		CL.cls.demoofs += 16;
		if ((CL.cls.demoofs + NET.message.cursize) > CL.cls.demosize)
		{
			CL.StopPlayback();
			return 0;
		}
		var src = new Uint8Array(CL.cls.demofile, CL.cls.demoofs, NET.message.cursize);
		var dest = new Uint8Array(NET.message.data, 0, NET.message.cursize);
		var i;
		for (i = 0; i < NET.message.cursize; ++i)
			dest[i] = src[i];
		CL.cls.demoofs += NET.message.cursize;
		return 1;
	};

	var r;
	for (;;)
	{
		r = NET.GetMessage(CL.cls.netcon);
		if ((r !== 1) && (r !== 2))
			return r;
		if ((NET.message.cursize === 1) && ((new Uint8Array(NET.message.data, 0, 1))[0] === Protocol.svc.nop))
			Con.Print('<-- server to client keepalive\n');
		else
			break;
	}

	if (CL.cls.demorecording === true)
		CL.WriteDemoMessage();

	return r;
};

CL.Stop_f = function()
{
	if (Cmd.client === true)
		return;
	if (CL.cls.demorecording !== true)
	{
		Con.Print('Not recording a demo.\n');
		return;
	}
	NET.message.cursize = 0;
	MSG.WriteByte(NET.message, Protocol.svc.disconnect);
	CL.WriteDemoMessage();
	if (COM.WriteFile(CL.cls.demoname, new Uint8Array(CL.cls.demofile), CL.cls.demoofs) !== true)
		Con.Print('ERROR: couldn\'t open.\n');
	CL.cls.demofile = null;
	CL.cls.demorecording = false;
	Con.Print('Completed demo\n');
};

CL.Record_f = function()
{
	var c = Cmd.argv.length;
	if ((c <= 1) || (c >= 5))
	{
		Con.Print('record <demoname> [<map> [cd track]]\n');
		return;
	}
	if (Cmd.argv[1].indexOf('..') !== -1)
	{
		Con.Print('Relative pathnames are not allowed.\n');
		return;
	}
	if ((c === 2) && (CL.cls.state === CL.active.connected))
	{
		Con.Print('Can not record - already connected to server\nClient demo recording must be started before connecting\n');
		return;
	}
	if (c === 4)
	{
		CL.cls.forcetrack = Q.atoi(Cmd.argv[3]);
		Con.Print('Forcing CD track to ' + CL.cls.forcetrack);
	}
	else
		CL.cls.forcetrack = -1;
	CL.cls.demoname = COM.DefaultExtension(Cmd.argv[1], '.dem');
	if (c >= 3)
		Cmd.ExecuteString('map ' + Cmd.argv[2]);
	Con.Print('recording to ' + CL.cls.demoname + '.\n');
	CL.cls.demofile = new ArrayBuffer(16384);
	var track = CL.cls.forcetrack.toString() + '\n';
	var i, dest = new Uint8Array(CL.cls.demofile, 0, track.length);
	for (i = 0; i < track.length; ++i)
		dest[i] = track.charCodeAt(i);
	CL.cls.demoofs = track.length;
	CL.cls.demorecording = true;
};

CL.PlayDemo_f = function()
{
	if (Cmd.client === true)
		return;
	if (Cmd.argv.length !== 2)
	{
		Con.Print('playdemo <demoname> : plays a demo\n');
		return;
	}
	CL.Disconnect();
	var name = COM.DefaultExtension(Cmd.argv[1], '.dem');
	Con.Print('Playing demo from ' + name + '.\n');
	var demofile = COM.LoadFile(name);
	if (demofile == null)
	{
		Con.Print('ERROR: couldn\'t open.\n');
		CL.cls.demonum = -1;
		SCR.disabled_for_loading = false;
		return;
	}
	CL.cls.demofile = demofile;
	demofile = new Uint8Array(demofile);
	CL.cls.demosize = demofile.length;
	CL.cls.demoplayback = true;
	CL.cls.state = CL.active.connected;
	CL.cls.forcetrack = 0;
	var i, c, neg;
	for (i = 0; i < demofile.length; ++i)
	{
		c = demofile[i];
		if (c === 10)
			break;
		if (c === 45)
			neg = true;
		else
			CL.cls.forcetrack = CL.cls.forcetrack * 10 + c - 48;
	}
	if (neg === true)
		CL.cls.forcetrack = -CL.cls.forcetrack;
	CL.cls.demoofs = i + 1;
};

CL.FinishTimeDemo = function()
{
	CL.cls.timedemo = false;
	var frames = Host.framecount - CL.cls.td_startframe - 1;
	var time = Host.realtime - CL.cls.td_starttime;
	if (time === 0.0)
		time = 1.0;
	Con.Print(frames + ' frames ' + time.toFixed(1) + ' seconds ' + (frames / time).toFixed(1) + ' fps\n');
};

CL.TimeDemo_f = function()
{
	if (Cmd.client === true)
		return;
	if (Cmd.argv.length !== 2)
	{
		Con.Print('timedemo <demoname> : gets demo speeds\n');
		return;
	}
	CL.PlayDemo_f();
	CL.cls.timedemo = true;
	CL.cls.td_startframe = Host.framecount;
	CL.cls.td_lastframe = -1;
};

// input

CL.kbutton = {
	mlook: 0,
	klook: 1,
	left: 2,
	right: 3,
	forward: 4,
	back: 5,
	lookup: 6,
	lookdown: 7,
	moveleft: 8,
	moveright: 9,
	strafe: 10,
	speed: 11,
	use: 12,
	jump: 13,
	attack: 14,
	moveup: 15,
	movedown: 16,
	num: 17
};
CL.kbuttons = [];

CL.KeyDown = function()
{
	var b = CL.kbutton[Cmd.argv[0].substring(1)];
	if (b == null)
		return;
	b = CL.kbuttons[b];

	var k;
	if (Cmd.argv[1] != null)
		k = Q.atoi(Cmd.argv[1]);
	else
		k = -1;

	if ((k === b.down[0]) || (k === b.down[1]))
		return;

	if (b.down[0] === 0)
		b.down[0] = k;
	else if (b.down[1] === 0)
		b.down[1] = k;
	else
	{
		Con.Print('Three keys down for a button!\n');
		return;
	}

	if ((b.state & 1) === 0)
		b.state |= 3;
};

CL.KeyUp = function()
{
	var b = CL.kbutton[Cmd.argv[0].substring(1)];
	if (b == null)
		return;
	b = CL.kbuttons[b];

	var k;
	if (Cmd.argv[1] != null)
		k = Q.atoi(Cmd.argv[1]);
	else
	{
		b.down[0] = b.down[1] = 0;
		b.state = 4;
		return;
	}

	if (b.down[0] === k)
		b.down[0] = 0;
	else if (b.down[1] === k)
		b.down[1] = 0;
	else
		return;
	if ((b.down[0] !== 0) || (b.down[1] !== 0))
		return;

	if ((b.state & 1) !== 0)
		b.state = (b.state - 1) | 4;
};

CL.MLookUp = function()
{
	CL.KeyUp();
	if (((CL.kbuttons[CL.kbutton.mlook].state & 1) === 0) && (CL.lookspring.value !== 0))
		V.StartPitchDrift();
};

CL.Impulse = function()
{
	CL.impulse = Q.atoi(Cmd.argv[1]);
};

CL.KeyState = function(key)
{
	key = CL.kbuttons[key];
	var down = key.state & 1;
	key.state &= 1;
	if ((key.state & 2) !== 0)
	{
		if ((key.state & 4) !== 0)
			return (down !== 0) ? 0.75 : 0.25;
		return (down !== 0) ? 0.5 : 0.0;
	}
	if ((key.state & 4) !== 0)
		return 0.0;
	return (down !== 0) ? 1.0 : 0.0;
};

CL.AdjustAngles = function()
{
	var speed = Host.frametime;
	if ((CL.kbuttons[CL.kbutton.speed].state & 1) !== 0)
		speed *= CL.anglespeedkey.value;

	var angles = CL.state.viewangles;

	if ((CL.kbuttons[CL.kbutton.strafe].state & 1) === 0)
	{
		angles[1] += speed * CL.yawspeed.value * (CL.KeyState(CL.kbutton.left) - CL.KeyState(CL.kbutton.right));
		angles[1] = Vec.Anglemod(angles[1]);
	}
	if ((CL.kbuttons[CL.kbutton.klook].state & 1) !== 0)
	{
		V.StopPitchDrift();
		angles[0] += speed * CL.pitchspeed.value * (CL.KeyState(CL.kbutton.back) - CL.KeyState(CL.kbutton.forward));
	}

	var up = CL.KeyState(CL.kbutton.lookup), down = CL.KeyState(CL.kbutton.lookdown);
	if ((up !== 0.0) || (down !== 0.0))
	{
		angles[0] += speed * CL.pitchspeed.value * (down - up);
		V.StopPitchDrift();
	}

	if (angles[0] > 80.0)
		angles[0] = 80.0;
	else if (angles[0] < -70.0)
		angles[0] = -70.0;

	if (angles[2] > 50.0)
		angles[2] = 50.0;
	else if (angles[2] < -50.0)
		angles[2] = -50.0;
};

CL.BaseMove = function()
{
	if (CL.cls.signon !== 4)
		return;

	CL.AdjustAngles();

	var cmd = CL.state.cmd;

	cmd.sidemove = CL.sidespeed.value * (CL.KeyState(CL.kbutton.moveright) - CL.KeyState(CL.kbutton.moveleft));
	if ((CL.kbuttons[CL.kbutton.strafe].state & 1) !== 0)
		cmd.sidemove += CL.sidespeed.value * (CL.KeyState(CL.kbutton.right) - CL.KeyState(CL.kbutton.left));

	cmd.upmove = CL.upspeed.value * (CL.KeyState(CL.kbutton.moveup) - CL.KeyState(CL.kbutton.movedown));

	if ((CL.kbuttons[CL.kbutton.klook].state & 1) === 0)
		cmd.forwardmove = CL.forwardspeed.value * CL.KeyState(CL.kbutton.forward) - CL.backspeed.value * CL.KeyState(CL.kbutton.back);
	else
		cmd.forwardmove = 0.0;

	if ((CL.kbuttons[CL.kbutton.speed].state & 1) !== 0)
	{
		cmd.forwardmove *= CL.movespeedkey.value;
		cmd.sidemove *= CL.movespeedkey.value;
		cmd.upmove *= CL.movespeedkey.value;
	}
};

CL.sendmovebuf = {data: new ArrayBuffer(16), cursize: 0};
CL.SendMove = function()
{
	var buf = CL.sendmovebuf;
	buf.cursize = 0;
	MSG.WriteByte(buf, Protocol.clc.move);
	MSG.WriteFloat(buf, CL.state.mtime[0]);
	MSG.WriteAngle(buf, CL.state.viewangles[0]);
	MSG.WriteAngle(buf, CL.state.viewangles[1]);
	MSG.WriteAngle(buf, CL.state.viewangles[2]);
	MSG.WriteShort(buf, CL.state.cmd.forwardmove);
	MSG.WriteShort(buf, CL.state.cmd.sidemove);
	MSG.WriteShort(buf, CL.state.cmd.upmove);
	var bits = 0;
	if ((CL.kbuttons[CL.kbutton.attack].state & 3) !== 0)
		bits += 1;
	CL.kbuttons[CL.kbutton.attack].state &= 5;
	if ((CL.kbuttons[CL.kbutton.jump].state & 3) !== 0)
		bits += 2;
	CL.kbuttons[CL.kbutton.jump].state &= 5;
	MSG.WriteByte(buf, bits);
	MSG.WriteByte(buf, CL.impulse);
	CL.impulse = 0;
	if (CL.cls.demoplayback === true)
		return;
	if (++CL.state.movemessages <= 2)
		return;
	if (NET.SendUnreliableMessage(CL.cls.netcon, buf) === -1)
	{
		Con.Print('CL.SendMove: lost server connection\n');
		CL.Disconnect();
	}
};

CL.InitInput = function()
{
	var i;

	var commands = ['moveup', 'movedown', 'left', 'right',
		'forward', 'back', 'lookup', 'lookdown',
		'strafe', 'moveleft', 'moveright', 'speed',
		'attack', 'use', 'jump', 'klook'
	];
	for (i = 0; i < commands.length; ++i)
	{
		Cmd.AddCommand('+' + commands[i], CL.KeyDown);
		Cmd.AddCommand('-' + commands[i], CL.KeyUp);
	}
	Cmd.AddCommand('impulse', CL.Impulse);
	Cmd.AddCommand('+mlook', CL.KeyDown);
	Cmd.AddCommand('-mlook', CL.MLookUp);

	for (i = 0; i < CL.kbutton.num; ++i)
		CL.kbuttons[i] = {down: [0, 0], state: 0};
};

// main

CL.cls = {
	state: 0,
	spawnparms: '',
	demonum: 0,
	message: {data: new ArrayBuffer(8192), cursize: 0}
};

CL.static_entities = [];
CL.visedicts = [];

CL.Rcon_f = function()
{
	if (CL.rcon_password.string.length === 0)
	{
		Con.Print('You must set \'rcon_password\' before\nissuing an rcon command.\n');
		return;
	}
	var to;
	if ((CL.cls.state === CL.active.connected) && (CL.cls.netcon != null))
	{
		if (NET.drivers[CL.cls.netcon.driver] === WEBS)
			to = CL.cls.netcon.address.substring(5);
	}
	if (to == null)
	{
		if (CL.rcon_address.string.length === 0)
		{
			Con.Print('You must either be connected,\nor set the \'rcon_address\' cvar\nto issue rcon commands\n');
			return;
		}
		to = CL.rcon_address.string;
	}
	var pw;
	try
	{
		pw = btoa('quake:' + CL.rcon_password.string);
	}
	catch (e)
	{
		return;
	}
	var message = '', i;
	for (i = 1; i < Cmd.argv.length; ++i)
		message += Cmd.argv[i] + ' ';
	try
	{
		message = encodeURIComponent(message);
	}
	catch (e)
	{
		return;
	}
	var xhr = new XMLHttpRequest();
	xhr.open('HEAD', 'http://' + to + '/rcon/' + message);
	xhr.setRequestHeader('Authorization', 'Basic ' + pw);
	xhr.send();
};

CL.ClearState = function()
{
	if (SV.server.active !== true)
	{
		Con.DPrint('Clearing memory\n');
		Mod.ClearAll();
		CL.cls.signon = 0;
	}

	CL.state = {
		movemessages: 0,
		cmd: {
			forwardmove: 0.0,
			sidemove: 0.0,
			upmove: 0.0
		},
		stats: [
			0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0
		],
		items: 0,
		item_gettime: [
			0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
			0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
			0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
			0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
		],
		faceanimtime: 0.0,
		cshifts: [[0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0]],
		mviewangles: [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]],
		viewangles: [0.0, 0.0, 0.0],
		mvelocity: [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]],
		velocity: [0.0, 0.0, 0.0],
		punchangle: [0.0, 0.0, 0.0],
		idealpitch: 0.0,
		pitchvel: 0.0,
		driftmove: 0.0,
		laststop: 0.0,
		crouch: 0.0,
		intermission: 0,
		completed_time: 0,
		mtime: [0.0, 0.0],
		time: 0.0,
		oldtime: 0.0,
		last_received_message: 0.0,
		viewentity: 0,
		num_statics: 0,
		viewent: {num: -1, origin: [0.0, 0.0, 0.0], angles: [0.0, 0.0, 0.0], skinnum: 0},
		cdtrack: 0,
		looptrack: 0
	};

	CL.cls.message.cursize = 0;

	CL.entities = [];
	
	var i;

	CL.dlights = [];
	for (i = 0; i <= 31; ++i)
		CL.dlights[i] = {radius: 0.0, die: 0.0};

	CL.lightstyle = [];
	for (i = 0; i <= 63; ++i)
		CL.lightstyle[i] = '';

	CL.beams = [];
	for (i = 0; i <= 23; ++i)
		CL.beams[i] = {endtime: 0.0};
};

CL.Disconnect = function()
{
	S.StopAllSounds();
	if (CL.cls.demoplayback === true)
		CL.StopPlayback();
	else if (CL.cls.state === CL.active.connected)
	{
		if (CL.cls.demorecording === true)
			CL.Stop_f();
		Con.DPrint('Sending clc_disconnect\n');
		CL.cls.message.cursize = 0;
		MSG.WriteByte(CL.cls.message, Protocol.clc.disconnect);
		NET.SendUnreliableMessage(CL.cls.netcon, CL.cls.message);
		CL.cls.message.cursize = 0;
		NET.Close(CL.cls.netcon);
		CL.cls.state = CL.active.disconnected;
		if (SV.server.active === true)
			Host.ShutdownServer();
	}
	CL.cls.demoplayback = CL.cls.timedemo = false;
	CL.cls.signon = 0;
};

CL.Connect = function(sock)
{
	CL.cls.netcon = sock;
	Con.DPrint('CL.Connect: connected to ' + CL.host + '\n');
	CL.cls.demonum = -1;
	CL.cls.state = CL.active.connected;
	CL.cls.signon = 0;
};

CL.EstablishConnection = function(host)
{
	if (CL.cls.demoplayback === true)
		return;
	CL.Disconnect();
	CL.host = host;
	var sock = NET.Connect(host);
	if (sock == null)
		Host.Error('CL.EstablishConnection: connect failed\n');
	CL.Connect(sock);
};

CL.SignonReply = function()
{
	Con.DPrint('CL.SignonReply: ' + CL.cls.signon + '\n');
	switch (CL.cls.signon)
	{
	case 1:
		MSG.WriteByte(CL.cls.message, Protocol.clc.stringcmd);
		MSG.WriteString(CL.cls.message, 'prespawn');
		return;
	case 2:
		MSG.WriteByte(CL.cls.message, Protocol.clc.stringcmd);
		MSG.WriteString(CL.cls.message, 'name "' + CL.name.string + '"\n');
		MSG.WriteByte(CL.cls.message, Protocol.clc.stringcmd);
		MSG.WriteString(CL.cls.message, 'color ' + (CL.color.value >> 4) + ' ' + (CL.color.value & 15) + '\n');
		MSG.WriteByte(CL.cls.message, Protocol.clc.stringcmd);
		MSG.WriteString(CL.cls.message, 'spawn ' + CL.cls.spawnparms);
		return;
	case 3:
		MSG.WriteByte(CL.cls.message, Protocol.clc.stringcmd);
		MSG.WriteString(CL.cls.message, 'begin');
		return;
	case 4:
		SCR.EndLoadingPlaque();
	}
};

CL.NextDemo = function()
{
	if (CL.cls.demonum === -1)
		return;
	SCR.BeginLoadingPlaque();
	if (CL.cls.demonum >= CL.cls.demos.length)
	{
		if (CL.cls.demos.length === 0)
		{
			Con.Print('No demos listed with startdemos\n');
			CL.cls.demonum = -1;
			return;
		}
		CL.cls.demonum = 0;
	}
	Cmd.text = 'playdemo ' + CL.cls.demos[CL.cls.demonum++] + '\n' + Cmd.text;
};

CL.PrintEntities_f = function()
{
	var i, ent;
	for (i = 0; i < CL.entities.length; ++i)
	{
		ent = CL.entities[i];
		if (i <= 9)
			Con.Print('  ' + i + ':');
		else if (i <= 99)
			Con.Print(' ' + i + ':');
		else
			Con.Print(i + ':');
		if (ent.model == null)
		{
			Con.Print('EMPTY\n');
			continue;
		}
		Con.Print(ent.model.name + (ent.frame <= 9 ? ': ' : ':') + ent.frame +
			'  (' + ent.origin[0].toFixed(1) + ',' + ent.origin[1].toFixed(1) + ',' + ent.origin[2].toFixed(1) +
			') [' + ent.angles[0].toFixed(1) + ' ' + ent.angles[1].toFixed(1) + ' ' + ent.angles[2].toFixed(1) + ']\n');
	}
};

CL.AllocDlight = function(key)
{
	var i, dl;
	if (key !== 0)
	{
		for (i = 0; i <= 31; ++i)
		{
			if (CL.dlights[i].key === key)
			{
				dl = CL.dlights[i];
				break;
			}
		}
	}
	if (dl == null)
	{
		for (i = 0; i <= 31; ++i)
		{
			if (CL.dlights[i].die < CL.state.time)
			{
				dl = CL.dlights[i];
				break;
			}
		}
		if (dl == null)
			dl = CL.dlights[0];
	}
	dl.origin = [0.0, 0.0, 0.0];
	dl.radius = 0.0;
	dl.die = 0.0;
	dl.decay = 0.0;
	dl.minlight = 0.0;
	dl.key = key;
	return dl;
};

CL.DecayLights = function()
{
	var i, dl, time = CL.state.time - CL.state.oldtime;
	for (i = 0; i <= 31; ++i)
	{
		dl = CL.dlights[i];
		if ((dl.die < CL.state.time) || (dl.radius === 0.0))
			continue;
		dl.radius -= time * dl.decay;
		if (dl.radius < 0.0)
			dl.radius = 0.0;
	}
}

CL.LerpPoint = function()
{
	var f = CL.state.mtime[0] - CL.state.mtime[1];
	if ((f === 0.0) || (CL.nolerp.value !== 0) || (CL.cls.timedemo === true) || (SV.server.active === true))
	{
		CL.state.time = CL.state.mtime[0];
		return 1.0;
	}
	if (f > 0.1)
	{
		CL.state.mtime[1] = CL.state.mtime[0] - 0.1;
		f = 0.1;
	}
	var frac = (CL.state.time - CL.state.mtime[1]) / f;
	if (frac < 0.0)
	{
		if (frac < -0.01)
			CL.state.time = CL.state.mtime[1];
		return 0.0;
	}
	if (frac > 1.0)
	{
		if (frac > 1.01)
			CL.state.time = CL.state.mtime[0];
		return 1.0;
	}
	return frac;
};

CL.RelinkEntities = function()
{
	var i, j;
	var frac = CL.LerpPoint(), f, d, delta = [];

	CL.numvisedicts = 0;

	CL.state.velocity[0] = CL.state.mvelocity[1][0] + frac * (CL.state.mvelocity[0][0] - CL.state.mvelocity[1][0]);
	CL.state.velocity[1] = CL.state.mvelocity[1][1] + frac * (CL.state.mvelocity[0][1] - CL.state.mvelocity[1][1]);
	CL.state.velocity[2] = CL.state.mvelocity[1][2] + frac * (CL.state.mvelocity[0][2] - CL.state.mvelocity[1][2]);

	if (CL.cls.demoplayback === true)
	{
		for (i = 0; i <= 2; ++i)
		{
			d = CL.state.mviewangles[0][i] - CL.state.mviewangles[1][i];
			if (d > 180.0)
				d -= 360.0;
			else if (d < -180.0)
				d += 360.0;
			CL.state.viewangles[i] = CL.state.mviewangles[1][i] + frac * d;
		}
	}

	var bobjrotate = Vec.Anglemod(100.0 * CL.state.time);
	var ent, oldorg = [], dl;
	for (i = 1; i < CL.entities.length; ++i)
	{
		ent = CL.entities[i];
		if (ent.model == null)
			continue;
		if (ent.msgtime !== CL.state.mtime[0])
		{
			ent.model = null;
			continue;
		}
		oldorg[0] = ent.origin[0];
		oldorg[1] = ent.origin[1];
		oldorg[2] = ent.origin[2];
		if (ent.forcelink === true)
		{
			Vec.Copy(ent.msg_origins[0], ent.origin);
			Vec.Copy(ent.msg_angles[0], ent.angles);
		}
		else
		{
			f = frac;
			for (j = 0; j <= 2; ++j)
			{
				delta[j] = ent.msg_origins[0][j] - ent.msg_origins[1][j];
				if ((delta[j] > 100.0) || (delta[j] < -100.0))
					f = 1.0;
			}
			for (j = 0; j <= 2; ++j)
			{
				ent.origin[j] = ent.msg_origins[1][j] + f * delta[j];
				d = ent.msg_angles[0][j] - ent.msg_angles[1][j];
				if (d > 180.0)
					d -= 360.0;
				else if (d < -180.0)
					d += 360.0;
				ent.angles[j] = ent.msg_angles[1][j] + f * d;
			}
		}

		if ((ent.model.flags & Mod.flags.rotate) !== 0)
			ent.angles[1] = bobjrotate;
		if ((ent.effects & Mod.effects.brightfield) !== 0)
			R.EntityParticles(ent);
		if ((ent.effects & Mod.effects.muzzleflash) !== 0)
		{
			dl = CL.AllocDlight(i);
			var fv = [];
			Vec.AngleVectors(ent.angles, fv);
			dl.origin = [
				ent.origin[0] + 18.0 * fv[0],
				ent.origin[1] + 18.0 * fv[1],
				ent.origin[2] + 16.0 + 18.0 * fv[2]
			];
			dl.radius = 200.0 + Math.random() * 32.0;
			dl.minlight = 32.0;
			dl.die = CL.state.time + 0.1;
		}
		if ((ent.effects & Mod.effects.brightlight) !== 0)
		{
			dl = CL.AllocDlight(i);
			dl.origin = [ent.origin[0], ent.origin[1], ent.origin[2] + 16.0];
			dl.radius = 400.0 + Math.random() * 32.0;
			dl.die = CL.state.time + 0.001;
		}
		if ((ent.effects & Mod.effects.dimlight) !== 0)
		{
			dl = CL.AllocDlight(i);
			dl.origin = [ent.origin[0], ent.origin[1], ent.origin[2] + 16.0];
			dl.radius = 200.0 + Math.random() * 32.0;
			dl.die = CL.state.time + 0.001;
		}
		if ((ent.model.flags & Mod.flags.gib) !== 0)
			R.RocketTrail(oldorg, ent.origin, 2);
		else if ((ent.model.flags & Mod.flags.zomgib) !== 0)
			R.RocketTrail(oldorg, ent.origin, 4);
		else if ((ent.model.flags & Mod.flags.tracer) !== 0)
			R.RocketTrail(oldorg, ent.origin, 3);
		else if ((ent.model.flags & Mod.flags.tracer2) !== 0)
			R.RocketTrail(oldorg, ent.origin, 5);
		else if ((ent.model.flags & Mod.flags.rocket) !== 0)
		{
			R.RocketTrail(oldorg, ent.origin, 0);
			dl = CL.AllocDlight(i)
			dl.origin = [ent.origin[0], ent.origin[1], ent.origin[2]];
			dl.radius = 200.0;
			dl.die = CL.state.time + 0.01;
		}
		else if ((ent.model.flags & Mod.flags.grenade) !== 0)
			R.RocketTrail(oldorg, ent.origin, 1);
		else if ((ent.model.flags & Mod.flags.tracer3) !== 0)
			R.RocketTrail(oldorg, ent.origin, 6);

		ent.forcelink = false;
		if ((i !== CL.state.viewentity) || (Chase.active.value !== 0))
			CL.visedicts[CL.numvisedicts++] = ent;
	}
};

CL.ReadFromServer = function()
{
	CL.state.oldtime = CL.state.time;
	CL.state.time += Host.frametime;
	var ret;
	for (;;)
	{
		ret = CL.GetMessage();
		if (ret === -1)
			Host.Error('CL.ReadFromServer: lost server connection');
		if (ret === 0)
			break;
		CL.state.last_received_message = Host.realtime;
		CL.ParseServerMessage();
		if (CL.cls.state !== CL.active.connected)
			break;
	}
	if (CL.shownet.value !== 0)
		Con.Print('\n');
	CL.RelinkEntities();
	CL.UpdateTEnts();
};

CL.SendCmd = function()
{
	if (CL.cls.state !== CL.active.connected)
		return;

	if (CL.cls.signon === 4)
	{
		CL.BaseMove();
		IN.Move();
		CL.SendMove();
	}

	if (CL.cls.demoplayback === true)
	{
		CL.cls.message.cursize = 0;
		return;
	}

	if (CL.cls.message.cursize === 0)
		return;

	if (NET.CanSendMessage(CL.cls.netcon) !== true)
	{
		Con.DPrint('CL.SendCmd: can\'t send\n');
		return;
	}

	if (NET.SendMessage(CL.cls.netcon, CL.cls.message) === -1)
		Host.Error('CL.SendCmd: lost server connection');

	CL.cls.message.cursize = 0;
};

CL.Init = function()
{
	CL.ClearState();
	CL.InitInput();
	CL.InitTEnts();
	CL.name = Cvar.RegisterVariable('_cl_name', 'player', true);
	CL.color = Cvar.RegisterVariable('_cl_color', '0', true);
	CL.upspeed = Cvar.RegisterVariable('cl_upspeed', '200');
	CL.forwardspeed = Cvar.RegisterVariable('cl_forwardspeed', '200', true);
	CL.backspeed = Cvar.RegisterVariable('cl_backspeed', '200', true);
	CL.sidespeed = Cvar.RegisterVariable('cl_sidespeed', '350');
	CL.movespeedkey = Cvar.RegisterVariable('cl_movespeedkey', '2.0');
	CL.yawspeed = Cvar.RegisterVariable('cl_yawspeed', '140');
	CL.pitchspeed = Cvar.RegisterVariable('cl_pitchspeed', '150');
	CL.anglespeedkey = Cvar.RegisterVariable('cl_anglespeedkey', '1.5');
	CL.shownet = Cvar.RegisterVariable('cl_shownet', '0');
	CL.nolerp = Cvar.RegisterVariable('cl_nolerp', '0');
	CL.lookspring = Cvar.RegisterVariable('lookspring', '0', true);
	CL.lookstrafe = Cvar.RegisterVariable('lookstrafe', '0', true);
	CL.sensitivity = Cvar.RegisterVariable('sensitivity', '3', true);
	CL.m_pitch = Cvar.RegisterVariable('m_pitch', '0.022', true);
	CL.m_yaw = Cvar.RegisterVariable('m_yaw', '0.022', true);
	CL.m_forward = Cvar.RegisterVariable('m_forward', '1', true);
	CL.m_side = Cvar.RegisterVariable('m_side', '0.8', true);
	CL.rcon_password = Cvar.RegisterVariable('rcon_password', '');
	CL.rcon_address = Cvar.RegisterVariable('rcon_address', '');
	Cmd.AddCommand('entities', CL.PrintEntities_f);
	Cmd.AddCommand('disconnect', CL.Disconnect);
	Cmd.AddCommand('record', CL.Record_f);
	Cmd.AddCommand('stop', CL.Stop_f);
	Cmd.AddCommand('playdemo', CL.PlayDemo_f);
	Cmd.AddCommand('timedemo', CL.TimeDemo_f);
	Cmd.AddCommand('rcon', CL.Rcon_f);
};

// parse

CL.svc_strings = [
	'bad',
	'nop',
	'disconnect',
	'updatestat',
	'version',
	'setview',
	'sound',
	'time',
	'print',
	'stufftext',
	'setangle',
	'serverinfo',
	'lightstyle',
	'updatename',
	'updatefrags',
	'clientdata',
	'stopsound',
	'updatecolors',
	'particle',
	'damage',
	'spawnstatic',
	'OBSOLETE spawnbinary',
	'spawnbaseline',
	'temp_entity',
	'setpause',
	'signonnum',
	'centerprint',
	'killedmonster',
	'foundsecret',
	'spawnstaticsound',
	'intermission',
	'finale',
	'cdtrack',
	'sellscreen',
	'cutscene'
];

CL.EntityNum = function(num)
{
	if (num < CL.entities.length)
		return CL.entities[num];
	for (; CL.entities.length <= num; )
	{
		CL.entities[CL.entities.length] = {
			num: num,
			update_type: 0,
			baseline: {
				origin: [0.0, 0.0, 0.0],
				angles: [0.0, 0.0, 0.0],
				modelindex: 0,
				frame: 0,
				colormap: 0,
				skin: 0,
				effects: 0
			},
			msgtime: 0.0,
			msg_origins: [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]],
			origin: [0.0, 0.0, 0.0],
			msg_angles: [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]],
			angles: [0.0, 0.0, 0.0],
			frame: 0,
			syncbase: 0.0,
			effects: 0,
			skinnum: 0,
			visframe: 0,
			dlightframe: 0,
			dlightbits: 0
		};
	}
	return CL.entities[num];
};

CL.ParseStartSoundPacket = function()
{
	var field_mask = MSG.ReadByte();
	var volume = ((field_mask & 1) !== 0) ? MSG.ReadByte() : 255;
	var attenuation = ((field_mask & 2) !== 0) ? MSG.ReadByte() * 0.015625 : 1.0;
	var channel = MSG.ReadShort();
	var sound_num = MSG.ReadByte();
	var ent = channel >> 3;
	channel &= 7;
	var pos = [MSG.ReadCoord(), MSG.ReadCoord(), MSG.ReadCoord()];
	S.StartSound(ent, channel, CL.state.sound_precache[sound_num], pos, volume / 255.0, attenuation);
};

CL.lastmsg = 0.0;
CL.KeepaliveMessage = function()
{
	if ((SV.server.active === true) || (CL.cls.demoplayback === true))
		return;
	var oldsize = NET.message.cursize;
	var olddata = new Uint8Array(8192);
	olddata.set(new Uint8Array(NET.message.data, 0, oldsize));
	var ret;
	for (;;)
	{
		ret = CL.GetMessage();
		switch (ret)
		{
		case 0:
			break;
		case 1:
			Host.Error('CL.KeepaliveMessage: received a message');
		case 2:
			if (MSG.ReadByte() !== Protocol.svc.nop)
				Host.Error('CL.KeepaliveMessage: datagram wasn\'t a nop');
		default:
			Host.Error('CL.KeepaliveMessage: CL.GetMessage failed');
		}
		if (ret === 0)
			break;
	}
	NET.message.cursize = oldsize;
	(new Uint8Array(NET.message.data, 0, oldsize)).set(olddata.subarray(0, oldsize));
	var time = Sys.FloatTime();
	if ((time - CL.lastmsg) < 5.0)
		return;
	CL.lastmsg = time;
	Con.Print('--> client to server keepalive\n');
	MSG.WriteByte(CL.cls.message, Protocol.clc.nop);
	NET.SendMessage(CL.cls.netcon, CL.cls.message);
	CL.cls.message.cursize = 0;
};

CL.ParseServerInfo = function()
{
	Con.DPrint('Serverinfo packet received.\n');
	CL.ClearState();
	var i = MSG.ReadLong();
	if (i !== Protocol.version)
	{
		Con.Print('Server returned version ' + i + ', not ' + Protocol.version + '\n');
		return;
	}
	CL.state.maxclients = MSG.ReadByte();
	if ((CL.state.maxclients <= 0) || (CL.state.maxclients > 16))
	{
		Con.Print('Bad maxclients (' + CL.state.maxclients + ') from server\n');
		return;
	}
	CL.state.scores = [];
	for (i = 0; i < CL.state.maxclients; ++i)
	{
		CL.state.scores[i] = {
			name: '',
			entertime: 0.0,
			frags: 0,
			colors: 0
		};
	}
	CL.state.gametype = MSG.ReadByte();
	CL.state.levelname = MSG.ReadString();
	Con.Print('\n\n\35\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\36\37\n\n');
	Con.Print('\2' + CL.state.levelname + '\n');

	var str;
	var nummodels, model_precache = [];
	for (nummodels = 1; ; ++nummodels)
	{
		str = MSG.ReadString();
		if (str.length === 0)
			break;
		model_precache[nummodels] = str;
	}
	var numsounds, sound_precache = [];
	for (numsounds = 1; ; ++numsounds)
	{
		str = MSG.ReadString();
		if (str.length === 0)
			break;
		sound_precache[numsounds] = str;
	}

	CL.state.model_precache = [];
	for (i = 1; i < nummodels; ++i)
	{
		CL.state.model_precache[i] = Mod.ForName(model_precache[i]);
		if (CL.state.model_precache[i] == null)
		{
			Con.Print('Model ' + model_precache[i] + ' not found\n');
			return;
		}
		CL.KeepaliveMessage();
	}
	CL.state.sound_precache = [];
	for (i = 1; i < numsounds; ++i)
	{
		CL.state.sound_precache[i] = S.PrecacheSound(sound_precache[i]);
		CL.KeepaliveMessage();
	}

	CL.state.worldmodel = CL.state.model_precache[1];
	CL.EntityNum(0).model = CL.state.worldmodel;
	R.NewMap();
	Host.noclip_anglehack = false;
};

CL.ParseUpdate = function(bits)
{
	if (CL.cls.signon === 3)
	{
		CL.cls.signon = 4;
		CL.SignonReply();
	}

	if ((bits & Protocol.u.morebits) !== 0)
		bits += (MSG.ReadByte() << 8);

	var ent = CL.EntityNum(((bits & Protocol.u.longentity) !== 0) ? MSG.ReadShort() : MSG.ReadByte());

	var forcelink = ent.msgtime !== CL.state.mtime[1];
	ent.msgtime = CL.state.mtime[0];

	var model = CL.state.model_precache[((bits & Protocol.u.model) !== 0) ? MSG.ReadByte() : ent.baseline.modelindex];
	if (model !== ent.model)
	{
		ent.model = model;
		if (model != null)
			ent.syncbase = (model.random === true) ? Math.random() : 0.0;
		else
			forcelink = true;
	}

	ent.frame = ((bits & Protocol.u.frame) !== 0) ? MSG.ReadByte() : ent.baseline.frame;
	ent.colormap = ((bits & Protocol.u.colormap) !== 0) ? MSG.ReadByte() : ent.baseline.colormap;
	if (ent.colormap > CL.state.maxclients)
		Sys.Error('i >= cl.maxclients');
	ent.skinnum = ((bits & Protocol.u.skin) !== 0) ? MSG.ReadByte() : ent.baseline.skin;
	ent.effects = ((bits & Protocol.u.effects) !== 0) ? MSG.ReadByte() : ent.baseline.effects;

	Vec.Copy(ent.msg_origins[0], ent.msg_origins[1]);
	Vec.Copy(ent.msg_angles[0], ent.msg_angles[1]);
	ent.msg_origins[0][0] = ((bits & Protocol.u.origin1) !== 0) ? MSG.ReadCoord() : ent.baseline.origin[0];
	ent.msg_angles[0][0] = ((bits & Protocol.u.angle1) !== 0) ? MSG.ReadAngle() : ent.baseline.angles[0];
	ent.msg_origins[0][1] = ((bits & Protocol.u.origin2) !== 0) ? MSG.ReadCoord() : ent.baseline.origin[1];
	ent.msg_angles[0][1] = ((bits & Protocol.u.angle2) !== 0) ? MSG.ReadAngle() : ent.baseline.angles[1];
	ent.msg_origins[0][2] = ((bits & Protocol.u.origin3) !== 0) ? MSG.ReadCoord() : ent.baseline.origin[2];
	ent.msg_angles[0][2] = ((bits & Protocol.u.angle3) !== 0) ? MSG.ReadAngle() : ent.baseline.angles[2];

	if ((bits & Protocol.u.nolerp) !== 0)
		ent.forcelink = true;

	if (forcelink === true)
	{
		Vec.Copy(ent.msg_origins[0], ent.origin);
		Vec.Copy(ent.origin, ent.msg_origins[1]);
		Vec.Copy(ent.msg_angles[0], ent.angles);
		Vec.Copy(ent.angles, ent.msg_angles[1]);
		ent.forcelink = true;
	}
};

CL.ParseBaseline = function(ent)
{
	ent.baseline.modelindex = MSG.ReadByte();
	ent.baseline.frame = MSG.ReadByte();
	ent.baseline.colormap = MSG.ReadByte();
	ent.baseline.skin = MSG.ReadByte();
	ent.baseline.origin[0] = MSG.ReadCoord();
	ent.baseline.angles[0] = MSG.ReadAngle();
	ent.baseline.origin[1] = MSG.ReadCoord();
	ent.baseline.angles[1] = MSG.ReadAngle();
	ent.baseline.origin[2] = MSG.ReadCoord();
	ent.baseline.angles[2] = MSG.ReadAngle();
};

CL.ParseClientdata = function(bits)
{
	var i;

	CL.state.viewheight = ((bits & Protocol.su.viewheight) !== 0) ? MSG.ReadChar() : Protocol.default_viewheight;
	CL.state.idealpitch = ((bits & Protocol.su.idealpitch) !== 0) ? MSG.ReadChar() : 0.0;

	CL.state.mvelocity[1] = [CL.state.mvelocity[0][0], CL.state.mvelocity[0][1], CL.state.mvelocity[0][2]];
	for (i = 0; i <= 2; ++i)
	{
		if ((bits & (Protocol.su.punch1 << i)) !== 0)
			CL.state.punchangle[i] = MSG.ReadChar();
		else
			CL.state.punchangle[i] = 0.0;
		if ((bits & (Protocol.su.velocity1 << i)) !== 0)
			CL.state.mvelocity[0][i] = MSG.ReadChar() * 16.0;
		else
			CL.state.mvelocity[0][i] = 0.0;
	}

	i = MSG.ReadLong();
	var j;
	if (CL.state.items !== i)
	{
		for (j = 0; j <= 31; ++j)
		{
			if ((((i >>> j) & 1) !== 0) && (((CL.state.items >>> j) & 1) === 0))
				CL.state.item_gettime[j] = CL.state.time;
		}
		CL.state.items = i;
	}

	CL.state.onground = (bits & Protocol.su.onground) !== 0;
	CL.state.inwater = (bits & Protocol.su.inwater) !== 0;

	CL.state.stats[Def.stat.weaponframe] = ((bits & Protocol.su.weaponframe) !== 0) ? MSG.ReadByte() : 0;
	CL.state.stats[Def.stat.armor] = ((bits & Protocol.su.armor) !== 0) ? MSG.ReadByte() : 0;
	CL.state.stats[Def.stat.weapon] = ((bits & Protocol.su.weapon) !== 0) ? MSG.ReadByte() : 0;
	CL.state.stats[Def.stat.health] = MSG.ReadShort();
	CL.state.stats[Def.stat.ammo] = MSG.ReadByte();
	CL.state.stats[Def.stat.shells] = MSG.ReadByte();
	CL.state.stats[Def.stat.nails] = MSG.ReadByte();
	CL.state.stats[Def.stat.rockets] = MSG.ReadByte();
	CL.state.stats[Def.stat.cells] = MSG.ReadByte();
	if (COM.standard_quake === true)
		CL.state.stats[Def.stat.activeweapon] = MSG.ReadByte();
	else
		CL.state.stats[Def.stat.activeweapon] = 1 << MSG.ReadByte();
};

CL.ParseStatic = function()
{
	var ent = {
		num: -1,
		update_type: 0,
		baseline: {origin: [], angles: []},
		msgtime: 0.0,
		msg_origins: [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]],
		msg_angles: [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]],
		syncbase: 0.0,
		visframe: 0,
		dlightframe: 0,
		dlightbits: 0,
		leafs: []
	};
	CL.static_entities[CL.state.num_statics++] = ent;
	CL.ParseBaseline(ent);
	ent.model = CL.state.model_precache[ent.baseline.modelindex];
	ent.frame = ent.baseline.frame;
	ent.skinnum = ent.baseline.skin;
	ent.effects = ent.baseline.effects;
	ent.origin = [ent.baseline.origin[0], ent.baseline.origin[1], ent.baseline.origin[2]];
	ent.angles = [ent.baseline.angles[0], ent.baseline.angles[1], ent.baseline.angles[2]];
	R.currententity = ent;
	R.emins = [ent.origin[0] + ent.model.mins[0], ent.origin[1] + ent.model.mins[1], ent.origin[2] + ent.model.mins[2]];
	R.emaxs = [ent.origin[0] + ent.model.maxs[0], ent.origin[1] + ent.model.maxs[1], ent.origin[2] + ent.model.maxs[2]];
	R.SplitEntityOnNode(CL.state.worldmodel.nodes[0]);
};

CL.ParseStaticSound = function()
{
	var org = [MSG.ReadCoord(), MSG.ReadCoord(), MSG.ReadCoord()];
	var sound_num = MSG.ReadByte();
	var vol = MSG.ReadByte();
	var atten = MSG.ReadByte();
	S.StaticSound(CL.state.sound_precache[sound_num], org, vol / 255.0, atten);
};

CL.Shownet = function(x)
{
	if (CL.shownet.value === 2)
	{
		Con.Print((MSG.readcount <= 99 ? (MSG.readcount <= 9 ? '  ' : ' ') : '')
			+ (MSG.readcount - 1) + ':' + x + '\n');
	}
};

CL.ParseServerMessage = function()
{
	if (CL.shownet.value === 1)
		Con.Print(NET.message.cursize + ' ');
	else if (CL.shownet.value === 2)
		Con.Print('------------------\n');

	CL.state.onground = false;

	MSG.BeginReading();

	var cmd, i;
	for (;;)
	{
		if (MSG.badread === true)
			Host.Error('CL.ParseServerMessage: Bad server message');

		cmd = MSG.ReadByte();

		if (cmd === -1)
		{
			CL.Shownet('END OF MESSAGE');
			return;
		}

		if ((cmd & 128) !== 0)
		{
			CL.Shownet('fast update');
			CL.ParseUpdate(cmd & 127);
			continue;
		}

		CL.Shownet('svc_' + CL.svc_strings[cmd]);
		switch (cmd)
		{
		case Protocol.svc.nop:
			continue;
		case Protocol.svc.time:
			CL.state.mtime[1] = CL.state.mtime[0];
			CL.state.mtime[0] = MSG.ReadFloat();
			continue;
		case Protocol.svc.clientdata:
			CL.ParseClientdata(MSG.ReadShort());
			continue;
		case Protocol.svc.version:
			i = MSG.ReadLong();
			if (i !== Protocol.version)
				Host.Error('CL.ParseServerMessage: Server is protocol ' + i + ' instead of ' + Protocol.version + '\n');
			continue;
		case Protocol.svc.disconnect:
			Host.EndGame('Server disconnected\n');
		case Protocol.svc.print:
			Con.Print(MSG.ReadString());
			continue;
		case Protocol.svc.centerprint:
			SCR.CenterPrint(MSG.ReadString());
			continue;
		case Protocol.svc.stufftext:
			Cmd.text += MSG.ReadString();
			continue;
		case Protocol.svc.damage:
			V.ParseDamage();
			continue;
		case Protocol.svc.serverinfo:
			CL.ParseServerInfo();
			SCR.recalc_refdef = true;
			continue;
		case Protocol.svc.setangle:
			CL.state.viewangles[0] = MSG.ReadAngle();
			CL.state.viewangles[1] = MSG.ReadAngle();
			CL.state.viewangles[2] = MSG.ReadAngle();
			continue;
		case Protocol.svc.setview:
			CL.state.viewentity = MSG.ReadShort();
			continue;
		case Protocol.svc.lightstyle:
			i = MSG.ReadByte();
			if (i >= 64)
				Sys.Error('svc_lightstyle > MAX_LIGHTSTYLES');
			CL.lightstyle[i] = MSG.ReadString();
			continue;
		case Protocol.svc.sound:
			CL.ParseStartSoundPacket();
			continue;
		case Protocol.svc.stopsound:
			i = MSG.ReadShort();
			S.StopSound(i >> 3, i & 7);
			continue;
		case Protocol.svc.updatename:
			i = MSG.ReadByte();
			if (i >= CL.state.maxclients)
				Host.Error('CL.ParseServerMessage: svc_updatename > MAX_SCOREBOARD');
			CL.state.scores[i].name = MSG.ReadString();
			continue;
		case Protocol.svc.updatefrags:
			i = MSG.ReadByte();
			if (i >= CL.state.maxclients)
				Host.Error('CL.ParseServerMessage: svc_updatefrags > MAX_SCOREBOARD');
			CL.state.scores[i].frags = MSG.ReadShort();
			continue;
		case Protocol.svc.updatecolors:
			i = MSG.ReadByte();
			if (i >= CL.state.maxclients)
				Host.Error('CL.ParseServerMessage: svc_updatecolors > MAX_SCOREBOARD');
			CL.state.scores[i].colors = MSG.ReadByte();
			continue;
		case Protocol.svc.particle:
			R.ParseParticleEffect();
			continue;
		case Protocol.svc.spawnbaseline:
			CL.ParseBaseline(CL.EntityNum(MSG.ReadShort()));
			continue;
		case Protocol.svc.spawnstatic:
			CL.ParseStatic();
			continue;
		case Protocol.svc.temp_entity:
			CL.ParseTEnt();
			continue;
		case Protocol.svc.setpause:
			CL.state.paused = MSG.ReadByte() !== 0;
			if (CL.state.paused === true)
				CDAudio.Pause();
			else
				CDAudio.Resume();
			continue;
		case Protocol.svc.signonnum:
			i = MSG.ReadByte();
			if (i <= CL.cls.signon)
				Host.Error('Received signon ' + i + ' when at ' + CL.cls.signon);
			CL.cls.signon = i;
			CL.SignonReply();
			continue;
		case Protocol.svc.killedmonster:
			++CL.state.stats[Def.stat.monsters];
			continue;
		case Protocol.svc.foundsecret:
			++CL.state.stats[Def.stat.secrets];
			continue;
		case Protocol.svc.updatestat:
			i = MSG.ReadByte();
			if (i >= 32)
				Sys.Error('svc_updatestat: ' + i + ' is invalid');
			CL.state.stats[i] = MSG.ReadLong();
			continue;
		case Protocol.svc.spawnstaticsound:
			CL.ParseStaticSound();
			continue;
		case Protocol.svc.cdtrack:
			CL.state.cdtrack = MSG.ReadByte();
			MSG.ReadByte();
			if (((CL.cls.demoplayback === true) || (CL.cls.demorecording === true)) && (CL.cls.forcetrack !== -1))
				CDAudio.Play(CL.cls.forcetrack, true);
			else
				CDAudio.Play(CL.state.cdtrack, true);
			continue;
		case Protocol.svc.intermission:
			CL.state.intermission = 1;
			CL.state.completed_time = CL.state.time;
			SCR.recalc_refdef = true;
			continue;
		case Protocol.svc.finale:
			CL.state.intermission = 2;
			CL.state.completed_time = CL.state.time;
			SCR.recalc_refdef = true;
			SCR.CenterPrint(MSG.ReadString());
			continue;
		case Protocol.svc.cutscene:
			CL.state.intermission = 3;
			CL.state.completed_time = CL.state.time;
			SCR.recalc_refdef = true;
			SCR.CenterPrint(MSG.ReadString());
			continue;
		case Protocol.svc.sellscreen:
			Cmd.ExecuteString('help');
			continue;
		}
		Host.Error('CL.ParseServerMessage: Illegible server message\n');
	}
};

// tent

CL.temp_entities = [];

CL.InitTEnts = function()
{
	CL.sfx_wizhit = S.PrecacheSound('wizard/hit.wav');
	CL.sfx_knighthit = S.PrecacheSound('hknight/hit.wav');
	CL.sfx_tink1 = S.PrecacheSound('weapons/tink1.wav');
	CL.sfx_ric1 = S.PrecacheSound('weapons/ric1.wav');
	CL.sfx_ric2 = S.PrecacheSound('weapons/ric2.wav');
	CL.sfx_ric3 = S.PrecacheSound('weapons/ric3.wav');
	CL.sfx_r_exp3 = S.PrecacheSound('weapons/r_exp3.wav');
};

CL.ParseBeam = function(m)
{
	var ent = MSG.ReadShort();
	var start = [MSG.ReadCoord(), MSG.ReadCoord(), MSG.ReadCoord()];
	var end = [MSG.ReadCoord(), MSG.ReadCoord(), MSG.ReadCoord()];
	var i, b;
	for (i = 0; i <= 23; ++i)
	{
		b = CL.beams[i];
		if (b.entity !== ent)
			continue;
		b.model = m;
		b.endtime = CL.state.time + 0.2;
		b.start = [start[0], start[1], start[2]];
		b.end = [end[0], end[1], end[2]];
		return;
	}
	for (i = 0; i <= 23; ++i)
	{
		b = CL.beams[i];
		if ((b.model != null) && (b.endtime >= CL.state.time))
			continue;
		b.entity = ent;
		b.model = m;
		b.endtime = CL.state.time + 0.2;
		b.start = [start[0], start[1], start[2]];
		b.end = [end[0], end[1], end[2]];
		return;
	}
	Con.Print('beam list overflow!\n');
};

CL.ParseTEnt = function()
{
	var type = MSG.ReadByte();

	switch (type)
	{
	case Protocol.te.lightning1:
		CL.ParseBeam(Mod.ForName('progs/bolt.mdl', true));
		return;
	case Protocol.te.lightning2:
		CL.ParseBeam(Mod.ForName('progs/bolt2.mdl', true));
		return;
	case Protocol.te.lightning3:
		CL.ParseBeam(Mod.ForName('progs/bolt3.mdl', true));
		return;
	case Protocol.te.beam:
		CL.ParseBeam(Mod.ForName('progs/beam.mdl', true));
		return;
	}

	var pos = [MSG.ReadCoord(), MSG.ReadCoord(), MSG.ReadCoord()];
	var dl;
	switch (type)
	{
	case Protocol.te.wizspike:
		R.RunParticleEffect(pos, Vec.origin, 20, 20);
		S.StartSound(-1, 0, CL.sfx_wizhit, pos, 1.0, 1.0);
		return;
	case Protocol.te.knightspike:
		R.RunParticleEffect(pos, Vec.origin, 226, 20);
		S.StartSound(-1, 0, CL.sfx_knighthit, pos, 1.0, 1.0);
		return;
	case Protocol.te.spike:
		R.RunParticleEffect(pos, Vec.origin, 0, 10);
		return;
	case Protocol.te.superspike:
		R.RunParticleEffect(pos, Vec.origin, 0, 20);
		return;
	case Protocol.te.gunshot:
		R.RunParticleEffect(pos, Vec.origin, 0, 20);
		return;
	case Protocol.te.explosion:
		R.ParticleExplosion(pos);
		dl = CL.AllocDlight(0);
		dl.origin = [pos[0], pos[1], pos[2]];
		dl.radius = 350.0;
		dl.die = CL.state.time + 0.5;
		dl.decay = 300.0;
		S.StartSound(-1, 0, CL.sfx_r_exp3, pos, 1.0, 1.0);
		return;
	case Protocol.te.tarexplosion:
		R.BlobExplosion(pos);
		S.StartSound(-1, 0, CL.sfx_r_exp3, pos, 1.0, 1.0);
		return;
	case Protocol.te.lavasplash:
		R.LavaSplash(pos);
		return;
	case Protocol.te.teleport:
		R.TeleportSplash(pos);
		return;
	case Protocol.te.explosion2:
		var colorStart = MSG.ReadByte();
		var colorLength = MSG.ReadByte();
		R.ParticleExplosion2(pos, colorStart, colorLength);
		dl = CL.AllocDlight(0);
		dl.origin = [pos[0], pos[1], pos[2]];
		dl.radius = 350.0;
		dl.die = CL.state.time + 0.5;
		dl.decay = 300.0;
		S.StartSound(-1, 0, CL.sfx_r_exp3, pos, 1.0, 1.0);
		return;
	}

	Sys.Error('CL.ParseTEnt: bad type');
};

CL.NewTempEntity = function()
{
	var ent = {frame: 0, syncbase: 0.0, skinnum: 0};
	CL.temp_entities[CL.num_temp_entities++] = ent;
	CL.visedicts[CL.numvisedicts++] = ent;
	return ent;
};

CL.UpdateTEnts = function()
{
	CL.num_temp_entities = 0;
	var i, b, dist = [], yaw, pitch, org = [], d, ent;
	for (i = 0; i <= 23; ++i)
	{
		b = CL.beams[i];
		if ((b.model == null) || (b.endtime < CL.state.time))
			continue;
		if (b.entity === CL.state.viewentity)
			Vec.Copy(CL.entities[CL.state.viewentity].origin, b.start);
		dist[0] = b.end[0] - b.start[0];
		dist[1] = b.end[1] - b.start[1];
		dist[2] = b.end[2] - b.start[2];
		if ((dist[0] === 0.0) && (dist[1] === 0.0))
		{
			yaw = 0;
			pitch = dist[2] > 0.0 ? 90 : 270;
		}
		else
		{
			yaw = (Math.atan2(dist[1], dist[0]) * 180.0 / Math.PI) >> 0;
			if (yaw < 0)
				yaw += 360;
			pitch = (Math.atan2(dist[2], Math.sqrt(dist[0] * dist[0] + dist[1] * dist[1])) * 180.0 / Math.PI) >> 0;
			if (pitch < 0)
				pitch += 360;
		}
		org[0] = b.start[0];
		org[1] = b.start[1];
		org[2] = b.start[2];
		d = Math.sqrt(dist[0] * dist[0] + dist[1] * dist[1] + dist[2] * dist[2]);
		if (d !== 0.0)
		{
			dist[0] /= d;
			dist[1] /= d;
			dist[2] /= d;
		}
		for (; d > 0.0; )
		{
			ent = CL.NewTempEntity();
			ent.origin = [org[0], org[1], org[2]];
			ent.model = b.model;
			ent.angles = [pitch, yaw, Math.random() * 360.0];
			org[0] += dist[0] * 30.0;
			org[1] += dist[1] * 30.0;
			org[2] += dist[2] * 30.0;
			d -= 30.0;
		}
	}
};

// ---- WebQuake/Cmd.js ----
Cmd = {};

Cmd.alias = [];

Cmd.Wait_f = function()
{
	Cmd.wait = true;
};

Cmd.text = '';

Cmd.Execute = function()
{
	var i, c, line = '', quotes = false;
	while (Cmd.text.length !== 0)
	{
		c = Cmd.text.charCodeAt(0);
		Cmd.text = Cmd.text.substring(1);
		if (c === 34)
		{
			quotes = !quotes;
			line += '\42';
			continue;
		}
		if (((quotes === false) && (c === 59)) || (c === 10))
		{
			if (line.length === 0)
				continue;
			Cmd.ExecuteString(line);
			if (Cmd.wait === true)
			{
				Cmd.wait = false;
				return;
			}
			line = '';
			continue;
		}
		line += String.fromCharCode(c);
	}
	Cmd.text = '';
};

Cmd.StuffCmds_f = function()
{
	var i, s = false, build = '', c;
	for (i = 0; i < COM.argv.length; ++i)
	{
		c = COM.argv[i].charCodeAt(0);
		if (s === true)
		{
			if (c === 43)
			{
				build += ('\n' + COM.argv[i].substring(1) + ' ');
				continue;
			}
			if (c === 45)
			{
				s = false;
				build += '\n';
				continue;
			}
			build += (COM.argv[i] + ' ');
			continue;
		}
		if (c === 43)
		{
			s = true;
			build += (COM.argv[i].substring(1) + ' ');
		}
	}
	if (build.length !== 0)
		Cmd.text = build + '\n' + Cmd.text;
};

Cmd.Exec_f = function()
{
	if (Cmd.argv.length !== 2)
	{
		Con.Print('exec <filename> : execute a script file\n');
		return;
	}
	var f = COM.LoadTextFile(Cmd.argv[1]);
	if (f == null)
	{
		Con.Print('couldn\'t exec ' + Cmd.argv[1] + '\n');
		return;
	}
	Con.Print('execing ' + Cmd.argv[1] + '\n');
	Cmd.text = f + Cmd.text;
};

Cmd.Echo_f = function()
{
	var i;
	for (i = 1; i < Cmd.argv.length; ++i)
		Con.Print(Cmd.argv[i] + ' ');
	Con.Print('\n');
};

Cmd.Alias_f = function()
{
	var i;
	if (Cmd.argv.length <= 1)
	{
		Con.Print('Current alias commands:\n');
		for (i = 0; i < Cmd.alias.length; ++i)
			Con.Print(Cmd.alias[i].name + ' : ' + Cmd.alias[i].value + '\n');
	}
	var s = Cmd.argv[1], value = '';
	for (i = 0; i < Cmd.alias.length; ++i)
	{
		if (Cmd.alias[i].name === s)
			break;
	}
	var j;
	for (j = 2; j < Cmd.argv.length; ++j)
	{
		value += Cmd.argv[j];
		if (j !== Cmd.argv.length)
			value += ' ';
	}
	Cmd.alias[i] = {name: s, value: value + '\n'};
};

Cmd.argv = [];
Cmd.functions = [];

Cmd.Init = function()
{
	Cmd.AddCommand('stuffcmds', Cmd.StuffCmds_f);
	Cmd.AddCommand('exec', Cmd.Exec_f);
	Cmd.AddCommand('echo', Cmd.Echo_f);
	Cmd.AddCommand('alias', Cmd.Alias_f);
	Cmd.AddCommand('cmd', Cmd.ForwardToServer);
	Cmd.AddCommand('wait', Cmd.Wait_f);
};

Cmd.TokenizeString = function(text)
{
	Cmd.argv = [];
	var i, c;
	for (;;)
	{
		for (i = 0; i < text.length; ++i)
		{
			c = text.charCodeAt(i);
			if ((c > 32) || (c === 10))
				break;
		}
		if (Cmd.argv.length === 1)
			Cmd.args = text.substring(i);
		if ((text.charCodeAt(i) === 10) || (i >= text.length))
			return;
		text = COM.Parse(text);
		if (text == null)
			return;
		Cmd.argv[Cmd.argv.length] = COM.token;
	}
};

Cmd.AddCommand = function(name, command)
{
	var i;
	for (i = 0; i < Cvar.vars.length; ++i)
	{
		if (Cvar.vars[i].name === name)
		{
			Con.Print('Cmd.AddCommand: ' + name + ' already defined as a var\n');
			return;
		}
	}
	for (i = 0; i < Cmd.functions.length; ++i)
	{
		if (Cmd.functions[i].name === name)
		{
			Con.Print('Cmd.AddCommand: ' + name + ' already defined\n');
			return;
		}
	}
	Cmd.functions[Cmd.functions.length] = {name: name, command: command};
};

Cmd.CompleteCommand = function(partial)
{
	if (partial.length === 0)
		return;
	var i;
	for (i = 0; i < Cmd.functions.length; ++i)
	{
		if (Cmd.functions[i].name.substring(0, partial.length) === partial)
			return Cmd.functions[i].name;
	}
};

Cmd.ExecuteString = function(text, client)
{
	Cmd.client = client;
	Cmd.TokenizeString(text);
	if (Cmd.argv.length === 0)
		return;
	var name = Cmd.argv[0].toLowerCase();
	var i;
	for (i = 0; i < Cmd.functions.length; ++i)
	{
		if (Cmd.functions[i].name === name)
		{
			Cmd.functions[i].command();
			return;
		}
	}
	for (i = 0; i < Cmd.alias.length; ++i)
	{
		if (Cmd.alias[i].name === name)
		{
			Cmd.text = Cmd.alias[i].value + Cmd.text;
			return;
		}
	}
	if (Cvar.Command() !== true)
		Con.Print('Unknown command "' + name + '"\n');
};

Cmd.ForwardToServer = function()
{
	if (CL.cls.state !== CL.active.connected)
	{
		Con.Print('Can\'t "' + Cmd.argv[0] + '", not connected\n');
		return;
	}
	if (CL.cls.demoplayback === true)
		return;
	var args = String.fromCharCode(Protocol.clc.stringcmd);
	if (Cmd.argv[0].toLowerCase() !== 'cmd')
		args += Cmd.argv[0] + ' ';
	if (Cmd.argv.length >= 2)
		args += Cmd.args;
	else
		args += '\n';
	MSG.WriteString(CL.cls.message, args);
};

// ---- WebQuake/COM.js ----
COM = {};

COM.argv = [];

COM.standard_quake = true;

COM.DefaultExtension = function(path, extension)
{
	var i, src;
	for (i = path.length - 1; i >= 0; --i)
	{
		src = path.charCodeAt(i);
		if (src === 47)
			break;
		if (src === 46)
			return path;
	}
	return path + extension;
};

COM.Parse = function(data)
{
	COM.token = '';
	var i = 0, c;
	if (data.length === 0)
		return;
		
	var skipwhite = true;
	for (;;)
	{
		if (skipwhite !== true)
			break;
		skipwhite = false;
		for (;;)
		{
			if (i >= data.length)
				return;
			c = data.charCodeAt(i);
			if (c > 32)
				break;
			++i;
		}
		if ((c === 47) && (data.charCodeAt(i + 1) == 47))
		{
			for (;;)
			{
				if ((i >= data.length) || (data.charCodeAt(i) === 10))
					break;
				++i;
			}
			skipwhite = true;
		}
	}

	if (c === 34)
	{
		++i;
		for (;;)
		{
			c = data.charCodeAt(i);
			++i;
			if ((i >= data.length) || (c === 34))
				return data.substring(i);
			COM.token += String.fromCharCode(c);
		}
	}

	for (;;)
	{
		if ((i >= data.length) || (c <= 32))
			break;
		COM.token += String.fromCharCode(c);
		++i;
		c = data.charCodeAt(i);
	}

	return data.substring(i);
};

COM.CheckParm = function(parm)
{
	var i;
	for (i = 1; i < COM.argv.length; ++i)
	{
		if (COM.argv[i] === parm)
			return i;
	}
};

COM.CheckRegistered = function()
{
	var h = COM.LoadFile('gfx/pop.lmp');
	if (h == null)
	{
		Con.Print('Playing shareware version.\n');
		if (COM.modified === true)
			Sys.Error('You must have the registered version to use modified games');
		return;
	}
	var check = new Uint8Array(h);
	var pop =
	[
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x66, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x66, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x66, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x67, 0x00, 0x00,
		0x00, 0x00, 0x66, 0x65, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x65, 0x66, 0x00,
		0x00, 0x63, 0x65, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x61, 0x65, 0x63,
		0x00, 0x64, 0x65, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x61, 0x65, 0x64,
		0x00, 0x64, 0x65, 0x64, 0x00, 0x00, 0x64, 0x69, 0x69, 0x69, 0x64, 0x00, 0x00, 0x64, 0x65, 0x64,
		0x00, 0x63, 0x65, 0x68, 0x62, 0x00, 0x00, 0x64, 0x68, 0x64, 0x00, 0x00, 0x62, 0x68, 0x65, 0x63,
		0x00, 0x00, 0x65, 0x67, 0x69, 0x63, 0x00, 0x64, 0x67, 0x64, 0x00, 0x63, 0x69, 0x67, 0x65, 0x00,
		0x00, 0x00, 0x62, 0x66, 0x67, 0x69, 0x6A, 0x68, 0x67, 0x68, 0x6A, 0x69, 0x67, 0x66, 0x62, 0x00,
		0x00, 0x00, 0x00, 0x62, 0x65, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x65, 0x62, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x62, 0x63, 0x64, 0x66, 0x64, 0x63, 0x62, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x62, 0x66, 0x62, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x61, 0x66, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x65, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
	];
	var i;
	for (i = 0; i < 256; ++i)
	{
		if (check[i] !== pop[i])
			Sys.Error('Corrupted data file.');
	}
	Cvar.Set('registered', '1');
	Con.Print('Playing registered version.\n');
};

COM.InitArgv = function(argv)
{
	COM.cmdline = (argv.join(' ') + ' ').substring(0, 256);
	var i;
	for (i = 0; i < argv.length; ++i)
		COM.argv[i] = argv[i];	
	if (COM.CheckParm('-safe') != null)
	{
		COM.argv[COM.argv.length] = '-nosound';
		COM.argv[COM.argv.length] = '-nocdaudio';
		COM.argv[COM.argv.length] = '-nomouse';
	}
	if (COM.CheckParm('-rogue') != null)
	{
		COM.rogue = true;
		COM.standard_quake = false;
	}
	else if (COM.CheckParm('-hipnotic') != null)
	{
		COM.hipnotic = true;
		COM.standard_quake = false;
	}
};

COM.Init = function()
{
	// Ghosty: the game's files are in memory (Sys.files), never fetched, so no web address is needed.

	var swaptest = new ArrayBuffer(2);
	var swaptestview = new Uint8Array(swaptest);
	swaptestview[0] = 1;
	swaptestview[1] = 0;
	if ((new Uint16Array(swaptest))[0] === 1)
		COM.LittleLong = (function(l) {return l;});
	else
		COM.LittleLong = (function(l) {return (l >>> 24) + ((l & 0xff0000) >>> 8) + (((l & 0xff00) << 8) >>> 0) + ((l << 24) >>> 0);});

	COM.registered = Cvar.RegisterVariable('registered', '0');
	Cvar.RegisterVariable('cmdline', COM.cmdline, false, true);
	Cmd.AddCommand('path', COM.Path_f);
	COM.InitFilesystem();
	COM.CheckRegistered();
};

COM.searchpaths = [];

COM.Path_f = function()
{
	Con.Print('Current search path:\n');
	var i = COM.searchpaths.length, j, s;
	for (i = COM.searchpaths.length - 1; i >= 0; --i)
	{
		s = COM.searchpaths[i];
		for (j = s.pack.length - 1; j >= 0; --j)
			Con.Print(s.filename + '/' + 'pak' + j + '.pak (' + s.pack[j].length + ' files)\n');
		Con.Print(s.filename + '\n');
	}
};

COM.WriteFile = function(filename, data, len)
{
	filename = filename.toLowerCase();
	var dest = [], i;
	for (i = 0; i < len; ++i)
		dest[i] = String.fromCharCode(data[i]);
	try
	{
		localStorage.setItem('Quake.' + COM.searchpaths[COM.searchpaths.length - 1].filename + '/' + filename, dest.join(''));
	}
	catch (e)
	{
		Sys.Print('COM.WriteFile: failed on ' + filename + '\n');
		return;
	}
	Sys.Print('COM.WriteFile: ' + filename + '\n');
	return true;
};

COM.WriteTextFile = function(filename, data)
{
	filename = filename.toLowerCase();
	try
	{
		localStorage.setItem('Quake.' + COM.searchpaths[COM.searchpaths.length - 1].filename + '/' + filename, data);
	}
	catch (e)
	{
		Sys.Print('COM.WriteTextFile: failed on ' + filename + '\n');
		return;
	}
	Sys.Print('COM.WriteTextFile: ' + filename + '\n');
	return true;
};

// Ghosty: from memory (Sys.files, 'id1/pak0.pak' and the like) instead of ranged XMLHttpRequests.
COM.LoadFile = function(filename)
{
	filename = filename.toLowerCase();
	var i, j, k, search, netpath, pak, file, data;
	Draw.BeginDisc();
	for (i = COM.searchpaths.length - 1; i >= 0; --i)
	{
		search = COM.searchpaths[i];
		netpath = search.filename + '/' + filename;
		data = localStorage.getItem('Quake.' + netpath);
		if (data != null)
		{
			Sys.Print('FindFile: ' + netpath + '\n');
			Draw.EndDisc();
			return Q.strmem(data);
		}
		for (j = search.pack.length - 1; j >= 0; --j)
		{
			pak = search.pack[j];
			for (k = 0; k < pak.length; ++k)
			{
				file = pak[k];
				if (file.name !== filename)
					continue;
				if (file.filelen === 0)
				{
					Draw.EndDisc();
					return new ArrayBuffer(0);
				}
				data = Sys.files[search.filename + '/pak' + j + '.pak'];
				if ((data != null) && (file.filepos + file.filelen <= data.length))
				{
					Sys.Print('PackFile: ' + search.filename + '/pak' + j + '.pak : ' + filename + '\n')
					Draw.EndDisc();
					return data.buffer.slice(data.byteOffset + file.filepos, data.byteOffset + file.filepos + file.filelen);
				}
				break;
			}
		}
		data = Sys.files[netpath];
		if (data != null)
		{
			Sys.Print('FindFile: ' + netpath + '\n');
			Draw.EndDisc();
			return data.buffer.slice(data.byteOffset, data.byteOffset + data.length);
		}
	}
	Sys.Print('FindFile: can\'t find ' + filename + '\n');
	Draw.EndDisc();
};

COM.LoadTextFile = function(filename)
{
	var buf = COM.LoadFile(filename);
	if (buf == null)
		return;
	var bufview = new Uint8Array(buf);
	var f = [];
	var i;
	for (i = 0; i < bufview.length; ++i)
	{
		if (bufview[i] !== 13)
			f[f.length] = String.fromCharCode(bufview[i]);
	}
	return f.join('');
};

// Ghosty: from memory (Sys.files) instead of ranged XMLHttpRequests.
COM.LoadPackFile = function(packfile)
{
	var pakdata = Sys.files[packfile];
	if ((pakdata == null) || (pakdata.length < 12))
		return;
	var header = new DataView(pakdata.buffer, pakdata.byteOffset, 12);
	if (header.getUint32(0, true) !== 0x4b434150)
		Sys.Error(packfile + ' is not a packfile');
	var dirofs = header.getUint32(4, true);
	var dirlen = header.getUint32(8, true);
	var numpackfiles = dirlen >> 6;
	if (numpackfiles !== 339)
		COM.modified = true;
	var pack = [];
	if (numpackfiles !== 0)
	{
		if (dirofs + dirlen > pakdata.length)
			return;
		var info = pakdata.buffer.slice(pakdata.byteOffset + dirofs, pakdata.byteOffset + dirofs + dirlen);
		if (CRC.Block(new Uint8Array(info)) !== 32981)
			COM.modified = true;
		var i;
		for (i = 0; i < numpackfiles; ++i)
		{
			pack[pack.length] =
			{
				name: Q.memstr(new Uint8Array(info, i << 6, 56)).toLowerCase(),
				filepos: (new DataView(info)).getUint32((i << 6) + 56, true),
				filelen: (new DataView(info)).getUint32((i << 6) + 60, true)
			}
		}
	}
	Con.Print('Added packfile ' + packfile + ' (' + numpackfiles + ' files)\n');
	return pack;
};

COM.AddGameDirectory = function(dir)
{
	var search = {filename: dir, pack: []};
	var pak, i = 0;
	for (;;)
	{
		pak = COM.LoadPackFile(dir + '/' + 'pak' + i + '.pak');
		if (pak == null)
			break;
		search.pack[search.pack.length] = pak;
		++i;
	}
	COM.searchpaths[COM.searchpaths.length] = search;
};

COM.InitFilesystem = function()
{
	var i, search;
	
	i = COM.CheckParm('-basedir');
	if (i != null)
		search = COM.argv[i + 1];
	if (search != null)
		COM.AddGameDirectory(search);
	else
		COM.AddGameDirectory('id1');
		
	if (COM.rogue === true)
		COM.AddGameDirectory('rogue');
	else if (COM.hipnotic === true)
		COM.AddGameDirectory('hipnotic');
		
	i = COM.CheckParm('-game');
	if (i != null)
	{
		search = COM.argv[i + 1];
		if (search != null)
		{
			COM.modified = true;
			COM.AddGameDirectory(search);
		}
	}

	COM.gamedir = [COM.searchpaths[COM.searchpaths.length - 1]];
};

// ---- WebQuake/Console.js ----
Con = {};

Con.backscroll = 0;
Con.current = 0;
Con.text = [];

Con.ToggleConsole_f = function()
{
	SCR.EndLoadingPlaque();
	if (Key.dest.value === Key.dest.console)
	{
		if (CL.cls.state !== CL.active.connected)
		{
			M.Menu_Main_f();
			return;
		}
		Key.dest.value = Key.dest.game;
		Key.edit_line = '';
		Key.history_line = Key.lines.length;
		return;
	}
	Key.dest.value = Key.dest.console;
};

Con.Clear_f = function()
{
	Con.backscroll = 0;
	Con.current = 0;
	Con.text = [];
};

Con.ClearNotify = function()
{
	var i = Con.text.length - 4;
	if (i < 0)
		i = 0;
	for (; i < Con.text.length; ++i)
		Con.text[i].time = 0.0;
};

Con.MessageMode_f = function()
{
	Key.dest.value = Key.dest.message;
	Key.team_message = false;
};

Con.MessageMode2_f = function()
{
	Key.dest.value = Key.dest.message;
	Key.team_message = true;
};

Con.Init = function()
{
	Con.debuglog = (COM.CheckParm('-condebug') != null);
	if (Con.debuglog === true)
		COM.WriteTextFile('qconsole.log', '');
	Con.Print('Console initialized.\n');

	Con.notifytime = Cvar.RegisterVariable('con_notifytime', '3');
	Cmd.AddCommand('toggleconsole', Con.ToggleConsole_f);
	Cmd.AddCommand('messagemode', Con.MessageMode_f);
	Cmd.AddCommand('messagemode2', Con.MessageMode2_f);
	Cmd.AddCommand('clear', Con.Clear_f);
};

Con.Print = function(msg)
{
	if (Con.debuglog === true)
	{
		var data = COM.LoadTextFile('qconsole.log');
		if (data != null)
		{
			data += msg;
			if (data.length >= 32768)
				data = data.substring(data.length - 16384);
			COM.WriteTextFile('qconsole.log', data);
		}
	}

	Con.backscroll = 0;

	var mask = 0;
	if (msg.charCodeAt(0) <= 2)
	{
		mask = 128;
		if (msg.charCodeAt(0) === 1)
			S.LocalSound(Con.sfx_talk);
		msg = msg.substring(1);
	}
	var i;
	for (i = 0; i < msg.length; ++i)
	{
		if (Con.text[Con.current] == null)
			Con.text[Con.current] = {text: '', time: Host.realtime};
		if (msg.charCodeAt(i) === 10)
		{
			if (Con.text.length >= 1024)
			{
				Con.text = Con.text.slice(-512);
				Con.current = Con.text.length;
			}
			else
				++Con.current;
			continue;
		}
		Con.text[Con.current].text += String.fromCharCode(msg.charCodeAt(i) + mask);
	}
};

Con.DPrint = function(msg)
{
	if (Host.developer.value !== 0)
		Con.Print(msg);
};

Con.DrawInput = function()
{
	if ((Key.dest.value !== Key.dest.console) && (Con.forcedup !== true))
		return;
	var text = ']' + Key.edit_line + String.fromCharCode(10 + ((Host.realtime * 4.0) & 1));
	var width = (VID.width >> 3) - 2;
	if (text.length >= width)
		text = text.substring(1 + text.length - width);
	Draw.String(8, Con.vislines - 16, text);
};

Con.DrawNotify = function()
{
	var width = (VID.width >> 3) - 2;
	var i = Con.text.length - 4, v = 0;
	if (i < 0)
		i = 0;
	for (; i < Con.text.length; ++i)
	{
		if ((Host.realtime - Con.text[i].time) > Con.notifytime.value)
			continue;
		Draw.String(8, v, Con.text[i].text.substring(0, width));
		v += 8;
	}
	if (Key.dest.value === Key.dest.message)
		Draw.String(8, v, 'say: ' + Key.chat_buffer + String.fromCharCode(10 + ((Host.realtime * 4.0) & 1)));
};

Con.DrawConsole = function(lines)
{
	if (lines <= 0)
		return;
	lines = Math.floor(lines * VID.height * 0.005);
	Draw.ConsoleBackground(lines);
	Con.vislines = lines;
	var width = (VID.width >> 3) - 2;
	var rows;
	var y = lines - 16;
	var i;
	for (i = Con.text.length - 1 - Con.backscroll; i >= 0;)
	{
		if (Con.text[i].text.length === 0)
			y -= 8;
		else
			y -= Math.ceil(Con.text[i].text.length / width) << 3;
		--i;
		if (y <= 0)
			break;
	}
	var j, text;
	for (++i; i < Con.text.length - Con.backscroll; ++i)
	{
		text = Con.text[i].text;
		rows = Math.ceil(text.length / width);
		if (rows === 0)
		{
			y += 8;
			continue;
		}
		for (j = 0; j < rows; ++j)
		{
			Draw.String(8, y, text.substr(j * width, width));
			y += 8;
		}
	}
	Con.DrawInput();
};

// ---- WebQuake/CRC.js ----
CRC = {};

CRC.table =
[
	0x0000,	0x1021,	0x2042,	0x3063,	0x4084,	0x50a5,	0x60c6,	0x70e7,
	0x8108,	0x9129,	0xa14a,	0xb16b,	0xc18c,	0xd1ad,	0xe1ce,	0xf1ef,
	0x1231,	0x0210,	0x3273,	0x2252,	0x52b5,	0x4294,	0x72f7,	0x62d6,
	0x9339,	0x8318,	0xb37b,	0xa35a,	0xd3bd,	0xc39c,	0xf3ff,	0xe3de,
	0x2462,	0x3443,	0x0420,	0x1401,	0x64e6,	0x74c7,	0x44a4,	0x5485,
	0xa56a,	0xb54b,	0x8528,	0x9509,	0xe5ee,	0xf5cf,	0xc5ac,	0xd58d,
	0x3653,	0x2672,	0x1611,	0x0630,	0x76d7,	0x66f6,	0x5695,	0x46b4,
	0xb75b,	0xa77a,	0x9719,	0x8738,	0xf7df,	0xe7fe,	0xd79d,	0xc7bc,
	0x48c4,	0x58e5,	0x6886,	0x78a7,	0x0840,	0x1861,	0x2802,	0x3823,
	0xc9cc,	0xd9ed,	0xe98e,	0xf9af,	0x8948,	0x9969,	0xa90a,	0xb92b,
	0x5af5,	0x4ad4,	0x7ab7,	0x6a96,	0x1a71,	0x0a50,	0x3a33,	0x2a12,
	0xdbfd,	0xcbdc,	0xfbbf,	0xeb9e,	0x9b79,	0x8b58,	0xbb3b,	0xab1a,
	0x6ca6,	0x7c87,	0x4ce4,	0x5cc5,	0x2c22,	0x3c03,	0x0c60,	0x1c41,
	0xedae,	0xfd8f,	0xcdec,	0xddcd,	0xad2a,	0xbd0b,	0x8d68,	0x9d49,
	0x7e97,	0x6eb6,	0x5ed5,	0x4ef4,	0x3e13,	0x2e32,	0x1e51,	0x0e70,
	0xff9f,	0xefbe,	0xdfdd,	0xcffc,	0xbf1b,	0xaf3a,	0x9f59,	0x8f78,
	0x9188,	0x81a9,	0xb1ca,	0xa1eb,	0xd10c,	0xc12d,	0xf14e,	0xe16f,
	0x1080,	0x00a1,	0x30c2,	0x20e3,	0x5004,	0x4025,	0x7046,	0x6067,
	0x83b9,	0x9398,	0xa3fb,	0xb3da,	0xc33d,	0xd31c,	0xe37f,	0xf35e,
	0x02b1,	0x1290,	0x22f3,	0x32d2,	0x4235,	0x5214,	0x6277,	0x7256,
	0xb5ea,	0xa5cb,	0x95a8,	0x8589,	0xf56e,	0xe54f,	0xd52c,	0xc50d,
	0x34e2,	0x24c3,	0x14a0,	0x0481,	0x7466,	0x6447,	0x5424,	0x4405,
	0xa7db,	0xb7fa,	0x8799,	0x97b8,	0xe75f,	0xf77e,	0xc71d,	0xd73c,
	0x26d3,	0x36f2,	0x0691,	0x16b0,	0x6657,	0x7676,	0x4615,	0x5634,
	0xd94c,	0xc96d,	0xf90e,	0xe92f,	0x99c8,	0x89e9,	0xb98a,	0xa9ab,
	0x5844,	0x4865,	0x7806,	0x6827,	0x18c0,	0x08e1,	0x3882,	0x28a3,
	0xcb7d,	0xdb5c,	0xeb3f,	0xfb1e,	0x8bf9,	0x9bd8,	0xabbb,	0xbb9a,
	0x4a75,	0x5a54,	0x6a37,	0x7a16,	0x0af1,	0x1ad0,	0x2ab3,	0x3a92,
	0xfd2e,	0xed0f,	0xdd6c,	0xcd4d,	0xbdaa,	0xad8b,	0x9de8,	0x8dc9,
	0x7c26,	0x6c07,	0x5c64,	0x4c45,	0x3ca2,	0x2c83,	0x1ce0,	0x0cc1,
	0xef1f,	0xff3e,	0xcf5d,	0xdf7c,	0xaf9b,	0xbfba,	0x8fd9,	0x9ff8,
	0x6e17,	0x7e36,	0x4e55,	0x5e74,	0x2e93,	0x3eb2,	0x0ed1,	0x1ef0
];

CRC.Block = function(start)
{
	var crcvalue = 0xffff;
	var i;
	for (i = 0; i < start.length; ++i)
		crcvalue = ((crcvalue << 8) & 0xffff) ^ CRC.table[(crcvalue >> 8) ^ start[i]];
	return crcvalue;
};

// ---- WebQuake/Cvar.js ----
Cvar = {};

Cvar.vars = [];

Cvar.FindVar = function(name)
{
	var i;
	for (i = 0; i < Cvar.vars.length; ++i)
	{
		if (Cvar.vars[i].name === name)
			return Cvar.vars[i];
	}
};

Cvar.CompleteVariable = function(partial)
{
	if (partial.length === 0)
		return;
	var i;
	for (i = 0; i < Cvar.vars.length; ++i)
	{
		if (Cvar.vars[i].name.substring(0, partial.length) === partial)
			return Cvar.vars[i].name;
	}
};

Cvar.Set = function(name, value)
{
	var i, v, changed;
	for (i = 0; i < Cvar.vars.length; ++i)
	{
		v = Cvar.vars[i];
		if (v.name !== name)
			continue;
		if (v.string !== value)
			changed = true;
		v.string = value;
		v.value = Q.atof(value);
		if ((v.server === true) && (changed === true) && (SV.server.active === true))
			Host.BroadcastPrint('"' + v.name + '" changed to "' + v.string + '"\n');
		return;
	}
	Con.Print('Cvar.Set: variable ' + name + ' not found\n');
};

Cvar.SetValue = function(name, value)
{
	Cvar.Set(name, value.toFixed(6));
};

Cvar.RegisterVariable = function(name, value, archive, server)
{
	var i;
	for (i = 0; i < Cvar.vars.length; ++i)
	{
		if (Cvar.vars[i].name === name)
		{
			Con.Print('Can\'t register variable ' + name + ', allready defined\n');
			return;
		}
	}
	Cvar.vars[Cvar.vars.length] =
	{
		name: name,
		string: value,
		archive: archive,
		server: server,
		value: Q.atof(value)
	};
	return Cvar.vars[Cvar.vars.length - 1];
};

Cvar.Command = function()
{
	var v = Cvar.FindVar(Cmd.argv[0]);
	if (v == null)
		return;
	if (Cmd.argv.length <= 1)
	{
		Con.Print('"' + v.name + '" is "' + v.string + '"\n');
		return true;
	}
	Cvar.Set(v.name, Cmd.argv[1]);
	return true;
};

Cvar.WriteVariables = function()
{
	var f = [], i, v;
	for (i = 0; i < Cvar.vars.length; ++i)
	{
		v = Cvar.vars[i];
		if (v.archive === true)
			f[f.length] = v.name + ' "' + v.string + '"\n';
	}
	return f.join('');
};

// ---- WebQuake/Def.js ----
Def = {};

Def.webquake_version = 54;
Def.timedate = 'Exe: 13:00:49 Aug 10 2017\n';

Def.max_edicts = 600;

Def.stat = {
	health: 0,
	frags: 1,
	weapon: 2,
	ammo: 3,
	armor: 4,
	weaponframe: 5,
	shells: 6,
	nails: 7,
	rockets: 8,
	cells: 9,
	activeweapon: 10,
	totalsecrets: 11,
	totalmonsters: 12,
	secrets: 13,
	monsters: 14
};

Def.it = {
	shotgun: 1,
	super_shotgun: 2,
	nailgun: 4,
	super_nailgun: 8,
	grenade_launcher: 16,
	rocket_launcher: 32,
	lightning: 64,
	super_lightning: 128,
	shells: 256,
	nails: 512,
	rockets: 1024,
	cells: 2048,
	axe: 4096,
	armor1: 8192,
	armor2: 16384,
	armor3: 32768,
	superhealth: 65536,
	key1: 131072,
	key2: 262144,
	invisibility: 524288,
	invulnerability: 1048576,
	suit: 2097152,
	quad: 4194304
};

Def.rit = {
	shells: 128,
	nails: 256,
	rockets: 512,
	cells: 1024,
	axe: 2048,
	lava_nailgun: 4096,
	lava_super_nailgun: 8192,
	multi_grenade: 16384,
	multi_rocket: 32768,
	plasma_gun: 65536,
	armor1: 8388608,
	armor2: 16777216,
	armor3: 33554432,
	lava_nails: 67108864,
	plasma_ammo: 134217728,
	multi_rockets: 268435456,
	shield: 536870912,
	antigrav: 1073741824,
	superhealth: 2147483648
};

Def.hit = {
	proximity_gun_bit: 16,
	mjolnir_bit: 7,
	laser_cannon_bit: 23,
	proximity_gun: 65536,
	mjolnir: 128,
	laser_cannon: 8388608,
	wetsuit: 33554432,
	empathy_shields: 67108864
};

// ---- WebQuake/Draw.js ----
Draw = {};

Draw.CharToConback = function(num, dest)
{
	var source = ((num >> 4) << 10) + ((num & 15) << 3);
	var drawline, x;
	for (drawline = 0; drawline < 8; ++drawline)
	{
		for (x = 0; x < 8; ++x)
		{
			if (Draw.chars[source + x] !== 0)
				Draw.conback.data[dest + x] = 0x60 + Draw.chars[source + x];
		}
		source += 128;
		dest += 320;
	}
};

Draw.Init = function()
{
	var i;

	Draw.chars = new Uint8Array(W.GetLumpName('CONCHARS'));
	
	var trans = new ArrayBuffer(65536);
	var trans32 = new Uint32Array(trans);
	for (i = 0; i < 16384; ++i)
	{
		if (Draw.chars[i] !== 0)
			trans32[i] = COM.LittleLong(VID.d_8to24table[Draw.chars[i]] + 0xff000000);
	}
	Draw.char_texture = gl.createTexture();
	GL.Bind(0, Draw.char_texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 128, 128, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(trans));
	gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	Draw.conback = {};
	var cb = COM.LoadFile('gfx/conback.lmp');
	if (cb == null)
		Sys.Error('Couldn\'t load gfx/conback.lmp');
	Draw.conback.width = 320;
	Draw.conback.height = 200;
	Draw.conback.data = new Uint8Array(cb, 8, 64000);
	var ver = '(WebQuake build ' + Def.webquake_version + ') 1.09';
	for (i = 0; i < ver.length; ++i)
		Draw.CharToConback(ver.charCodeAt(i), 59829 - ((ver.length - i) << 3), 186);
	Draw.conback.texnum = GL.LoadPicTexture(Draw.conback);

	Draw.loading = Draw.CachePic('loading');
	Draw.loadingElem = document.getElementById('loading');
	Draw.loadingElem.src = Draw.PicToDataURL(Draw.loading);

	document.body.style.backgroundImage = 'url("' + Draw.PicToDataURL(Draw.PicFromWad('BACKTILE')) + '")';

	GL.CreateProgram('Fill',
		['uOrtho'],
		[['aPosition', gl.FLOAT, 2], ['aColor', gl.UNSIGNED_BYTE, 4, true]],
		[]);
	GL.CreateProgram('Pic',
		['uOrtho'],
		[['aPosition', gl.FLOAT, 2], ['aTexCoord', gl.FLOAT, 2]],
		['tTexture']);
	GL.CreateProgram('PicTranslate',
		['uOrtho', 'uTop', 'uBottom'],
		[['aPosition', gl.FLOAT, 2], ['aTexCoord', gl.FLOAT, 2]],
		['tTexture', 'tTrans']);
};

Draw.Char = function(x, y, num)
{
	GL.StreamDrawTexturedQuad(x, y, 8, 8,
		(num & 15) * 0.0625, (num >> 4) * 0.0625,
		((num & 15) + 1) * 0.0625, ((num >> 4) + 1) * 0.0625);
}

Draw.Character = function(x, y, num)
{
	var program = GL.UseProgram('Pic', true);
	GL.Bind(program.tTexture, Draw.char_texture, true);
	Draw.Char(x, y, num);
};

Draw.String = function(x, y, str)
{
	var program = GL.UseProgram('Pic', true);
	GL.Bind(program.tTexture, Draw.char_texture, true);
	for (var i = 0; i < str.length; ++i)
	{
		Draw.Char(x, y, str.charCodeAt(i));
		x += 8;
	}
};

Draw.StringWhite = function(x, y, str)
{
	var program = GL.UseProgram('Pic', true);
	GL.Bind(program.tTexture, Draw.char_texture, true);
	for (var i = 0; i < str.length; ++i)
	{
		Draw.Char(x, y, str.charCodeAt(i) + 128);
		x += 8;
	}
};

Draw.PicFromWad = function(name)
{
	var buf = W.GetLumpName(name);
	var p = {};
	var view = new DataView(buf, 0, 8);
	p.width = view.getUint32(0, true);
	p.height = view.getUint32(4, true);
	p.data = new Uint8Array(buf, 8, p.width * p.height);
	p.texnum = GL.LoadPicTexture(p);
	return p;
};

Draw.CachePic = function(path)
{
	path = 'gfx/' + path + '.lmp';
	var buf = COM.LoadFile(path);
	if (buf == null)
		Sys.Error('Draw.CachePic: failed to load ' + path);
	var dat = {};
	var view = new DataView(buf, 0, 8);
	dat.width = view.getUint32(0, true);
	dat.height = view.getUint32(4, true);
	dat.data = new Uint8Array(buf, 8, dat.width * dat.height);
	dat.texnum = GL.LoadPicTexture(dat);
	return dat;
};

Draw.Pic = function(x, y, pic)
{
	var program = GL.UseProgram('Pic', true);
	GL.Bind(program.tTexture, pic.texnum, true);
	GL.StreamDrawTexturedQuad(x, y, pic.width, pic.height, 0.0, 0.0, 1.0, 1.0);
};

Draw.PicTranslate = function(x, y, pic, top, bottom)
{
	GL.StreamFlush();
	var program = GL.UseProgram('PicTranslate');
	GL.Bind(program.tTexture, pic.texnum);
	GL.Bind(program.tTrans, pic.translate);

	var p = VID.d_8to24table[top];
	var scale = 1.0 / 191.25;
	gl.uniform3f(program.uTop, (p & 0xff) * scale, ((p >> 8) & 0xff) * scale, (p >> 16) * scale);
	p = VID.d_8to24table[bottom];
	gl.uniform3f(program.uBottom, (p & 0xff) * scale, ((p >> 8) & 0xff) * scale, (p >> 16) * scale);

	GL.StreamDrawTexturedQuad(x, y, pic.width, pic.height, 0.0, 0.0, 1.0, 1.0);

	GL.StreamFlush();
};

Draw.ConsoleBackground = function(lines)
{
	var program = GL.UseProgram('Pic', true);
	GL.Bind(program.tTexture, Draw.conback.texnum, true);
	GL.StreamDrawTexturedQuad(0, lines - VID.height, VID.width, VID.height, 0.0, 0.0, 1.0, 1.0);
};

Draw.Fill = function(x, y, w, h, c)
{
	var program = GL.UseProgram('Fill', true);
	var color = VID.d_8to24table[c];
	GL.StreamDrawColoredQuad(x, y, w, h, color & 0xff, (color >> 8) & 0xff, color >> 16, 255);
};

Draw.FadeScreen = function()
{
	var program = GL.UseProgram('Fill', true);
	GL.StreamDrawColoredQuad(0, 0, VID.width, VID.height, 0, 0, 0, 204);
};

Draw.BeginDisc = function()
{
	if (Draw.loadingElem == null)
		return;
	Draw.loadingElem.style.left = ((VID.width - Draw.loading.width) >> 1) + 'px';
	Draw.loadingElem.style.top = ((VID.height - Draw.loading.height) >> 1) + 'px';
	Draw.loadingElem.style.display = 'inline-block';
};

Draw.EndDisc = function()
{
	if (Draw.loadingElem != null)
		Draw.loadingElem.style.display = 'none';
};

Draw.PicToDataURL = function(pic)
{
	var canvas = document.createElement('canvas');
	canvas.width = pic.width;
	canvas.height = pic.height;
	var ctx = canvas.getContext('2d');
	var data = ctx.createImageData(pic.width, pic.height);
	var trans = new ArrayBuffer(data.data.length);
	var trans32 = new Uint32Array(trans);
	var i;
	for (i = 0; i < pic.data.length; ++i)
		trans32[i] = COM.LittleLong(VID.d_8to24table[pic.data[i]] + 0xff000000);
	data.data.set(new Uint8Array(trans));
	ctx.putImageData(data, 0, 0);
	return canvas.toDataURL();
};

// ---- WebQuake/ED.js ----
ED = {};

ED.ClearEdict = function(e)
{
	var i;
	for (i = 0; i < PR.entityfields; ++i)
		e.v_int[i] = 0;
	e.free = false;
};

ED.Alloc = function()
{
	var i, e;
	for (i = SV.svs.maxclients + 1; i < SV.server.num_edicts; ++i)
	{
		e = SV.server.edicts[i];
		if ((e.free === true) && ((e.freetime < 2.0) || ((SV.server.time - e.freetime) > 0.5)))
		{
			ED.ClearEdict(e);
			return e;
		}
	}
	if (i === Def.max_edicts)
		Sys.Error('ED.Alloc: no free edicts');
	e = SV.server.edicts[SV.server.num_edicts++];
	ED.ClearEdict(e);
	return e;
};

ED.Free = function(ed)
{
	SV.UnlinkEdict(ed);
	ed.free = true;
	ed.v_int[PR.entvars.model] = 0;
	ed.v_float[PR.entvars.takedamage] = 0.0;
	ed.v_float[PR.entvars.modelindex] = 0.0;
	ed.v_float[PR.entvars.colormap] = 0.0;
	ed.v_float[PR.entvars.skin] = 0.0;
	ed.v_float[PR.entvars.frame] = 0.0;
	ED.SetVector(ed, PR.entvars.origin, Vec.origin);
	ED.SetVector(ed, PR.entvars.angles, Vec.origin);
	ed.v_float[PR.entvars.nextthink] = -1.0;
	ed.v_float[PR.entvars.solid] = 0.0;
	ed.freetime = SV.server.time;
};

ED.GlobalAtOfs = function(ofs)
{
	var i, def;
	for (i = 0; i < PR.globaldefs.length; ++i)
	{
		def = PR.globaldefs[i];
		if (def.ofs === ofs)
			return def;
	}
};

ED.FieldAtOfs = function(ofs)
{
	var i, def;
	for (i = 0; i < PR.fielddefs.length; ++i)
	{
		def = PR.fielddefs[i];
		if (def.ofs === ofs)
			return def;
	}
};

ED.FindField = function(name)
{
	var def, i;
	for (i = 0; i < PR.fielddefs.length; ++i)
	{
		def = PR.fielddefs[i];
		if (PR.GetString(def.name) === name)
			return def;
	}
};

ED.FindGlobal = function(name)
{
	var def, i;
	for (i = 0; i < PR.globaldefs.length; ++i)
	{
		def = PR.globaldefs[i];
		if (PR.GetString(def.name) === name)
			return def;
	}
};

ED.FindFunction = function(name)
{
	var i;
	for (i = 0; i < PR.functions.length; ++i)
	{
		if (PR.GetString(PR.functions[i].name) === name)
			return i;
	}
};

ED.Print = function(ed)
{
	if (ed.free === true)
	{
		Con.Print('FREE\n');
		return;
	}
	Con.Print('\nEDICT ' + ed.num + ':\n');
	var i, d, name, v, l;
	for (i = 1; i < PR.fielddefs.length; ++i)
	{
		d = PR.fielddefs[i];
		name = PR.GetString(d.name);
		if (name.charCodeAt(name.length - 2) === 95)
			continue;
		v = d.ofs;
		if (ed.v_int[v] === 0)
		{
			if ((d.type & 0x7fff) === 3)
			{
				if ((ed.v_int[v + 1] === 0) && (ed.v_int[v + 2] === 0))
					continue;
			}
			else
				continue;
		}
		for (; name.length <= 14; )
			name += ' ';
		Con.Print(name + PR.ValueString(d.type, ed.v, v) + '\n');
	}
};

ED.PrintEdicts = function()
{
	if (SV.server.active !== true)
		return;
	Con.Print(SV.server.num_edicts + ' entities\n');
	var i;
	for (i = 0; i < SV.server.num_edicts; ++i)
		ED.Print(SV.server.edicts[i]);
};

ED.PrintEdict_f = function()
{
	if (SV.server.active !== true)
		return;
	var i = Q.atoi(Cmd.argv[1]);
	if ((i >= 0) && (i < SV.server.num_edicts))
		ED.Print(SV.server.edicts[i]);
};

ED.Count = function()
{
	if (SV.server.active !== true)
		return;
	var i, ent, active = 0, models = 0, solid = 0, step = 0;
	for (i = 0; i < SV.server.num_edicts; ++i)
	{
		ent = SV.server.edicts[i];
		if (ent.free === true)
			continue;
		++active;
		if (ent.v_float[PR.entvars.solid] !== 0.0)
			++solid;
		if (ent.v_int[PR.entvars.model] !== 0)
			++models;
		if (ent.v_float[PR.entvars.movetype] === SV.movetype.step)
			++step;
	}
	var num_edicts = SV.server.num_edicts;
	Con.Print('num_edicts:' + (num_edicts <= 9 ? '  ' : (num_edicts <= 99 ? ' ' : '')) + num_edicts + '\n');
	Con.Print('active    :' + (active <= 9 ? '  ' : (active <= 99 ? ' ' : '')) + active + '\n');
	Con.Print('view      :' + (models <= 9 ? '  ' : (models <= 99 ? ' ' : '')) + models + '\n');
	Con.Print('touch     :' + (solid <= 9 ? '  ' : (solid <= 99 ? ' ' : '')) + solid + '\n');
	Con.Print('step      :' + (step <= 9 ? '  ' : (step <= 99 ? ' ' : '')) + step + '\n');
};

ED.ParseGlobals = function(data)
{
	var keyname, key;
	for (;;)
	{
		data = COM.Parse(data);
		if (COM.token.charCodeAt(0) === 125)
			return;
		if (data == null)
			Sys.Error('ED.ParseGlobals: EOF without closing brace');
		keyname = COM.token;
		data = COM.Parse(data);
		if (data == null)
			Sys.Error('ED.ParseGlobals: EOF without closing brace');
		if (COM.token.charCodeAt(0) === 125)
			Sys.Error('ED.ParseGlobals: closing brace without data');
		key = ED.FindGlobal(keyname);
		if (key == null)
		{
			Con.Print('\'' + keyname + '\' is not a global\n');
			continue;
		}
		if (ED.ParseEpair(PR.globals, key, COM.token) !== true)
			Host.Error('ED.ParseGlobals: parse error');
	}
};

ED.NewString = function(string)
{
	var newstring = [], i, c;
	for (i = 0; i < string.length; ++i)
	{
		c = string.charCodeAt(i);
		if ((c === 92) && (i < (string.length - 1)))
		{
			++i;
			newstring[newstring.length] = (string.charCodeAt(i) === 110) ? '\n' : '\\';
		}
		else
			newstring[newstring.length] = String.fromCharCode(c);
	}
	return PR.NewString(newstring.join(''), string.length + 1);
};

ED.ParseEpair = function(base, key, s)
{
	var d_float = new Float32Array(base);
	var d_int = new Int32Array(base);
	var d, v;
	switch (key.type & 0x7fff)
	{
	case PR.etype.ev_string:
		d_int[key.ofs] = ED.NewString(s);
		return true;
	case PR.etype.ev_float:
		d_float[key.ofs] = Q.atof(s);
		return true;
	case PR.etype.ev_vector:
		v = s.split(' ');
		d_float[key.ofs] = Q.atof(v[0]);
		d_float[key.ofs + 1] = Q.atof(v[1]);
		d_float[key.ofs + 2] = Q.atof(v[2]);
		return true;
	case PR.etype.ev_entity:
		d_int[key.ofs] = Q.atoi(s);
		return true;
	case PR.etype.ev_field:
		d = ED.FindField(s);
		if (d == null)
		{
			Con.Print('Can\'t find field ' + s + '\n');
			return;
		}
		d_int[key.ofs] = d.ofs;
		return true;
	case PR.etype.ev_function:
		d = ED.FindFunction(s);
		if (d == null)
		{
			Con.Print('Can\'t find function ' + s + '\n');
			return;
		}
		d_int[key.ofs] = d;
	}
	return true;
};

ED.ParseEdict = function(data, ent)
{
	var i, init, anglehack, keyname, n, key;
	if (ent !== SV.server.edicts[0])
	{
		for (i = 0; i < PR.entityfields; ++i)
			ent.v_int[i] = 0;
	}
	for (;;)
	{
		data = COM.Parse(data);
		if (COM.token.charCodeAt(0) === 125)
			break;
		if (data == null)
			Sys.Error('ED.ParseEdict: EOF without closing brace');
		if (COM.token === 'angle')
		{
			COM.token = 'angles';
			anglehack = true;
		}
		else
		{
			anglehack = false;
			if (COM.token === 'light')
				COM.token = 'light_lev';
		}
		for (n = COM.token.length; n > 0; --n)
		{
			if (COM.token.charCodeAt(n - 1) !== 32)
				break;
		}
		keyname = COM.token.substring(0, n);
		data = COM.Parse(data);
		if (data == null)
			Sys.Error('ED.ParseEdict: EOF without closing brace');
		if (COM.token.charCodeAt(0) === 125)
			Sys.Error('ED.ParseEdict: closing brace without data');
		init = true;
		if (keyname.charCodeAt(0) === 95)
			continue;
		key = ED.FindField(keyname);
		if (key == null)
		{
			Con.Print('\'' + keyname + '\' is not a field\n');
			continue;
		}
		if (anglehack == true)
			COM.token = '0 ' + COM.token + ' 0';
		if (ED.ParseEpair(ent.v, key, COM.token) !== true)
			Host.Error('ED.ParseEdict: parse error');
	}
	if (init !== true)
		ent.free = true;
	return data;
};

ED.LoadFromFile = function(data)
{
	var ent, spawnflags, inhibit = 0, func;
	PR.globals_float[PR.globalvars.time] = SV.server.time;

	for (;;)
	{
		data = COM.Parse(data);
		if (data == null)
			break;
		if (COM.token.charCodeAt(0) !== 123)
			Sys.Error('ED.LoadFromFile: found ' + COM.token + ' when expecting {');

		if (ent == null)
			ent = SV.server.edicts[0];
		else
			ent = ED.Alloc();
		data = ED.ParseEdict(data, ent);

		spawnflags = ent.v_float[PR.entvars.spawnflags] >> 0;
		if (Host.deathmatch.value !== 0)
		{
			if ((spawnflags & 2048) !== 0)
			{
				ED.Free(ent);
				++inhibit;
				continue;
			}
		}
		else if (((Host.current_skill === 0) && ((spawnflags & 256) !== 0))
			|| ((Host.current_skill === 1) && ((spawnflags & 512) !== 0))
			|| ((Host.current_skill >= 2) && ((spawnflags & 1024) !== 0)))
		{
			ED.Free(ent);
			++inhibit;
			continue;
		}

		if (ent.v_int[PR.entvars.classname] === 0)
		{
			Con.Print('No classname for:\n');
			ED.Print(ent);
			ED.Free(ent);
			continue;
		}

		func = ED.FindFunction(PR.GetString(ent.v_int[PR.entvars.classname]));
		if (func == null)
		{
			Con.Print('No spawn function for:\n');
			ED.Print(ent);
			ED.Free(ent);
			continue;
		}

		PR.globals_int[PR.globalvars.self] = ent.num;
		PR.ExecuteProgram(func);
	}

	Con.DPrint(inhibit + ' entities inhibited\n');
};

ED.Vector = function(e, o)
{
	return [e.v_float[o], e.v_float[o + 1], e.v_float[o + 2]];
};

ED.SetVector = function(e, o, v)
{
	e.v_float[o] = v[0];
	e.v_float[o + 1] = v[1];
	e.v_float[o + 2] = v[2];
};

// ---- WebQuake/GL.js ----
GL = {};

GL.textures = [];
GL.currenttextures = [];
GL.programs = [];

GL.Bind = function(target, texnum, flushStream)
{
	if (GL.currenttextures[target] !== texnum)
	{
		if (flushStream === true)
			GL.StreamFlush();
		if (GL.activetexture !== target)
		{
			GL.activetexture = target;
			gl.activeTexture(gl.TEXTURE0 + target);
		}
		GL.currenttextures[target] = texnum;
		gl.bindTexture(gl.TEXTURE_2D, texnum);
	}
};

GL.TextureMode_f = function()
{
	var i;
	if (Cmd.argv.length <= 1)
	{
		for (i = 0; i < GL.modes.length; ++i)
		{
			if (GL.filter_min === GL.modes[i][1])
			{
				Con.Print(GL.modes[i][0] + '\n');
				return;
			}
		}
		Con.Print('current filter is unknown???\n');
		return;
	}
	var name = Cmd.argv[1].toUpperCase();
	for (i = 0; i < GL.modes.length; ++i)
	{
		if (GL.modes[i][0] === name)
			break;
	}
	if (i === GL.modes.length)
	{
		Con.Print('bad filter name\n');
		return;
	}
	GL.filter_min = GL.modes[i][1];
	GL.filter_max = GL.modes[i][2];
	for (i = 0; i < GL.textures.length; ++i)
	{
		GL.Bind(0, GL.textures[i].texnum);
		gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, GL.filter_min);
		gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, GL.filter_max);
	}
};

GL.ortho = [
	0.0, 0.0, 0.0, 0.0,
	0.0, 0.0, 0.0, 0.0,
	0.0, 0.0, 0.00001, 0.0,
	-1.0, 1.0, 0.0, 1.0
];

GL.Set2D = function()
{
	gl.viewport(0, 0, (VID.width * SCR.devicePixelRatio) >> 0, (VID.height * SCR.devicePixelRatio) >> 0);
	GL.UnbindProgram();
	var i, program;
	for (i = 0; i < GL.programs.length; ++i)
	{
		program = GL.programs[i];
		if (program.uOrtho == null)
			continue;
		gl.useProgram(program.program);
		gl.uniformMatrix4fv(program.uOrtho, false, GL.ortho);
	}
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.BLEND);
};

GL.ResampleTexture = function(data, inwidth, inheight, outwidth, outheight)
{
	var outdata = new ArrayBuffer(outwidth * outheight);
	var out = new Uint8Array(outdata);
	var xstep = inwidth / outwidth, ystep = inheight / outheight;
	var src, dest = 0, y;
	var i, j;
	for (i = 0; i < outheight; ++i)
	{
		src = Math.floor(i * ystep) * inwidth;
		for (j = 0; j < outwidth; ++j)
			out[dest + j] = data[src + Math.floor(j * xstep)];
		dest += outwidth;
	}
	return out;
};

GL.Upload = function(data, width, height)
{
	var scaled_width = width, scaled_height = height;
	if (((width & (width - 1)) !== 0) || ((height & (height - 1)) !== 0))
	{
		--scaled_width;
		scaled_width |= (scaled_width >> 1);
		scaled_width |= (scaled_width >> 2);
		scaled_width |= (scaled_width >> 4);
		scaled_width |= (scaled_width >> 8);
		scaled_width |= (scaled_width >> 16);
		++scaled_width;
		--scaled_height;
		scaled_height |= (scaled_height >> 1);
		scaled_height |= (scaled_height >> 2);
		scaled_height |= (scaled_height >> 4);
		scaled_height |= (scaled_height >> 8);
		scaled_height |= (scaled_height >> 16);
		++scaled_height;
	}
	if (scaled_width > GL.maxtexturesize)
		scaled_width = GL.maxtexturesize;
	if (scaled_height > GL.maxtexturesize)
		scaled_height = GL.maxtexturesize;
	if ((scaled_width !== width) || (scaled_height !== height))
		data = GL.ResampleTexture(data, width, height, scaled_width, scaled_height);
	var trans = new ArrayBuffer((scaled_width * scaled_height) << 2)
	var trans32 = new Uint32Array(trans);
	var i;
	for (i = scaled_width * scaled_height - 1; i >= 0; --i)
	{
		trans32[i] = COM.LittleLong(VID.d_8to24table[data[i]] + 0xff000000);
		if (data[i] >= 224)
			trans32[i] &= 0xffffff;
	}
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, scaled_width, scaled_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(trans));
	gl.generateMipmap(gl.TEXTURE_2D);
	gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, GL.filter_min);
	gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, GL.filter_max);
};

GL.LoadTexture = function(identifier, width, height, data)
{
	var glt, i;
	if (identifier.length !== 0)
	{
		for (i = 0; i < GL.textures.length; ++i)
		{
			glt = GL.textures[i];
			if (glt.identifier === identifier)
			{
				if ((width !== glt.width) || (height !== glt.height))
					Sys.Error('GL.LoadTexture: cache mismatch');
				return glt;
			}
		}
	}

	var scaled_width = width, scaled_height = height;
	if (((width & (width - 1)) !== 0) || ((height & (height - 1)) !== 0))
	{
		--scaled_width ;
		scaled_width |= (scaled_width >> 1);
		scaled_width |= (scaled_width >> 2);
		scaled_width |= (scaled_width >> 4);
		scaled_width |= (scaled_width >> 8);
		scaled_width |= (scaled_width >> 16);
		++scaled_width;
		--scaled_height;
		scaled_height |= (scaled_height >> 1);
		scaled_height |= (scaled_height >> 2);
		scaled_height |= (scaled_height >> 4);
		scaled_height |= (scaled_height >> 8);
		scaled_height |= (scaled_height >> 16);
		++scaled_height;
	}
	if (scaled_width > GL.maxtexturesize)
		scaled_width = GL.maxtexturesize;
	if (scaled_height > GL.maxtexturesize)
		scaled_height = GL.maxtexturesize;
	scaled_width >>= GL.picmip.value;
	if (scaled_width === 0)
		scaled_width = 1;
	scaled_height >>= GL.picmip.value;
	if (scaled_height === 0)
		scaled_height = 1;
	if ((scaled_width !== width) || (scaled_height !== height))
		data = GL.ResampleTexture(data, width, height, scaled_width, scaled_height);

	glt = {texnum: gl.createTexture(), identifier: identifier, width: width, height: height};
	GL.Bind(0, glt.texnum);
	GL.Upload(data, scaled_width, scaled_height);
	GL.textures[GL.textures.length] = glt;
	return glt;
};

GL.LoadPicTexture = function(pic)
{
	var data = pic.data, scaled_width = pic.width, scaled_height = pic.height;
	if (((pic.width & (pic.width - 1)) !== 0) || ((pic.height & (pic.height - 1)) !== 0))
	{
		--scaled_width ;
		scaled_width |= (scaled_width >> 1);
		scaled_width |= (scaled_width >> 2);
		scaled_width |= (scaled_width >> 4);
		scaled_width |= (scaled_width >> 8);
		scaled_width |= (scaled_width >> 16);
		++scaled_width;
		--scaled_height;
		scaled_height |= (scaled_height >> 1);
		scaled_height |= (scaled_height >> 2);
		scaled_height |= (scaled_height >> 4);
		scaled_height |= (scaled_height >> 8);
		scaled_height |= (scaled_height >> 16);
		++scaled_height;
	}
	if (scaled_width > GL.maxtexturesize)
		scaled_width = GL.maxtexturesize;
	if (scaled_height > GL.maxtexturesize)
		scaled_height = GL.maxtexturesize;
	if ((scaled_width !== pic.width) || (scaled_height !== pic.height))
		data = GL.ResampleTexture(data, pic.width, pic.height, scaled_width, scaled_height);

	var texnum = gl.createTexture();
	GL.Bind(0, texnum);
	var trans = new ArrayBuffer((scaled_width * scaled_height) << 2)
	var trans32 = new Uint32Array(trans);
	var i;
	for (i = scaled_width * scaled_height - 1; i >= 0; --i)
	{
		if (data[i] !== 255)
			trans32[i] = COM.LittleLong(VID.d_8to24table[data[i]] + 0xff000000);
	}
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, scaled_width, scaled_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(trans));
	gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	return texnum;
};

GL.CreateProgram = function(identifier, uniforms, attribs, textures)
{
	var p = gl.createProgram();
	var program =
	{
		identifier: identifier,
		program: p,
		attribs: []
	};

	var vsh = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vsh, document.getElementById('vsh' + identifier).text);
	gl.compileShader(vsh);
	if (gl.getShaderParameter(vsh, gl.COMPILE_STATUS) !== true)
		Sys.Error('Error compiling shader: ' + gl.getShaderInfoLog(vsh));

	var fsh = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fsh, document.getElementById('fsh' + identifier).text);
	gl.compileShader(fsh);
	if (gl.getShaderParameter(fsh, gl.COMPILE_STATUS) !== true)
		Sys.Error('Error compiling shader: ' + gl.getShaderInfoLog(fsh));

	gl.attachShader(p, vsh);
	gl.attachShader(p, fsh);

	gl.linkProgram(p);
	if (gl.getProgramParameter(p, gl.LINK_STATUS) !== true)
		Sys.Error('Error linking program: ' + gl.getProgramInfoLog(p));

	gl.useProgram(p);

	for (var i = 0; i < uniforms.length; ++i)
		program[uniforms[i]] = gl.getUniformLocation(p, uniforms[i]);

	program.vertexSize = 0;
	program.attribBits = 0;
	for (var i = 0; i < attribs.length; ++i)
	{
		var attribParameters = attribs[i];
		var attrib =
		{
			name: attribParameters[0],
			location: gl.getAttribLocation(p, attribParameters[0]),
			type: attribParameters[1],
			components: attribParameters[2],
			normalized: (attribParameters[3] === true),
			offset: program.vertexSize
		};
		program.attribs[i] = attrib;
		program[attrib.name] = attrib;
		if (attrib.type === gl.FLOAT)
			program.vertexSize += attrib.components * 4;
		else if (attrib.type === gl.BYTE || attrib.type === gl.UNSIGNED_BYTE)
			program.vertexSize += 4;
		else
			Sys.Error('Unknown vertex attribute type');
		program.attribBits |= 1 << attrib.location;
	}

	for (var i = 0; i < textures.length; ++i)
	{
		program[textures[i]] = i;
		gl.uniform1i(gl.getUniformLocation(p, textures[i]), i);
	}

	GL.programs[GL.programs.length] = program;
	return program;
};

GL.UseProgram = function(identifier, flushStream)
{
	var currentProgram = GL.currentProgram;
	if (currentProgram != null)
	{
		if (currentProgram.identifier === identifier)
			return currentProgram;
		if (flushStream === true)
			GL.StreamFlush();
	}

	var program = null;
	for (var i = 0; i < GL.programs.length; ++i)
	{
		if (GL.programs[i].identifier === identifier)
		{
			program = GL.programs[i];
			break;
		}
	}
	if (program == null)
		return null;

	var enableAttribs = program.attribBits, disableAttribs = 0;
	if (currentProgram != null)
	{
		enableAttribs &= ~currentProgram.attribBits;
		disableAttribs = currentProgram.attribBits & ~program.attribBits;
	}
	GL.currentProgram = program;
	gl.useProgram(program.program);
	for (var attrib = 0; enableAttribs !== 0 || disableAttribs !== 0; ++attrib)
	{
		var mask = 1 << attrib;
		if ((enableAttribs & mask) !== 0)
			gl.enableVertexAttribArray(attrib);
		else if ((disableAttribs & mask) !== 0)
			gl.disableVertexAttribArray(attrib);
		enableAttribs &= ~mask;
		disableAttribs &= ~mask;
	}

	return program;
};

GL.UnbindProgram = function()
{
	if (GL.currentProgram == null)
		return;
	GL.StreamFlush();
	var i;
	for (i = 0; i < GL.currentProgram.attribs.length; ++i)
		gl.disableVertexAttribArray(GL.currentProgram.attribs[i].location);
	GL.currentProgram = null;
};

GL.identity = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0];

GL.RotationMatrix = function(pitch, yaw, roll)
{
	pitch *= Math.PI / -180.0;
	yaw *= Math.PI / 180.0;
	roll *= Math.PI / 180.0;
	var sp = Math.sin(pitch);
	var cp = Math.cos(pitch);
	var sy = Math.sin(yaw);
	var cy = Math.cos(yaw);
	var sr = Math.sin(roll);
	var cr = Math.cos(roll);
	return [
		cy * cp,					sy * cp,					-sp,
		-sy * cr + cy * sp * sr,	cy * cr + sy * sp * sr,		cp * sr,
		-sy * -sr + cy * sp * cr,	cy * -sr + sy * sp * cr,	cp * cr
	];
};

GL.StreamFlush = function()
{
	if (GL.streamArrayVertexCount === 0)
		return;
	var program = GL.currentProgram;
	if (program != null)
	{
		gl.bindBuffer(gl.ARRAY_BUFFER, GL.streamBuffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, GL.streamBufferPosition,
			GL.streamArrayBytes.subarray(0, GL.streamArrayPosition));
		var attribs = program.attribs;
		for (var i = 0; i < attribs.length; ++i)
		{
			var attrib = attribs[i];
			gl.vertexAttribPointer(attrib.location,
				attrib.components, attrib.type, attrib.normalized,
				program.vertexSize, GL.streamBufferPosition + attrib.offset);
		}
		gl.drawArrays(gl.TRIANGLES, 0, GL.streamArrayVertexCount);
		GL.streamBufferPosition += GL.streamArrayPosition;
	}
	GL.streamArrayPosition = 0;
	GL.streamArrayVertexCount = 0;
}

GL.StreamGetSpace = function(vertexCount)
{
	var program = GL.currentProgram;
	if (program == null)
		return;
	var length = vertexCount * program.vertexSize;
	if ((GL.streamBufferPosition + GL.streamArrayPosition + length) > GL.streamArray.byteLength)
	{
		GL.StreamFlush();
		GL.streamBufferPosition = 0;
	}
	GL.streamArrayVertexCount += vertexCount;
}

GL.StreamWriteFloat = function(x)
{
	GL.streamArrayView.setFloat32(GL.streamArrayPosition, x, true);
	GL.streamArrayPosition += 4;
}

GL.StreamWriteFloat2 = function(x, y)
{
	var view = GL.streamArrayView;
	var position = GL.streamArrayPosition;
	view.setFloat32(position, x, true);
	view.setFloat32(position + 4, y, true);
	GL.streamArrayPosition += 8;
}

GL.StreamWriteFloat3 = function(x, y, z)
{
	var view = GL.streamArrayView;
	var position = GL.streamArrayPosition;
	view.setFloat32(position, x, true);
	view.setFloat32(position + 4, y, true);
	view.setFloat32(position + 8, z, true);
	GL.streamArrayPosition += 12;
}

GL.StreamWriteFloat4 = function(x, y, z, w)
{
	var view = GL.streamArrayView;
	var position = GL.streamArrayPosition;
	view.setFloat32(position, x, true);
	view.setFloat32(position + 4, y, true);
	view.setFloat32(position + 8, z, true);
	view.setFloat32(position + 12, w, true);
	GL.streamArrayPosition += 16;
}

GL.StreamWriteUByte4 = function(x, y, z, w)
{
	var view = GL.streamArrayView;
	var position = GL.streamArrayPosition;
	view.setUint8(position, x);
	view.setUint8(position + 1, y);
	view.setUint8(position + 2, z);
	view.setUint8(position + 3, w);
	GL.streamArrayPosition += 4;
}

GL.StreamDrawTexturedQuad = function(x, y, w, h, u, v, u2, v2)
{
	var x2 = x + w, y2 = y + h;
	GL.StreamGetSpace(6);
	GL.StreamWriteFloat4(x, y, u, v);
	GL.StreamWriteFloat4(x, y2, u, v2);
	GL.StreamWriteFloat4(x2, y, u2, v);
	GL.StreamWriteFloat4(x2, y, u2, v);
	GL.StreamWriteFloat4(x, y2, u, v2);
	GL.StreamWriteFloat4(x2, y2, u2, v2);
}

GL.StreamDrawColoredQuad = function(x, y, w, h, r, g, b, a)
{
	var x2 = x + w, y2 = y + h;
	GL.StreamGetSpace(6);
	GL.StreamWriteFloat2(x, y);
	GL.StreamWriteUByte4(r, g, b, a);
	GL.StreamWriteFloat2(x, y2);
	GL.StreamWriteUByte4(r, g, b, a);
	GL.StreamWriteFloat2(x2, y);
	GL.StreamWriteUByte4(r, g, b, a);
	GL.StreamWriteFloat2(x2, y);
	GL.StreamWriteUByte4(r, g, b, a);
	GL.StreamWriteFloat2(x, y2);
	GL.StreamWriteUByte4(r, g, b, a);
	GL.StreamWriteFloat2(x2, y2);
	GL.StreamWriteUByte4(r, g, b, a);
}

GL.Init = function()
{
	VID.mainwindow = document.getElementById('mainwindow');
	try
	{
		gl = VID.mainwindow.getContext('webgl') || VID.mainwindow.getContext('experimental-webgl');
	}
	catch (e) {}
	if (gl == null)
		Sys.Error('Unable to initialize WebGL. Your browser may not support it.');

	GL.maxtexturesize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

	gl.clearColor(0.0, 0.0, 0.0, 0.0);
	gl.cullFace(gl.FRONT);
	gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);

	GL.modes = [
		['GL_NEAREST', gl.NEAREST, gl.NEAREST],
		['GL_LINEAR', gl.LINEAR, gl.LINEAR],
		['GL_NEAREST_MIPMAP_NEAREST', gl.NEAREST_MIPMAP_NEAREST, gl.NEAREST],
		['GL_LINEAR_MIPMAP_NEAREST', gl.LINEAR_MIPMAP_NEAREST, gl.LINEAR],
		['GL_NEAREST_MIPMAP_LINEAR', gl.NEAREST_MIPMAP_LINEAR, gl.NEAREST],
		['GL_LINEAR_MIPMAP_LINEAR', gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR]
	];
	GL.filter_min = gl.LINEAR_MIPMAP_NEAREST;
	GL.filter_max = gl.LINEAR;

	GL.picmip = Cvar.RegisterVariable('gl_picmip', '0');
	Cmd.AddCommand('gl_texturemode', GL.TextureMode_f);

	GL.streamArray = new ArrayBuffer(8192); // Increasing even a little bit ruins all performance on Mali.
	GL.streamArrayBytes = new Uint8Array(GL.streamArray);
	GL.streamArrayPosition = 0;
	GL.streamArrayVertexCount = 0;
	GL.streamArrayView = new DataView(GL.streamArray);
	GL.streamBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, GL.streamBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, GL.streamArray.byteLength, gl.DYNAMIC_DRAW);
	GL.streamBufferPosition = 0;

	VID.mainwindow.style.display = 'inline-block';
};

// ---- WebQuake/Host.js ----
Host = {};

Host.framecount = 0;

Host.EndGame = function(message)
{
	Con.DPrint('Host.EndGame: ' + message + '\n');
	if (CL.cls.demonum !== -1)
		CL.NextDemo();
	else
		CL.Disconnect();
	throw 'Host.abortserver';
};

Host.Error = function(error)
{
	if (Host.inerror === true)
		Sys.Error('Host.Error: recursively entered');
	Host.inerror = true;
	SCR.EndLoadingPlaque();
	Con.Print('Host.Error: ' + error + '\n');
	if (SV.server.active === true)
		Host.ShutdownServer();
	CL.Disconnect();
	CL.cls.demonum = -1;
	Host.inerror = false;
	throw new Error('Host.abortserver');
};

Host.FindMaxClients = function()
{
	SV.svs.maxclients = SV.svs.maxclientslimit = 1;
	CL.cls.state = CL.active.disconnected;
	SV.svs.clients = [{
		num: 0,
		message: {data: new ArrayBuffer(8000), cursize: 0, allowoverflow: true},
		colors: 0,
		old_frags: 0
	}];
	Cvar.SetValue('deathmatch', 0);
};

Host.InitLocal = function()
{
	Host.InitCommands();
	Host.framerate = Cvar.RegisterVariable('host_framerate', '0');
	Host.speeds = Cvar.RegisterVariable('host_speeds', '0');
	Host.ticrate = Cvar.RegisterVariable('sys_ticrate', '0.05');
	Host.serverprofile = Cvar.RegisterVariable('serverprofile', '0');
	Host.fraglimit = Cvar.RegisterVariable('fraglimit', '0', false, true);
	Host.timelimit = Cvar.RegisterVariable('timelimit', '0', false, true);
	Host.teamplay = Cvar.RegisterVariable('teamplay', '0', false, true);
	Host.samelevel = Cvar.RegisterVariable('samelevel', '0');
	Host.noexit = Cvar.RegisterVariable('noexit', '0', false, true);
	Host.skill = Cvar.RegisterVariable('skill', '1');
	Host.developer = Cvar.RegisterVariable('developer', '0');
	Host.deathmatch = Cvar.RegisterVariable('deathmatch', '0');
	Host.coop = Cvar.RegisterVariable('coop', '0');
	Host.pausable = Cvar.RegisterVariable('pausable', '1');
	Host.temp1 = Cvar.RegisterVariable('temp1', '0');
	Host.FindMaxClients();
};

Host.ClientPrint = function(string)
{
	MSG.WriteByte(Host.client.message, Protocol.svc.print);
	MSG.WriteString(Host.client.message, string);
};

Host.BroadcastPrint = function(string)
{
	var i, client;
	for (i = 0; i < SV.svs.maxclients; ++i)
	{
		client = SV.svs.clients[i];
		if ((client.active !== true) || (client.spawned !== true))
			continue;
		MSG.WriteByte(client.message, Protocol.svc.print);
		MSG.WriteString(client.message, string);
	}
};

Host.DropClient = function(crash)
{
	var client = Host.client;
	if (crash !== true)
	{
		if (NET.CanSendMessage(client.netconnection) === true)
		{
			MSG.WriteByte(client.message, Protocol.svc.disconnect);
			NET.SendMessage(client.netconnection, client.message);
		}
		if ((client.edict != null) && (client.spawned === true))
		{
			var saveSelf = PR.globals_int[PR.globalvars.self];
			PR.globals_int[PR.globalvars.self] = client.edict.num;
			PR.ExecuteProgram(PR.globals_int[PR.globalvars.ClientDisconnect]);
			PR.globals_int[PR.globalvars.self] = saveSelf;
		}
		Sys.Print('Client ' + SV.GetClientName(client) + ' removed\n');
	}
	NET.Close(client.netconnection);
	client.netconnection = null;
	client.active = false;
	SV.SetClientName(client, '');
	client.old_frags = -999999;
	--NET.activeconnections;
	var i, num = client.num;
	for (i = 0; i < SV.svs.maxclients; ++i)
	{
		client = SV.svs.clients[i];
		if (client.active !== true)
			continue;
		MSG.WriteByte(client.message, Protocol.svc.updatename);
		MSG.WriteByte(client.message, num);
		MSG.WriteByte(client.message, 0);
		MSG.WriteByte(client.message, Protocol.svc.updatefrags);
		MSG.WriteByte(client.message, num);
		MSG.WriteShort(client.message, 0);
		MSG.WriteByte(client.message, Protocol.svc.updatecolors);
		MSG.WriteByte(client.message, num);
		MSG.WriteByte(client.message, 0);
	}
};

Host.ShutdownServer = function(crash)
{
	if (SV.server.active !== true)
		return;
	SV.server.active = false;
	if (CL.cls.state === CL.active.connected)
		CL.Disconnect();
	var start = Sys.FloatTime(), count, i;
	do
	{
		count = 0;
		for (i = 0; i < SV.svs.maxclients; ++i)
		{
			Host.client = SV.svs.clients[i];
			if ((Host.client.active !== true) || (Host.client.message.cursize === 0))
				continue;
			if (NET.CanSendMessage(Host.client.netconnection) === true)
			{
				NET.SendMessage(Host.client.netconnection, Host.client.message);
				Host.client.message.cursize = 0;
				continue;
			}
			NET.GetMessage(Host.client.netconnection);
			++count;
		}
		if ((Sys.FloatTime() - start) > 3.0)
			break;
	} while (count !== 0);
	var buf = {data: new ArrayBuffer(4), cursize: 1};
	(new Uint8Array(buf.data))[0] = Protocol.svc.disconnect;
	count = NET.SendToAll(buf);
	if (count !== 0)
		Con.Print('Host.ShutdownServer: NET.SendToAll failed for ' + count + ' clients\n');
	for (i = 0; i < SV.svs.maxclients; ++i)
	{
		Host.client = SV.svs.clients[i];
		if (Host.client.active === true)
			Host.DropClient(crash);
	}
};

Host.WriteConfiguration = function()
{
	COM.WriteTextFile('config.cfg', Key.WriteBindings() + Cvar.WriteVariables());
};

Host.ServerFrame = function()
{
	PR.globals_float[PR.globalvars.frametime] = Host.frametime;
	SV.server.datagram.cursize = 0;
	SV.CheckForNewClients();
	SV.RunClients();
	if ((SV.server.paused !== true) && ((SV.svs.maxclients >= 2) || (Key.dest.value === Key.dest.game)))
		SV.Physics();
	SV.SendClientMessages();
};

Host.time3 = 0.0;
Host._Frame = function()
{
	Math.random();

	Host.realtime = Sys.FloatTime();
	Host.frametime = Host.realtime - Host.oldrealtime;
	Host.oldrealtime = Host.realtime;
	if (Host.framerate.value > 0)
		Host.frametime = Host.framerate.value;
	else
	{
		if (Host.frametime > 0.1)
			Host.frametime = 0.1;
		else if (Host.frametime < 0.001)
			Host.frametime = 0.001;
	}

	if (CL.cls.state === CL.active.connecting)
	{
		NET.CheckForResend();
		SCR.UpdateScreen();
		return;
	}

	var time1, time2, pass1, pass2, pass3, tot;

	Cmd.Execute();

	CL.SendCmd();
	if (SV.server.active === true)
		Host.ServerFrame();

	if (CL.cls.state === CL.active.connected)
		CL.ReadFromServer();

	if (Host.speeds.value !== 0)
		time1 = Sys.FloatTime();
	SCR.UpdateScreen();
	if (Host.speeds.value !== 0)
		time2 = Sys.FloatTime();

	if (CL.cls.signon === 4)
	{
		S.Update(R.refdef.vieworg, R.vpn, R.vright, R.vup);
		CL.DecayLights();
	}
	else
		S.Update(Vec.origin, Vec.origin, Vec.origin, Vec.origin);
	CDAudio.Update();

	if (Host.speeds.value !== 0)
	{
		pass1 = (time1 - Host.time3) * 1000.0;
		Host.time3 = Sys.FloatTime();
		pass2 = (time2 - time1) * 1000.0;
		pass3 = (Host.time3 - time2) * 1000.0;
		tot = Math.floor(pass1 + pass2 + pass3);
		Con.Print((tot <= 99 ? (tot <= 9 ? '  ' : ' ') : '')
			+ tot + ' tot '
			+ (pass1 < 100.0 ? (pass1 < 10.0 ? '  ' : ' ') : '')
			+ Math.floor(pass1) + ' server '
			+ (pass2 < 100.0 ? (pass2 < 10.0 ? '  ' : ' ') : '')
			+ Math.floor(pass2) + ' gfx '
			+ (pass3 < 100.0 ? (pass3 < 10.0 ? '  ' : ' ') : '')
			+ Math.floor(pass3) + ' snd\n');
	}

	if (Host.startdemos === true)
	{
		CL.NextDemo();
		Host.startdemos = false;
	}

	++Host.framecount;
};

Host.timetotal = 0.0;
Host.timecount = 0;
Host.Frame = function()
{
	if (Host.serverprofile.value === 0)
	{
		Host._Frame();
		return;
	}
	var time1 = Sys.FloatTime();
	Host._Frame();
	Host.timetotal += Sys.FloatTime() - time1;
	if (++Host.timecount <= 999)
		return;
	var m = (Host.timetotal * 1000.0 / Host.timecount) >> 0;
	Host.timecount = 0;
	Host.timetotal = 0.0;
	var i, c = 0;
	for (i = 0; i < SV.svs.maxclients; ++i)
	{
		if (SV.svs.clients[i].active === true)
			++c;
	}
	Con.Print('serverprofile: ' + (c <= 9 ? ' ' : '') + c + ' clients ' + (m <= 9 ? ' ' : '') + m + ' msec\n');
};

Host.Init = function()
{
	Host.oldrealtime = Sys.FloatTime();
	Cmd.Init();
	V.Init();
	Chase.Init();
	COM.Init();
	Host.InitLocal();
	W.LoadWadFile('gfx.wad');
	Key.Init();
	Con.Init();
	PR.Init();
	Mod.Init();
	NET.Init();
	SV.Init();
	Con.Print(Def.timedate);
	VID.Init();
	Draw.Init();
	SCR.Init();
	R.Init();
	S.Init();
	M.Init();
	CDAudio.Init();
	Sbar.Init();
	CL.Init();
	IN.Init();
	Cmd.text = 'exec quake.rc\n' + Cmd.text;
	Host.initialized = true;
	Sys.Print('========Quake Initialized=========\n');
};

Host.Shutdown = function()
{
	if (Host.isdown === true)
	{
		Sys.Print('recursive shutdown\n');
		return;
	}
	Host.isdown = true;
	Host.WriteConfiguration();
	CDAudio.Stop();
	NET.Shutdown();
	S.StopAllSounds();
	IN.Shutdown();
};

// Commands

Host.Quit_f = function()
{
	if (Key.dest.value !== Key.dest.console)
	{
		M.Menu_Quit_f();
		return;
	}
	Sys.Quit();
};

Host.Status_f = function()
{
	var print;
	if (Cmd.client !== true)
	{
		if (SV.server.active !== true)
		{
			Cmd.ForwardToServer();
			return;
		}
		print = Con.Print;
	}
	else
		print = SV.ClientPrint;
	print('host:    ' + NET.hostname.string + '\n');
	print('version: 1.09\n');
	print('map:     ' + PR.GetString(PR.globals_int[PR.globalvars.mapname]) + '\n');
	print('players: ' + NET.activeconnections + ' active (' + SV.svs.maxclients + ' max)\n\n');
	var i, client, str, frags, hours, minutes, seconds;
	for (i = 0; i < SV.svs.maxclients; ++i)
	{
		client = SV.svs.clients[i];
		if (client.active !== true)
			continue;
		frags = client.edict.v_float[PR.entvars.frags].toFixed(0);
		if (frags.length === 1)
			frags = '  ' + frags;
		else if (frags.length === 2)
			frags = ' ' + frags;
		seconds = (NET.time - client.netconnection.connecttime) >> 0;
		minutes = (seconds / 60) >> 0;
		if (minutes !== 0)
		{
			seconds -= minutes * 60;
			hours = (minutes / 60) >> 0;
			if (hours !== 0)
				minutes -= hours * 60;
		}
		else
			hours = 0;
		str = '#' + (i + 1) + ' ';
		if (i <= 8)
			str += ' ';
		str += SV.GetClientName(client);
		for (; str.length <= 21; )
			str += ' ';
		str += frags + '  ';
		if (hours <= 9)
			str += ' ';
		str += hours + ':';
		if (minutes <= 9)
			str += '0';
		str += minutes + ':';
		if (seconds <= 9)
			str += '0';
		print(str + seconds + '\n');
		print('   ' + client.netconnection.address + '\n');
	}
};

Host.God_f = function()
{
	if (Cmd.client !== true)
	{
		Cmd.ForwardToServer();
		return;
	}
	if (PR.globals_float[PR.globalvars.deathmatch] !== 0)
		return;
	SV.player.v_float[PR.entvars.flags] ^= SV.fl.godmode;
	if ((SV.player.v_float[PR.entvars.flags] & SV.fl.godmode) === 0)
		Host.ClientPrint('godmode OFF\n');
	else
		Host.ClientPrint('godmode ON\n');
};

Host.Notarget_f = function()
{
	if (Cmd.client !== true)
	{
		Cmd.ForwardToServer();
		return;
	}
	if (PR.globals_float[PR.globalvars.deathmatch] !== 0)
		return;
	SV.player.v_float[PR.entvars.flags] ^= SV.fl.notarget;
	if ((SV.player.v_float[PR.entvars.flags] & SV.fl.notarget) === 0)
		Host.ClientPrint('notarget OFF\n');
	else
		Host.ClientPrint('notarget ON\n');
};

Host.Noclip_f = function()
{
	if (Cmd.client !== true)
	{
		Cmd.ForwardToServer();
		return;
	}
	if (PR.globals_float[PR.globalvars.deathmatch] !== 0)
		return;
	if (SV.player.v_float[PR.entvars.movetype] !== SV.movetype.noclip)
	{
		Host.noclip_anglehack = true;
		SV.player.v_float[PR.entvars.movetype] = SV.movetype.noclip;
		Host.ClientPrint('noclip ON\n');
		return;
	}
	Host.noclip_anglehack = false;
	SV.player.v_float[PR.entvars.movetype] = SV.movetype.walk;
	Host.ClientPrint('noclip OFF\n');
};

Host.Fly_f = function()
{
	if (Cmd.client !== true)
	{
		Cmd.ForwardToServer();
		return;
	}
	if (PR.globals_float[PR.globalvars.deathmatch] !== 0)
		return;
	if (SV.player.v_float[PR.entvars.movetype] !== SV.movetype.fly)
	{
		SV.player.v_float[PR.entvars.movetype] = SV.movetype.fly;
		Host.ClientPrint('flymode ON\n');
		return;
	}
	SV.player.v_float[PR.entvars.movetype] = SV.movetype.walk;
	Host.ClientPrint('flymode OFF\n');
};

Host.Ping_f = function()
{
	if (Cmd.client !== true)
	{
		Cmd.ForwardToServer();
		return;
	}
	Host.ClientPrint('Client ping times:\n');
	var i, client, total, j;
	for (i = 0; i < SV.svs.maxclients; ++i)
	{
		client = SV.svs.clients[i];
		if (client.active !== true)
			continue;
		total = 0;
		for (j = 0; j <= 15; ++j)
			total += client.ping_times[j];
		total = (total * 62.5).toFixed(0);
		if (total.length === 1)
			total = '   ' + total;
		else if (total.length === 2)
			total = '  ' + total;
		else if (total.length === 3)
			total = ' ' + total;
		Host.ClientPrint(total + ' ' + SV.GetClientName(client) + '\n');
	}
};

Host.Map_f = function()
{
	if (Cmd.argv.length <= 1)
	{
		Con.Print('USAGE: map <map>\n');
		return;
	}
	if (Cmd.client === true)
		return;
	CL.cls.demonum = -1;
	CL.Disconnect();
	Host.ShutdownServer();
	Key.dest.value = Key.dest.game;
	SCR.BeginLoadingPlaque();
	SV.svs.serverflags = 0;
	SV.SpawnServer(Cmd.argv[1]);
	if (SV.server.active !== true)
		return;
	CL.cls.spawnparms = '';
	var i;
	for (i = 2; i < Cmd.argv.length; ++i)
		CL.cls.spawnparms += Cmd.argv[i] + ' ';
	Cmd.ExecuteString('connect local');
};

Host.Changelevel_f = function()
{
	if (Cmd.argv.length !== 2)
	{
		Con.Print('changelevel <levelname> : continue game on a new level\n');
		return;
	}
	if ((SV.server.active !== true) || (CL.cls.demoplayback === true))
	{
		Con.Print('Only the server may changelevel\n');
		return;
	}
	SV.SaveSpawnparms();
	SV.SpawnServer(Cmd.argv[1]);
};

Host.Restart_f = function()
{
	if ((CL.cls.demoplayback !== true) && (SV.server.active === true) && (Cmd.client !== true))
		SV.SpawnServer(PR.GetString(PR.globals_int[PR.globalvars.mapname]));
};

Host.Reconnect_f = function()
{
	SCR.BeginLoadingPlaque();
	CL.cls.signon = 0;
};

Host.Connect_f = function()
{
	CL.cls.demonum = -1;
	if (CL.cls.demoplayback === true)
	{
		CL.StopPlayback();
		CL.Disconnect();
	}
	CL.EstablishConnection(Cmd.argv[1]);
	CL.cls.signon = 0;
};

Host.SavegameComment = function()
{
	var text = CL.state.levelname.replace(/\s/gm, '_');
	var i;
	for (i = CL.state.levelname.length; i <= 21; ++i)
		text += '_';

	text += 'kills:';
	var kills = CL.state.stats[Def.stat.monsters].toString();
	if (kills.length === 2)
		text += '_';
	else if (kills.length === 1)
		text += '__';
	text += kills + '/';
	kills = CL.state.stats[Def.stat.totalmonsters].toString();
	if (kills.length === 2)
		text += '_';
	else if (kills.length === 1)
		text += '__';
	text += kills;

	return text + '____';
};

Host.Savegame_f = function()
{
	if (Cmd.client === true)
		return;
	if (SV.server.active !== true)
	{
		Con.Print('Not playing a local game.\n');
		return;
	}
	if (CL.state.intermission !== 0)
	{
		Con.Print('Can\'t save in intermission.\n');
		return;
	}
	if (SV.svs.maxclients !== 1)
	{
		Con.Print('Can\'t save multiplayer games.\n');
		return;
	}
	if (Cmd.argv.length !== 2)
	{
		Con.Print('save <savename> : save a game\n');
		return;
	}
	if (Cmd.argv[1].indexOf('..') !== -1)
	{
		Con.Print('Relative pathnames are not allowed.\n');
		return;
	}
	var client = SV.svs.clients[0];
	if (client.active === true)
	{
		if (client.edict.v_float[PR.entvars.health] <= 0.0)
		{
			Con.Print('Can\'t savegame with a dead player\n');
			return;
		}
	}
	var f = ['5\n' + Host.SavegameComment() + '\n'];
	var i;
	for (i = 0; i <= 15; ++i)
		f[f.length] = client.spawn_parms[i].toFixed(6) + '\n';
	f[f.length] = Host.current_skill + '\n' + PR.GetString(PR.globals_int[PR.globalvars.mapname]) + '\n' + SV.server.time.toFixed(6) + '\n';
	for (i = 0; i <= 63; ++i)
	{
		if (SV.server.lightstyles[i].length !== 0)
			f[f.length] = SV.server.lightstyles[i] + '\n';
		else
			f[f.length] = 'm\n';
	}
	f[f.length] = '{\n';
	var def, type;
	for (i = 0; i < PR.globaldefs.length; ++i)
	{
		def = PR.globaldefs[i];
		type = def.type;
		if ((type & 0x8000) === 0)
			continue;
		type &= 0x7fff;
		if ((type !== PR.etype.ev_string) && (type !== PR.etype.ev_float) && (type !== PR.etype.entity))
			continue;
		f[f.length] = '"' + PR.GetString(def.name) + '" "' + PR.UglyValueString(type, PR.globals, def.ofs) + '"\n';
	}
	f[f.length] = '}\n';
	var ed, j, name, v;
	for (i = 0; i < SV.server.num_edicts; ++i)
	{
		ed = SV.server.edicts[i];
		if (ed.free === true)
		{
			f[f.length] = '{\n}\n';
			continue;
		}
		f[f.length] = '{\n';
		for (j = 1; j < PR.fielddefs.length; ++j)
		{
			def = PR.fielddefs[j];
			name = PR.GetString(def.name);
			if (name.charCodeAt(name.length - 2) === 95)
				continue;
			type = def.type & 0x7fff;
			v = def.ofs;
			if (ed.v_int[v] === 0)
			{
				if (type === 3)
				{
					if ((ed.v_int[v + 1] === 0) && (ed.v_int[v + 2] === 0))
						continue;
				}
				else
					continue;
			}
			f[f.length] = '"' + name + '" "' + PR.UglyValueString(type, ed.v, def.ofs) + '"\n';
		}
		f[f.length] = '}\n';
	}
	name = COM.DefaultExtension(Cmd.argv[1], '.sav');
	Con.Print('Saving game to ' + name + '...\n');
	if (COM.WriteTextFile(name, f.join('')) === true)
		Con.Print('done.\n');
	else
		Con.Print('ERROR: couldn\'t open.\n');
};

Host.Loadgame_f = function()
{
	if (Cmd.client === true)
		return;
	if (Cmd.argv.length !== 2)
	{
		Con.Print('load <savename> : load a game\n');
		return;
	}
	CL.cls.demonum = -1;
	var name = COM.DefaultExtension(Cmd.argv[1], '.sav');
	Con.Print('Loading game from ' + name + '...\n');
	var f = COM.LoadTextFile(name);
	if (f == null)
	{
		Con.Print('ERROR: couldn\'t open.\n');
		return;
	}
	f = f.split('\n');

	var i;

	var tfloat = parseFloat(f[0]);
	if (tfloat !== 5)
	{
		Con.Print('Savegame is version ' + tfloat + ', not 5\n');
		return;
	}

	var spawn_parms = [];
	for (i = 0; i <= 15; ++i)
		spawn_parms[i] = parseFloat(f[2 + i]);

	Host.current_skill = (parseFloat(f[18]) + 0.1) >> 0;
	Cvar.SetValue('skill', Host.current_skill);

	var time = parseFloat(f[20]);
	CL.Disconnect();
	SV.SpawnServer(f[19]);
	if (SV.server.active !== true)
	{
		Con.Print('Couldn\'t load map\n');
		return;
	}
	SV.server.paused = true;
	SV.server.loadgame = true;

	for (i = 0; i <= 63; ++i)
		SV.server.lightstyles[i] = f[21 + i];

	var token, keyname, key, i;

	if (f[85] !== '{')
		Sys.Error('First token isn\'t a brace');
	for (i = 86; i < f.length; ++i)
	{
		if (f[i] === '}')
		{
			++i;
			break;
		}
		token = f[i].split('"');
		keyname = token[1];
		key = ED.FindGlobal(keyname);
		if (key == null)
		{
			Con.Print('\'' + keyname + '\' is not a global\n');
			continue;
		}
		if (ED.ParseEpair(PR.globals, key, token[3]) !== true)
			Host.Error('Host.Loadgame_f: parse error');
	}

	f[f.length] = '';
	var entnum = 0, ent, j;
	var data = f.slice(i).join('\n');
	for (;;)
	{
		data = COM.Parse(data);
		if (data == null)
			break;
		if (COM.token.charCodeAt(0) !== 123)
			Sys.Error('Host.Loadgame_f: found ' + COM.token + ' when expecting {');
		ent = SV.server.edicts[entnum++];
		for (j = 0; j < PR.entityfields; ++j)
			ent.v_int[j] = 0;
		ent.free = false;
		data = ED.ParseEdict(data, ent);
		if (ent.free !== true)
			SV.LinkEdict(ent);
	}
	SV.server.num_edicts = entnum;

	SV.server.time = time;
	var client = SV.svs.clients[0];
	client.spawn_parms = [];
	for (i = 0; i <= 15; ++i)
		client.spawn_parms[i] = spawn_parms[i];
	CL.EstablishConnection('local');
	Host.Reconnect_f();
};

Host.Name_f = function()
{
	if (Cmd.argv.length <= 1)
	{
		Con.Print('"name" is "' + CL.name.string + '"\n');
		return;
	}

	var newName;
	if (Cmd.argv.length === 2)
		newName = Cmd.argv[1].substring(0, 15);
	else
		newName = Cmd.args.substring(0, 15);

	if (Cmd.client !== true)
	{
		Cvar.Set('_cl_name', newName);
		if (CL.cls.state === CL.active.connected)
			Cmd.ForwardToServer();
		return;
	}

	var name = SV.GetClientName(Host.client);
	if ((name.length !== 0) && (name !== 'unconnected') && (name !== newName))
		Con.Print(name + ' renamed to ' + newName + '\n');
	SV.SetClientName(Host.client, newName);
	var msg = SV.server.reliable_datagram;
	MSG.WriteByte(msg, Protocol.svc.updatename);
	MSG.WriteByte(msg, Host.client.num);
	MSG.WriteString(msg, newName);
};

Host.Version_f = function()
{
	Con.Print('Version 1.09\n');
	Con.Print(Def.timedate);
};

Host.Say = function(teamonly)
{
	if (Cmd.client !== true)
	{
		Cmd.ForwardToServer();
		return;
	}
	if (Cmd.argv.length <= 1)
		return;
	var save = Host.client;
	var p = Cmd.args;
	if (p.charCodeAt(0) === 34)
		p = p.substring(1, p.length - 1);
	text = '\1' + SV.GetClientName(save) + ': ';
	var i = 62 - text.length;
	if (p.length > i)
		p = p.substring(0, i);
	text += p + '\n';
	var client;
	for (i = 0; i < SV.svs.maxclients; ++i)
	{
		client = SV.svs.clients[i];
		if ((client.active !== true) || (client.spawned !== true))
			continue;
		if ((Host.teamplay.value !== 0) && (teamonly === true) && (client.v_float[PR.entvars.team] !== save.v_float[PR.entvars.team]))
			continue;
		Host.client = client;
		Host.ClientPrint(text);
	}
	Host.client = save;
	Sys.Print(text.substring(1));
};

Host.Say_Team_f = function()
{
	Host.Say(true);
};

Host.Tell_f = function()
{
	if (Cmd.client !== true)
	{
		Cmd.ForwardToServer();
		return;
	}
	if (Cmd.argv.length <= 2)
		return;
	var text = SV.GetClientName(Host.client) + ': ';
	var p = Cmd.args;
	if (p.charCodeAt(0) === 34)
		p = p.substring(1, p.length - 1);
	var i = 62 - text.length;
	if (p.length > i)
		 p = p.substring(0, i);
	text += p + '\n';
	var save = Host.client, client;
	for (i = 0; i < SV.svs.maxclients; ++i)
	{
		client = SV.svs.clients[i];
		if ((client.active !== true) || (client.spawned !== true))
			continue;
		if (SV.GetClientName(client).toLowerCase() !== Cmd.argv[1].toLowerCase())
			continue;
		Host.client = client;
		Host.ClientPrint(text);
		break;
	}
	Host.client = save;
};

Host.Color_f = function()
{
	if (Cmd.argv.length <= 1)
	{
		Con.Print('"color" is "' + (CL.color.value >> 4) + ' ' + (CL.color.value & 15) + '"\ncolor <0-13> [0-13]\n');
		return;
	}

	var top, bottom;
	if (Cmd.argv.length === 2)
		top = bottom = (Q.atoi(Cmd.argv[1]) & 15) >>> 0;
	else
	{
		top = (Q.atoi(Cmd.argv[1]) & 15) >>> 0;
		bottom = (Q.atoi(Cmd.argv[2]) & 15) >>> 0;
	}
	if (top >= 14)
		top = 13;
	if (bottom >= 14)
		bottom = 13;
	var playercolor = (top << 4) + bottom;

	if (Cmd.client !== true)
	{
		Cvar.SetValue('_cl_color', playercolor);
		if (CL.cls.state === CL.active.connected)
			Cmd.ForwardToServer();
		return;
	}

	Host.client.colors = playercolor;
	Host.client.edict.v_float[PR.entvars.team] = bottom + 1;
	var msg = SV.server.reliable_datagram;
	MSG.WriteByte(msg, Protocol.svc.updatecolors);
	MSG.WriteByte(msg, Host.client.num);
	MSG.WriteByte(msg, playercolor);
};

Host.Kill_f = function()
{
	if (Cmd.client !== true)
	{
		Cmd.ForwardToServer();
		return;
	}
	if (SV.player.v_float[PR.entvars.health] <= 0.0)
	{
		Host.ClientPrint('Can\'t suicide -- allready dead!\n');
		return;
	}
	PR.globals_float[PR.globalvars.time] = SV.server.time;
	PR.globals_int[PR.globalvars.self] = SV.player.num;
	PR.ExecuteProgram(PR.globals_int[PR.globalvars.ClientKill]);
};

Host.Pause_f = function()
{
	if (Cmd.client !== true)
	{
		Cmd.ForwardToServer();
		return;
	}
	if (Host.pausable.value === 0)
	{
		Host.ClientPrint('Pause not allowed.\n');
		return;
	}
	SV.server.paused = !SV.server.paused;
	Host.BroadcastPrint(SV.GetClientName(Host.client) + (SV.server.paused === true ? ' paused the game\n' : ' unpaused the game\n'));
	MSG.WriteByte(SV.server.reliable_datagram, Protocol.svc.setpause);
	MSG.WriteByte(SV.server.reliable_datagram, SV.server.paused === true ? 1 : 0);
};

Host.PreSpawn_f = function()
{
	if (Cmd.client !== true)
	{
		Con.Print('prespawn is not valid from the console\n');
		return;
	}
	var client = Host.client;
	if (client.spawned === true)
	{
		Con.Print('prespawn not valid -- allready spawned\n');
		return;
	}
	SZ.Write(client.message, new Uint8Array(SV.server.signon.data), SV.server.signon.cursize);
	MSG.WriteByte(client.message, Protocol.svc.signonnum);
	MSG.WriteByte(client.message, 2);
	client.sendsignon = true;
};

Host.Spawn_f = function()
{
	if (Cmd.client !== true)
	{
		Con.Print('spawn is not valid from the console\n');
		return;
	}
	var client = Host.client;
	if (client.spawned === true)
	{
		Con.Print('Spawn not valid -- allready spawned\n');
		return;
	}

	var i;

	var ent = client.edict;
	if (SV.server.loadgame === true)
		SV.server.paused = false;
	else
	{
		for (i = 0; i < PR.entityfields; ++i)
			ent.v_int[i] = 0;
		ent.v_float[PR.entvars.colormap] = ent.num;
		ent.v_float[PR.entvars.team] = (client.colors & 15) + 1;
		ent.v_int[PR.entvars.netname] = PR.netnames + (client.num << 5);
		for (i = 0; i <= 15; ++i)
			PR.globals_float[PR.globalvars.parms + i] = client.spawn_parms[i];
		PR.globals_float[PR.globalvars.time] = SV.server.time;
		PR.globals_int[PR.globalvars.self] = ent.num;
		PR.ExecuteProgram(PR.globals_int[PR.globalvars.ClientConnect]);
		if ((Sys.FloatTime() - client.netconnection.connecttime) <= SV.server.time)
			Sys.Print(SV.GetClientName(client) + ' entered the game\n');
		PR.ExecuteProgram(PR.globals_int[PR.globalvars.PutClientInServer]);
	}

	var message = client.message;
	message.cursize = 0;
	MSG.WriteByte(message, Protocol.svc.time);
	MSG.WriteFloat(message, SV.server.time);
	for (i = 0; i < SV.svs.maxclients; ++i)
	{
		client = SV.svs.clients[i];
		MSG.WriteByte(message, Protocol.svc.updatename);
		MSG.WriteByte(message, i);
		MSG.WriteString(message, SV.GetClientName(client));
		MSG.WriteByte(message, Protocol.svc.updatefrags);
		MSG.WriteByte(message, i);
		MSG.WriteShort(message, client.old_frags);
		MSG.WriteByte(message, Protocol.svc.updatecolors);
		MSG.WriteByte(message, i);
		MSG.WriteByte(message, client.colors);
	}
	for (i = 0; i <= 63; ++i)
	{
		MSG.WriteByte(message, Protocol.svc.lightstyle);
		MSG.WriteByte(message, i);
		MSG.WriteString(message, SV.server.lightstyles[i]);
	}
	MSG.WriteByte(message, Protocol.svc.updatestat);
	MSG.WriteByte(message, Def.stat.totalsecrets);
	MSG.WriteLong(message, PR.globals_float[PR.globalvars.total_secrets]);
	MSG.WriteByte(message, Protocol.svc.updatestat);
	MSG.WriteByte(message, Def.stat.totalmonsters);
	MSG.WriteLong(message, PR.globals_float[PR.globalvars.total_monsters]);
	MSG.WriteByte(message, Protocol.svc.updatestat);
	MSG.WriteByte(message, Def.stat.secrets);
	MSG.WriteLong(message, PR.globals_float[PR.globalvars.found_secrets]);
	MSG.WriteByte(message, Protocol.svc.updatestat);
	MSG.WriteByte(message, Def.stat.monsters);
	MSG.WriteLong(message, PR.globals_float[PR.globalvars.killed_monsters]);
	MSG.WriteByte(message, Protocol.svc.setangle);
	MSG.WriteAngle(message, ent.v_float[PR.entvars.angles]);
	MSG.WriteAngle(message, ent.v_float[PR.entvars.angles1]);
	MSG.WriteAngle(message, 0.0);
	SV.WriteClientdataToMessage(ent, message);
	MSG.WriteByte(message, Protocol.svc.signonnum);
	MSG.WriteByte(message, 3);
	Host.client.sendsignon = true;
};

Host.Begin_f = function()
{
	if (Cmd.client !== true)
	{
		Con.Print('begin is not valid from the console\n');
		return;
	}
	Host.client.spawned = true;
};

Host.Kick_f = function()
{
	if (Cmd.client !== true)
	{
		if (SV.server.active !== true)
		{
			Cmd.ForwardToServer();
			return;
		}
	}
	else if (PR.globals_float[PR.globalvars.deathmatch] !== 0.0)
		return;
	if (Cmd.argv.length <= 1)
		return;
	var save = Host.client;
	var s = Cmd.argv[1].toLowerCase();
	var i, byNumber;
	if ((Cmd.argv.length >= 3) && (s === '#'))
	{
		i = Q.atoi(Cmd.argv[2]) - 1;
		if ((i < 0) || (i >= SV.svs.maxclients))
			return;
		if (SV.svs.clients[i].active !== true)
			return;
		Host.client = SV.svs.clients[i];
		byNumber = true;
	}
	else
	{
		for (i = 0; i < SV.svs.maxclients; ++i)
		{
			Host.client = SV.svs.clients[i];
			if (Host.client.active !== true)
				continue;
			if (SV.GetClientName(Host.client).toLowerCase() === s)
				break;
		}
	}
	if (i >= SV.svs.maxclients)
	{
		Host.client = save;
		return;
	}
	if (Host.client === save)
		return;
	var who;
	if (Cmd.client !== true)
		who = CL.name.string;
	else
	{
		if (Host.client === save)
			return;
		who = SV.GetClientName(save);
	}
	var message;
	if (Cmd.argv.length >= 3)
		message = COM.Parse(Cmd.args);
	if (message != null)
	{
		var p = 0;
		if (byNumber === true)
		{
			++p;
			for (; p < message.length; ++p)
			{
				if (message.charCodeAt(p) !== 32)
					break;
			}
			p += Cmd.argv[2].length;
		}
		for (; p < message.length; ++p)
		{
			if (message.charCodeAt(p) !== 32)
				break;
		}
		Host.ClientPrint('Kicked by ' + who + ': ' + message.substring(p) + '\n');
	}
	else
		Host.ClientPrint('Kicked by ' + who + '\n');
	Host.DropClient();
	Host.client = save;
};

Host.Give_f = function()
{
	if (Cmd.client !== true)
	{
		Cmd.ForwardToServer();
		return;
	}
	if (PR.globals_float[PR.globalvars.deathmatch] !== 0)
		return;
	if (Cmd.argv.length <= 1)
		return;
	var t = Cmd.argv[1].charCodeAt(0);
	var ent = SV.player;

	if ((t >= 48) && (t <= 57))
	{
		if (COM.hipnotic !== true)
		{
			if (t >= 50)
				ent.v_float[PR.entvars.items] |= Def.it.shotgun << (t - 50);
			return;
		}
		if (t === 54)
		{
			if (Cmd.argv[1].charCodeAt(1) === 97)
				ent.v_float[PR.entvars.items] |= Def.hit.proximity_gun;
			else
				ent.v_float[PR.entvars.items] |= Def.it.grenade_launcher;
			return;
		}
		if (t === 57)
			ent.v_float[PR.entvars.items] |= Def.hit.laser_cannon;
		else if (t === 48)
			ent.v_float[PR.entvars.items] |= Def.hit.mjolnir;
		else if (t >= 50)
			ent.v_float[PR.entvars.items] |= Def.it.shotgun << (t - 50);
		return;
	}
	var v = Q.atoi(Cmd.argv[2]);
	if (t === 104)
	{
		ent.v_float[PR.entvars.health] = v;
		return;
	}
	if (COM.rogue !== true)
	{
		switch (t)
		{
		case 115:
			ent.v_float[PR.entvars.ammo_shells] = v;
			return;
		case 110:
			ent.v_float[PR.entvars.ammo_nails] = v;
			return;
		case 114:
			ent.v_float[PR.entvars.ammo_rockets] = v;
			return;
		case 99:
			ent.v_float[PR.entvars.ammo_cells] = v;
		}
		return;
	}
	switch (t)
	{
	case 115:
		if (PR.entvars.ammo_shells1 != null)
			ent.v_float[PR.entvars.ammo_shells1] = v;
		ent.v_float[PR.entvars.ammo_shells] = v;
		return;
	case 110:
		if (PR.entvars.ammo_nails1 != null)
		{
			ent.v_float[PR.entvars.ammo_nails1] = v;
			if (ent.v_float[PR.entvars.weapon] <= Def.it.lightning)
				ent.v_float[PR.entvars.ammo_nails] = v;
		}
		return;
	case 108:
		if (PR.entvars.ammo_lava_nails != null)
		{
			ent.v_float[PR.entvars.ammo_lava_nails] = v;
			if (ent.v_float[PR.entvars.weapon] > Def.it.lightning)
				ent.v_float[PR.entvars.ammo_nails] = v;
		}
		return;
	case 114:
		if (PR.entvars.ammo_rockets1 != null)
		{
			ent.v_float[PR.entvars.ammo_rockets1] = v;
			if (ent.v_float[PR.entvars.weapon] <= Def.it.lightning)
				ent.v_float[PR.entvars.ammo_rockets] = v;
		}
		return;
	case 109:
		if (PR.entvars.ammo_multi_rockets != null)
		{
			ent.v_float[PR.entvars.ammo_multi_rockets] = v;
			if (ent.v_float[PR.entvars.weapon] > Def.it.lightning)
				ent.v_float[PR.entvars.ammo_rockets] = v;
		}
		return;
	case 99:
		if (PR.entvars.ammo_cells1 != null)
		{
			ent.v_float[PR.entvars.ammo_cells1] = v;
			if (ent.v_float[PR.entvars.weapon] <= Def.it.lightning)
				ent.v_float[PR.entvars.ammo_cells] = v;
		}
		return;
	case 112:
		if (PR.entvars.ammo_plasma != null)
		{
			ent.v_float[PR.entvars.ammo_plasma] = v;
			if (ent.v_float[PR.entvars.weapon] > Def.it.lightning)
				ent.v_float[PR.entvars.ammo_cells] = v;
		}
	}
};

Host.FindViewthing = function()
{
	var i, e;
	if (SV.server.active === true)
	{
		for (i = 0; i < SV.server.num_edicts; ++i)
		{
			e = SV.server.edicts[i];
			if (PR.GetString(e.v_int[PR.entvars.classname]) === 'viewthing')
				return e;
		}
	}
	Con.Print('No viewthing on map\n');
};

Host.Viewmodel_f = function()
{
	if (Cmd.argv.length !== 2)
		return;
	var e = Host.FindViewthing();
	if (e == null)
		return;
	var m = Mod.ForName(Cmd.argv[1]);
	if (m == null)
	{
		Con.Print('Can\'t load ' + Cmd.argv[1] + '\n');
		return;
	}
	ent.v_float[PR.entvars.frame] = 0.0;
	CL.state.model_precache[ent.v_float[PR.entvars.modelindex] >> 0] = m;
};

Host.Viewframe_f = function()
{
	var e = Host.FindViewthing();
	if (e == null)
		return;
	var m = CL.state.model_precache[ent.v_float[PR.entvars.modelindex] >> 0];
	var f = Q.atoi(Cmd.argv[1]);
	if (f >= m.frames.length)
		f = m.frames.length - 1;
	e.v_float[PR.entvars.frame] = f;
};

Host.Viewnext_f = function()
{
	var e = Host.FindViewthing();
	if (e == null)
		return;
	var m = CL.state.model_precache[ent.v_float[PR.entvars.modelindex] >> 0];
	var f = (ent.v_float[PR.entvars.frame] >> 0) + 1;
	if (f >= m.frames.length)
		f = m.frames.length - 1;
	e.v_float[PR.entvars.frame] = f;
	Con.Print('frame ' + f + ': ' + m.frames[f].name + '\n');
};

Host.Viewprev_f = function()
{
	var e = Host.FindViewthing();
	if (e == null)
		return;
	var m = CL.state.model_precache[ent.v_float[PR.entvars.modelindex] >> 0];
	var f = (ent.v_float[PR.entvars.frame] >> 0) - 1;
	if (f < 0)
		f = 0;
	e.v_float[PR.entvars.frame] = f;
	Con.Print('frame ' + f + ': ' + m.frames[f].name + '\n');
};

Host.Startdemos_f = function()
{
	Con.Print((Cmd.argv.length - 1) + ' demo(s) in loop\n');
	CL.cls.demos = [];
	var i;
	for (i = 1; i < Cmd.argv.length; ++i)
		CL.cls.demos[i - 1] = Cmd.argv[i];
	if ((CL.cls.demonum !== -1) && (CL.cls.demoplayback !== true))
	{
		CL.cls.demonum = 0;
		if (Host.framecount !== 0)
			CL.NextDemo();
		else
			Host.startdemos = true;
	}
	else
		CL.cls.demonum = -1;
};

Host.Demos_f = function()
{
	if (CL.cls.demonum === -1)
		CL.cls.demonum = 1;
	CL.Disconnect();
	CL.NextDemo();
};

Host.Stopdemo_f = function()
{
	if (CL.cls.demoplayback !== true)
		return;
	CL.StopPlayback();
	CL.Disconnect();
};

Host.InitCommands = function()
{
	Cmd.AddCommand('status', Host.Status_f);
	Cmd.AddCommand('quit', Host.Quit_f);
	Cmd.AddCommand('god', Host.God_f);
	Cmd.AddCommand('notarget', Host.Notarget_f);
	Cmd.AddCommand('fly', Host.Fly_f);
	Cmd.AddCommand('map', Host.Map_f);
	Cmd.AddCommand('restart', Host.Restart_f);
	Cmd.AddCommand('changelevel', Host.Changelevel_f);
	Cmd.AddCommand('connect', Host.Connect_f);
	Cmd.AddCommand('reconnect', Host.Reconnect_f);
	Cmd.AddCommand('name', Host.Name_f);
	Cmd.AddCommand('noclip', Host.Noclip_f);
	Cmd.AddCommand('version', Host.Version_f);
	Cmd.AddCommand('say', Host.Say);
	Cmd.AddCommand('say_team', Host.Say_Team_f);
	Cmd.AddCommand('tell', Host.Tell_f);
	Cmd.AddCommand('color', Host.Color_f);
	Cmd.AddCommand('kill', Host.Kill_f);
	Cmd.AddCommand('pause', Host.Pause_f);
	Cmd.AddCommand('spawn', Host.Spawn_f);
	Cmd.AddCommand('begin', Host.Begin_f);
	Cmd.AddCommand('prespawn', Host.PreSpawn_f);
	Cmd.AddCommand('kick', Host.Kick_f);
	Cmd.AddCommand('ping', Host.Ping_f);
	Cmd.AddCommand('load', Host.Loadgame_f);
	Cmd.AddCommand('save', Host.Savegame_f);
	Cmd.AddCommand('give', Host.Give_f);
	Cmd.AddCommand('startdemos', Host.Startdemos_f);
	Cmd.AddCommand('demos', Host.Demos_f);
	Cmd.AddCommand('stopdemo', Host.Stopdemo_f);
	Cmd.AddCommand('viewmodel', Host.Viewmodel_f);
	Cmd.AddCommand('viewframe', Host.Viewframe_f);
	Cmd.AddCommand('viewnext', Host.Viewnext_f);
	Cmd.AddCommand('viewprev', Host.Viewprev_f);
	Cmd.AddCommand('mcache', Mod.Print);
};

// ---- WebQuake/IN.js ----
IN = {};

// Ghosty: no mouse and no pointer lock. The arcade's Intent (a touch stick, drag-to-look, a game controller) reaches
// the game through Sys (ghosty.js): the look turns the view and the stick's amount moves the player, each frame.

IN.Init = function()
{
};

IN.Shutdown = function()
{
};

IN.Move = function()
{
	Sys.Move(CL.state.cmd, CL.state.viewangles);
};

// ---- WebQuake/Key.js ----
Key = {};

Key.k = {
	tab: 9,
	enter: 13,
	escape: 27,
	space: 32,
	
	backspace: 127,
	uparrow: 128,
	downarrow: 129,
	leftarrow: 130,
	rightarrow: 131,
	
	alt: 132,
	ctrl: 133,
	shift: 134,
	f1: 135,
	f2: 136,
	f3: 137,
	f4: 138,
	f5: 139,
	f6: 140,
	f7: 141,
	f8: 142,
	f9: 143,
	f10: 144,
	f11: 145,
	f12: 146,
	ins: 147,
	del: 148,
	pgdn: 149,
	pgup: 150,
	home: 151,
	end: 152,
	
	pause: 255,
	
	mouse1: 200,
	mouse2: 201,
	mouse3: 202,

	mwheelup: 239,
	mwheeldown: 240
};

Key.lines = [''];
Key.edit_line = '';
Key.history_line = 1;

Key.dest = {
	game: 0,
	console: 1,
	message: 2,
	menu: 3,
	
	value: 0
};

Key.bindings = [];
Key.consolekeys = [];
Key.shift = [];
Key.down = [];

Key.names = [
	{name: 'TAB', keynum: Key.k.tab},
	{name: 'ENTER', keynum: Key.k.enter},
	{name: 'ESCAPE', keynum: Key.k.escape},
	{name: 'SPACE', keynum: Key.k.space},
	{name: 'BACKSPACE', keynum: Key.k.backspace},
	{name: 'UPARROW', keynum: Key.k.uparrow},
	{name: 'DOWNARROW', keynum: Key.k.downarrow},
	{name: 'LEFTARROW', keynum: Key.k.leftarrow},
	{name: 'RIGHTARROW', keynum: Key.k.rightarrow},
	{name: 'ALT', keynum: Key.k.alt},
	{name: 'CTRL', keynum: Key.k.ctrl},
	{name: 'SHIFT', keynum: Key.k.shift},
	{name: 'F1', keynum: Key.k.f1},
	{name: 'F2', keynum: Key.k.f2},
	{name: 'F3', keynum: Key.k.f3},
	{name: 'F4', keynum: Key.k.f4},
	{name: 'F5', keynum: Key.k.f5},
	{name: 'F6', keynum: Key.k.f6},
	{name: 'F7', keynum: Key.k.f7},
	{name: 'F8', keynum: Key.k.f8},
	{name: 'F9', keynum: Key.k.f9},
	{name: 'F10', keynum: Key.k.f10},
	{name: 'F11', keynum: Key.k.f11},
	{name: 'F12', keynum: Key.k.f12},
	{name: 'INS', keynum: Key.k.ins},
	{name: 'DEL', keynum: Key.k.del},
	{name: 'PGDN', keynum: Key.k.pgdn},
	{name: 'PGUP', keynum: Key.k.pgup},
	{name: 'HOME', keynum: Key.k.home},
	{name: 'END', keynum: Key.k.end},
	{name: 'MOUSE1', keynum: Key.k.mouse1},
	{name: 'MOUSE2', keynum: Key.k.mouse2},
	{name: 'MOUSE3', keynum: Key.k.mouse3},
	{name: 'PAUSE', keynum: Key.k.pause},
	{name: 'MWHEELUP', keynum: Key.k.mwheelup},
	{name: 'MWHEELDOWN', keynum: Key.k.mwheeldown},
	{name: 'SEMICOLON', keynum: 59}
];

Key.Console = function(key)
{
	if (key === Key.k.enter)
	{
		Cmd.text += Key.edit_line + '\n';
		Con.Print(']' + Key.edit_line + '\n');
		Key.lines[Key.lines.length] = Key.edit_line;
		Key.edit_line = '';
		Key.history_line = Key.lines.length;
		return;
	}

	if (key === Key.k.tab)
	{
		var cmd = Cmd.CompleteCommand(Key.edit_line);
		if (cmd == null)
			cmd = Cvar.CompleteVariable(Key.edit_line);
		if (cmd == null)
			return;
		Key.edit_line = cmd + ' ';
		return;
	}

	if ((key === Key.k.backspace) || (key === Key.k.leftarrow))
	{
		if (Key.edit_line.length > 0)
			Key.edit_line = Key.edit_line.substring(0, Key.edit_line.length - 1);
		return;
	}

	if (key === Key.k.uparrow)
	{
		if (--Key.history_line < 0)
			Key.history_line = 0;
		Key.edit_line = Key.lines[Key.history_line];
		return;
	}

	if (key === Key.k.downarrow)
	{
		if (Key.history_line >= Key.lines.length)
			return;
		if (++Key.history_line >= Key.lines.length)
		{
			Key.history_line = Key.lines.length;
			Key.edit_line = '';
			return;
		}
		Key.edit_line = Key.lines[Key.history_line];
		return;
	}

	if (key === Key.k.pgup)
	{
		Con.backscroll += 2;
		if (Con.backscroll > Con.text.length)
			Con.backscroll = Con.text.length;
		return;
	}

	if (key === Key.k.pgdn)
	{
		Con.backscroll -= 2;
		if (Con.backscroll < 0)
			Con.backscroll = 0;
		return;
	}

	if (key === Key.k.home)
	{
		Con.backscroll = Con.text.length - 10;
		if (Con.backscroll < 0)
			Con.backscroll = 0;
		return;
	}

	if (key === Key.k.end)
	{
		Con.backscroll = 0;
		return;
	}

	if ((key < 32) || (key > 127))
		return;

	Key.edit_line += String.fromCharCode(key);
};

Key.chat_buffer = '';

Key.Message = function(key)
{
	if (key === Key.k.enter)
	{
		if (Key.team_message === true)
			Cmd.text += 'say_team "' + Key.chat_buffer + '"\n';
		else
			Cmd.text += 'say "' + Key.chat_buffer + '"\n';
		Key.dest.value = Key.dest.game;
		Key.chat_buffer = '';
		return;
	}
	if (key === Key.k.escape)
	{
		Key.dest.value = Key.dest.game;
		Key.chat_buffer = '';
		return;
	}
	if ((key < 32) || (key > 127))
		return;
	if (key === Key.k.backspace)
	{
		if (Key.chat_buffer.length !== 0)
			Key.chat_buffer = Key.chat_buffer.substring(0, Key.chat_buffer.length - 1);
		return;
	}
	if (Key.chat_buffer.length >= 31)
		return;
	Key.chat_buffer = Key.chat_buffer + String.fromCharCode(key);
};

Key.StringToKeynum = function(str)
{
	if (str.length === 1)
		return str.charCodeAt(0);
	str = str.toUpperCase();
	var i;
	for (i = 0; i < Key.names.length; ++i)
	{
		if (Key.names[i].name === str)
			return Key.names[i].keynum;
	}
};

Key.KeynumToString = function(keynum)
{
	if ((keynum > 32) && (keynum < 127))
		return String.fromCharCode(keynum);
	var i;
	for (i = 0; i < Key.names.length; ++i)
	{
		if (Key.names[i].keynum === keynum)
			return Key.names[i].name;
	}
	return '<UNKNOWN KEYNUM>';
};

Key.Unbind_f = function()
{
	if (Cmd.argv.length !== 2)
	{
		Con.Print('unbind <key> : remove commands from a key\n');
		return;
	}
	var b = Key.StringToKeynum(Cmd.argv[1]);
	if (b == null)
	{
		Con.Print('"' + Cmd.argv[1] + '" isn\'t a valid key\n');
		return;
	}
	Key.bindings[b] = null;
};

Key.Unbindall_f = function()
{
	Key.bindings = [];
};

Key.Bind_f = function()
{
	var c = Cmd.argv.length;
	if ((c !== 2) && (c !== 3))
	{
		Con.Print('bind <key> [command] : attach a command to a key\n');
		return;
	}
	var b = Key.StringToKeynum(Cmd.argv[1]);
	if (b == null)
	{
		Con.Print('"' + Cmd.argv[1] + '" isn\'t a valid key\n');
		return;
	}
	if (c === 2)
	{
		if (Key.bindings[b] != null)
			Con.Print('"' + Cmd.argv[1] + '" = "' + Key.bindings[b] + '"\n');
		else
			Con.Print('"' + Cmd.argv[1] + '" is not bound\n');
		return;
	}

	var i, cmd = Cmd.argv[2];
	for (i = 3; i < c; ++i)
	{
		cmd += ' ' + Cmd.argv[i];
	}
	Key.bindings[b] = cmd;
};

Key.WriteBindings = function()
{
	var f = [];
	var i;
	for (i = 0; i < Key.bindings.length; ++i)
	{
		if (Key.bindings[i] != null)
			f[f.length] = 'bind "' + Key.KeynumToString(i) + '" "' + Key.bindings[i] + '"\n';
	}
	return f.join('');
};

Key.Init = function()
{
	var i;

	for (i = 32; i < 128; ++i)
		Key.consolekeys[i] = true;
	Key.consolekeys[Key.k.enter] = true;
	Key.consolekeys[Key.k.tab] = true;
	Key.consolekeys[Key.k.leftarrow] = true;
	Key.consolekeys[Key.k.rightarrow] = true;
	Key.consolekeys[Key.k.uparrow] = true;
	Key.consolekeys[Key.k.downarrow] = true;
	Key.consolekeys[Key.k.backspace] = true;
	Key.consolekeys[Key.k.home] = true;
	Key.consolekeys[Key.k.end] = true;
	Key.consolekeys[Key.k.pgup] = true;
	Key.consolekeys[Key.k.pgdn] = true;
	Key.consolekeys[Key.k.shift] = true;
	Key.consolekeys[96] = false;
	Key.consolekeys[126] = false;

	for (i = 0; i < 256; ++i)
		Key.shift[i] = i;
	for (i = 97; i <= 122; ++i)
		Key.shift[i] = i - 32;
	Key.shift[49] = 33;
	Key.shift[50] = 64;
	Key.shift[51] = 35;
	Key.shift[52] = 36;
	Key.shift[53] = 37;
	Key.shift[54] = 94;
	Key.shift[55] = 38;
	Key.shift[56] = 42;
	Key.shift[57] = 40;
	Key.shift[48] = 41;
	Key.shift[45] = 95;
	Key.shift[61] = 43;
	Key.shift[43] = 60;
	Key.shift[46] = 62;
	Key.shift[47] = 63;
	Key.shift[59] = 58;
	Key.shift[39] = 34;
	Key.shift[91] = 123;
	Key.shift[93] = 125;
	Key.shift[96] = 126;
	Key.shift[92] = 124;

	Cmd.AddCommand('bind', Key.Bind_f);
	Cmd.AddCommand('unbind', Key.Unbind_f);
	Cmd.AddCommand('unbindall', Key.Unbindall_f);
};

Key.Event = function(key, down)
{
	if (CL.cls.state === CL.active.connecting)
		return;
	if (down === true)
	{
		if ((key !== Key.k.backspace) && (key !== Key.k.pause) && (Key.down[key] === true))
			return;
		if ((key >= 200) && (Key.bindings[key] == null))
			Con.Print(Key.KeynumToString(key) + ' is unbound, hit F4 to set.\n');
	}
	Key.down[key] = down;

	if (key === Key.k.shift)
		Key.shift_down = down;

	if (key === Key.k.escape)
	{
		if (down !== true)
			return;
		if (Key.dest.value === Key.dest.message)
			Key.Message(key);
		else if (Key.dest.value === Key.dest.menu)
			M.Keydown(key);
		else
			M.ToggleMenu_f();
		return;
	}

	var kb;

	if (down !== true)
	{
		kb = Key.bindings[key];
		if (kb != null)
		{
			if (kb.charCodeAt(0) === 43)
				Cmd.text += '-' + kb.substring(1) + ' ' + key + '\n';
		}
		if (Key.shift[key] !== key)
		{
			kb = Key.bindings[Key.shift[key]];
			if (kb != null)
			{
				if (kb.charCodeAt(0) === 43)
					Cmd.text += '-' + kb.substring(1) + ' ' + key + '\n';
			}
		}
		return;
	}

	if ((CL.cls.demoplayback === true) && (Key.consolekeys[key] === true) && (Key.dest.value === Key.dest.game))
	{
		M.ToggleMenu_f();
		return;
	}

	if (((Key.dest.value === Key.dest.menu) && ((key === Key.k.escape) || ((key >= Key.k.f1) && (key <= Key.k.f12))))
		|| ((Key.dest.value === Key.dest.console) && (Key.consolekeys[key] !== true))
		|| ((Key.dest.value === Key.dest.game) && ((Con.forcedup !== true) || (Key.consolekeys[key] !== true))))
	{
		kb = Key.bindings[key];
		if (kb != null)
		{
			if (kb.charCodeAt(0) === 43)
				Cmd.text += kb + ' ' + key + '\n';
			else
				Cmd.text += kb + '\n';
		}
		return;
	}

	if (Key.shift_down === true)
		key = Key.shift[key];

	if (Key.dest.value === Key.dest.message)
		Key.Message(key);
	else if (Key.dest.value === Key.dest.menu)
		M.Keydown(key);
	else
		Key.Console(key);
};

// ---- WebQuake/M.js ----
M = {};

M.state =
{
	none: 0,
	main: 1,
	singleplayer: 2,
	load: 3,
	save: 4,
	multiplayer: 5,
	options: 6,
	keys: 7,
	help: 8,
	quit: 9,
	
	value: 0
};

M.DrawCharacter = function(cx, line, num)
{
	Draw.Character(cx + (VID.width >> 1) - 160, line + (VID.height >> 1) - 100, num);
};

M.Print = function(cx, cy, str)
{
	Draw.StringWhite(cx + (VID.width >> 1) - 160, cy + (VID.height >> 1) - 100, str);
};

M.PrintWhite = function(cx, cy, str)
{
	Draw.String(cx + (VID.width >> 1) - 160, cy + (VID.height >> 1) - 100, str);
};

M.DrawPic = function(x, y, pic)
{
	Draw.Pic(x + (VID.width >> 1) - 160, y + (VID.height >> 1) - 100, pic);
};

M.DrawPicTranslate = function(x, y, pic, top, bottom)
{
	Draw.PicTranslate(x + (VID.width >> 1) - 160, y + (VID.height >> 1) - 100, pic, top, bottom);
};

M.DrawTextBox = function(x, y, width, lines)
{
	var cx, cy, n;

	cy = y;
	M.DrawPic(x, cy, M.box_tl);
	for (n = 0; n < lines; ++n)
		M.DrawPic(x, cy += 8, M.box_ml);
	M.DrawPic(x, cy + 8, M.box_bl);

	cx = x + 8;
	var p;
	for (; width > 0; )
	{
		cy = y;
		M.DrawPic(cx, y, M.box_tm);
		p = M.box_mm;
		for (n = 0; n < lines; ++n)
		{
			M.DrawPic(cx, cy += 8, p);
			if (n === 0)
				p = M.box_mm2;
		}
		M.DrawPic(cx, cy + 8, M.box_bm);
		width -= 2;
		cx += 16;
	}

	cy = y;
	M.DrawPic(cx, cy, M.box_tr);
	for (n = 0; n < lines; ++n)
		M.DrawPic(cx, cy += 8, M.box_mr);
	M.DrawPic(cx, cy + 8, M.box_br);
};

M.ToggleMenu_f = function()
{
	M.entersound = true;
	if (Key.dest.value === Key.dest.menu)
	{
		if (M.state.value !== M.state.main)
		{
			M.Menu_Main_f();
			return;
		}
		Key.dest.value = Key.dest.game;
		M.state.value = M.state.none;
		return;
	}
	M.Menu_Main_f();
};


// Main menu
M.main_cursor = 0;
M.main_items = 5;

M.Menu_Main_f = function()
{
	if (Key.dest.value !== Key.dest.menu)
	{
		M.save_demonum = CL.cls.demonum;
		CL.cls.demonum = -1;
	}
	Key.dest.value = Key.dest.menu;
	M.state.value = M.state.main;
	M.entersound = true;
};

M.Main_Draw = function()
{
	M.DrawPic(16, 4, M.qplaque);
	M.DrawPic(160 - (M.ttl_main.width >> 1), 4, M.ttl_main);
	M.DrawPic(72, 32, M.mainmenu);
	M.DrawPic(54, 32 + M.main_cursor * 20, M.menudot[Math.floor(Host.realtime * 10.0) % 6]);
};

M.Main_Key = function(k)
{
	switch (k)
	{
	case Key.k.escape:
		Key.dest.value = Key.dest.game;
		M.state.value = M.state.none;
		CL.cls.demonum = M.save_demonum;
		if ((CL.cls.demonum !== -1) && (CL.cls.demoplayback !== true) && (CL.cls.state !== CL.active.connected))
			CL.NextDemo();
		return;
	case Key.k.downarrow:
		S.LocalSound(M.sfx_menu1);
		if (++M.main_cursor >= M.main_items)
			M.main_cursor = 0;
		return;
	case Key.k.uparrow:
		S.LocalSound(M.sfx_menu1);
		if (--M.main_cursor < 0)
			M.main_cursor = M.main_items - 1;
		return;
	case Key.k.enter:
		M.entersound = true;
		switch (M.main_cursor)
		{
		case 0:
			M.Menu_SinglePlayer_f();
			return;
		case 1:
			M.Menu_MultiPlayer_f();
			return;
		case 2:
			M.Menu_Options_f();
			return;
		case 3:
			M.Menu_Help_f();
			return;
		case 4:
			M.Menu_Quit_f();
		}
	}
};

// Single player menu
M.singleplayer_cursor = 0;
M.singleplayer_items = 3;

M.Menu_SinglePlayer_f = function()
{
	Key.dest.value = Key.dest.menu;
	M.state.value = M.state.singleplayer;
	M.entersound = true;
};

M.SinglePlayer_Draw = function()
{
	M.DrawPic(16, 4, M.qplaque);
	M.DrawPic(160 - (M.ttl_sgl.width >> 1), 4, M.ttl_sgl);
	M.DrawPic(72, 32, M.sp_menu);
	M.DrawPic(54, 32 + M.singleplayer_cursor * 20, M.menudot[Math.floor(Host.realtime * 10.0) % 6]);
};

M.SinglePlayer_Key = function(k)
{
	switch (k)
	{
	case Key.k.escape:
		M.Menu_Main_f();
		return;
	case Key.k.downarrow:
		S.LocalSound(M.sfx_menu1);
		if (++M.singleplayer_cursor >= M.singleplayer_items)
			M.singleplayer_cursor = 0;
		return;
	case Key.k.uparrow:
		S.LocalSound(M.sfx_menu1);
		if (--M.singleplayer_cursor < 0)
			M.singleplayer_cursor = M.singleplayer_items - 1;
		return;
	case Key.k.enter:
		M.entersound = true;
		switch (M.singleplayer_cursor)
		{
		case 0:
			if (SV.server.active === true)
			{
				if (confirm('Are you sure you want to start a new game?') !== true)
					return;
				Cmd.text += 'disconnect\n';
			}
			Key.dest.value = Key.dest.game;
			Cmd.text += 'maxplayers 1\nmap start\n';
			return;
		case 1:
			M.Menu_Load_f();
			return;
		case 2:
			M.Menu_Save_f();
		}
	}
};

// Load/save menu
M.load_cursor = 0;
M.max_savegames = 12;
M.filenames = [];
M.loadable = [];
M.removable = [];

M.ScanSaves = function()
{
	var searchpaths = COM.searchpaths, i, j, search = 'Quake.' + COM.gamedir[0].filename + '/s', f, version, name, j, c;
	COM.searchpaths = COM.gamedir;
	for (i = 0; i < M.max_savegames; ++i)
	{
		f = localStorage.getItem(search + i + '.sav');
		if (f != null)
			M.removable[i] = true;
		else
		{
			M.removable[i] = false;
			f = COM.LoadTextFile('s' + i + '.sav');
			if (f == null)
			{
				M.filenames[i] = '--- UNUSED SLOT ---';
				M.loadable[i] = false;
				continue;
			}
		}
		for (version = 0; version < f.length; ++version)
		{
			c = f.charCodeAt(version);
			if (c === 10)
			{
				++version;
				break;
			}
		}
		name = [];
		for (j = 0; j <= 39; ++j)
		{
			c = f.charCodeAt(version + j);
			if (c === 13)
				break;
			if (c === 95)
				name[j] = ' ';
			else
				name[j] = String.fromCharCode(c);
		}
		M.filenames[i] = name.join('');
		M.loadable[i] = true;
	}
	COM.searchpaths = searchpaths;
};

M.Menu_Load_f = function()
{
	M.entersound = true;
	M.state.value = M.state.load;
	Key.dest.value = Key.dest.menu;
	M.ScanSaves();
};

M.Menu_Save_f = function()
{
	if ((SV.server.active !== true) || (CL.state.intermission !== 0) || (SV.svs.maxclients !== 1))
		return;
	M.entersound = true;
	M.state.value = M.state.save;
	Key.dest.value = Key.dest.menu;
	M.ScanSaves();
};

M.Load_Draw = function()
{
	M.DrawPic(160 - (M.p_load.width >> 1), 4, M.p_load);
	var i;
	for (i = 0; i < M.max_savegames; ++i)
		M.Print(16, 32 + (i << 3), M.filenames[i]);
	M.DrawCharacter(8, 32 + (M.load_cursor << 3), 12 + ((Host.realtime * 4.0) & 1));
};

M.Save_Draw = function()
{
	M.DrawPic(160 - (M.p_save.width >> 1), 4, M.p_save);
	var i;
	for (i = 0; i < M.max_savegames; ++i)
		M.Print(16, 32 + (i << 3), M.filenames[i]);
	M.DrawCharacter(8, 32 + (M.load_cursor << 3), 12 + ((Host.realtime * 4.0) & 1));
};

M.Load_Key = function(k)
{
	switch (k)
	{
	case Key.k.escape:
		M.Menu_SinglePlayer_f();
		return;
	case Key.k.enter:
		S.LocalSound(M.sfx_menu2);
		if (M.loadable[M.load_cursor] !== true)
			return;
		M.state.value = M.state.none;
		Key.dest.value = Key.dest.game;
		SCR.BeginLoadingPlaque();
		Cmd.text += 'load s' + M.load_cursor + '\n';
		return;
	case Key.k.uparrow:
	case Key.k.leftarrow:
		S.LocalSound(M.sfx_menu1);
		if (--M.load_cursor < 0)
			M.load_cursor = M.max_savegames - 1;
		return;
	case Key.k.downarrow:
	case Key.k.rightarrow:
		S.LocalSound(M.sfx_menu1);
		if (++M.load_cursor >= M.max_savegames)
			M.load_cursor = 0;
		return;
	case Key.k.del:
		if (M.removable[M.load_cursor] !== true)
			return;
		if (confirm('Delete selected game?') !== true)
			return;
		localStorage.removeItem('Quake.' + COM.gamedir[0].filename + '/s' + M.load_cursor + '.sav');
		M.ScanSaves();
	}
};

M.Save_Key = function(k)
{
	switch (k)
	{
	case Key.k.escape:
		M.Menu_SinglePlayer_f();
		return;
	case Key.k.enter:
		M.state.value = M.state.none;
		Key.dest.value = Key.dest.game;
		Cmd.text += 'save s' + M.load_cursor + '\n';
		return;
	case Key.k.uparrow:
	case Key.k.leftarrow:
		S.LocalSound(M.sfx_menu1);
		if (--M.load_cursor < 0)
			M.load_cursor = M.max_savegames - 1;
		return;
	case Key.k.downarrow:
	case Key.k.rightarrow:
		S.LocalSound(M.sfx_menu1);
		if (++M.load_cursor >= M.max_savegames)
			M.load_cursor = 0;
		return;
	case Key.k.del:
		if (M.removable[M.load_cursor] !== true)
			return;
		if (confirm('Delete selected game?') !== true)
			return;
		localStorage.removeItem('Quake.' + COM.gamedir[0].filename + '/s' + M.load_cursor + '.sav');
		M.ScanSaves();
	}
};

// Multiplayer menu
M.multiplayer_cursor = 0;
M.multiplayer_cursor_table = [56, 72, 96, 120, 156];
M.multiplayer_joinname = '';
M.multiplayer_items = 5;

M.Menu_MultiPlayer_f = function()
{
	Key.dest.value = Key.dest.menu;
	M.state.value = M.state.multiplayer;
	M.entersound = true;
	M.multiplayer_myname = CL.name.string;
	M.multiplayer_top = M.multiplayer_oldtop = CL.color.value >> 4;
	M.multiplayer_bottom = M.multiplayer_oldbottom = CL.color.value & 15;
};

M.MultiPlayer_Draw = function()
{
	M.DrawPic(16, 4, M.qplaque);
	M.DrawPic(160 - (M.p_multi.width >> 1), 4, M.p_multi);

	M.Print(64, 40, 'Join game at:');
	M.DrawTextBox(72, 48, 22, 1);
	M.Print(80, 56, M.multiplayer_joinname.substring(M.multiplayer_joinname.length - 21));

	M.Print(64, 72, 'Your name');
	M.DrawTextBox(160, 64, 16, 1);
	M.Print(168, 72, M.multiplayer_myname);

	M.Print(64, 96, 'Shirt color');
	M.Print(64, 120, 'Pants color');

	M.DrawTextBox(64, 148, 14, 1);
	M.Print(72, 156, 'Accept Changes');

	M.DrawPic(160, 80, M.bigbox);
	M.DrawPicTranslate(172, 88, M.menuplyr,
		(M.multiplayer_top << 4) + (M.multiplayer_top >= 8 ? 4 : 11),
		(M.multiplayer_bottom << 4) + (M.multiplayer_bottom >= 8 ? 4 : 11));

	M.DrawCharacter(56, M.multiplayer_cursor_table[M.multiplayer_cursor], 12 + ((Host.realtime * 4.0) & 1));

	if (M.multiplayer_cursor === 0)
		M.DrawCharacter(M.multiplayer_joinname.length <= 20 ? 80 + (M.multiplayer_joinname.length << 3) : 248, 56, 10 + ((Host.realtime * 4.0) & 1));
	else if (M.multiplayer_cursor === 1)
		M.DrawCharacter(168 + (M.multiplayer_myname.length << 3), 72, 10 + ((Host.realtime * 4.0) & 1));

	if (WEBS.available !== true)
		M.PrintWhite(52, 172, 'No Communications Available');
};

M.MultiPlayer_Key = function(k)
{
	if (k === Key.k.escape)
		M.Menu_Main_f();

	switch (k)
	{
	case Key.k.uparrow:
		S.LocalSound(M.sfx_menu1);
		if (--M.multiplayer_cursor < 0)
			M.multiplayer_cursor = M.multiplayer_items - 1;
		return;
	case Key.k.downarrow:
		S.LocalSound(M.sfx_menu1);
		if (++M.multiplayer_cursor >= M.multiplayer_items)
			M.multiplayer_cursor = 0;
		return;
	case Key.k.leftarrow:
		if (M.multiplayer_cursor === 2)
		{
			if (--M.multiplayer_top < 0)
				M.multiplayer_top = 13;
			S.LocalSound(M.sfx_menu3);
		}
		else if (M.multiplayer_cursor === 3)
		{
			if (--M.multiplayer_bottom < 0)
				M.multiplayer_bottom = 13;
			S.LocalSound(M.sfx_menu3);
		}
		return;
	case Key.k.rightarrow:
		if (M.multiplayer_cursor === 2)
			(M.multiplayer_top <= 12) ? ++M.multiplayer_top : M.multiplayer_top = 0;
		else if (M.multiplayer_cursor === 3)
			(M.multiplayer_bottom <= 12) ? ++M.multiplayer_bottom : M.multiplayer_bottom = 0;
		else
			return;
		S.LocalSound(M.sfx_menu3);
		return;
	case Key.k.enter:
		switch (M.multiplayer_cursor)
		{
		case 0:
			S.LocalSound(M.sfx_menu2);
			if (WEBS.available !== true)
				return;
			Key.dest.value = Key.dest.game;
			M.state.value = M.state.none;
			Cmd.text += 'connect "';
			if (M.multiplayer_joinname.substring(0, 5) !== 'ws://')
				Cmd.text += 'ws://';
			Cmd.text += M.multiplayer_joinname + '"\n';
			return;
		case 2:
			S.LocalSound(M.sfx_menu3);
			(M.multiplayer_top <= 12) ? ++M.multiplayer_top : M.multiplayer_top = 0;
			return;
		case 3:
			S.LocalSound(M.sfx_menu3);
			(M.multiplayer_bottom <= 12) ? ++M.multiplayer_bottom : M.multiplayer_bottom = 0;
			return;
		case 4:
			if (CL.name.string !== M.multiplayer_myname)
				Cmd.text += 'name "' + M.multiplayer_myname + '"\n';
			if ((M.multiplayer_top !== M.multiplayer_oldtop) || (M.multiplayer_bottom !== M.multiplayer_oldbottom))
			{
				M.multiplayer_oldtop = M.multiplayer_top;
				M.multiplayer_oldbottom = M.multiplayer_bottom;
				Cmd.text += 'color ' + M.multiplayer_top + ' ' + M.multiplayer_bottom + '\n';
			}
			M.entersound = true;
		}
		return;
	case Key.k.backspace:
		if (M.multiplayer_cursor === 0)
		{
			if (M.multiplayer_joinname.length !== 0)
				M.multiplayer_joinname = M.multiplayer_joinname.substring(0, M.multiplayer_joinname.length - 1);
			return;
		}
		if (M.multiplayer_cursor === 1)
		{
			if (M.multiplayer_myname.length !== 0)
				M.multiplayer_myname = M.multiplayer_myname.substring(0, M.multiplayer_myname.length - 1);
		}
		return;
	}

	if ((k < 32) || (k > 127))
		return;
	if (M.multiplayer_cursor === 0)
	{
		M.multiplayer_joinname += String.fromCharCode(k);
		return;
	}
	if (M.multiplayer_cursor === 1)
	{
		if (M.multiplayer_myname.length <= 14)
			M.multiplayer_myname += String.fromCharCode(k);
	}
};

// Options menu
M.options_cursor = 0;
M.options_items = 11;

M.Menu_Options_f = function()
{
	Key.dest.value = Key.dest.menu;
	M.state.value = M.state.options;
	M.entersound = true;
};

M.AdjustSliders = function(dir)
{
	S.LocalSound(M.sfx_menu3);
	
	switch (M.options_cursor)
	{
	case 3: // screen size
		SCR.viewsize.value += dir * 10;
		if (SCR.viewsize.value < 30)
			SCR.viewsize.value = 30;
		else if (SCR.viewsize.value > 120)
			SCR.viewsize.value = 120;
		Cvar.SetValue('viewsize', SCR.viewsize.value);
		return;
	case 4: // gamma
		V.gamma.value -= dir * 0.05;
		if (V.gamma.value < 0.5)
			V.gamma.value = 0.5;
		else if (V.gamma.value > 1.0)
			V.gamma.value = 1.0;
		Cvar.SetValue('gamma', V.gamma.value);
		return;
	case 5: // mouse speed
		CL.sensitivity.value += dir * 0.5;
		if (CL.sensitivity.value < 1.0)
			CL.sensitivity.value = 1.0;
		else if (CL.sensitivity.value > 11.0)
			CL.sensitivity.value = 11.0;
		Cvar.SetValue('sensitivity', CL.sensitivity.value);
		return;
	case 6: // music volume
		S.bgmvolume.value += dir * 0.1;
		if (S.bgmvolume.value < 0.0)
			S.bgmvolume.value = 0.0;
		else if (S.bgmvolume.value > 1.0)
			S.bgmvolume.value = 1.0;
		Cvar.SetValue('bgmvolume', S.bgmvolume.value);
		return;
	case 7: // sfx volume
		S.volume.value += dir * 0.1;
		if (S.volume.value < 0.0)
			S.volume.value = 0.0;
		else if (S.volume.value > 1.0)
			S.volume.value = 1.0;
		Cvar.SetValue('volume', S.volume.value);
		return;
	case 8: // allways run
		if (CL.forwardspeed.value > 200.0)
		{
			Cvar.SetValue('cl_forwardspeed', 200.0);
			Cvar.SetValue('cl_backspeed', 200.0);
			return;
		}
		Cvar.SetValue('cl_forwardspeed', 400.0);
		Cvar.SetValue('cl_backspeed', 400.0);
		return;
	case 9: // invert mouse
		Cvar.SetValue('m_pitch', -CL.m_pitch.value);
		return;
	case 10: // lookspring
		Cvar.SetValue('lookspring', (CL.lookspring.value !== 0) ? 0 : 1);
		return;
	case 11: // lookstrafe
		Cvar.SetValue('lookstrafe', (CL.lookstrafe.value !== 0) ? 0 : 1);
	}
};

M.DrawSlider = function(x, y, range)
{
	if (range < 0)
		range = 0;
	else if (range > 1)
		range = 1;
	M.DrawCharacter(x - 8, y, 128);
	M.DrawCharacter(x, y, 129);
	M.DrawCharacter(x + 8, y, 129);
	M.DrawCharacter(x + 16, y, 129);
	M.DrawCharacter(x + 24, y, 129);
	M.DrawCharacter(x + 32, y, 129);
	M.DrawCharacter(x + 40, y, 129);
	M.DrawCharacter(x + 48, y, 129);
	M.DrawCharacter(x + 56, y, 129);
	M.DrawCharacter(x + 64, y, 129);
	M.DrawCharacter(x + 72, y, 129);
	M.DrawCharacter(x + 80, y, 130);
	M.DrawCharacter(x + Math.floor(72 * range), y, 131);
};

M.Options_Draw = function()
{
	M.DrawPic(16, 4, M.qplaque);
	M.DrawPic(160 - (M.p_option.width >> 1), 4, M.p_option);
	
	M.Print(48, 32, 'Customize controls');
	M.Print(88, 40, 'Go to console');
	M.Print(56, 48, 'Reset to defaults');
	
	M.Print(104, 56, 'Screen size');
	M.DrawSlider(220, 56, (SCR.viewsize.value - 30) / 90);
	M.Print(112, 64, 'Brightness');
	M.DrawSlider(220, 64, (1.0 - V.gamma.value) * 2.0);
	M.Print(104, 72, 'Mouse Speed');
	M.DrawSlider(220, 72, (CL.sensitivity.value - 1) / 10);
	M.Print(72, 80, 'CD Music Volume');
	M.DrawSlider(220, 80, S.bgmvolume.value);
	M.Print(96, 88, 'Sound Volume');
	M.DrawSlider(220, 88, S.volume.value);
	M.Print(112, 96, 'Always Run');
	M.Print(220, 96, (CL.forwardspeed.value > 200.0) ? 'on' : 'off');
	M.Print(96, 104, 'Invert Mouse');
	M.Print(220, 104, (CL.m_pitch.value < 0.0) ? 'on' : 'off');
	M.Print(112, 112, 'Lookspring');
	M.Print(220, 112, (CL.lookspring.value !== 0) ? 'on' : 'off');
	M.Print(112, 120, 'Lookstrafe');
	M.Print(220, 120, (CL.lookstrafe.value !== 0) ? 'on' : 'off');
	
	M.DrawCharacter(200, 32 + (M.options_cursor << 3), 12 + ((Host.realtime * 4.0) & 1));
};

M.Options_Key = function(k)
{
	switch (k)
	{
	case Key.k.escape:
		M.Menu_Main_f();
		return;
	case Key.k.enter:
		M.entersound = true;
		switch (M.options_cursor)
		{
		case 0:
			M.Menu_Keys_f();
			return;
		case 1:
			M.state.value = M.state.none;
			Con.ToggleConsole_f();
			return;
		case 2:
			Cmd.text += 'exec default.cfg\n';
			return;
		default:
			M.AdjustSliders(1);
		}
		return;
	case Key.k.uparrow:
		S.LocalSound(M.sfx_menu1);
		if (--M.options_cursor < 0)
			M.options_cursor = M.options_items - 1;
		return;
	case Key.k.downarrow:
		S.LocalSound(M.sfx_menu1);
		if (++M.options_cursor >= M.options_items)
			M.options_cursor = 0;
		return;
	case Key.k.leftarrow:
		M.AdjustSliders(-1);
		return;
	case Key.k.rightarrow:
		M.AdjustSliders(1);
	}
};

// Keys menu
M.bindnames = [
	["+attack", "attack"],
	["impulse 10", "change weapon"],
	["+jump", "jump / swim up"],
	["+forward", "walk forward"],
	["+back", "backpedal"],
	["+left", "turn left"],
	["+right", "turn right"],
	["+speed", "run"],
	["+moveleft", "step left"],
	["+moveright", "step right"],
	["+strafe", "sidestep"],
	["+lookup", "look up"],
	["+lookdown", "look down"],
	["centerview", "center view"],
	["+mlook", "mouse look"],
	["+klook", "keyboard look"],
	["+moveup", "swim up"],
	["+movedown", "swim down"]
];

M.keys_cursor = 0;

M.Menu_Keys_f = function()
{
	Key.dest.value = Key.dest.menu;
	M.state.value = M.state.keys;
	M.entersound = true;
};

M.FindKeysForCommand = function(command)
{
	var twokeys = [], i;
	for (i = 0; i < Key.bindings.length; ++i)
	{
		if (Key.bindings[i] === command)
		{
			twokeys[twokeys.length] = i;
			if (twokeys.length === 2)
				return twokeys;
		}
	}
	return twokeys;
};

M.UnbindCommand = function(command)
{
	var i;
	for (i = 0; i < Key.bindings.length; ++i)
	{
		if (Key.bindings[i] === command)
			delete Key.bindings[i];
	}
};

M.Keys_Draw = function()
{
	M.DrawPic(160 - (M.ttl_cstm.width >> 1), 4, M.ttl_cstm);

	if (M.bind_grab === true)
	{
		M.Print(12, 32, 'Press a key or button for this action');
		M.DrawCharacter(130, 48 + (M.keys_cursor << 3), 61);
	}
	else
	{
		M.Print(18, 32, 'Enter to change, backspace to clear');
		M.DrawCharacter(130, 48 + (M.keys_cursor << 3), 12 + ((Host.realtime * 4.0) & 1));
	}

	var i, y = 48, keys, name;
	for (i = 0; i < M.bindnames.length; ++i)
	{
		M.Print(16, y, M.bindnames[i][1]);
		keys = M.FindKeysForCommand(M.bindnames[i][0]);
		if (keys[0] == null)
			M.Print(140, y, '???');
		else
		{
			name = Key.KeynumToString(keys[0]);
			if (keys[1] != null)
				name += ' or ' + Key.KeynumToString(keys[1]);
			M.Print(140, y, name);
		}
		y += 8;
	}
};

M.Keys_Key = function(k)
{
	if (M.bind_grab === true)
	{
		S.LocalSound(M.sfx_menu1);
		if ((k !== Key.k.escape) && (k !== 96))
			Cmd.text = 'bind "' + Key.KeynumToString(k) + '" "' + M.bindnames[M.keys_cursor][0] + '"\n' + Cmd.text;
		M.bind_grab = false;
		return;
	}

	switch (k)
	{
	case Key.k.escape:
		M.Menu_Options_f();
		return;
	case Key.k.leftarrow:
	case Key.k.uparrow:
		S.LocalSound(M.sfx_menu1);
		if (--M.keys_cursor < 0)
			M.keys_cursor = M.bindnames.length - 1;
		return;
	case Key.k.downarrow:
	case Key.k.rightarrow:
		S.LocalSound(M.sfx_menu1);
		if (++M.keys_cursor >= M.bindnames.length)
			M.keys_cursor = 0;
		return;
	case Key.k.enter:
		S.LocalSound(M.sfx_menu2);
		if (M.FindKeysForCommand(M.bindnames[M.keys_cursor][0])[1] != null)
			M.UnbindCommand(M.bindnames[M.keys_cursor][0]);
		M.bind_grab = true;
		return;
	case Key.k.backspace:
	case Key.k.del:
		S.LocalSound(M.sfx_menu2);
		M.UnbindCommand(M.bindnames[M.keys_cursor][0]);
	}
};

// Help menu
M.num_help_pages = 6;

M.Menu_Help_f = function()
{
	Key.dest.value = Key.dest.menu;
	M.state.value = M.state.help;
	M.entersound = true;
	M.help_page = 0;
};

M.Help_Draw = function()
{
	M.DrawPic(0, 0, M.help_pages[M.help_page]);
};

M.Help_Key = function(k)
{
	switch (k)
	{
	case Key.k.escape:
		M.Menu_Main_f();
		return;
	case Key.k.uparrow:
	case Key.k.rightarrow:
		M.entersound = true;
		if (++M.help_page >= M.num_help_pages)
			M.help_page = 0;
		return;
	case Key.k.downarrow:
	case Key.k.leftarrow:
		M.entersound = true;
		if (--M.help_page < 0)
			M.help_page = M.num_help_pages - 1;
	};
};

// Quit menu
M.quitMessage =
[
	['  Are you gonna quit', '  this game just like', '   everything else?', ''],
	[' Milord, methinks that', '   thou art a lowly', ' quitter. Is this true?', ''],
	[' Do I need to bust your', '  face open for trying', '        to quit?', ''],
	[' Man, I oughta smack you', '   for trying to quit!', '     Press Y to get', '      smacked out.'],
	[' Press Y to quit like a', '   big loser in life.', '  Press N to stay proud', '    and successful!'],
	['   If you press Y to', '  quit, I will summon', '  Satan all over your', '      hard drive!'],
	['  Um, Asmodeus dislikes', ' his children trying to', ' quit. Press Y to return', '   to your Tinkertoys.'],
	['  If you quit now, I\'ll', '  throw a blanket-party', '   for you next time!', '']
];

M.Menu_Quit_f = function()
{
	if (M.state.value === M.state.quit)
		return;
	M.wasInMenus = (Key.dest.value === Key.dest.menu);
	Key.dest.value = Key.dest.menu;
	M.quit_prevstate = M.state.value;
	M.state.value = M.state.quit;
	M.entersound = true;
	M.msgNumber = Math.floor(Math.random() * M.quitMessage.length);
};

M.Quit_Draw = function()
{
	if (M.wasInMenus === true)
	{
		M.state.value = M.quit_prevstate;
		M.recursiveDraw = true;
		M.Draw();
		M.state.value = M.state.quit;
	}
	M.DrawTextBox(56, 76, 24, 4);
	M.Print(64, 84, M.quitMessage[M.msgNumber][0]);
	M.Print(64, 92, M.quitMessage[M.msgNumber][1]);
	M.Print(64, 100, M.quitMessage[M.msgNumber][2]);
	M.Print(64, 108, M.quitMessage[M.msgNumber][3]);
};

M.Quit_Key = function(k)
{
	switch (k)
	{
	case Key.k.escape:
	case 110:
		if (M.wasInMenus === true)
		{
			M.state.value = M.quit_prevstate;
			M.entersound = true;
		}
		else
		{
			Key.dest.value = Key.dest.game;
			M.state.value = M.state.none;
		}
		break;
	case 121:
		Key.dest.value = Key.dest.console;
		Host.Quit_f();
	}
};


// Menu Subsystem
M.Init = function()
{
	Cmd.AddCommand('togglemenu', M.ToggleMenu_f);
	Cmd.AddCommand('menu_main', M.Menu_Main_f);
	Cmd.AddCommand('menu_singleplayer', M.Menu_SinglePlayer_f);
	Cmd.AddCommand('menu_load', M.Menu_Load_f);
	Cmd.AddCommand('menu_save', M.Menu_Save_f);
	Cmd.AddCommand('menu_multiplayer', M.Menu_MultiPlayer_f);
	Cmd.AddCommand('menu_setup', M.Menu_MultiPlayer_f);
	Cmd.AddCommand('menu_options', M.Menu_Options_f);
	Cmd.AddCommand('menu_keys', M.Menu_Keys_f);
	Cmd.AddCommand('help', M.Menu_Help_f);
	Cmd.AddCommand('menu_quit', M.Menu_Quit_f);

	M.sfx_menu1 = S.PrecacheSound('misc/menu1.wav');
	M.sfx_menu2 = S.PrecacheSound('misc/menu2.wav');
	M.sfx_menu3 = S.PrecacheSound('misc/menu3.wav');

	M.box_tl = Draw.CachePic('box_tl');
	M.box_ml = Draw.CachePic('box_ml');
	M.box_bl = Draw.CachePic('box_bl');
	M.box_tm = Draw.CachePic('box_tm');
	M.box_mm = Draw.CachePic('box_mm');
	M.box_mm2 = Draw.CachePic('box_mm2');
	M.box_bm = Draw.CachePic('box_bm');
	M.box_tr = Draw.CachePic('box_tr');
	M.box_mr = Draw.CachePic('box_mr');
	M.box_br = Draw.CachePic('box_br');

	M.qplaque = Draw.CachePic('qplaque');

	M.menudot = [
		Draw.CachePic('menudot1'),
		Draw.CachePic('menudot2'),
		Draw.CachePic('menudot3'),
		Draw.CachePic('menudot4'),
		Draw.CachePic('menudot5'),
		Draw.CachePic('menudot6')
	];

	M.ttl_main = Draw.CachePic('ttl_main');
	M.mainmenu = Draw.CachePic('mainmenu');

	M.ttl_sgl = Draw.CachePic('ttl_sgl');
	M.sp_menu = Draw.CachePic('sp_menu');
	M.p_load = Draw.CachePic('p_load');
	M.p_save = Draw.CachePic('p_save');

	M.p_multi = Draw.CachePic('p_multi');
	M.bigbox = Draw.CachePic('bigbox');
	M.menuplyr = Draw.CachePic('menuplyr');
	var buf = COM.LoadFile('gfx/menuplyr.lmp');
	var data = GL.ResampleTexture(M.menuplyr.data, M.menuplyr.width, M.menuplyr.height, 64, 64);
	var trans = new Uint8Array(new ArrayBuffer(16384));
	var i, p;
	for (i = 0; i < 4096; ++i)
	{
		p = data[i];
		if ((p >> 4) === 1)
		{
			trans[i << 2] = (p & 15) * 17;
			trans[(i << 2) + 1] = 255;
		}
		else if ((p >> 4) === 6)
		{
			trans[(i << 2) + 2] = (p & 15) * 17;
			trans[(i << 2) + 3] = 255;
		}
	}
	M.menuplyr.translate = gl.createTexture();
	GL.Bind(0, M.menuplyr.translate);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, trans);
	gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	M.p_option = Draw.CachePic('p_option');
	M.ttl_cstm = Draw.CachePic('ttl_cstm');

	M.help_pages = [
		Draw.CachePic('help0'),
		Draw.CachePic('help1'),
		Draw.CachePic('help2'),
		Draw.CachePic('help3'),
		Draw.CachePic('help4'),
		Draw.CachePic('help5')
	];
};

M.Draw = function()
{
	if ((M.state.value === M.state.none) || (Key.dest.value !== Key.dest.menu))
		return;

	if (M.recursiveDraw !== true)
	{
		if (SCR.con_current !== 0)
			Draw.ConsoleBackground(VID.height);
		else
			Draw.FadeScreen();
	}
	else
		M.recursiveDraw = false;
	
	switch (M.state.value)
	{
	case M.state.main:
		M.Main_Draw();
		break;
	case M.state.singleplayer:
		M.SinglePlayer_Draw();
		break;
	case M.state.load:
		M.Load_Draw();
		break;
	case M.state.save:
		M.Save_Draw();
		break;
	case M.state.multiplayer:
		M.MultiPlayer_Draw();
		break;
	case M.state.options:
		M.Options_Draw();
		break;
	case M.state.keys:
		M.Keys_Draw();
		break;
	case M.state.help:
		M.Help_Draw();
		break;
	case M.state.quit:
		M.Quit_Draw();
	}
	if (M.entersound === true)
	{
		S.LocalSound(M.sfx_menu2);
		M.entersound = false;
	}
};

M.Keydown = function(key)
{
	switch (M.state.value)
	{
	case M.state.main:
		M.Main_Key(key);
		return;
	case M.state.singleplayer:
		M.SinglePlayer_Key(key);
		return;
	case M.state.load:
		M.Load_Key(key);
		return;
	case M.state.save:
		M.Save_Key(key);
		return;
	case M.state.multiplayer:
		M.MultiPlayer_Key(key);
		return;
	case M.state.options:
		M.Options_Key(key);
		return;
	case M.state.keys:
		M.Keys_Key(key);
		return;
	case M.state.help:
		M.Help_Key(key);
		return;
	case M.state.quit:
		M.Quit_Key(key);
	}
};

// ---- WebQuake/Mod.js ----
Mod = {};

Mod.effects = {
	brightfield: 1,
	muzzleflash: 2,
	brightlight: 4,
	dimlight: 8
};

Mod.type = {brush: 0, sprite: 1, alias: 2};

Mod.flags = {
	rocket: 1,
	grenade: 2,
	gib: 4,
	rotate: 8,
	tracer: 16,
	zomgib: 32,
	tracer2: 64,
	tracer3: 128
};

Mod.version = {brush: 29, sprite: 1, alias: 6};

Mod.known = [];

Mod.Init = function()
{
	Mod.novis = [];
	var i;
	for (i = 0; i < 1024; ++i)
		Mod.novis[i] = 0xff;

	Mod.filledcolor = 0;
	for (i = 0; i <= 255; ++i)
	{
		if (VID.d_8to24table[i] === 0)
		{
			Mod.filledcolor = i;
			break;
		}
	}
};

Mod.PointInLeaf = function(p, model)
{
	if (model == null)
		Sys.Error('Mod.PointInLeaf: bad model');
	if (model.nodes == null)
		Sys.Error('Mod.PointInLeaf: bad model');
	var node = model.nodes[0];
	var normal;
	for (;;)
	{
		if (node.contents < 0)
			return node;
		normal = node.plane.normal;
		if ((p[0] * normal[0] + p[1] * normal[1] + p[2] * normal[2] - node.plane.dist) > 0)
			node = node.children[0];
		else
			node = node.children[1];
	}
};

Mod.DecompressVis = function(i, model)
{
	var decompressed = [], c, out, row = (model.leafs.length + 7) >> 3;
	if (model.visdata == null)
	{
		for (; row >= 0; --row)
			decompressed[out++] = 0xff;
		return decompressed;
	}
	for (out = 0; out < row; )
	{
		if (model.visdata[i] !== 0)
		{
			decompressed[out++] = model.visdata[i++];
			continue;
		}
		for (c = model.visdata[i + 1]; c > 0; --c)
			decompressed[out++] = 0;
		i += 2;
	}
	return decompressed;
};

Mod.LeafPVS = function(leaf, model)
{
	if (leaf === model.leafs[0])
		return Mod.novis;
	return Mod.DecompressVis(leaf.visofs, model);
};

Mod.ClearAll = function()
{
	var i, mod;
	for (i = 0; i < Mod.known.length; ++i)
	{
		mod = Mod.known[i];
		if (mod.type !== Mod.type.brush)
			continue;
		if (mod.cmds != null)
			gl.deleteBuffer(mod.cmds);
		Mod.known[i] = {
			name: mod.name,
			needload: true
		};
	}
};

Mod.FindName = function(name)
{
	if (name.length === 0)
		Sys.Error('Mod.FindName: NULL name');
	var i;
	for (i = 0; i < Mod.known.length; ++i)
	{
		if (Mod.known[i] == null)
			continue;
		if (Mod.known[i].name === name)
			return Mod.known[i];
	}
	for (i = 0; i <= Mod.known.length; ++i)
	{
		if (Mod.known[i] != null)
			continue;
		Mod.known[i] = {name: name, needload: true};
		return Mod.known[i];
	}
};

Mod.LoadModel = function(mod, crash)
{
	if (mod.needload !== true)
		return mod;
	var buf = COM.LoadFile(mod.name);
	if (buf == null)
	{
		if (crash === true)
			Sys.Error('Mod.LoadModel: ' + mod.name + ' not found');
		return;
	}
	Mod.loadmodel = mod;
	mod.needload = false;
	switch ((new DataView(buf)).getUint32(0, true))
	{
	case 0x4f504449:
		Mod.LoadAliasModel(buf);
		break;
	case 0x50534449:
		Mod.LoadSpriteModel(buf);
		break;
	default:
		Mod.LoadBrushModel(buf);
	}
	return mod;
};

Mod.ForName = function(name, crash)
{
	return Mod.LoadModel(Mod.FindName(name), crash);
};

/*
===============================================================================

					BRUSHMODEL LOADING

===============================================================================
*/

Mod.lump =
{
	entities: 0,
	planes: 1,
	textures: 2,
	vertexes: 3,
	visibility: 4,
	nodes: 5,
	texinfo: 6,
	faces: 7,
	lighting: 8,
	clipnodes: 9,
	leafs: 10,
	marksurfaces: 11,
	edges: 12,
	surfedges: 13,
	models: 14
};

Mod.contents = {
	empty: -1,
	solid: -2,
	water: -3,
	slime: -4,
	lava: -5,
	sky: -6,
	origin: -7,
	clip: -8,
	current_0: -9,
	current_90: -10,
	current_180: -11,
	current_270: -12,
	current_up: -13,
	current_down: -14
};

Mod.LoadTextures = function(buf)
{
	var view = new DataView(buf);
	var fileofs = view.getUint32((Mod.lump.textures << 3) + 4, true);
	var filelen = view.getUint32((Mod.lump.textures << 3) + 8, true);
	Mod.loadmodel.textures = [];
	var nummiptex = view.getUint32(fileofs, true);
	var dataofs = fileofs + 4;
	var i, miptexofs, tx, glt;
	for (i = 0; i < nummiptex; ++i)
	{
		miptexofs = view.getInt32(dataofs, true);
		dataofs += 4;
		if (miptexofs === -1)
		{
			Mod.loadmodel.textures[i] = R.notexture_mip;
			continue;
		}
		miptexofs += fileofs;
		tx =
		{
			name: Q.memstr(new Uint8Array(buf, miptexofs, 16)),
			width: view.getUint32(miptexofs + 16, true),
			height: view.getUint32(miptexofs + 20, true)
		}
		if (tx.name.substring(0, 3).toLowerCase() === 'sky')
		{
			R.InitSky(new Uint8Array(buf, miptexofs + view.getUint32(miptexofs + 24, true), 32768));
			tx.texturenum = R.solidskytexture;
			R.skytexturenum = i;
			tx.sky = true;
		}
		else
		{
			glt = GL.LoadTexture(tx.name, tx.width, tx.height, new Uint8Array(buf, miptexofs + view.getUint32(miptexofs + 24, true), tx.width * tx.height));
			tx.texturenum = glt.texnum;
			if (tx.name.charCodeAt(0) === 42)
				tx.turbulent = true;
		}
		Mod.loadmodel.textures[i] = tx;
	}

	var j, tx2, num, name;
	for (i = 0; i < nummiptex; ++i)
	{
		tx = Mod.loadmodel.textures[i];
		if (tx.name.charCodeAt(0) !== 43)
			continue;
		if (tx.name.charCodeAt(1) !== 48)
			continue;
		name = tx.name.substring(2);
		tx.anims = [i];
		tx.alternate_anims = [];
		for (j = 0; j < nummiptex; ++j)
		{
			tx2 = Mod.loadmodel.textures[j];
			if (tx2.name.charCodeAt(0) !== 43)
				continue;
			if (tx2.name.substring(2) !== name)
				continue;
			num = tx2.name.charCodeAt(1);
			if (num === 48)
				continue;
			if ((num >= 49) && (num <= 57))
			{
				tx.anims[num - 48] = j;
				tx2.anim_base = i;
				tx2.anim_frame = num - 48;
				continue;
			}
			if (num >= 97)
				num -= 32;
			if ((num >= 65) && (num <= 74))
			{
				tx.alternate_anims[num - 65] = j;
				tx2.anim_base = i;
				tx2.anim_frame = num - 65;
				continue;
			}
			Sys.Error('Bad animating texture ' + tx.name);
		}
		for (j = 0; j < tx.anims.length; ++j)
		{
			if (tx.anims[j] == null)
				Sys.Error('Missing frame ' + j + ' of ' + tx.name);
		}
		for (j = 0; j < tx.alternate_anims.length; ++j)
		{
			if (tx.alternate_anims[j] == null)
				Sys.Error('Missing frame ' + j + ' of ' + tx.name);
		}
		Mod.loadmodel.textures[i] = tx;
	}

	Mod.loadmodel.textures[Mod.loadmodel.textures.length] = R.notexture_mip;
};

Mod.LoadLighting = function(buf)
{
	var view = new DataView(buf);
	var fileofs = view.getUint32((Mod.lump.lighting << 3) + 4, true);
	var filelen = view.getUint32((Mod.lump.lighting << 3) + 8, true);
	if (filelen === 0)
		return;
	Mod.loadmodel.lightdata = new Uint8Array(new ArrayBuffer(filelen));
	Mod.loadmodel.lightdata.set(new Uint8Array(buf, fileofs, filelen));
};

Mod.LoadVisibility = function(buf)
{
	var view = new DataView(buf);
	var fileofs = view.getUint32((Mod.lump.visibility << 3) + 4, true);
	var filelen = view.getUint32((Mod.lump.visibility << 3) + 8, true);
	if (filelen === 0)
		return;
	Mod.loadmodel.visdata = new Uint8Array(new ArrayBuffer(filelen));
	Mod.loadmodel.visdata.set(new Uint8Array(buf, fileofs, filelen));
};

Mod.LoadEntities = function(buf)
{
	var view = new DataView(buf);
	var fileofs = view.getUint32((Mod.lump.entities << 3) + 4, true);
	var filelen = view.getUint32((Mod.lump.entities << 3) + 8, true);
	Mod.loadmodel.entities = Q.memstr(new Uint8Array(buf, fileofs, filelen));
};

Mod.LoadVertexes = function(buf)
{
	var view = new DataView(buf);
	var fileofs = view.getUint32((Mod.lump.vertexes << 3) + 4, true);
	var filelen = view.getUint32((Mod.lump.vertexes << 3) + 8, true);
	if ((filelen % 12) !== 0)
		Sys.Error('Mod.LoadVisibility: funny lump size in ' + Mod.loadmodel.name);
	var count = filelen / 12;
	Mod.loadmodel.vertexes = [];
	var i;
	for (i = 0; i < count; ++i)
	{
		Mod.loadmodel.vertexes[i] = [view.getFloat32(fileofs, true), view.getFloat32(fileofs + 4, true), view.getFloat32(fileofs + 8, true)];
		fileofs += 12;
	}
};

Mod.LoadSubmodels = function(buf)
{
	var view = new DataView(buf);
	var fileofs = view.getUint32((Mod.lump.models << 3) + 4, true);
	var filelen = view.getUint32((Mod.lump.models << 3) + 8, true);
	var count = filelen >> 6;
	if (count === 0)
		Sys.Error('Mod.LoadSubmodels: funny lump size in ' + Mod.loadmodel.name);
	Mod.loadmodel.submodels = [];

	Mod.loadmodel.mins = [view.getFloat32(fileofs, true) - 1.0,
		view.getFloat32(fileofs + 4, true) - 1.0,
		view.getFloat32(fileofs + 8, true) - 1.0];
	Mod.loadmodel.maxs = [view.getFloat32(fileofs + 12, true) + 1.0,
		view.getFloat32(fileofs + 16, true) + 1.0,
		view.getFloat32(fileofs + 20, true) + 1.0];
	Mod.loadmodel.hulls[0].firstclipnode = view.getUint32(fileofs + 36, true);
	Mod.loadmodel.hulls[1].firstclipnode = view.getUint32(fileofs + 40, true);
	Mod.loadmodel.hulls[2].firstclipnode = view.getUint32(fileofs + 44, true);
	fileofs += 64;

	var i, clipnodes = Mod.loadmodel.hulls[0].clipnodes, out;
	for (i = 1; i < count; ++i)
	{
		out = Mod.FindName('*' + i);
		out.needload = false;
		out.type = Mod.type.brush;
		out.submodel = true;
		out.mins = [view.getFloat32(fileofs, true) - 1.0,
			view.getFloat32(fileofs + 4, true) - 1.0,
			view.getFloat32(fileofs + 8, true) - 1.0];
		out.maxs = [view.getFloat32(fileofs + 12, true) + 1.0,
			view.getFloat32(fileofs + 16, true) + 1.0,
			view.getFloat32(fileofs + 20, true) + 1.0];
		out.origin = [view.getFloat32(fileofs + 24, true), view.getFloat32(fileofs + 28, true), view.getFloat32(fileofs + 32, true)];
		out.hulls = [
			{
				clipnodes: clipnodes,
				firstclipnode: view.getUint32(fileofs + 36, true),
				lastclipnode: Mod.loadmodel.nodes.length - 1,
				planes: Mod.loadmodel.planes,
				clip_mins: [0.0, 0.0, 0.0],
				clip_maxs: [0.0, 0.0, 0.0]
			},
			{
				clipnodes: Mod.loadmodel.clipnodes,
				firstclipnode: view.getUint32(fileofs + 40, true),
				lastclipnode: Mod.loadmodel.clipnodes.length - 1,
				planes: Mod.loadmodel.planes,
				clip_mins: [-16.0, -16.0, -24.0],
				clip_maxs: [16.0, 16.0, 32.0]
			},
			{
				clipnodes: Mod.loadmodel.clipnodes,
				firstclipnode: view.getUint32(fileofs + 44, true),
				lastclipnode: Mod.loadmodel.clipnodes.length - 1,
				planes: Mod.loadmodel.planes,
				clip_mins: [-32.0, -32.0, -24.0],
				clip_maxs: [32.0, 32.0, 64.0]
			}
		];
		out.textures = Mod.loadmodel.textures;
		out.lightdata = Mod.loadmodel.lightdata;
		out.faces = Mod.loadmodel.faces;
		out.firstface = view.getUint32(fileofs + 56, true);
		out.numfaces = view.getUint32(fileofs + 60, true);
		Mod.loadmodel.submodels[i - 1] = out;
		fileofs += 64;
	}
};

Mod.LoadEdges = function(buf)
{
	var view = new DataView(buf);
	var fileofs = view.getUint32((Mod.lump.edges << 3) + 4, true);
	var filelen = view.getUint32((Mod.lump.edges << 3) + 8, true);
	if ((filelen & 3) !== 0)
		Sys.Error('Mod.LoadEdges: funny lump size in ' + Mod.loadmodel.name);
	var count = filelen >> 2;
	Mod.loadmodel.edges = [];
	var i;
	for (i = 0; i < count; ++i)
	{
		Mod.loadmodel.edges[i] = [view.getUint16(fileofs, true), view.getUint16(fileofs + 2, true)];
		fileofs += 4;
	}
};

Mod.LoadTexinfo = function(buf)
{
	var view = new DataView(buf);
	var fileofs = view.getUint32((Mod.lump.texinfo << 3) + 4, true);
	var filelen = view.getUint32((Mod.lump.texinfo << 3) + 8, true);
	if ((filelen % 40) !== 0)
		Sys.Error('Mod.LoadTexinfo: funny lump size in ' + Mod.loadmodel.name);
	var count = filelen / 40;
	Mod.loadmodel.texinfo = [];
	var i, out;
	for (i = 0; i < count; ++i)
	{
		out = {
			vecs: [
				[view.getFloat32(fileofs, true), view.getFloat32(fileofs + 4, true), view.getFloat32(fileofs + 8, true), view.getFloat32(fileofs + 12, true)],
				[view.getFloat32(fileofs + 16, true), view.getFloat32(fileofs + 20, true), view.getFloat32(fileofs + 24, true), view.getFloat32(fileofs + 28, true)]
			],
			texture: view.getUint32(fileofs + 32, true),
			flags: view.getUint32(fileofs + 36, true)
		};
		if (out.texture >= Mod.loadmodel.textures.length)
		{
			out.texture = Mod.loadmodel.textures.length - 1;
			out.flags = 0;
		}
		Mod.loadmodel.texinfo[i] = out;
		fileofs += 40;
	}
};

Mod.LoadFaces = function(buf)
{
	var view = new DataView(buf);
	var fileofs = view.getUint32((Mod.lump.faces << 3) + 4, true);
	var filelen = view.getUint32((Mod.lump.faces << 3) + 8, true);
	if ((filelen % 20) !== 0)
		Sys.Error('Mod.LoadFaces: funny lump size in ' + Mod.loadmodel.name);
	var count = filelen / 20;
	Mod.loadmodel.firstface = 0;
	Mod.loadmodel.numfaces = count;
	Mod.loadmodel.faces = [];
	var i, styles, out;
	var mins, maxs, j, e, tex, v, val;
	for (i = 0; i < count; ++i)
	{
		styles = new Uint8Array(buf, fileofs + 12, 4);
		out =
		{
			plane: Mod.loadmodel.planes[view.getUint16(fileofs, true)],
			firstedge: view.getUint16(fileofs + 4, true),
			numedges: view.getUint16(fileofs + 8, true),
			texinfo: view.getUint16(fileofs + 10, true),
			styles: [],
			lightofs: view.getInt32(fileofs + 16, true)
		};
		if (styles[0] !== 255)
			out.styles[0] = styles[0];
		if (styles[1] !== 255)
			out.styles[1] = styles[1];
		if (styles[2] !== 255)
			out.styles[2] = styles[2];
		if (styles[3] !== 255)
			out.styles[3] = styles[3];

		mins = [999999, 999999];
		maxs = [-99999, -99999];
		tex = Mod.loadmodel.texinfo[out.texinfo];
		out.texture = tex.texture;
		for (j = 0; j < out.numedges; ++j)
		{
			e = Mod.loadmodel.surfedges[out.firstedge + j];
			if (e >= 0)
				v = Mod.loadmodel.vertexes[Mod.loadmodel.edges[e][0]];
			else
				v = Mod.loadmodel.vertexes[Mod.loadmodel.edges[-e][1]];
			val = Vec.DotProduct(v, tex.vecs[0]) + tex.vecs[0][3];
			if (val < mins[0])
				mins[0] = val;
			if (val > maxs[0])
				maxs[0] = val;
			val = Vec.DotProduct(v, tex.vecs[1]) + tex.vecs[1][3];
			if (val < mins[1])
				mins[1] = val;
			if (val > maxs[1])
				maxs[1] = val;
		}
		out.texturemins = [Math.floor(mins[0] / 16) * 16, Math.floor(mins[1] / 16) * 16];
		out.extents = [Math.ceil(maxs[0] / 16) * 16 - out.texturemins[0], Math.ceil(maxs[1] / 16) * 16 - out.texturemins[1]];

		if (Mod.loadmodel.textures[tex.texture].turbulent === true)
			out.turbulent = true;
		else if (Mod.loadmodel.textures[tex.texture].sky === true)
			out.sky = true;

		Mod.loadmodel.faces[i] = out;
		fileofs += 20;
	}
};

Mod.SetParent = function(node, parent)
{
	node.parent = parent;
	if (node.contents < 0)
		return;
	Mod.SetParent(node.children[0], node);
	Mod.SetParent(node.children[1], node);
};

Mod.LoadNodes = function(buf)
{
	var view = new DataView(buf);
	var fileofs = view.getUint32((Mod.lump.nodes << 3) + 4, true);
	var filelen = view.getUint32((Mod.lump.nodes << 3) + 8, true);
	if ((filelen === 0) || ((filelen % 24) !== 0))
		Sys.Error('Mod.LoadNodes: funny lump size in ' + Mod.loadmodel.name);
	var count = filelen / 24;
	Mod.loadmodel.nodes = [];
	var i, out;
	for (i = 0; i < count; ++i)
	{
		Mod.loadmodel.nodes[i] = {
			num: i,
			contents: 0,
			planenum: view.getUint32(fileofs, true),
			children: [view.getInt16(fileofs + 4, true), view.getInt16(fileofs + 6, true)],
			mins: [view.getInt16(fileofs + 8, true), view.getInt16(fileofs + 10, true), view.getInt16(fileofs + 12, true)],
			maxs: [view.getInt16(fileofs + 14, true), view.getInt16(fileofs + 16, true), view.getInt16(fileofs + 18, true)],
			firstface: view.getUint16(fileofs + 20, true),
			numfaces: view.getUint16(fileofs + 22, true),
			cmds: []
		};
		fileofs += 24;
	}
	for (i = 0; i < count; ++i)
	{
		out = Mod.loadmodel.nodes[i];
		out.plane = Mod.loadmodel.planes[out.planenum];
		if (out.children[0] >= 0)
			out.children[0] = Mod.loadmodel.nodes[out.children[0]];
		else
			out.children[0] = Mod.loadmodel.leafs[-1 - out.children[0]];
		if (out.children[1] >= 0)
			out.children[1] = Mod.loadmodel.nodes[out.children[1]];
		else
			out.children[1] = Mod.loadmodel.leafs[-1 - out.children[1]];
	}
	Mod.SetParent(Mod.loadmodel.nodes[0]);
};

Mod.LoadLeafs = function(buf)
{
	var view = new DataView(buf);
	var fileofs = view.getUint32((Mod.lump.leafs << 3) + 4, true);
	var filelen = view.getUint32((Mod.lump.leafs << 3) + 8, true);
	if ((filelen % 28) !== 0)
		Sys.Error('Mod.LoadLeafs: funny lump size in ' + Mod.loadmodel.name);
	var count = filelen / 28;
	Mod.loadmodel.leafs = [];
	var i, j, out;
	for (i = 0; i < count; ++i)
	{
		out = {
			num: i,
			contents: view.getInt32(fileofs, true),
			visofs: view.getInt32(fileofs + 4, true),
			mins: [view.getInt16(fileofs + 8, true), view.getInt16(fileofs + 10, true), view.getInt16(fileofs + 12, true)],
			maxs: [view.getInt16(fileofs + 14, true), view.getInt16(fileofs + 16, true), view.getInt16(fileofs + 18, true)],
			firstmarksurface: view.getUint16(fileofs + 20, true),
			nummarksurfaces: view.getUint16(fileofs + 22, true),
			ambient_level: [view.getUint8(fileofs + 24), view.getUint8(fileofs + 25), view.getUint8(fileofs + 26), view.getUint8(fileofs + 27)],
			cmds: [],
			skychain: 0,
			waterchain: 0
		};
		Mod.loadmodel.leafs[i] = out;
		fileofs += 28;
	};
};

Mod.LoadClipnodes = function(buf)
{
	var view = new DataView(buf);
	var fileofs = view.getUint32((Mod.lump.clipnodes << 3) + 4, true);
	var filelen = view.getUint32((Mod.lump.clipnodes << 3) + 8, true);
	var count = filelen >> 3;
	Mod.loadmodel.clipnodes = [];

	Mod.loadmodel.hulls = [];
	Mod.loadmodel.hulls[1] = {
		clipnodes: Mod.loadmodel.clipnodes,
		firstclipnode: 0,
		lastclipnode: count - 1,
		planes: Mod.loadmodel.planes,
		clip_mins: [-16.0, -16.0, -24.0],
		clip_maxs: [16.0, 16.0, 32.0]
	};
	Mod.loadmodel.hulls[2] = {
		clipnodes: Mod.loadmodel.clipnodes,
		firstclipnode: 0,
		lastclipnode: count - 1,
		planes: Mod.loadmodel.planes,
		clip_mins: [-32.0, -32.0, -24.0],
		clip_maxs: [32.0, 32.0, 64.0]
	};
	var i;
	for (i = 0; i < count; ++i)
	{
		Mod.loadmodel.clipnodes[i] = {
			planenum: view.getUint32(fileofs, true),
			children: [view.getInt16(fileofs + 4, true), view.getInt16(fileofs + 6, true)]
		};
		fileofs += 8;
	}
};

Mod.MakeHull0 = function()
{
	var node, child, clipnodes = [], i, out;
	var hull = {
		clipnodes: clipnodes,
		lastclipnode: Mod.loadmodel.nodes.length - 1,
		planes: Mod.loadmodel.planes,
		clip_mins: [0.0, 0.0, 0.0],
		clip_maxs: [0.0, 0.0, 0.0]
	};
	for (i = 0; i < Mod.loadmodel.nodes.length; ++i)
	{
		node = Mod.loadmodel.nodes[i];
		out = {planenum: node.planenum, children: []};
		child = node.children[0];
		out.children[0] = child.contents < 0 ? child.contents : child.num;
		child = node.children[1];
		out.children[1] = child.contents < 0 ? child.contents : child.num;
		clipnodes[i] = out;
	}
	Mod.loadmodel.hulls[0] = hull;
};

Mod.LoadMarksurfaces = function(buf)
{
	var view = new DataView(buf);
	var fileofs = view.getUint32((Mod.lump.marksurfaces << 3) + 4, true);
	var filelen = view.getUint32((Mod.lump.marksurfaces << 3) + 8, true);
	var count = filelen >> 1;
	Mod.loadmodel.marksurfaces = [];
	var i, j;
	for (i = 0; i < count; ++i)
	{
		j = view.getUint16(fileofs + (i << 1), true);
		if (j > Mod.loadmodel.faces.length)
			Sys.Error('Mod.LoadMarksurfaces: bad surface number');
		Mod.loadmodel.marksurfaces[i] = j;
	}
};

Mod.LoadSurfedges = function(buf)
{
	var view = new DataView(buf);
	var fileofs = view.getUint32((Mod.lump.surfedges << 3) + 4, true);
	var filelen = view.getUint32((Mod.lump.surfedges << 3) + 8, true);
	var count = filelen >> 2;
	Mod.loadmodel.surfedges = [];
	var i;
	for (i = 0; i < count; ++i)
		Mod.loadmodel.surfedges[i] = view.getInt32(fileofs + (i << 2), true);
}

Mod.LoadPlanes = function(buf)
{
	var view = new DataView(buf);
	var fileofs = view.getUint32((Mod.lump.planes << 3) + 4, true);
	var filelen = view.getUint32((Mod.lump.planes << 3) + 8, true);
	if ((filelen % 20) !== 0)
		Sys.Error('Mod.LoadPlanes: funny lump size in ' + Mod.loadmodel.name);
	var count = filelen / 20;
	Mod.loadmodel.planes = [];
	var i, out;
	for (i = 0; i < count; ++i)
	{
		out = {
			normal: [view.getFloat32(fileofs, true), view.getFloat32(fileofs + 4, true), view.getFloat32(fileofs + 8, true)],
			dist: view.getFloat32(fileofs + 12, true),
			type: view.getUint32(fileofs + 16, true),
			signbits: 0
		};
		if (out.normal[0] < 0)
			++out.signbits;
		if (out.normal[1] < 0)
			out.signbits += 2;
		if (out.normal[2] < 0)
			out.signbits += 4;
		Mod.loadmodel.planes[i] = out;
		fileofs += 20;
	}
};

Mod.LoadBrushModel = function(buffer)
{
	Mod.loadmodel.type = Mod.type.brush;
	var version = (new DataView(buffer)).getUint32(0, true);
	if (version !== Mod.version.brush)
		Sys.Error('Mod.LoadBrushModel: ' + Mod.loadmodel.name + ' has wrong version number (' + version + ' should be ' + Mod.version.brush + ')');
	Mod.LoadVertexes(buffer);
	Mod.LoadEdges(buffer);
	Mod.LoadSurfedges(buffer);
	Mod.LoadTextures(buffer);
	Mod.LoadLighting(buffer);
	Mod.LoadPlanes(buffer);
	Mod.LoadTexinfo(buffer);
	Mod.LoadFaces(buffer);
	Mod.LoadMarksurfaces(buffer);
	Mod.LoadVisibility(buffer);
	Mod.LoadLeafs(buffer);
	Mod.LoadNodes(buffer);
	Mod.LoadClipnodes(buffer);
	Mod.MakeHull0();
	Mod.LoadEntities(buffer);
	Mod.LoadSubmodels(buffer);

	var i, vert, mins = [0.0, 0.0, 0.0], maxs = [0.0, 0.0, 0.0];
	for (i = 0; i < Mod.loadmodel.vertexes.length; ++i)
	{
		vert = Mod.loadmodel.vertexes[i];
		if (vert[0] < mins[0])
			mins[0] = vert[0];
		else if (vert[0] > maxs[0])
			maxs[0] = vert[0];

		if (vert[1] < mins[1])
			mins[1] = vert[1];
		else if (vert[1] > maxs[1])
			maxs[1] = vert[1];

		if (vert[2] < mins[2])
			mins[2] = vert[2];
		else if (vert[2] > maxs[2])
			maxs[2] = vert[2];
	};
	Mod.loadmodel.radius = Vec.Length([
		Math.abs(mins[0]) > Math.abs(maxs[0]) ? Math.abs(mins[0]) : Math.abs(maxs[0]),
		Math.abs(mins[1]) > Math.abs(maxs[1]) ? Math.abs(mins[1]) : Math.abs(maxs[1]),
		Math.abs(mins[2]) > Math.abs(maxs[2]) ? Math.abs(mins[2]) : Math.abs(maxs[2])
	]);
};

/*
==============================================================================

ALIAS MODELS

==============================================================================
*/

Mod.TranslatePlayerSkin = function(data, skin)
{
	if ((Mod.loadmodel.skinwidth !== 512) || (Mod.loadmodel.skinheight !== 256))
		data = GL.ResampleTexture(data, Mod.loadmodel.skinwidth, Mod.loadmodel.skinheight, 512, 256);
	var out = new Uint8Array(new ArrayBuffer(524288));
	var i, original;
	for (i = 0; i < 131072; ++i)
	{
		original = data[i];
		if ((original >> 4) === 1)
		{
			out[i << 2] = (original & 15) * 17;
			out[(i << 2) + 1] = 255;
		}
		else if ((original >> 4) === 6)
		{
			out[(i << 2) + 2] = (original & 15) * 17;
			out[(i << 2) + 3] = 255;
		}
	}
	skin.playertexture = gl.createTexture();
	GL.Bind(0, skin.playertexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, out);
	gl.generateMipmap(gl.TEXTURE_2D);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, GL.filter_min);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, GL.filter_max);
};

Mod.FloodFillSkin = function(skin)
{
	var fillcolor = skin[0];
	if (fillcolor === Mod.filledcolor)
		return;

	var width = Mod.loadmodel.skinwidth;
	var height = Mod.loadmodel.skinheight;

	var lifo = [[0, 0]], sp, cur, x, y;

	for (sp = 1; sp > 0; )
	{
		cur = lifo[--sp];
		x = cur[0];
		y = cur[1];
		skin[y * width + x] = Mod.filledcolor;
		if (x > 0)
		{
			if (skin[y * width + x - 1] === fillcolor)
				lifo[sp++] = [x - 1, y];
		}
		if (x < (width - 1))
		{
			if (skin[y * width + x + 1] === fillcolor)
				lifo[sp++] = [x + 1, y];
		}
		if (y > 0)
		{
			if (skin[(y - 1) * width + x] === fillcolor)
				lifo[sp++] = [x, y - 1];
		}
		if (y < (height - 1))
		{
			if (skin[(y + 1) * width + x] === fillcolor)
				lifo[sp++] = [x, y + 1];
		}
	}
};

Mod.LoadAllSkins = function(buffer, inmodel)
{
	Mod.loadmodel.skins = [];
	var model = new DataView(buffer);
	var i, j, group, numskins;
	var skinsize = Mod.loadmodel.skinwidth * Mod.loadmodel.skinheight;
	var skin;
	for (i = 0; i < Mod.loadmodel.numskins; ++i)
	{
		inmodel += 4;
		if (model.getUint32(inmodel - 4, true) === 0)
		{
			skin = new Uint8Array(buffer, inmodel, skinsize);
			Mod.FloodFillSkin(skin);
			Mod.loadmodel.skins[i] = {
				group: false,
				texturenum: GL.LoadTexture(Mod.loadmodel.name + '_' + i,
					Mod.loadmodel.skinwidth,
					Mod.loadmodel.skinheight,
					skin)
			};
			if (Mod.loadmodel.player === true)
				Mod.TranslatePlayerSkin(new Uint8Array(buffer, inmodel, skinsize), Mod.loadmodel.skins[i]);
			inmodel += skinsize;
		}
		else
		{
			group = {
				group: true,
				skins: []
			};
			numskins = model.getUint32(inmodel, true);
			inmodel += 4;
			for (j = 0; j < numskins; ++j)
			{
				group.skins[j] = {interval: model.getFloat32(inmodel, true)};
				if (group.skins[j].interval <= 0.0)
					Sys.Error('Mod.LoadAllSkins: interval<=0');
				inmodel += 4;
			}
			for (j = 0; j < numskins; ++j)
			{
				skin = new Uint8Array(buffer, inmodel, skinsize);
				Mod.FloodFillSkin(skin);
				group.skins[j].texturenum = GL.LoadTexture(Mod.loadmodel.name + '_' + i + '_' + j,
					Mod.loadmodel.skinwidth,
					Mod.loadmodel.skinheight,
					skin);
				if (Mod.loadmodel.player === true)
					Mod.TranslatePlayerSkin(new Uint8Array(buffer, inmodel, skinsize), group.skins[j]);
				inmodel += skinsize;
			}
			Mod.loadmodel.skins[i] = group;
		}
	}
	return inmodel;
};

Mod.LoadAllFrames = function(buffer, inmodel)
{
	Mod.loadmodel.frames = [];
	var model = new DataView(buffer);
	var i, j, k, frame, group, numframes;
	for (i = 0; i < Mod.loadmodel.numframes; ++i)
	{
		inmodel += 4;
		if (model.getUint32(inmodel - 4, true) === 0)
		{
			frame = {
				group: false,
				bboxmin: [model.getUint8(inmodel), model.getUint8(inmodel + 1), model.getUint8(inmodel + 2)],
				bboxmax: [model.getUint8(inmodel + 4), model.getUint8(inmodel + 5), model.getUint8(inmodel + 6)],
				name: Q.memstr(new Uint8Array(buffer, inmodel + 8, 16)),
				v: []
			};
			inmodel += 24;
			for (j = 0; j < Mod.loadmodel.numverts; ++j)
			{
				frame.v[j] = {
					v: [model.getUint8(inmodel), model.getUint8(inmodel + 1), model.getUint8(inmodel + 2)],
					lightnormalindex: model.getUint8(inmodel + 3)
				};
				inmodel += 4;
			}
			Mod.loadmodel.frames[i] = frame;
		}
		else
		{
			group = {
				group: true,
				bboxmin: [model.getUint8(inmodel + 4), model.getUint8(inmodel + 5), model.getUint8(inmodel + 6)],
				bboxmax: [model.getUint8(inmodel + 8), model.getUint8(inmodel + 9), model.getUint8(inmodel + 10)],
				frames: []
			};
			numframes = model.getUint32(inmodel, true);
			inmodel += 12;
			for (j = 0; j < numframes; ++j)
			{
				group.frames[j] = {interval: model.getFloat32(inmodel, true)};
				if (group.frames[j].interval <= 0.0)
					Sys.Error('Mod.LoadAllFrames: interval<=0');
				inmodel += 4;
			}
			for (j = 0; j < numframes; ++j)
			{
				frame = group.frames[j];
				frame.bboxmin = [model.getUint8(inmodel), model.getUint8(inmodel + 1), model.getUint8(inmodel + 2)];
				frame.bboxmax = [model.getUint8(inmodel + 4), model.getUint8(inmodel + 5), model.getUint8(inmodel + 6)];
				frame.name = Q.memstr(new Uint8Array(buffer, inmodel + 8, 16));
				frame.v = [];
				inmodel += 24;
				for (k = 0; k < Mod.loadmodel.numverts; ++k)
				{
					frame.v[k] = {
						v: [model.getUint8(inmodel), model.getUint8(inmodel + 1), model.getUint8(inmodel + 2)],
						lightnormalindex: model.getUint8(inmodel + 3)
					};
					inmodel += 4;
				}
			}
			Mod.loadmodel.frames[i] = group;
		}
	}
};

Mod.LoadAliasModel = function(buffer)
{
	var i, j, k, l;

	Mod.loadmodel.type = Mod.type.alias;
	Mod.loadmodel.player = Mod.loadmodel.name === 'progs/player.mdl';
	var model = new DataView(buffer);
	var version = model.getUint32(4, true);
	if (version !== Mod.version.alias)
		Sys.Error(Mod.loadmodel.name + ' has wrong version number (' + version + ' should be ' + Mod.version.alias + ')');
	Mod.loadmodel.scale = [model.getFloat32(8, true), model.getFloat32(12, true), model.getFloat32(16, true)];
	Mod.loadmodel.scale_origin = [model.getFloat32(20, true), model.getFloat32(24, true), model.getFloat32(28, true)];
	Mod.loadmodel.boundingradius = model.getFloat32(32, true);
	Mod.loadmodel.numskins = model.getUint32(48, true);
	if (Mod.loadmodel.numskins === 0)
		Sys.Error('model ' + Mod.loadmodel.name + ' has no skins');
	Mod.loadmodel.skinwidth = model.getUint32(52, true);
	Mod.loadmodel.skinheight = model.getUint32(56, true);
	Mod.loadmodel.numverts = model.getUint32(60, true);
	if (Mod.loadmodel.numverts === 0)
		Sys.Error('model ' + Mod.loadmodel.name + ' has no vertices');
	Mod.loadmodel.numtris = model.getUint32(64, true);
	if (Mod.loadmodel.numtris === 0)
		Sys.Error('model ' + Mod.loadmodel.name + ' has no triangles');
	Mod.loadmodel.numframes = model.getUint32(68, true);
	if (Mod.loadmodel.numframes === 0)
		Sys.Error('model ' + Mod.loadmodel.name + ' has no frames');
	Mod.loadmodel.random = model.getUint32(72, true) === 1;
	Mod.loadmodel.flags = model.getUint32(76, true);
	Mod.loadmodel.mins = [-16.0, -16.0, -16.0];
	Mod.loadmodel.maxs = [16.0, 16.0, 16.0];

	var inmodel = Mod.LoadAllSkins(buffer, 84);

	Mod.loadmodel.stverts = [];
	for (i = 0; i < Mod.loadmodel.numverts; ++i)
	{
		Mod.loadmodel.stverts[i] = {
			onseam: model.getUint32(inmodel, true) !== 0,
			s: model.getUint32(inmodel + 4, true),
			t: model.getUint32(inmodel + 8, true)
		};
		inmodel += 12;
	}

	Mod.loadmodel.triangles = [];
	for (i = 0; i < Mod.loadmodel.numtris; ++i)
	{
		Mod.loadmodel.triangles[i] = {
			facesfront: model.getUint32(inmodel, true) !== 0,
			vertindex: [
				model.getUint32(inmodel + 4, true),
				model.getUint32(inmodel + 8, true),
				model.getUint32(inmodel + 12, true)
			]
		};
		inmodel += 16;
	}

	Mod.LoadAllFrames(buffer, inmodel);

	var cmds = [];

	var triangle, vert, s;
	for (i = 0; i < Mod.loadmodel.numtris; ++i)
	{
		triangle = Mod.loadmodel.triangles[i];
		if (triangle.facesfront === true)
		{
			vert = Mod.loadmodel.stverts[triangle.vertindex[0]];
			cmds[cmds.length] = (vert.s + 0.5) / Mod.loadmodel.skinwidth;
			cmds[cmds.length] = (vert.t + 0.5) / Mod.loadmodel.skinheight;
			vert = Mod.loadmodel.stverts[triangle.vertindex[1]];
			cmds[cmds.length] = (vert.s + 0.5) / Mod.loadmodel.skinwidth;
			cmds[cmds.length] = (vert.t + 0.5) / Mod.loadmodel.skinheight;
			vert = Mod.loadmodel.stverts[triangle.vertindex[2]];
			cmds[cmds.length] = (vert.s + 0.5) / Mod.loadmodel.skinwidth;
			cmds[cmds.length] = (vert.t + 0.5) / Mod.loadmodel.skinheight;
			continue;
		}
		for (j = 0; j < 3; ++j)
		{
			vert = Mod.loadmodel.stverts[triangle.vertindex[j]];
			if (vert.onseam === true)
				cmds[cmds.length] = (vert.s + Mod.loadmodel.skinwidth / 2 + 0.5) / Mod.loadmodel.skinwidth;
			else
				cmds[cmds.length] = (vert.s + 0.5) / Mod.loadmodel.skinwidth;
			cmds[cmds.length] = (vert.t + 0.5) / Mod.loadmodel.skinheight;
		}
	}

	var group, frame;
	for (i = 0; i < Mod.loadmodel.numframes; ++i)
	{
		group = Mod.loadmodel.frames[i];
		if (group.group === true)
		{
			for (j = 0; j < group.frames.length; ++j)
			{
				frame = group.frames[j];
				frame.cmdofs = cmds.length << 2;
				for (k = 0; k < Mod.loadmodel.numtris; ++k)
				{
					triangle = Mod.loadmodel.triangles[k];
					for (l = 0; l < 3; ++l)
					{
						vert = frame.v[triangle.vertindex[l]];
						if (vert.lightnormalindex >= 162)
							Sys.Error('lightnormalindex >= NUMVERTEXNORMALS');
						cmds[cmds.length] = vert.v[0] * Mod.loadmodel.scale[0] + Mod.loadmodel.scale_origin[0];
						cmds[cmds.length] = vert.v[1] * Mod.loadmodel.scale[1] + Mod.loadmodel.scale_origin[1];
						cmds[cmds.length] = vert.v[2] * Mod.loadmodel.scale[2] + Mod.loadmodel.scale_origin[2];
						cmds[cmds.length] = R.avertexnormals[vert.lightnormalindex][0];
						cmds[cmds.length] = R.avertexnormals[vert.lightnormalindex][1];
						cmds[cmds.length] = R.avertexnormals[vert.lightnormalindex][2];
					}
				}
			}
			continue;
		}
		frame = group;
		frame.cmdofs = cmds.length << 2;
		for (j = 0; j < Mod.loadmodel.numtris; ++j)
		{
			triangle = Mod.loadmodel.triangles[j];
			for (k = 0; k < 3; ++k)
			{
				vert = frame.v[triangle.vertindex[k]];
				if (vert.lightnormalindex >= 162)
					Sys.Error('lightnormalindex >= NUMVERTEXNORMALS');
				cmds[cmds.length] = vert.v[0] * Mod.loadmodel.scale[0] + Mod.loadmodel.scale_origin[0];
				cmds[cmds.length] = vert.v[1] * Mod.loadmodel.scale[1] + Mod.loadmodel.scale_origin[1];
				cmds[cmds.length] = vert.v[2] * Mod.loadmodel.scale[2] + Mod.loadmodel.scale_origin[2];
				cmds[cmds.length] = R.avertexnormals[vert.lightnormalindex][0];
				cmds[cmds.length] = R.avertexnormals[vert.lightnormalindex][1];
				cmds[cmds.length] = R.avertexnormals[vert.lightnormalindex][2];
			}
		}
	}

	Mod.loadmodel.cmds = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, Mod.loadmodel.cmds);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cmds), gl.STATIC_DRAW);
};

Mod.LoadSpriteFrame = function(identifier, buffer, inframe, frame)
{
	var i;

	var model = new DataView(buffer);
	frame.origin = [model.getInt32(inframe, true), -model.getInt32(inframe + 4, true)];
	frame.width = model.getUint32(inframe + 8, true);
	frame.height = model.getUint32(inframe + 12, true);
	var size = frame.width * frame.height;

	var glt;
	for (i = 0; i < GL.textures.length; ++i)
	{
		glt = GL.textures[i];
		if (glt.identifier === identifier)
		{
			if ((width !== glt.width) || (height !== glt.height))
				Sys.Error('Mod.LoadSpriteFrame: cache mismatch');
			frame.texturenum = glt.texnum;
			return inframe + 16 + frame.width * frame.height;
		}
	}

	var data = new Uint8Array(buffer, inframe + 16, size);
	var scaled_width = frame.width, scaled_height = frame.height;
	if (((frame.width & (frame.width - 1)) !== 0) || ((frame.height & (frame.height - 1)) !== 0))
	{
		--scaled_width;
		scaled_width |= (scaled_width >> 1);
		scaled_width |= (scaled_width >> 2);
		scaled_width |= (scaled_width >> 4);
		scaled_width |= (scaled_width >> 8);
		scaled_width |= (scaled_width >> 16);
		++scaled_width;
		--scaled_height;
		scaled_height |= (scaled_height >> 1);
		scaled_height |= (scaled_height >> 2);
		scaled_height |= (scaled_height >> 4);
		scaled_height |= (scaled_height >> 8);
		scaled_height |= (scaled_height >> 16);
		++scaled_height;
	}
	if (scaled_width > GL.maxtexturesize)
		scaled_width = GL.maxtexturesize;
	if (scaled_height > GL.maxtexturesize)
		scaled_height = GL.maxtexturesize;
	if ((scaled_width !== frame.width) || (scaled_height !== frame.height))
	{
		size = scaled_width * scaled_height;
		data = GL.ResampleTexture(data, frame.width, frame.height, scaled_width, scaled_height);
	}

	var trans = new ArrayBuffer(size << 2);
	var trans32 = new Uint32Array(trans);
	for (i = 0; i < size; ++i)
	{
		if (data[i] !== 255)
			trans32[i] = COM.LittleLong(VID.d_8to24table[data[i]] + 0xff000000);
	}

	glt = {texnum: gl.createTexture(), identifier: identifier, width: frame.width, height: frame.height};
	GL.Bind(0, glt.texnum);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, scaled_width, scaled_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(trans));
	gl.generateMipmap(gl.TEXTURE_2D);
	gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, GL.filter_min);
	gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, GL.filter_max);
	GL.textures[GL.textures.length] = glt;
	frame.texturenum = glt.texnum;
	return inframe + 16 + frame.width * frame.height;
}

Mod.LoadSpriteModel = function(buffer)
{
	Mod.loadmodel.type = Mod.type.sprite;
	var model = new DataView(buffer);
	var version = model.getUint32(4, true);
	if (version !== Mod.version.sprite)
		Sys.Error(Mod.loadmodel.name + ' has wrong version number (' + version + ' should be ' + Mod.version.sprite + ')');
	Mod.loadmodel.oriented = model.getUint32(8, true) === 3;
	Mod.loadmodel.boundingradius = model.getFloat32(12, true);
	Mod.loadmodel.width = model.getUint32(16, true);
	Mod.loadmodel.height = model.getUint32(20, true);
	Mod.loadmodel.numframes = model.getUint32(24, true);
	if (Mod.loadmodel.numframes === 0)
		Sys.Error('model ' + Mod.loadmodel.name + ' has no frames');
	Mod.loadmodel.random = model.getUint32(32, true) === 1;
	Mod.loadmodel.mins = [Mod.loadmodel.width * -0.5, Mod.loadmodel.width * -0.5, Mod.loadmodel.height * -0.5];
	Mod.loadmodel.maxs = [Mod.loadmodel.width * 0.5, Mod.loadmodel.width * 0.5, Mod.loadmodel.height * 0.5];

	Mod.loadmodel.frames = [];
	var inframe = 36, i, j, frame, group, numframes;
	for (i = 0; i < Mod.loadmodel.numframes; ++i)
	{
		inframe += 4;
		if (model.getUint32(inframe - 4, true) === 0)
		{
			frame = {group: false};
			Mod.loadmodel.frames[i] = frame;
			inframe = Mod.LoadSpriteFrame(Mod.loadmodel.name + '_' + i + '_' + j, buffer, inframe, frame);
		}
		else
		{
			group = {
				group: true,
				frames: []
			};
			Mod.loadmodel.frames[i] = group;
			numframes = model.getUint32(inframe, true);
			inframe += 4;
			for (j = 0; j < numframes; ++j)
			{
				group.frames[j] = {interval: model.getFloat32(inframe, true)};
				if (group.frames[j].interval <= 0.0)
					Sys.Error('Mod.LoadSpriteModel: interval<=0');
				inframe += 4;
			}
			for (j = 0; j < numframes; ++j)
				inframe = Mod.LoadSpriteFrame(Mod.loadmodel.name + '_' + i + '_' + j, buffer, inframe, group.frames[j]);
		}
	}
};

Mod.Print = function()
{
	Con.Print('Cached models:\n');
	var i;
	for (i = 0; i < Mod.known.length; ++i)
		Con.Print(Mod.known[i].name + '\n');
};

// ---- WebQuake/MSG.js ----
MSG = {};

MSG.WriteChar = function(sb, c)
{
	(new DataView(sb.data)).setInt8(SZ.GetSpace(sb, 1), c);
};

MSG.WriteByte = function(sb, c)
{
	(new DataView(sb.data)).setUint8(SZ.GetSpace(sb, 1), c);
};

MSG.WriteShort = function(sb, c)
{
	(new DataView(sb.data)).setInt16(SZ.GetSpace(sb, 2), c, true);
};

MSG.WriteLong = function(sb, c)
{
	(new DataView(sb.data)).setInt32(SZ.GetSpace(sb, 4), c, true);
};

MSG.WriteFloat = function(sb, f)
{
	(new DataView(sb.data)).setFloat32(SZ.GetSpace(sb, 4), f, true);
};

MSG.WriteString = function(sb, s)
{
	if (s != null)
		SZ.Write(sb, new Uint8Array(Q.strmem(s)), s.length);
	MSG.WriteChar(sb, 0)
};

MSG.WriteCoord = function(sb, f)
{
	MSG.WriteShort(sb, f * 8.0);
};

MSG.WriteAngle = function(sb, f)
{
	MSG.WriteByte(sb, ((f >> 0) * (256.0 / 360.0)) & 255);
};

MSG.BeginReading = function()
{
	MSG.readcount = 0;
	MSG.badread = false;
};

MSG.ReadChar = function()
{
	if (MSG.readcount >= NET.message.cursize)
	{
		MSG.badread = true;
		return -1;
	}
	var c = (new Int8Array(NET.message.data, MSG.readcount, 1))[0];
	++MSG.readcount;
	return c;
};

MSG.ReadByte = function()
{
	if (MSG.readcount >= NET.message.cursize)
	{
		MSG.badread = true;
		return -1;
	}
	var c = (new Uint8Array(NET.message.data, MSG.readcount, 1))[0];
	++MSG.readcount;
	return c;
};

MSG.ReadShort = function()
{
	if ((MSG.readcount + 2) > NET.message.cursize)
	{
		MSG.badread = true;
		return -1;
	}
	var c = (new DataView(NET.message.data)).getInt16(MSG.readcount, true);
	MSG.readcount += 2;
	return c;
};

MSG.ReadLong = function()
{
	if ((MSG.readcount + 4) > NET.message.cursize)
	{
		MSG.badread = true;
		return -1;
	}
	var c = (new DataView(NET.message.data)).getInt32(MSG.readcount, true);
	MSG.readcount += 4;
	return c;
};

MSG.ReadFloat = function()
{
	if ((MSG.readcount + 4) > NET.message.cursize)
	{
		MSG.badread = true;
		return -1;
	}
	var f = (new DataView(NET.message.data)).getFloat32(MSG.readcount, true);
	MSG.readcount += 4;
	return f;
};

MSG.ReadString = function()
{
	var string = [], l, c;
	for (l = 0; l < 2048; ++l)
	{
		c = MSG.ReadByte();
		if (c <= 0)
			break;
		string[l] = String.fromCharCode(c);
	}
	return string.join('');
};

MSG.ReadCoord = function()
{
	return MSG.ReadShort() * 0.125;
};

MSG.ReadAngle = function()
{
	return MSG.ReadChar() * 1.40625;
};

// ---- WebQuake/NET.js ----
NET = {};

NET.activeSockets = [];
NET.message = {data: new ArrayBuffer(8192), cursize: 0};
NET.activeconnections = 0;

NET.NewQSocket = function()
{
	var i;
	for (i = 0; i < NET.activeSockets.length; ++i)
	{
		if (NET.activeSockets[i].disconnected === true)
			break;
	}
	NET.activeSockets[i] = {
		connecttime: NET.time,
		lastMessageTime: NET.time,
		driver: NET.driverlevel,
		address: 'UNSET ADDRESS'
	};
	return NET.activeSockets[i];
};

NET.Connect = function(host)
{
	NET.time = Sys.FloatTime();

	if (host === 'local')
	{
		NET.driverlevel = 0;
		return Loop.Connect(host);
	}

	var dfunc, ret;
	for (NET.driverlevel = 1; NET.driverlevel < NET.drivers.length; ++NET.driverlevel)
	{
		dfunc = NET.drivers[NET.driverlevel];
		if (dfunc.initialized !== true)
			continue;
		ret = dfunc.Connect(host);
		if (ret === 0)
		{
			CL.cls.state = CL.active.connecting;
			Con.Print('trying...\n');
			NET.start_time = NET.time;
			NET.reps = 0;
			throw 'NET.Connect';
		}
		if (ret != null)
			return ret;
	}
};

NET.CheckForResend = function()
{
	NET.time = Sys.FloatTime();
	var dfunc = NET.drivers[NET.newsocket.driver];
	if (NET.reps <= 2)
	{
		if ((NET.time - NET.start_time) >= (2.5 * (NET.reps + 1)))
		{
			Con.Print('still trying...\n');
			++NET.reps;
		}
	}
	else if (NET.reps === 3)
	{
		if ((NET.time - NET.start_time) >= 10.0)
		{
			NET.Close(NET.newsocket);
			CL.cls.state = CL.active.disconnected;
			Con.Print('No Response\n');
			Host.Error('NET.CheckForResend: connect failed\n');
		}
	}
	var ret = dfunc.CheckForResend();
	if (ret === 1)
	{
		NET.newsocket.disconnected = false;
		CL.Connect(NET.newsocket);
	}
	else if (ret === -1)
	{
		NET.newsocket.disconnected = false;
		NET.Close(NET.newsocket);
		CL.cls.state = CL.active.disconnected;
		Con.Print('Network Error\n');
		Host.Error('NET.CheckForResend: connect failed\n');
	}
};

NET.CheckNewConnections = function()
{
	NET.time = Sys.FloatTime();
	var dfunc, ret;
	for (NET.driverlevel = 0; NET.driverlevel < NET.drivers.length; ++NET.driverlevel)
	{
		dfunc = NET.drivers[NET.driverlevel];
		if (dfunc.initialized !== true)
			continue;
		ret = dfunc.CheckNewConnections();
		if (ret != null)
			return ret;
	}
};

NET.Close = function(sock)
{
	if (sock == null)
		return;
	if (sock.disconnected === true)
		return;
	NET.time = Sys.FloatTime();
	NET.drivers[sock.driver].Close(sock);
	sock.disconnected = true;
};

NET.GetMessage = function(sock)
{
	if (sock == null)
		return -1;
	if (sock.disconnected === true)
	{
		Con.Print('NET.GetMessage: disconnected socket\n');
		return -1;
	}
	NET.time = Sys.FloatTime();
	var ret = NET.drivers[sock.driver].GetMessage(sock);
	if (sock.driver !== 0)
	{
		if (ret === 0)
		{
			if ((NET.time - sock.lastMessageTime) > NET.messagetimeout.value)
			{
				NET.Close(sock);
				return -1;
			}
		}
		else if (ret > 0)
			sock.lastMessageTime = NET.time;
	}
	return ret;
};

NET.SendMessage = function(sock, data)
{
	if (sock == null)
		return -1;
	if (sock.disconnected === true)
	{
		Con.Print('NET.SendMessage: disconnected socket\n');
		return -1;
	}
	NET.time = Sys.FloatTime();
	return NET.drivers[sock.driver].SendMessage(sock, data);
};

NET.SendUnreliableMessage = function(sock, data)
{
	if (sock == null)
		return -1;
	if (sock.disconnected === true)
	{
		Con.Print('NET.SendUnreliableMessage: disconnected socket\n');
		return -1;
	}
	NET.time = Sys.FloatTime();
	return NET.drivers[sock.driver].SendUnreliableMessage(sock, data);
};

NET.CanSendMessage = function(sock)
{
	if (sock == null)
		return;
	if (sock.disconnected === true)
		return;
	NET.time = Sys.FloatTime();
	return NET.drivers[sock.driver].CanSendMessage(sock);
};

NET.SendToAll = function(data)
{
	var i, count = 0, state1 = [], state2 = [];
	for (i = 0; i < SV.svs.maxclients; ++i)
	{
		Host.client = SV.svs.clients[i];
		if (Host.client.netconnection == null)
			continue;
		if (Host.client.active !== true)
		{
			state1[i] = state2[i] = true;
			continue;
		}
		if (Host.client.netconnection.driver === 0)
		{
			NET.SendMessage(Host.client.netconnection, data);
			state1[i] = state2[i] = true;
			continue;
		}
		++count;
		state1[i] = state2[i] = false;
	}
	var start = Sys.FloatTime();
	for (; count !== 0; )
	{
		count = 0;
		for (i = 0; i < SV.svs.maxclients; ++i)
		{
			Host.client = SV.svs.clients[i];
			if (state1[i] !== true)
			{
				if (NET.CanSendMessage(Host.client.netconnection) === true)
				{
					state1[i] = true;
					NET.SendMessage(Host.client.netconnection, data);
				}
				else
					NET.GetMessage(Host.client.netconnection);
				++count;
				continue;
			}
			if (state2[i] !== true)
			{
				if (NET.CanSendMessage(Host.client.netconnection) === true)
					state2[i] = true;
				else
					NET.GetMessage(Host.client.netconnection);
				++count;
			}
		}
		if ((Sys.FloatTime() - start) > 5.0)
			return count;
	}
	return count;
};

NET.Init = function()
{
	NET.time = Sys.FloatTime();

	NET.messagetimeout = Cvar.RegisterVariable('net_messagetimeout', '300');
	NET.hostname = Cvar.RegisterVariable('hostname', 'UNNAMED');

	NET.drivers = [Loop]; // Ghosty: no network play (the WebSocket driver is left out)
	for (NET.driverlevel = 0; NET.driverlevel < NET.drivers.length; ++NET.driverlevel)
		NET.drivers[NET.driverlevel].initialized = NET.drivers[NET.driverlevel].Init();
};

NET.Shutdown = function()
{
	NET.time = Sys.FloatTime();
	for (i = 0; i < NET.activeSockets.length; ++i)
		NET.Close(NET.activeSockets[i]);
};

// ---- WebQuake/NET_Loop.js ----
Loop = {};

Loop.Init = function()
{
	return true;
};

Loop.Connect = function(host)
{
	if (host !== 'local')
		return;

	Loop.localconnectpending = true;

	if (Loop.client == null)
	{
		Loop.client = NET.NewQSocket();
		Loop.client.receiveMessage = new Uint8Array(new ArrayBuffer(8192));
		Loop.client.address = 'localhost';
	}
	Loop.client.receiveMessageLength = 0;
	Loop.client.canSend = true;

	if (Loop.server == null)
	{
		Loop.server = NET.NewQSocket();
		Loop.server.receiveMessage = new Uint8Array(new ArrayBuffer(8192));
		Loop.server.address = 'LOCAL';
	}
	Loop.server.receiveMessageLength = 0;
	Loop.server.canSend = true;

	Loop.client.driverdata = Loop.server;
	Loop.server.driverdata = Loop.client;

	return Loop.client;
};

Loop.CheckNewConnections = function()
{
	if (Loop.localconnectpending !== true)
		return;
	Loop.localconnectpending = false;
	Loop.server.receiveMessageLength = 0;
	Loop.server.canSend = true;
	Loop.client.receiveMessageLength = 0;
	Loop.client.canSend = true;
	return Loop.server;
};

Loop.GetMessage = function(sock)
{
	if (sock.receiveMessageLength === 0)
		return 0;
	var ret = sock.receiveMessage[0];
	var length = sock.receiveMessage[1] + (sock.receiveMessage[2] << 8);
	if (length > NET.message.data.byteLength)
		Sys.Error('Loop.GetMessage: overflow');
	NET.message.cursize = length;
	(new Uint8Array(NET.message.data)).set(sock.receiveMessage.subarray(3, length + 3));
	sock.receiveMessageLength -= length;
	if (sock.receiveMessageLength >= 4)
	{
		var i;
		for (i = 0; i < sock.receiveMessageLength; ++i)
			sock.receiveMessage[i] = sock.receiveMessage[length + 3 + i];
	}
	sock.receiveMessageLength -= 3;
	if ((sock.driverdata != null) && (ret === 1))
		sock.driverdata.canSend = true;
	return ret;
};

Loop.SendMessage = function(sock, data)
{
	if (sock.driverdata == null)
		return -1;
	var bufferLength = sock.driverdata.receiveMessageLength;
	sock.driverdata.receiveMessageLength += data.cursize + 3;
	if (sock.driverdata.receiveMessageLength > 8192)
		Sys.Error('Loop.SendMessage: overflow');
	var buffer = sock.driverdata.receiveMessage;
	buffer[bufferLength] = 1;
	buffer[bufferLength + 1] = data.cursize & 0xff;
	buffer[bufferLength + 2] = data.cursize >> 8;
	buffer.set(new Uint8Array(data.data, 0, data.cursize), bufferLength + 3);
	sock.canSend = false;
	return 1;
};

Loop.SendUnreliableMessage = function(sock, data)
{
	if (sock.driverdata == null)
		return -1;
	var bufferLength = sock.driverdata.receiveMessageLength;
	sock.driverdata.receiveMessageLength += data.cursize + 3;
	if (sock.driverdata.receiveMessageLength > 8192)
		Sys.Error('Loop.SendMessage: overflow');
	var buffer = sock.driverdata.receiveMessage;
	buffer[bufferLength] = 2;
	buffer[bufferLength + 1] = data.cursize & 0xff;
	buffer[bufferLength + 2] = data.cursize >> 8;
	buffer.set(new Uint8Array(data.data, 0, data.cursize), bufferLength + 3);
	return 1;
};

Loop.CanSendMessage = function(sock)
{
	if (sock.driverdata != null)
		return sock.canSend;
};

Loop.Close = function(sock)
{
	if (sock.driverdata != null)
		sock.driverdata.driverdata = null;
	sock.receiveMessageLength = 0;
	sock.canSend = false;
	if (sock === Loop.client)
		Loop.client = null;
	else
		Loop.server = null;
};

// ---- WebQuake/NET_WEBS.js ----
WEBS = {};

WEBS.Init = function()
{
	if ((window.WebSocket == null) || (document.location.protocol === 'https:'))
		return;
	WEBS.available = true;
	return true;
};

WEBS.Connect = function(host)
{
	if (host.length <= 5)
		return;
	if (host.charCodeAt(5) === 47)
		return;
	if (host.substring(0, 5) !== 'ws://')
		return;
	host = 'ws://' + host.split('/')[2];
	var sock = NET.NewQSocket();
	sock.disconnected = true;
	sock.receiveMessage = [];
	sock.address = host;
	try
	{
		sock.driverdata = new WebSocket(host, 'quake');
	}
	catch (e)
	{
		return;
	}
	sock.driverdata.data_socket = sock;
	sock.driverdata.binaryType = 'arraybuffer';
	sock.driverdata.onerror = WEBS.OnError;
	sock.driverdata.onmessage = WEBS.OnMessage;
	NET.newsocket = sock;
	return 0;
};

WEBS.CheckNewConnections = function()
{
};

WEBS.GetMessage = function(sock)
{
	if (sock.driverdata == null)
		return -1;
	if (sock.driverdata.readyState !== 1)
		return -1;
	if (sock.receiveMessage.length === 0)
		return 0;
	var message = sock.receiveMessage.shift();
	NET.message.cursize = message.length - 1;
	(new Uint8Array(NET.message.data)).set(message.subarray(1));
	return message[0];
};

WEBS.SendMessage = function(sock, data)
{
	if (sock.driverdata == null)
		return -1;
	if (sock.driverdata.readyState !== 1)
		return -1;
	var buf = new ArrayBuffer(data.cursize + 1), dest = new Uint8Array(buf);
	dest[0] = 1;
	dest.set(new Uint8Array(data.data, 0, data.cursize), 1);
	sock.driverdata.send(buf);
	return 1;
};

WEBS.SendUnreliableMessage = function(sock, data)
{
	if (sock.driverdata == null)
		return -1;
	if (sock.driverdata.readyState !== 1)
		return -1;
	var buf = new ArrayBuffer(data.cursize + 1), dest = new Uint8Array(buf);
	dest[0] = 2;
	dest.set(new Uint8Array(data.data, 0, data.cursize), 1);
	sock.driverdata.send(buf);
	return 1;
};

WEBS.CanSendMessage = function(sock)
{
	if (sock.driverdata == null)
		return;
	if (sock.driverdata.readyState === 1)
		return true;
};

WEBS.Close = function(sock)
{
	if (sock.driverdata != null)
		sock.driverdata.close(1000);
};

WEBS.CheckForResend = function()
{
	if (NET.newsocket.driverdata.readyState === 1)
		return 1;
	if (NET.newsocket.driverdata.readyState !== 0)
		return -1;
};

WEBS.OnError = function()
{
	NET.Close(this.data_socket);
};

WEBS.OnMessage = function(message)
{
	var data = message.data;
	if (typeof(data) === 'string')
		return;
	if (data.byteLength > 8000)
		return;
	this.data_socket.receiveMessage.push(new Uint8Array(data));
};

// ---- WebQuake/PF.js ----
PF = {};

PF.VarString = function(first)
{
	var i, out = '';
	for (i = first; i < PR.argc; ++i)
		out += PR.GetString(PR.globals_int[4 + i * 3]);
	return out;
};

PF.error = function()
{
	Con.Print('======SERVER ERROR in ' + PR.GetString(PR.xfunction.name) + '\n' + PF.VarString(0) + '\n');
	ED.Print(SV.server.edicts[PR.globals_int[PR.globalvars.self]]);
	Host.Error('Program error');
};

PF.objerror = function()
{
	Con.Print('======OBJECT ERROR in ' + PR.GetString(PR.xfunction.name) + '\n' + PF.VarString(0) + '\n');
	ED.Print(SV.server.edicts[PR.globals_int[PR.globalvars.self]]);
	Host.Error('Program error');
};

PF.makevectors = function()
{
	var forward = [], right = [], up = [];
	Vec.AngleVectors([PR.globals_float[4], PR.globals_float[5], PR.globals_float[6]], forward, right, up);
	var i;
	for (i = 0; i <= 2; ++i)
	{
		PR.globals_float[PR.globalvars.v_forward + i] = forward[i];
		PR.globals_float[PR.globalvars.v_right + i] = right[i];
		PR.globals_float[PR.globalvars.v_up + i] = up[i];
	}
};

PF.setorigin = function()
{
	var e = SV.server.edicts[PR.globals_int[4]];
	e.v_float[PR.entvars.origin] = PR.globals_float[7];
	e.v_float[PR.entvars.origin1] = PR.globals_float[8];
	e.v_float[PR.entvars.origin2] = PR.globals_float[9];
	SV.LinkEdict(e);
};

PF.SetMinMaxSize = function(e, min, max)
{
	if ((min[0] > max[0]) || (min[1] > max[1]) || (min[2] > max[2]))
		PR.RunError('backwards mins/maxs');
	ED.SetVector(e, PR.entvars.mins, min);
	ED.SetVector(e, PR.entvars.maxs, max);
	e.v_float[PR.entvars.size] = max[0] - min[0];
	e.v_float[PR.entvars.size1] = max[1] - min[1];
	e.v_float[PR.entvars.size2] = max[2] - min[2];
	SV.LinkEdict(e);
};

PF.setsize = function()
{
	PF.SetMinMaxSize(SV.server.edicts[PR.globals_int[4]],
		[PR.globals_float[7], PR.globals_float[8], PR.globals_float[9]],
		[PR.globals_float[10], PR.globals_float[11], PR.globals_float[12]]);
};

PF.setmodel = function()
{
	var e = SV.server.edicts[PR.globals_int[4]];
	var m = PR.GetString(PR.globals_int[7]);
	var i;
	for (i = 0; i < SV.server.model_precache.length; ++i)
	{
		if (SV.server.model_precache[i] === m)
			break;
	}
	if (i === SV.server.model_precache.length)
		PR.RunError('no precache: ' + m + '\n');

	e.v_int[PR.entvars.model] = PR.globals_int[7];
	e.v_float[PR.entvars.modelindex] = i;
	var mod = SV.server.models[i];
	if (mod != null)
		PF.SetMinMaxSize(e, mod.mins, mod.maxs);
	else
		PF.SetMinMaxSize(e, Vec.origin, Vec.origin);
};

PF.bprint = function()
{
	Host.BroadcastPrint(PF.VarString(0));
};

PF.sprint = function()
{
	var entnum = PR.globals_int[4];
	if ((entnum <= 0) || (entnum > SV.svs.maxclients))
	{
		Con.Print('tried to sprint to a non-client\n');
		return;
	}
	var client = SV.svs.clients[entnum - 1];
	MSG.WriteByte(client.message, Protocol.svc.print);
	MSG.WriteString(client.message, PF.VarString(1));
};

PF.centerprint = function()
{
	var entnum = PR.globals_int[4];
	if ((entnum <= 0) || (entnum > SV.svs.maxclients))
	{
		Con.Print('tried to sprint to a non-client\n');
		return;
	}
	var client = SV.svs.clients[entnum - 1];
	MSG.WriteByte(client.message, Protocol.svc.centerprint);
	MSG.WriteString(client.message, PF.VarString(1));
};

PF.normalize = function()
{
	var newvalue = [PR.globals_float[4], PR.globals_float[5], PR.globals_float[6]];
	Vec.Normalize(newvalue);
	PR.globals_float[1] = newvalue[0];
	PR.globals_float[2] = newvalue[1];
	PR.globals_float[3] = newvalue[2];
};

PF.vlen = function()
{
	PR.globals_float[1] = Math.sqrt(PR.globals_float[4] * PR.globals_float[4] + PR.globals_float[5] * PR.globals_float[5] + PR.globals_float[6] * PR.globals_float[6]);
};

PF.vectoyaw = function()
{
	var value1 = PR.globals_float[4], value2 = PR.globals_float[5];
	if ((value1 === 0.0) && (value2 === 0.0))
	{
		PR.globals_float[1] = 0.0;
		return;
	}
	var yaw = (Math.atan2(value2, value1) * 180.0 / Math.PI) >> 0;
	if (yaw < 0)
		yaw += 360;
	PR.globals_float[1] = yaw;
};

PF.vectoangles = function()
{
	PR.globals_float[3] = 0.0;
	var value1 = [PR.globals_float[4], PR.globals_float[5], PR.globals_float[6]];
	if ((value1[0] === 0.0) && (value1[1] === 0.0))
	{
		if (value1[2] > 0.0)
			PR.globals_float[1] = 90.0;
		else
			PR.globals_float[1] = 270.0;
		PR.globals_float[2] = 0.0;
		return;
	}

	var yaw = (Math.atan2(value1[1], value1[0]) * 180.0 / Math.PI) >> 0;
	if (yaw < 0)
		yaw += 360;
	var pitch = (Math.atan2(value1[2], Math.sqrt(value1[0] * value1[0] + value1[1] * value1[1])) * 180.0 / Math.PI) >> 0;
	if (pitch < 0)
		pitch += 360;
	PR.globals_float[1] = pitch;
	PR.globals_float[2] = yaw;
};

PF.random = function()
{
	PR.globals_float[1] = Math.random();
};

PF.particle = function()
{
	SV.StartParticle([PR.globals_float[4], PR.globals_float[5], PR.globals_float[6]],
		[PR.globals_float[7], PR.globals_float[8], PR.globals_float[9]],
		PR.globals_float[10] >> 0, PR.globals_float[13] >> 0);
};

PF.ambientsound = function()
{
	var samp = PR.GetString(PR.globals_int[7]), i;
	for (i = 0; i < SV.server.sound_precache.length; ++i)
	{
		if (SV.server.sound_precache[i] === samp)
			break;
	}
	if (i === SV.server.sound_precache.length)
	{
		Con.Print('no precache: ' + samp + '\n');
		return;
	}
	var signon = SV.server.signon;
	MSG.WriteByte(signon, Protocol.svc.spawnstaticsound);
	MSG.WriteCoord(signon, PR.globals_float[4]);
	MSG.WriteCoord(signon, PR.globals_float[5]);
	MSG.WriteCoord(signon, PR.globals_float[6]);
	MSG.WriteByte(signon, i);
	MSG.WriteByte(signon, PR.globals_float[10] * 255.0);
	MSG.WriteByte(signon, PR.globals_float[13] * 64.0);
};

PF.sound = function()
{
	SV.StartSound(SV.server.edicts[PR.globals_int[4]],
		PR.globals_float[7] >> 0,
		PR.GetString(PR.globals_int[10]),
		(PR.globals_float[13] * 255.0) >> 0,
		PR.globals_float[16]);
};

PF.breakstatement = function()
{
	Con.Print('break statement\n');
};

PF.traceline = function()
{
	var trace = SV.Move([PR.globals_float[4], PR.globals_float[5], PR.globals_float[6]],
		Vec.origin, Vec.origin, [PR.globals_float[7], PR.globals_float[8], PR.globals_float[9]],
		PR.globals_float[10] >> 0, SV.server.edicts[PR.globals_int[13]]);
	PR.globals_float[PR.globalvars.trace_allsolid] = (trace.allsolid === true) ? 1.0 : 0.0;
	PR.globals_float[PR.globalvars.trace_startsolid] = (trace.startsolid === true) ? 1.0 : 0.0;
	PR.globals_float[PR.globalvars.trace_fraction] = trace.fraction;
	PR.globals_float[PR.globalvars.trace_inwater] = (trace.inwater === true) ? 1.0 : 0.0;
	PR.globals_float[PR.globalvars.trace_inopen] = (trace.inopen === true) ? 1.0 : 0.0;
	PR.globals_float[PR.globalvars.trace_endpos] = trace.endpos[0];
	PR.globals_float[PR.globalvars.trace_endpos1] = trace.endpos[1];
	PR.globals_float[PR.globalvars.trace_endpos2] = trace.endpos[2];
	var plane = trace.plane;
	PR.globals_float[PR.globalvars.trace_plane_normal] = plane.normal[0];
	PR.globals_float[PR.globalvars.trace_plane_normal1] = plane.normal[1];
	PR.globals_float[PR.globalvars.trace_plane_normal2] = plane.normal[2];
	PR.globals_float[PR.globalvars.trace_plane_dist] = plane.dist;
	PR.globals_int[PR.globalvars.trace_ent] = (trace.ent != null) ? trace.ent.num : 0;
};

PF.newcheckclient = function(check)
{
	if (check <= 0)
		check = 1;
	else if (check > SV.svs.maxclients)
		check = SV.svs.maxclients;
	var i = 1;
	if (check !== SV.svs.maxclients)
		i += check;
	var ent;
	for (; ; ++i)
	{
		if (i === SV.svs.maxclients + 1)
			i = 1;
		ent = SV.server.edicts[i];
		if (i === check)
			break;
		if (ent.free === true)
			continue;
		if ((ent.v_float[PR.entvars.health] <= 0.0) || ((ent.v_float[PR.entvars.flags] & SV.fl.notarget) !== 0))
			continue;
		break;
	}
	PF.checkpvs = Mod.LeafPVS(Mod.PointInLeaf([
			ent.v_float[PR.entvars.origin] + ent.v_float[PR.entvars.view_ofs],
			ent.v_float[PR.entvars.origin1] + ent.v_float[PR.entvars.view_ofs1],
			ent.v_float[PR.entvars.origin2] + ent.v_float[PR.entvars.view_ofs2]
		], SV.server.worldmodel), SV.server.worldmodel);
	return i;
};

PF.checkclient = function()
{
	if ((SV.server.time - SV.server.lastchecktime) >= 0.1)
	{
		SV.server.lastcheck = PF.newcheckclient(SV.server.lastcheck);
		SV.server.lastchecktime = SV.server.time;
	}
	var ent = SV.server.edicts[SV.server.lastcheck];
	if ((ent.free === true) || (ent.v_float[PR.entvars.health] <= 0.0))
	{
		PR.globals_int[1] = 0;
		return;
	}
	var self = SV.server.edicts[PR.globals_int[PR.globalvars.self]];
	var l = Mod.PointInLeaf([
			self.v_float[PR.entvars.origin] + self.v_float[PR.entvars.view_ofs],
			self.v_float[PR.entvars.origin1] + self.v_float[PR.entvars.view_ofs1],
			self.v_float[PR.entvars.origin2] + self.v_float[PR.entvars.view_ofs2]
		], SV.server.worldmodel).num - 1;
	if ((l < 0) || ((PF.checkpvs[l >> 3] & (1 << (l & 7))) === 0))
	{
		PR.globals_int[1] = 0;
		return;
	}
	PR.globals_int[1] = ent.num;
};

PF.stuffcmd = function()
{
	var entnum = PR.globals_int[4];
	if ((entnum <= 0) || (entnum > SV.svs.maxclients))
		PR.RunError('Parm 0 not a client');
	var client = SV.svs.clients[entnum - 1];
	MSG.WriteByte(client.message, Protocol.svc.stufftext);
	MSG.WriteString(client.message, PR.GetString(PR.globals_int[7]));
};

PF.localcmd = function()
{
	Cmd.text += PR.GetString(PR.globals_int[4]);
};

PF.cvar = function()
{
	var v = Cvar.FindVar(PR.GetString(PR.globals_int[4]));
	PR.globals_float[1] = v != null ? v.value : 0.0;
};

PF.cvar_set = function()
{
	Cvar.Set(PR.GetString(PR.globals_int[4]), PR.GetString(PR.globals_int[7]));
};

PF.findradius = function()
{
	var chain = 0;
	var org = [PR.globals_float[4], PR.globals_float[5], PR.globals_float[6]], eorg = [];
	var rad = PR.globals_float[7];
	var i, ent;
	for (i = 1; i < SV.server.num_edicts; ++i)
	{
		ent = SV.server.edicts[i];
		if (ent.free === true)
			continue;
		if (ent.v_float[PR.entvars.solid] === SV.solid.not)
			continue;
		eorg[0] = org[0] - (ent.v_float[PR.entvars.origin] + (ent.v_float[PR.entvars.mins] + ent.v_float[PR.entvars.maxs]) * 0.5);
		eorg[1] = org[1] - (ent.v_float[PR.entvars.origin1] + (ent.v_float[PR.entvars.mins1] + ent.v_float[PR.entvars.maxs1]) * 0.5);
		eorg[2] = org[2] - (ent.v_float[PR.entvars.origin2] + (ent.v_float[PR.entvars.mins2] + ent.v_float[PR.entvars.maxs2]) * 0.5);
		if (Math.sqrt(eorg[0] * eorg[0] + eorg[1] * eorg[1] + eorg[2] * eorg[2]) > rad)
			continue;
		ent.v_int[PR.entvars.chain] = chain;
		chain = i;
	}
	PR.globals_int[1] = chain;
};

PF.dprint = function()
{
	Con.DPrint(PF.VarString(0));
};

PF.ftos = function()
{
	var v = PR.globals_float[4];
	if (v === Math.floor(v))
		PR.TempString(v.toString());
	else
		PR.TempString(v.toFixed(1));
	PR.globals_int[1] = PR.string_temp;
};

PF.fabs = function()
{
	PR.globals_float[1] = Math.abs(PR.globals_float[4]);
};

PF.vtos = function()
{
	PR.TempString(PR.globals_float[4].toFixed(1)
		+ ' ' + PR.globals_float[5].toFixed(1)
		+ ' ' + PR.globals_float[6].toFixed(1));
	PR.globals_int[1] = PR.string_temp;
};

PF.Spawn = function()
{
	PR.globals_int[1] = ED.Alloc().num;
};

PF.Remove = function()
{
	ED.Free(SV.server.edicts[PR.globals_int[4]]);
};

PF.Find = function()
{
	var e = PR.globals_int[4];
	var f = PR.globals_int[7];
	var s = PR.GetString(PR.globals_int[10]);
	var ed;
	for (++e; e < SV.server.num_edicts; ++e)
	{
		ed = SV.server.edicts[e];
		if (ed.free === true)
			continue;
		if (PR.GetString(ed.v_int[f]) === s)
		{
			PR.globals_int[1] = ed.num;
			return;
		}
	}
	PR.globals_int[1] = 0;
};

PF.MoveToGoal = function()
{
	var ent = SV.server.edicts[PR.globals_int[PR.globalvars.self]];
	if ((ent.v_float[PR.entvars.flags] & (SV.fl.onground + SV.fl.fly + SV.fl.swim)) === 0)
	{
		PR.globals_float[1] = 0.0;
		return;
	}
	var goal = SV.server.edicts[ent.v_int[PR.entvars.goalentity]];
	var dist = PR.globals_float[4];
	if ((ent.v_int[PR.entvars.enemy] !== 0) && (SV.CloseEnough(ent, goal, dist) === true))
		return;
	if ((Math.random() >= 0.75) || (SV.StepDirection(ent, ent.v_float[PR.entvars.ideal_yaw], dist) !== true))
		SV.NewChaseDir(ent, goal, dist);
};

PF.precache_file = function()
{
	PR.globals_int[1] = PR.globals_int[4];
};

PF.precache_sound = function()
{
	var s = PR.GetString(PR.globals_int[4]);
	PR.globals_int[1] = PR.globals_int[4];
	PR.CheckEmptyString(s);
	var i;
	for (i = 0; i < SV.server.sound_precache.length; ++i)
	{
		if (SV.server.sound_precache[i] === s)
			return;
	}
	SV.server.sound_precache[i] = s;
};

PF.precache_model = function()
{
	if (SV.server.loading !== true)
		PR.RunError('PF.Precache_*: Precache can only be done in spawn functions');
	var s = PR.GetString(PR.globals_int[4]);
	PR.globals_int[1] = PR.globals_int[4];
	PR.CheckEmptyString(s);
	var i;
	for (i = 0; i < SV.server.model_precache.length; ++i)
	{
		if (SV.server.model_precache[i] === s)
			return;
	}
	SV.server.model_precache[i] = s;
	SV.server.models[i] = Mod.ForName(s, true);
};

PF.coredump = function()
{
	ED.PrintEdicts();
};

PF.traceon = function()
{
	PR.trace = true;
};

PF.traceoff = function()
{
	PR.trace = false;
};

PF.eprint = function()
{
	ED.Print(SV.server.edicts[PR.globals_float[4]]);
};

PF.walkmove = function()
{
	var ent = SV.server.edicts[PR.globals_int[PR.globalvars.self]];
	if ((ent.v_float[PR.entvars.flags] & (SV.fl.onground + SV.fl.fly + SV.fl.swim)) === 0)
	{
		PR.globals_float[1] = 0.0;
		return;
	}
	var yaw = PR.globals_float[4] * Math.PI / 180.0;
	var dist = PR.globals_float[7];
	var oldf = PR.xfunction;
	PR.globals_float[1] = SV.movestep(ent, [Math.cos(yaw) * dist, Math.sin(yaw) * dist], true);
	PR.xfunction = oldf;
	PR.globals_int[PR.globalvars.self] = ent.num;
};

PF.droptofloor = function()
{
	var ent = SV.server.edicts[PR.globals_int[PR.globalvars.self]];
	var trace = SV.Move(ED.Vector(ent, PR.entvars.origin),
		ED.Vector(ent, PR.entvars.mins), ED.Vector(ent, PR.entvars.maxs),
		[ent.v_float[PR.entvars.origin], ent.v_float[PR.entvars.origin1], ent.v_float[PR.entvars.origin2] - 256.0], 0, ent);
	if ((trace.fraction === 1.0) || (trace.allsolid === true))
	{
		PR.globals_float[1] = 0.0;
		return;
	}
	ED.SetVector(ent, PR.entvars.origin, trace.endpos);
	SV.LinkEdict(ent);
	ent.v_float[PR.entvars.flags] |= SV.fl.onground;
	ent.v_int[PR.entvars.groundentity] = trace.ent.num;
	PR.globals_float[1] = 1.0;
};

PF.lightstyle = function()
{
	var style = PR.globals_float[4] >> 0;
	var val = PR.GetString(PR.globals_int[7]);
	SV.server.lightstyles[style] = val;
	if (SV.server.loading === true)
		return;
	var i, client;
	for (i = 0; i < SV.svs.maxclients; ++i)
	{
		client = SV.svs.clients[i];
		if ((client.active !== true) && (client.spawned !== true))
			continue;
		MSG.WriteByte(client.message, Protocol.svc.lightstyle);
		MSG.WriteByte(client.message, style);
		MSG.WriteString(client.message, val);
	}
};

PF.rint = function()
{
	var f = PR.globals_float[4];
	PR.globals_float[1] = (f >= 0.0 ? f + 0.5 : f - 0.5) >> 0;
};

PF.floor = function()
{
	PR.globals_float[1] = Math.floor(PR.globals_float[4]);
};

PF.ceil = function()
{
	PR.globals_float[1] = Math.ceil(PR.globals_float[4]);
};

PF.checkbottom = function()
{
	PR.globals_float[1] = SV.CheckBottom(SV.server.edicts[PR.globals_int[4]]);
};

PF.pointcontents = function()
{
	PR.globals_float[1] = SV.PointContents([PR.globals_float[4], PR.globals_float[5], PR.globals_float[6]]);
};

PF.nextent = function()
{
	var i;
	for (i = PR.globals_int[4] + 1; i < SV.server.num_edicts; ++i)
	{
		if (SV.server.edicts[i].free !== true)
		{
			PR.globals_int[1] = i;
			return;
		}
	}
	PR.globals_int[1] = 0;
};

PF.aim = function()
{
	var ent = SV.server.edicts[PR.globals_int[4]];
	var start = [ent.v_float[PR.entvars.origin], ent.v_float[PR.entvars.origin1], ent.v_float[PR.entvars.origin2] + 20.0];
	var dir = [PR.globals_float[PR.globalvars.v_forward], PR.globals_float[PR.globalvars.v_forward1], PR.globals_float[PR.globalvars.v_forward2]];
	var end = [start[0] + 2048.0 * dir[0], start[1] + 2048.0 * dir[1], start[2] + 2048.0 * dir[2]];
	var tr = SV.Move(start, Vec.origin, Vec.origin, end, 0, ent);
	if (tr.ent != null)
	{
		if ((tr.ent.v_float[PR.entvars.takedamage] === SV.damage.aim) &&
			((Host.teamplay.value === 0) || (ent.v_float[PR.entvars.team] <= 0) ||
			(ent.v_float[PR.entvars.team] !== tr.ent.v_float[PR.entvars.team])))
		{
			PR.globals_float[1] = dir[0];
			PR.globals_float[2] = dir[1];
			PR.globals_float[3] = dir[2];
			return;
		}
	}
	var bestdir = [dir[0], dir[1], dir[2]];
	var bestdist = SV.aim.value;
	var bestent, i, check, dist, end = [];
	for (i = 1; i < SV.server.num_edicts; ++i)
	{
		check = SV.server.edicts[i];
		if (check.v_float[PR.entvars.takedamage] !== SV.damage.aim)
			continue;
		if (check === ent)
			continue;
		if ((Host.teamplay.value !== 0) && (ent.v_float[PR.entvars.team] > 0) && (ent.v_float[PR.entvars.team] === check.v_float[PR.entvars.team]))
			continue;
		end[0] = check.v_float[PR.entvars.origin] + 0.5 * (check.v_float[PR.entvars.mins] + check.v_float[PR.entvars.maxs]);
		end[1] = check.v_float[PR.entvars.origin1] + 0.5 * (check.v_float[PR.entvars.mins1] + check.v_float[PR.entvars.maxs1]);
		end[2] = check.v_float[PR.entvars.origin2] + 0.5 * (check.v_float[PR.entvars.mins2] + check.v_float[PR.entvars.maxs2]);
		dir[0] = end[0] - start[0];
		dir[1] = end[1] - start[1];
		dir[2] = end[2] - start[2];
		Vec.Normalize(dir);
		dist = dir[0] * bestdir[0] + dir[1] * bestdir[1] + dir[2] * bestdir[2];
		if (dist < bestdist)
			continue;
		tr = SV.Move(start, Vec.origin, Vec.origin, end, 0, ent);
		if (tr.ent === check)
		{
			bestdist = dist;
			bestent = check;
		}
	}
	if (bestent != null)
	{
		dir[0] = bestent.v_float[PR.entvars.origin] - ent.v_float[PR.entvars.origin];
		dir[1] = bestent.v_float[PR.entvars.origin1] - ent.v_float[PR.entvars.origin1];
		dir[2] = bestent.v_float[PR.entvars.origin2] - ent.v_float[PR.entvars.origin2];
		dist = dir[0] * bestdir[0] + dir[1] * bestdir[1] + dir[2] * bestdir[2];
		end[0] = bestdir[0] * dist;
		end[1] = bestdir[1] * dist;
		end[2] = dir[2];
		Vec.Normalize(end);
		PR.globals_float[1] = end[0];
		PR.globals_float[2] = end[1];
		PR.globals_float[3] = end[2];
		return;
	}
	PR.globals_float[1] = bestdir[0];
	PR.globals_float[2] = bestdir[1];
	PR.globals_float[3] = bestdir[2];
};

PF.changeyaw = function()
{
	var ent = SV.server.edicts[PR.globals_int[PR.globalvars.self]];
	var current = Vec.Anglemod(ent.v_float[PR.entvars.angles1]);
	var ideal = ent.v_float[PR.entvars.ideal_yaw];
	if (current === ideal)
		return;
	var move = ideal - current;
	if (ideal > current)
	{
		if (move >= 180.0)
			move -= 360.0;
	}
	else if (move <= -180.0)
		move += 360.0;
	var speed = ent.v_float[PR.entvars.yaw_speed];
	if (move > 0.0)
	{
		if (move > speed)
			move = speed;
	}
	else if (move < -speed)
		move = -speed;
	ent.v_float[PR.entvars.angles1] = Vec.Anglemod(current + move);
};

PF.WriteDest = function()
{
	switch (PR.globals_float[4] >> 0)
	{
	case 0: // broadcast
		return SV.server.datagram;
	case 1: // one
		var entnum = PR.globals_int[PR.globalvars.msg_entity];
		if ((entnum <= 0) || (entnum > SV.svs.maxclients))
			PR.RunError('WriteDest: not a client');
		return SV.svs.clients[entnum - 1].message;
	case 2: // all
		return SV.server.reliable_datagram;
	case 3: // init
		return SV.server.signon;
	}
	PR.RunError('WriteDest: bad destination');
};

PF.WriteByte = function() {MSG.WriteByte(PF.WriteDest(), PR.globals_float[7]);};
PF.WriteChar = function() {MSG.WriteChar(PF.WriteDest(), PR.globals_float[7]);};
PF.WriteShort = function() {MSG.WriteShort(PF.WriteDest(), PR.globals_float[7]);};
PF.WriteLong = function() {MSG.WriteLong(PF.WriteDest(), PR.globals_float[7]);};
PF.WriteAngle = function() {MSG.WriteAngle(PF.WriteDest(), PR.globals_float[7]);};
PF.WriteCoord = function() {MSG.WriteCoord(PF.WriteDest(), PR.globals_float[7]);};
PF.WriteString = function() {MSG.WriteString(PF.WriteDest(), PR.GetString(PR.globals_int[7]));};
PF.WriteEntity = function() {MSG.WriteShort(PF.WriteDest(), PR.globals_int[7]);};

PF.makestatic = function()
{
	var ent = SV.server.edicts[PR.globals_int[4]];
	var message = SV.server.signon;
	MSG.WriteByte(message, Protocol.svc.spawnstatic);
	MSG.WriteByte(message, SV.ModelIndex(PR.GetString(ent.v_int[PR.entvars.model])));
	MSG.WriteByte(message, ent.v_float[PR.entvars.frame]);
	MSG.WriteByte(message, ent.v_float[PR.entvars.colormap]);
	MSG.WriteByte(message, ent.v_float[PR.entvars.skin]);
	MSG.WriteCoord(message, ent.v_float[PR.entvars.origin]);
	MSG.WriteAngle(message, ent.v_float[PR.entvars.angles]);
	MSG.WriteCoord(message, ent.v_float[PR.entvars.origin1]);
	MSG.WriteAngle(message, ent.v_float[PR.entvars.angles1]);
	MSG.WriteCoord(message, ent.v_float[PR.entvars.origin2]);
	MSG.WriteAngle(message, ent.v_float[PR.entvars.angles2]);
	ED.Free(ent);
};

PF.setspawnparms = function()
{
	var i = PR.globals_int[4];
	if ((i <= 0) || (i > SV.svs.maxclients))
		PR.RunError('Entity is not a client');
	var spawn_parms = SV.svs.clients[i - 1].spawn_parms;
	for (i = 0; i <= 15; ++i)
		PR.globals_float[PR.globalvars.parms + i] = spawn_parms[i];
};

PF.changelevel = function()
{
	if (SV.svs.changelevel_issued === true)
		return;
	SV.svs.changelevel_issued = true;
	Cmd.text += 'changelevel ' + PR.GetString(PR.globals_int[4]) + '\n';
};

PF.Fixme = function()
{
	PR.RunError('unimplemented builtin');
};

PF.builtin = [
	PF.Fixme,
	PF.makevectors,
	PF.setorigin,
	PF.setmodel,
	PF.setsize,
	PF.Fixme,
	PF.breakstatement,
	PF.random,
	PF.sound,
	PF.normalize,
	PF.error,
	PF.objerror,
	PF.vlen,
	PF.vectoyaw,
	PF.Spawn,
	PF.Remove,
	PF.traceline,
	PF.checkclient,
	PF.Find,
	PF.precache_sound,
	PF.precache_model,
	PF.stuffcmd,
	PF.findradius,
	PF.bprint,
	PF.sprint,
	PF.dprint,
	PF.ftos,
	PF.vtos,
	PF.coredump,
	PF.traceon,
	PF.traceoff,
	PF.eprint,
	PF.walkmove,
	PF.Fixme,
	PF.droptofloor,
	PF.lightstyle,
	PF.rint,
	PF.floor,
	PF.ceil,
	PF.Fixme,
	PF.checkbottom,
	PF.pointcontents,
	PF.Fixme,
	PF.fabs,
	PF.aim,
	PF.cvar,
	PF.localcmd,
	PF.nextent,
	PF.particle,
	PF.changeyaw,
	PF.Fixme,
	PF.vectoangles,
	PF.WriteByte,
	PF.WriteChar,
	PF.WriteShort,
	PF.WriteLong,
	PF.WriteCoord,
	PF.WriteAngle,
	PF.WriteString,
	PF.WriteEntity,
	PF.Fixme,
	PF.Fixme,
	PF.Fixme,
	PF.Fixme,
	PF.Fixme,
	PF.Fixme,
	PF.Fixme,
	PF.MoveToGoal,
	PF.precache_file,
	PF.makestatic,
	PF.changelevel,
	PF.Fixme,
	PF.cvar_set,
	PF.centerprint,
	PF.ambientsound,
	PF.precache_model,
	PF.precache_sound,
	PF.precache_file,
	PF.setspawnparms
];

// ---- WebQuake/PR.js ----
PR = {};

PR.etype = {
	ev_void: 0,
	ev_string: 1,
	ev_float: 2,
	ev_vector: 3,
	ev_entity: 4,
	ev_field: 5,
	ev_function: 6,
	ev_pointer: 7
};

PR.op = {
	done: 0,
	mul_f: 1, mul_v: 2, mul_fv: 3, mul_vf: 4,
	div_f: 5,
	add_f: 6, add_v: 7,
	sub_f: 8, sub_v: 9,
	eq_f: 10, eq_v: 11, eq_s: 12, eq_e: 13, eq_fnc: 14,
	ne_f: 15, ne_v: 16, ne_s: 17, ne_e: 18, ne_fnc: 19,
	le: 20, ge: 21, lt: 22, gt: 23,
	load_f: 24, load_v: 25, load_s: 26, load_ent: 27, load_fld: 28, load_fnc: 29,
	address: 30,
	store_f: 31, store_v: 32, store_s: 33, store_ent: 34, store_fld: 35, store_fnc: 36,
	storep_f: 37, storep_v: 38, storep_s: 39, storep_ent: 40, storep_fld: 41, storep_fnc: 42,
	ret: 43,
	not_f: 44, not_v: 45, not_s: 46, not_ent: 47, not_fnc: 48,
	jnz: 49, jz: 50,
	call0: 51, call1: 52, call2: 53, call3: 54, call4: 55, call5: 56, call6: 57, call7: 58, call8: 59,
	state: 60,
	jump: 61,
	and: 62, or: 63,
	bitand: 64, bitor: 65
};

PR.version = 6;

PR.globalvars = {
	self: 28, // edict
	other: 29, // edict
	world: 30, // edict
	time: 31, // float
	frametime: 32, // float
	force_retouch: 33, // float
	mapname: 34, // string
	deathmatch: 35, // float
	coop: 36, // float
	teamplay: 37, // float
	serverflags: 38, // float
	total_secrets: 39, // float
	total_monsters: 40, // float
	found_secrets: 41, // float
	killed_monsters: 42, // float
	parms: 43, // float[16]
	v_forward: 59, // vec3
	v_forward1: 60,
	v_forward2: 61,
	v_up: 62, // vec3
	v_up1: 63,
	v_up2: 64,
	v_right: 65, // vec3,
	v_right1: 66,
	v_right2: 67,
	trace_allsolid: 68, // float
	trace_startsolid: 69, // float
	trace_fraction: 70, // float
	trace_endpos: 71, // vec3
	trace_endpos1: 72,
	trace_endpos2: 73,
	trace_plane_normal: 74, // vec3
	trace_plane_normal1: 75,
	trace_plane_normal2: 76,
	trace_plane_dist: 77, // float
	trace_ent: 78, // edict
	trace_inopen: 79, // float
	trace_inwater: 80, // float
	msg_entity: 81, // edict
	main: 82, // func
	StartFrame: 83, // func
	PlayerPreThink: 84, // func
	PlayerPostThink: 85, // func
	ClientKill: 86, // func
	ClientConnect: 87, // func
	PutClientInServer: 88, // func
	ClientDisconnect: 89, // func
	SetNewParms: 90, // func
	SetChangeParms: 91 // func
};

PR.entvars = {
	modelindex: 0, // float
	absmin: 1, // vec3
	absmin1: 2,
	absmin2: 3,
	absmax: 4, // vec3
	absmax1: 5,
	absmax2: 6,
	ltime: 7, // float
	movetype: 8, // float
	solid: 9, // float
	origin: 10, // vec3
	origin1: 11,
	origin2: 12,
	oldorigin: 13, // vec3
	oldorigin1: 14,
	oldorigin2: 15,
	velocity: 16, // vec3
	velocity1: 17,
	velocity2: 18,
	angles: 19, // vec3
	angles1: 20,
	angles2: 21,
	avelocity: 22, // vec3
	avelocity1: 23,
	avelocity2: 24,
	punchangle: 25, // vec3
	punchangle1: 26,
	punchangle2: 27,
	classname: 28, // string
	model: 29, // string
	frame: 30, // float
	skin: 31, // float
	effects: 32, // float
	mins: 33, // vec3
	mins1: 34,
	mins2: 35,
	maxs: 36, // vec3
	maxs1: 37,
	maxs2: 38,
	size: 39, // vec3
	size1: 40,
	size2: 41,
	touch: 42, // func
	use: 43, // func
	think: 44, // func
	blocked: 45, // func
	nextthink: 46, // float
	groundentity: 47, // edict
	health: 48, // float
	frags: 49, // float
	weapon: 50, // float
	weaponmodel: 51, // string
	weaponframe: 52, // float
	currentammo: 53, // float
	ammo_shells: 54, // float
	ammo_nails: 55, // float
	ammo_rockets: 56, // float
	ammo_cells: 57, // float
	items: 58, // float
	takedamage: 59, // float
	chain: 60, // edict
	deadflag: 61, // float
	view_ofs: 62, // vec3
	view_ofs1: 63,
	view_ofs2: 64,
	button0: 65, // float
	button1: 66, // float
	button2: 67, // float
	impulse: 68, // float
	fixangle: 69, // float
	v_angle: 70, // vec3
	v_angle1: 71,
	v_angle2: 72,
	idealpitch: 73, // float
	netname: 74, // string
	enemy: 75, // edict
	flags: 76, // float
	colormap: 77, // float
	team: 78, // float
	max_health: 79, // float
	teleport_time: 80, // float
	armortype: 81, // float
	armorvalue: 82, // float
	waterlevel: 83, // float
	watertype: 84, // float
	ideal_yaw: 85, // float
	yaw_speed: 86, // float
	aiment: 87, // edict
	goalentity: 88, // edict
	spawnflags: 89, // float
	target: 90, // string
	targetname: 91, // string
	dmg_take: 92, // float
	dmg_save: 93, // float
	dmg_inflictor: 94, // edict
	owner: 95, // edict
	movedir: 96, // vec3
	movedir1: 97,
	movedir2: 98,
	message: 99, // string
	sounds: 100, // float
	noise: 101, // string
	noise1: 102, // string
	noise2: 103, // string
	noise3: 104 // string
};

PR.progheader_crc = 5927;

// cmds

PR.CheckEmptyString = function(s)
{
	var c = s.charCodeAt(0);
	if ((Q.isNaN(c) === true) || (c <= 32))
		PR.RunError('Bad string');
};

// edict

PR.ValueString = function(type, val, ofs)
{
	var val_float = new Float32Array(val);
	var val_int = new Int32Array(val);
	type &= 0x7fff;
	switch (type)
	{
	case PR.etype.ev_string:
		return PR.GetString(val_int[ofs]);
	case PR.etype.ev_entity:
		return 'entity ' + val_int[ofs];
	case PR.etype.ev_function:
		return PR.GetString(PR.functions[val_int[ofs]].name) + '()';
	case PR.etype.ev_field:
		var def = ED.FieldAtOfs(val_int[ofs]);
		if (def != null)
			return '.' + PR.GetString(def.name);
		return '.';
	case PR.etype.ev_void:
		return 'void';
	case PR.etype.ev_float:
		return val_float[ofs].toFixed(1);
	case PR.etype.ev_vector:
		return '\'' + val_float[ofs].toFixed(1) +
		' ' + val_float[ofs + 1].toFixed(1) +
		' ' + val_float[ofs + 2].toFixed(1) + '\'';
	case PR.etype.ev_pointer:
		return 'pointer';
	}
	return 'bad type ' + type;
};

PR.UglyValueString = function(type, val, ofs)
{
	var val_float = new Float32Array(val);
	var val_int = new Int32Array(val);
	type &= 0x7fff;
	switch (type)
	{
	case PR.etype.ev_string:
		return PR.GetString(val_int[ofs]);
	case PR.etype.ev_entity:
		return val_int[ofs].toString();
	case PR.etype.ev_function:
		return PR.GetString(PR.functions[val_int[ofs]].name);
	case PR.etype.ev_field:
		var def = ED.FieldAtOfs(val_int[ofs]);
		if (def != null)
			return PR.GetString(def.name);
		return '';
	case PR.etype.ev_void:
		return 'void';
	case PR.etype.ev_float:
		return val_float[ofs].toFixed(6);
	case PR.etype.ev_vector:
		return val_float[ofs].toFixed(6) +
		' ' + val_float[ofs + 1].toFixed(6) +
		' ' + val_float[ofs + 2].toFixed(6);
	}
	return 'bad type ' + type;
};

PR.GlobalString = function(ofs)
{
	var def = ED.GlobalAtOfs(ofs), line;
	if (def != null)
		line = ofs + '(' + PR.GetString(def.name) + ')' + PR.ValueString(def.type, PR.globals, ofs);
	else
		line = ofs + '(???)';
	for (; line.length <= 20; )
		line += ' ';
	return line;
};

PR.GlobalStringNoContents = function(ofs)
{
	var def = ED.GlobalAtOfs(ofs), line;
	if (def != null)
		line = ofs + '(' + PR.GetString(def.name) + ')';
	else
		line = ofs + '(???)';
	for (; line.length <= 20; )
		line += ' ';
	return line;
};

PR.LoadProgs = function()
{
	var progs = COM.LoadFile('progs.dat');
	if (progs == null)
		Sys.Error('PR.LoadProgs: couldn\'t load progs.dat');
	Con.DPrint('Programs occupy ' + (progs.byteLength >> 10) + 'K.\n');
	var view = new DataView(progs);

	var i = view.getUint32(0, true);
	if (i !== PR.version)
		Sys.Error('progs.dat has wrong version number (' + i + ' should be ' + PR.version + ')');
	if (view.getUint32(4, true) !== PR.progheader_crc)
		Sys.Error('progs.dat system vars have been modified, PR.js is out of date');

	PR.crc = CRC.Block(new Uint8Array(progs));

	PR.stack = [];
	PR.depth = 0;

	PR.localstack = [];
	for (i = 0; i < PR.localstack_size; ++i)
		PR.localstack[i] = 0;
	PR.localstack_used = 0;

	var ofs, num;

	ofs = view.getUint32(8, true);
	num = view.getUint32(12, true);
	PR.statements = [];
	for (i = 0; i < num; ++i)
	{
		PR.statements[i] = {
			op: view.getUint16(ofs, true),
			a: view.getInt16(ofs + 2, true),
			b: view.getInt16(ofs + 4, true),
			c: view.getInt16(ofs + 6, true)
		};
		ofs += 8;
	}

	ofs = view.getUint32(16, true);
	num = view.getUint32(20, true);
	PR.globaldefs = [];
	for (i = 0; i < num; ++i)
	{
		PR.globaldefs[i] = {
			type: view.getUint16(ofs, true),
			ofs: view.getUint16(ofs + 2, true),
			name: view.getUint32(ofs + 4, true)
		};
		ofs += 8;
	}

	ofs = view.getUint32(24, true);
	num = view.getUint32(28, true);
	PR.fielddefs = [];
	for (i = 0; i < num; ++i)
	{
		PR.fielddefs[i] = {
			type: view.getUint16(ofs, true),
			ofs: view.getUint16(ofs + 2, true),
			name: view.getUint32(ofs + 4, true)
		};
		ofs += 8;
	}

	ofs = view.getUint32(32, true);
	num = view.getUint32(36, true);
	PR.functions = [];
	for (i = 0; i < num; ++i)
	{
		PR.functions[i] = {
			first_statement: view.getInt32(ofs, true),
			parm_start: view.getUint32(ofs + 4, true),
			locals: view.getUint32(ofs + 8, true),
			profile: view.getUint32(ofs + 12, true),
			name: view.getUint32(ofs + 16, true),
			file: view.getUint32(ofs + 20, true),
			numparms: view.getUint32(ofs + 24, true),
			parm_size: [
				view.getUint8(ofs + 28), view.getUint8(ofs + 29),
				view.getUint8(ofs + 30), view.getUint8(ofs + 31),
				view.getUint8(ofs + 32), view.getUint8(ofs + 33),
				view.getUint8(ofs + 34), view.getUint8(ofs + 35)
			]
		};
		ofs += 36;
	}

	ofs = view.getUint32(40, true);
	num = view.getUint32(44, true);
	PR.strings = [];
	for (i = 0; i < num; ++i)
		PR.strings[i] = view.getUint8(ofs + i);
	PR.string_temp = PR.NewString('', 128);
	PR.netnames = PR.NewString('', SV.svs.maxclients << 5);

	ofs = view.getUint32(48, true);
	num = view.getUint32(52, true);
	PR.globals = new ArrayBuffer(num << 2);
	PR.globals_float = new Float32Array(PR.globals);
	PR.globals_int = new Int32Array(PR.globals);
	for (i = 0; i < num; ++i)
		PR.globals_int[i] = view.getInt32(ofs + (i << 2), true);

	PR.entityfields = view.getUint32(56, true);
	PR.edict_size = 96 + (PR.entityfields << 2);

	var fields = [
		'ammo_shells1',
		'ammo_nails1',
		'ammo_lava_nails',
		'ammo_rockets1',
		'ammo_multi_rockets',
		'ammo_cells1',
		'ammo_plasma',
		'gravity',
		'items2'
	], field, def;
	for (i = 0; i < fields.length; ++i)
	{
		field = fields[i];
		def = ED.FindField(field);
		PR.entvars[field] = (def != null) ? def.ofs : null;
	}
};

PR.Init = function()
{
	Cmd.AddCommand('edict', ED.PrintEdict_f);
	Cmd.AddCommand('edicts', ED.PrintEdicts);
	Cmd.AddCommand('edictcount', ED.Count);
	Cmd.AddCommand('profile', PR.Profile_f);
	Cvar.RegisterVariable('nomonsters', '0');
	Cvar.RegisterVariable('gamecfg', '0');
	Cvar.RegisterVariable('scratch1', '0');
	Cvar.RegisterVariable('scratch2', '0');
	Cvar.RegisterVariable('scratch3', '0');
	Cvar.RegisterVariable('scratch4', '0');
	Cvar.RegisterVariable('savedgamecfg', '0', true);
	Cvar.RegisterVariable('saved1', '0', true);
	Cvar.RegisterVariable('saved2', '0', true);
	Cvar.RegisterVariable('saved3', '0', true);
	Cvar.RegisterVariable('saved4', '0', true);
};

// exec

PR.localstack_size = 2048;

PR.opnames = [
	'DONE',
	'MUL_F', 'MUL_V', 'MUL_FV', 'MUL_VF',
	'DIV',
	'ADD_F', 'ADD_V',
	'SUB_F', 'SUB_V',
	'EQ_F', 'EQ_V', 'EQ_S', 'EQ_E', 'EQ_FNC',
	'NE_F', 'NE_V', 'NE_S', 'NE_E', 'NE_FNC',
	'LE', 'GE', 'LT', 'GT',
	'INDIRECT', 'INDIRECT', 'INDIRECT', 'INDIRECT', 'INDIRECT', 'INDIRECT',
	'ADDRESS',
	'STORE_F', 'STORE_V', 'STORE_S', 'STORE_ENT', 'STORE_FLD', 'STORE_FNC',
	'STOREP_F', 'STOREP_V', 'STOREP_S', 'STOREP_ENT', 'STOREP_FLD', 'STOREP_FNC',
	'RETURN',
	'NOT_F', 'NOT_V', 'NOT_S', 'NOT_ENT', 'NOT_FNC',
	'IF', 'IFNOT',
	'CALL0', 'CALL1', 'CALL2', 'CALL3', 'CALL4', 'CALL5', 'CALL6', 'CALL7', 'CALL8',
	'STATE',
	'GOTO',
	'AND', 'OR',
	'BITAND', 'BITOR'
];

PR.PrintStatement = function(s)
{
	var text;
	if (s.op < PR.opnames.length)
	{
		text = PR.opnames[s.op] + ' ';
		for (; text.length <= 9; )
			text += ' ';
	}
	else
		text = '';
	if ((s.op === PR.op.jnz) || (s.op === PR.op.jz))
		text += PR.GlobalString(s.a) + 'branch ' + s.b;
	else if (s.op === PR.op.jump)
		text += 'branch ' + s.a;
	else if ((s.op >= PR.op.store_f) && (s.op <= PR.op.store_fnc))
		text += PR.GlobalString(s.a) + PR.GlobalStringNoContents(s.b);
	else
	{
		if (s.a !== 0)
			text += PR.GlobalString(s.a);
		if (s.b !== 0)
			text += PR.GlobalString(s.b);
		if (s.c !== 0)
			text += PR.GlobalStringNoContents(s.c);
	}
	Con.Print(text + '\n');
};

PR.StackTrace = function()
{
	if (PR.depth === 0)
	{
		Con.Print('<NO STACK>\n');
		return;
	}
	PR.stack[PR.depth] = [PR.xstatement, PR.xfunction];
	var f, file;
	for (; PR.depth >= 0; --PR.depth)
	{
		f = PR.stack[PR.depth][1];
		if (f == null)
		{
			Con.Print('<NO FUNCTION>\n');
			continue;
		}
		file = PR.GetString(f.file);
		for (; file.length <= 11; )
			file += ' ';
		Con.Print(file + ' : ' + PR.GetString(f.name) + '\n');
	}
	PR.depth = 0;
};

PR.Profile_f = function()
{
	if (SV.server.active !== true)
		return;
	var num = 0, max, best, i, f, profile;
	for (;;)
	{
		max = 0;
		best = null;
		for (i = 0; i < PR.functions.length; ++i)
		{
			f = PR.functions[i];
			if (f.profile > max)
			{
				max = f.profile;
				best = f;
			}
		}
		if (best == null)
			return;
		if (num < 10)
		{
			profile = best.profile.toString();
			for (; profile.length <= 6; )
				profile = ' ' + profile;
			Con.Print(profile + ' ' + PR.GetString(best.name) + '\n');
		}
		++num;
		best.profile = 0;
	}
};

PR.RunError = function(error)
{
	PR.PrintStatement(PR.statements[PR.xstatement]);
	PR.StackTrace();
	Con.Print(error + '\n');
	Host.Error('Program error');
};

PR.EnterFunction = function(f)
{
	PR.stack[PR.depth++] = [PR.xstatement, PR.xfunction];
	var c = f.locals;
	if ((PR.localstack_used + c) > PR.localstack_size)
		PR.RunError('PR.EnterFunction: locals stack overflow\n');
	var i;
	for (i = 0; i < c; ++i)
		PR.localstack[PR.localstack_used + i] = PR.globals_int[f.parm_start + i];
	PR.localstack_used += c;
	var o = f.parm_start, j;
	for (i = 0; i < f.numparms; ++i)
	{
		for (j = 0; j < f.parm_size[i]; ++j)
			PR.globals_int[o++] = PR.globals_int[4 + i * 3 + j];
	}
	PR.xfunction = f;
	return f.first_statement - 1;
};

PR.LeaveFunction = function()
{
	if (PR.depth <= 0)
		Sys.Error('prog stack underflow');
	var c = PR.xfunction.locals;
	PR.localstack_used -= c;
	if (PR.localstack_used < 0)
		PR.RunError('PR.LeaveFunction: locals stack underflow\n');
	for (--c; c >= 0; --c)
		PR.globals_int[PR.xfunction.parm_start + c] = PR.localstack[PR.localstack_used + c];
	PR.xfunction = PR.stack[--PR.depth][1];
	return PR.stack[PR.depth][0];
};

PR.ExecuteProgram = function(fnum)
{
	if ((fnum === 0) || (fnum >= PR.functions.length))
	{
		if (PR.globals_int[PR.globalvars.self] !== 0)
			ED.Print(SV.server.edicts[PR.globals_int[PR.globalvars.self]]);
		Host.Error('PR.ExecuteProgram: NULL function');
	}
	var runaway = 100000;
	PR.trace = false;
	var exitdepth = PR.depth;
	var s = PR.EnterFunction(PR.functions[fnum]);
	var st, ed, ptr, newf;

	for (;;)
	{
		++s;
		st = PR.statements[s];
		if (--runaway === 0)
			PR.RunError('runaway loop error');
		++PR.xfunction.profile;
		PR.xstatement = s;
		if (PR.trace === true)
			PR.PrintStatement(st);
		switch (st.op)
		{
		case PR.op.add_f:
			PR.globals_float[st.c] = PR.globals_float[st.a] + PR.globals_float[st.b];
			continue;
		case PR.op.add_v:
			PR.globals_float[st.c] = PR.globals_float[st.a] + PR.globals_float[st.b];
			PR.globals_float[st.c + 1] = PR.globals_float[st.a + 1] + PR.globals_float[st.b + 1];
			PR.globals_float[st.c + 2] = PR.globals_float[st.a + 2] + PR.globals_float[st.b + 2];
			continue;
		case PR.op.sub_f:
			PR.globals_float[st.c] = PR.globals_float[st.a] - PR.globals_float[st.b];
			continue;
		case PR.op.sub_v:
			PR.globals_float[st.c] = PR.globals_float[st.a] - PR.globals_float[st.b];
			PR.globals_float[st.c + 1] = PR.globals_float[st.a + 1] - PR.globals_float[st.b + 1];
			PR.globals_float[st.c + 2] = PR.globals_float[st.a + 2] - PR.globals_float[st.b + 2];
			continue;
		case PR.op.mul_f:
			PR.globals_float[st.c] = PR.globals_float[st.a] * PR.globals_float[st.b];
			continue;
		case PR.op.mul_v:
			PR.globals_float[st.c] = PR.globals_float[st.a] * PR.globals_float[st.b] +
				PR.globals_float[st.a + 1] * PR.globals_float[st.b + 1] +
				PR.globals_float[st.a + 2] * PR.globals_float[st.b + 2];
			continue;
		case PR.op.mul_fv:
			PR.globals_float[st.c] = PR.globals_float[st.a] * PR.globals_float[st.b];
			PR.globals_float[st.c + 1] = PR.globals_float[st.a] * PR.globals_float[st.b + 1];
			PR.globals_float[st.c + 2] = PR.globals_float[st.a] * PR.globals_float[st.b + 2];
			continue;
		case PR.op.mul_vf:
			PR.globals_float[st.c] = PR.globals_float[st.b] * PR.globals_float[st.a];
			PR.globals_float[st.c + 1] = PR.globals_float[st.b] * PR.globals_float[st.a + 1];
			PR.globals_float[st.c + 2] = PR.globals_float[st.b] * PR.globals_float[st.a + 2];
			continue;
		case PR.op.div_f:
			PR.globals_float[st.c] = PR.globals_float[st.a] / PR.globals_float[st.b];
			continue;
		case PR.op.bitand:
			PR.globals_float[st.c] = PR.globals_float[st.a] & PR.globals_float[st.b];
			continue;
		case PR.op.bitor:
			PR.globals_float[st.c] = PR.globals_float[st.a] | PR.globals_float[st.b];
			continue;
		case PR.op.ge:
			PR.globals_float[st.c] = (PR.globals_float[st.a] >= PR.globals_float[st.b]) ? 1.0 : 0.0;
			continue;
		case PR.op.le:
			PR.globals_float[st.c] = (PR.globals_float[st.a] <= PR.globals_float[st.b]) ? 1.0 : 0.0;
			continue;
		case PR.op.gt:
			PR.globals_float[st.c] = (PR.globals_float[st.a] > PR.globals_float[st.b]) ? 1.0 : 0.0;
			continue;
		case PR.op.lt:
			PR.globals_float[st.c] = (PR.globals_float[st.a] < PR.globals_float[st.b]) ? 1.0 : 0.0;
			continue;
		case PR.op.and:
			PR.globals_float[st.c] = ((PR.globals_float[st.a] !== 0.0) && (PR.globals_float[st.b] !== 0.0)) ? 1.0 : 0.0;
			continue;
		case PR.op.or:
			PR.globals_float[st.c] = ((PR.globals_float[st.a] !== 0.0) || (PR.globals_float[st.b] !== 0.0)) ? 1.0 : 0.0;
			continue;
		case PR.op.not_f:
			PR.globals_float[st.c] = (PR.globals_float[st.a] === 0.0) ? 1.0 : 0.0;
			continue;
		case PR.op.not_v:
			PR.globals_float[st.c] = ((PR.globals_float[st.a] === 0.0) &&
				(PR.globals_float[st.a + 1] === 0.0) &&
				(PR.globals_float[st.a + 2] === 0.0)) ? 1.0 : 0.0;
			continue;
		case PR.op.not_s:
			if (PR.globals_int[st.a] !== 0)
				PR.globals_float[st.c] = (PR.strings[PR.globals_int[st.a]] === 0) ? 1.0 : 0.0;
			else
				PR.globals_float[st.c] = 1.0;
			continue;
		case PR.op.not_fnc:
		case PR.op.not_ent:
			PR.globals_float[st.c] = (PR.globals_int[st.a] === 0) ? 1.0 : 0.0;
			continue;
		case PR.op.eq_f:
			PR.globals_float[st.c] = (PR.globals_float[st.a] === PR.globals_float[st.b]) ? 1.0 : 0.0;
			continue;
		case PR.op.eq_v:
			PR.globals_float[st.c] = ((PR.globals_float[st.a] === PR.globals_float[st.b])
				&& (PR.globals_float[st.a + 1] === PR.globals_float[st.b + 1])
				&& (PR.globals_float[st.a + 2] === PR.globals_float[st.b + 2])) ? 1.0 : 0.0;
			continue;
		case PR.op.eq_s:
			PR.globals_float[st.c] = (PR.GetString(PR.globals_int[st.a]) === PR.GetString(PR.globals_int[st.b])) ? 1.0 : 0.0;
			continue;
		case PR.op.eq_e:
		case PR.op.eq_fnc:
			PR.globals_float[st.c] = (PR.globals_int[st.a] === PR.globals_int[st.b]) ? 1.0 : 0.0;
			continue;
		case PR.op.ne_f:
			PR.globals_float[st.c] = (PR.globals_float[st.a] !== PR.globals_float[st.b]) ? 1.0 : 0.0;
			continue;
		case PR.op.ne_v:
			PR.globals_float[st.c] = ((PR.globals_float[st.a] !== PR.globals_float[st.b])
				|| (PR.globals_float[st.a + 1] !== PR.globals_float[st.b + 1])
				|| (PR.globals_float[st.a + 2] !== PR.globals_float[st.b + 2])) ? 1.0 : 0.0;
			continue;
		case PR.op.ne_s:
			PR.globals_float[st.c] = (PR.GetString(PR.globals_int[st.a]) !== PR.GetString(PR.globals_int[st.b])) ? 1.0 : 0.0;
			continue;
		case PR.op.ne_e:
		case PR.op.ne_fnc:
			PR.globals_float[st.c] = (PR.globals_int[st.a] !== PR.globals_int[st.b]) ? 1.0 : 0.0;
			continue;
		case PR.op.store_f:
		case PR.op.store_ent:
		case PR.op.store_fld:
		case PR.op.store_s:
		case PR.op.store_fnc:
			PR.globals_int[st.b] = PR.globals_int[st.a];
			continue;
		case PR.op.store_v:
			PR.globals_int[st.b] = PR.globals_int[st.a];
			PR.globals_int[st.b + 1] = PR.globals_int[st.a + 1];
			PR.globals_int[st.b + 2] = PR.globals_int[st.a + 2];
			continue;
		case PR.op.storep_f:
		case PR.op.storep_ent:
		case PR.op.storep_fld:
		case PR.op.storep_s:
		case PR.op.storep_fnc:
			ptr = PR.globals_int[st.b];
			SV.server.edicts[Math.floor(ptr / PR.edict_size)].v_int[((ptr % PR.edict_size) - 96) >> 2] = PR.globals_int[st.a];
			continue;
		case PR.op.storep_v:
			ed = SV.server.edicts[Math.floor(PR.globals_int[st.b] / PR.edict_size)];
			ptr = ((PR.globals_int[st.b] % PR.edict_size) - 96) >> 2;
			ed.v_int[ptr] = PR.globals_int[st.a];
			ed.v_int[ptr + 1] = PR.globals_int[st.a + 1];
			ed.v_int[ptr + 2] = PR.globals_int[st.a + 2];
			continue;
		case PR.op.address:
			ed = PR.globals_int[st.a];
			if ((ed === 0) && (SV.server.loading !== true))
				PR.RunError('assignment to world entity');
			PR.globals_int[st.c] = ed * PR.edict_size + 96 + (PR.globals_int[st.b] << 2);
			continue;
		case PR.op.load_f:
		case PR.op.load_fld:
		case PR.op.load_ent:
		case PR.op.load_s:
		case PR.op.load_fnc:
			PR.globals_int[st.c] = SV.server.edicts[PR.globals_int[st.a]].v_int[PR.globals_int[st.b]];
			continue;
		case PR.op.load_v:
			ed = SV.server.edicts[PR.globals_int[st.a]];
			ptr = PR.globals_int[st.b];
			PR.globals_int[st.c] = ed.v_int[ptr];
			PR.globals_int[st.c + 1] = ed.v_int[ptr + 1];
			PR.globals_int[st.c + 2] = ed.v_int[ptr + 2];
			continue;
		case PR.op.jz:
			if (PR.globals_int[st.a] === 0)
				s += st.b - 1;
			continue;
		case PR.op.jnz:
			if (PR.globals_int[st.a] !== 0)
				s += st.b - 1;
			continue;
		case PR.op.jump:
			s += st.a - 1;
			continue;
		case PR.op.call0:
		case PR.op.call1:
		case PR.op.call2:
		case PR.op.call3:
		case PR.op.call4:
		case PR.op.call5:
		case PR.op.call6:
		case PR.op.call7:
		case PR.op.call8:
			PR.argc = st.op - PR.op.call0;
			if (PR.globals_int[st.a] === 0)
				PR.RunError('NULL function');
			newf = PR.functions[PR.globals_int[st.a]];
			if (newf.first_statement < 0)
			{
				ptr = -newf.first_statement;
				if (ptr >= PF.builtin.length)
					PR.RunError('Bad builtin call number');
				PF.builtin[ptr]();
				continue;
			}
			s = PR.EnterFunction(newf);
			continue;
		case PR.op.done:
		case PR.op.ret:
			PR.globals_int[1] = PR.globals_int[st.a];
			PR.globals_int[2] = PR.globals_int[st.a + 1];
			PR.globals_int[3] = PR.globals_int[st.a + 2];
			s = PR.LeaveFunction();
			if (PR.depth === exitdepth)
				return;
			continue;
		case PR.op.state:
			ed = SV.server.edicts[PR.globals_int[PR.globalvars.self]];
			ed.v_float[PR.entvars.nextthink] = PR.globals_float[PR.globalvars.time] + 0.1;
			ed.v_float[PR.entvars.frame] = PR.globals_float[st.a];
			ed.v_int[PR.entvars.think] = PR.globals_int[st.b];
			continue;
		}
		PR.RunError('Bad opcode ' + st.op);
	}
};

PR.GetString = function(num)
{
	var string = [], c;
	for (; num < PR.strings.length; ++num)
	{
		if (PR.strings[num] === 0)
			break;
		string[string.length] = String.fromCharCode(PR.strings[num]);
	}
	return string.join('');
};

PR.NewString = function(s, length)
{
	var ofs = PR.strings.length;
	var i;
	if (s.length >= length)
	{
		for (i = 0; i < (length - 1); ++i)
			PR.strings[PR.strings.length] = s.charCodeAt(i);
		PR.strings[PR.strings.length] = 0;
		return ofs;
	}
	for (i = 0; i < s.length; ++i)
		PR.strings[PR.strings.length] = s.charCodeAt(i);
	length -= s.length;
	for (i = 0; i < length; ++i)
		PR.strings[PR.strings.length] = 0;
	return ofs;
};

PR.TempString = function(string)
{
	var i;
	if (string.length > 127)
		string = string.substring(0, 127);
	for (i = 0; i < string.length; ++i)
		PR.strings[PR.string_temp + i] = string.charCodeAt(i);
	PR.strings[PR.string_temp + string.length] = 0;
};

// ---- WebQuake/Protocol.js ----
Protocol = {};

Protocol.version = 15;

Protocol.u = {
	morebits: 1,
	origin1: 1 << 1,
	origin2: 1 << 2,
	origin3: 1 << 3,
	angle2: 1 << 4,
	nolerp: 1 << 5,
	frame: 1 << 6,
	signal: 1 << 7,

	angle1: 1 << 8,
	angle3: 1 << 9,
	model: 1 << 10,
	colormap: 1 << 11,
	skin: 1 << 12,
	effects: 1 << 13,
	longentity: 1 << 14
};

Protocol.su = {
	viewheight: 1,
	idealpitch: 1 << 1,
	punch1: 1 << 2,
	punch2: 1 << 3,
	punch3: 1 << 4,
	velocity1: 1 << 5,
	velocity2: 1 << 6,
	velocity3: 1 << 7,
	items: 1 << 9,
	onground: 1 << 10,
	inwater: 1 << 11,
	weaponframe: 1 << 12,
	armor: 1 << 13,
	weapon: 1 << 14
};

Protocol.default_viewheight = 22;

Protocol.svc = {
	nop: 1,
	disconnect: 2,
	updatestat: 3,
	version: 4,
	setview: 5,
	sound: 6,
	time: 7,
	print: 8,
	stufftext: 9,
	setangle: 10,
	serverinfo: 11,
	lightstyle: 12,
	updatename: 13,
	updatefrags: 14,
	clientdata: 15,
	stopsound: 16,
	updatecolors: 17,
	particle: 18,
	damage: 19,
	spawnstatic: 20,
	spawnbaseline: 22,
	temp_entity: 23,
	setpause: 24,
	signonnum: 25,
	centerprint: 26,
	killedmonster: 27,
	foundsecret: 28,
	spawnstaticsound: 29,
	intermission: 30,
	finale: 31,
	cdtrack: 32,
	sellscreen: 33,
	cutscene: 34
};

Protocol.clc = {
	nop: 1,
	disconnect: 2,
	move: 3,
	stringcmd: 4
};

Protocol.te = {
	spike: 0,
	superspike: 1,
	gunshot: 2,
	explosion: 3,
	tarexplosion: 4,
	lightning1: 5,
	lightning2: 6,
	wizspike: 7,
	knightspike: 8,
	lightning3: 9,
	lavasplash: 10,
	teleport: 11,
	explosion2: 12,
	beam: 13
};

// ---- WebQuake/Q.js ----
Q = {};

Q.memstr = function(src)
{
	var dest = [], i;
	for (i = 0; i < src.length; ++i)
	{
		if (src[i] === 0)
			break;
		dest[i] = String.fromCharCode(src[i]);
	}
	return dest.join('');
};

Q.strmem = function(src)
{
	var buf = new ArrayBuffer(src.length);
	var dest = new Uint8Array(buf);
	var i;
	for (i = 0; i < src.length; ++i)
		dest[i] = src.charCodeAt(i) & 255;
	return buf;
};

Q.atoi = function(str)
{
	if (str == null)
		return 0;
	var ptr, val = 0, sign, c, c2;
	if (str.charCodeAt(0) === 45)
	{
		sign = -1;
		ptr = 1;
	}
	else
	{
		sign = 1;
		ptr = 0;
	}
	c = str.charCodeAt(ptr);
	c2 = str.charCodeAt(ptr + 1);
	if ((c === 48) && ((c2 === 120) || (c2 === 88)))
	{
		ptr += 2;
		for (;;)
		{
			c = str.charCodeAt(ptr++);
			if ((c >= 48) && (c <= 57))
				val = (val << 4) + c - 48;
			else if ((c >= 97) && (c <= 102))
				val = (val << 4) + c - 87;
			else if ((c >= 65) && (c <= 70))
				val = (val << 4) + c - 55;
			else
				return val * sign;
		}
	}
	if (c === 39)
	{
		if (Q.isNaN(c2) === true)
			return 0;
		return sign * c2;
	}
	for (;;)
	{
		c = str.charCodeAt(ptr++);
		if ((Q.isNaN(c) === true) || (c <= 47) || (c >= 58))
			return val * sign;
		val = val * 10 + c - 48;
	}
	return 0;
};

Q.atof = function(str)
{
	if (str == null)
		return 0.0;
	var ptr, val, sign, c, c2;
	if (str.charCodeAt(0) === 45)
	{
		sign = -1.0;
		ptr = 1;
	}
	else
	{
		sign = 1.0;
		ptr = 0;
	}
	c = str.charCodeAt(ptr);
	c2 = str.charCodeAt(ptr + 1);
	if ((c === 48) && ((c2 === 120) || (c2 === 88)))
	{
		ptr += 2;
		val = 0.0;
		for (;;)
		{
			c = str.charCodeAt(ptr++);
			if ((c >= 48) && (c <= 57))
				val = (val * 16.0) + c - 48;
			else if ((c >= 97) && (c <= 102))
				val = (val * 16.0) + c - 87;
			else if ((c >= 65) && (c <= 70))
				val = (val * 16.0) + c - 55;
			else
				return val * sign;
		}
	}
	if (c === 39)
	{
		if (Q.isNaN(c2) === true)
			return 0.0;
		return sign * c2;
	}
	val = parseFloat(str);
	if (Q.isNaN(val) === true)
		return 0.0;
	return val;
};

Q.btoa = function(src)
{
	var str = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	var val = [];
	var len = src.length - (src.length % 3);
	var c, i;
	for (i = 0; i < len; i += 3)
	{
		c = (src[i] << 16) + (src[i + 1] << 8) + src[i + 2];
		val[val.length] = str.charAt(c >> 18) + str.charAt((c >> 12) & 63) + str.charAt((c >> 6) & 63) + str.charAt(c & 63);
	}
	if ((src.length - len) === 1)
	{
		c = src[len];
		val[val.length] = str.charAt(c >> 2) + str.charAt((c & 3) << 4) + '==';
	}
	else if ((src.length - len) === 2)
	{
		c = (src[len] << 8) + src[len + 1];
		val[val.length] = str.charAt(c >> 10) + str.charAt((c >> 4) & 63) + str.charAt((c & 15) << 2) + '=';
	}
	return val.join('');
};

// ---- WebQuake/R.js ----
R = {};

// efrag

R.SplitEntityOnNode = function(node)
{
	if (node.contents === Mod.contents.solid)
		return;
	if (node.contents < 0)
	{
		R.currententity.leafs[R.currententity.leafs.length] = node.num - 1;
		return;
	}
	var sides = Vec.BoxOnPlaneSide(R.emins, R.emaxs, node.plane);
	if ((sides & 1) !== 0)
		R.SplitEntityOnNode(node.children[0]);
	if ((sides & 2) !== 0)
		R.SplitEntityOnNode(node.children[1]);
};

// light

R.dlightframecount = 0;

R.lightstylevalue = new Uint8Array(new ArrayBuffer(64));

R.AnimateLight = function()
{
	var j;
	if (R.fullbright.value === 0)
	{
		var i = Math.floor(CL.state.time * 10.0);
		for (j = 0; j < 64; ++j)
		{
			if (CL.lightstyle[j].length === 0)
			{
				R.lightstylevalue[j] = 12;
				continue;
			}
			R.lightstylevalue[j] = CL.lightstyle[j].charCodeAt(i % CL.lightstyle[j].length) - 97;
		}
	}
	else
	{
		for (j = 0; j < 64; ++j)
			R.lightstylevalue[j] = 12;
	}
	GL.Bind(0, R.lightstyle_texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, 64, 1, 0, gl.ALPHA, gl.UNSIGNED_BYTE, R.lightstylevalue);
};

R.RenderDlights = function()
{
	if (R.flashblend.value === 0)
		return;
	++R.dlightframecount;
	gl.enable(gl.BLEND);
	var program = GL.UseProgram('Dlight'), l, a;
	gl.bindBuffer(gl.ARRAY_BUFFER, R.dlightvecs);
	gl.vertexAttribPointer(program.aPosition.location, 3, gl.FLOAT, false, 0, 0);
	for (i = 0; i <= 31; ++i)
	{
		l = CL.dlights[i];
		if ((l.die < CL.state.time) || (l.radius === 0.0))
			continue;
		if (Vec.Length([l.origin[0] - R.refdef.vieworg[0], l.origin[1] - R.refdef.vieworg[1], l.origin[2] - R.refdef.vieworg[2]]) < (l.radius * 0.35))
		{
			a = l.radius * 0.0003;
			V.blend[3] += a * (1.0 - V.blend[3]);
			a /= V.blend[3];
			V.blend[0] = V.blend[1] * (1.0 - a) + (255.0 * a);
			V.blend[1] = V.blend[1] * (1.0 - a) + (127.5 * a);
			V.blend[2] *= 1.0 - a;
			continue;
		}
		gl.uniform3fv(program.uOrigin, l.origin);
		gl.uniform1f(program.uRadius, l.radius);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, 18);
	}
	gl.disable(gl.BLEND);
};

R.MarkLights = function(light, bit, node)
{
	if (node.contents < 0)
		return;
	var normal = node.plane.normal;
	var dist = light.origin[0] * normal[0] + light.origin[1] * normal[1] + light.origin[2] * normal[2] - node.plane.dist;
	if (dist > light.radius)
	{
		R.MarkLights(light, bit, node.children[0]);
		return;
	}
	if (dist < -light.radius)
	{
		R.MarkLights(light, bit, node.children[1]);
		return;
	}
	var i, surf;
	for (i = 0; i < node.numfaces; ++i)
	{
		surf = CL.state.worldmodel.faces[node.firstface + i];
		if ((surf.sky === true) || (surf.turbulent === true))
			continue;
		if (surf.dlightframe !== (R.dlightframecount + 1))
		{
			surf.dlightbits = 0;
			surf.dlightframe = R.dlightframecount + 1;
		}
		surf.dlightbits += bit;
	}
	R.MarkLights(light, bit, node.children[0]);
	R.MarkLights(light, bit, node.children[1]);
};

R.PushDlights = function()
{
	if (R.flashblend.value !== 0)
		return;
	var i;
	for (i = 0; i <= 1023; ++i)
		R.lightmap_modified[i] = false;

	var l, bit = 1, j, ent;
	for (i = 0; i <= 31; ++i)
	{
		l = CL.dlights[i];
		if ((l.die >= CL.state.time) && (l.radius !== 0.0))
		{
			R.MarkLights(l, bit, CL.state.worldmodel.nodes[0]);
			for (j = 0; j < CL.numvisedicts; ++j)
			{
				ent = CL.visedicts[j];
				if (ent.model == null)
					continue;
				if ((ent.model.type !== Mod.type.brush) || (ent.model.submodel !== true))
					continue;
				R.MarkLights(l, bit, CL.state.worldmodel.nodes[ent.model.hulls[0].firstclipnode]);
			}
		}
		bit += bit;
	}

	var surf;
	for (i = 0; i < CL.state.worldmodel.faces.length; ++i)
	{
		surf = CL.state.worldmodel.faces[i];
		if (surf.dlightframe === R.dlightframecount)
			R.RemoveDynamicLights(surf);
		else if (surf.dlightframe === (R.dlightframecount + 1))
			R.AddDynamicLights(surf);
	}

	GL.Bind(0, R.dlightmap_texture);
	for (i = 0; i <= 1023; ++i)
	{
		if (R.lightmap_modified[i] !== true)
			continue;
		for (j = 1023; j >= i; --j)
		{
			if (R.lightmap_modified[j] !== true)
				continue;
			gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, i, 1024, j - i + 1, gl.ALPHA, gl.UNSIGNED_BYTE,
				R.dlightmaps.subarray(i << 10, (j + 1) << 10));
			break;
		}
		break;
	}

	++R.dlightframecount;
};

R.RecursiveLightPoint = function(node, start, end)
{
	if (node.contents < 0)
		return -1;

	var normal = node.plane.normal;
	var front = start[0] * normal[0] + start[1] * normal[1] + start[2] * normal[2] - node.plane.dist;
	var back = end[0] * normal[0] + end[1] * normal[1] + end[2] * normal[2] - node.plane.dist;
	var side = front < 0;

	if ((back < 0) === side)
		return R.RecursiveLightPoint(node.children[side === true ? 1 : 0], start, end);

	var frac = front / (front - back);
	var mid = [
		start[0] + (end[0] - start[0]) * frac,
		start[1] + (end[1] - start[1]) * frac,
		start[2] + (end[2] - start[2]) * frac
	];

	var r = R.RecursiveLightPoint(node.children[side === true ? 1 : 0], start, mid);
	if (r >= 0)
		return r;

	if ((back < 0) === side)
		return -1;

	var i, surf, tex, s, t, ds, dt, lightmap, size, maps;
	for (i = 0; i < node.numfaces; ++i)
	{
		surf = CL.state.worldmodel.faces[node.firstface + i];
		if ((surf.sky === true) || (surf.turbulent === true))
			continue;

		tex = CL.state.worldmodel.texinfo[surf.texinfo];

		s = Vec.DotProduct(mid, tex.vecs[0]) + tex.vecs[0][3];
		t = Vec.DotProduct(mid, tex.vecs[1]) + tex.vecs[1][3];
		if ((s < surf.texturemins[0]) || (t < surf.texturemins[1]))
			continue;

		ds = s - surf.texturemins[0];
		dt = t - surf.texturemins[1];
		if ((ds > surf.extents[0]) || (dt > surf.extents[1]))
			continue;

		if (surf.lightofs === 0)
			return 0;

		ds >>= 4;
		dt >>= 4;

		lightmap = surf.lightofs;
		if (lightmap === 0)
			return 0;

		lightmap += dt * ((surf.extents[0] >> 4) + 1) + ds;
		r = 0;
		size = ((surf.extents[0] >> 4) + 1) * ((surf.extents[1] >> 4) + 1);
		for (maps = 0; maps < surf.styles.length; ++maps)
		{
			r += CL.state.worldmodel.lightdata[lightmap] * R.lightstylevalue[surf.styles[maps]] * 22;
			lightmap += size;
		}
		return r >> 8;
	}
	return R.RecursiveLightPoint(node.children[side !== true ? 1 : 0], mid, end);
};

R.LightPoint = function(p)
{
	if (CL.state.worldmodel.lightdata == null)
		return 255;
	var r = R.RecursiveLightPoint(CL.state.worldmodel.nodes[0], p, [p[0], p[1], p[2] - 2048.0]);
	if (r === -1)
		return 0;
	return r;
};

// main

R.visframecount = 0;

R.frustum = [{}, {}, {}, {}];

R.vup = [];
R.vpn = [];
R.vright = [];

R.refdef = {
	vrect: {},
	vieworg: [0.0, 0.0, 0.0],
	viewangles: [0.0, 0.0, 0.0]
};

R.CullBox = function(mins, maxs)
{
	if (Vec.BoxOnPlaneSide(mins, maxs, R.frustum[0]) === 2)
		return true;
	if (Vec.BoxOnPlaneSide(mins, maxs, R.frustum[1]) === 2)
		return true;
	if (Vec.BoxOnPlaneSide(mins, maxs, R.frustum[2]) === 2)
		return true;
	if (Vec.BoxOnPlaneSide(mins, maxs, R.frustum[3]) === 2)
		return true;
};

R.DrawSpriteModel = function(e)
{
	var program = GL.UseProgram('Sprite', true);
	var num = e.frame;
	if ((num >= e.model.numframes) || (num < 0))
	{
		Con.DPrint('R.DrawSpriteModel: no such frame ' + num + '\n');
		num = 0;
	}
	var frame = e.model.frames[num];
	if (frame.group === true)
	{
		var fullinterval, targettime, i, time = CL.state.time + e.syncbase;
		num = frame.frames.length - 1;
		fullinterval = frame.frames[num].interval;
		targettime = time - Math.floor(time / fullinterval) * fullinterval;
		for (i = 0; i < num; ++i)
		{
			if (frame.frames[i].interval > targettime)
				break;
		}
		frame = frame.frames[i];
	}

	GL.Bind(program.tTexture, frame.texturenum, true);

	if (e.model.oriented === true)
	{
		r = [];
		u = [];
		Vec.AngleVectors(e.angles, null, r, u);
	}
	else
	{
		r = R.vright;
		u = R.vup;
	}
	var p = e.origin;
	var x1 = frame.origin[0], y1 = frame.origin[1], x2 = x1 + frame.width, y2 = y1 + frame.height;

	GL.StreamGetSpace(6);
	GL.StreamWriteFloat3(
		p[0] + x1 * r[0] + y1 * u[0],
		p[1] + x1 * r[1] + y1 * u[1],
		p[2] + x1 * r[2] + y1 * u[2]);
	GL.StreamWriteFloat2(0.0, 1.0);
	GL.StreamWriteFloat3(
		p[0] + x1 * r[0] + y2 * u[0],
		p[1] + x1 * r[1] + y2 * u[1],
		p[2] + x1 * r[2] + y2 * u[2]);
	GL.StreamWriteFloat2(0.0, 0.0);
	GL.StreamWriteFloat3(
		p[0] + x2 * r[0] + y1 * u[0],
		p[1] + x2 * r[1] + y1 * u[1],
		p[2] + x2 * r[2] + y1 * u[2]);
	GL.StreamWriteFloat2(1.0, 1.0);
	GL.StreamWriteFloat3(
		p[0] + x2 * r[0] + y1 * u[0],
		p[1] + x2 * r[1] + y1 * u[1],
		p[2] + x2 * r[2] + y1 * u[2]);
	GL.StreamWriteFloat2(1.0, 1.0);
	GL.StreamWriteFloat3(
		p[0] + x1 * r[0] + y2 * u[0],
		p[1] + x1 * r[1] + y2 * u[1],
		p[2] + x1 * r[2] + y2 * u[2]);
	GL.StreamWriteFloat2(0.0, 0.0);
	GL.StreamWriteFloat3(
		p[0] + x2 * r[0] + y2 * u[0],
		p[1] + x2 * r[1] + y2 * u[1],
		p[2] + x2 * r[2] + y2 * u[2]);
	GL.StreamWriteFloat2(1.0, 0.0);
};

R.avertexnormals = [
	[-0.525731, 0.0, 0.850651],
	[-0.442863, 0.238856, 0.864188],
	[-0.295242, 0.0, 0.955423],
	[-0.309017, 0.5, 0.809017],
	[-0.16246, 0.262866, 0.951056],
	[0.0, 0.0, 1.0],
	[0.0, 0.850651, 0.525731],
	[-0.147621, 0.716567, 0.681718],
	[0.147621, 0.716567, 0.681718],
	[0.0, 0.525731, 0.850651],
	[0.309017, 0.5, 0.809017],
	[0.525731, 0.0, 0.850651],
	[0.295242, 0.0, 0.955423],
	[0.442863, 0.238856, 0.864188],
	[0.16246, 0.262866, 0.951056],
	[-0.681718, 0.147621, 0.716567],
	[-0.809017, 0.309017, 0.5],
	[-0.587785, 0.425325, 0.688191],
	[-0.850651, 0.525731, 0.0],
	[-0.864188, 0.442863, 0.238856],
	[-0.716567, 0.681718, 0.147621],
	[-0.688191, 0.587785, 0.425325],
	[-0.5, 0.809017, 0.309017],
	[-0.238856, 0.864188, 0.442863],
	[-0.425325, 0.688191, 0.587785],
	[-0.716567, 0.681718, -0.147621],
	[-0.5, 0.809017, -0.309017],
	[-0.525731, 0.850651, 0.0],
	[0.0, 0.850651, -0.525731],
	[-0.238856, 0.864188, -0.442863],
	[0.0, 0.955423, -0.295242],
	[-0.262866, 0.951056, -0.16246],
	[0.0, 1.0, 0.0],
	[0.0, 0.955423, 0.295242],
	[-0.262866, 0.951056, 0.16246],
	[0.238856, 0.864188, 0.442863],
	[0.262866, 0.951056, 0.16246],
	[0.5, 0.809017, 0.309017],
	[0.238856, 0.864188, -0.442863],
	[0.262866, 0.951056, -0.16246],
	[0.5, 0.809017, -0.309017],
	[0.850651, 0.525731, 0.0],
	[0.716567, 0.681718, 0.147621],
	[0.716567, 0.681718, -0.147621],
	[0.525731, 0.850651, 0.0],
	[0.425325, 0.688191, 0.587785],
	[0.864188, 0.442863, 0.238856],
	[0.688191, 0.587785, 0.425325],
	[0.809017, 0.309017, 0.5],
	[0.681718, 0.147621, 0.716567],
	[0.587785, 0.425325, 0.688191],
	[0.955423, 0.295242, 0.0],
	[1.0, 0.0, 0.0],
	[0.951056, 0.16246, 0.262866],
	[0.850651, -0.525731, 0.0],
	[0.955423, -0.295242, 0.0],
	[0.864188, -0.442863, 0.238856],
	[0.951056, -0.16246, 0.262866],
	[0.809017, -0.309017, 0.5],
	[0.681718, -0.147621, 0.716567],
	[0.850651, 0.0, 0.525731],
	[0.864188, 0.442863, -0.238856],
	[0.809017, 0.309017, -0.5],
	[0.951056, 0.16246, -0.262866],
	[0.525731, 0.0, -0.850651],
	[0.681718, 0.147621, -0.716567],
	[0.681718, -0.147621, -0.716567],
	[0.850651, 0.0, -0.525731],
	[0.809017, -0.309017, -0.5],
	[0.864188, -0.442863, -0.238856],
	[0.951056, -0.16246, -0.262866],
	[0.147621, 0.716567, -0.681718],
	[0.309017, 0.5, -0.809017],
	[0.425325, 0.688191, -0.587785],
	[0.442863, 0.238856, -0.864188],
	[0.587785, 0.425325, -0.688191],
	[0.688191, 0.587785, -0.425325],
	[-0.147621, 0.716567, -0.681718],
	[-0.309017, 0.5, -0.809017],
	[0.0, 0.525731, -0.850651],
	[-0.525731, 0.0, -0.850651],
	[-0.442863, 0.238856, -0.864188],
	[-0.295242, 0.0, -0.955423],
	[-0.16246, 0.262866, -0.951056],
	[0.0, 0.0, -1.0],
	[0.295242, 0.0, -0.955423],
	[0.16246, 0.262866, -0.951056],
	[-0.442863, -0.238856, -0.864188],
	[-0.309017, -0.5, -0.809017],
	[-0.16246, -0.262866, -0.951056],
	[0.0, -0.850651, -0.525731],
	[-0.147621, -0.716567, -0.681718],
	[0.147621, -0.716567, -0.681718],
	[0.0, -0.525731, -0.850651],
	[0.309017, -0.5, -0.809017],
	[0.442863, -0.238856, -0.864188],
	[0.16246, -0.262866, -0.951056],
	[0.238856, -0.864188, -0.442863],
	[0.5, -0.809017, -0.309017],
	[0.425325, -0.688191, -0.587785],
	[0.716567, -0.681718, -0.147621],
	[0.688191, -0.587785, -0.425325],
	[0.587785, -0.425325, -0.688191],
	[0.0, -0.955423, -0.295242],
	[0.0, -1.0, 0.0],
	[0.262866, -0.951056, -0.16246],
	[0.0, -0.850651, 0.525731],
	[0.0, -0.955423, 0.295242],
	[0.238856, -0.864188, 0.442863],
	[0.262866, -0.951056, 0.16246],
	[0.5, -0.809017, 0.309017],
	[0.716567, -0.681718, 0.147621],
	[0.525731, -0.850651, 0.0],
	[-0.238856, -0.864188, -0.442863],
	[-0.5, -0.809017, -0.309017],
	[-0.262866, -0.951056, -0.16246],
	[-0.850651, -0.525731, 0.0],
	[-0.716567, -0.681718, -0.147621],
	[-0.716567, -0.681718, 0.147621],
	[-0.525731, -0.850651, 0.0],
	[-0.5, -0.809017, 0.309017],
	[-0.238856, -0.864188, 0.442863],
	[-0.262866, -0.951056, 0.16246],
	[-0.864188, -0.442863, 0.238856],
	[-0.809017, -0.309017, 0.5],
	[-0.688191, -0.587785, 0.425325],
	[-0.681718, -0.147621, 0.716567],
	[-0.442863, -0.238856, 0.864188],
	[-0.587785, -0.425325, 0.688191],
	[-0.309017, -0.5, 0.809017],
	[-0.147621, -0.716567, 0.681718],
	[-0.425325, -0.688191, 0.587785],
	[-0.16246, -0.262866, 0.951056],
	[0.442863, -0.238856, 0.864188],
	[0.16246, -0.262866, 0.951056],
	[0.309017, -0.5, 0.809017],
	[0.147621, -0.716567, 0.681718],
	[0.0, -0.525731, 0.850651],
	[0.425325, -0.688191, 0.587785],
	[0.587785, -0.425325, 0.688191],
	[0.688191, -0.587785, 0.425325],
	[-0.955423, 0.295242, 0.0],
	[-0.951056, 0.16246, 0.262866],
	[-1.0, 0.0, 0.0],
	[-0.850651, 0.0, 0.525731],
	[-0.955423, -0.295242, 0.0],
	[-0.951056, -0.16246, 0.262866],
	[-0.864188, 0.442863, -0.238856],
	[-0.951056, 0.16246, -0.262866],
	[-0.809017, 0.309017, -0.5],
	[-0.864188, -0.442863, -0.238856],
	[-0.951056, -0.16246, -0.262866],
	[-0.809017, -0.309017, -0.5],
	[-0.681718, 0.147621, -0.716567],
	[-0.681718, -0.147621, -0.716567],
	[-0.850651, 0.0, -0.525731],
	[-0.688191, 0.587785, -0.425325],
	[-0.587785, 0.425325, -0.688191],
	[-0.425325, 0.688191, -0.587785],
	[-0.425325, -0.688191, -0.587785],
	[-0.587785, -0.425325, -0.688191],
	[-0.688191, -0.587785, -0.425325]
];

R.DrawAliasModel = function(e)
{
	var clmodel = e.model;

	if (R.CullBox(
		[
			e.origin[0] - clmodel.boundingradius,
			e.origin[1] - clmodel.boundingradius,
			e.origin[2] - clmodel.boundingradius
		],
		[
			e.origin[0] + clmodel.boundingradius,
			e.origin[1] + clmodel.boundingradius,
			e.origin[2] + clmodel.boundingradius
		]) === true)
		return;

	var program;
	if ((e.colormap !== 0) && (clmodel.player === true) && (R.nocolors.value === 0))
	{
		program = GL.UseProgram('Player');
		var top = (CL.state.scores[e.colormap - 1].colors & 0xf0) + 4;
		var bottom = ((CL.state.scores[e.colormap - 1].colors & 0xf) << 4) + 4;
		if (top <= 127)
			top += 7;
		if (bottom <= 127)
			bottom += 7;
		top = VID.d_8to24table[top];
		bottom = VID.d_8to24table[bottom];
		gl.uniform3f(program.uTop, top & 0xff, (top >> 8) & 0xff, top >> 16);
		gl.uniform3f(program.uBottom, bottom & 0xff, (bottom >> 8) & 0xff, bottom >> 16);
	}
	else
		program = GL.UseProgram('Alias');
	gl.uniform3fv(program.uOrigin, e.origin);
	gl.uniformMatrix3fv(program.uAngles, false, GL.RotationMatrix(e.angles[0], e.angles[1], e.angles[2]));

	var ambientlight = R.LightPoint(e.origin);
	var shadelight = ambientlight;
	if ((e === CL.state.viewent) && (ambientlight < 24.0))
		ambientlight = shadelight = 24.0;
	var i, dl, add;
	for (i = 0; i <= 31; ++i)
	{
		dl = CL.dlights[i];
		if (dl.die < CL.state.time)
			continue;
		add = dl.radius - Vec.Length([e.origin[0] - dl.origin[0], e.origin[1] - dl.origin[1], e.origin[1] - dl.origin[1]]);
		if (add > 0.0)
		{
			ambientlight += add;
			shadelight += add;
		}
	}
	if (ambientlight > 128.0)
		ambientlight = 128.0;
	if ((ambientlight + shadelight) > 192.0)
		shadelight = 192.0 - ambientlight;
	if ((e.num >= 1) && (e.num <= CL.state.maxclients) && (ambientlight < 8.0))
		ambientlight = shadelight = 8.0;
	gl.uniform1f(program.uAmbientLight, ambientlight * 0.0078125);
	gl.uniform1f(program.uShadeLight, shadelight * 0.0078125);

	var forward = [], right = [], up = [];
	Vec.AngleVectors(e.angles, forward, right, up);
	gl.uniform3fv(program.uLightVec, [
		Vec.DotProduct([-1.0, 0.0, 0.0], forward),
		-Vec.DotProduct([-1.0, 0.0, 0.0], right),
		Vec.DotProduct([-1.0, 0.0, 0.0], up)
	]);

	R.c_alias_polys += clmodel.numtris;

	var num, fullinterval, targettime, i;
	var time = CL.state.time + e.syncbase;
	num = e.frame;
	if ((num >= clmodel.numframes) || (num < 0))
	{
		Con.DPrint('R.DrawAliasModel: no such frame ' + num + '\n');
		num = 0;
	}
	var frame = clmodel.frames[num];
	if (frame.group === true)
	{	
		num = frame.frames.length - 1;
		fullinterval = frame.frames[num].interval;
		targettime = time - Math.floor(time / fullinterval) * fullinterval;
		for (i = 0; i < num; ++i)
		{
			if (frame.frames[i].interval > targettime)
				break;
		}
		frame = frame.frames[i];
	}
	gl.bindBuffer(gl.ARRAY_BUFFER, clmodel.cmds);
	gl.vertexAttribPointer(program.aPosition.location, 3, gl.FLOAT, false, 24, frame.cmdofs);
	gl.vertexAttribPointer(program.aNormal.location, 3, gl.FLOAT, false, 24, frame.cmdofs + 12);
	gl.vertexAttribPointer(program.aTexCoord.location, 2, gl.FLOAT, false, 0, 0);

	num = e.skinnum;
	if ((num >= clmodel.numskins) || (num < 0))
	{
		Con.DPrint('R.DrawAliasModel: no such skin # ' + num + '\n');
		num = 0;
	}
	var skin = clmodel.skins[num];
	if (skin.group === true)
	{	
		num = skin.skins.length - 1;
		fullinterval = skin.skins[num].interval;
		targettime = time - Math.floor(time / fullinterval) * fullinterval;
		for (i = 0; i < num; ++i)
		{
			if (skin.skins[i].interval > targettime)
				break;
		}
		skin = skin.skins[i];
	}
	GL.Bind(program.tTexture, skin.texturenum.texnum);
	if (clmodel.player === true)
		GL.Bind(program.tPlayer, skin.playertexture);

	gl.drawArrays(gl.TRIANGLES, 0, clmodel.numtris * 3);
};

R.DrawEntitiesOnList = function()
{
	if (R.drawentities.value === 0)
		return;
	var vis = (R.novis.value !== 0) ? Mod.novis : Mod.LeafPVS(R.viewleaf, CL.state.worldmodel);
	var i, j, leaf;
	for (i = 0; i < CL.state.num_statics; ++i)
	{
		R.currententity = CL.static_entities[i];
		if (R.currententity.model == null)
			continue;
		for (j = 0; j < R.currententity.leafs.length; ++j)
		{
			leaf = R.currententity.leafs[j];
			if ((leaf < 0) || ((vis[leaf >> 3] & (1 << (leaf & 7))) !== 0))
				break;
		}
		if (j === R.currententity.leafs.length)
			continue;
		switch (R.currententity.model.type)
		{
		case Mod.type.alias:
			R.DrawAliasModel(R.currententity);
			continue;
		case Mod.type.brush:
			R.DrawBrushModel(R.currententity);
		}
	}
	for (i = 0; i < CL.numvisedicts; ++i)
	{
		R.currententity = CL.visedicts[i];
		if (R.currententity.model == null)
			continue;
		switch (R.currententity.model.type)
		{
		case Mod.type.alias:
			R.DrawAliasModel(R.currententity);
			continue;
		case Mod.type.brush:
			R.DrawBrushModel(R.currententity);
		}
	}
	GL.StreamFlush();
	gl.depthMask(false);
	gl.enable(gl.BLEND);
	for (i = 0; i < CL.state.num_statics; ++i)
	{
		R.currententity = CL.static_entities[i];
		if (R.currententity.model == null)
			continue;
		if (R.currententity.model.type === Mod.type.sprite)
			R.DrawSpriteModel(R.currententity);
	}
	for (i = 0; i < CL.numvisedicts; ++i)
	{
		R.currententity = CL.visedicts[i];
		if (R.currententity.model == null)
			continue;
		if (R.currententity.model.type === Mod.type.sprite)
			R.DrawSpriteModel(R.currententity);
	}
	GL.StreamFlush();
	gl.disable(gl.BLEND);
	gl.depthMask(true);
};

R.DrawViewModel = function()
{
	if (R.drawviewmodel.value === 0)
		return;
	if (Chase.active.value !== 0)
		return;
	if (R.drawentities.value === 0)
		return;
	if ((CL.state.items & Def.it.invisibility) !== 0)
		return;
	if (CL.state.stats[Def.stat.health] <= 0)
		return;
	if (CL.state.viewent.model == null)
		return;

	gl.depthRange(0.0, 0.3);

	var ymax = 4.0 * Math.tan(SCR.fov.value * 0.82 * Math.PI / 360.0);
	R.perspective[0] = 4.0 / (ymax * R.refdef.vrect.width / R.refdef.vrect.height);
	R.perspective[5] = 4.0 / ymax;
	var program = GL.UseProgram('Alias');
	gl.uniformMatrix4fv(program.uPerspective, false, R.perspective);

	R.DrawAliasModel(CL.state.viewent);

	ymax = 4.0 * Math.tan(R.refdef.fov_y * Math.PI / 360.0);
	R.perspective[0] = 4.0 / (ymax * R.refdef.vrect.width / R.refdef.vrect.height);
	R.perspective[5] = 4.0 / ymax;
	program = GL.UseProgram('Alias');
	gl.uniformMatrix4fv(program.uPerspective, false, R.perspective);

	gl.depthRange(0.0, 1.0);
};

R.PolyBlend = function()
{
	if (R.polyblend.value === 0)
		return;
	if (V.blend[3] === 0.0)
		return;
	GL.UseProgram('Fill', true);
	var vrect = R.refdef.vrect;
	GL.StreamDrawColoredQuad(vrect.x, vrect.y, vrect.width, vrect.height,
		V.blend[0], V.blend[1], V.blend[2], V.blend[3] * 255.0);
};

R.SetFrustum = function()
{
	R.frustum[0].normal = Vec.RotatePointAroundVector(R.vup, R.vpn, -(90.0 - R.refdef.fov_x * 0.5));
	R.frustum[1].normal = Vec.RotatePointAroundVector(R.vup, R.vpn, 90.0 - R.refdef.fov_x * 0.5);
	R.frustum[2].normal = Vec.RotatePointAroundVector(R.vright, R.vpn, 90.0 - R.refdef.fov_y * 0.5);
	R.frustum[3].normal = Vec.RotatePointAroundVector(R.vright, R.vpn, -(90.0 - R.refdef.fov_y * 0.5));
	var i, out;
	for (i = 0; i <= 3; ++i)
	{
		out = R.frustum[i];
		out.type = 5;
		out.dist = Vec.DotProduct(R.refdef.vieworg, out.normal);
		out.signbits = 0;
		if (out.normal[0] < 0.0)
			out.signbits = 1;
		if (out.normal[1] < 0.0)
			out.signbits += 2;
		if (out.normal[2] < 0.0)
			out.signbits += 4;
		if (out.normal[3] < 0.0)
			out.signbits += 8;
	}
};

R.perspective = [
	0.0, 0.0, 0.0, 0.0,
	0.0, 0.0, 0.0, 0.0,
	0.0, 0.0, -65540.0 / 65532.0, -1.0,
	0.0, 0.0, -524288.0 / 65532.0, 0.0
];

R.Perspective = function()
{
	var viewangles = [
		R.refdef.viewangles[0] * Math.PI / 180.0,
		(R.refdef.viewangles[1] - 90.0) * Math.PI / -180.0,
		R.refdef.viewangles[2] * Math.PI / -180.0
	];
	var sp = Math.sin(viewangles[0]);
	var cp = Math.cos(viewangles[0]);
	var sy = Math.sin(viewangles[1]);
	var cy = Math.cos(viewangles[1]);
	var sr = Math.sin(viewangles[2]);
	var cr = Math.cos(viewangles[2]);
	var viewMatrix = [
		cr * cy + sr * sp * sy,		cp * sy,	-sr * cy + cr * sp * sy,
		cr * -sy + sr * sp * cy,	cp * cy,	-sr * -sy + cr * sp * cy,
		sr * cp,					-sp,		cr * cp
	];

	if (V.gamma.value < 0.5)
		Cvar.SetValue('gamma', 0.5);
	else if (V.gamma.value > 1.0)
		Cvar.SetValue('gamma', 1.0);

	GL.UnbindProgram();
	var i, program;
	for (i = 0; i < GL.programs.length; ++i)
	{
		program = GL.programs[i];
		gl.useProgram(program.program);
		if (program.uViewOrigin != null)
			gl.uniform3fv(program.uViewOrigin, R.refdef.vieworg);
		if (program.uViewAngles != null)
			gl.uniformMatrix3fv(program.uViewAngles, false, viewMatrix);
		if (program.uPerspective != null)
			gl.uniformMatrix4fv(program.uPerspective, false, R.perspective);
		if (program.uGamma != null)
			gl.uniform1f(program.uGamma, V.gamma.value);
	}
};

R.SetupGL = function()
{
	if (R.dowarp === true)
	{
		gl.bindFramebuffer(gl.FRAMEBUFFER, R.warpbuffer);
		gl.clear(gl.COLOR_BUFFER_BIT + gl.DEPTH_BUFFER_BIT);
		gl.viewport(0, 0, R.warpwidth, R.warpheight);
	}
	else
	{
		var vrect = R.refdef.vrect;
		var pixelRatio = SCR.devicePixelRatio;
		gl.viewport((vrect.x * pixelRatio) >> 0, ((VID.height - vrect.height - vrect.y) * pixelRatio) >> 0, (vrect.width * pixelRatio) >> 0, (vrect.height * pixelRatio) >> 0);
	}
	R.Perspective();
	gl.enable(gl.DEPTH_TEST);
};

R.RenderScene = function()
{
	if (CL.state.maxclients >= 2)
		Cvar.Set('r_fullbright', '0');
	R.AnimateLight();
	Vec.AngleVectors(R.refdef.viewangles, R.vpn, R.vright, R.vup);
	R.viewleaf = Mod.PointInLeaf(R.refdef.vieworg, CL.state.worldmodel);
	V.SetContentsColor(R.viewleaf.contents);
	V.CalcBlend();
	R.dowarp = (R.waterwarp.value !== 0) && (R.viewleaf.contents <= Mod.contents.water);

	R.SetFrustum();
	R.SetupGL();
	R.MarkLeaves();
	gl.enable(gl.CULL_FACE);
	R.DrawSkyBox();
	R.DrawViewModel();
	R.DrawWorld();
	R.DrawEntitiesOnList();
	gl.disable(gl.CULL_FACE);
	R.RenderDlights();
	R.DrawParticles();
};

R.RenderView = function()
{
	gl.finish();
	var time1;
	if (R.speeds.value !== 0)
		time1 = Sys.FloatTime();
	R.c_brush_verts = 0;
	R.c_alias_polys = 0;
	gl.clear(gl.COLOR_BUFFER_BIT + gl.DEPTH_BUFFER_BIT);
	R.RenderScene();
	if (R.speeds.value !== 0)
	{
		var time2 = Math.floor((Sys.FloatTime() - time1) * 1000.0);
		var c_brush_polys = R.c_brush_verts / 3;
		var c_alias_polys = R.c_alias_polys;
		var msg = ((time2 >= 100) ? '' : ((time2 >= 10) ? ' ' : '  ')) + time2 + ' ms  ';
		msg += ((c_brush_polys >= 1000) ? '' : ((c_brush_polys >= 100) ? ' ' : ((c_brush_polys >= 10) ? '  ' : '   '))) + c_brush_polys + ' wpoly ';
		msg += ((c_alias_polys >= 1000) ? '' : ((c_alias_polys >= 100) ? ' ' : ((c_alias_polys >= 10) ? '  ' : '   '))) + c_alias_polys + ' epoly\n';
		Con.Print(msg);
	}
};

// mesh

R.MakeBrushModelDisplayLists = function(m)
{
	if (m.cmds != null)
		gl.deleteBuffer(m.cmds);
	var i, j, k;
	var cmds = [];
	var texture, chain, leaf, surf, vert, styles = [0.0, 0.0, 0.0, 0.0];
	var verts = 0;
	m.chains = [];
	for (i = 0; i < m.textures.length; ++i)
	{
		texture = m.textures[i];
		if ((texture.sky === true) || (texture.turbulent === true))
			continue;
		chain = [i, verts, 0];
		for (j = 0; j < m.numfaces; ++j)
		{
			surf = m.faces[m.firstface + j];
			if (surf.texture !== i)
				continue;
			styles[0] = styles[1] = styles[2] = styles[3] = 0.0;
			switch (surf.styles.length)
			{
			case 4:
				styles[3] = surf.styles[3] * 0.015625 + 0.0078125;
			case 3:
				styles[2] = surf.styles[2] * 0.015625 + 0.0078125;
			case 2:
				styles[1] = surf.styles[1] * 0.015625 + 0.0078125;
			case 1:
				styles[0] = surf.styles[0] * 0.015625 + 0.0078125;
			}
			chain[2] += surf.verts.length;
			for (k = 0; k < surf.verts.length; ++k)
			{
				vert = surf.verts[k];
				cmds[cmds.length] = vert[0];
				cmds[cmds.length] = vert[1];
				cmds[cmds.length] = vert[2];
				cmds[cmds.length] = vert[3];
				cmds[cmds.length] = vert[4];
				cmds[cmds.length] = vert[5];
				cmds[cmds.length] = vert[6];
				cmds[cmds.length] = styles[0];
				cmds[cmds.length] = styles[1];
				cmds[cmds.length] = styles[2];
				cmds[cmds.length] = styles[3];
			}
		}
		if (chain[2] !== 0)
		{
			m.chains[m.chains.length] = chain;
			verts += chain[2];
		}
	}
	m.waterchain = verts * 44;
	verts = 0;
	for (i = 0; i < m.textures.length; ++i)
	{
		texture = m.textures[i];
		if (texture.turbulent !== true)
			continue;
		chain = [i, verts, 0];
		for (j = 0; j < m.numfaces; ++j)
		{
			surf = m.faces[m.firstface + j];
			if (surf.texture !== i)
				continue;
			chain[2] += surf.verts.length;
			for (k = 0; k < surf.verts.length; ++k)
			{
				vert = surf.verts[k];
				cmds[cmds.length] = vert[0];
				cmds[cmds.length] = vert[1];
				cmds[cmds.length] = vert[2];
				cmds[cmds.length] = vert[3];
				cmds[cmds.length] = vert[4];
			}
		}
		if (chain[2] !== 0)
		{
			m.chains[m.chains.length] = chain;
			verts += chain[2];
		}
	}
	m.cmds = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, m.cmds);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cmds), gl.STATIC_DRAW);
};

R.MakeWorldModelDisplayLists = function(m)
{
	if (m.cmds != null)
		return;
	var i, j, k, l;
	var cmds = [];
	var texture, leaf, chain, surf, vert, styles = [0.0, 0.0, 0.0, 0.0];
	var verts = 0;
	for (i = 0; i < m.textures.length; ++i)
	{
		texture = m.textures[i];
		if ((texture.sky === true) || (texture.turbulent === true))
			continue;
		for (j = 0; j < m.leafs.length; ++j)
		{
			leaf = m.leafs[j];
			chain = [i, verts, 0];
			for (k = 0; k < leaf.nummarksurfaces; ++k)
			{
				surf = m.faces[m.marksurfaces[leaf.firstmarksurface + k]];
				if (surf.texture !== i)
					continue;
				styles[0] = styles[1] = styles[2] = styles[3] = 0.0;
				switch (surf.styles.length)
				{
				case 4:
					styles[3] = surf.styles[3] * 0.015625 + 0.0078125;
				case 3:
					styles[2] = surf.styles[2] * 0.015625 + 0.0078125;
				case 2:
					styles[1] = surf.styles[1] * 0.015625 + 0.0078125;
				case 1:
					styles[0] = surf.styles[0] * 0.015625 + 0.0078125;
				}
				chain[2] += surf.verts.length;
				for (l = 0; l < surf.verts.length; ++l)
				{
					vert = surf.verts[l];
					cmds[cmds.length] = vert[0];
					cmds[cmds.length] = vert[1];
					cmds[cmds.length] = vert[2];
					cmds[cmds.length] = vert[3];
					cmds[cmds.length] = vert[4];
					cmds[cmds.length] = vert[5];
					cmds[cmds.length] = vert[6];
					cmds[cmds.length] = styles[0];
					cmds[cmds.length] = styles[1];
					cmds[cmds.length] = styles[2];
					cmds[cmds.length] = styles[3];
				}
			}
			if (chain[2] !== 0)
			{
				leaf.cmds[leaf.cmds.length] = chain;
				++leaf.skychain;
				++leaf.waterchain;
				verts += chain[2];
			}
		}
	}
	m.skychain = verts * 44;
	verts = 0;
	for (i = 0; i < m.textures.length; ++i)
	{
		texture = m.textures[i];
		if (texture.sky !== true)
			continue;
		for (j = 0; j < m.leafs.length; ++j)
		{
			leaf = m.leafs[j];
			chain = [verts, 0];
			for (k = 0; k < leaf.nummarksurfaces; ++k)
			{
				surf = m.faces[m.marksurfaces[leaf.firstmarksurface + k]];
				if (surf.texture !== i)
					continue;
				chain[1] += surf.verts.length;
				for (l = 0; l < surf.verts.length; ++l)
				{
					vert = surf.verts[l];
					cmds[cmds.length] = vert[0];
					cmds[cmds.length] = vert[1];
					cmds[cmds.length] = vert[2];
				}
			}
			if (chain[1] !== 0)
			{
				leaf.cmds[leaf.cmds.length] = chain;
				++leaf.waterchain;
				verts += chain[1];
			}
		}
	}
	m.waterchain = m.skychain + verts * 12;
	verts = 0;
	for (i = 0; i < m.textures.length; ++i)
	{
		texture = m.textures[i];
		if (texture.turbulent !== true)
			continue;
		for (j = 0; j < m.leafs.length; ++j)
		{
			leaf = m.leafs[j];
			chain = [i, verts, 0];
			for (k = 0; k < leaf.nummarksurfaces; ++k)
			{
				surf = m.faces[m.marksurfaces[leaf.firstmarksurface + k]];
				if (surf.texture !== i)
					continue;
				chain[2] += surf.verts.length;
				for (l = 0; l < surf.verts.length; ++l)
				{
					vert = surf.verts[l];
					cmds[cmds.length] = vert[0];
					cmds[cmds.length] = vert[1];
					cmds[cmds.length] = vert[2];
					cmds[cmds.length] = vert[3];
					cmds[cmds.length] = vert[4];
				}
			}
			if (chain[2] !== 0)
			{
				leaf.cmds[leaf.cmds.length] = chain;
				verts += chain[2];
			}
		}
	}
	m.cmds = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, m.cmds);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cmds), gl.STATIC_DRAW);
};

// misc

R.InitTextures = function()
{
	var data = new Uint8Array(new ArrayBuffer(256));
	var i, j;
	for (i = 0; i < 8; ++i)
	{
		for (j = 0; j < 8; ++j)
		{
			data[(i << 4) + j] = data[136 + (i << 4) + j] = 255;
			data[8 + (i << 4) + j] = data[128 + (i << 4) + j] = 0;
		}
	}
	R.notexture_mip = {name: 'notexture', width: 16, height: 16, texturenum: gl.createTexture()};
	GL.Bind(0, R.notexture_mip.texturenum);
	GL.Upload(data, 16, 16);

	R.solidskytexture = gl.createTexture();
	GL.Bind(0, R.solidskytexture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	R.alphaskytexture = gl.createTexture();
	GL.Bind(0, R.alphaskytexture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	R.lightmap_texture = gl.createTexture();
	GL.Bind(0, R.lightmap_texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	R.dlightmap_texture = gl.createTexture();
	GL.Bind(0, R.dlightmap_texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	R.lightstyle_texture = gl.createTexture();
	GL.Bind(0, R.lightstyle_texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

	R.fullbright_texture = gl.createTexture();
	GL.Bind(0, R.fullbright_texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 0, 0]));
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

	R.null_texture = gl.createTexture();
	GL.Bind(0, R.null_texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
};

R.Init = function()
{
	R.InitTextures();

	Cmd.AddCommand('timerefresh', R.TimeRefresh_f);
	Cmd.AddCommand('pointfile', R.ReadPointFile_f);

	R.waterwarp = Cvar.RegisterVariable('r_waterwarp', '1');
	R.fullbright = Cvar.RegisterVariable('r_fullbright', '0');
	R.drawentities = Cvar.RegisterVariable('r_drawentities', '1');
	R.drawviewmodel = Cvar.RegisterVariable('r_drawviewmodel', '1');
	R.novis = Cvar.RegisterVariable('r_novis', '0');
	R.speeds = Cvar.RegisterVariable('r_speeds', '0');
	R.polyblend = Cvar.RegisterVariable('gl_polyblend', '1');
	R.flashblend = Cvar.RegisterVariable('gl_flashblend', '0');
	R.nocolors = Cvar.RegisterVariable('gl_nocolors', '0');

	R.InitParticles();

	GL.CreateProgram('Alias',
		['uOrigin', 'uAngles', 'uViewOrigin', 'uViewAngles', 'uPerspective', 'uLightVec', 'uGamma', 'uAmbientLight', 'uShadeLight'],
		[['aPosition', gl.FLOAT, 3], ['aNormal', gl.FLOAT, 3], ['aTexCoord', gl.FLOAT, 2]],
		['tTexture']);
	GL.CreateProgram('Brush',
		['uOrigin', 'uAngles', 'uViewOrigin', 'uViewAngles', 'uPerspective', 'uGamma'],
		[['aPosition', gl.FLOAT, 3], ['aTexCoord', gl.FLOAT, 4], ['aLightStyle', gl.FLOAT, 4]],
		['tTexture', 'tLightmap', 'tDlight', 'tLightStyle']);
	GL.CreateProgram('Dlight',
		['uOrigin', 'uViewOrigin', 'uViewAngles', 'uPerspective', 'uRadius', 'uGamma'],
		[['aPosition', gl.FLOAT, 3]],
		[]);
	GL.CreateProgram('Player',
		['uOrigin', 'uAngles', 'uViewOrigin', 'uViewAngles', 'uPerspective', 'uLightVec', 'uGamma', 'uAmbientLight', 'uShadeLight', 'uTop', 'uBottom'],
		[['aPosition', gl.FLOAT, 3], ['aNormal', gl.FLOAT, 3], ['aTexCoord', gl.FLOAT, 2]],
		['tTexture', 'tPlayer']);
	GL.CreateProgram('Sprite',
		['uViewOrigin', 'uViewAngles', 'uPerspective', 'uGamma'],
		[['aPosition', gl.FLOAT, 3], ['aTexCoord', gl.FLOAT, 2]],
		['tTexture']);
	GL.CreateProgram('Turbulent',
		['uOrigin', 'uAngles', 'uViewOrigin', 'uViewAngles', 'uPerspective', 'uGamma', 'uTime'],
		[['aPosition', gl.FLOAT, 3], ['aTexCoord', gl.FLOAT, 2]],
		['tTexture']);
	GL.CreateProgram('Warp',
		['uOrtho', 'uTime'],
		[['aPosition', gl.FLOAT, 2], ['aTexCoord', gl.FLOAT, 2]],
		['tTexture']);

	R.warpbuffer = gl.createFramebuffer();
	R.warptexture = gl.createTexture();
	GL.Bind(0, R.warptexture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	R.warprenderbuffer = gl.createRenderbuffer();
	gl.bindRenderbuffer(gl.RENDERBUFFER, R.warprenderbuffer);
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, 0, 0);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, R.warpbuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, R.warptexture, 0);
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, R.warprenderbuffer);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	R.dlightvecs = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, R.dlightvecs);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
		0.0, -1.0, 0.0,
		0.0, 0.0, 1.0,
		-0.382683, 0.0, 0.92388,
		-0.707107, 0.0, 0.707107,
		-0.92388, 0.0, 0.382683,
		-1.0, 0.0, 0.0,
		-0.92388, 0.0, -0.382683,
		-0.707107, 0.0, -0.707107,
		-0.382683, 0.0, -0.92388,
		0.0, 0.0, -1.0,
		0.382683, 0.0, -0.92388,
		0.707107, 0.0, -0.707107,
		0.92388, 0.0, -0.382683,
		1.0, 0.0, 0.0,
		0.92388, 0.0, 0.382683,
		0.707107, 0.0, 0.707107,
		0.382683, 0.0, 0.92388,
		0.0, 0.0, 1.0
	]), gl.STATIC_DRAW);

	R.MakeSky();
};

R.NewMap = function()
{
	var i;
	for (i = 0; i < 64; ++i)
		R.lightstylevalue[i] = 12;

	R.ClearParticles();
	R.BuildLightmaps();

	for (i = 0; i <= 1048575; ++i)
		R.dlightmaps[i] = 0;
	GL.Bind(0, R.dlightmap_texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, 1024, 1024, 0, gl.ALPHA, gl.UNSIGNED_BYTE, null);
};

R.TimeRefresh_f = function()
{
	gl.finish();
	var i;
	var start = Sys.FloatTime();
	for (i = 0; i <= 127; ++i)
	{
		R.refdef.viewangles[1] = i * 2.8125;
		R.RenderView();
	}
	gl.finish();
	var time = Sys.FloatTime() - start;
	Con.Print(time.toFixed(6) + ' seconds (' + (128.0 / time).toFixed(6) + ' fps)\n');
};

// part

R.ptype = {
	tracer: 0,
	grav: 1,
	slowgrav: 2,
	fire: 3,
	explode: 4,
	explode2: 5,
	blob: 6,
	blob2: 7
};

R.ramp1 = [0x6f, 0x6d, 0x6b, 0x69, 0x67, 0x65, 0x63, 0x61];
R.ramp2 = [0x6f, 0x6e, 0x6d, 0x6c, 0x6b, 0x6a, 0x68, 0x66];
R.ramp3 = [0x6d, 0x6b, 6, 5, 4, 3];

R.InitParticles = function()
{
	var i = COM.CheckParm('-particles');
	if (i != null)
	{
		R.numparticles = Q.atoi(COM.argv[i + 1]);
		if (R.numparticles < 512)
			R.numparticles = 512;
	}
	else
		R.numparticles = 2048;

	R.avelocities = [];
	for (i = 0; i <= 161; ++i)
		R.avelocities[i] = [Math.random() * 2.56, Math.random() * 2.56, Math.random() * 2.56];

	GL.CreateProgram('Particle',
		['uViewOrigin', 'uViewAngles', 'uPerspective', 'uGamma'],
		[['aOrigin', gl.FLOAT, 3], ['aCoord', gl.FLOAT, 2], ['aScale', gl.FLOAT, 1], ['aColor', gl.UNSIGNED_BYTE, 3, true]],
		[]);
};

R.EntityParticles = function(ent)
{
	var allocated = R.AllocParticles(162), i;
	var angle, sp, sy, cp, cy, forward = [];
	for (i = 0; i < allocated.length; ++i)
	{
		angle = CL.state.time * R.avelocities[i][0];
		sp = Math.sin(angle);
		cp = Math.cos(angle);
		angle = CL.state.time * R.avelocities[i][1];
		sy = Math.sin(angle);
		cy = Math.cos(angle);

		R.particles[allocated[i]] = {
			die: CL.state.time + 0.01,
			color: 0x6f,
			ramp: 0.0,
			type: R.ptype.explode,
			org: [
				ent.origin[0] + R.avertexnormals[i][0] * 64.0 + cp * cy * 16.0,
				ent.origin[1] + R.avertexnormals[i][1] * 64.0 + cp * sy * 16.0,
				ent.origin[2] + R.avertexnormals[i][2] * 64.0 + sp * -16.0
			],
			vel: [0.0, 0.0, 0.0]
		};
	}
};

R.ClearParticles = function()
{
	var i;
	R.particles = [];
	for (i = 0; i < R.numparticles; ++i)
		R.particles[i] = {die: -1.0};
};

R.ReadPointFile_f = function()
{
	if (SV.server.active !== true)
		return;
	var name = 'maps/' + PR.GetString(PR.globals_int[PR.globalvars.mapname]) + '.pts';
	var f = COM.LoadTextFile(name);
	if (f == null)
	{
		Con.Print('couldn\'t open ' + name + '\n');
		return;
	}
	Con.Print('Reading ' + name + '...\n');
	f = f.split('\n');
	var c, org, p;
	for (c = 0; c < f.length; )
	{
		org = f[c].split(' ');
		if (org.length !== 3)
			break;
		++c;
		p = R.AllocParticles(1);
		if (p.length === 0)
		{
			Con.Print('Not enough free particles\n');
			break;
		}
		R.particles[p[0]] = {
			die: 99999.0,
			color: -c & 15,
			type: R.ptype.tracer,
			vel: [0.0, 0.0, 0.0],
			org: [Q.atof(org[0]), Q.atof(org[1]), Q.atof(org[2])]
		};
	}
	Con.Print(c + ' points read\n');
};

R.ParseParticleEffect = function()
{
	var org = [MSG.ReadCoord(), MSG.ReadCoord(), MSG.ReadCoord()];
	var dir = [MSG.ReadChar() * 0.0625, MSG.ReadChar() * 0.0625, MSG.ReadChar() * 0.0625];
	var msgcount = MSG.ReadByte();
	var color = MSG.ReadByte();
	if (msgcount === 255)
		R.ParticleExplosion(org);
	else
		R.RunParticleEffect(org, dir, color, msgcount);
};

R.ParticleExplosion = function(org)
{
	var allocated = R.AllocParticles(1024), i;
	for (i = 0; i < allocated.length; ++i)
	{
		R.particles[allocated[i]] = {
			die: CL.state.time + 5.0,
			color: R.ramp1[0],
			ramp: Math.floor(Math.random() * 4.0),
			type: ((i & 1) !== 0) ? R.ptype.explode : R.ptype.explode2,
			org: [
				org[0] + Math.random() * 32.0 - 16.0,
				org[1] + Math.random() * 32.0 - 16.0,
				org[2] + Math.random() * 32.0 - 16.0
			],
			vel: [Math.random() * 512.0 - 256.0, Math.random() * 512.0 - 256.0, Math.random() * 512.0 - 256.0]
		};
	}
};

R.ParticleExplosion2 = function(org, colorStart, colorLength)
{
	var allocated = R.AllocParticles(512), i, colorMod = 0;
	for (i = 0; i < allocated.length; ++i)
	{
		R.particles[allocated[i]] = {
			die: CL.state.time + 0.3,
			color: colorStart + (colorMod++ % colorLength),
			type: R.ptype.blob,
			org: [
				org[0] + Math.random() * 32.0 - 16.0,
				org[1] + Math.random() * 32.0 - 16.0,
				org[2] + Math.random() * 32.0 - 16.0
			],
			vel: [Math.random() * 512.0 - 256.0, Math.random() * 512.0 - 256.0, Math.random() * 512.0 - 256.0]
		};
	}
};

R.BlobExplosion = function(org)
{
	var allocated = R.AllocParticles(1024), i, p;
	for (i = 0; i < allocated.length; ++i)
	{
		p = R.particles[allocated[i]];
		p.die = CL.state.time + 1.0 + Math.random() * 0.4;
		if ((i & 1) !== 0)
		{
			p.type = R.ptype.blob;
			p.color = 66 + Math.floor(Math.random() * 7.0);
		}
		else
		{
			p.type = R.ptype.blob2;
			p.color = 150 + Math.floor(Math.random() * 7.0);
		}
		p.org = [
			org[0] + Math.random() * 32.0 - 16.0,
			org[1] + Math.random() * 32.0 - 16.0,
			org[2] + Math.random() * 32.0 - 16.0
		];
		p.vel = [Math.random() * 512.0 - 256.0, Math.random() * 512.0 - 256.0, Math.random() * 512.0 - 256.0];
	}
};

R.RunParticleEffect = function(org, dir, color, count)
{
	var allocated = R.AllocParticles(count), i;
	for (i = 0; i < allocated.length; ++i)
	{
		R.particles[allocated[i]] = {
			die: CL.state.time + 0.6 * Math.random(),
			color: (color & 0xf8) + Math.floor(Math.random() * 8.0),
			type: R.ptype.slowgrav,
			org: [
				org[0] + Math.random() * 16.0 - 8.0,
				org[1] + Math.random() * 16.0 - 8.0,
				org[2] + Math.random() * 16.0 - 8.0
			],
			vel: [dir[0] * 15.0, dir[1] * 15.0, dir[2] * 15.0]
		};
	}
};

R.LavaSplash = function(org)
{
	var allocated = R.AllocParticles(1024), i, j, k = 0, p;
	var dir = [], vel;
	for (i = -16; i <= 15; ++i)
	{
		for (j = -16; j <= 15; ++j)
		{
			if (k >= allocated.length)
				return;
			p = R.particles[allocated[k++]];
			p.die = CL.state.time + 2.0 + Math.random() * 0.64;
			p.color = 224 + Math.floor(Math.random() * 8.0);
			p.type = R.ptype.slowgrav;
			dir[0] = (j + Math.random) * 8.0;
			dir[1] = (i + Math.random) * 8.0;
			dir[2] = 256.0;
			p.org = [org[0] + dir[0], org[1] + dir[1], org[2] + Math.random() * 64.0];
			Vec.Normalize(dir);
			vel = 50.0 + Math.random() * 64.0;
			p.vel = [dir[0] * vel, dir[1] * vel, dir[2] * vel];
		}
	}
};

R.TeleportSplash = function(org)
{
	var allocated = R.AllocParticles(896), i, j, k, l = 0, p;
	var dir = [], vel;
	for (i = -16; i <= 15; i += 4)
	{
		for (j = -16; j <= 15; j += 4)
		{
			for (k = -24; k <= 31; k += 4)
			{
				if (l >= allocated.length)
					return;
				p = R.particles[allocated[l++]];
				p.die = CL.state.time + 0.2 + Math.random() * 0.16;
				p.color = 7 + Math.floor(Math.random() * 8.0);
				p.type = R.ptype.slowgrav;
				dir[0] = j * 8.0;
				dir[1] = i * 8.0;
				dir[2] = k * 8.0;
				p.org = [
					org[0] + i + Math.random() * 4.0,
					org[1] + j + Math.random() * 4.0,
					org[2] + k + Math.random() * 4.0
				];
				Vec.Normalize(dir);
				vel = 50.0 + Math.random() * 64.0;
				p.vel = [dir[0] * vel, dir[1] * vel, dir[2] * vel];
			}
		}
	}
};

R.tracercount = 0;
R.RocketTrail = function(start, end, type)
{
	var vec = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
	var len = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]);
	if (len === 0.0)
		return;
	vec = [vec[0] / len, vec[1] / len, vec[2] / len];

	var allocated;
	if (type === 4)
		allocated = R.AllocParticles(Math.floor(len / 6.0));
	else
		allocated = R.AllocParticles(Math.floor(len / 3.0));

	var i, p;
	for (i = 0; i < allocated.length; ++i)
	{
		p = R.particles[allocated[i]];
		p.vel = [0.0, 0.0, 0.0];
		p.die = CL.state.time + 2.0;
		switch (type)
		{
		case 0:
		case 1:
			p.ramp = Math.floor(Math.random() * 4.0) + (type << 1);
			p.color = R.ramp3[p.ramp];
			p.type = R.ptype.fire;
			p.org = [
				start[0] + Math.random() * 6.0 - 3.0,
				start[1] + Math.random() * 6.0 - 3.0,
				start[2] + Math.random() * 6.0 - 3.0
			];
			break;
		case 2:
			p.type = R.ptype.grav;
			p.color = 67 + Math.floor(Math.random() * 4.0);
			p.org = [
				start[0] + Math.random() * 6.0 - 3.0,
				start[1] + Math.random() * 6.0 - 3.0,
				start[2] + Math.random() * 6.0 - 3.0
			];
			break;
		case 3:
		case 5:
			p.die = CL.state.time + 0.5;
			p.type = R.ptype.tracer;
			if (type === 3)
				p.color = 52 + ((R.tracercount++ & 4) << 1);
			else
				p.color = 230 + ((R.tracercount++ & 4) << 1);
			p.org = [start[0], start[1], start[2]];
			if ((R.tracercount & 1) !== 0)
			{
				p.vel[0] = 30.0 * vec[1];
				p.vel[2] = -30.0 * vec[0];
			}
			else
			{
				p.vel[0] = -30.0 * vec[1];
				p.vel[2] = 30.0 * vec[0];
			}
			break;
		case 4:
			p.type = R.ptype.grav;
			p.color = 67 + Math.floor(Math.random() * 4.0);
			p.org = [
				start[0] + Math.random() * 6.0 - 3.0,
				start[1] + Math.random() * 6.0 - 3.0,
				start[2] + Math.random() * 6.0 - 3.0
			];
			break;
		case 6:
			p.color = 152 + Math.floor(Math.random() * 4.0);
			p.type = R.ptype.tracer;
			p.die = CL.state.time + 0.3;
			p.org = [
				start[0] + Math.random() * 16.0 - 8.0,
				start[1] + Math.random() * 16.0 - 8.0,
				start[2] + Math.random() * 16.0 - 8.0
			];
		}
		start[0] += vec[0];
		start[1] += vec[1];
		start[2] += vec[2];
	}
};

R.DrawParticles = function()
{
	GL.StreamFlush();

	var program = GL.UseProgram('Particle');
	gl.depthMask(false);
	gl.enable(gl.BLEND);

	var frametime = CL.state.time - CL.state.oldtime;
	var grav = frametime * SV.gravity.value * 0.05;
	var dvel = frametime * 4.0;
	var scale;

	var coords = [-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0];
	for (var i = 0; i < R.numparticles; ++i)
	{
		var p = R.particles[i];
		if (p.die < CL.state.time)
			continue;

		var color = VID.d_8to24table[p.color];
		scale = (p.org[0] - R.refdef.vieworg[0]) * R.vpn[0]
			+ (p.org[1] - R.refdef.vieworg[1]) * R.vpn[1]
			+ (p.org[2] - R.refdef.vieworg[2]) * R.vpn[2];
		if (scale < 20.0)
			scale = 0.375;
		else
			scale = 0.375 + scale * 0.0015;

		GL.StreamGetSpace(6);
		for (var j = 0; j < 6; ++j)
		{
			GL.StreamWriteFloat3(p.org[0], p.org[1], p.org[2]);
			GL.StreamWriteFloat2(coords[j * 2], coords[j * 2 + 1]);
			GL.StreamWriteFloat(scale);
			GL.StreamWriteUByte4(color & 0xff, (color >> 8) & 0xff, color >> 16, 255);
		}

		p.org[0] += p.vel[0] * frametime;
		p.org[1] += p.vel[1] * frametime;
		p.org[2] += p.vel[2] * frametime;

		switch (p.type)
		{
		case R.ptype.fire:
			p.ramp += frametime * 5.0;
			if (p.ramp >= 6.0)
				p.die = -1.0;
			else
				p.color = R.ramp3[Math.floor(p.ramp)];
			p.vel[2] += grav;
			continue;
		case R.ptype.explode:
			p.ramp += frametime * 10.0;
			if (p.ramp >= 8.0)
				p.die = -1.0;
			else
				p.color = R.ramp1[Math.floor(p.ramp)];
			p.vel[0] += p.vel[0] * dvel;
			p.vel[1] += p.vel[1] * dvel;
			p.vel[2] += p.vel[2] * dvel - grav;
			continue;
		case R.ptype.explode2:
			p.ramp += frametime * 15.0;
			if (p.ramp >= 8.0)
				p.die = -1.0;
			else
				p.color = R.ramp2[Math.floor(p.ramp)];
			p.vel[0] -= p.vel[0] * frametime;
			p.vel[1] -= p.vel[1] * frametime;
			p.vel[2] -= p.vel[2] * frametime + grav;
			continue;
		case R.ptype.blob:
			p.vel[0] += p.vel[0] * dvel;
			p.vel[1] += p.vel[1] * dvel;
			p.vel[2] += p.vel[2] * dvel - grav;
			continue;
		case R.ptype.blob2:
			p.vel[0] += p.vel[0] * dvel;
			p.vel[1] += p.vel[1] * dvel;
			p.vel[2] -= grav;
			continue;
		case R.ptype.grav:
		case R.ptype.slowgrav:
			p.vel[2] -= grav;
		}
	}

	GL.StreamFlush();

	gl.disable(gl.BLEND);
	gl.depthMask(true);
};

R.AllocParticles = function(count)
{
	var allocated = [], i;
	for (i = 0; i < R.numparticles; ++i)
	{
		if (count === 0)
			return allocated;
		if (R.particles[i].die < CL.state.time)
		{
			allocated[allocated.length] = i;
			--count;
		}
	}
	return allocated;
};

// surf

R.lightmap_modified = [];
R.lightmaps = new Uint8Array(new ArrayBuffer(4194304));
R.dlightmaps = new Uint8Array(new ArrayBuffer(1048576));

R.AddDynamicLights = function(surf)
{
	var smax = (surf.extents[0] >> 4) + 1;
	var tmax = (surf.extents[1] >> 4) + 1;
	var size = smax * tmax;
	var tex = CL.state.worldmodel.texinfo[surf.texinfo];
	var i, light, s, t;
	var dist, rad, minlight, impact = [], local = [], sd, td;

	var blocklights = [];
	for (i = 0; i < size; ++i)
		blocklights[i] = 0;

	for (i = 0; i <= 31; ++i)
	{
		if (((surf.dlightbits >>> i) & 1) === 0)
			continue;
		light = CL.dlights[i];
		dist = Vec.DotProduct(light.origin, surf.plane.normal) - surf.plane.dist;
		rad = light.radius - Math.abs(dist);
		minlight = light.minlight;
		if (rad < minlight)
			continue;
		minlight = rad - minlight;
		impact[0] = light.origin[0] - surf.plane.normal[0] * dist;
		impact[1] = light.origin[1] - surf.plane.normal[1] * dist;
		impact[2] = light.origin[2] - surf.plane.normal[2] * dist;
		local[0] = Vec.DotProduct(impact, tex.vecs[0]) + tex.vecs[0][3] - surf.texturemins[0];
		local[1] = Vec.DotProduct(impact, tex.vecs[1]) + tex.vecs[1][3] - surf.texturemins[1];
		for (t = 0; t < tmax; ++t)
		{
			td = local[1] - (t << 4);
			if (td < 0.0)
				td = -td;
			td = Math.floor(td);
			for (s = 0; s < smax; ++s)
			{
				sd = local[0] - (s << 4);
				if (sd < 0)
					sd = -sd;
				sd = Math.floor(sd);
				if (sd > td)
					dist = sd + (td >> 1);
				else
					dist = td + (sd >> 1);
				if (dist < minlight)
					blocklights[t * smax + s] += Math.floor((rad - dist) * 256.0);
			}
		}
	}

	i = 0;
	var dest, bl;
	for (t = 0; t < tmax; ++t)
	{
		R.lightmap_modified[surf.light_t + t] = true;
		dest = ((surf.light_t + t) << 10) + surf.light_s;
		for (s = 0; s < smax; ++s)
		{
			bl = blocklights[i++] >> 7;
			if (bl > 255)
				bl = 255;
			R.dlightmaps[dest + s] = bl;
		}
	}
};

R.RemoveDynamicLights = function(surf)
{
	var smax = (surf.extents[0] >> 4) + 1;
	var tmax = (surf.extents[1] >> 4) + 1;
	var dest, s, t;
	for (t = 0; t < tmax; ++t)
	{
		R.lightmap_modified[surf.light_t + t] = true;
		dest = ((surf.light_t + t) << 10) + surf.light_s;
		for (s = 0; s < smax; ++s)
			R.dlightmaps[dest + s] = 0;
	}
};

R.BuildLightMap = function(surf)
{
	var dest;
	var smax = (surf.extents[0] >> 4) + 1;
	var tmax = (surf.extents[1] >> 4) + 1;
	var i, j;
	var lightmap = surf.lightofs;
	var maps;
	for (maps = 0; maps < surf.styles.length; ++maps)
	{
		dest = (surf.light_t << 12) + (surf.light_s << 2) + maps;
		for (i = 0; i < tmax; ++i)
		{
			for (j = 0; j < smax; ++j)
				R.lightmaps[dest + (j << 2)] = R.currentmodel.lightdata[lightmap + j];
			lightmap += smax;
			dest += 4096;
		}
	}
	for (; maps <= 3; ++maps)
	{
		dest = (surf.light_t << 12) + (surf.light_s << 2) + maps;
		for (i = 0; i < tmax; ++i)
		{
			for (j = 0; j < smax; ++j)
				R.lightmaps[dest + (j << 2)] = 0;
			dest += 4096;
		}
	}
};

R.TextureAnimation = function(base)
{
	var frame = 0;
	if (base.anim_base != null)
	{
		frame = base.anim_frame;
		base = R.currententity.model.textures[base.anim_base];
	}
	var anims = base.anims;
	if (anims == null)
		return base;
	if ((R.currententity.frame !== 0) && (base.alternate_anims.length !== 0))
		anims = base.alternate_anims;
	return R.currententity.model.textures[anims[(Math.floor(CL.state.time * 5.0) + frame) % anims.length]];
};

R.DrawBrushModel = function(e)
{
	var clmodel = e.model;

	if (clmodel.submodel === true)
	{
		if (R.CullBox(
			[
				e.origin[0] + clmodel.mins[0],
				e.origin[1] + clmodel.mins[1],
				e.origin[2] + clmodel.mins[2]
			],
			[
				e.origin[0] + clmodel.maxs[0],
				e.origin[1] + clmodel.maxs[1],
				e.origin[2] + clmodel.maxs[2]
			]) === true)
			return;
	}
	else
	{
		if (R.CullBox(
			[
				e.origin[0] - clmodel.radius,
				e.origin[1] - clmodel.radius,
				e.origin[2] - clmodel.radius
			],
			[
				e.origin[0] + clmodel.radius,
				e.origin[1] + clmodel.radius,
				e.origin[2] + clmodel.radius
			]) === true)
			return;
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, clmodel.cmds);
	var viewMatrix = GL.RotationMatrix(e.angles[0], e.angles[1], e.angles[2]);

	var program = GL.UseProgram('Brush');
	gl.uniform3fv(program.uOrigin, e.origin);
	gl.uniformMatrix3fv(program.uAngles, false, viewMatrix);
	gl.vertexAttribPointer(program.aPosition.location, 3, gl.FLOAT, false, 44, 0);
	gl.vertexAttribPointer(program.aTexCoord.location, 4, gl.FLOAT, false, 44, 12);
	gl.vertexAttribPointer(program.aLightStyle.location, 4, gl.FLOAT, false, 44, 28);
	if ((R.fullbright.value !== 0) || (clmodel.lightdata == null))
		GL.Bind(program.tLightmap, R.fullbright_texture);
	else
		GL.Bind(program.tLightmap, R.lightmap_texture);
	GL.Bind(program.tDlight, ((R.flashblend.value === 0) && (clmodel.submodel === true)) ? R.dlightmap_texture : R.null_texture);
	GL.Bind(program.tLightStyle, R.lightstyle_texture);
	var i, chain, texture;
	for (i = 0; i < clmodel.chains.length; ++i)
	{
		chain = clmodel.chains[i];
		texture = R.TextureAnimation(clmodel.textures[chain[0]]);
		if (texture.turbulent === true)
			continue;
		R.c_brush_verts += chain[2];
		GL.Bind(program.tTexture, texture.texturenum);
		gl.drawArrays(gl.TRIANGLES, chain[1], chain[2]);
	}

	program = GL.UseProgram('Turbulent');
	gl.uniform3f(program.uOrigin, 0.0, 0.0, 0.0);
	gl.uniformMatrix3fv(program.uAngles, false, viewMatrix);
	gl.uniform1f(program.uTime, Host.realtime % (Math.PI * 2.0));
	gl.vertexAttribPointer(program.aPosition.location, 3, gl.FLOAT, false, 20, e.model.waterchain);
	gl.vertexAttribPointer(program.aTexCoord.location, 2, gl.FLOAT, false, 20, e.model.waterchain + 12);
	for (i = 0; i < clmodel.chains.length; ++i)
	{
		chain = clmodel.chains[i];
		texture = clmodel.textures[chain[0]];
		if (texture.turbulent !== true)
			continue;
		R.c_brush_verts += chain[2];
		GL.Bind(program.tTexture, texture.texturenum);
		gl.drawArrays(gl.TRIANGLES, chain[1], chain[2]);
	}
};

R.RecursiveWorldNode = function(node)
{
	if (node.contents === Mod.contents.solid)
		return;
	if (node.contents < 0)
	{
		if (node.markvisframe !== R.visframecount)
			return;
		node.visframe = R.visframecount;
		if (node.skychain !== node.waterchain)
			R.drawsky = true;
		return;
	}
	R.RecursiveWorldNode(node.children[0]);
	R.RecursiveWorldNode(node.children[1]);
};

R.DrawWorld = function()
{
	var clmodel = CL.state.worldmodel;
	R.currententity = CL.entities[0];
	gl.bindBuffer(gl.ARRAY_BUFFER, clmodel.cmds);

	var program = GL.UseProgram('Brush');
	gl.uniform3f(program.uOrigin, 0.0, 0.0, 0.0);
	gl.uniformMatrix3fv(program.uAngles, false, GL.identity);
	gl.vertexAttribPointer(program.aPosition.location, 3, gl.FLOAT, false, 44, 0);
	gl.vertexAttribPointer(program.aTexCoord.location, 4, gl.FLOAT, false, 44, 12);
	gl.vertexAttribPointer(program.aLightStyle.location, 4, gl.FLOAT, false, 44, 28);
	if ((R.fullbright.value !== 0) || (clmodel.lightdata == null))
		GL.Bind(program.tLightmap, R.fullbright_texture);
	else
		GL.Bind(program.tLightmap, R.lightmap_texture);
	if (R.flashblend.value === 0)
		GL.Bind(program.tDlight, R.dlightmap_texture);
	else
		GL.Bind(program.tDlight, R.null_texture);
	GL.Bind(program.tLightStyle, R.lightstyle_texture);
	var i, j, leaf, cmds;
	for (i = 0; i < clmodel.leafs.length; ++i)
	{
		leaf = clmodel.leafs[i];
		if ((leaf.visframe !== R.visframecount) || (leaf.skychain === 0))
			continue;
		if (R.CullBox(leaf.mins, leaf.maxs) === true)
			continue;
		for (j = 0; j < leaf.skychain; ++j)
		{
			cmds = leaf.cmds[j];
			R.c_brush_verts += cmds[2];
			GL.Bind(program.tTexture, R.TextureAnimation(clmodel.textures[cmds[0]]).texturenum);
			gl.drawArrays(gl.TRIANGLES, cmds[1], cmds[2]);
		}
	}

	program = GL.UseProgram('Turbulent');
	gl.uniform3f(program.uOrigin, 0.0, 0.0, 0.0);
	gl.uniformMatrix3fv(program.uAngles, false, GL.identity);
	gl.uniform1f(program.uTime, Host.realtime % (Math.PI * 2.0));
	gl.vertexAttribPointer(program.aPosition.location, 3, gl.FLOAT, false, 20, clmodel.waterchain);
	gl.vertexAttribPointer(program.aTexCoord.location, 2, gl.FLOAT, false, 20, clmodel.waterchain + 12);
	for (i = 0; i < clmodel.leafs.length; ++i)
	{
		leaf = clmodel.leafs[i];
		if ((leaf.visframe !== R.visframecount) || (leaf.waterchain === leaf.cmds.length))
			continue;
		if (R.CullBox(leaf.mins, leaf.maxs) === true)
			continue;
		for (j = leaf.waterchain; j < leaf.cmds.length; ++j)
		{
			cmds = leaf.cmds[j];
			R.c_brush_verts += cmds[2];
			GL.Bind(program.tTexture, clmodel.textures[cmds[0]].texturenum);
			gl.drawArrays(gl.TRIANGLES, cmds[1], cmds[2]);
		}
	}
};

R.MarkLeaves = function()
{
	if ((R.oldviewleaf === R.viewleaf) && (R.novis.value === 0))
		return;
	++R.visframecount;
	R.oldviewleaf = R.viewleaf;
	var vis = (R.novis.value !== 0) ? Mod.novis : Mod.LeafPVS(R.viewleaf, CL.state.worldmodel);
	var i, node;
	for (i = 0; i < CL.state.worldmodel.leafs.length; ++i)
	{
		if ((vis[i >> 3] & (1 << (i & 7))) === 0)
			continue;
		for (node = CL.state.worldmodel.leafs[i + 1]; node != null; node = node.parent)
		{
			if (node.markvisframe === R.visframecount)
				break;
			node.markvisframe = R.visframecount;
		}
	}
	do
	{
		if (R.novis.value !== 0)
			break;
		var p = [R.refdef.vieworg[0], R.refdef.vieworg[1], R.refdef.vieworg[2]];
		var leaf;
		if (R.viewleaf.contents <= Mod.contents.water)
		{
			leaf = Mod.PointInLeaf([R.refdef.vieworg[0], R.refdef.vieworg[1], R.refdef.vieworg[2] + 16.0], CL.state.worldmodel);
			if (leaf.contents <= Mod.contents.water)
				break;
		}
		else
		{
			leaf = Mod.PointInLeaf([R.refdef.vieworg[0], R.refdef.vieworg[1], R.refdef.vieworg[2] - 16.0], CL.state.worldmodel);
			if (leaf.contents > Mod.contents.water)
				break;
		}
		if (leaf === R.viewleaf)
			break;
		vis = Mod.LeafPVS(leaf, CL.state.worldmodel);
		for (i = 0; i < CL.state.worldmodel.leafs.length; ++i)
		{
			if ((vis[i >> 3] & (1 << (i & 7))) === 0)
				continue;
			for (node = CL.state.worldmodel.leafs[i + 1]; node != null; node = node.parent)
			{
				if (node.markvisframe === R.visframecount)
					break;
				node.markvisframe = R.visframecount;
			}
		}
	} while (false);
	R.drawsky = false;
	R.RecursiveWorldNode(CL.state.worldmodel.nodes[0]);
};

R.AllocBlock = function(surf)
{
	var w = (surf.extents[0] >> 4) + 1, h = (surf.extents[1] >> 4) + 1;
	var x, y, i, j, best = 1024, best2;
	for (i = 0; i < (1024 - w); ++i)
	{
		best2 = 0;
		for (j = 0; j < w; ++j)
		{
			if (R.allocated[i + j] >= best)
				break;
			if (R.allocated[i + j] > best2)
				best2 = R.allocated[i + j];
		}
		if (j === w)
		{
			x = i;
			y = best = best2;
		}
	}
	best += h;
	if (best > 1024)
		Sys.Error('AllocBlock: full');
	for (i = 0; i < w; ++i)
		R.allocated[x + i] = best;
	surf.light_s = x;
	surf.light_t = y;
};

// Based on Quake 2 polygon generation algorithm by Toji - http://blog.tojicode.com/2010/06/quake-2-bsp-quite-possibly-worst-format.html
R.BuildSurfaceDisplayList = function(fa)
{
	fa.verts = [];
	if (fa.numedges <= 2)
		return;
	var i, index, vec, vert, s, t;
	var texinfo = R.currentmodel.texinfo[fa.texinfo];
	var texture = R.currentmodel.textures[texinfo.texture];
	for (i = 0; i < fa.numedges; ++i)
	{
		index = R.currentmodel.surfedges[fa.firstedge + i];
		if (index > 0)
			vec = R.currentmodel.vertexes[R.currentmodel.edges[index][0]];
		else
			vec = R.currentmodel.vertexes[R.currentmodel.edges[-index][1]];
		vert = [vec[0], vec[1], vec[2]];
		if (fa.sky !== true)
		{
			s = Vec.DotProduct(vec, texinfo.vecs[0]) + texinfo.vecs[0][3];
			t = Vec.DotProduct(vec, texinfo.vecs[1]) + texinfo.vecs[1][3];
			vert[3] = s / texture.width;
			vert[4] = t / texture.height;
			if (fa.turbulent !== true)
			{
				vert[5] = (s - fa.texturemins[0] + (fa.light_s << 4) + 8.0) / 16384.0;
				vert[6] = (t - fa.texturemins[1] + (fa.light_t << 4) + 8.0) / 16384.0;
			}
		}
		if (i >= 3)
		{
			fa.verts[fa.verts.length] = fa.verts[0];
			fa.verts[fa.verts.length] = fa.verts[fa.verts.length - 2];
		}
		fa.verts[fa.verts.length] = vert;
	}
};

R.BuildLightmaps = function()
{
	var i, j;

	R.allocated = [];
	for (i = 0; i < 1024; ++i)
		R.allocated[i] = 0;

	var surf;
	for (i = 1; i < CL.state.model_precache.length; ++i)
	{
		R.currentmodel = CL.state.model_precache[i];
		if (R.currentmodel.type !== Mod.type.brush)
			continue;
		if (R.currentmodel.name.charCodeAt(0) !== 42)
		{
			for (j = 0; j < R.currentmodel.faces.length; ++j)
			{
				surf = R.currentmodel.faces[j];
				if ((surf.sky !== true) && (surf.turbulent !== true))
				{
					R.AllocBlock(surf);
					if (R.currentmodel.lightdata != null)
						R.BuildLightMap(surf);
				}
				R.BuildSurfaceDisplayList(surf);
			}
		}
		if (i === 1)
			R.MakeWorldModelDisplayLists(R.currentmodel);
		else
			R.MakeBrushModelDisplayLists(R.currentmodel);
	}

	GL.Bind(0, R.lightmap_texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1024, 1024, 0, gl.RGBA, gl.UNSIGNED_BYTE, R.lightmaps);
};

// scan

R.WarpScreen = function()
{
	GL.StreamFlush();
	gl.finish();
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	var program = GL.UseProgram('Warp');
	GL.Bind(program.tTexture, R.warptexture);
	gl.uniform1f(program.uTime, Host.realtime % (Math.PI * 2.0));
	var vrect = R.refdef.vrect;
	GL.StreamDrawTexturedQuad(vrect.x, vrect.y, vrect.width, vrect.height, 0.0, 1.0, 1.0, 0.0);
	GL.StreamFlush();
};

// warp

R.MakeSky = function()
{
	var sin = [0.0, 0.19509, 0.382683, 0.55557, 0.707107, 0.831470, 0.92388, 0.980785, 1.0];
	var vecs = [], i, j;

	for (i = 0; i < 7; i += 2)
	{
		vecs = vecs.concat(
		[
			0.0, 0.0, 1.0,
			sin[i + 2] * 0.19509, sin[6 - i] * 0.19509, 0.980785,
			sin[i] * 0.19509, sin[8 - i] * 0.19509, 0.980785
		]);
		for (j = 0; j < 7; ++j)
		{
			vecs = vecs.concat(
			[
				sin[i] * sin[8 - j], sin[8 - i] * sin[8 - j], sin[j],
				sin[i] * sin[7 - j], sin[8 - i] * sin[7 - j], sin[j + 1],
				sin[i + 2] * sin[7 - j], sin[6 - i] * sin[7 - j], sin[j + 1],

				sin[i] * sin[8 - j], sin[8 - i] * sin[8 - j], sin[j],
				sin[i + 2] * sin[7 - j], sin[6 - i] * sin[7 - j], sin[j + 1],
				sin[i + 2] * sin[8 - j], sin[6 - i] * sin[8 - j], sin[j]
			]);
		}
	}

	GL.CreateProgram('Sky',
		['uViewAngles', 'uPerspective', 'uScale', 'uGamma', 'uTime'],
		[['aPosition', gl.FLOAT, 3]],
		['tSolid', 'tAlpha']);
	GL.CreateProgram('SkyChain',
		['uViewOrigin', 'uViewAngles', 'uPerspective'],
		[['aPosition', gl.FLOAT, 3]],
		[]);

	R.skyvecs = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, R.skyvecs);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vecs), gl.STATIC_DRAW);
};

R.DrawSkyBox = function()
{
	if (R.drawsky !== true)
		return;

	gl.colorMask(false, false, false, false);
	var clmodel = CL.state.worldmodel;
	var program = GL.UseProgram('SkyChain');
	gl.bindBuffer(gl.ARRAY_BUFFER, clmodel.cmds);
	gl.vertexAttribPointer(program.aPosition.location, 3, gl.FLOAT, false, 12, clmodel.skychain);
	var i, j, leaf, cmds;
	for (i = 0; i < clmodel.leafs.length; ++i)
	{
		leaf = clmodel.leafs[i];
		if ((leaf.visframe !== R.visframecount) || (leaf.skychain === leaf.waterchain))
			continue;
		if (R.CullBox(leaf.mins, leaf.maxs) === true)
			continue;
		for (j = leaf.skychain; j < leaf.waterchain; ++j)
		{
			cmds = leaf.cmds[j];
			gl.drawArrays(gl.TRIANGLES, cmds[0], cmds[1]);
		}
	}
	gl.colorMask(true, true, true, true);

	gl.depthFunc(gl.GREATER);
	gl.depthMask(false);
	gl.disable(gl.CULL_FACE);

	program = GL.UseProgram('Sky');
	gl.uniform2f(program.uTime, (Host.realtime * 0.125) % 1.0, (Host.realtime * 0.03125) % 1.0);
	GL.Bind(program.tSolid, R.solidskytexture);
	GL.Bind(program.tAlpha, R.alphaskytexture);
	gl.bindBuffer(gl.ARRAY_BUFFER, R.skyvecs);
	gl.vertexAttribPointer(program.aPosition.location, 3, gl.FLOAT, false, 12, 0);

	gl.uniform3f(program.uScale, 2.0, -2.0, 1.0);
	gl.drawArrays(gl.TRIANGLES, 0, 180);
	gl.uniform3f(program.uScale, 2.0, -2.0, -1.0);
	gl.drawArrays(gl.TRIANGLES, 0, 180);

	gl.uniform3f(program.uScale, 2.0, 2.0, 1.0);
	gl.drawArrays(gl.TRIANGLES, 0, 180);
	gl.uniform3f(program.uScale, 2.0, 2.0, -1.0);
	gl.drawArrays(gl.TRIANGLES, 0, 180);

	gl.uniform3f(program.uScale, -2.0, -2.0, 1.0);
	gl.drawArrays(gl.TRIANGLES, 0, 180);
	gl.uniform3f(program.uScale, -2.0, -2.0, -1.0);
	gl.drawArrays(gl.TRIANGLES, 0, 180);

	gl.uniform3f(program.uScale, -2.0, 2.0, 1.0);
	gl.drawArrays(gl.TRIANGLES, 0, 180);
	gl.uniform3f(program.uScale, -2.0, 2.0, -1.0);
	gl.drawArrays(gl.TRIANGLES, 0, 180);

	gl.enable(gl.CULL_FACE);
	gl.depthMask(true);
	gl.depthFunc(gl.LESS);
};

R.InitSky = function(src)
{
	var i, j, p;
	var trans = new ArrayBuffer(65536);
	var trans32 = new Uint32Array(trans);

	for (i = 0; i < 128; ++i)
	{
		for (j = 0; j < 128; ++j)
			trans32[(i << 7) + j] = COM.LittleLong(VID.d_8to24table[src[(i << 8) + j + 128]] + 0xff000000);
	}
	GL.Bind(0, R.solidskytexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 128, 128, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(trans));
	gl.generateMipmap(gl.TEXTURE_2D);

	for (i = 0; i < 128; ++i)
	{
		for (j = 0; j < 128; ++j)
		{
			p = (i << 8) + j;
			if (src[p] !== 0)
				trans32[(i << 7) + j] = COM.LittleLong(VID.d_8to24table[src[p]] + 0xff000000);
			else
				trans32[(i << 7) + j] = 0;
		}
	}
	GL.Bind(0, R.alphaskytexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 128, 128, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(trans));
	gl.generateMipmap(gl.TEXTURE_2D);
};

// ---- WebQuake/S.js ----
S = {};

S.channels = [];
S.static_channels = [];
S.ambient_channels = [];

S.listener_origin = [0.0, 0.0, 0.0];
S.listener_forward = [0.0, 0.0, 0.0];
S.listener_right = [0.0, 0.0, 0.0];
S.listener_up = [0.0, 0.0, 0.0];

S.known_sfx = [];

S.Init = function()
{
	Con.Print('\nSound Initialization\n');
	Cmd.AddCommand('play', S.Play);
	Cmd.AddCommand('playvol', S.PlayVol);
	Cmd.AddCommand('stopsound', S.StopAllSounds);
	Cmd.AddCommand('soundlist', S.SoundList);
	S.nosound = Cvar.RegisterVariable('nosound', (COM.CheckParm('-nosound') != null) ? '1' : '0');
	S.volume = Cvar.RegisterVariable('volume', '0.7', true);
	S.precache = Cvar.RegisterVariable('precache', '1');
	S.bgmvolume = Cvar.RegisterVariable('bgmvolume', '1', true);
	S.ambient_level = Cvar.RegisterVariable('ambient_level', '0.3');
	S.ambient_fade = Cvar.RegisterVariable('ambient_fade', '100');

	S.started = true;

	// Ghosty: Web Audio, from the context the page made in the tap that started the game (Sys.audio, played
	// into Sys.audioOut); with none, the game starts with -nosound.
	S.context = Sys.audio;

	var i, ambient_sfx = ['water1', 'wind2'], ch, nodes;
	for (i = 0; i < ambient_sfx.length; ++i)
	{
		ch = {sfx: S.PrecacheSound('ambience/' + ambient_sfx[i] + '.wav'), end: 0.0, master_vol: 0.0};
		S.ambient_channels[i] = ch;
		if (S.LoadSound(ch.sfx) !== true)
			continue;
		if (ch.sfx.cache.loopstart == null)
		{
			Con.Print('Sound ambience/' + ch.sfx.name + '.wav not looped\n');
			continue;
		}
		if (S.context != null)
		{
			nodes = {
				source: S.context.createBufferSource(),
				gain: S.context.createGain()
			};
			ch.nodes = nodes;
			nodes.source.buffer = ch.sfx.cache.data;
			nodes.source.loop = true;
			nodes.source.loopStart = ch.sfx.cache.loopstart;
			nodes.source.loopEnd = nodes.source.buffer.length;
			nodes.source.connect(nodes.gain);
			nodes.gain.connect(Sys.audioOut);
		}
		else
			ch.audio = ch.sfx.cache.data.cloneNode();
	}

	Con.sfx_talk = S.PrecacheSound('misc/talk.wav');
};

// Ghosty: today's Web Audio (start and stop, once each) in place of noteOn, noteOff and playbackState; a stopped
// source is let go of (every caller is done with it).
S.NoteOff = function(node)
{
	if (node.playing === true)
	{
		node.playing = false;
		try { node.stop(0.0); } catch (e) {}
	}
	try { node.disconnect(); } catch (e) {}
}

S.NoteOn = function(node)
{
	if (node.started !== true)
	{
		node.started = node.playing = true;
		try { node.start(0.0); } catch (e) {}
	}
}

S.PrecacheSound = function(name)
{
	if (S.nosound.value !== 0)
		return;
	var i, sfx;
	for (i = 0; i < S.known_sfx.length; ++i)
	{
		if (S.known_sfx[i].name === name)
		{
			sfx = S.known_sfx[i];
			break;
		}
	}
	if (i === S.known_sfx.length)
	{
		S.known_sfx[i] = {name: name};
		sfx = S.known_sfx[i];
	}
	if (S.precache.value !== 0)
		S.LoadSound(sfx);
	return sfx;
};

S.PickChannel = function(entnum, entchannel)
{
	var i, channel;

	if (entchannel !== 0)
	{
		for (i = 0; i < S.channels.length; ++i)
		{
			channel = S.channels[i];
			if (channel == null)
				continue;
			if ((channel.entnum === entnum) && ((channel.entchannel === entchannel) || (entchannel === -1)))
			{
				channel.sfx = null;
				if (channel.nodes != null)
				{
					S.NoteOff(channel.nodes.source);
					channel.nodes = null;
				}
				else if (channel.audio != null)
				{
					channel.audio.pause();
					channel.audio = null;
				}
				break;
			}
		}
	}

	if ((entchannel === 0) || (i === S.channels.length))
	{
		for (i = 0; i < S.channels.length; ++i)
		{
			channel = S.channels[i];
			if (channel == null)
				break;
			if (channel.sfx == null)
				break;
		}
	}

	if (i === S.channels.length)
	{
		S.channels[i] = {end: 0.0};
		return S.channels[i];
	}
	return channel;
};

S.Spatialize = function(ch)
{
	if (ch.entnum === CL.state.viewentity)
	{
		ch.leftvol = ch.master_vol;
		ch.rightvol = ch.master_vol;
		return;
	}

	var source = [
		ch.origin[0] - S.listener_origin[0],
		ch.origin[1] - S.listener_origin[1],
		ch.origin[2] - S.listener_origin[2]
	];
	var dist = Math.sqrt(source[0] * source[0] + source[1] * source[1] + source[2] * source[2]);
	if (dist !== 0.0)
	{
		source[0] /= dist;
		source[1] /= dist;
		source[2] /= dist;
	}
	dist *= ch.dist_mult;
	var dot = S.listener_right[0] * source[0]
		+ S.listener_right[1] * source[1]
		+ S.listener_right[2] * source[2];

	ch.rightvol = ch.master_vol * (1.0 - dist) * (1.0 + dot);
	if (ch.rightvol < 0.0)
		ch.rightvol = 0.0;
	ch.leftvol = ch.master_vol * (1.0 - dist) * (1.0 - dot);
	if (ch.leftvol < 0.0)
		ch.leftvol = 0.0;
};

S.StartSound = function(entnum, entchannel, sfx, origin, vol, attenuation)
{
	if ((S.nosound.value !== 0) || (sfx == null))
		return;

	var target_chan = S.PickChannel(entnum, entchannel);
	target_chan.origin = [origin[0], origin[1], origin[2]];
	target_chan.dist_mult = attenuation * 0.001;
	target_chan.master_vol = vol;
	target_chan.entnum = entnum;
	target_chan.entchannel = entchannel;
	S.Spatialize(target_chan);
	if ((target_chan.leftvol === 0.0) && (target_chan.rightvol === 0.0))
		return;

	if (S.LoadSound(sfx) !== true)
	{
		target_chan.sfx = null;
		return;
	}

	target_chan.sfx = sfx;
	target_chan.pos = 0.0;
	target_chan.end = Host.realtime + sfx.cache.length;
	var volume;
	if (S.context != null)
	{
		var nodes = {
			source: S.context.createBufferSource(),
			merger1: S.context.createChannelMerger(2),
			splitter: S.context.createChannelSplitter(2),
			gain0: S.context.createGain(),
			gain1: S.context.createGain(),
			merger2: S.context.createChannelMerger(2)
		};
		target_chan.nodes = nodes;
		nodes.source.buffer = sfx.cache.data;
		if (sfx.cache.loopstart != null)
		{
			nodes.source.loop = true;
			nodes.source.loopStart = sfx.cache.loopstart;
			nodes.source.loopEnd = nodes.source.buffer.length;
		}
		nodes.source.connect(nodes.merger1);
		nodes.source.connect(nodes.merger1, 0, 1);
		nodes.merger1.connect(nodes.splitter);
		nodes.splitter.connect(nodes.gain0, 0);
		nodes.splitter.connect(nodes.gain1, 1);
		volume = target_chan.leftvol;
		if (volume > 1.0)
			volume = 1.0;
		nodes.gain0.gain.value = volume * S.volume.value;
		nodes.gain0.connect(nodes.merger2, 0, 0);
		volume = target_chan.rightvol;
		if (volume > 1.0)
			volume = 1.0;
		nodes.gain1.gain.value = volume * S.volume.value;
		nodes.gain1.connect(nodes.merger2, 0, 1);
		nodes.merger2.connect(Sys.audioOut);
		var i, check, skip;
		for (i = 0; i < S.channels.length; ++i)
		{
			check = S.channels[i];
			if (check === target_chan)
				continue;
			if ((check.sfx !== sfx) || (check.pos !== 0.0))
				continue;
			skip = Math.random() * 0.1;
			if (skip >= sfx.cache.length)
			{
				S.NoteOn(nodes.source);
				break;
			}
			target_chan.pos += skip;
			target_chan.end -= skip;
			nodes.source.started = nodes.source.playing = true;
			nodes.source.start(0.0, skip);
			break;
		}
		S.NoteOn(nodes.source);
	}
	else
	{
		target_chan.audio = sfx.cache.data.cloneNode();
		volume = (target_chan.leftvol + target_chan.rightvol) * 0.5;
		if (volume > 1.0)
			volume = 1.0;
		target_chan.audio.volume = volume * S.volume.value;
		target_chan.audio.play();
	}
};

S.StopSound = function(entnum, entchannel)
{
	if (S.nosound.value !== 0)
		return;
	var i, ch;
	for (i = 0; i < S.channels.length; ++i)
	{
		ch = S.channels[i];
		if (ch == null)
			continue;
		if ((ch.entnum === entnum) && (ch.entchannel === entchannel))
		{
			ch.end = 0.0;
			ch.sfx = null;
			if (ch.nodes != null)
			{
				S.NoteOff(ch.nodes.source);
				ch.nodes = null;
			}
			else if (ch.audio != null)
			{
				ch.audio.pause();
				ch.audio = null;
			}
			return;
		}
	}
};

S.StopAllSounds = function()
{
	if (S.nosound.value !== 0)
		return;

	var i, ch;

	for (i = 0; i < S.ambient_channels.length; ++i)
	{
		ch = S.ambient_channels[i];
		ch.master_vol = 0.0;
		if (ch.nodes != null)
			ch.nodes.gain.gain.value = 0.0; // Ghosty: silent, still looping (a stopped source never starts again)
		else if (ch.audio != null)
			ch.audio.pause();
	}

	for (i = 0; i < S.channels.length; ++i)
	{
		ch = S.channels[i];
		if (ch == null)
			continue;
		if (ch.nodes != null)
			S.NoteOff(ch.nodes.source);
		else if (ch.audio != null)
			ch.audio.pause();
	}
	S.channels = [];

	if (S.context != null)
	{
		for (i = 0; i < S.static_channels.length; ++i)
			S.NoteOff(S.static_channels[i].nodes.source);
	}
	else
	{
		for (i = 0; i < S.static_channels.length; ++i)
			S.static_channels[i].audio.pause();
	}
	S.static_channels = [];
};

S.StaticSound = function(sfx, origin, vol, attenuation)
{
	if ((S.nosound.value !== 0) || (sfx == null))
		return;
	if (S.LoadSound(sfx) !== true)
		return;
	if (sfx.cache.loopstart == null)
	{
		Con.Print('Sound ' + sfx.name + ' not looped\n');
		return;
	}
	var ss = {
		sfx: sfx,
		origin: [origin[0], origin[1], origin[2]],
		master_vol: vol,
		dist_mult: attenuation * 0.000015625,
		end: Host.realtime + sfx.cache.length
	};
	S.static_channels[S.static_channels.length] = ss;
	if (S.context != null)
	{
		var nodes = {
			source: S.context.createBufferSource(),
			merger1: S.context.createChannelMerger(2),
			splitter: S.context.createChannelSplitter(2),
			gain0: S.context.createGain(),
			gain1: S.context.createGain(),
			merger2: S.context.createChannelMerger(2)
		};
		ss.nodes = nodes;
		nodes.source.buffer = sfx.cache.data;
		nodes.source.loop = true;
		nodes.source.loopStart = sfx.cache.loopstart;
		nodes.source.loopEnd = nodes.source.buffer.length;
		nodes.source.connect(nodes.merger1);
		nodes.source.connect(nodes.merger1, 0, 1);
		nodes.merger1.connect(nodes.splitter);
		nodes.splitter.connect(nodes.gain0, 0);
		nodes.splitter.connect(nodes.gain1, 1);
		nodes.gain0.connect(nodes.merger2, 0, 0);
		nodes.gain1.connect(nodes.merger2, 0, 1);
		nodes.merger2.connect(Sys.audioOut);
	}
	else
	{
		ss.audio = sfx.cache.data.cloneNode();
		ss.audio.pause();
	}
};

S.SoundList = function()
{
	var total = 0, i, sfx, sc, size;
	for (i = 0; i < S.known_sfx.length; ++i)
	{
		sfx = S.known_sfx[i];
		sc = sfx.cache;
		if (sc == null)
			continue;
		size = sc.size.toString();
		total += sc.size;
		for (; size.length <= 5; )
			size = ' ' + size;
		if (sc.loopstart != null)
			size = 'L' + size;
		else
			size = ' ' + size;
		Con.Print(size + ' : ' + sfx.name + '\n');
	}
	Con.Print('Total resident: ' + total + '\n');
};

S.LocalSound = function(sound)
{
	S.StartSound(CL.state.viewentity, -1, sound, Vec.origin, 1.0, 1.0);
};

S.UpdateAmbientSounds = function()
{
	if (CL.state.worldmodel == null)
		return;

	var i, ch, vol, sc;

	var l = Mod.PointInLeaf(S.listener_origin, CL.state.worldmodel);
	if ((l == null) || (S.ambient_level.value === 0))
	{
		for (i = 0; i < S.ambient_channels.length; ++i)
		{
			ch = S.ambient_channels[i];
			ch.master_vol = 0.0;
			if (ch.nodes != null)
			{
				ch.nodes.gain.gain.value = 0.0; // Ghosty: silent, still looping
			}
			else if (ch.audio != null)
			{
				if (ch.audio.paused !== true)
					ch.audio.pause();
			}
		}
		return;
	}

	for (i = 0; i < S.ambient_channels.length; ++i)
	{
		ch = S.ambient_channels[i];
		if ((ch.nodes == null) && (ch.audio == null))
			continue;
		vol = S.ambient_level.value * l.ambient_level[i];
		if (vol < 8.0)
			vol = 0.0;
		vol /= 255.0;
		if (ch.master_vol < vol)
		{
			ch.master_vol += (Host.frametime * S.ambient_fade.value) / 255.0;
			if (ch.master_vol > vol)
				ch.master_vol = vol;
		}
		else if (ch.master_vol > vol)
		{
			ch.master_vol -= (Host.frametime * S.ambient_fade.value) / 255.0;
			if (ch.master_vol < vol)
				ch.master_vol = vol;
		}

		if (ch.master_vol === 0.0)
		{
			if (S.context != null)
			{
				ch.nodes.gain.gain.value = 0.0; // Ghosty: silent, still looping
			}
			else
			{
				if (ch.audio.paused !== true)
					ch.audio.pause();
			}
			continue;
		}
		if (ch.master_vol > 1.0)
			ch.master_vol = 1.0;
		if (S.context != null)
		{
			ch.nodes.gain.gain.value = ch.master_vol * S.volume.value;
			S.NoteOn(ch.nodes.source);
		}
		else
		{
			ch.audio.volume = ch.master_vol * S.volume.value;
			sc = ch.sfx.cache;
			if (ch.audio.paused === true)
			{
				ch.audio.play();
				ch.end = Host.realtime + sc.length;
				continue;
			}
			if (Host.realtime >= ch.end)
			{
				try
				{
					ch.audio.currentTime = sc.loopstart;
				}
				catch (e)
				{
					ch.end = Host.realtime;
					continue;
				}
				ch.end = Host.realtime + sc.length - sc.loopstart;
			}
		}
	}
};

S.UpdateDynamicSounds = function()
{
	var i, ch, sc, volume;
	for (i = 0; i < S.channels.length; ++i)
	{
		ch = S.channels[i];
		if (ch == null)
			continue;
		if (ch.sfx == null)
			continue;
		if (Host.realtime >= ch.end)
		{
			sc = ch.sfx.cache;
			if (sc.loopstart != null)
			{
				if (S.context == null)
				{
					try
					{
						ch.audio.currentTime = sc.loopstart;
					}
					catch (e)
					{
						ch.end = Host.realtime;
						continue;
					}
				}
				ch.end = Host.realtime + sc.length - sc.loopstart;
			}
			else
			{
				ch.sfx = null;
				ch.nodes = null;
				ch.audio = null;
				continue;
			}
		}
		S.Spatialize(ch);
		if (S.context != null)
		{
			if (ch.leftvol > 1.0)
				ch.leftvol = 1.0;
			if (ch.rightvol > 1.0)
				ch.rightvol = 1.0;
			ch.nodes.gain0.gain.value = ch.leftvol * S.volume.value; // Ghosty: .value (was .volume)
			ch.nodes.gain1.gain.value = ch.rightvol * S.volume.value;
		}
		else
		{
			volume = (ch.leftvol + ch.rightvol) * 0.5;
			if (volume > 1.0)
				volume = 1.0;
			ch.audio.volume = volume * S.volume.value;
		}
	}
};

S.UpdateStaticSounds = function()
{
	var i, j, ch, ch2, sfx, sc, volume;

	for (i = 0; i < S.static_channels.length; ++i)
		S.Spatialize(S.static_channels[i]);

	for (i = 0; i < S.static_channels.length; ++i)
	{
		ch = S.static_channels[i];
		if ((ch.leftvol === 0.0) && (ch.rightvol === 0.0))
			continue;
		sfx = ch.sfx;
		for (j = i + 1; j < S.static_channels.length; ++j)
		{
			ch2 = S.static_channels[j];
			if (sfx === ch2.sfx)
			{
				ch.leftvol += ch2.leftvol;
				ch.rightvol += ch2.rightvol;
				ch2.leftvol = 0.0;
				ch2.rightvol = 0.0;
			}
		}
	}

	if (S.context != null)
	{
		for (i = 0; i < S.static_channels.length; ++i)
		{
			ch = S.static_channels[i];
			if ((ch.leftvol === 0.0) && (ch.rightvol === 0.0))
			{
				ch.nodes.gain0.gain.value = ch.nodes.gain1.gain.value = 0.0; // Ghosty: silent, still looping
				continue;
			}
			if (ch.leftvol > 1.0)
				ch.leftvol = 1.0;
			if (ch.rightvol > 1.0)
				ch.rightvol = 1.0;
			ch.nodes.gain0.gain.value = ch.leftvol * S.volume.value;
			ch.nodes.gain1.gain.value = ch.rightvol * S.volume.value;
			S.NoteOn(ch.nodes.source);
		}
	}
	else
	{
		for (i = 0; i < S.static_channels.length; ++i)
		{
			ch = S.static_channels[i];
			volume = (ch.leftvol + ch.rightvol) * 0.5;
			if (volume > 1.0)
				volume = 1.0;
			if (volume === 0.0)
			{
				if (ch.audio.paused !== true)
					ch.audio.pause();
				continue;
			}
			ch.audio.volume = volume * S.volume.value;
			sc = ch.sfx.cache;
			if (ch.audio.paused === true)
			{
				ch.audio.play();
				ch.end = Host.realtime + sc.length;
				continue;
			}
			if (Host.realtime >= ch.end)
			{
				try
				{
					ch.audio.currentTime = sc.loopstart;
				}
				catch (e)
				{
					ch.end = Host.realtime;
					continue;
				}
			}
		}
	}
};

S.Update = function(origin, forward, right, up)
{
	if (S.nosound.value !== 0)
		return;

	S.listener_origin[0] = origin[0];
	S.listener_origin[1] = origin[1];
	S.listener_origin[2] = origin[2];
	S.listener_forward[0] = forward[0];
	S.listener_forward[1] = forward[1];
	S.listener_forward[2] = forward[2];
	S.listener_right[0] = right[0];
	S.listener_right[1] = right[1];
	S.listener_right[2] = right[2];
	S.listener_up[0] = up[0];
	S.listener_up[1] = up[1];
	S.listener_up[2] = up[2];

	if (S.volume.value < 0.0)
		Cvar.SetValue('volume', 0.0);
	else if (S.volume.value > 1.0)
		Cvar.SetValue('volume', 1.0);

	S.UpdateAmbientSounds();
	S.UpdateDynamicSounds();
	S.UpdateStaticSounds();
};

S.Play = function()
{
	if (S.nosound.value !== 0)
		return;
	var i, sfx;
	for (i = 1; i < Cmd.argv.length; ++i)
	{
		sfx = S.PrecacheSound(COM.DefaultExtension(Cmd.argv[i], '.wav'));
		if (sfx != null)
			S.StartSound(CL.state.viewentity, 0, sfx, S.listener_origin, 1.0, 1.0);
	}
};

S.PlayVol = function()
{
	if (S.nosound.value !== 0)
		return;
	var i, sfx;
	for (i = 1; i < Cmd.argv.length; i += 2)
	{
		sfx = S.PrecacheSound(COM.DefaultExtension(Cmd.argv[i], '.wav'));
		if (sfx != null)
			S.StartSound(CL.state.viewentity, 0, sfx, S.listener_origin, Q.atof(Cmd.argv[i + 1]), 1.0);
	}
};

S.LoadSound = function(s)
{
	if (S.nosound.value !== 0)
		return;
	if (s.cache != null)
		return true;

	var sc = {};

	var data = COM.LoadFile('sound/' + s.name);
	if (data == null)
	{
		Con.Print('Couldn\'t load sound/' + s.name + '\n');
		return;
	}

	var view = new DataView(data);
	if ((view.getUint32(0, true) !== 0x46464952) || (view.getUint32(8, true) !== 0x45564157))
	{
		Con.Print('Missing RIFF/WAVE chunks\n');
		return;
	}
	var p, fmt, dataofs, datalen, cue, loopstart, samples;
	for (p = 12; p < data.byteLength; )
	{
		switch (view.getUint32(p, true))
		{
		case 0x20746d66: // fmt
			if (view.getInt16(p + 8, true) !== 1)
			{
				Con.Print('Microsoft PCM format only\n');
				return;
			}
			fmt = {
				channels: view.getUint16(p + 10, true),
				samplesPerSec: view.getUint32(p + 12, true),
				avgBytesPerSec: view.getUint32(p + 16, true),
				blockAlign: view.getUint16(p + 20, true),
				bitsPerSample: view.getUint16(p + 22, true)
			};
			break;
		case 0x61746164: // data
			dataofs = p + 8;
			datalen = view.getUint32(p + 4, true);
			break;
		case 0x20657563: // cue
			cue = true;
			loopstart = view.getUint32(p + 32, true);
			break;
		case 0x5453494c: // LIST
			if (cue !== true)
				break;
			cue = false;
			if (view.getUint32(p + 28, true) === 0x6b72616d)
				samples = loopstart + view.getUint32(p + 24, true);
			break;
		}
		p += view.getUint32(p + 4, true) + 8;
		if ((p & 1) !== 0)
			++p;
	}

	if (fmt == null)
	{
		Con.Print('Missing fmt chunk\n');
		return;
	}
	if (dataofs == null)
	{
		Con.Print('Missing data chunk\n');
		return;
	}
	if (loopstart != null)
		sc.loopstart = loopstart * fmt.blockAlign / fmt.samplesPerSec;
	if (samples != null)
		sc.length = samples / fmt.samplesPerSec;
	else
		sc.length = datalen / fmt.avgBytesPerSec;

	sc.size = datalen + 44;
	if ((sc.size & 1) !== 0)
		++sc.size;
	var out = new ArrayBuffer(sc.size);
	view = new DataView(out);
	view.setUint32(0, 0x46464952, true); // RIFF
	view.setUint32(4, sc.size - 8, true);
	view.setUint32(8, 0x45564157, true); // WAVE
	view.setUint32(12, 0x20746d66, true); // fmt
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, fmt.channels, true);
	view.setUint32(24, fmt.samplesPerSec, true);
	view.setUint32(28, fmt.avgBytesPerSec, true);
	view.setUint16(32, fmt.blockAlign, true);
	view.setUint16(34, fmt.bitsPerSample, true);
	view.setUint32(36, 0x61746164, true); // data
	view.setUint32(40, datalen, true);
	(new Uint8Array(out, 44, datalen)).set(new Uint8Array(data, dataofs, datalen));
	if (S.context != null)
		sc.data = Sys.WavBuffer(out); // Ghosty: the samples decoded here (createBuffer(data) is long gone)
	else
		sc.data = new Audio('data:audio/wav;base64,' + Q.btoa(new Uint8Array(out)));

	s.cache = sc;
	return true;
};

// ---- WebQuake/Sbar.js ----
Sbar = {};

Sbar.ShowScores = function()
{
	Sbar.showscores = true;
};

Sbar.DontShowScores = function()
{
	Sbar.showscores = false;
};

Sbar.Init = function()
{
	var i;

	Sbar.nums = [[], []];
	for (i = 0; i < 10; ++i)
	{
		Sbar.nums[0][i] = Draw.PicFromWad('NUM_' + i);
		Sbar.nums[1][i] = Draw.PicFromWad('ANUM_' + i);
	}
	Sbar.nums[0][10] = Draw.PicFromWad('NUM_MINUS');
	Sbar.nums[1][10] = Draw.PicFromWad('ANUM_MINUS');
	Sbar.colon = Draw.PicFromWad('NUM_COLON');
	Sbar.slash = Draw.PicFromWad('NUM_SLASH');

	Sbar.weapons = [
		[
			Draw.PicFromWad('INV_SHOTGUN'),
			Draw.PicFromWad('INV_SSHOTGUN'),
			Draw.PicFromWad('INV_NAILGUN'),
			Draw.PicFromWad('INV_SNAILGUN'),
			Draw.PicFromWad('INV_RLAUNCH'),
			Draw.PicFromWad('INV_SRLAUNCH'),
			Draw.PicFromWad('INV_LIGHTNG')
		],
		[
			Draw.PicFromWad('INV2_SHOTGUN'),
			Draw.PicFromWad('INV2_SSHOTGUN'),
			Draw.PicFromWad('INV2_NAILGUN'),
			Draw.PicFromWad('INV2_SNAILGUN'),
			Draw.PicFromWad('INV2_RLAUNCH'),
			Draw.PicFromWad('INV2_SRLAUNCH'),
			Draw.PicFromWad('INV2_LIGHTNG')
		]
	];
	for (i = 0; i <= 4; ++i)
	{
		Sbar.weapons[2 + i] = [
			Draw.PicFromWad('INVA' + (i + 1) + '_SHOTGUN'),
			Draw.PicFromWad('INVA' + (i + 1) + '_SSHOTGUN'),
			Draw.PicFromWad('INVA' + (i + 1) + '_NAILGUN'),
			Draw.PicFromWad('INVA' + (i + 1) + '_SNAILGUN'),
			Draw.PicFromWad('INVA' + (i + 1) + '_RLAUNCH'),
			Draw.PicFromWad('INVA' + (i + 1) + '_SRLAUNCH'),
			Draw.PicFromWad('INVA' + (i + 1) + '_LIGHTNG')
		];
	}

	Sbar.ammo = [
		Draw.PicFromWad('SB_SHELLS'),
		Draw.PicFromWad('SB_NAILS'),
		Draw.PicFromWad('SB_ROCKET'),
		Draw.PicFromWad('SB_CELLS')
	];

	Sbar.armor = [
		Draw.PicFromWad('SB_ARMOR1'),
		Draw.PicFromWad('SB_ARMOR2'),
		Draw.PicFromWad('SB_ARMOR3')
	];

	Sbar.items = [
		Draw.PicFromWad('SB_KEY1'),
		Draw.PicFromWad('SB_KEY2'),
		Draw.PicFromWad('SB_INVIS'),
		Draw.PicFromWad('SB_INVULN'),
		Draw.PicFromWad('SB_SUIT'),
		Draw.PicFromWad('SB_QUAD')
	];

	Sbar.sigil = [
		Draw.PicFromWad('SB_SIGIL1'),
		Draw.PicFromWad('SB_SIGIL2'),
		Draw.PicFromWad('SB_SIGIL3'),
		Draw.PicFromWad('SB_SIGIL4')
	];

	Sbar.faces = [];
	for (i = 0; i <= 4; ++i)
	{
		Sbar.faces[i] = [
			Draw.PicFromWad('FACE' + (5 - i)),
			Draw.PicFromWad('FACE_P' + (5 - i))
		];
	}
	Sbar.face_invis = Draw.PicFromWad('FACE_INVIS');
	Sbar.face_invuln = Draw.PicFromWad('FACE_INVUL2');
	Sbar.face_invis_invuln = Draw.PicFromWad('FACE_INV2');
	Sbar.face_quad = Draw.PicFromWad('FACE_QUAD');

	Cmd.AddCommand('+showscores', Sbar.ShowScores);
	Cmd.AddCommand('-showscores', Sbar.DontShowScores);

	Sbar.sbar = Draw.PicFromWad('SBAR');
	Sbar.ibar = Draw.PicFromWad('IBAR');
	Sbar.scorebar = Draw.PicFromWad('SCOREBAR');

	Sbar.ranking = Draw.CachePic('ranking');
	Sbar.complete = Draw.CachePic('complete');
	Sbar.inter = Draw.CachePic('inter');
	Sbar.finale = Draw.CachePic('finale');

	Sbar.disc = Draw.PicFromWad('DISC');

	if (COM.hipnotic === true)
	{
		Sbar.h_weapons = [[
			Draw.PicFromWad('INV_LASER'),
			Draw.PicFromWad('INV_MJOLNIR'),
			Draw.PicFromWad('INV_GREN_PROX'),
			Draw.PicFromWad('INV_PROX_GREN'),
			Draw.PicFromWad('INV_PROX')
		],
		[
			Draw.PicFromWad('INV2_LASER'),
			Draw.PicFromWad('INV2_MJOLNIR'),
			Draw.PicFromWad('INV2_GREN_PROX'),
			Draw.PicFromWad('INV2_PROX_GREN'),
			Draw.PicFromWad('INV2_PROX')
		]];
		for (i = 0; i <= 4; ++i)
		{
			Sbar.h_weapons[2 + i] = [
				Draw.PicFromWad('INVA' + (i + 1) + '_LASER'),
				Draw.PicFromWad('INVA' + (i + 1) + '_MJOLNIR'),
				Draw.PicFromWad('INVA' + (i + 1) + '_GREN_PROX'),
				Draw.PicFromWad('INVA' + (i + 1) + '_PROX_GREN'),
				Draw.PicFromWad('INVA' + (i + 1) + '_PROX')
			];
		}
		Sbar.hipweapons = [Def.hit.laser_cannon_bit, Def.hit.mjolnir_bit, 4, Def.hit.proximity_gun_bit];
		Sbar.h_items = [
			Draw.PicFromWad('SB_WSUIT'),
			Draw.PicFromWad('SB_ESHLD')
		];
	}
	else if (COM.rogue === true)
	{
		Sbar.r_invbar = [
			Draw.PicFromWad('R_INVBAR1'),
			Draw.PicFromWad('R_INVBAR2')
		];
		Sbar.r_weapons = [
			Draw.PicFromWad('R_LAVA'),
			Draw.PicFromWad('R_SUPERLAVA'),
			Draw.PicFromWad('R_GREN'),
			Draw.PicFromWad('R_MULTIROCK'),
			Draw.PicFromWad('R_PLASMA')
		];
		Sbar.r_items = [
			Draw.PicFromWad('R_SHIELD1'),
			Draw.PicFromWad('R_AGRAV1')
		];
		Sbar.r_teambord = Draw.PicFromWad('R_TEAMBORD');
		Sbar.r_ammo = [
			Draw.PicFromWad('R_AMMOLAVA'),
			Draw.PicFromWad('R_AMMOMULTI'),
			Draw.PicFromWad('R_AMMOPLASMA')
		];
	}
};

Sbar.DrawPic = function(x, y, pic)
{
	if (CL.state.gametype === 1)
		Draw.Pic(x, y + VID.height - 24, pic);
	else
		Draw.Pic(x + (VID.width >> 1) - 160, y + VID.height - 24, pic);
};

Sbar.DrawCharacter = function(x, y, num)
{
	if (CL.state.gametype === 1)
		Draw.Character(x + 4, y + VID.height - 24, num);
	else
		Draw.Character(x + (VID.width >> 1) - 156, y + VID.height - 24, num);
};

Sbar.DrawString = function(x, y, str)
{
	if (CL.state.gametype === 1)
		Draw.String(x, y + VID.height - 24, str);
	else
		Draw.String(x + (VID.width >> 1) - 160, y + VID.height - 24, str);
};

Sbar.DrawNum = function(x, y, num, digits, color)
{
	var str = num.toString();
	if (str.length > digits)
		str = str.substring(str.length - digits, str.length);
	else if (str.length < digits)
		x += (digits - str.length) * 24;
	var i, frame;
	for (i = 0; i < str.length; ++i)
	{
		frame = str.charCodeAt(i);
		Sbar.DrawPic(x, y, Sbar.nums[color][frame === 45 ? 10 : frame - 48]);
		x += 24;
	}
};

Sbar.fragsort = [];

Sbar.SortFrags = function()
{
	Sbar.scoreboardlines = 0;
	var i, j, k;
	for (i = 0; i < CL.state.maxclients; ++i)
	{
		if (CL.state.scores[i].name.length !== 0)
			Sbar.fragsort[Sbar.scoreboardlines++] = i;
	}
	for (i = 0; i < Sbar.scoreboardlines; ++i)
	{
		for (j = 0; j < (Sbar.scoreboardlines - 1 - i); ++j)
		{
			if (CL.state.scores[Sbar.fragsort[j]].frags < CL.state.scores[Sbar.fragsort[j + 1]].frags)
			{
				k = Sbar.fragsort[j];
				Sbar.fragsort[j] = Sbar.fragsort[j + 1];
				Sbar.fragsort[j + 1] = k;
			}
		}
	}
};

Sbar.SoloScoreboard = function()
{
	var str;

	Sbar.DrawString(8, 4, 'Monsters:    /');
	str = CL.state.stats[Def.stat.monsters].toString();
	Sbar.DrawString(104 - (str.length << 3), 4, str);
	str = CL.state.stats[Def.stat.totalmonsters].toString();
	Sbar.DrawString(144 - (str.length << 3), 4, str);

	Sbar.DrawString(8, 12, 'Secrets :    /');
	str = CL.state.stats[Def.stat.secrets].toString();
	Sbar.DrawString(104 - (str.length << 3), 12, str);
	str = CL.state.stats[Def.stat.totalsecrets].toString();
	Sbar.DrawString(144 - (str.length << 3), 12, str);

	var minutes = Math.floor(CL.state.time / 60.0);
	var seconds = Math.floor(CL.state.time - 60 * minutes);
	var tens = Math.floor(seconds / 10.0);
	str = (seconds - 10 * tens).toString();
	Sbar.DrawString(184, 4, 'Time :   :' + tens + str);
	str = minutes.toString();
	Sbar.DrawString(256 - (str.length << 3), 4, str);

	Sbar.DrawString(232 - (CL.state.levelname.length << 2), 12, CL.state.levelname);
};

Sbar.DrawInventory = function()
{
	var i;

	if (COM.rogue === true)
		Sbar.DrawPic(0, -24, Sbar.r_invbar[CL.state.stats[Def.stat.activeweapon] >= Def.rit.lava_nailgun ? 0 : 1]);
	else
		Sbar.DrawPic(0, -24, Sbar.ibar);

	var flashon;
	for (i = 0; i <= 6; ++i)
	{
		if ((CL.state.items & (Def.it.shotgun << i)) === 0)
			continue;
		flashon = Math.floor((CL.state.time - CL.state.item_gettime[i]) * 10.0);
		if (flashon >= 10)
			flashon = CL.state.stats[Def.stat.activeweapon] === (Def.it.shotgun << i) ? 1 : 0;
		else
			flashon = (flashon % 5) + 2;
		Sbar.DrawPic(i * 24, -16, Sbar.weapons[flashon][i]);
	}
	if (COM.hipnotic === true)
	{
		var grenadeflashing = false;
		for (i = 0; i <= 3; ++i)
		{
			if ((CL.state.items & (1 << Sbar.hipweapons[i])) !== 0)
			{
				flashon = Math.floor((CL.state.time - CL.state.item_gettime[i]) * 10.0);
				if (flashon >= 10)
					flashon = CL.state.stats[Def.stat.activeweapon] === (1 << Sbar.hipweapons[i]) ? 1 : 0;
				else
					flashon = (flashon % 5) + 2;

				if (i === 2)
				{
					if (((CL.state.items & Def.hit.proximity_gun) !== 0) && (flashon !== 0))
					{
						grenadeflashing = true;
						Sbar.DrawPic(96, -16, Sbar.h_weapons[flashon][2]);
					}
				}
				else if (i === 3)
				{
					if ((CL.state.items & Def.it.grenade_launcher) !== 0)
					{
						if (grenadeflashing !== true)
							Sbar.DrawPic(96, -16, Sbar.h_weapons[flashon][3]);
					}
					else
						Sbar.DrawPic(96, -16, Sbar.h_weapons[flashon][4]);
				}
				else
					Sbar.DrawPic(176 + i * 24, -16, Sbar.h_weapons[flashon][i]);
			}
		}
	}
	else if (COM.rogue === true)
	{
		if (CL.state.stats[Def.stat.activeweapon] >= Def.rit.lava_nailgun)
		{
			for (i = 0; i <= 4; ++i)
			{
				if (CL.state.stats[Def.stat.activeweapon] === (Def.rit.lava_nailgun << i))
					Sbar.DrawPic((i + 2) * 24, -16, Sbar.r_weapons[i]);
			}
		}
	}

	for (i = 0; i <= 3; ++i)
	{
		var num = CL.state.stats[Def.stat.shells + i].toString();
		switch (num.length)
		{
		case 1:
			Sbar.DrawCharacter(((6 * i + 3) << 3) - 2, -24, num.charCodeAt(0) - 30);
			continue;
		case 2:
			Sbar.DrawCharacter(((6 * i + 2) << 3) - 2, -24, num.charCodeAt(0) - 30);
			Sbar.DrawCharacter(((6 * i + 3) << 3) - 2, -24, num.charCodeAt(1) - 30);
			continue;
		case 3:
			Sbar.DrawCharacter(((6 * i + 1) << 3) - 2, -24, num.charCodeAt(0) - 30);
			Sbar.DrawCharacter(((6 * i + 2) << 3) - 2, -24, num.charCodeAt(1) - 30);
			Sbar.DrawCharacter(((6 * i + 3) << 3) - 2, -24, num.charCodeAt(2) - 30);
		}
	}

	if (COM.hipnotic === true)
	{
		for (i = 2; i <= 5; ++i)
		{
			if ((CL.state.items & (1 << (17 + i))) !== 0)
				Sbar.DrawPic(192 + (i << 4), -16, Sbar.items[i]);
		}
		if ((CL.state.items & 16777216) !== 0)
			Sbar.DrawPic(288, -16, Sbar.h_items[0]);
		if ((CL.state.items & 33554432) !== 0)
			Sbar.DrawPic(304, -16, Sbar.h_items[1]);
	}
	else
	{
		for (i = 0; i <= 5; ++i)
		{
			if ((CL.state.items & (1 << (17 + i))) !== 0)
				Sbar.DrawPic(192 + (i << 4), -16, Sbar.items[i]);
		}
		if (COM.rogue === true)
		{
			if ((CL.state.items & 536870912) !== 0)
				Sbar.DrawPic(288, -16, Sbar.r_items[0]);
			if ((CL.state.items & 1073741824) !== 0)
				Sbar.DrawPic(304, -16, Sbar.r_items[1]);
		}
		else
		{
			for (i = 0; i <= 3; ++i)
			{
				if (((CL.state.items >>> (28 + i)) & 1) !== 0)
					Sbar.DrawPic(288 + (i << 3), -16, Sbar.sigil[i]);
			}
		}
	}
};

Sbar.DrawFrags = function()
{
	Sbar.SortFrags();
	var l = Sbar.scoreboardlines <= 4 ? Sbar.scoreboardlines : 4;
	var x = 23;
	var xofs = CL.state.gametype === 1 ? 10 : (VID.width >> 1) - 150;
	var y = VID.height - 47;
	var i, k, s, num;
	for (i = 0; i < l; ++i)
	{
		k = Sbar.fragsort[i];
		s = CL.state.scores[k];
		if (s.name.length === 0)
			continue;
		Draw.Fill(xofs + (x << 3), y, 28, 4, (s.colors & 0xf0) + 8);
		Draw.Fill(xofs + (x << 3), y + 4, 28, 3, ((s.colors & 0xf) << 4) + 8);
		num = s.frags.toString();
		Sbar.DrawString(((x - num.length) << 3) + 36, -24, num);
		if (k === (CL.state.viewentity - 1))
		{
			Sbar.DrawCharacter((x << 3) + 2, -24, 16);
			Sbar.DrawCharacter((x << 3) + 28, -24, 17);
		}
		x += 4;
	}
};

Sbar.DrawFace = function()
{
	if ((COM.rogue === true) && (CL.state.maxclients !== 1) && (Host.teamplay.value >= 4) && (Host.teamplay.value <= 6))
	{
		var s = CL.state.scores[CL.state.viewentity - 1];
		var top = (s.colors & 0xf0) + 8;
		var xofs = CL.state.gametype === 1 ? 113 : (VID.width >> 1) - 47;
		Sbar.DrawPic(112, 0, Sbar.r_teambord);
		Draw.Fill(xofs, VID.height - 21, 22, 9, top);
		Draw.Fill(xofs, VID.height - 12, 22, 9, ((s.colors & 0xf) << 4) + 8);
		var num = (top === 8 ? '\076\076\076' : '   ') + s.frags;
		if (num.length > 3)
			num = num.substring(num.length - 3);
		if (top === 8)
		{
			Sbar.DrawCharacter(109, 3, num.charCodeAt(0) - 30);
			Sbar.DrawCharacter(116, 3, num.charCodeAt(1) - 30);
			Sbar.DrawCharacter(123, 3, num.charCodeAt(2) - 30);
		}
		else
		{
			Sbar.DrawCharacter(109, 3, num.charCodeAt(0));
			Sbar.DrawCharacter(116, 3, num.charCodeAt(1));
			Sbar.DrawCharacter(123, 3, num.charCodeAt(2));
		}
		return;
	}

	if ((CL.state.items & (Def.it.invisibility + Def.it.invulnerability)) === (Def.it.invisibility + Def.it.invulnerability))
	{
		Sbar.DrawPic(112, 0, Sbar.face_invis_invuln);
		return;
	}
	if ((CL.state.items & Def.it.quad) !== 0)
	{
		Sbar.DrawPic(112, 0, Sbar.face_quad);
		return;
	}
	if ((CL.state.items & Def.it.invisibility) !== 0)
	{
		Sbar.DrawPic(112, 0, Sbar.face_invis);
		return;
	}
	if ((CL.state.items & Def.it.invulnerability) !== 0)
	{
		Sbar.DrawPic(112, 0, Sbar.face_invuln);
		return;
	}
	Sbar.DrawPic(112, 0, Sbar.faces[CL.state.stats[Def.stat.health] >= 100.0 ? 4 : Math.floor(CL.state.stats[Def.stat.health] / 20.0)][CL.state.time <= CL.state.faceanimtime ? 1 : 0]);
};

Sbar.Draw = function()
{
	if (SCR.con_current >= 200)
		return;

	if (Sbar.lines > 24)
	{
		Sbar.DrawInventory();
		if (CL.state.maxclients !== 1)
			Sbar.DrawFrags();
	}

	if ((Sbar.showscores === true) || (CL.state.stats[Def.stat.health] <= 0))
	{
		Sbar.DrawPic(0, 0, Sbar.scorebar);
		Sbar.SoloScoreboard();
		if (CL.state.gametype === 1)
			Sbar.DeathmatchOverlay();
		return;
	}

	if (Sbar.lines === 0)
		return;

	Sbar.DrawPic(0, 0, Sbar.sbar);

	if (COM.hipnotic === true)
	{
		if ((CL.state.items & Def.it.key1) !== 0)
			Sbar.DrawPic(209, 3, Sbar.items[0]);
		if ((CL.state.items & Def.it.key2) !== 0)
			Sbar.DrawPic(209, 12, Sbar.items[1]);
	}

	var it = (COM.rogue === true) ? Def.rit : Def.it;

	if ((CL.state.items & Def.it.invulnerability) !== 0)
	{
		Sbar.DrawNum(24, 0, 666, 3, 1);
		Sbar.DrawPic(0, 0, Sbar.disc);
	}
	else
	{
		Sbar.DrawNum(24, 0, CL.state.stats[Def.stat.armor], 3, CL.state.stats[Def.stat.armor] <= 25 ? 1 : 0);
		if ((CL.state.items & it.armor3) !== 0)
			Sbar.DrawPic(0, 0, Sbar.armor[2]);
		else if ((CL.state.items & it.armor2) !== 0)
			Sbar.DrawPic(0, 0, Sbar.armor[1]);
		else if ((CL.state.items & it.armor1) !== 0)
			Sbar.DrawPic(0, 0, Sbar.armor[0]);
	}

	Sbar.DrawFace();

	Sbar.DrawNum(136, 0, CL.state.stats[Def.stat.health], 3, CL.state.stats[Def.stat.health] <= 25 ? 1 : 0);

	if ((CL.state.items & it.shells) !== 0)
		Sbar.DrawPic(224, 0, Sbar.ammo[0]);
	else if ((CL.state.items & it.nails) !== 0)
		Sbar.DrawPic(224, 0, Sbar.ammo[1]);
	else if ((CL.state.items & it.rockets) !== 0)
		Sbar.DrawPic(224, 0, Sbar.ammo[2]);
	else if ((CL.state.items & it.cells) !== 0)
		Sbar.DrawPic(224, 0, Sbar.ammo[3]);
	else if (COM.rogue === true)
	{
		if ((CL.state.items & Def.rit.lava_nails) !== 0)
			Sbar.DrawPic(224, 0, Sbar.r_ammo[0]);
		else if ((CL.state.items & Def.rit.plasma_ammo) !== 0)
			Sbar.DrawPic(224, 0, Sbar.r_ammo[1]);
		else if ((CL.state.items & Def.rit.multi_rockets) !== 0)
			Sbar.DrawPic(224, 0, Sbar.r_ammo[2]);
	}
	Sbar.DrawNum(248, 0, CL.state.stats[Def.stat.ammo], 3, CL.state.stats[Def.stat.ammo] <= 10 ? 1 : 0);

	if ((VID.width >= 512) && (CL.state.gametype === 1))
		Sbar.MiniDeathmatchOverlay();
};

Sbar.IntermissionNumber = function(x, y, num)
{
	var str = num.toString();
	if (str.length > 3)
		str = str.substring(str.length - 3, str.length);
	else if (str.length < 3)
		x += (3 - str.length) * 24;
	var i, frame;
	for (i = 0; i < str.length; ++i)
	{
		frame = str.charCodeAt(i);
		Draw.Pic(x, y, Sbar.nums[0][frame === 45 ? 10 : frame - 48]);
		x += 24;
	}
};

Sbar.DeathmatchOverlay = function()
{
	Draw.Pic((VID.width - Sbar.ranking.width) >> 1, 8, Sbar.ranking);
	Sbar.SortFrags();

	var x = (VID.width >> 1) - 80, y = 40;
	var i, s, f;
	for (i = 0; i < Sbar.scoreboardlines; ++i)
	{
		s = CL.state.scores[Sbar.fragsort[i]];
		if (s.name.length === 0)
			continue;
		Draw.Fill(x, y, 40, 4, (s.colors & 0xf0) + 8);
		Draw.Fill(x, y + 4, 40, 4, ((s.colors & 0xf) << 4) + 8);
		f = s.frags.toString();
		Draw.String(x + 32 - (f.length << 3), y, f);
		if (Sbar.fragsort[i] === (CL.state.viewentity - 1))
			Draw.Character(x - 8, y, 12);
		Draw.String(x + 64, y, s.name);
		y += 10;
	}
};

Sbar.MiniDeathmatchOverlay = function()
{
	Sbar.SortFrags();
	var l = Sbar.scoreboardlines;
	var y = VID.height - Sbar.lines;
	var numlines = Sbar.lines >> 3;
	var i;

	for (i = 0; i < l; ++i)
	{
		if (Sbar.fragsort[i] === (CL.state.viewentity - 1))
			break;
	}

	i = (i === l) ? 0 : i - (numlines >> 1);
	if (i > (l - numlines))
		i = l - numlines;
	if (i < 0)
		i = 0;

	var k, s, num;
	for (; (i < l) && (y < (VID.height - 8)); ++i)
	{
		k = Sbar.fragsort[i];
		s = CL.state.scores[k];
		if (s.name.length === 0)
			continue;
		Draw.Fill(324, y + 1, 40, 3, (s.colors & 0xf0) + 8);
		Draw.Fill(324, y + 4, 40, 4, ((s.colors & 0xf) << 4) + 8);
		num = s.frags.toString();
		Draw.String(356 - (num.length << 3), y, num);
		if (k === (CL.state.viewentity - 1))
		{
			Draw.Character(324, y, 16);
			Draw.Character(356, y, 17);
		}
		Draw.String(372, y, s.name);
		y += 8;
	}
};

Sbar.IntermissionOverlay = function()
{
	if (CL.state.gametype === 1)
	{
		Sbar.DeathmatchOverlay();
		return;
	}
	Draw.Pic(64, 24, Sbar.complete);
	Draw.Pic(0, 56, Sbar.inter);

	var dig = Math.floor(CL.state.completed_time / 60.0);
	Sbar.IntermissionNumber(160, 64, dig);
	var num = Math.floor(CL.state.completed_time - dig * 60);
	Draw.Pic(234, 64, Sbar.colon);
	Draw.Pic(246, 64, Sbar.nums[0][Math.floor(num / 10)]);
	Draw.Pic(266, 64, Sbar.nums[0][Math.floor(num % 10)]);

	Sbar.IntermissionNumber(160, 104, CL.state.stats[Def.stat.secrets]);
	Draw.Pic(232, 104, Sbar.slash);
	Sbar.IntermissionNumber(240, 104, CL.state.stats[Def.stat.totalsecrets]);

	Sbar.IntermissionNumber(160, 144, CL.state.stats[Def.stat.monsters]);
	Draw.Pic(232, 144, Sbar.slash);
	Sbar.IntermissionNumber(240, 144, CL.state.stats[Def.stat.totalmonsters]);
};

Sbar.FinaleOverlay = function()
{
	Draw.Pic((VID.width - Sbar.finale.width) >> 1, 16, Sbar.finale);
};

// ---- WebQuake/SCR.js ----
SCR = {};

SCR.con_current = 0;

SCR.centerstring = [];
SCR.centertime_off = 0.0;

SCR.CenterPrint = function(str)
{
	SCR.centerstring = [];
	var i, start = 0, next;
	for (i = 0; i < str.length; ++i)
	{
		if (str.charCodeAt(i) === 10)
			next = i + 1;
		else if ((i - start) >= 40)
			next = i;
		else
			continue;
		SCR.centerstring[SCR.centerstring.length] = str.substring(start, i);
		start = next;
	}
	SCR.centerstring[SCR.centerstring.length] = str.substring(start, i);
	SCR.centertime_off = SCR.centertime.value;
	SCR.centertime_start = CL.state.time;
}

SCR.DrawCenterString = function()
{
	SCR.centertime_off -= Host.frametime;
	if (((SCR.centertime_off <= 0.0) && (CL.state.intermission === 0)) || (Key.dest.value !== Key.dest.game))
		return;

	var y;
	if (SCR.centerstring.length <= 4)
		y = Math.floor(VID.height * 0.35);
	else
		y = 48;

	var i;
	if (CL.state.intermission)
	{
		var remaining = Math.floor(SCR.printspeed.value * (CL.state.time - SCR.centertime_start));
		var str, x, j;
		for (i = 0; i < SCR.centerstring.length; ++i)
		{
			str = SCR.centerstring[i];
			x = (VID.width - (str.length << 3)) >> 1;
			for (j = 0; j < str.length; ++j)
			{
				Draw.Character(x, y, str.charCodeAt(j));
				if ((remaining--) === 0)
					return;
				x += 8;
			}
			y += 8;
		}
		return;
	}

	for (i = 0; i < SCR.centerstring.length; ++i)
	{
		Draw.String((VID.width - (SCR.centerstring[i].length << 3)) >> 1, y, SCR.centerstring[i]);
		y += 8;
	}
};

SCR.CalcRefdef = function()
{
	SCR.recalc_refdef = false;

	if (SCR.viewsize.value < 30)
		Cvar.Set('viewsize', '30');
	else if (SCR.viewsize.value > 120)
		Cvar.Set('viewsize', '120');

	var size, full;
	if (CL.state.intermission !== 0)
	{
		full = true;
		size = 1.0;
		Sbar.lines = 0;
	}
	else
	{
		size = SCR.viewsize.value;
		if (size >= 120.0)
			Sbar.lines = 0;
		else if (size >= 110.0)
			Sbar.lines = 24;
		else
			Sbar.lines = 48;
		if (size >= 100.0)
		{
			full = true;
			size = 100.0;
		}
		size *= 0.01;
	}

	var vrect = R.refdef.vrect;
	vrect.width = Math.floor(VID.width * size);
	if (vrect.width < 96)
	{
		size = 96.0 / vrect.width;
		vrect.width = 96;
	}
	vrect.height = Math.floor(VID.height * size);
	if (vrect.height > (VID.height - Sbar.lines))
		vrect.height = VID.height - Sbar.lines;
	vrect.x = (VID.width - vrect.width) >> 1;
	if (full === true)
		vrect.y = 0;
	else
		vrect.y = (VID.height - Sbar.lines - vrect.height) >> 1;

	if (SCR.fov.value < 10)
		Cvar.Set('fov', '10');
	else if (SCR.fov.value > 170)
		Cvar.Set('fov', '170');
	if ((vrect.width * 0.75) <= vrect.height)
	{
		R.refdef.fov_x = SCR.fov.value;
		R.refdef.fov_y = Math.atan(vrect.height / (vrect.width / Math.tan(SCR.fov.value * Math.PI / 360.0))) * 360.0 / Math.PI;
	}
	else
	{
		R.refdef.fov_x = Math.atan(vrect.width / (vrect.height / Math.tan(SCR.fov.value * 0.82 * Math.PI / 360.0))) * 360.0 / Math.PI;
		R.refdef.fov_y = SCR.fov.value * 0.82;
	}

	var ymax = 4.0 * Math.tan(R.refdef.fov_y * Math.PI / 360.0);
	R.perspective[0] = 4.0 / (ymax * R.refdef.vrect.width / R.refdef.vrect.height);
	R.perspective[5] = 4.0 / ymax;
	GL.ortho[0] = 2.0 / VID.width;
	GL.ortho[5] = -2.0 / VID.height;

	R.warpwidth = (vrect.width * SCR.devicePixelRatio) >> 0;
	R.warpheight = (vrect.height * SCR.devicePixelRatio) >> 0;
	if (R.warpwidth > 2048)
		R.warpwidth = 2048;
	if (R.warpheight > 2048)
		R.warpheight = 2048;
	if ((R.oldwarpwidth !== R.warpwidth) || (R.oldwarpheight !== R.warpheight))
	{
		R.oldwarpwidth = R.warpwidth;
		R.oldwarpheight = R.warpheight;
		GL.Bind(0, R.warptexture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, R.warpwidth, R.warpheight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, R.warprenderbuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, R.warpwidth, R.warpheight);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	}
};

SCR.SizeUp_f = function()
{
	Cvar.SetValue('viewsize', SCR.viewsize.value + 10);
	SCR.recalc_refdef = true;
};

SCR.SizeDown_f = function()
{
	Cvar.SetValue('viewsize', SCR.viewsize.value - 10);
	SCR.recalc_refdef = true;
};

SCR.Init = function()
{
	SCR.fov = Cvar.RegisterVariable('fov', '90');
	SCR.viewsize = Cvar.RegisterVariable('viewsize', '100', true);
	SCR.conspeed = Cvar.RegisterVariable('scr_conspeed', '300');
	SCR.showturtle = Cvar.RegisterVariable('showturtle', '0');
	SCR.showpause = Cvar.RegisterVariable('showpause', '1');
	SCR.centertime = Cvar.RegisterVariable('scr_centertime', '2');
	SCR.printspeed = Cvar.RegisterVariable('scr_printspeed', '8');
	Cmd.AddCommand('screenshot', SCR.ScreenShot_f);
	Cmd.AddCommand('sizeup', SCR.SizeUp_f);
	Cmd.AddCommand('sizedown', SCR.SizeDown_f);
	SCR.net = Draw.PicFromWad('NET');
	SCR.turtle = Draw.PicFromWad('TURTLE');
	SCR.pause = Draw.CachePic('pause');
};

SCR.count = 0;
SCR.DrawTurtle = function()
{
	if (SCR.showturtle.value === 0)
		return;
	if (Host.frametime < 0.1)
	{
		SCR.count = 0;
		return;
	}
	if (++SCR.count >= 3)
		Draw.Pic(R.refdef.vrect.x, R.refdef.vrect.y, SCR.turtle);
};

SCR.DrawNet = function()
{
	if (((Host.realtime - CL.state.last_received_message) >= 0.3) && (CL.cls.demoplayback !== true))
		Draw.Pic(R.refdef.vrect.x, R.refdef.vrect.y, SCR.net);
};

SCR.DrawPause = function()
{
	if ((SCR.showpause.value !== 0) && (CL.state.paused === true))
		Draw.Pic((VID.width - SCR.pause.width) >> 1, (VID.height - 48 - SCR.pause.height) >> 1, SCR.pause);
};

SCR.SetUpToDrawConsole = function()
{
	Con.forcedup = (CL.state.worldmodel == null) || (CL.cls.signon !== 4);

	if (Con.forcedup === true)
	{
		SCR.con_current = 200;
		return;
	}

	var conlines;
	if (Key.dest.value === Key.dest.console)
		conlines = 100;
	else
		conlines = 0;

	if (conlines < SCR.con_current)
	{
		SCR.con_current -= SCR.conspeed.value * Host.frametime;
		if (conlines > SCR.con_current)
			SCR.con_current = conlines;
	}
	else if (conlines > SCR.con_current)
	{
		SCR.con_current += SCR.conspeed.value * Host.frametime;
		if (conlines < SCR.con_current)
			SCR.con_current = conlines;
	}
};

SCR.DrawConsole = function()
{
	if (SCR.con_current > 0)
	{
		Con.DrawConsole(SCR.con_current);
		return;
	}
	if ((Key.dest.value === Key.dest.game) || (Key.dest.value === Key.dest.message))
		Con.DrawNotify();
};

SCR.ScreenShot_f = function()
{
	SCR.screenshot = true;
};

SCR.BeginLoadingPlaque = function()
{
	S.StopAllSounds();
	if ((CL.cls.state !== CL.active.connected) || (CL.cls.signon !== 4))
		return;
	SCR.centertime_off = 0.0;
	SCR.con_current = 0;
	SCR.disabled_for_loading = true;
	SCR.disabled_time = Host.realtime + 60.0;
};

SCR.EndLoadingPlaque = function()
{
	SCR.disabled_for_loading = false;
	Con.ClearNotify();
};

SCR.UpdateScreen = function()
{
	if (SCR.disabled_for_loading === true)
	{
		if (Host.realtime <= SCR.disabled_time)
			return;
		SCR.disabled_for_loading = false;
		Con.Print('load failed.\n');
	}

	var elem = document.documentElement;
	var width = (elem.clientWidth <= 320) ? 320 : elem.clientWidth;
	var height = (elem.clientHeight <= 200) ? 200 : elem.clientHeight;
	var pixelRatio;
	if (window.devicePixelRatio >= 1.0)
		pixelRatio = window.devicePixelRatio;
	else
		pixelRatio = 1.0;
	if ((VID.width !== width) || (VID.height !== height) || (SCR.devicePixelRatio !== pixelRatio) || (Host.framecount === 0))
	{
		VID.width = width;
		VID.height = height;
		VID.mainwindow.width = (width * pixelRatio) >> 0;
		VID.mainwindow.height = (height * pixelRatio) >> 0;
		VID.mainwindow.style.width = width + 'px';
		VID.mainwindow.style.height = height + 'px';
		SCR.devicePixelRatio = pixelRatio;
		SCR.recalc_refdef = true;
	}

	if (SCR.oldfov !== SCR.fov.value)
	{
		SCR.oldfov = SCR.fov.value;
		SCR.recalc_refdef = true;
	}
	if (SCR.oldscreensize !== SCR.viewsize.value)
	{
		SCR.oldscreensize = SCR.viewsize.value;
		SCR.recalc_refdef = true;
	}
	if (SCR.recalc_refdef === true)
		SCR.CalcRefdef();

	SCR.SetUpToDrawConsole();
	V.RenderView();
	GL.Set2D();
	if (R.dowarp === true)
		R.WarpScreen();
	if (Con.forcedup !== true)
		R.PolyBlend();

	if (CL.cls.state === CL.active.connecting)
		SCR.DrawConsole();
	else if ((CL.state.intermission === 1) && (Key.dest.value === Key.dest.game))
		Sbar.IntermissionOverlay();
	else if ((CL.state.intermission === 2) && (Key.dest.value === Key.dest.game))
	{
		Sbar.FinaleOverlay();
		SCR.DrawCenterString();
	}
	else if ((CL.state.intermission === 3) && (Key.dest.value === Key.dest.game))
		SCR.DrawCenterString();
	else
	{
		if (V.crosshair.value !== 0)
		{
			Draw.Character(R.refdef.vrect.x + (R.refdef.vrect.width >> 1) + V.crossx.value,
				R.refdef.vrect.y + (R.refdef.vrect.height >> 1) + V.crossy.value, 43);
		}
		SCR.DrawNet();
		SCR.DrawTurtle();
		SCR.DrawPause();
		SCR.DrawCenterString();
		Sbar.Draw();
		SCR.DrawConsole();
		M.Draw();
	}

	GL.StreamFlush();

	gl.disable(gl.BLEND);

	if (SCR.screenshot === true)
	{
		SCR.screenshot = false;
		gl.finish();
		open(VID.mainwindow.toDataURL('image/jpeg'));
	}
};

// ---- WebQuake/SV.js ----
SV = {};

SV.movetype = {
	none: 0,
	anglenoclip: 1,
	angleclip: 2,
	walk: 3,
	step: 4,
	fly: 5,
	toss: 6,
	push: 7,
	noclip: 8,
	flymissile: 9,
	bounce: 10
};

SV.solid = {
	not: 0,
	trigger: 1,
	bbox: 2,
	slidebox: 3,
	bsp: 4
};

SV.damage = {
	no: 0,
	yes: 1,
	aim: 2
};

SV.fl = {
	fly: 1,
	swim: 2,
	conveyor: 4,
	client: 8,
	inwater: 16,
	monster: 32,
	godmode: 64,
	notarget: 128,
	item: 256,
	onground: 512,
	partialground: 1024,
	waterjump: 2048,
	jumpreleased: 4096
};

// main

SV.server = {
	num_edicts: 0,
	datagram: {data: new ArrayBuffer(1024), cursize: 0},
	reliable_datagram: {data: new ArrayBuffer(1024), cursize: 0},
	signon: {data: new ArrayBuffer(8192), cursize: 0}
};

SV.svs = {};

SV.Init = function()
{
	SV.maxvelocity = Cvar.RegisterVariable('sv_maxvelocity', '2000');
	SV.gravity = Cvar.RegisterVariable('sv_gravity', '800', false, true);
	SV.friction = Cvar.RegisterVariable('sv_friction', '4', false, true);
	SV.edgefriction = Cvar.RegisterVariable('edgefriction', '2');
	SV.stopspeed = Cvar.RegisterVariable('sv_stopspeed', '100');
	SV.maxspeed = Cvar.RegisterVariable('sv_maxspeed', '320', false, true);
	SV.accelerate = Cvar.RegisterVariable('sv_accelerate', '10');
	SV.idealpitchscale = Cvar.RegisterVariable('sv_idealpitchscale', '0.8');
	SV.aim = Cvar.RegisterVariable('sv_aim', '0.93');
	SV.nostep = Cvar.RegisterVariable('sv_nostep', '0');

	SV.nop = {data: new ArrayBuffer(4), cursize: 1};
	(new Uint8Array(SV.nop.data))[0] = Protocol.svc.nop;
	SV.reconnect = {data: new ArrayBuffer(128), cursize: 0};
	MSG.WriteByte(SV.reconnect, Protocol.svc.stufftext);
	MSG.WriteString(SV.reconnect, 'reconnect\n');

	SV.InitBoxHull();
};

SV.StartParticle = function(org, dir, color, count)
{
	var datagram = SV.server.datagram;
	if (datagram.cursize >= 1009)
		return;
	MSG.WriteByte(datagram, Protocol.svc.particle);
	MSG.WriteCoord(datagram, org[0]);
	MSG.WriteCoord(datagram, org[1]);
	MSG.WriteCoord(datagram, org[2]);
	var i, v;
	for (i = 0; i <= 2; ++i)
	{
		v = (dir[i] * 16.0) >> 0;
		if (v > 127)
			v = 127;
		else if (v < -128)
			v = -128;
		MSG.WriteChar(datagram, v);
	}
	MSG.WriteByte(datagram, count);
	MSG.WriteByte(datagram, color);
};

SV.StartSound = function(entity, channel, sample, volume, attenuation)
{
	if ((volume < 0) || (volume > 255))
		Sys.Error('SV.StartSound: volume = ' + volume);
	if ((attenuation < 0.0) || (attenuation > 4.0))
		Sys.Error('SV.StartSound: attenuation = ' + attenuation);
	if ((channel < 0) || (channel > 7))
		Sys.Error('SV.StartSound: channel = ' + channel);

	var datagram = SV.server.datagram;
	if (datagram.cursize >= 1009)
		return;

	var i;
	for (i = 1; i < SV.server.sound_precache.length; ++i)
	{
		if (sample === SV.server.sound_precache[i])
			break;
	}
	if (i >= SV.server.sound_precache.length)
	{
		Con.Print('SV.StartSound: ' + sample + ' not precached\n');
		return;
	}

	var field_mask = 0;
	if (volume !== 255)
		field_mask += 1;
	if (attenuation !== 1.0)
		field_mask += 2;

	MSG.WriteByte(datagram, Protocol.svc.sound);
	MSG.WriteByte(datagram, field_mask);
	if ((field_mask & 1) !== 0)
		MSG.WriteByte(datagram, volume);
	if ((field_mask & 2) !== 0)
		MSG.WriteByte(datagram, Math.floor(attenuation * 64.0));
	MSG.WriteShort(datagram, (entity.num << 3) + channel);
	MSG.WriteByte(datagram, i);
	MSG.WriteCoord(datagram, entity.v_float[PR.entvars.origin] + 0.5 *
		(entity.v_float[PR.entvars.mins] + entity.v_float[PR.entvars.maxs]));
	MSG.WriteCoord(datagram, entity.v_float[PR.entvars.origin1] + 0.5 *
		(entity.v_float[PR.entvars.mins1] + entity.v_float[PR.entvars.maxs1]));
	MSG.WriteCoord(datagram, entity.v_float[PR.entvars.origin2] + 0.5 *
		(entity.v_float[PR.entvars.mins2] + entity.v_float[PR.entvars.maxs2]));
};

SV.SendServerinfo = function(client)
{
	var message = client.message;
	MSG.WriteByte(message, Protocol.svc.print);
	MSG.WriteString(message, '\2\nVERSION 1.09 SERVER (' + PR.crc + ' CRC)');
	MSG.WriteByte(message, Protocol.svc.serverinfo);
	MSG.WriteLong(message, Protocol.version);
	MSG.WriteByte(message, SV.svs.maxclients);
	MSG.WriteByte(message, ((Host.coop.value === 0) && (Host.deathmatch.value !== 0)) ? 1 : 0);
	MSG.WriteString(message, PR.GetString(SV.server.edicts[0].v_int[PR.entvars.message]));
	var i;
	for (i = 1; i < SV.server.model_precache.length; ++i)
		MSG.WriteString(message, SV.server.model_precache[i]);
	MSG.WriteByte(message, 0);
	for (i = 1; i < SV.server.sound_precache.length; ++i)
		MSG.WriteString(message, SV.server.sound_precache[i]);
	MSG.WriteByte(message, 0);
	MSG.WriteByte(message, Protocol.svc.cdtrack);
	MSG.WriteByte(message, SV.server.edicts[0].v_float[PR.entvars.sounds]);
	MSG.WriteByte(message, SV.server.edicts[0].v_float[PR.entvars.sounds]);
	MSG.WriteByte(message, Protocol.svc.setview);
	MSG.WriteShort(message, client.edict.num);
	MSG.WriteByte(message, Protocol.svc.signonnum);
	MSG.WriteByte(message, 1);
	client.sendsignon = true;
	client.spawned = false;
};

SV.ConnectClient = function(clientnum)
{
	var client = SV.svs.clients[clientnum];
	var i, spawn_parms;
	if (SV.server.loadgame === true)
	{
		spawn_parms = [];
		if (client.spawn_parms == null)
		{
			client.spawn_parms = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
				0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
		}
		for (i = 0; i <= 15; ++i)
			spawn_parms[i] = client.spawn_parms[i];
	}
	Con.DPrint('Client ' + client.netconnection.address + ' connected\n');
	client.active = true;
	client.dropasap = false;
	client.last_message = 0.0;
	client.cmd = {forwardmove: 0.0, sidemove: 0.0, upmove: 0.0};
	client.wishdir = [0.0, 0.0, 0.0];
	client.message.cursize = 0;
	client.edict = SV.server.edicts[clientnum + 1];
	client.edict.v_int[PR.entvars.netname] = PR.netnames + (clientnum << 5);
	SV.SetClientName(client, 'unconnected');
	client.colors = 0;
	client.ping_times = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
		0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
	client.num_pings = 0;
	if (SV.server.loadgame !== true)
	{
		client.spawn_parms = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
			0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
	}
	client.old_frags = 0;
	if (SV.server.loadgame === true)
	{
		for (i = 0; i <= 15; ++i)
			client.spawn_parms[i] = spawn_parms[i];
	}
	else
	{
		PR.ExecuteProgram(PR.globals_int[PR.globalvars.SetNewParms]);
		for (i = 0; i <= 15; ++i)
			client.spawn_parms[i] = PR.globals_float[PR.globalvars.parms + i];
	}
	SV.SendServerinfo(client);
};

SV.fatpvs = [];

SV.CheckForNewClients = function()
{
	var ret, i;
	for (;;)
	{
		ret = NET.CheckNewConnections();
		if (ret == null)
			return;
		for (i = 0; i < SV.svs.maxclients; ++i)
		{
			if (SV.svs.clients[i].active !== true)
				break;
		}
		if (i === SV.svs.maxclients)
			Sys.Error('SV.CheckForNewClients: no free clients');
		SV.svs.clients[i].netconnection = ret;
		SV.ConnectClient(i);
		++NET.activeconnections;
	}
};

SV.AddToFatPVS = function(org, node)
{
	var pvs, i, normal, d;
	for (;;)
	{
		if (node.contents < 0)
		{
			if (node.contents !== Mod.contents.solid)
			{
				pvs = Mod.LeafPVS(node, SV.server.worldmodel);
				for (i = 0; i < SV.fatbytes; ++i)
					SV.fatpvs[i] |= pvs[i];
			}
			return;
		}
		normal = node.plane.normal;
		d = org[0] * normal[0] + org[1] * normal[1] + org[2] * normal[2] - node.plane.dist;
		if (d > 8.0)
			node = node.children[0];
		else
		{
			if (d >= -8.0)
				SV.AddToFatPVS(org, node.children[0]);
			node = node.children[1];
		}
	}
};

SV.FatPVS = function(org)
{
	SV.fatbytes = (SV.server.worldmodel.leafs.length + 31) >> 3;
	var i;
	for (i = 0; i < SV.fatbytes; ++i)
		SV.fatpvs[i] = 0;
	SV.AddToFatPVS(org, SV.server.worldmodel.nodes[0]);
};

SV.WriteEntitiesToClient = function(clent, msg)
{
	SV.FatPVS([
		clent.v_float[PR.entvars.origin] + clent.v_float[PR.entvars.view_ofs],
		clent.v_float[PR.entvars.origin1] + clent.v_float[PR.entvars.view_ofs1],
		clent.v_float[PR.entvars.origin2] + clent.v_float[PR.entvars.view_ofs2]
	]);
	var pvs = SV.fatpvs, ent, e, i, bits, miss;
	for (e = 1; e < SV.server.num_edicts; ++e)
	{
		ent = SV.server.edicts[e];
		if (ent !== clent)
		{
			if ((ent.v_float[PR.entvars.modelindex] === 0.0) || (PR.strings[ent.v_int[PR.entvars.model]] === 0))
				continue;
			for (i = 0; i < ent.leafnums.length; ++i)
			{
				if ((pvs[ent.leafnums[i] >> 3] & (1 << (ent.leafnums[i] & 7))) !== 0)
					break;
			}
			if (i === ent.leafnums.length)
				continue;
		}
		if ((msg.data.byteLength - msg.cursize) < 16)
		{
			Con.Print('packet overflow\n');
			return;
		}

		bits = 0;
		for (i = 0; i <= 2; ++i)
		{
			miss = ent.v_float[PR.entvars.origin + i] - ent.baseline.origin[i];
			if ((miss < -0.1) || (miss > 0.1))
				bits += Protocol.u.origin1 << i;
		}
		if (ent.v_float[PR.entvars.angles] !== ent.baseline.angles[0])
			bits += Protocol.u.angle1;
		if (ent.v_float[PR.entvars.angles1] !== ent.baseline.angles[1])
			bits += Protocol.u.angle2;
		if (ent.v_float[PR.entvars.angles2] !== ent.baseline.angles[2])
			bits += Protocol.u.angle3;
		if (ent.v_float[PR.entvars.movetype] === SV.movetype.step)
			bits += Protocol.u.nolerp;
		if (ent.baseline.colormap !== ent.v_float[PR.entvars.colormap])
			bits += Protocol.u.colormap;
		if (ent.baseline.skin !== ent.v_float[PR.entvars.skin])
			bits += Protocol.u.skin;
		if (ent.baseline.frame !== ent.v_float[PR.entvars.frame])
			bits += Protocol.u.frame;
		if (ent.baseline.effects !== ent.v_float[PR.entvars.effects])
			bits += Protocol.u.effects;
		if (ent.baseline.modelindex !== ent.v_float[PR.entvars.modelindex])
			bits += Protocol.u.model;
		if (e >= 256)
			bits += Protocol.u.longentity;
		if (bits >= 256)
			bits += Protocol.u.morebits;

		MSG.WriteByte(msg, bits + Protocol.u.signal);
		if ((bits & Protocol.u.morebits) !== 0)
			MSG.WriteByte(msg, bits >> 8);
		if ((bits & Protocol.u.longentity) !== 0)
			MSG.WriteShort(msg, e);
		else
			MSG.WriteByte(msg, e);
		if ((bits & Protocol.u.model) !== 0)
			MSG.WriteByte(msg, ent.v_float[PR.entvars.modelindex]);
		if ((bits & Protocol.u.frame) !== 0)
			MSG.WriteByte(msg, ent.v_float[PR.entvars.frame]);
		if ((bits & Protocol.u.colormap) !== 0)
			MSG.WriteByte(msg, ent.v_float[PR.entvars.colormap]);
		if ((bits & Protocol.u.skin) !== 0)
			MSG.WriteByte(msg, ent.v_float[PR.entvars.skin]);
		if ((bits & Protocol.u.effects) !== 0)
			MSG.WriteByte(msg, ent.v_float[PR.entvars.effects]);
		if ((bits & Protocol.u.origin1) !== 0)
			MSG.WriteCoord(msg, ent.v_float[PR.entvars.origin]);
		if ((bits & Protocol.u.angle1) !== 0)
			MSG.WriteAngle(msg, ent.v_float[PR.entvars.angles]);
		if ((bits & Protocol.u.origin2) !== 0)
			MSG.WriteCoord(msg, ent.v_float[PR.entvars.origin1]);
		if ((bits & Protocol.u.angle2) !== 0)
			MSG.WriteAngle(msg, ent.v_float[PR.entvars.angles1]);
		if ((bits & Protocol.u.origin3) !== 0)
			MSG.WriteCoord(msg, ent.v_float[PR.entvars.origin2]);
		if ((bits & Protocol.u.angle3) !== 0)
			MSG.WriteAngle(msg, ent.v_float[PR.entvars.angles2]);
	}
};

SV.WriteClientdataToMessage = function(ent, msg)
{
	if ((ent.v_float[PR.entvars.dmg_take] !== 0.0) || (ent.v_float[PR.entvars.dmg_save] !== 0.0))
	{
		var other = SV.server.edicts[ent.v_int[PR.entvars.dmg_inflictor]];
		MSG.WriteByte(msg, Protocol.svc.damage);
		MSG.WriteByte(msg, ent.v_float[PR.entvars.dmg_save]);
		MSG.WriteByte(msg, ent.v_float[PR.entvars.dmg_take]);
		MSG.WriteCoord(msg, other.v_float[PR.entvars.origin] + 0.5 * (other.v_float[PR.entvars.mins] + other.v_float[PR.entvars.maxs]));
		MSG.WriteCoord(msg, other.v_float[PR.entvars.origin1] + 0.5 * (other.v_float[PR.entvars.mins1] + other.v_float[PR.entvars.maxs1]));
		MSG.WriteCoord(msg, other.v_float[PR.entvars.origin2] + 0.5 * (other.v_float[PR.entvars.mins2] + other.v_float[PR.entvars.maxs2]));
		ent.v_float[PR.entvars.dmg_take] = 0.0;
		ent.v_float[PR.entvars.dmg_save] = 0.0;
	}

	SV.SetIdealPitch();

	if (ent.v_float[PR.entvars.fixangle] !== 0.0)
	{
		MSG.WriteByte(msg, Protocol.svc.setangle);
		MSG.WriteAngle(msg, ent.v_float[PR.entvars.angles]);
		MSG.WriteAngle(msg, ent.v_float[PR.entvars.angles1]);
		MSG.WriteAngle(msg, ent.v_float[PR.entvars.angles2]);
		ent.v_float[PR.entvars.fixangle] = 0.0;
	};

	var bits = Protocol.su.items + Protocol.su.weapon;
	if (ent.v_float[PR.entvars.view_ofs2] !== Protocol.default_viewheight)
		bits += Protocol.su.viewheight;
	if (ent.v_float[PR.entvars.idealpitch] !== 0.0)
		bits += Protocol.su.idealpitch;

	var val = PR.entvars.items2, items;
	if (val != null)
	{
		if (ent.v_float[val] !== 0.0)
			items = (ent.v_float[PR.entvars.items] >> 0) + ((ent.v_float[val] << 23) >>> 0);
		else
			items = (ent.v_float[PR.entvars.items] >> 0) + ((PR.globals_float[PR.globalvars.serverflags] << 28) >>> 0);
	}
	else
		items = (ent.v_float[PR.entvars.items] >> 0) + ((PR.globals_float[PR.globalvars.serverflags] << 28) >>> 0);

	if (ent.v_float[PR.entvars.flags] & SV.fl.onground)
		bits += Protocol.su.onground;
	if (ent.v_float[PR.entvars.waterlevel] >= 2.0)
		bits += Protocol.su.inwater;

	if (ent.v_float[PR.entvars.punchangle] !== 0.0)
		bits += Protocol.su.punch1;
	if (ent.v_float[PR.entvars.velocity] !== 0.0)
		bits += Protocol.su.velocity1;
	if (ent.v_float[PR.entvars.punchangle1] !== 0.0)
		bits += Protocol.su.punch2;
	if (ent.v_float[PR.entvars.velocity1] !== 0.0)
		bits += Protocol.su.velocity2;
	if (ent.v_float[PR.entvars.punchangle2] !== 0.0)
		bits += Protocol.su.punch3;
	if (ent.v_float[PR.entvars.velocity2] !== 0.0)
		bits += Protocol.su.velocity3;

	if (ent.v_float[PR.entvars.weaponframe] !== 0.0)
		bits += Protocol.su.weaponframe;
	if (ent.v_float[PR.entvars.armorvalue] !== 0.0)
		bits += Protocol.su.armor;

	MSG.WriteByte(msg, Protocol.svc.clientdata);
	MSG.WriteShort(msg, bits);
	if ((bits & Protocol.su.viewheight) !== 0)
		MSG.WriteChar(msg, ent.v_float[PR.entvars.view_ofs2]);
	if ((bits & Protocol.su.idealpitch) !== 0)
		MSG.WriteChar(msg, ent.v_float[PR.entvars.idealpitch]);

	if ((bits & Protocol.su.punch1) !== 0)
		MSG.WriteChar(msg, ent.v_float[PR.entvars.punchangle]);
	if ((bits & Protocol.su.velocity1) !== 0)
		MSG.WriteChar(msg, ent.v_float[PR.entvars.velocity] * 0.0625);
	if ((bits & Protocol.su.punch2) !== 0)
		MSG.WriteChar(msg, ent.v_float[PR.entvars.punchangle1]);
	if ((bits & Protocol.su.velocity2) !== 0)
		MSG.WriteChar(msg, ent.v_float[PR.entvars.velocity1] * 0.0625);
	if ((bits & Protocol.su.punch3) !== 0)
		MSG.WriteChar(msg, ent.v_float[PR.entvars.punchangle2]);
	if ((bits & Protocol.su.velocity3) !== 0)
		MSG.WriteChar(msg, ent.v_float[PR.entvars.velocity2] * 0.0625);

	MSG.WriteLong(msg, items);
	if ((bits & Protocol.su.weaponframe) !== 0)
		MSG.WriteByte(msg, ent.v_float[PR.entvars.weaponframe]);
	if ((bits & Protocol.su.armor) !== 0)
		MSG.WriteByte(msg, ent.v_float[PR.entvars.armorvalue]);
	MSG.WriteByte(msg, SV.ModelIndex(PR.GetString(ent.v_int[PR.entvars.weaponmodel])));
	MSG.WriteShort(msg, ent.v_float[PR.entvars.health]);
	MSG.WriteByte(msg, ent.v_float[PR.entvars.currentammo]);
	MSG.WriteByte(msg, ent.v_float[PR.entvars.ammo_shells]);
	MSG.WriteByte(msg, ent.v_float[PR.entvars.ammo_nails]);
	MSG.WriteByte(msg, ent.v_float[PR.entvars.ammo_rockets]);
	MSG.WriteByte(msg, ent.v_float[PR.entvars.ammo_cells]);
	if (COM.standard_quake === true)
		MSG.WriteByte(msg, ent.v_float[PR.entvars.weapon]);
	else
	{
		var i, weapon = ent.v_float[PR.entvars.weapon];
		for (i = 0; i <= 31; ++i)
		{
			if ((weapon & (1 << i)) !== 0)
			{
				MSG.WriteByte(msg, i);
				break;
			}
		}
	}
};

SV.clientdatagram = {data: new ArrayBuffer(1024), cursize: 0};
SV.SendClientDatagram = function()
{
	var client = Host.client;
	var msg = SV.clientdatagram;
	msg.cursize = 0;
	MSG.WriteByte(msg, Protocol.svc.time);
	MSG.WriteFloat(msg, SV.server.time);
	SV.WriteClientdataToMessage(client.edict, msg);
	SV.WriteEntitiesToClient(client.edict, msg);
	if ((msg.cursize + SV.server.datagram.cursize) < msg.data.byteLength)
		SZ.Write(msg, new Uint8Array(SV.server.datagram.data), SV.server.datagram.cursize);
	if (NET.SendUnreliableMessage(client.netconnection, msg) === -1)
	{
		Host.DropClient(true);
		return;
	}
	return true;
};

SV.UpdateToReliableMessages = function()
{
	var i, frags, j, client;

	for (i = 0; i < SV.svs.maxclients; ++i)
	{
		Host.client = SV.svs.clients[i];
		Host.client.edict.v_float[PR.entvars.frags] >>= 0;
		frags = Host.client.edict.v_float[PR.entvars.frags];
		if (Host.client.old_frags === frags)
			continue;
		for (j = 0; j < SV.svs.maxclients; ++j)
		{
			client = SV.svs.clients[j];
			if (client.active !== true)
				continue;
			MSG.WriteByte(client.message, Protocol.svc.updatefrags);
			MSG.WriteByte(client.message, i);
			MSG.WriteShort(client.message, frags);
		}
		Host.client.old_frags = frags;
	}

	for (i = 0; i < SV.svs.maxclients; ++i)
	{
		client = SV.svs.clients[i];
		if (client.active === true)
			SZ.Write(client.message, new Uint8Array(SV.server.reliable_datagram.data), SV.server.reliable_datagram.cursize);
	}

	SV.server.reliable_datagram.cursize = 0;
};

SV.SendClientMessages = function()
{
	SV.UpdateToReliableMessages();
	var i, client;
	for (i = 0; i < SV.svs.maxclients; ++i)
	{
		Host.client = client = SV.svs.clients[i];
		if (client.active !== true)
			continue;
		if (client.spawned === true)
		{
			if (SV.SendClientDatagram() !== true)
				continue;
		}
		else if (client.sendsignon !== true)
		{
			if ((Host.realtime - client.last_message) > 5.0)
			{
				if (NET.SendUnreliableMessage(client.netconnection, SV.nop) === -1)
					Host.DropClient(true);
				client.last_message = Host.realtime;
			}
			continue;
		}
		if (client.message.overflowed === true)
		{
			Host.DropClient(true);
			client.message.overflowed = false;
			continue;
		}
		if (client.dropasap === true)
		{
			if (NET.CanSendMessage(client.netconnection) === true)
				Host.DropClient();
		}
		else if (client.message.cursize !== 0)
		{
			if (NET.CanSendMessage(client.netconnection) !== true)
				continue;
			if (NET.SendMessage(client.netconnection, client.message) === -1)
				Host.DropClient(true);
			client.message.cursize = 0;
			client.last_message = Host.realtime;
			client.sendsignon = false;
		}
	}

	for (i = 1; i < SV.server.num_edicts; ++i)
		SV.server.edicts[i].v_float[PR.entvars.effects] &= (~Mod.effects.muzzleflash >>> 0);
};

SV.ModelIndex = function(name)
{
	if (name == null)
		return 0;
	if (name.length === 0)
		return 0;
	var i;
	for (i = 0; i < SV.server.model_precache.length; ++i)
	{
		if (SV.server.model_precache[i] === name)
			return i;
	}
	Sys.Error('SV.ModelIndex: model ' + name + ' not precached');
};

SV.CreateBaseline = function()
{
	var i, svent, baseline;
	var player = SV.ModelIndex('progs/player.mdl');
	var signon = SV.server.signon;
	for (i = 0; i < SV.server.num_edicts; ++i)
	{
		svent = SV.server.edicts[i];
		if (svent.free === true)
			continue;
		if ((i > SV.svs.maxclients) && (svent.v_int[PR.entvars.modelindex] === 0))
			continue;
		baseline = svent.baseline;
		baseline.origin = ED.Vector(svent, PR.entvars.origin);
		baseline.angles = ED.Vector(svent, PR.entvars.angles);
		baseline.frame = svent.v_float[PR.entvars.frame] >> 0;
		baseline.skin = svent.v_float[PR.entvars.skin] >> 0;
		if ((i > 0) && (i <= SV.server.maxclients))
		{
			baseline.colormap = entnum;
			baseline.modelindex = player;
		}
		else
		{
			baseline.colormap = 0;
			baseline.modelindex = SV.ModelIndex(PR.GetString(svent.v_int[PR.entvars.model]));
		}
		MSG.WriteByte(signon, Protocol.svc.spawnbaseline);
		MSG.WriteShort(signon, i);
		MSG.WriteByte(signon, baseline.modelindex);
		MSG.WriteByte(signon, baseline.frame);
		MSG.WriteByte(signon, baseline.colormap);
		MSG.WriteByte(signon, baseline.skin);
		MSG.WriteCoord(signon, baseline.origin[0]);
		MSG.WriteAngle(signon, baseline.angles[0]);
		MSG.WriteCoord(signon, baseline.origin[1]);
		MSG.WriteAngle(signon, baseline.angles[1]);
		MSG.WriteCoord(signon, baseline.origin[2]);
		MSG.WriteAngle(signon, baseline.angles[2]);
	}
};

SV.SaveSpawnparms = function()
{
	SV.svs.serverflags = PR.globals_float[PR.globalvars.serverflags];
	var i, j;
	for (i = 0; i < SV.svs.maxclients; ++i)
	{
		Host.client = SV.svs.clients[i];
		if (Host.client.active !== true)
			continue;
		PR.globals_int[PR.globalvars.self] = Host.client.edict.num;
		PR.ExecuteProgram(PR.globals_int[PR.globalvars.SetChangeParms]);
		for (j = 0; j <= 15; ++j)
			Host.client.spawn_parms[j] = PR.globals_float[PR.globalvars.parms + j];
	}
};

SV.SpawnServer = function(server)
{
	var i;

	if (NET.hostname.string.length === 0)
		Cvar.Set('hostname', 'UNNAMED');

	SCR.centertime_off = 0.0;

	Con.DPrint('SpawnServer: ' + server + '\n');
	SV.svs.changelevel_issued = false;

	if (SV.server.active === true)
	{
		NET.SendToAll(SV.reconnect);
		Cmd.ExecuteString('reconnect\n');
	}

	if (Host.coop.value !== 0)
		Cvar.SetValue('deathmatch', 0);
	Host.current_skill = Math.floor(Host.skill.value + 0.5);
	if (Host.current_skill < 0)
		Host.current_skill = 0;
	else if (Host.current_skill > 3)
		Host.current_skill = 3;
	Cvar.SetValue('skill', Host.current_skill);

	Con.DPrint('Clearing memory\n');
	Mod.ClearAll();

	PR.LoadProgs();

	SV.server.edicts = [];
	var ed;
	for (i = 0; i < Def.max_edicts; ++i)
	{
		ed = {
			num: i,
			free: false,
			area: {},
			leafnums: [],
			baseline: {
				origin: [0.0, 0.0, 0.0],
				angles: [0.0, 0.0, 0.0],
				modelindex: 0,
				frame: 0,
				colormap: 0,
				skin: 0,
				effects: 0
			},
			freetime: 0.0,
			v: new ArrayBuffer(PR.entityfields << 2)
		};
		ed.area.ent = ed;
		ed.v_float = new Float32Array(ed.v);
		ed.v_int = new Int32Array(ed.v);
		SV.server.edicts[i] = ed;
	}

	SV.server.datagram.cursize = 0;
	SV.server.reliable_datagram.cursize = 0;
	SV.server.signon.cursize = 0;
	SV.server.num_edicts = SV.svs.maxclients + 1;
	for (i = 0; i < SV.svs.maxclients; ++i)
		SV.svs.clients[i].edict = SV.server.edicts[i + 1];
	SV.server.loading = true;
	SV.server.paused = false;
	SV.server.loadgame = false;
	SV.server.time = 1.0;
	SV.server.lastcheck = 0;
	SV.server.lastchecktime = 0.0;
	SV.server.modelname = 'maps/' + server + '.bsp';
	SV.server.worldmodel = Mod.ForName(SV.server.modelname);
	if (SV.server.worldmodel == null)
	{
		Con.Print('Couldn\'t spawn server ' + SV.server.modelname + '\n');
		SV.server.active = false;
		return;
	}
	SV.server.models = [];
	SV.server.models[1] = SV.server.worldmodel;

	SV.areanodes = [];
	SV.CreateAreaNode(0, SV.server.worldmodel.mins, SV.server.worldmodel.maxs);

	SV.server.sound_precache = [''];
	SV.server.model_precache = ['', SV.server.modelname];
	for (i = 1; i <= SV.server.worldmodel.submodels.length; ++i)
	{
		SV.server.model_precache[i + 1] = '*' + i;
		SV.server.models[i + 1] = Mod.ForName('*' + i);
	}

	SV.server.lightstyles = [];
	for (i = 0; i <= 63; ++i)
		SV.server.lightstyles[i] = '';

	var ent = SV.server.edicts[0];
	ent.v_int[PR.entvars.model] = PR.NewString(SV.server.modelname, 64);
	ent.v_float[PR.entvars.modelindex] = 1.0;
	ent.v_float[PR.entvars.solid] = SV.solid.bsp;
	ent.v_float[PR.entvars.movetype] = SV.movetype.push;

	if (Host.coop.value !== 0)
		PR.globals_float[PR.globalvars.coop] = Host.coop.value;
	else
		PR.globals_float[PR.globalvars.deathmatch] = Host.deathmatch.value;

	PR.globals_int[PR.globalvars.mapname] = PR.NewString(server, 64);
	PR.globals_float[PR.globalvars.serverflags] = SV.svs.serverflags;
	ED.LoadFromFile(SV.server.worldmodel.entities);
	SV.server.active = true;
	SV.server.loading = false;
	Host.frametime = 0.1;
	SV.Physics();
	SV.Physics();
	SV.CreateBaseline();
	for (i = 0; i < SV.svs.maxclients; ++i)
	{
		Host.client = SV.svs.clients[i];
		if (Host.client.active !== true)
			continue;
		Host.client.edict.v_int[PR.entvars.netname] = PR.netnames + (i << 5);
		SV.SendServerinfo(Host.client);
	}
	Con.DPrint('Server spawned.\n');
};

SV.GetClientName = function(client)
{
	return PR.GetString(PR.netnames + (client.num << 5));
};

SV.SetClientName = function(client, name)
{
	var ofs = PR.netnames + (client.num << 5), i;
	for (i = 0; i < name.length; ++i)
		PR.strings[ofs + i] = name.charCodeAt(i);
	PR.strings[ofs + i] = 0;
};

// move

SV.CheckBottom = function(ent)
{
	var mins = [
		ent.v_float[PR.entvars.origin] + ent.v_float[PR.entvars.mins],
		ent.v_float[PR.entvars.origin1] + ent.v_float[PR.entvars.mins1],
		ent.v_float[PR.entvars.origin2] + ent.v_float[PR.entvars.mins2]
	];
	var maxs = [
		ent.v_float[PR.entvars.origin] + ent.v_float[PR.entvars.maxs],
		ent.v_float[PR.entvars.origin1] + ent.v_float[PR.entvars.maxs1],
		ent.v_float[PR.entvars.origin2] + ent.v_float[PR.entvars.maxs2]
	];
	for (;;)
	{
		if (SV.PointContents([mins[0], mins[1], mins[2] - 1.0]) !== Mod.contents.solid)
			break;
		if (SV.PointContents([mins[0], maxs[1], mins[2] - 1.0]) !== Mod.contents.solid)
			break;
		if (SV.PointContents([maxs[0], mins[1], mins[2] - 1.0]) !== Mod.contents.solid)
			break;
		if (SV.PointContents([maxs[0], maxs[1], mins[2] - 1.0]) !== Mod.contents.solid)
			break;
		return true;
	}
	var start = [(mins[0] + maxs[0]) * 0.5, (mins[1] + maxs[1]) * 0.5, mins[2]];
	var stop = [start[0], start[1], start[2] - 36.0];
	var trace = SV.Move(start, Vec.origin, Vec.origin, stop, 1, ent);
	if (trace.fraction === 1.0)
		return;
	var mid, bottom;
	mid = bottom = trace.endpos[2];
	var x, y;
	for (x = 0; x <= 1; ++x)
	{
		for (y = 0; y <= 1; ++y)
		{
			start[0] = stop[0] = (x !== 0) ? maxs[0] : mins[0];
			start[1] = stop[1] = (y !== 0) ? maxs[1] : mins[1];
			trace = SV.Move(start, Vec.origin, Vec.origin, stop, 1, ent);
			if ((trace.fraction !== 1.0) && (trace.endpos[2] > bottom))
				bottom = trace.endpos[2];
			if ((trace.fraction === 1.0) || ((mid - trace.endpos[2]) > 18.0))
				return;
		}
	}
	return true;
};

SV.movestep = function(ent, move, relink)
{
	var oldorg = ED.Vector(ent, PR.entvars.origin);
	var neworg = [];
	var mins = ED.Vector(ent, PR.entvars.mins), maxs = ED.Vector(ent, PR.entvars.maxs);
	var trace;
	if ((ent.v_float[PR.entvars.flags] & (SV.fl.swim + SV.fl.fly)) !== 0)
	{
		var i, enemy = ent.v_int[PR.entvars.enemy], dz;
		for (i = 0; i <= 1; ++i)
		{
			neworg[0] = ent.v_float[PR.entvars.origin] + move[0];
			neworg[1] = ent.v_float[PR.entvars.origin1] + move[1];
			neworg[2] = ent.v_float[PR.entvars.origin2];
			if ((i === 0) && (enemy !== 0))
			{
				dz = ent.v_float[PR.entvars.origin2] - SV.server.edicts[enemy].v_float[PR.entvars.origin2];
				if (dz > 40.0)
					neworg[2] -= 8.0;
				else if (dz < 30.0)
					neworg[2] += 8.0;
			}
			trace = SV.Move(ED.Vector(ent, PR.entvars.origin), mins, maxs, neworg, 0, ent);
			if (trace.fraction === 1.0)
			{
				if (((ent.v_float[PR.entvars.flags] & SV.fl.swim) !== 0) && (SV.PointContents(trace.endpos) === Mod.contents.empty))
					return 0;
				ent.v_float[PR.entvars.origin] = trace.endpos[0];
				ent.v_float[PR.entvars.origin1] = trace.endpos[1];
				ent.v_float[PR.entvars.origin2] = trace.endpos[2];
				if (relink === true)
					SV.LinkEdict(ent, true);
				return 1;
			}
			if (enemy === 0)
				return 0;
		}
		return 0;
	}
	neworg[0] = ent.v_float[PR.entvars.origin] + move[0];
	neworg[1] = ent.v_float[PR.entvars.origin1] + move[1];
	neworg[2] = ent.v_float[PR.entvars.origin2] + 18.0;
	var end = [neworg[0], neworg[1], neworg[2] - 36.0];
	trace = SV.Move(neworg, mins, maxs, end, 0, ent);
	if (trace.allsolid === true)
		return 0;
	if (trace.startsolid === true)
	{
		neworg[2] -= 18.0;
		trace = SV.Move(neworg, mins, maxs, end, 0, ent);
		if ((trace.allsolid === true) || (trace.startsolid === true))
			return 0;
	}
	if (trace.fraction === 1.0)
	{
		if ((ent.v_float[PR.entvars.flags] & SV.fl.partialground) === 0)
			return 0;
		ent.v_float[PR.entvars.origin] += move[0];
		ent.v_float[PR.entvars.origin1] += move[1];
		if (relink === true)
			SV.LinkEdict(ent, true);
		ent.v_float[PR.entvars.flags] &= (~SV.fl.onground >>> 0);
		return 1;
	}
	ent.v_float[PR.entvars.origin] = trace.endpos[0];
	ent.v_float[PR.entvars.origin1] = trace.endpos[1];
	ent.v_float[PR.entvars.origin2] = trace.endpos[2];
	if (SV.CheckBottom(ent) !== true)
	{
		if ((ent.v_float[PR.entvars.flags] & SV.fl.partialground) !== 0)
		{
			if (relink === true)
				SV.LinkEdict(ent, true);
			return 1;
		}
		ent.v_float[PR.entvars.origin] = oldorg[0];
		ent.v_float[PR.entvars.origin1] = oldorg[1];
		ent.v_float[PR.entvars.origin2] = oldorg[2];
		return 0;
	}
	ent.v_float[PR.entvars.flags] &= (~SV.fl.partialground >>> 0);
	ent.v_int[PR.entvars.groundentity] = trace.ent.num;
	if (relink === true)
		SV.LinkEdict(ent, true);
	return 1;
};

SV.StepDirection = function(ent, yaw, dist)
{
	ent.v_float[PR.entvars.ideal_yaw] = yaw;
	PF.changeyaw();
	yaw *= Math.PI / 180.0;
	var oldorigin = ED.Vector(ent, PR.entvars.origin);
	if (SV.movestep(ent, [Math.cos(yaw) * dist, Math.sin(yaw) * dist], false) === 1)
	{
		var delta = ent.v_float[PR.entvars.angles1] - ent.v_float[PR.entvars.ideal_yaw];
		if ((delta > 45.0) && (delta < 315.0))
			ED.SetVector(ent, PR.entvars.origin, oldorigin);
		SV.LinkEdict(ent, true);
		return true;
	}
	SV.LinkEdict(ent, true);
};

SV.NewChaseDir = function(actor, enemy, dist)
{
	var olddir = Vec.Anglemod(((actor.v_float[PR.entvars.ideal_yaw] / 45.0) >> 0) * 45.0);
	var turnaround = Vec.Anglemod(olddir - 180.0);
	var deltax = enemy.v_float[PR.entvars.origin] - actor.v_float[PR.entvars.origin];
	var deltay = enemy.v_float[PR.entvars.origin1] - actor.v_float[PR.entvars.origin1];
	var dx, dy;
	if (deltax > 10.0)
		dx = 0.0;
	else if (deltax < -10.0)
		dx = 180.0;
	else
		dx = -1;
	if (deltay < -10.0)
		dy = 270.0;
	else if (deltay > 10.0)
		dy = 90.0;
	else
		dy = -1;
	var tdir;
	if ((dx !== -1) && (dy !== -1))
	{
		if (dx === 0.0)
			tdir = (dy === 90.0) ? 45.0 : 315.0;
		else
			tdir = (dy === 90.0) ? 135.0 : 215.0;
		if ((tdir !== turnaround) && (SV.StepDirection(actor, tdir, dist) === true))
			return;
	}
	if ((Math.random() >= 0.25) || (Math.abs(deltay) > Math.abs(deltax)))
	{
		tdir = dx;
		dx = dy;
		dy = tdir;
	}
	if ((dx !== -1) && (dx !== turnaround) && (SV.StepDirection(actor, dx, dist) === true))
		return;
	if ((dy !== -1) && (dy !== turnaround) && (SV.StepDirection(actor, dy, dist) === true))
		return;
	if ((olddir !== -1) && (SV.StepDirection(actor, olddir, dist) === true))
		return;
	if (Math.random() >= 0.5)
	{
		for (tdir = 0.0; tdir <= 315.0; tdir += 45.0)
		{
			if ((tdir !== turnaround) && (SV.StepDirection(actor, tdir, dist) === true))
				return;
		}
	}
	else
	{
		for (tdir = 315.0; tdir >= 0.0; tdir -= 45.0)
		{
			if ((tdir !== turnaround) && (SV.StepDirection(actor, tdir, dist) === true))
				return;
		}
	}
	if ((turnaround !== -1) && (SV.StepDirection(actor, turnaround, dist) === true))
		return;
	actor.v_float[PR.entvars.ideal_yaw] = olddir;
	if (SV.CheckBottom(actor) !== true)
		actor.v_float[PR.entvars.flags] |= SV.fl.partialground;
};

SV.CloseEnough = function(ent, goal, dist)
{
	var i;
	for (i = 0; i <= 2; ++i)
	{
		if (goal.v_float[PR.entvars.absmin + i] > (ent.v_float[PR.entvars.absmax + i] + dist))
			return;
		if (goal.v_float[PR.entvars.absmax + i] < (ent.v_float[PR.entvars.absmin + i] - dist))
			return;
	}
	return true;
};

// phys

SV.CheckAllEnts = function()
{
	var e, check, movetype;
	for (e = 1; e < SV.server.num_edicts; ++e)
	{
		check = SV.server.edicts[e];
		if (check.free === true)
			continue;
		switch (check.v_float[PR.entvars.movetype])
		{
		case SV.movetype.push:
		case SV.movetype.none:
		case SV.movetype.noclip:
			continue;
		}
		if (SV.TestEntityPosition(check) === true)
			Con.Print('entity in invalid position\n');
	}
};

SV.CheckVelocity = function(ent)
{
	var i, velocity;
	for (i = 0; i <= 2; ++i)
	{
		velocity = ent.v_float[PR.entvars.velocity + i];
		if (Q.isNaN(velocity) === true)
		{
			Con.Print('Got a NaN velocity on ' + PR.GetString(ent.v_int[PR.entvars.classname]) + '\n');
			velocity = 0.0;
		}
		if (Q.isNaN(ent.v_float[PR.entvars.origin + i]) === true)
		{
			Con.Print('Got a NaN origin on ' + PR.GetString(ent.v_int[PR.entvars.classname]) + '\n');
			ent.v_float[PR.entvars.origin + i] = 0.0;
		}
		if (velocity > SV.maxvelocity.value)
			velocity = SV.maxvelocity.value;
		else if (velocity < -SV.maxvelocity.value)
			velocity = -SV.maxvelocity.value;
		ent.v_float[PR.entvars.velocity + i] = velocity;
	}
};

SV.RunThink = function(ent)
{
	var thinktime = ent.v_float[PR.entvars.nextthink];
	if ((thinktime <= 0.0) || (thinktime > (SV.server.time + Host.frametime)))
		return true;
	if (thinktime < SV.server.time)
		thinktime = SV.server.time;
	ent.v_float[PR.entvars.nextthink] = 0.0;
	PR.globals_float[PR.globalvars.time] = thinktime;
	PR.globals_int[PR.globalvars.self] = ent.num;
	PR.globals_int[PR.globalvars.other] = 0;
	PR.ExecuteProgram(ent.v_int[PR.entvars.think]);
	return (ent.free !== true);
};

SV.Impact = function(e1, e2)
{
	var old_self = PR.globals_int[PR.globalvars.self];
	var old_other = PR.globals_int[PR.globalvars.other];
	PR.globals_float[PR.globalvars.time] = SV.server.time;

	if ((e1.v_int[PR.entvars.touch] !== 0) && (e1.v_float[PR.entvars.solid] !== SV.solid.not))
	{
		PR.globals_int[PR.globalvars.self] = e1.num;
		PR.globals_int[PR.globalvars.other] = e2.num;
		PR.ExecuteProgram(e1.v_int[PR.entvars.touch]);
	}
	if ((e2.v_int[PR.entvars.touch] !== 0) && (e2.v_float[PR.entvars.solid] !== SV.solid.not))
	{
		PR.globals_int[PR.globalvars.self] = e2.num;
		PR.globals_int[PR.globalvars.other] = e1.num;
		PR.ExecuteProgram(e2.v_int[PR.entvars.touch]);
	}

	PR.globals_int[PR.globalvars.self] = old_self;
	PR.globals_int[PR.globalvars.other] = old_other;
};

SV.ClipVelocity = function(vec, normal, out, overbounce)
{
	var backoff = (vec[0] * normal[0] + vec[1] * normal[1] + vec[2] * normal[2]) * overbounce;

	out[0] = vec[0] - normal[0] * backoff;
	if ((out[0] > -0.1) && (out[0] < 0.1))
		out[0] = 0.0;
	out[1] = vec[1] - normal[1] * backoff;
	if ((out[1] > -0.1) && (out[1] < 0.1))
		out[1] = 0.0;
	out[2] = vec[2] - normal[2] * backoff;
	if ((out[2] > -0.1) && (out[2] < 0.1))
		out[2] = 0.0;
};

SV.FlyMove = function(ent, time)
{
	var bumpcount;
	var numplanes = 0;
	var dir, d;
	var planes = [], plane;
	var primal_velocity = ED.Vector(ent, PR.entvars.velocity);
	var original_velocity = ED.Vector(ent, PR.entvars.velocity);
	var new_velocity = [];
	var i, j;
	var trace;
	var end = [];
	var time_left = time;
	var blocked = 0;
	for (bumpcount = 0; bumpcount <= 3; ++bumpcount)
	{
		if ((ent.v_float[PR.entvars.velocity] === 0.0) &&
			(ent.v_float[PR.entvars.velocity1] === 0.0) &&
			(ent.v_float[PR.entvars.velocity2] === 0.0))
			break;
		end[0] = ent.v_float[PR.entvars.origin] + time_left * ent.v_float[PR.entvars.velocity];
		end[1] = ent.v_float[PR.entvars.origin1] + time_left * ent.v_float[PR.entvars.velocity1];
		end[2] = ent.v_float[PR.entvars.origin2] + time_left * ent.v_float[PR.entvars.velocity2];
		trace = SV.Move(ED.Vector(ent, PR.entvars.origin), ED.Vector(ent, PR.entvars.mins), ED.Vector(ent, PR.entvars.maxs), end, 0, ent);
		if (trace.allsolid === true)
		{
			ED.SetVector(ent, PR.entvars.velocity, Vec.origin);
			return 3;
		}
		if (trace.fraction > 0.0)
		{
			ED.SetVector(ent, PR.entvars.origin, trace.endpos);
			original_velocity = ED.Vector(ent, PR.entvars.velocity);
			numplanes = 0;
			if (trace.fraction === 1.0)
				break;
		}
		if (trace.ent == null)
			Sys.Error('SV.FlyMove: !trace.ent');
		if (trace.plane.normal[2] > 0.7)
		{
			blocked |= 1;
			if (trace.ent.v_float[PR.entvars.solid] === SV.solid.bsp)
			{
				ent.v_float[PR.entvars.flags] |= SV.fl.onground;
				ent.v_int[PR.entvars.groundentity] = trace.ent.num;
			}
		}
		else if (trace.plane.normal[2] === 0.0)
		{
			blocked |= 2;
			SV.steptrace = trace;
		}
		SV.Impact(ent, trace.ent);
		if (ent.free === true)
			break;
		time_left -= time_left * trace.fraction;
		if (numplanes >= 5)
		{
			ED.SetVector(ent, PR.entvars.velocity, Vec.origin);
			return 3;
		}
		planes[numplanes++] = [trace.plane.normal[0], trace.plane.normal[1], trace.plane.normal[2]];
		for (i = 0; i < numplanes; ++i)
		{
			SV.ClipVelocity(original_velocity, planes[i], new_velocity, 1.0);
			for (j = 0; j < numplanes; ++j)
			{
				if (j !== i)
				{
					plane = planes[j];
					if ((new_velocity[0] * plane[0] + new_velocity[1] * plane[1] + new_velocity[2] * plane[2]) < 0.0)
						break;
				}
			}
			if (j === numplanes)
				break;
		}
		if (i !== numplanes)
			ED.SetVector(ent, PR.entvars.velocity, new_velocity);
		else
		{
			if (numplanes !== 2)
			{
				ED.SetVector(ent, PR.entvars.velocity, Vec.origin);
				return 7;
			}
			dir = Vec.CrossProduct(planes[0], planes[1]);
			d = dir[0] * ent.v_float[PR.entvars.velocity] +
				dir[1] * ent.v_float[PR.entvars.velocity1] +
				dir[2] * ent.v_float[PR.entvars.velocity2];
			ent.v_float[PR.entvars.velocity] = dir[0] * d;
			ent.v_float[PR.entvars.velocity1] = dir[1] * d;
			ent.v_float[PR.entvars.velocity2] = dir[2] * d;
		}
		if ((ent.v_float[PR.entvars.velocity] * primal_velocity[0] +
			ent.v_float[PR.entvars.velocity1] * primal_velocity[1] +
			ent.v_float[PR.entvars.velocity2] * primal_velocity[2]) <= 0.0)
		{
			ED.SetVector(ent, PR.entvars.velocity, Vec.origin);
			return blocked;
		}
	}
	return blocked;
};

SV.AddGravity = function(ent)
{
	var val = PR.entvars.gravity, ent_gravity;
	if (val != null)
		ent_gravity = (ent.v_float[val] !== 0.0) ? ent.v_float[val] : 1.0;
	else
		ent_gravity = 1.0;
	ent.v_float[PR.entvars.velocity2] -= ent_gravity * SV.gravity.value * Host.frametime;
};

SV.PushEntity = function(ent, push)
{
	var end = [
		ent.v_float[PR.entvars.origin] + push[0],
		ent.v_float[PR.entvars.origin1] + push[1],
		ent.v_float[PR.entvars.origin2] + push[2]
	];
	var nomonsters;
	var solid = ent.v_float[PR.entvars.solid];
	if (ent.v_float[PR.entvars.movetype] === SV.movetype.flymissile)
		nomonsters = SV.move.missile;
	else if ((solid === SV.solid.trigger) || (solid === SV.solid.not))
		nomonsters = SV.move.nomonsters
	else
		nomonsters = SV.move.normal;
	var trace = SV.Move(ED.Vector(ent, PR.entvars.origin), ED.Vector(ent, PR.entvars.mins),
		ED.Vector(ent, PR.entvars.maxs), end, nomonsters, ent);
	ED.SetVector(ent, PR.entvars.origin, trace.endpos);
	SV.LinkEdict(ent, true);
	if (trace.ent != null)
		SV.Impact(ent, trace.ent);
	return trace;
};

SV.PushMove = function(pusher, movetime)
{
	if ((pusher.v_float[PR.entvars.velocity] === 0.0) &&
		(pusher.v_float[PR.entvars.velocity1] === 0.0) &&
		(pusher.v_float[PR.entvars.velocity2] === 0.0))
	{
		pusher.v_float[PR.entvars.ltime] += movetime;
		return;
	}
	var move = [
		pusher.v_float[PR.entvars.velocity] * movetime,
		pusher.v_float[PR.entvars.velocity1] * movetime,
		pusher.v_float[PR.entvars.velocity2] * movetime
	];
	var mins = [
		pusher.v_float[PR.entvars.absmin] + move[0],
		pusher.v_float[PR.entvars.absmin1] + move[1],
		pusher.v_float[PR.entvars.absmin2] + move[2]
	];
	var maxs = [
		pusher.v_float[PR.entvars.absmax] + move[0],
		pusher.v_float[PR.entvars.absmax1] + move[1],
		pusher.v_float[PR.entvars.absmax2] + move[2]
	];
	var pushorig = ED.Vector(pusher, PR.entvars.origin);
	pusher.v_float[PR.entvars.origin] += move[0];
	pusher.v_float[PR.entvars.origin1] += move[1];
	pusher.v_float[PR.entvars.origin2] += move[2];
	pusher.v_float[PR.entvars.ltime] += movetime;
	SV.LinkEdict(pusher);
	var e, check, movetype;
	var entorig, moved = [], moved_edict, i;
	for (e = 1; e < SV.server.num_edicts; ++e)
	{
		check = SV.server.edicts[e];
		if (check.free === true)
			continue;
		movetype = check.v_float[PR.entvars.movetype];
		if ((movetype === SV.movetype.push)
			|| (movetype === SV.movetype.none)
			|| (movetype === SV.movetype.noclip))
			continue;
		if (((check.v_float[PR.entvars.flags] & SV.fl.onground) === 0) ||
			(check.v_int[PR.entvars.groundentity] !== pusher.num))
		{
			if ((check.v_float[PR.entvars.absmin] >= maxs[0])
				|| (check.v_float[PR.entvars.absmin1] >= maxs[1])
				|| (check.v_float[PR.entvars.absmin2] >= maxs[2])
				|| (check.v_float[PR.entvars.absmax] <= mins[0])
				|| (check.v_float[PR.entvars.absmax1] <= mins[1])
				|| (check.v_float[PR.entvars.absmax2] <= mins[2]))
				continue;
			if (SV.TestEntityPosition(check) !== true)
				continue;
		}
		if (movetype !== SV.movetype.walk)
			check.v_float[PR.entvars.flags] &= (~SV.fl.onground) >>> 0;
		entorig = ED.Vector(check, PR.entvars.origin);
		moved[moved.length] = [entorig[0], entorig[1], entorig[2], check];
		pusher.v_float[PR.entvars.solid] = SV.solid.not;
		SV.PushEntity(check, move);
		pusher.v_float[PR.entvars.solid] = SV.solid.bsp;
		if (SV.TestEntityPosition(check) === true)
		{
			if (check.v_float[PR.entvars.mins] === check.v_float[PR.entvars.maxs])
				continue;
			if ((check.v_float[PR.entvars.solid] === SV.solid.not) || (check.v_float[PR.entvars.solid] === SV.solid.trigger))
			{
				check.v_float[PR.entvars.mins] = check.v_float[PR.entvars.maxs] = 0.0;
				check.v_float[PR.entvars.mins1] = check.v_float[PR.entvars.maxs1] = 0.0;
				check.v_float[PR.entvars.maxs2] = check.v_float[PR.entvars.mins2];
				continue;
			}
			check.v_float[PR.entvars.origin] = entorig[0];
			check.v_float[PR.entvars.origin1] = entorig[1];
			check.v_float[PR.entvars.origin2] = entorig[2];
			SV.LinkEdict(check, true);
			pusher.v_float[PR.entvars.origin] = pushorig[0];
			pusher.v_float[PR.entvars.origin1] = pushorig[1];
			pusher.v_float[PR.entvars.origin2] = pushorig[2];
			SV.LinkEdict(pusher);
			pusher.v_float[PR.entvars.ltime] -= movetime;
			if (pusher.v_int[PR.entvars.blocked] !== 0)
			{
				PR.globals_int[PR.globalvars.self] = pusher.num;
				PR.globals_int[PR.globalvars.other] = check.num;
				PR.ExecuteProgram(pusher.v_int[PR.entvars.blocked]);
			}
			for (i = 0; i < moved.length; ++i)
			{
				moved_edict = moved[i];
				moved_edict[3].v_float[PR.entvars.origin] = moved_edict[0];
				moved_edict[3].v_float[PR.entvars.origin1] = moved_edict[1];
				moved_edict[3].v_float[PR.entvars.origin2] = moved_edict[2];
				SV.LinkEdict(moved_edict[3]);
			}
			return;
		}
	}
};

SV.Physics_Pusher = function(ent)
{
	var oldltime = ent.v_float[PR.entvars.ltime];
	var thinktime = ent.v_float[PR.entvars.nextthink];
	var movetime;
	if (thinktime < (oldltime + Host.frametime))
	{
		movetime = thinktime - oldltime;
		if (movetime < 0.0)
			movetime = 0.0;
	}
	else
		movetime = Host.frametime;
	if (movetime !== 0.0)
		SV.PushMove(ent, movetime);
	if ((thinktime <= oldltime) || (thinktime > ent.v_float[PR.entvars.ltime]))
		return;
	ent.v_float[PR.entvars.nextthink] = 0.0;
	PR.globals_float[PR.globalvars.time] = SV.server.time;
	PR.globals_int[PR.globalvars.self] = ent.num;
	PR.globals_int[PR.globalvars.other] = 0;
	PR.ExecuteProgram(ent.v_int[PR.entvars.think]);
};

SV.CheckStuck = function(ent)
{
	if (SV.TestEntityPosition(ent) !== true)
	{
		ent.v_float[PR.entvars.oldorigin] = ent.v_float[PR.entvars.origin];
		ent.v_float[PR.entvars.oldorigin1] = ent.v_float[PR.entvars.origin1];
		ent.v_float[PR.entvars.oldorigin2] = ent.v_float[PR.entvars.origin2];
		return;
	}
	var org = ED.Vector(ent, PR.entvars.origin);
	ent.v_float[PR.entvars.origin] = ent.v_float[PR.entvars.oldorigin];
	ent.v_float[PR.entvars.origin1] = ent.v_float[PR.entvars.oldorigin1];
	ent.v_float[PR.entvars.origin2] = ent.v_float[PR.entvars.oldorigin2];
	if (SV.TestEntityPosition(ent) !== true)
	{
		Con.DPrint('Unstuck.\n');
		SV.LinkEdict(ent, true);
		return;
	}
	var z, i, j;
	for (z = 0.0; z <= 17.0; ++z)
	{
		for (i = -1.0; i <= 1.0; ++i)
		{
			for (j = -1.0; j <= 1.0; ++j)
			{
				ent.v_float[PR.entvars.origin] = org[0] + i;
				ent.v_float[PR.entvars.origin1] = org[1] + j;
				ent.v_float[PR.entvars.origin2] = org[2] + z;
				if (SV.TestEntityPosition(ent) !== true)
				{
					Con.DPrint('Unstuck.\n');
					SV.LinkEdict(ent, true);
					return;
				}
			}
		}
	}
	ED.SetVector(ent, PR.entvars.origin, org);
	Con.DPrint('player is stuck.\n');
};

SV.CheckWater = function(ent)
{
	var point = [
		ent.v_float[PR.entvars.origin],
		ent.v_float[PR.entvars.origin1],
		ent.v_float[PR.entvars.origin2] + ent.v_float[PR.entvars.mins2] + 1.0
	];
	ent.v_float[PR.entvars.waterlevel] = 0.0;
	ent.v_float[PR.entvars.watertype] = Mod.contents.empty;
	var cont = SV.PointContents(point);
	if (cont > Mod.contents.water)
		return;
	ent.v_float[PR.entvars.watertype] = cont;
	ent.v_float[PR.entvars.waterlevel] = 1.0;
	point[2] = ent.v_float[PR.entvars.origin2] + (ent.v_float[PR.entvars.mins2] + ent.v_float[PR.entvars.maxs2]) * 0.5;
	cont = SV.PointContents(point);
	if (cont <= Mod.contents.water)
	{
		ent.v_float[PR.entvars.waterlevel] = 2.0;
		point[2] = ent.v_float[PR.entvars.origin2] + ent.v_float[PR.entvars.view_ofs2];
		cont = SV.PointContents(point);
		if (cont <= Mod.contents.water)
			ent.v_float[PR.entvars.waterlevel] = 3.0;
	}
	return ent.v_float[PR.entvars.waterlevel] > 1.0;
};

SV.WallFriction = function(ent, trace)
{
	var forward = [];
	Vec.AngleVectors(ED.Vector(ent, PR.entvars.v_angle), forward);
	var normal = trace.plane.normal;
	var d = normal[0] * forward[0] + normal[1] * forward[1] + normal[2] * forward[2] + 0.5;
	if (d >= 0.0)
		return;
	d += 1.0;
	var i = normal[0] * ent.v_float[PR.entvars.velocity]
		+ normal[1] * ent.v_float[PR.entvars.velocity1]
		+ normal[2] * ent.v_float[PR.entvars.velocity2];
	ent.v_float[PR.entvars.velocity] = (ent.v_float[PR.entvars.velocity] - normal[0] * i) * d; 
	ent.v_float[PR.entvars.velocity1] = (ent.v_float[PR.entvars.velocity1] - normal[1] * i) * d; 
};

SV.TryUnstick = function(ent, oldvel)
{
	var oldorg = ED.Vector(ent, PR.entvars.origin);
	var dir = [2.0, 0.0, 0.0];
	var i, clip;
	for (i = 0; i <= 7; ++i)
	{
		switch (i)
		{
		case 1: dir[0] = 0.0; dir[1] = 2.0; break;
		case 2: dir[0] = -2.0; dir[1] = 0.0; break;
		case 3: dir[0] = 0.0; dir[1] = -2.0; break;
		case 4: dir[0] = 2.0; dir[1] = 2.0; break;
		case 5: dir[0] = -2.0; dir[1] = 2.0; break;
		case 6: dir[0] = 2.0; dir[1] = -2.0; break;
		case 7: dir[0] = -2.0; dir[1] = -2.0;
		}
		SV.PushEntity(ent, dir);
		ent.v_float[PR.entvars.velocity] = oldvel[0];
		ent.v_float[PR.entvars.velocity1] = oldvel[1];
		ent.v_float[PR.entvars.velocity2] = 0.0;
		clip = SV.FlyMove(ent, 0.1);
		if ((Math.abs(oldorg[1] - ent.v_float[PR.entvars.origin1]) > 4.0)
			|| (Math.abs(oldorg[0] - ent.v_float[PR.entvars.origin]) > 4.0))
			return clip;
		ED.SetVector(ent, PR.entvars.origin, oldorg);
	}
	ED.SetVector(ent, PR.entvars.velocity, Vec.origin);
	return 7;
};

SV.WalkMove = function(ent)
{
	var oldonground = ent.v_float[PR.entvars.flags] & SV.fl.onground;
	ent.v_float[PR.entvars.flags] ^= oldonground;
	var oldorg = ED.Vector(ent, PR.entvars.origin);
	var oldvel = ED.Vector(ent, PR.entvars.velocity);
	var clip = SV.FlyMove(ent, Host.frametime);
	if ((clip & 2) === 0)
		return;
	if ((oldonground === 0) && (ent.v_float[PR.entvars.waterlevel] === 0.0))
		return;
	if (ent.v_float[PR.entvars.movetype] !== SV.movetype.walk)
		return;
	if (SV.nostep.value !== 0)
		return;
	if ((SV.player.v_float[PR.entvars.flags] & SV.fl.waterjump) !== 0)
		return;
	var nosteporg = ED.Vector(ent, PR.entvars.origin);
	var nostepvel = ED.Vector(ent, PR.entvars.velocity);
	ED.SetVector(ent, PR.entvars.origin, oldorg);
	SV.PushEntity(ent, [0.0, 0.0, 18.0]);
	ent.v_float[PR.entvars.velocity] = oldvel[0];
	ent.v_float[PR.entvars.velocity1] = oldvel[1];
	ent.v_float[PR.entvars.velocity2] = 0.0;
	clip = SV.FlyMove(ent, Host.frametime);
	if (clip !== 0)
	{
		if ((Math.abs(oldorg[1] - ent.v_float[PR.entvars.origin1]) < 0.03125)
			&& (Math.abs(oldorg[0] - ent.v_float[PR.entvars.origin]) < 0.03125))
			clip = SV.TryUnstick(ent, oldvel);
		if ((clip & 2) !== 0)
			SV.WallFriction(ent, SV.steptrace);
	}
	var downtrace = SV.PushEntity(ent, [0.0, 0.0, oldvel[2] * Host.frametime - 18.0]);
	if (downtrace.plane.normal[2] > 0.7)
	{
		if (ent.v_float[PR.entvars.solid] === SV.solid.bsp)
		{
			ent.v_float[PR.entvars.flags] |= SV.fl.onground;
			ent.v_int[PR.entvars.groundentity] = downtrace.ent.num;
		}
		return;
	}
	ED.SetVector(ent, PR.entvars.origin, nosteporg);
	ED.SetVector(ent, PR.entvars.velocity, nostepvel);
};

SV.Physics_Client = function(ent)
{
	if (SV.svs.clients[ent.num - 1].active !== true)
		return;
	PR.globals_float[PR.globalvars.time] = SV.server.time;
	PR.globals_int[PR.globalvars.self] = ent.num;
	PR.ExecuteProgram(PR.globals_int[PR.globalvars.PlayerPreThink]);
	SV.CheckVelocity(ent);
	var movetype = ent.v_float[PR.entvars.movetype] >> 0;
	if ((movetype === SV.movetype.toss) || (movetype === SV.movetype.bounce))
		SV.Physics_Toss(ent);
	else
	{
		if (SV.RunThink(ent) !== true)
			return;
		switch (movetype)
		{
		case SV.movetype.none:
			break;
		case SV.movetype.walk:
			if ((SV.CheckWater(ent) !== true) && ((ent.v_float[PR.entvars.flags] & SV.fl.waterjump) === 0))
				SV.AddGravity(ent);
			SV.CheckStuck(ent);
			SV.WalkMove(ent);
			break;
		case SV.movetype.fly:
			SV.FlyMove(ent, Host.frametime);
			break;
		case SV.movetype.noclip:
			ent.v_float[PR.entvars.origin] += Host.frametime * ent.v_float[PR.entvars.velocity];
			ent.v_float[PR.entvars.origin1] += Host.frametime * ent.v_float[PR.entvars.velocity1];
			ent.v_float[PR.entvars.origin2] += Host.frametime * ent.v_float[PR.entvars.velocity2];
			break;
		default:
			Sys.Error('SV.Physics_Client: bad movetype ' + movetype);
		}
	}
	SV.LinkEdict(ent, true);
	PR.globals_float[PR.globalvars.time] = SV.server.time;
	PR.globals_int[PR.globalvars.self] = ent.num;
	PR.ExecuteProgram(PR.globals_int[PR.globalvars.PlayerPostThink]);
};

SV.Physics_Noclip = function(ent)
{
	if (SV.RunThink(ent) !== true)
		return;
	ent.v_float[PR.entvars.angles] += Host.frametime * ent.v_float[PR.entvars.avelocity];
	ent.v_float[PR.entvars.angles1] += Host.frametime * ent.v_float[PR.entvars.avelocity1];
	ent.v_float[PR.entvars.angles2] += Host.frametime * ent.v_float[PR.entvars.avelocity2];
	ent.v_float[PR.entvars.origin] += Host.frametime * ent.v_float[PR.entvars.velocity];
	ent.v_float[PR.entvars.origin1] += Host.frametime * ent.v_float[PR.entvars.velocity1];
	ent.v_float[PR.entvars.origin2] += Host.frametime * ent.v_float[PR.entvars.velocity2];
	SV.LinkEdict(ent);
};

SV.CheckWaterTransition = function(ent)
{
	var cont = SV.PointContents(ED.Vector(ent, PR.entvars.origin));
	if (ent.v_float[PR.entvars.watertype] === 0.0)
	{
		ent.v_float[PR.entvars.watertype] = cont;
		ent.v_float[PR.entvars.waterlevel] = 1.0;
		return;
	}
	if (cont <= Mod.contents.water)
	{
		if (ent.v_float[PR.entvars.watertype] === Mod.contents.empty)
			SV.StartSound(ent, 0, 'misc/h2ohit1.wav', 255, 1.0);
		ent.v_float[PR.entvars.watertype] = cont;
		ent.v_float[PR.entvars.waterlevel] = 1.0;
		return;
	}
	if (ent.v_float[PR.entvars.watertype] !== Mod.contents.empty)
		SV.StartSound(ent, 0, 'misc/h2ohit1.wav', 255, 1.0);
	ent.v_float[PR.entvars.watertype] = Mod.contents.empty;
	ent.v_float[PR.entvars.waterlevel] = cont;
};

SV.Physics_Toss = function(ent)
{
	if (SV.RunThink(ent) !== true)
		return;
	if ((ent.v_float[PR.entvars.flags] & SV.fl.onground) !== 0)
		return;
	SV.CheckVelocity(ent);
	var movetype = ent.v_float[PR.entvars.movetype];
	if ((movetype !== SV.movetype.fly) && (movetype !== SV.movetype.flymissile))
		SV.AddGravity(ent);
	ent.v_float[PR.entvars.angles] += Host.frametime * ent.v_float[PR.entvars.avelocity];
	ent.v_float[PR.entvars.angles1] += Host.frametime * ent.v_float[PR.entvars.avelocity1];
	ent.v_float[PR.entvars.angles2] += Host.frametime * ent.v_float[PR.entvars.avelocity2];
	var trace = SV.PushEntity(ent,
		[
			ent.v_float[PR.entvars.velocity] * Host.frametime,
			ent.v_float[PR.entvars.velocity1] * Host.frametime,
			ent.v_float[PR.entvars.velocity2] * Host.frametime
		]);
	if ((trace.fraction === 1.0) || (ent.free === true))
		return;
	var velocity = [];
	SV.ClipVelocity(ED.Vector(ent, PR.entvars.velocity), trace.plane.normal, velocity, (movetype === SV.movetype.bounce) ? 1.5 : 1.0);
	ED.SetVector(ent, PR.entvars.velocity, velocity);
	if (trace.plane.normal[2] > 0.7)
	{
		if ((ent.v_float[PR.entvars.velocity2] < 60.0) || (movetype !== SV.movetype.bounce))
		{
			ent.v_float[PR.entvars.flags] |= SV.fl.onground;
			ent.v_int[PR.entvars.groundentity] = trace.ent.num;
			ent.v_float[PR.entvars.velocity] = ent.v_float[PR.entvars.velocity1] = ent.v_float[PR.entvars.velocity2] = 0.0;
			ent.v_float[PR.entvars.avelocity] = ent.v_float[PR.entvars.avelocity1] = ent.v_float[PR.entvars.avelocity2] = 0.0;
		}
	}
	SV.CheckWaterTransition(ent);
};

SV.Physics_Step = function(ent)
{
	if ((ent.v_float[PR.entvars.flags] & (SV.fl.onground + SV.fl.fly + SV.fl.swim)) === 0)
	{
		var hitsound = (ent.v_float[PR.entvars.velocity2] < (SV.gravity.value * -0.1));
		SV.AddGravity(ent);
		SV.CheckVelocity(ent);
		SV.FlyMove(ent, Host.frametime);
		SV.LinkEdict(ent, true);
		if (((ent.v_float[PR.entvars.flags] & SV.fl.onground) !== 0) && (hitsound === true))
			SV.StartSound(ent, 0, 'demon/dland2.wav', 255, 1.0);
	}
	SV.RunThink(ent);
	SV.CheckWaterTransition(ent);
};

SV.Physics = function()
{
	PR.globals_int[PR.globalvars.self] = 0;
	PR.globals_int[PR.globalvars.other] = 0;
	PR.globals_float[PR.globalvars.time] = SV.server.time;
	PR.ExecuteProgram(PR.globals_int[PR.globalvars.StartFrame]);
	var i, ent;
	for (i = 0; i < SV.server.num_edicts; ++i)
	{
		ent = SV.server.edicts[i];
		if (ent.free === true)
			continue;
		if (PR.globals_float[PR.globalvars.force_retouch] !== 0.0)
			SV.LinkEdict(ent, true);
		if ((i > 0) && (i <= SV.svs.maxclients))
		{
			SV.Physics_Client(ent);
			continue;
		}
		switch (ent.v_float[PR.entvars.movetype])
		{
		case SV.movetype.push:
			SV.Physics_Pusher(ent);
			continue;
		case SV.movetype.none:
			SV.RunThink(ent);
			continue;
		case SV.movetype.noclip:
			SV.RunThink(ent);
			continue;
		case SV.movetype.step:
			SV.Physics_Step(ent);
			continue;
		case SV.movetype.toss:
		case SV.movetype.bounce:
		case SV.movetype.fly:
		case SV.movetype.flymissile:
			SV.Physics_Toss(ent);
			continue;
		}
		Sys.Error('SV.Physics: bad movetype ' + (ent.v_float[PR.entvars.movetype] >> 0));
	}
	if (PR.globals_float[PR.globalvars.force_retouch] !== 0.0)
		--PR.globals_float[PR.globalvars.force_retouch];
	SV.server.time += Host.frametime;
};

// user

SV.SetIdealPitch = function()
{
	var ent = SV.player;
	if ((ent.v_float[PR.entvars.flags] & SV.fl.onground) === 0)
		return;
	var angleval = ent.v_float[PR.entvars.angles1] * (Math.PI / 180.0);
	var sinval = Math.sin(angleval);
	var cosval = Math.cos(angleval);
	var top = [0.0, 0.0, ent.v_float[PR.entvars.origin2] + ent.v_float[PR.entvars.view_ofs2]];
	var bottom = [0.0, 0.0, top[2] - 160.0];
	var i, tr, z = [];
	for (i = 0; i < 6; ++i)
	{
		top[0] = bottom[0] = ent.v_float[PR.entvars.origin] + cosval * (i + 3) * 12.0;
		top[1] = bottom[1] = ent.v_float[PR.entvars.origin1] + sinval * (i + 3) * 12.0;
		tr = SV.Move(top, Vec.origin, Vec.origin, bottom, 1, ent);
		if ((tr.allsolid === true) || (tr.fraction === 1.0))
			return;
		z[i] = top[2] - tr.fraction * 160.0;
	}
	var dir = 0.0, step, steps = 0;
	for (i = 1; i < 6; ++i)
	{
		step = z[i] - z[i - 1];
		if ((step > -0.1) && (step < 0.1))
			continue;
		if ((dir !== 0.0) && (((step - dir) > 0.1) || ((step - dir) < -0.1)))
			return;
		++steps;
		dir = step;
	}
	if (dir === 0.0)
	{
		ent.v_float[PR.entvars.idealpitch] = 0.0;
		return;
	}
	if (steps >= 2)
		ent.v_float[PR.entvars.idealpitch] = -dir * SV.idealpitchscale.value;
};

SV.UserFriction = function()
{
	var ent = SV.player;
	var vel0 = ent.v_float[PR.entvars.velocity], vel1 = ent.v_float[PR.entvars.velocity1];
	var speed = Math.sqrt(vel0 * vel0 + vel1 * vel1);
	if (speed === 0.0)
		return;
	var start = [
		ent.v_float[PR.entvars.origin] + vel0 / speed * 16.0,
		ent.v_float[PR.entvars.origin1] + vel1 / speed * 16.0,
		ent.v_float[PR.entvars.origin2] + ent.v_float[PR.entvars.mins2]
	];
	var friction = SV.friction.value;
	if (SV.Move(start, Vec.origin, Vec.origin, [start[0], start[1], start[2] - 34.0], 1, ent).fraction === 1.0)
		friction *= SV.edgefriction.value;
	var newspeed = speed - Host.frametime * (speed < SV.stopspeed.value ? SV.stopspeed.value : speed) * friction;
	if (newspeed < 0.0)
		newspeed = 0.0;
	newspeed /= speed;
	ent.v_float[PR.entvars.velocity] *= newspeed;
	ent.v_float[PR.entvars.velocity1] *= newspeed;
	ent.v_float[PR.entvars.velocity2] *= newspeed;
};

SV.Accelerate = function(wishvel, air)
{
	var ent = SV.player;
	var wishdir = [wishvel[0], wishvel[1], wishvel[2]];
	var wishspeed = Vec.Normalize(wishdir);
	if ((air === true) && (wishspeed > 30.0))
		wishspeed = 30.0;
	var addspeed = wishspeed - (ent.v_float[PR.entvars.velocity] * wishdir[0]
		+ ent.v_float[PR.entvars.velocity1] * wishdir[1]
		+ ent.v_float[PR.entvars.velocity2] * wishdir[2]
	);
	if (addspeed <= 0.0)
		return;
	var accelspeed = SV.accelerate.value * Host.frametime * wishspeed;
	if (accelspeed > addspeed)
		accelspeed = addspeed;
	ent.v_float[PR.entvars.velocity] += accelspeed * wishdir[0];
	ent.v_float[PR.entvars.velocity1] += accelspeed * wishdir[1];
	ent.v_float[PR.entvars.velocity2] += accelspeed * wishdir[2];
};

SV.WaterMove = function()
{
	var ent = SV.player, cmd = Host.client.cmd;
	var forward = [], right = [];
	Vec.AngleVectors(ED.Vector(ent, PR.entvars.v_angle), forward, right);
	var wishvel = [
		forward[0] * cmd.forwardmove + right[0] * cmd.sidemove,
		forward[1] * cmd.forwardmove + right[1] * cmd.sidemove,
		forward[2] * cmd.forwardmove + right[2] * cmd.sidemove
	];
	if ((cmd.forwardmove === 0.0) && (cmd.sidemove === 0.0) && (cmd.upmove === 0.0))
		wishvel[2] -= 60.0;
	else
		wishvel[2] += cmd.upmove;
	var wishspeed = Math.sqrt(wishvel[0] * wishvel[0] + wishvel[1] * wishvel[1] + wishvel[2] * wishvel[2]);
	var scale;
	if (wishspeed > SV.maxspeed.value)
	{
		scale = SV.maxspeed.value / wishspeed;
		wishvel[0] *= scale;
		wishvel[1] *= scale;
		wishvel[2] *= scale;
		wishspeed = SV.maxspeed.value;
	}
	wishspeed *= 0.7;
	var speed = Math.sqrt(ent.v_float[PR.entvars.velocity] * ent.v_float[PR.entvars.velocity]
		+ ent.v_float[PR.entvars.velocity1] * ent.v_float[PR.entvars.velocity1]
		+ ent.v_float[PR.entvars.velocity2] * ent.v_float[PR.entvars.velocity2]
	), newspeed;
	if (speed !== 0.0)
	{
		newspeed = speed - Host.frametime * speed * SV.friction.value;
		if (newspeed < 0.0)
			newspeed = 0.0;
		scale = newspeed / speed;
		ent.v_float[PR.entvars.velocity] *= scale;
		ent.v_float[PR.entvars.velocity1] *= scale;
		ent.v_float[PR.entvars.velocity2] *= scale;
	}
	else
		newspeed = 0.0;
	if (wishspeed === 0.0)
		return;
	var addspeed = wishspeed - newspeed;
	if (addspeed <= 0.0)
		return;
	var accelspeed = SV.accelerate.value * wishspeed * Host.frametime;
	if (accelspeed > addspeed)
		accelspeed = addspeed;
	ent.v_float[PR.entvars.velocity] += accelspeed * (wishvel[0] / wishspeed);
	ent.v_float[PR.entvars.velocity1] += accelspeed * (wishvel[1] / wishspeed);
	ent.v_float[PR.entvars.velocity2] += accelspeed * (wishvel[2] / wishspeed);
};

SV.WaterJump = function()
{
	var ent = SV.player;
	if ((SV.server.time > ent.v_float[PR.entvars.teleport_time]) || (ent.v_float[PR.entvars.waterlevel] === 0.0))
	{
		ent.v_float[PR.entvars.flags] &= (~SV.fl.waterjump >>> 0);
		ent.v_float[PR.entvars.teleport_time] = 0.0;
	}
	ent.v_float[PR.entvars.velocity] = ent.v_float[PR.entvars.movedir];
	ent.v_float[PR.entvars.velocity1] = ent.v_float[PR.entvars.movedir1];
};

SV.AirMove = function()
{
	var ent = SV.player;
	var cmd = Host.client.cmd;
	var forward = [], right = [];
	Vec.AngleVectors(ED.Vector(ent, PR.entvars.angles), forward, right);
	var fmove = cmd.forwardmove;
	var smove = cmd.sidemove;
	if ((SV.server.time < ent.v_float[PR.entvars.teleport_time]) && (fmove < 0.0))
		fmove = 0.0;
	var wishvel = [
		forward[0] * fmove + right[0] * smove,
		forward[1] * fmove + right[1] * smove,
		((ent.v_float[PR.entvars.movetype] >> 0) !== SV.movetype.walk) ? cmd.upmove : 0.0];
	var wishdir = [wishvel[0], wishvel[1], wishvel[2]];
	if (Vec.Normalize(wishdir) > SV.maxspeed.value)
	{
		wishvel[0] = wishdir[0] * SV.maxspeed.value;
		wishvel[1] = wishdir[1] * SV.maxspeed.value;
		wishvel[2] = wishdir[2] * SV.maxspeed.value;
	}
	if (ent.v_float[PR.entvars.movetype] === SV.movetype.noclip)
		ED.SetVector(ent, PR.entvars.velocity, wishvel);
	else if ((ent.v_float[PR.entvars.flags] & SV.fl.onground) !== 0)
	{
		SV.UserFriction(wishvel);
		SV.Accelerate(wishvel);
	}
	else
		SV.Accelerate(wishvel, true);
};

SV.ClientThink = function()
{
	var ent = SV.player;

	if (ent.v_float[PR.entvars.movetype] === SV.movetype.none)
		return;

	var punchangle = ED.Vector(ent, PR.entvars.punchangle);
	var len = Vec.Normalize(punchangle) - 10.0 * Host.frametime;
	if (len < 0.0)
		len = 0.0;
	ent.v_float[PR.entvars.punchangle] = punchangle[0] * len;
	ent.v_float[PR.entvars.punchangle1] = punchangle[1] * len;
	ent.v_float[PR.entvars.punchangle2] = punchangle[2] * len;

	if (ent.v_float[PR.entvars.health] <= 0.0)
		return;

	ent.v_float[PR.entvars.angles2] = V.CalcRoll(ED.Vector(ent, PR.entvars.angles), ED.Vector(ent, PR.entvars.velocity)) * 4.0;
	if (SV.player.v_float[PR.entvars.fixangle] === 0.0)
	{
		ent.v_float[PR.entvars.angles] = (ent.v_float[PR.entvars.v_angle] + ent.v_float[PR.entvars.punchangle]) / -3.0;
		ent.v_float[PR.entvars.angles1] = ent.v_float[PR.entvars.v_angle1] + ent.v_float[PR.entvars.punchangle1];
	}

	if ((ent.v_float[PR.entvars.flags] & SV.fl.waterjump) !== 0)
		SV.WaterJump();
	else if ((ent.v_float[PR.entvars.waterlevel] >= 2.0) && (ent.v_float[PR.entvars.movetype] !== SV.movetype.noclip))
		SV.WaterMove();
	else
		SV.AirMove();
};

SV.ReadClientMove = function()
{
	var client = Host.client;
	client.ping_times[client.num_pings++ & 15] = SV.server.time - MSG.ReadFloat();
	client.edict.v_float[PR.entvars.v_angle] = MSG.ReadAngle();
	client.edict.v_float[PR.entvars.v_angle1] = MSG.ReadAngle();
	client.edict.v_float[PR.entvars.v_angle2] = MSG.ReadAngle();
	client.cmd.forwardmove = MSG.ReadShort();
	client.cmd.sidemove = MSG.ReadShort();
	client.cmd.upmove = MSG.ReadShort();
	var i = MSG.ReadByte();
	client.edict.v_float[PR.entvars.button0] = i & 1;
	client.edict.v_float[PR.entvars.button2] = (i & 2) >> 1;
	i = MSG.ReadByte();
	if (i !== 0)
		client.edict.v_float[PR.entvars.impulse] = i;
};

SV.ReadClientMessage = function()
{
	var ret, cmd, s, i;
	var cmds = [
		'status',
		'god', 
		'notarget',
		'fly',
		'name',
		'noclip',
		'say',
		'say_team',
		'tell',
		'color',
		'kill',
		'pause',
		'spawn',
		'begin',
		'prespawn',
		'kick',
		'ping',
		'give',
		'ban'
	];
	do
	{
		ret = NET.GetMessage(Host.client.netconnection);
		if (ret === -1)
		{
			Sys.Print('SV.ReadClientMessage: NET.GetMessage failed\n');
			return;
		}
		if (ret === 0)
			return true;
		MSG.BeginReading();
		for (;;)
		{
			if (Host.client.active !== true)
				return;
			if (MSG.badread === true)
			{
				Sys.Print('SV.ReadClientMessage: badread\n');
				return;
			}
			cmd = MSG.ReadChar();
			if (cmd === -1)
			{
				ret = 1;
				break;
			}
			if (cmd === Protocol.clc.nop)
				continue;
			if (cmd === Protocol.clc.stringcmd)
			{
				s = MSG.ReadString();
				for (i = 0; i < cmds.length; ++i)
				{
					if (s.substring(0, cmds[i].length).toLowerCase() !== cmds[i])
						continue;
					Cmd.ExecuteString(s, true);
					break;
				}
				if (i === cmds.length)
					Con.DPrint(SV.GetClientName(Host.client) + ' tried to ' + s);
			}
			else if (cmd === Protocol.clc.disconnect)
				return;
			else if (cmd === Protocol.clc.move)
				SV.ReadClientMove();
			else
			{
				Sys.Print('SV.ReadClientMessage: unknown command char\n');
				return;
			}
		}
	} while (ret === 1);
};

SV.RunClients = function()
{
	var i;
	for (i = 0; i < SV.svs.maxclients; ++i)
	{
		Host.client = SV.svs.clients[i];
		if (Host.client.active !== true)
			continue;
		SV.player = Host.client.edict;
		if (SV.ReadClientMessage() !== true)
		{
			Host.DropClient();
			continue;
		}
		if (Host.client.spawned !== true)
		{
			Host.client.cmd.forwardmove = 0.0;
			Host.client.cmd.sidemove = 0.0;
			Host.client.cmd.upmove = 0.0;
			continue;
		}
		SV.ClientThink();
	}
};

// world

SV.move = {
	normal: 0,
	nomonsters: 1,
	missile: 2
};

SV.InitBoxHull = function()
{
	SV.box_clipnodes = [];
	SV.box_planes = [];
	SV.box_hull = {
		clipnodes: SV.box_clipnodes,
		planes: SV.box_planes,
		firstclipnode: 0,
		lastclipnode: 5
	};
	var i, node, plane;
	for (i = 0; i <= 5; ++i)
	{
		node = {};
		SV.box_clipnodes[i] = node;
		node.planenum = i;
		node.children = [];
		node.children[i & 1] = Mod.contents.empty;
		if (i !== 5)
			node.children[1 - (i & 1)] = i + 1;
		else
			node.children[1 - (i & 1)] = Mod.contents.solid;
		plane = {};
		SV.box_planes[i] = plane;
		plane.type = i >> 1;
		plane.normal = [0.0, 0.0, 0.0];
		plane.normal[i >> 1] = 1.0;
		plane.dist = 0.0;
	}
};

SV.HullForEntity = function(ent, mins, maxs, offset)
{
	if (ent.v_float[PR.entvars.solid] !== SV.solid.bsp)
	{
		SV.box_planes[0].dist = ent.v_float[PR.entvars.maxs] - mins[0];
		SV.box_planes[1].dist = ent.v_float[PR.entvars.mins] - maxs[0];
		SV.box_planes[2].dist = ent.v_float[PR.entvars.maxs1] - mins[1];
		SV.box_planes[3].dist = ent.v_float[PR.entvars.mins1] - maxs[1];
		SV.box_planes[4].dist = ent.v_float[PR.entvars.maxs2] - mins[2];
		SV.box_planes[5].dist = ent.v_float[PR.entvars.mins2] - maxs[2];
		offset[0] = ent.v_float[PR.entvars.origin];
		offset[1] = ent.v_float[PR.entvars.origin1];
		offset[2] = ent.v_float[PR.entvars.origin2];
		return SV.box_hull;
	}
	if (ent.v_float[PR.entvars.movetype] !== SV.movetype.push)
		Sys.Error('SOLID_BSP without MOVETYPE_PUSH');
	var model = SV.server.models[ent.v_float[PR.entvars.modelindex] >> 0];
	if (model == null)
		Sys.Error('MOVETYPE_PUSH with a non bsp model');
	if (model.type !== Mod.type.brush)
		Sys.Error('MOVETYPE_PUSH with a non bsp model');
	var size = maxs[0] - mins[0];
	var hull;
	if (size < 3.0)
		hull = model.hulls[0];
	else if (size <= 32.0)
		hull = model.hulls[1];
	else
		hull = model.hulls[2];
	offset[0] = hull.clip_mins[0] - mins[0] + ent.v_float[PR.entvars.origin];
	offset[1] = hull.clip_mins[1] - mins[1] + ent.v_float[PR.entvars.origin1];
	offset[2] = hull.clip_mins[2] - mins[2] + ent.v_float[PR.entvars.origin2];
	return hull;
};

SV.CreateAreaNode = function(depth, mins, maxs)
{
	var anode = {};
	SV.areanodes[SV.areanodes.length++] = anode;

	anode.trigger_edicts = {};
	anode.trigger_edicts.prev = anode.trigger_edicts.next = anode.trigger_edicts;
	anode.solid_edicts = {};
	anode.solid_edicts.prev = anode.solid_edicts.next = anode.solid_edicts;

	if (depth === 4)
	{
		anode.axis = -1;
		anode.children = [];
		return anode;
	}

	anode.axis = (maxs[0] - mins[0]) > (maxs[1] - mins[1]) ? 0 : 1;
	anode.dist = 0.5 * (maxs[anode.axis] + mins[anode.axis]);

	var maxs1 = [maxs[0], maxs[1], maxs[2]];
	var mins2 = [mins[0], mins[1], mins[2]];
	maxs1[anode.axis] = mins2[anode.axis] = anode.dist;
	anode.children = [SV.CreateAreaNode(depth + 1, mins2, maxs), SV.CreateAreaNode(depth + 1, mins, maxs1)];
	return anode;
};

SV.UnlinkEdict = function(ent)
{
	if (ent.area.prev != null)
		ent.area.prev.next = ent.area.next;
	if (ent.area.next != null)
		ent.area.next.prev = ent.area.prev;
	ent.area.prev = ent.area.next = null;
};

SV.TouchLinks = function(ent, node)
{
	var l, next, touch, old_self, old_other;
	for (l = node.trigger_edicts.next; l !== node.trigger_edicts; l = next)
	{
		next = l.next;
		touch = l.ent;
		if (touch === ent)
			continue;
		if ((touch.v_int[PR.entvars.touch] === 0) || (touch.v_float[PR.entvars.solid] !== SV.solid.trigger))
			continue;
		if ((ent.v_float[PR.entvars.absmin] > touch.v_float[PR.entvars.absmax]) ||
			(ent.v_float[PR.entvars.absmin1] > touch.v_float[PR.entvars.absmax1]) || 
			(ent.v_float[PR.entvars.absmin2] > touch.v_float[PR.entvars.absmax2]) ||
			(ent.v_float[PR.entvars.absmax] < touch.v_float[PR.entvars.absmin]) ||
			(ent.v_float[PR.entvars.absmax1] < touch.v_float[PR.entvars.absmin1]) ||
			(ent.v_float[PR.entvars.absmax2] < touch.v_float[PR.entvars.absmin2]))
			continue;
		old_self = PR.globals_int[PR.globalvars.self];
		old_other = PR.globals_int[PR.globalvars.other];
		PR.globals_int[PR.globalvars.self] = touch.num;
		PR.globals_int[PR.globalvars.other] = ent.num;
		PR.globals_float[PR.globalvars.time] = SV.server.time;
		PR.ExecuteProgram(touch.v_int[PR.entvars.touch]);
		PR.globals_int[PR.globalvars.self] = old_self;
		PR.globals_int[PR.globalvars.other] = old_other;
	}
	if (node.axis === -1)
		return;
	if (ent.v_float[PR.entvars.absmax + node.axis] > node.dist)
		SV.TouchLinks(ent, node.children[0]);
	if (ent.v_float[PR.entvars.absmin + node.axis] < node.dist)
		SV.TouchLinks(ent, node.children[1]);
};

SV.FindTouchedLeafs = function(ent, node)
{
	if (node.contents === Mod.contents.solid)
		return;

	if (node.contents < 0)
	{
		if (ent.leafnums.length === 16)
			return;
		ent.leafnums[ent.leafnums.length] = node.num - 1;
		return;
	}

	var sides = Vec.BoxOnPlaneSide([ent.v_float[PR.entvars.absmin], ent.v_float[PR.entvars.absmin1], ent.v_float[PR.entvars.absmin2]],
		[ent.v_float[PR.entvars.absmax], ent.v_float[PR.entvars.absmax1], ent.v_float[PR.entvars.absmax2]], node.plane);
	if ((sides & 1) !== 0)
		SV.FindTouchedLeafs(ent, node.children[0]);
	if ((sides & 2) !== 0)
		SV.FindTouchedLeafs(ent, node.children[1]);
};

SV.LinkEdict = function(ent, touch_triggers)
{
	if ((ent === SV.server.edicts[0]) || (ent.free === true))
		return;

	SV.UnlinkEdict(ent);

	ent.v_float[PR.entvars.absmin] = ent.v_float[PR.entvars.origin] + ent.v_float[PR.entvars.mins] - 1.0;
	ent.v_float[PR.entvars.absmin1] = ent.v_float[PR.entvars.origin1] + ent.v_float[PR.entvars.mins1] - 1.0;
	ent.v_float[PR.entvars.absmin2] = ent.v_float[PR.entvars.origin2] + ent.v_float[PR.entvars.mins2];
	ent.v_float[PR.entvars.absmax] = ent.v_float[PR.entvars.origin] + ent.v_float[PR.entvars.maxs] + 1.0;
	ent.v_float[PR.entvars.absmax1] = ent.v_float[PR.entvars.origin1] + ent.v_float[PR.entvars.maxs1] + 1.0;
	ent.v_float[PR.entvars.absmax2] = ent.v_float[PR.entvars.origin2] + ent.v_float[PR.entvars.maxs2];

	if ((ent.v_float[PR.entvars.flags] & SV.fl.item) !== 0)
	{
		ent.v_float[PR.entvars.absmin] -= 14.0;
		ent.v_float[PR.entvars.absmin1] -= 14.0;
		ent.v_float[PR.entvars.absmax] += 14.0;
		ent.v_float[PR.entvars.absmax1] += 14.0;
	}
	else
	{
		ent.v_float[PR.entvars.absmin2] -= 1.0;
		ent.v_float[PR.entvars.absmax2] += 1.0;
	}

	ent.leafnums = [];
	if (ent.v_float[PR.entvars.modelindex] !== 0.0)
		SV.FindTouchedLeafs(ent, SV.server.worldmodel.nodes[0]);

	if (ent.v_float[PR.entvars.solid] === SV.solid.not)
		return;

	var node = SV.areanodes[0];
	for (;;)
	{
		if (node.axis === -1)
			break;
		if (ent.v_float[PR.entvars.absmin + node.axis] > node.dist)
			node = node.children[0];
		else if (ent.v_float[PR.entvars.absmax + node.axis] < node.dist)
			node = node.children[1];
		else
			break;
	}

	var before = (ent.v_float[PR.entvars.solid] === SV.solid.trigger) ? node.trigger_edicts : node.solid_edicts;
	ent.area.next = before;
	ent.area.prev = before.prev;
	ent.area.prev.next = ent.area;
	ent.area.next.prev = ent.area;
	ent.area.ent = ent;

	if (touch_triggers === true)
		SV.TouchLinks(ent, SV.areanodes[0]);
};

SV.HullPointContents = function(hull, num, p)
{
	var d, node, plane;
	for (; num >= 0; )
	{
		if ((num < hull.firstclipnode) || (num > hull.lastclipnode))
			Sys.Error('SV.HullPointContents: bad node number');
		node = hull.clipnodes[num];
		plane = hull.planes[node.planenum];
		if (plane.type <= 2)
			d = p[plane.type] - plane.dist;
		else
			d = plane.normal[0] * p[0] + plane.normal[1] * p[1] + plane.normal[2] * p[2] - plane.dist;
		if (d >= 0.0)
			num = node.children[0];
		else
			num = node.children[1];
	}
	return num;
};

SV.PointContents = function(p)
{
	var cont = SV.HullPointContents(SV.server.worldmodel.hulls[0], 0, p);
	if ((cont <= Mod.contents.current_0) && (cont >= Mod.contents.current_down))
		return Mod.contents.water;
	return cont;
};

SV.TestEntityPosition = function(ent)
{
	var origin = ED.Vector(ent, PR.entvars.origin);
	return SV.Move(origin, ED.Vector(ent, PR.entvars.mins), ED.Vector(ent, PR.entvars.maxs), origin, 0, ent).startsolid;
};

SV.RecursiveHullCheck = function(hull, num, p1f, p2f, p1, p2, trace)
{
	if (num < 0)
	{
		if (num !== Mod.contents.solid)
		{
			trace.allsolid = false;
			if (num === Mod.contents.empty)
				trace.inopen = true;
			else
				trace.inwater = true;
		}
		else
			trace.startsolid = true;
		return true;
	}

	if ((num < hull.firstclipnode) || (num > hull.lastclipnode))
		Sys.Error('SV.RecursiveHullCheck: bad node number');

	var node = hull.clipnodes[num];
	var plane = hull.planes[node.planenum];
	var t1, t2;

	if (plane.type <= 2)
	{
		t1 = p1[plane.type] - plane.dist;
		t2 = p2[plane.type] - plane.dist;
	}
	else
	{
		t1 = plane.normal[0] * p1[0] + plane.normal[1] * p1[1] + plane.normal[2] * p1[2] - plane.dist;
		t2 = plane.normal[0] * p2[0] + plane.normal[1] * p2[1] + plane.normal[2] * p2[2] - plane.dist;
	}

	if ((t1 >= 0.0) && (t2 >= 0.0))
		return SV.RecursiveHullCheck(hull, node.children[0], p1f, p2f, p1, p2, trace);
	if ((t1 < 0.0) && (t2 < 0.0))
		return SV.RecursiveHullCheck(hull, node.children[1], p1f, p2f, p1, p2, trace);

	var frac = (t1 + (t1 < 0.0 ? 0.03125 : -0.03125)) / (t1 - t2);
	if (frac < 0.0)
		frac = 0.0;
	else if (frac > 1.0)
		frac = 1.0;

	var midf = p1f + (p2f - p1f) * frac;
	var mid = [
		p1[0] + frac * (p2[0] - p1[0]),
		p1[1] + frac * (p2[1] - p1[1]),
		p1[2] + frac * (p2[2] - p1[2])
	];
	var side = t1 < 0.0 ? 1 : 0;

	if (SV.RecursiveHullCheck(hull, node.children[side], p1f, midf, p1, mid, trace) !== true)
		return;

	if (SV.HullPointContents(hull, node.children[1 - side], mid) !== Mod.contents.solid)
		return SV.RecursiveHullCheck(hull, node.children[1 - side], midf, p2f, mid, p2, trace);

	if (trace.allsolid === true)
		return;

	if (side === 0)
	{
		trace.plane.normal = [plane.normal[0], plane.normal[1], plane.normal[2]];
		trace.plane.dist = plane.dist;
	}
	else
	{
		trace.plane.normal = [-plane.normal[0], -plane.normal[1], -plane.normal[2]];
		trace.plane.dist = -plane.dist;
	}

	while (SV.HullPointContents(hull, hull.firstclipnode, mid) === Mod.contents.solid)
	{
		frac -= 0.1;
		if (frac < 0.0)
		{
			trace.fraction = midf;
			trace.endpos = [mid[0], mid[1], mid[2]];
			Con.DPrint('backup past 0\n');
			return;
		}
		midf = p1f + (p2f - p1f) * frac;
		mid[0] = p1[0] + frac * (p2[0] - p1[0]);
		mid[1] = p1[1] + frac * (p2[1] - p1[1]);
		mid[2] = p1[2] + frac * (p2[2] - p1[2]);
	}

	trace.fraction = midf;
	trace.endpos = [mid[0], mid[1], mid[2]];
};

SV.ClipMoveToEntity = function(ent, start, mins, maxs, end)
{
	var trace = {
		fraction: 1.0,
		allsolid: true,
		endpos: [end[0], end[1], end[2]],
		plane: {normal: [0.0, 0.0, 0.0], dist: 0.0}
	};
	var offset = [];
	var hull = SV.HullForEntity(ent, mins, maxs, offset);
	SV.RecursiveHullCheck(hull, hull.firstclipnode, 0.0, 1.0,
		[start[0] - offset[0], start[1] - offset[1], start[2] - offset[2]],
		[end[0] - offset[0], end[1] - offset[1], end[2] - offset[2]], trace);
	if (trace.fraction !== 1.0)
	{
		trace.endpos[0] += offset[0];
		trace.endpos[1] += offset[1];
		trace.endpos[2] += offset[2];
	}
	if ((trace.fraction < 1.0) || (trace.startsolid === true))
		trace.ent = ent;
	return trace;
};

SV.ClipToLinks = function(node, clip)
{
	var l, next, touch, solid, trace;
	for (l = node.solid_edicts.next; l !== node.solid_edicts; l = l.next)
	{
		touch = l.ent;
		solid = touch.v_float[PR.entvars.solid];
		if ((solid === SV.solid.not) || (touch === clip.passedict))
			continue;
		if (solid === SV.solid.trigger)
			Sys.Error('Trigger in clipping list');
		if ((clip.type === SV.move.nomonsters) && (solid !== SV.solid.bsp))
			continue;
		if ((clip.boxmins[0] > touch.v_float[PR.entvars.absmax]) ||
			(clip.boxmins[1] > touch.v_float[PR.entvars.absmax1]) ||
			(clip.boxmins[2] > touch.v_float[PR.entvars.absmax2]) ||
			(clip.boxmaxs[0] < touch.v_float[PR.entvars.absmin]) ||
			(clip.boxmaxs[1] < touch.v_float[PR.entvars.absmin1]) ||
			(clip.boxmaxs[2] < touch.v_float[PR.entvars.absmin2]))
			continue;
		if (clip.passedict != null)
		{
			if ((clip.passedict.v_float[PR.entvars.size] !== 0.0) && (touch.v_float[PR.entvars.size] === 0.0))
				continue;
		}
		if (clip.trace.allsolid === true)
			return;
		if (clip.passedict != null)
		{
			if (SV.server.edicts[touch.v_int[PR.entvars.owner]] === clip.passedict)
				continue;
			if (SV.server.edicts[clip.passedict.v_int[PR.entvars.owner]] === touch)
				continue;
		}
		if ((touch.v_float[PR.entvars.flags] & SV.fl.monster) !== 0)
			trace = SV.ClipMoveToEntity(touch, clip.start, clip.mins2, clip.maxs2, clip.end);
		else
			trace = SV.ClipMoveToEntity(touch, clip.start, clip.mins, clip.maxs, clip.end);
		if ((trace.allsolid === true) || (trace.startsolid === true) || (trace.fraction < clip.trace.fraction))
		{
			trace.ent = touch;
			clip.trace = trace;
			if (trace.startsolid === true)
				clip.trace.startsolid = true;
		}
	}
	if (node.axis === -1)
		return;
	if (clip.boxmaxs[node.axis] > node.dist)
		SV.ClipToLinks(node.children[0], clip);
	if (clip.boxmins[node.axis] < node.dist)
		SV.ClipToLinks(node.children[1], clip);
};

SV.Move = function(start, mins, maxs, end, type, passedict)
{
	var clip = {
		trace: SV.ClipMoveToEntity(SV.server.edicts[0], start, mins, maxs, end),
		start: start,
		end: end,
		mins: mins,
		maxs: maxs,
		type: type,
		passedict: passedict,
		boxmins: [],
		boxmaxs: []
	};
	if (type === SV.move.missile)
	{
		clip.mins2 = [-15.0, -15.0, -15.0];
		clip.maxs2 = [15.0, 15.0, 15.0];
	}
	else
	{
		clip.mins2 = [mins[0], mins[1], mins[2]];
		clip.maxs2 = [maxs[0], maxs[1], maxs[2]];
	}
	var i;
	for (i = 0; i <= 2; ++i)
	{
		if (end[i] > start[i])
		{
			clip.boxmins[i] = start[i] + clip.mins2[i] - 1.0;
			clip.boxmaxs[i] = end[i] + clip.maxs2[i] + 1.0;
			continue;
		}
		clip.boxmins[i] = end[i] + clip.mins2[i] - 1.0;
		clip.boxmaxs[i] = start[i] + clip.maxs2[i] + 1.0;
	}
	SV.ClipToLinks(SV.areanodes[0], clip);
	return clip.trace;
};

// ---- WebQuake/SZ.js ----
SZ = {};

SZ.GetSpace = function(buf, length)
{
	if ((buf.cursize + length) > buf.data.byteLength)
	{
		if (buf.allowoverflow !== true)
			Sys.Error('SZ.GetSpace: overflow without allowoverflow set');
		if (length > buf.byteLength)
			Sys.Error('SZ.GetSpace: ' + length + ' is > full buffer size');
		buf.overflowed = true;
		Con.Print('SZ.GetSpace: overflow\n');
		buf.cursize = 0;
	}
	var cursize = buf.cursize;
	buf.cursize += length;
	return cursize;
};

SZ.Write = function(sb, data, length)
{
	(new Uint8Array(sb.data, SZ.GetSpace(sb, length), length)).set(data.subarray(0, length));
};

SZ.Print = function(sb, data)
{
	var buf = new Uint8Array(sb.data);
	var dest;
	if (sb.cursize !== 0)
	{
		if (buf[sb.cursize - 1] === 0)
			dest = SZ.GetSpace(sb, data.length - 1) - 1;
		else
			dest = SZ.GetSpace(sb, data.length);
	}
	else
		dest = SZ.GetSpace(sb, data.length);
	var i;
	for (i = 0; i < data.length; ++i)
		buf[dest + i] = data.charCodeAt(i);
};

// ---- WebQuake/V.js ----
V = {};

V.dmg_time = 0.0;

V.CalcRoll = function(angles, velocity)
{
	var right = [];
	Vec.AngleVectors(angles, null, right);
	var side = velocity[0] * right[0] + velocity[1] * right[1] + velocity[2] * right[2];
	var sign = side < 0 ? -1 : 1;
	side = Math.abs(side);
	if (side < V.rollspeed.value)
		return side * sign * V.rollangle.value / V.rollspeed.value;
	return V.rollangle.value * sign;
};

V.CalcBob = function()
{
	if ((V.bobcycle.value <= 0.0)
		|| (V.bobcycle.value >= 1.0)
		|| (V.bobup.value <= 0.0)
		|| (V.bobup.value >= 1.0)
		|| (V.bob.value === 0.0))
		return 0.0;

	var cycle = (CL.state.time - Math.floor(CL.state.time / V.bobcycle.value) * V.bobcycle.value) / V.bobcycle.value;
	if (cycle < V.bobup.value)
		cycle = Math.PI * cycle / V.bobup.value;
	else
		cycle = Math.PI + Math.PI * (cycle - V.bobup.value) / (1.0 - V.bobup.value);
	var bob = Math.sqrt(CL.state.velocity[0] * CL.state.velocity[0] + CL.state.velocity[1] * CL.state.velocity[1]) * V.bob.value;
	bob = bob * 0.3 + bob * 0.7 * Math.sin(cycle);
	if (bob > 4.0)
		bob = 4.0;
	else if (bob < -7.0)
		bob = -7.0;
	return bob;
};

V.StartPitchDrift = function()
{
	if (CL.state.laststop === CL.state.time)
		return;
	if ((CL.state.nodrift === true) || (CL.state.pitchvel === 0.0))
	{
		CL.state.pitchvel = V.centerspeed.value;
		CL.state.nodrift = false;
		CL.state.driftmove = 0.0;
	}
};

V.StopPitchDrift = function()
{
	CL.state.laststop = CL.state.time;
	CL.state.nodrift = true;
	CL.state.pitchvel = 0.0;
};

V.DriftPitch = function()
{
	if ((Host.noclip_anglehack === true) || (CL.state.onground !== true) || (CL.cls.demoplayback === true))
	{
		CL.state.driftmove = 0.0;
		CL.state.pitchvel = 0.0;
		return;
	}

	if (CL.state.nodrift === true)
	{
		if (Math.abs(CL.state.cmd.forwardmove) < CL.forwardspeed.value)
			CL.state.driftmove = 0.0;
		else
			CL.state.driftmove += Host.frametime;
		if (CL.state.driftmove > V.centermove.value)
			V.StartPitchDrift();
		return;
	}

	var delta = CL.state.idealpitch - CL.state.viewangles[0];
	if (delta === 0.0)
	{
		CL.state.pitchvel = 0.0;
		return;
	}

	var move = Host.frametime * CL.state.pitchvel;
	CL.state.pitchvel += Host.frametime * V.centerspeed.value;

	if (delta > 0)
	{
		if (move > delta)
		{
			CL.state.pitchvel = 0.0;
			move = delta;
		}
		CL.state.viewangles[0] += move;
	}
	else if (delta < 0)
	{
		if (move > -delta)
		{
			CL.state.pitchvel = 0.0;
			move = -delta;
		}
		CL.state.viewangles[0] -= move;
	}
};

V.cshift_empty = [130.0, 80.0, 50.0, 0.0];
V.cshift_water = [130.0, 80.0, 50.0, 128.0];
V.cshift_slime = [0.0, 25.0, 5.0, 150.0];
V.cshift_lava = [255.0, 80.0, 0.0, 150.0];

V.blend = [0.0, 0.0, 0.0, 0.0];

V.ParseDamage = function()
{
	var armor = MSG.ReadByte();
	var blood = MSG.ReadByte();
	var ent = CL.entities[CL.state.viewentity];
	var from = [MSG.ReadCoord() - ent.origin[0], MSG.ReadCoord() - ent.origin[1], MSG.ReadCoord() - ent.origin[2]];
	Vec.Normalize(from);
	var count = (blood + armor) * 0.5;
	if (count < 10.0)
		count = 10.0;
	CL.state.faceanimtime = CL.state.time + 0.2;

	var cshift = CL.state.cshifts[CL.cshift.damage];
	cshift[3] += 3.0 * count;
	if (cshift[3] < 0.0)
		cshift[3] = 0.0;
	else if (cshift[3] > 150.0)
		cshift[3] = 150.0;

	if (armor > blood)
	{
		cshift[0] = 200.0;
		cshift[1] = cshift[2] = 100.0;
	}
	else if (armor !== 0)
	{
		cshift[0] = 220.0;
		cshift[1] = cshift[2] = 50.0;
	}
	else
	{
		cshift[0] = 255.0;
		cshift[1] = cshift[2] = 0.0;
	}

	var forward = [], right = [];
	Vec.AngleVectors(ent.angles, forward, right);
	V.dmg_roll = count * (from[0] * right[0] + from[1] * right[1] + from[2] * right[2]) * V.kickroll.value;
	V.dmg_pitch = count * (from[0] * forward[0] + from[1] * forward[1] + from[2] * forward[2]) * V.kickpitch.value;
	V.dmg_time = V.kicktime.value;
};

V.cshift_f = function()
{
	var cshift = V.cshift_empty;
	cshift[0] = Q.atoi(Cmd.argv[1]);
	cshift[1] = Q.atoi(Cmd.argv[2]);
	cshift[2] = Q.atoi(Cmd.argv[3]);
	cshift[3] = Q.atoi(Cmd.argv[4]);
};

V.BonusFlash_f = function()
{
	var cshift = CL.state.cshifts[CL.cshift.bonus];
	cshift[0] = 215.0;
	cshift[1] = 186.0;
	cshift[2] = 69.0;
	cshift[3] = 50.0;
};

V.SetContentsColor = function(contents)
{
	switch (contents)
	{
	case Mod.contents.empty:
	case Mod.contents.solid:
		CL.state.cshifts[CL.cshift.contents] = V.cshift_empty;
		return;
	case Mod.contents.lava:
		CL.state.cshifts[CL.cshift.contents] = V.cshift_lava;
		return;
	case Mod.contents.slime:
		CL.state.cshifts[CL.cshift.contents] = V.cshift_slime;
		return;
	}
	CL.state.cshifts[CL.cshift.contents] = V.cshift_water;
};

V.CalcBlend = function()
{
	var cshift = CL.state.cshifts[CL.cshift.powerup];
	if ((CL.state.items & Def.it.quad) !== 0)
	{
		cshift[0] = 0.0;
		cshift[1] = 0.0;
		cshift[2] = 255.0;
		cshift[3] = 30.0;
	}
	else if ((CL.state.items & Def.it.suit) !== 0)
	{
		cshift[0] = 0.0;
		cshift[1] = 255.0;
		cshift[2] = 0.0;
		cshift[3] = 20.0;
	}
	else if ((CL.state.items & Def.it.invisibility) !== 0)
	{
		cshift[0] = 100.0;
		cshift[1] = 100.0;
		cshift[2] = 100.0;
		cshift[3] = 100.0;
	}
	else if ((CL.state.items & Def.it.invulnerability) !== 0)
	{
		cshift[0] = 255.0;
		cshift[1] = 255.0;
		cshift[2] = 0.0;
		cshift[3] = 30.0;
	}
	else
		cshift[3] = 0.0;

	CL.state.cshifts[CL.cshift.damage][3] -= Host.frametime * 150.0;
	if (CL.state.cshifts[CL.cshift.damage][3] < 0.0)
		CL.state.cshifts[CL.cshift.damage][3] = 0.0;
	CL.state.cshifts[CL.cshift.bonus][3] -= Host.frametime * 100.0;
	if (CL.state.cshifts[CL.cshift.bonus][3] < 0.0)
		CL.state.cshifts[CL.cshift.bonus][3] = 0.0;

	if (V.cshiftpercent.value === 0)
	{
		V.blend[0] = V.blend[1] = V.blend[2] = V.blend[3] = 0.0;
		return;
	}

	var r = 0.0, g = 0.0, b = 0.0, a = 0.0, a2, i, cshift;
	for (i = 0; i <= 3; ++i)
	{
		cshift = CL.state.cshifts[i];
		a2 = cshift[3] * V.cshiftpercent.value / 25500.0;
		if (a2 === 0.0)
			continue;
		a = a + a2 * (1.0 - a);
		a2 = a2 / a;
		r = r * (1.0 - a2) + cshift[0] * a2;
		g = g * (1.0 - a2) + cshift[1] * a2;
		b = b * (1.0 - a2) + cshift[2] * a2;
	}
	if (a > 1.0)
		a = 1.0;
	else if (a < 0.0)
		a = 0.0;
	V.blend[0] = r;
	V.blend[1] = g;
	V.blend[2] = b;
	V.blend[3] = a;
	if (V.blend[3] > 1.0)
		V.blend[3] = 1.0;
	else if (V.blend[3] < 0.0)
		V.blend[3] = 0.0;
};

V.CalcIntermissionRefdef = function()
{
	var ent = CL.entities[CL.state.viewentity];
	R.refdef.vieworg[0] = ent.origin[0];
	R.refdef.vieworg[1] = ent.origin[1];
	R.refdef.vieworg[2] = ent.origin[2];
	R.refdef.viewangles[0] = ent.angles[0] + Math.sin(CL.state.time * V.ipitch_cycle.value) * V.ipitch_level.value;
	R.refdef.viewangles[1] = ent.angles[1] + Math.sin(CL.state.time * V.iyaw_cycle.value) * V.iyaw_level.value;
	R.refdef.viewangles[2] = ent.angles[2] + Math.sin(CL.state.time * V.iroll_cycle.value) * V.iroll_level.value;
	CL.state.viewent.model = null;
};

V.oldz = 0.0;
V.CalcRefdef = function()
{
	V.DriftPitch();

	var ent = CL.entities[CL.state.viewentity];
	ent.angles[1] = CL.state.viewangles[1];
	ent.angles[0] = -CL.state.viewangles[0];
	var bob = V.CalcBob();

	R.refdef.vieworg[0] = ent.origin[0] + 0.03125;
	R.refdef.vieworg[1] = ent.origin[1] + 0.03125;
	R.refdef.vieworg[2] = ent.origin[2] + CL.state.viewheight + bob + 0.03125;

	R.refdef.viewangles[0] = CL.state.viewangles[0];
	R.refdef.viewangles[1] = CL.state.viewangles[1];
	R.refdef.viewangles[2] = CL.state.viewangles[2] + V.CalcRoll(CL.entities[CL.state.viewentity].angles, CL.state.velocity);

	if (V.dmg_time > 0.0)
	{
		if (V.kicktime.value !== 0.0)
		{
			R.refdef.viewangles[2] += (V.dmg_time / V.kicktime.value) * V.dmg_roll;
			R.refdef.viewangles[0] -= (V.dmg_time / V.kicktime.value) * V.dmg_pitch;
		}
		V.dmg_time -= Host.frametime;
	}
	if (CL.state.stats[Def.stat.health] <= 0)
		R.refdef.viewangles[2] = 80.0;

	var ipitch = V.idlescale.value * Math.sin(CL.state.time * V.ipitch_cycle.value) * V.ipitch_level.value;
	var iyaw = V.idlescale.value * Math.sin(CL.state.time * V.iyaw_cycle.value) * V.iyaw_level.value;
	var iroll = V.idlescale.value * Math.sin(CL.state.time * V.iroll_cycle.value) * V.iroll_level.value;
	R.refdef.viewangles[0] += ipitch;
	R.refdef.viewangles[1] += iyaw;
	R.refdef.viewangles[2] += iroll;

	var forward = [], right = [], up = [];
	Vec.AngleVectors([-ent.angles[0], ent.angles[1], ent.angles[2]], forward, right, up);
	R.refdef.vieworg[0] += V.ofsx.value * forward[0] + V.ofsy.value * right[0] + V.ofsz.value * up[0];
	R.refdef.vieworg[1] += V.ofsx.value * forward[1] + V.ofsy.value * right[1] + V.ofsz.value * up[1];
	R.refdef.vieworg[2] += V.ofsx.value * forward[2] + V.ofsy.value * right[2] + V.ofsz.value * up[2];

	if (R.refdef.vieworg[0] < (ent.origin[0] - 14.0))
		R.refdef.vieworg[0] = ent.origin[0] - 14.0;
	else if (R.refdef.vieworg[0] > (ent.origin[0] + 14.0))
		R.refdef.vieworg[0] = ent.origin[0] + 14.0;
	if (R.refdef.vieworg[1] < (ent.origin[1] - 14.0))
		R.refdef.vieworg[1] = ent.origin[1] - 14.0;
	else if (R.refdef.vieworg[1] > (ent.origin[1] + 14.0))
		R.refdef.vieworg[1] = ent.origin[1] + 14.0;
	if (R.refdef.vieworg[2] < (ent.origin[2] - 22.0))
		R.refdef.vieworg[2] = ent.origin[2] - 22.0;
	else if (R.refdef.vieworg[2] > (ent.origin[2] + 30.0))
		R.refdef.vieworg[2] = ent.origin[2] + 30.0;

	var view = CL.state.viewent;
	view.angles[0] = -R.refdef.viewangles[0] - ipitch;
	view.angles[1] = R.refdef.viewangles[1] - iyaw;
	view.angles[2] = CL.state.viewangles[2] - iroll;
	view.origin[0] = ent.origin[0] + forward[0] * bob * 0.4;
	view.origin[1] = ent.origin[1] + forward[1] * bob * 0.4;
	view.origin[2] = ent.origin[2] + CL.state.viewheight + forward[2] * bob * 0.4 + bob;
	switch (SCR.viewsize.value)
	{
	case 110:
	case 90:
		view.origin[2] += 1.0;
		break;
	case 100:
		view.origin[2] += 2.0;
		break;
	case 80:
		view.origin[2] += 0.5;
	}
	view.model = CL.state.model_precache[CL.state.stats[Def.stat.weapon]];
	view.frame = CL.state.stats[Def.stat.weaponframe];

	R.refdef.viewangles[0] += CL.state.punchangle[0];
	R.refdef.viewangles[1] += CL.state.punchangle[1];
	R.refdef.viewangles[2] += CL.state.punchangle[2];

	if ((CL.state.onground === true) && ((ent.origin[2] - V.oldz) > 0.0))
	{
		var steptime = CL.state.time - CL.state.oldtime;
		if (steptime < 0.0)
			steptime = 0.0;
		V.oldz += steptime * 80.0;
		if (V.oldz > ent.origin[2])
			V.oldz = ent.origin[2];
		else if ((ent.origin[2] - V.oldz) > 12.0)
			V.oldz = ent.origin[2] - 12.0;
		R.refdef.vieworg[2] += V.oldz - ent.origin[2];
		view.origin[2] += V.oldz - ent.origin[2];
	}
	else
		V.oldz = ent.origin[2];
	if (Chase.active.value !== 0)
		Chase.Update();
};

V.RenderView = function()
{
	if (Con.forcedup === true)
		return;
	if (CL.state.maxclients >= 2)
	{
		Cvar.Set('scr_ofsx', '0');
		Cvar.Set('scr_ofsy', '0');
		Cvar.Set('scr_ofsz', '0');
	}
	if (CL.state.intermission !== 0)
		V.CalcIntermissionRefdef();
	else if (CL.state.paused !== true)
		V.CalcRefdef();
	R.PushDlights();
	R.RenderView();
};

V.Init = function()
{
	Cmd.AddCommand('v_cshift', V.cshift_f);
	Cmd.AddCommand('bf', V.BonusFlash_f);
	Cmd.AddCommand('centerview', V.StartPitchDrift);
	V.centermove = Cvar.RegisterVariable('v_centermove', '0.15');
	V.centerspeed = Cvar.RegisterVariable('v_centerspeed', '500');
	V.iyaw_cycle = Cvar.RegisterVariable('v_iyaw_cycle', '2');
	V.iroll_cycle = Cvar.RegisterVariable('v_iroll_cycle', '0.5');
	V.ipitch_cycle = Cvar.RegisterVariable('v_ipitch_cycle', '1');
	V.iyaw_level = Cvar.RegisterVariable('v_iyaw_level', '0.3');
	V.iroll_level = Cvar.RegisterVariable('v_iroll_level', '0.1');
	V.ipitch_level = Cvar.RegisterVariable('v_ipitch_level', '0.3');
	V.idlescale = Cvar.RegisterVariable('v_idlescale', '0');
	V.crosshair = Cvar.RegisterVariable('crosshair', '0', true);
	V.crossx = Cvar.RegisterVariable('cl_crossx', '0');
	V.crossy = Cvar.RegisterVariable('cl_crossy', '0');
	V.cshiftpercent = Cvar.RegisterVariable('gl_cshiftpercent', '100');
	V.ofsx = Cvar.RegisterVariable('scr_ofsx', '0');
	V.ofsy = Cvar.RegisterVariable('scr_ofsy', '0');
	V.ofsz = Cvar.RegisterVariable('scr_ofsz', '0');
	V.rollspeed = Cvar.RegisterVariable('cl_rollspeed', '200');
	V.rollangle = Cvar.RegisterVariable('cl_rollangle', '2.0');
	V.bob = Cvar.RegisterVariable('cl_bob', '0.02');
	V.bobcycle = Cvar.RegisterVariable('cl_bobcycle', '0.6');
	V.bobup = Cvar.RegisterVariable('cl_bobup', '0.5');
	V.kicktime = Cvar.RegisterVariable('v_kicktime', '0.5');
	V.kickroll = Cvar.RegisterVariable('v_kickroll', '0.6');
	V.kickpitch = Cvar.RegisterVariable('v_kickpitch', '0.6');
	V.gamma = Cvar.RegisterVariable('gamma', '1', true);
};

// ---- WebQuake/Vec.js ----
Vec = {};

Vec.origin = [0.0, 0.0, 0.0];

Vec.Perpendicular = function(v)
{
	var pos = 0;
	var minelem = 1;
	if (Math.abs(v[0]) < minelem)
	{
		pos = 0;
		minelem = Math.abs(v[0]);
	}
	if (Math.abs(v[1]) < minelem)
	{
		pos = 1;
		minelem = Math.abs(v[1]);
	}
	if (Math.abs(v[2]) < minelem)
	{
		pos = 2;
		minelem = Math.abs(v[2]);
	}
	var tempvec = [0.0, 0.0, 0.0];
	tempvec[pos] = 1.0;
	var inv_denom = 1.0 / (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
	var d = (tempvec[0] * v[0] + tempvec[1] * v[1] + tempvec[2] * v[2]) * inv_denom;
	var dst = [
		tempvec[0] - d * v[0] * inv_denom,
		tempvec[1] - d * v[1] * inv_denom,
		tempvec[2] - d * v[2] * inv_denom
	];
	Vec.Normalize(dst);
	return dst;
};

Vec.RotatePointAroundVector = function(dir, point, degrees)
{
	var r = Vec.Perpendicular(dir);
	var up = Vec.CrossProduct(r, dir);
	var m = [
		[r[0], up[0], dir[0]],
		[r[1], up[1], dir[1]],
		[r[2], up[2], dir[2]]
	];
	var im = [
		[m[0][0], m[1][0], m[2][0]],
		[m[0][1], m[1][1], m[2][1]],
		[m[0][2], m[1][2], m[2][2]]
	];
	var s = Math.sin(degrees * Math.PI / 180.0);
	var c = Math.cos(degrees * Math.PI / 180.0);
	var zrot = [[c, s, 0], [-s, c, 0], [0, 0, 1]];
	var rot = Vec.ConcatRotations(Vec.ConcatRotations(m, zrot), im);
	return [
		rot[0][0] * point[0] + rot[0][1] * point[1] + rot[0][2] * point[2],
		rot[1][0] * point[0] + rot[1][1] * point[1] + rot[1][2] * point[2],
		rot[2][0] * point[0] + rot[2][1] * point[1] + rot[2][2] * point[2]
	];
};

Vec.Anglemod = function(a)
{
	return (a % 360.0 + 360.0) % 360.0;
};

Vec.BoxOnPlaneSide = function(emins, emaxs, p)
{
	if (p.type <= 2)
	{
		if (p.dist <= emins[p.type])
			return 1;
		if (p.dist >= emaxs[p.type])
			return 2;
		return 3;
	}
	var dist1, dist2;
	switch (p.signbits)
	{
	case 0:
		dist1 = p.normal[0] * emaxs[0] + p.normal[1] * emaxs[1] + p.normal[2] * emaxs[2];
		dist2 = p.normal[0] * emins[0] + p.normal[1] * emins[1] + p.normal[2] * emins[2];
		break;
	case 1:
		dist1 = p.normal[0] * emins[0] + p.normal[1] * emaxs[1] + p.normal[2] * emaxs[2];
		dist2 = p.normal[0] * emaxs[0] + p.normal[1] * emins[1] + p.normal[2] * emins[2];
		break;
	case 2:
		dist1 = p.normal[0] * emaxs[0] + p.normal[1] * emins[1] + p.normal[2] * emaxs[2];
		dist2 = p.normal[0] * emins[0] + p.normal[1] * emaxs[1] + p.normal[2] * emins[2];
		break;
	case 3:
		dist1 = p.normal[0] * emins[0] + p.normal[1] * emins[1] + p.normal[2] * emaxs[2];
		dist2 = p.normal[0] * emaxs[0] + p.normal[1] * emaxs[1] + p.normal[2] * emins[2];
		break;
	case 4:
		dist1 = p.normal[0] * emaxs[0] + p.normal[1] * emaxs[1] + p.normal[2] * emins[2];
		dist2 = p.normal[0] * emins[0] + p.normal[1] * emins[1] + p.normal[2] * emaxs[2];
		break;
	case 5:
		dist1 = p.normal[0] * emins[0] + p.normal[1] * emaxs[1] + p.normal[2] * emins[2];
		dist2 = p.normal[0] * emaxs[0] + p.normal[1] * emins[1] + p.normal[2] * emaxs[2];
		break;
	case 6:
		dist1 = p.normal[0] * emaxs[0] + p.normal[1] * emins[1] + p.normal[2] * emins[2];
		dist2 = p.normal[0] * emins[0] + p.normal[1] * emaxs[1] + p.normal[2] * emaxs[2];
		break;
	case 7:
		dist1 = p.normal[0] * emins[0] + p.normal[1] * emins[1] + p.normal[2] * emins[2];
		dist2 = p.normal[0] * emaxs[0] + p.normal[1] * emaxs[1] + p.normal[2] * emaxs[2];
		break;
	default:
		Sys.Error('Vec.BoxOnPlaneSide: Bad signbits');
	}
	var sides = 0;
	if (dist1 >= p.dist)
		sides = 1;
	if (dist2 < p.dist)
		sides += 2;
	return sides;
};

Vec.AngleVectors = function(angles, forward, right, up)
{
	var angle;
	
	angle = angles[0] * Math.PI / 180.0;
	var sp = Math.sin(angle);
	var cp = Math.cos(angle);
	angle = angles[1] * Math.PI / 180.0;
	var sy = Math.sin(angle);
	var cy = Math.cos(angle);
	angle = angles[2] * Math.PI / 180.0;
	var sr = Math.sin(angle);
	var cr = Math.cos(angle);

	if (forward != null)
	{
		forward[0] = cp * cy;
		forward[1] = cp * sy;
		forward[2] = -sp;
	}
	if (right != null)
	{
		right[0] = cr * sy - sr * sp * cy;
		right[1] = -sr * sp * sy - cr * cy;
		right[2] = -sr * cp;
	}
	if (up != null)
	{
		up[0] = cr * sp * cy + sr * sy;
		up[1] = cr * sp * sy - sr * cy;
		up[2] = cr * cp;
	}
};

Vec.DotProduct = function(v1, v2)
{
	return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
};

Vec.Copy = function(v1, v2)
{
	v2[0] = v1[0];
	v2[1] = v1[1];
	v2[2] = v1[2];
};

Vec.CrossProduct = function(v1, v2)
{
	return [
		v1[1] * v2[2] - v1[2] * v2[1],
		v1[2] * v2[0] - v1[0] * v2[2],
		v1[0] * v2[1] - v1[1] * v2[0]
	];
};

Vec.Length = function(v)
{
	return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
};

Vec.Normalize = function(v)
{
	var length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
	if (length === 0.0)
	{
		v[0] = v[1] = v[2] = 0.0;
		return 0.0;
	}
	v[0] /= length;
	v[1] /= length;
	v[2] /= length;
	return length;
};

Vec.ConcatRotations = function(m1, m2)
{
	return [
		[
			m1[0][0] * m2[0][0] + m1[0][1] * m2[1][0] + m1[0][2] * m2[2][0],
			m1[0][0] * m2[0][1] + m1[0][1] * m2[1][1] + m1[0][2] * m2[2][1],
			m1[0][0] * m2[0][2] + m1[0][1] * m2[1][2] + m1[0][2] * m2[2][2]
		],
		[
			m1[1][0] * m2[0][0] + m1[1][1] * m2[1][0] + m1[1][2] * m2[2][0],
			m1[1][0] * m2[0][1] + m1[1][1] * m2[1][1] + m1[1][2] * m2[2][1],
			m1[1][0] * m2[0][2] + m1[1][1] * m2[1][2] + m1[1][2] * m2[2][2]
		],
		[
			m1[2][0] * m2[0][0] + m1[2][1] * m2[1][0] + m1[2][2] * m2[2][0],
			m1[2][0] * m2[0][1] + m1[2][1] * m2[1][1] + m1[2][2] * m2[2][1],
			m1[2][0] * m2[0][2] + m1[2][1] * m2[1][2] + m1[2][2] * m2[2][2]
		]
	];
};

// ---- WebQuake/VID.js ----
VID = {};

VID.d_8to24table = new Uint32Array(new ArrayBuffer(1024));

VID.SetPalette = function()
{
	var palette = COM.LoadFile('gfx/palette.lmp');
	if (palette == null)
		Sys.Error('Couldn\'t load gfx/palette.lmp');
	var pal = new Uint8Array(palette);
	var i, src = 0;
	for (i = 0; i < 256; ++i)
	{
		VID.d_8to24table[i] = pal[src] + (pal[src + 1] << 8) + (pal[src + 2] << 16);
		src += 3;
	}
};

VID.Init = function()
{
	document.getElementById('progress').style.display = 'none';
	GL.Init();
	VID.SetPalette();
};

// ---- WebQuake/W.js ----
W = {};

W.lumps = [];

W.LoadWadFile = function(filename)
{
	var base = COM.LoadFile(filename);
	if (base == null)
		Sys.Error('W.LoadWadFile: couldn\'t load ' + filename);
	var view = new DataView(base);
	if (view.getUint32(0, true) !== 0x32444157)
		Sys.Error('Wad file ' + filename + ' doesn\'t have WAD2 id');
	var numlumps = view.getUint32(4, true);
	var infotableofs = view.getUint32(8, true);
	var i, size, lump;
	for (i = 0; i < numlumps; ++i)
	{
		size = view.getUint32(infotableofs + 4, true);
		lump = new ArrayBuffer(size);
		(new Uint8Array(lump)).set(new Uint8Array(base, view.getUint32(infotableofs, true), size));
		W.lumps[Q.memstr(new Uint8Array(base, infotableofs + 16, 16)).toUpperCase()] = lump;
		infotableofs += 32;
	}
};

W.GetLumpName = function(name)
{
	var lump = W.lumps[name];
	if (lump == null)
		Sys.Error('W.GetLumpName: ' + name + ' not found');
	return lump;
};

// ---- ghosty.js ----
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
};
