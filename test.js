
function parse( url) {
	var address = {};
	var s = url.replace(/^WOL[:]?[\/]?[\/]?(.*)[\?]ip=(.*)|^WOL[:]?[\/]?[\/]?(.*)/ig, function( str, p1, p2, p3) {
		if (p1) {
			address.mac = p1;
			address.ip = p2;
		}
		if (p3) {
			address.mac  = p3;
		}
	});
	return address;
}

var a = parse( "wol://34:34:34:34?ip=345.45.45.45");
var b = parse( "wol://34:34:34:34");

console.log( JSON.stringify( a));
console.log( JSON.stringify( b));