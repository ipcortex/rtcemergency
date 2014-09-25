var socket = io();
var rtcEnabled = false;
var rtConnections = {};
var call, map, clone,
    target, answerCall, ringingCall,
    hangupCall, setCall, currentState = null;
var hostname = 'https://call.webrtc.nu';

function onAPILoadReady() {
	IPCortex.PBX.Auth.login('rob', 'r', null,
		function(success) {
			if ( ! success) {
				console.error('[onAPILoadReady]', 'Could not connect to PBX!');
				return;
			}
			console.log('[onAPILoadReady]', 'PBX login successful.');
			IPCortex.PBX.startPoll(
				function() {
					IPCortex.PBX.hookDevice(null, IPCortex.PBX.Auth.getUserInfo().id, null, null, true,
						function(filter, hid, device) {
							//console.log('[apiload]', device.get('webrtc'));
							if ( device.get('webrtc') && ! rtcEnabled ) {
								device.enablertc();
								rtcEnabled = true;
							}
							var calls = device.get('calls');
							for ( var i in calls )
								handleCall(calls[i]);
						}
					);
				}, 
				function() {
					console.error('[onAPILoadReady]', 'Could not begin polling! Error info:', arguments);
				}
			);
		}
	);
}

function handleCall(call) {
	if ( ! setCall(call) ) {
		console.log('[handleCall]', 'Failed to handle the call! (This might be intentional.)');
		return;
	}
	if ( call.get('state') != currentState ) {
		currentState = call.get('state');
		switch ( call.get('state') ) {
			case 'ring':
				ringingCall(call);
				break;
			case 'up':
				answerCall();
				break;
			case 'dead':
				hangupCall();
		}
	}
}

