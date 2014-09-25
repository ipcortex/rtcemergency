//
// (c) 2005-2014 IP Cortex Ltd.
// All rights reserved.  Unauthorised copying is not permitted.
//

function stopBubble(e) {
	e = e || window.event;
	var t = e.target || e.srcElement;
	e.cancelBubble = true;
	if ( e.stopPropagation )
		e.stopPropagation();
	if ( e.preventDefault )
		e.preventDefault();
	else
		e.returnValue = false;	/* superseded by preventDefault() */ 
	return false;
}

if ( _xmlHttp == null ) {
	var _xmlHttp = [];
	for ( var p = 0; p < 10; p++ )
		_xmlHttp[p] = new XMLHttpRequest();
}

function httpPost(url, params, callback, get) {
	var _my_xmlHttp = null;
	for ( var p = 0; p < 10 && ! _my_xmlHttp; p++ )
		if ( _xmlHttp[p].readyState < 1 || _xmlHttp[p].readyState == 4 )
			_my_xmlHttp = _xmlHttp[p];
	_my_xmlHttp.onreadystatechange = function() {
		if ( _my_xmlHttp.readyState == 4 ) {
			if ( typeof(callback) == 'function' )
				callback(_my_xmlHttp.responseText);
		}
	}
	if( ! get ) {
		_my_xmlHttp.open('POST', url, true);
		_my_xmlHttp.withCredentials = true;
		if ( typeof params == 'string' )
			_my_xmlHttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		_my_xmlHttp.send(params);
	} else {
		_my_xmlHttp.open('GET', url + '?' + params, true);
		_my_xmlHttp.withCredentials = true;
		_my_xmlHttp.send();
	}
}

function waitForHttpPost(time, callback) {
	var _start = (new Date()).getTime();
	function check() {
		var _count = 0;
		for ( var p = 0; p < 10 ; p++ )
			if ( _xmlHttp[p].readyState < 1 || _xmlHttp[p].readyState == 4 )
				_count++
//			else
//				console.log('slot ' + p + ' not empty!');
		if ( _count == 10 )
			callback(true);
		else if( (new Date()).getTime() - _start > (time || 5) * 1000 )
			callback(false);
		else
			setTimeout(check, 500);
	}
	check();
}

function addElement(parent, children, elements, sibling) {
	var _focus = null;
	for ( var i = 0; i < children.length; i++ ) { 
		var _el = null;
		if ( children[i].nodeType && children[i].nodeType == 1 )
			_el = children[i];
		else if ( children[i].elm == 'text' ) {
			if ( typeof(children[i].txt) == 'function' )
				_el = document.createTextNode(children[i].txt());
			else
				_el = document.createTextNode(children[i].txt);
		} else
			_el = document.createElement(children[i].elm);
		if ( sibling )
			parent.insertBefore(_el, sibling);
		else
			parent.appendChild(_el);
		if ( typeof(children[i].attr) == 'object' )
			setAttrib(_el, children[i].attr);
		if ( elements instanceof Array && children[i].rtrn )
			elements.push(_el);
		else if ( typeof(elements) == 'object' && typeof(children[i].rtrn) == 'string' )
			elements[children[i].rtrn] = _el;
		if ( children[i].focus )
			_focus = _el;
		if ( children[i].chld instanceof Array )
			addElement(_el, children[i].chld, elements);
	}
	if ( _focus )
		_focus.focus();
}

function setAttrib(element, attribs) {
	for ( var attr in attribs ) {
		if ( typeof(attribs[attr]) == 'object' ) {
			setAttrib(element[attr], attribs[attr]);
			continue;
		}
		if ( attr.search(/^data-/) != -1 )
			element.setAttribute(attr, attribs[attr]);
		else
			element[attr] = attribs[attr];
	}
}

function isEmpty(obj) {
	if ( obj == null )
		return true;
	if ( typeof(obj) == 'number' )
		return false;
	else if ( typeof(obj) == 'string' ) {
		if ( obj != '' )
			return false;
	} else if ( obj instanceof Array ) {
		if ( obj.length > 0 )
			return false;	
	} else if ( typeof(obj) == 'object' ) {
		for ( var prop in obj ) {
			if ( obj.hasOwnProperty(prop) )
				return false;
		}
	}
	return true;
}

