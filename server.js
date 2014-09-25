var app = require('express')();
var Nexmo = require('simple-nexmo');
var config = require('./config/server');
var server = require('http').Server(app);
var bodyParser = require('body-parser');
var serveStatic = require('serve-static');

var nexmo = new Nexmo();
nexmo.init(config.nexmo.key, config.nexmo.secret, config.nexmo.transport, config.nexmo.debug);

app.enable('trust proxy');
app.use(function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
	next();
});

app.use(bodyParser());
app.use(serveStatic(__dirname + '/public'));
app.get('/caller', 
	function(req, res) {
		res.sendfile(__dirname + '/public/client.html');
	}
);
app.get('/operator',
	function(req, res) {
		res.sendfile(__dirname + '/public/operator.html');
	}
);
app.get('/responder',
	function(req, res) {
		res.sendfile(__dirname + '/public/agent.html');
	}
);

var locations = {};
var sessions = {available: {}};
var io = require('socket.io')(server);

function listClients(session) {
	if ( ! sessions[session] )
		return;
	for ( var ida in sessions[session] ) {
		if ( ! io.sockets.connected[ida] ) {
			delete sessions[session][ida];
			continue;
		}
		var list = [];
		for ( var idb in sessions[session] ) {
			if ( ida == idb )
				continue;
			list.push({name: sessions[session][idb].name, id: idb});
		}
		sessions[session][ida].emit('list', session, list);
	}
}

io.sockets.on('connection',
	function (client) {
		client.on('create', 
			function(session, name) {
				var success = true;
				if ( client.name || name ) {
					if ( name )
						client.name = name;
				} else
					success = false;
				if ( success ) {
					if ( ! sessions[session] )
						sessions[session] = {};
					sessions[session][client.id] = client;
					client.emit('session', client.id);
					listClients(session);
				} else
					client.emit('session', false);
			}
		);
		client.on('join',
			function(session, name, id) {
				var success = true;
				if ( ! sessions[session] )
					success = false;
				if ( id && ! name ) {
					if ( io.sockets.connected[id] )
						client = io.sockets.connected[id];
					else
						success = false;
				}
				if ( client.name || name ) {
					if ( name )
						client.name = name;
				} else
					success = false;
				if ( success ) {
					sessions[session][client.id] = client;
					client.emit('session', client.id);
					listClients(session);
				} else
					client.emit('session', false);
			}
		);
		client.on('leave',
			function(session, id) {
				if ( sessions[session] ) {
					if ( id && sessions[session][id] ) {
						sessions[session][id] = null;
						delete sessions[session][id];
					} else if ( ! id && sessions[session][client.id] ) {
						sessions[session][client.id] = null;
						delete sessions[session][client.id];
					}
				} else if ( ! id && ! session ) {
					for ( session in sessions ) {
						if ( ! sessions[session][client.id] )
							continue;
						sessions[session][client.id] = null;
						delete sessions[session][client.id];
					}
				}
				listClients(session);
			}
		);
		client.on('location',
			function(session, co) {
				/* We may use this later */
				locations[client.id] = {
					stamp:	(new Date()).getTime(),
					co:	co
				};
				if ( ! sessions[session] )
					return;
				for ( var ida in sessions[session] ) {
					if ( ! io.sockets.connected[ida] ) {
						delete sessions[session][ida];

						continue;
					}
					if ( ida == client.id )
						continue;
					sessions[session][ida].emit('location', {id: client.id, name: client.name, lat: co.lat, long: co.long});
				}
			}
		);
		client.on('sms',
			function(number, message) { 
				if ( isNaN(number) ) {
					client.emit('text', 'Missing or poorly formed input data.');
					return;
				}
				function cb(error, response) {
					if ( error )
						client.emit('sms', 'Error occurred sending message!');
					else if ( response.messages[0].status != '0' )
						client.emit('sms', 'Error occurred communicating with Nexmo!')
					else
						client.emit('sms', true);
				}
				nexmo.sendTextMessage('ipcortex', number, message, cb);
			}
		);
		client.on('rtc',
			function(msg, dstId) {
				if ( io.sockets.connected[dstId] )
					io.sockets.connected[dstId].emit('rtc', msg);
				else
					console.log('Unknown client:' + dstId);
			}
		);
	}
);

server.listen(config.listen_port);