function onLoad() {
	var myId = null;
	var agents = {};
	var clients = {};
	var mapMarkers = {};
	var sessionID = null;
	document.onmouseup = mouseUp;
	document.onmousemove = mouseMove;
	var activeCallDefault = $('#active-call').clone();
	function cloneVideo(e) {
		clone = $(e.target).clone().appendTo($(document.body));
		clone.attr({class: 'video-clone no-event', width: 80, height: 60});
		clone.css({
			left:	(e.clientX - 5) + 'px',
			top:	(e.clientY - 5) + 'px'
		});
	}
	function mouseMove(e) {
		if ( ! clone )
			return;
		clone.css({
			left:	(e.clientX - 5) + 'px',
			top:	(e.clientY - 5) + 'px'
		});
	}
	function mouseUp(e) {
		if ( ! clone )
			return;
		var dst = rtConnections[target];
		var src = rtConnections[clone.attr('data-src')]; 
		if ( dst instanceof clientConnection && src instanceof clientConnection ) {
			socket.emit('join', clone.attr('data-session'), null, target); 
			socket.emit('leave', 'available', target);
			var stream = src.getStream(clone.attr('id'));
			if ( stream ) {
				agents[target] = clone.attr('data-session');
				dst.offer(stream);
			}
		}
		clone.remove();
		clone = null;
	}
	function mouseOver(e) {
		if ( ! clone )
			return;
		target = $(e.target).attr('data-dst');
		$(e.target).addClass('viewer-over');
	}
	function mouseOut(e) {
		if ( $(e.target).attr('data-dst') == target ) {
			$(e.target).removeClass('viewer-over');
			target = null;
		}
	}
	function streamCB(src, streams) {
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
			$('#' + rid).append('<video id="' + streamId + '" data-src="' + src + '" data-session="' + sessionID  + '" src="' + window.URL.createObjectURL(streams[streamId]) + '" height="480" autoplay></video>').mousedown(cloneVideo);
		setTimeout(centre, 2000);
	}
	function stateCB(src, state) {
		console.log(state);
	}
	$('#btn-answer').click(
		function(e) {
			e.preventDefault();
			call.talk();
		}
	).prop('disabled', true);
	socket.emit('join', 'available', 'Operator');
	socket.on('session',
		function(id) {
			if ( myId )
				return;
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
				/* Bit of a cheat! */
				live[dst] = list[i].name;
			}
			for ( var dst in clients ) {
				if ( session == 'available' ) {
					if ( $('#' + dst).length && ! live[dst] )
						$('#' + dst).remove();
					else if ( ! $('#' + dst).length && live[dst] ) {
						$('#agents').append('<div id="' + dst + '" data-dst="' + dst + '" class="viewer"><span class="fa fa-user"></span> ' + live[dst] + '</div>');
						$('#' + dst).mouseover(mouseOver);
						$('#' + dst).mouseout(mouseOut);
					}
				}
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
	function holdTalk() {
		if ( ! call ) {
			console.error('You want to put a call on hold, that doesn\'t exist?');
			return;
		}
		if ( call.get('state') == 'up' ) {
			$('#btn-pausecall').html('<span class="fa fa-play"></span> Resume');
			call.hold();
		} else if ( call.get('state') == 'hold' ) {
			$('#btn-pausecall').html('<span class="fa fa-pause"></span> Hold');
			call.talk();
		}
	}
	function sendText(e) {
		e.preventDefault();
		var cid	= call.get('number');
		if ( ! cid || cid.length < 7 ) {
			console.error('Missing or invalid caller ID!');
			return;
		}
		$('#btn-sendtxt').prop('disabled', true);
		$('#btn-sendtxt').html('<span class="fa fa-circle-o-notch fa-spin"></span> Sending...');
		socket.emit('sms', cid.replace(/^0/, '44'), hostname + '/caller/?' + sessionID + '&' + myId  + '&' + cid);
		socket.on('sms',
			function(result) {
				if ( typeof(result) == 'string' ) {
					$('#btn-sendtxt').html('<span class="fa fa-video-camera"></span> Retry Send');
					$('#btn-sendtxt').tooltip({
						text:		result,
						placement:	'bottom',
						trigger:	'manual',
						delay:	{
							show:	0,
							hide:	5000
						}
					});
					$('#btn-sendtxt').prop('disabled', false);
				} else
					$('#btn-sendtxt').html('<span class="fa fa-video-camera"></span> Sent!');
			}
		);
	}
	setCall = function(inCall) {
		if ( ! call || inCall.get('id') == call.get('id') ) {
			call = inCall;
			return true;
		}
		console.log('[setCall]', 'Ignoring additional call - ID:', inCall.get('id'));
		return false;
	}
	ringingCall = function() {
		$('#btn-answer').prop('disabled', false);
	}
	answerCall = function(force) {
		if ( ! call )
			return;
		sessionID = call.get('id');
		var session = call.get('session');
		if ( session && session.getRemoteStreams().length ) {
			var audio = $('#caller-webrtc-call').get(0);
			audio.src = window.URL.createObjectURL(session.getRemoteStreams()[0]);
		}
		socket.emit('create', sessionID, 'Operator');
		$('#btn-pausecall').click(
			function(e) {
				e.preventDefault();
				holdTalk();
			}
		);
		$('#btn-hangupcall').click(
			function(e) {
				e.preventDefault();
				call.hangup();
			}
		);
		if ( ! map )
			map = new google.maps.Map(document.getElementById('map'), {
					center:	new google.maps.LatLng(51.997146, -0.740683),
					zoom:	16
			});
		$('#btn-answer').prop('disabled', true);
		$('#tabs-main a[href="#active-call"]').parent().removeClass('disabled');
		$('#caller-id').html('Call in progress with ' + call.get('number'));
		$('#tabs-main a[href="#active-call"]').tab('show');
		$('#btn-sendtxt').click(sendText);
	}
	hangupCall = function() {
		call = null;
		for ( var dst in agents ) {
			socket.emit('join', 'available', null, dst); 
			socket.emit('leave', agents[dst], target);
		}
		for ( var dst in rtConnections )
			rtConnections[dst].close();
		for ( marker in mapMarkers ) {
			mapMarkers[marker].setMap(null);
			mapMarkers[marker] = null;
			delete mapMarkers[marker];
		}
		$('#tabs-main a[href="#incoming-call"]').tab('show');
		$('#tabs-main a[href="#active-call"]').parent().addClass('disabled');
		$('#active-call').replaceWith(activeCallDefault);
		$('.feed').remove();
		agents = {};
	}
	initRTC(
		[{url: 'stun:stun.l.google.com:19302'},
		{url: 'turn:turn.webrtc.nu:5349', username: 'operator', credential: 'curntoat9919o'}]
	);
}

function onUnload() {
	socket.emit('leave');
}