function getDimensions(element, scroll, range, stopElement) {
	var _element = element;
	var _h = _element.offsetHeight;
	var _w = _element.offsetWidth;
	for ( var _x = 0, _y = 0; _element != stopElement && _element != null; _element = _element.offsetParent ) {
		_x += scroll ? (_element.offsetLeft - _element.scrollLeft) : _element.offsetLeft; 
		_y += scroll ? (_element.offsetTop - _element.scrollTop) : _element.offsetTop;
	};
	if ( range && _areaCache[element.parentNode.id] != null ) {
		var _dimension = _areaCache[element.parentNode.id];
		if ( (_y >= _dimension.y && _y <= (_dimension.y + _dimension.h)) &&
		     ((_y + _h) >= _dimension.y && (_y + _h) <= (_dimension.y + _dimension.h)) )
			return {x: _x, y: _y, h: _h, w: _w};
		else
			return {x: _dimension.x, y: _dimension.y, h: _dimension.h, w: _dimension.w};
	}
	return {x: _x, y: _y, h: _h, w: _w};
}

function doDecodeState(s) {
	if ( s && s.length ) {
		return (decodeURIComponent(s));
	}
	return s;
}

function isEmail(value) {
	if ( value.search(/^[a-zA-Z0-9!#\$%&'\*\+\-_`\{\}\|~\.]+@[a-zA-Z0-9\-]+(\.[a-zA-Z0-9\-]+)+$/) != -1 )
		return true;
	return false;
}

function serialise(obj) {
	var hexDigits = '0123456789ABCDEF';
	function toHex(d) {
		return hexDigits[d >> 8] + hexDigits[d & 0x0F];
	}
	function toEscape(string) {
		return string.replace(/[\x00-\x1F'\\]/g,
			function (x) {
				if (x == "'" || x == '\\') return '\\' + x;
				return '\\x' + toHex(x.charCodeAt(0));
			})
	}
	return getObject(obj).replace(/,$/, '');
	function getObject(obj) {
		if ( typeof obj == 'string' ) {
			return "'" + toEscape(obj) + "',";
		}
		if ( obj instanceof Array ) {
			result = '[';
			for ( var i = 0; i < obj.length; i++ ) {
				result += getObject(obj[i]);
			}
			result = result.replace(/,$/, '') + '],';
			return result;
		}
		var result = '';
		if ( typeof obj == 'object' ) {
			result += '{';
			for ( var property in obj ) {
				result += "'" + toEscape(property) + "':" + getObject(obj[property]);
			}
			result += '},';
		} else {
			result += obj + ',';
		}
		return result.replace(/,(\n?\s*)([\]}])/g, "$1$2");
	}
}

function doClone(from, to) {
	for ( var i in from ) {
		if ( typeof(from[i]) == 'object' ) {
			if ( from[i].constructor == Array )
				to[i] = [];
			else
				to[i] = {};
			doClone(from[i], to[i]);
		} else
			to[i] = from[i];
	}
}

function isInArray(list, item) {
	if ( ! (list instanceof Array) )
		return false;
	var i = list.length;
	if ( typeof item == 'object' ) {
		while ( i-- ) {
			if ( list[i] === item )
				return true;
		}
	} else {
		while ( i-- ) {
			if ( list[i] == item )
				return true;
		}
	}
	return false;
}

function extractNumber(value) {
	var n = parseInt(value);
	return n == null || isNaN(n) ? 0 : n;
}

function formatTime(secs) {
	function twoDigits(n) {
		if ( n < 10 )
			return '0' + n;
		return n;
	}
	if ( secs < 3600 )
		return twoDigits(Math.floor((secs % 3600) / 60)) + ':' + twoDigits((secs % 60));
	else
		return twoDigits(Math.floor(secs / 3600)) + ':' + twoDigits(Math.floor((secs % 3600) / 60));
}

