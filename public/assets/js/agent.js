var myId = null;
var socket = io();
var rtConnections = {};

function onLoad() {
	var clients = {};
	var mapMarkers = {};
	var name = prompt('Agent ID?');
	var map = new google.maps.Map(document.getElementById("map"), {
		center:	new google.maps.LatLng(51.997146, -0.740683),
		zoom:	16
	});
	function streamCB(src, streams) {
console.log('streamCB');
		var rid = (new Date).getTime();
		function centre() {
			if ( $('#' + rid).length ) {
				$('#' + rid).css({
					left:	Math.round(($('#' + rid).parent().width() / 2) - ($('#' + rid).width() / 2)) + 'px',
					top:	Math.round(($('#' + rid).parent().height() / 2) - ($('#' + rid).height() / 2)) + 'px'
				});
				setTimeout(centre, 2000);
			}
		}
		$('#video-feeds').append('<div id="' + rid + '" class="feed"></div>');
		for ( var streamId in streams )
			$('#' + rid).append('<video id="' + streamId + '" src="' + window.URL.createObjectURL(streams[streamId]) + '" autoplay></video>');
		setTimeout(centre, 2000);
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
				$('.feed').remove();
				break;
		}
	}		
	socket.emit('join', 'available', name);
	socket.on('session',
		function(id) {
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
					rtConnections[dst] = new clientConnection(myId, dst, streamCB, stateCB);
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
	socket.on('location',
		function(location) {
			var gLocation = new google.maps.LatLng(location.lat, location.long);
			map.setCenter(gLocation);
			map.setZoom(18);
			if( ! mapMarkers[location.id] ) {
				mapMarkers[location.id] = new google.maps.Marker({
					position:	gLocation,
					map:		map,
					title:		location.name
				});
			} else
				mapMarkers[location.id].setPosition(gLocation);
		}
	);
	initRTC(
		[{url: 'stun:stun.l.google.com:19302'},
		{url: 'turn:turn.webrtc.nu:5349', username: 'agent', credential: 'curntoat9919a'}]
	);
}

function onUnload() {
	socket.emit('leave');
}
