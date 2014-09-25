var iceServers = [];

function initRTC(servers) {
	if ( servers instanceof Array )
		iceServers = servers;
	socket.on('rtc',
		function(msg) {
			if ( typeof(msg) != 'object' || ! msg.type )
				return;
			switch ( msg.type ) {
				case 'offer':
					if ( ! rtConnections[msg.src] )
						break;
					rtConnections[msg.src].setRemote(msg);
					rtConnections[msg.src].answer();
					break;
				case 'answer':
					if ( ! rtConnections[msg.src] )
						break;
					rtConnections[msg.src].setRemote(msg);
					break;
				case 'candidate':
					if ( ! rtConnections[msg.src] )
						break;
					rtConnections[msg.src].candidate(msg);
					break;
				default:
					console.log('Unrecognised rtc message!', msg);	
			}
		}
	);
}

var clientConnection = new Class({
	construct:
		function(src, dst, streamCB, stateCB) {
			var _this = this;
			function state(e) {
				if ( typeof(_this.attr.stateCB) == 'function' )
					_this.attr.stateCB(_this.attr.dst, _this.attr.pc.iceConnectionState);
			}
			function ice(e) {
				if ( e && e.candidate ) {
					var candidate = e.candidate;
					socket.emit(
						'rtc', 
						{
							type:		'candidate',
							label:		candidate.sdpMLineIndex,
							candidate:	candidate.candidate,
							src:		_this.attr.src
						},
						_this.attr.dst
					);
				}
			}
			function add(e) {
				if ( e.stream.getAudioTracks().length || e.stream.getVideoTracks().length )
					_this.attr.remoteStreams[e.stream.id] = e.stream;
				if ( typeof(_this.attr.streamCB) == 'function' )
					_this.attr.streamCB(_this.attr.dst, _this.attr.remoteStreams);
			}
			this.attr = {
				dst:		dst,
				src:		src,
				pc:		null,
				localStreams:	{},
				remoteStreams:	{},
				streamCB:	streamCB,
				stateCB:	stateCB
			};
			var pc = null;
			try {
				pc = new RTCPeerConnection(
					{iceServers: iceServers},
					{optional: [{DtlsSrtpKeyAgreement: true}]}
				);
				pc.oniceconnectionstatechange = state;
				pc.onicecandidate = ice;
				pc.onaddstream = add;
			} catch ( e ) {
				console.log(e);
				return null;
			}
			if ( ! pc )
				return null;
			this.attr.pc = pc;
		},
	destroy:
		function() {
			function remove(object) {
				for ( var key in object ) {
					if ( ! object[key] || key.search(/^_/) != -1 )
						continue;
					if ( typeof(object[key]) == 'object' && ! object[key].constructor._isClass && ! object[key].nodeName )
						remove(object[key]);
					object[key] = null;
					delete object[key];
				}
			}
			if ( this.attr.pc.signalingState != 'closed' )
				this.attr.pc.close();
			this.attr.pc.oniceconnectionstatechange = null;
			this.attr.pc.onicecandidate = null;
			this.attr.pc.onaddstream = null;
			this.attr.pc = null;
			delete this.attr.pc;
			remove(this);
		},
	_sendSdp:
		function(sd) {
			this.attr.pc.setLocalDescription(sd);
			sd.src = this.attr.src;
			socket.emit('rtc', sd, this.attr.dst);
		},
	getStream:
		function(streamId) {
			if ( ! this.attr.remoteStreams[streamId] )
				return null;
			return this.attr.remoteStreams[streamId];
		}, 
	addStream:
		function(stream) {
			if ( ! stream )
				return;
			var error = false;
			try {
				this.attr.pc.addStream(stream);
			} catch ( e ) {
				console.log(e);
				error = true;
			}
			if ( ! error )
				this.attr.localStreams[stream.id] = stream;
		},
	removeStream:
		function(streamId) {
			if ( this.attr.localStreams[streamId] ) {
				try { 
					this.attr.pc.removeStream(this.attr.localStreams[streamId]);
				} catch ( e ) {
					console.log(e);
				}
			}
		},
	setRemote:
		function(sd) {
			this.attr.pc.setRemoteDescription(new RTCSessionDescription(sd), null, error);
		},
	candidate:
		function(ice) {
			var candidate = new RTCIceCandidate({
				sdpMLineIndex:	ice.label,
				candidate:	ice.candidate
			});
			this.attr.pc.addIceCandidate(candidate, success, error);
		},
	offer:
		function(stream) {
			var _this = this;
			function send(sd) {
				_this._sendSdp(sd);
			}
			if ( stream )
				this.addStream(stream);
			this.attr.pc.createOffer(send, error, {optional: [], mandatory: {OfferToReceiveVideo: true}});
		},
	answer:
		function(stream) {
			var _this = this;
			function send(sd) {
				_this._sendSdp(sd);
			}
			if ( stream )
				this.addStream(stream);
			this.attr.pc.createAnswer(send, error);
		},
	close:	function() {
			if ( this.attr.pc.signalingState != 'closed' )
				this.attr.pc.close();
		}
	}
);

function error(e) {
	console.log(e);
}

function success(e) {
	/* console.log(e); */
}

function getLocalMedia(callback) { 
	if ( typeof(MediaStreamTrack) == 'undefined' )
		return;
	MediaStreamTrack.getSources(
		function(sources) {
			var source = {};
			constraints = {video: true};
			for ( var i = 0; i < sources.length; i++ ) {
				if ( sources[i].kind != 'video' )
					continue; 
				switch ( sources[i].facing ) {
					case 'user':
						source.front = sources[i].id;
						break;
					case 'environment':
						source.back = sources[i].id;
						break;
				} 
			}
			if ( source.back )
				constraints = {video: {optional: [{sourceId: source.back}]}};
			else if ( source.front )
				constraints = {video: {optional: [{sourceId: source.front}]}};
			getUserMedia(constraints,
				function(stream) {
					if ( typeof(callback) == 'function' )
						callback(stream);
				},
				error
			);
		}
	);
}
