var Service;
var Characteristic;
var request = require("request");
var pollingtoevent = require('polling-to-event');
var wol = require('wake_on_lan');

module.exports = function(homebridge)
{
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-winpc", "WinPC", HttpStatusAccessory);
}

function HttpStatusAccessory(log, config) 
{
	this.log = log;
	var that = this;
	this.setAttempt = 0;

	// url info
	this.on_url = config["on_url"];
	this.on_body = config["on_body"];
	this.off_url = config["off_url"];
	this.off_body = config["off_body"];
	this.status_url = config["status_url"];
	this.http_method = config["http_method"] || "GET";;
	this.username  = config["username"] || "";
	this.password = config["password"] || "";
	this.sendimmediately = config["sendimmediately"]  || "";
	this.name = config["name"];
	this.poll_status_interval = config["poll_status_interval"];
	this.interval = parseInt( this.poll_status_interval);
	this.powerstateOnError = config["powerstateOnError"];
	this.powerstateOnConnect = config["powerstateOnConnect"];
	this.info = {
		serialnumber : "Unknown",
		model: "Windows PC",
		manufacterer : "Microsoft",
		name : "Windows PC",
		softwareversion : "Unknown"
	};
	
	this.switchHandling = "check";
	if (this.status_url && this.interval > 10 && this.interval < 100000) {
		this.switchHandling = "poll";
	}	
	this.state = false;

	// Status Polling
	if (this.switchHandling == "poll") {
		var powerurl = this.status_url;
		
		var statusemitter = pollingtoevent(function(done) {
			that.log("start polling..");
			that.getPowerState( function( error, response) {
				//pass also the setAttempt, to force a homekit update if needed
				done(error, response, that.setAttempt);
			}, "statuspoll");
		}, {longpolling:true,interval:that.interval * 1000,longpollEventName:"statuspoll"});

		statusemitter.on("statuspoll", function(data) {
			that.state = data;
			that.log("event - status poller - new state: ", that.state);

			if (that.switchService ) {
				that.switchService.getCharacteristic(Characteristic.On).setValue(that.state, null, "statuspoll");
			}
		});
	}
}

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

HttpStatusAccessory.prototype = {

httpRequest: function(url, body, method, username, password, sendimmediately, callback) {
	if (url.substring( 0, 3).toUpperCase() == "WOL") {
		//Wake on lan request
		var address = parse( url);
		
		var opts={};
		var macAddress = address.mac;
		if (address.ip) {
			opts.address = address.ip;
		}
		
		this.log("Excuting WakeOnLan request to "+macAddress+" options: "+JSON.stringify( opts));
		wol.wake(macAddress, opts, function(error) {
		  if (error) {
			callback( error);
		  } else {
			callback( null, 200, "OK");
		  }
		});
	} else {
		request({
			url: url,
			body: body,
			method: method,
			rejectUnauthorized: false,
			timeout: 3000,
			auth: {
				user: username,
				pass: password,
				sendImmediately: sendimmediately
			}
		},
		function(error, response, body) {
			callback(error, response, body)
		});
	}
},

setPowerState: function(powerState, callback, context) {
    var url;
    var body;
	var that = this;

//if context is statuspoll, then we need to ensure that we do not set the actual value
	if (context && context == "statuspoll") {
		this.log( "setPowerState - polling mode, ignore, state: %s", this.state);
		callback(null, powerState);
	    return;
	}
    if (!this.on_url || !this.off_url) {
    	    this.log.warn("Ignoring request; No power url defined.");
	    callback(new Error("No power url defined."));
	    return;
    }

	this.setAttempt = this.setAttempt+1;
		
    if (powerState) {
		url = this.on_url;
		body = this.on_body;
		this.log("setPowerState - setting power state to on");
    } else {
		url = this.off_url;
		body = this.off_body;
		this.log("setPowerState - setting power state to off");
    }

    this.httpRequest(url, body, this.http_method, this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
		if (error) {
			that.log('setPowerState - actual mode - failed: %s', error.message);
			powerState = false;
			that.state = powerState;
			that.log("setPowerState - actual mode - current state: %s", that.state);
			if (that.switchService ) {
				that.switchService.getCharacteristic(Characteristic.On).setValue(powerState, null, "statuspoll");
			}	
			callback(null, powerState);
		} else {
			that.state = powerState;
			that.log("setPowerState - actual mode - current state: %s", that.state);
			callback(null, powerState);
		}
    }.bind(this));
},
  
