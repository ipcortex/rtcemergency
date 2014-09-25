$(document).ready(function(){

	var socket		= io();
	var roomID		= null;

	if(window.location.href.indexOf('?') > 0) {
		roomID		= window.location.href.slice(window.location.href.indexOf('?') + 1).split('&')[0];
	}

	var statusIcon		= $('#status-icon');
	var shareInfo		= $('#share-info');
	var shareInfoGeo	= false;
	var shareInfoVideo	= false;

	function updateShareInfo() {
		if(shareInfoGeo && shareInfoVideo){
			shareInfo.text('your location and camera');
			statusIcon.html('<span class="fa fa-check-circle fa-5x"></span>');
		}
		else if(shareInfoGeo || shareInfoVideo) {
			shareInfo.text('your ' + (shareInfoGeo) ? 'location' : 'camera');
			statusIcon.html('<span class="fa fa-check-circle fa-5x"></span>');
		}
		else {
			shareInfo.text('nothing');
			statusIcon.html('<span class="fa fa-times-circle fa-5x"></span>');
		}
	}

	if(!roomID) {
		// Forgive me father for I have sinned
		roomID		= prompt('Room ID?');
	}

	socket.emit('joinRoom', roomID);
	socket.on('joinRoomResult', function(id){
		if(isNaN(id)) {
			console.error('Client couldn\'t join room!');
			return;
		}
		var watchID = navigator.geolocation.watchPosition(function(position) {
			socket.emit('locationReport', [position.coords.latitude, position.coords.longitude]);
			shareInfoGeo		= true;
			updateShareInfo();
		}, function(){
			shareInfoGeo		= false;
			updateShareInfo();
		});

		myId			= id;
		var video		= $('#caller-video');
		var videoSrc		= $('#video-select');
		var videoStreams	= {};
		var videoStream;
console.log('Got myId' + id);

		function gotSources(sourceInfos) {
			for (var i = 0; i != sourceInfos.length; ++i) {
				var sourceInfo		= sourceInfos[i];
				var option			= document.createElement('option');
				option.value		= sourceInfo.id;
				/*if (sourceInfo.kind === 'audio') {
					option.text = sourceInfo.label || 'microphone ' + (audioSelect.length + 1);
					audioSelect.appendChild(option);
				} else if (sourceInfo.kind === 'video') {*/
				if (sourceInfo.kind === 'video') {
					option.text			= sourceInfo.label || 'camera ' + (videoSrc.children().length + 1);
					videoSrc.append(option);
					initStream(sourceInfo.id);
					shareInfoVideo		= true;
				}
			}
			updateShareInfo();
		}

		if (typeof MediaStreamTrack === 'undefined'){
			alert('This browser does not support MediaStreamTrack. Source selection will be disabled');
			videoSrc.prop('disabled', true);
		} else {
			MediaStreamTrack.getSources(gotSources);
		}

		function initStream(id) {
			getUserMedia({
				video: {
					optional: [{
						sourceId: id
					}]
				}
			}, function (stream) {
				console.log('[initStream]', 'Initialized stream', id);
				videoStreams[id]		= stream;
				if(videoSrc.val() == id) {
					changeStream(videoSrc.val());
				}
			}, function (e) {
				console.error('[initStream]', e);
				shareInfoVideo			= false;
				updateShareInfo();
			});
		}

		function changeStream(id) {
			videoStream			= videoStreams[id];
			video.attr('src', window.URL.createObjectURL(videoStreams[id]));
			video.get(0).load();
			video.get(0).play();
		}

		videoSrc.change(function(e){
			changeStream(videoSrc.val());
		});
	})

});
