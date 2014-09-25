$(document).ready(function(){

	var socket		= io();
	var roomID, map, callMark;

	if(window.location.href.indexOf('?') > 0) {
		roomID		= window.location.href.slice(window.location.href.indexOf('?') + 1).split('&')[0];
	}

	if(!roomID) {
		// Forgive me, I did it again
		roomID		= prompt('Room ID?');
	}

	var statusIcon		= $('#status-icon');
	var shareInfo		= $('#status-text');
	var shareInfoGeo	= false;
	var shareInfoVideo	= false;

	function updateShareInfo() {
		if(shareInfoGeo && shareInfoVideo){
			shareInfo.text('Accessing caller\'s location and video');
			statusIcon.html('<span class="fa fa-check-circle fa-5x"></span>');
		}
		else if(shareInfoGeo || shareInfoVideo) {
			shareInfo.text('Accessing caller\'s ' + ((shareInfoGeo) ? 'location' : 'video'));
			statusIcon.html('<span class="fa fa-check-circle fa-5x"></span>');
		}
		else {
			shareInfo.text('Unable to access caller\'s information');
			statusIcon.html('<span class="fa fa-times-circle fa-5x"></span>');
		}
	}

	socket.emit('joinRoom', roomID);
	socket.on('joinRoomResult', function(success){
		if(!success) {
			console.error('Client couldn\'t join room!');
			return;
		}

		var mapOptions = {
			center: new google.maps.LatLng(51.997146, -0.740683),
			zoom: 18
		};

		map			= new google.maps.Map(document.getElementById("map"), mapOptions);

		socket.on('callerLocation', function(loc){
			console.log('Setting caller location as', loc);
			$('#caller-info-lat').text(loc.coords[0]);
			$('#caller-info-long').text(loc.coords[1]);
			var gLoc 		= new google.maps.LatLng(loc.coords[0], loc.coords[1]);
			map.setCenter(gLoc);
			map.setZoom(18);
			if(!callMark){
				callMark = new google.maps.Marker({
					position:	gLoc,
					map:		map,
					title:		'Caller'
				});
			}
			else {
				callMark.setPosition(gLoc);
			}
			shareInfoGeo = true;
			updateShareInfo();
		});

		socket.emit('getCallerLocation');
	});
});