getPowerState: function(callback, context) {
//if context is statuspoll, then we need to request the actual value
	if (!context || context != "statuspoll") {
		if (this.switchHandling == "poll") {
			this.log("getPowerState - polling mode, return state: ", this.state);
			callback(null, this.state);
			return;
		}
	}
	
    if (!this.status_url) {
    	this.log.warn("Ignoring request; No status url defined.");
	    callback(new Error("No status url defined."));
	    return;
    }
    
    var url = this.status_url;
    this.log("getPowerState - actual mode");
	var that = this;

    this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
		var tResp = responseBody;
		var tError = error;
		if (tError) {
			if (that.powerstateOnError) {
				tResp = that.powerstateOnError;
				tError = null;
			}
		} else {
			if (that.powerstateOnConnect) {
			  tResp = that.powerstateOnConnect;
			  tError = null;
			}
		}
		if (tError) {
			that.log('getPowerState - actual mode - failed: %s', error.message);
			var powerState = false;
			that.log("getPowerState - actual mode - current state: %s", powerState);
			that.state = powerState;
			callback(null, powerState);
		} else {
			var binaryState = parseInt(tResp);
			var powerState = binaryState > 0;
			that.log("getPowerState - actual mode - current state: %s", powerState);
			that.state = powerState;
			callback(null, powerState);
		}
    }.bind(this));
},

identify: function(callback) {
    this.log("Identify requested!");
    callback(); // success
},

processInformation: function( info, informationService, firstTime)
{
	if (!info)
		return;
		
	var equal = true;
	
	var deviceManufacturer = info.manufacturer || "Microsoft";
	if (deviceManufacturer != this.info.manufacturer) {
		equal = false;
		this.info.manufacturer = deviceManufacturer;
	}
	
	var deviceModel = info.model || "Not provided";
	if (deviceModel == "Not provided" && info.model_encrypted) {
		deviceModel = "encrypted";
	}
	if (deviceModel != this.info.model) {
		equal = false;
		this.info.model = deviceModel;
	}
	
	var deviceSerialnumber = info.serialnumber || "Not provided";
	if (deviceSerialnumber == "Not provided" && info.serialnumber_encrypted) {
		deviceSerialnumber = "encrypted";
	}
	if (deviceSerialnumber != this.info.serialnumber) {
		equal = false;
		this.info.serialnumber = deviceSerialnumber;
	}
	
	var deviceName = info.name || "Not provided";
	if (deviceName != this.info.name) {
		equal = false;
		this.info.name = deviceName;
	}
	
	var deviceSoftwareversion = info.softwareversion || "Not provided";
	if (deviceSoftwareversion == "Not provided" && info.softwareversion_encrypted) {
		deviceSoftwareversion = "encrypted";
	}	
	if (deviceSoftwareversion != this.info.softwareversion) {
		equal = false;
		this.info.softwareversion = deviceSoftwareversion;
	}
	
	if( !equal || firstTime) {
		if (informationService) {
			this.log('Setting info: '+ JSON.stringify( this.info));
			informationService
			.setCharacteristic(Characteristic.Manufacturer, deviceManufacturer)
			.setCharacteristic(Characteristic.Model, deviceModel)
			.setCharacteristic(Characteristic.SerialNumber, deviceSerialnumber)
			.setCharacteristic(Characteristic.Name, deviceName)
			.setCharacteristic(Characteristic.SoftwareRevision, deviceSoftwareversion );
		}
	}
},

getServices: function() {
 	var that = this;

	var informationService = new Service.AccessoryInformation();
    this.processInformation( this.info, informationService, true);

	this.switchService = new Service.Switch(this.name);

	this.switchService
		.getCharacteristic(Characteristic.On)
		.on('get', this.getPowerState.bind(this))
		.on('set', this.setPowerState.bind(this));

	return [informationService, this.switchService];
}
};
