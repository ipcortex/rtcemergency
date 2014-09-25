var socket = io();
var rtConnections = {};

function onLoad() {
	var myId = null;
	var clients = {};
	var number = null;
	var viewerID = null;
	var sessionID = null;
	var href =  window.location.href;
	if ( href.indexOf('?') > 0 ) {
		var qs = href.slice(href.indexOf('?') + 1);
		sessionID = qs.split('&')[0];
		viewerID = qs.split('&')[1];
		number = qs.split('&')[2];
	}
	if ( ! sessionID || ! viewerID || isNaN(number) )
		return;
	function mediaCB(stream) {
		if ( ! rtConnections[viewerID] )
			return;
		$('#local-video').attr('src', window.URL.createObjectURL(stream));
		rtConnections[viewerID].addStream(stream);
		rtConnections[viewerID].offer();
        }
	function stateCB(src, state) {
		switch ( state ) {
			case 'checking':
				$('#status-icon').html('<span class="fa fa-spin fa-5x"></span>');
				break;
			case 'completed':
				$('#status-icon').html('<span class="fa fa-check-circle fa-5x"></span>');
				break;
			case 'connected':
				$('#status-icon').html('<span class="fa fa-check-circle fa-5x"></span>');
				break;
			case 'disconnected':
				$('#status-icon').html('<span class="fa fa-times-circle fa-5x"></span>');
				break;
		}
	}
	socket.emit('join', sessionID, number);
	socket.on('session',
		function(id) {
			if ( ! id )
				return;
			navigator.geolocation.watchPosition(
				function(position) {
					socket.emit('location', sessionID, {lat: position.coords.latitude, long: position.coords.longitude});
				},
				error
			);
			getLocalMedia(mediaCB);
			myId = id;
		}
	);
	socket.on('list',
		function(session, list) {
			if ( ! (list instanceof Array) || ! myId )
				return; 
			var live = {};
			for ( var i = 0; i < list.length; i++ ) {
				var dst = list[i].id;
				if ( ! rtConnections[dst] )
					rtConnections[dst] = new clientConnection(myId, dst, null, stateCB);
				if ( ! clients[dst] )
					clients[dst] = {};
				clients[dst][session] = rtConnections[dst];
				live[dst] = true;
			}
			for ( var dst in clients ) {
				if ( live[dst] )
					continue;
				clients[dst][session] = null;
				delete clients[dst][session]; 
				if ( isEmpty(clients[dst]) ) {
					rtConnections[dst].destroy();
					rtConnections[dst] = null;
					delete rtConnections[dst];
					clients[dst] = null;
					delete clients[dst];
				}
			}
		}
	);
	initRTC(
		[{url: 'stun:stun.l.google.com:19302'},
		{url: 'turn:turn.webrtc.nu:5349', username: 'client', credential: 'curntoat9919c'}]
	);
}

function onUnload() {
	socket.emit('leave');
}
