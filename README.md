# homebridge-winpc
Homebridge module for the windows PC (using WOL and Airytec Switch Off)

# Description

This plugin is basically a modification of homebridge-http.
Main difference is:
- Ability to poll every 5 min a WindowsPC
- Ability to sent a WakeOnLan request
- Ability to sent on OFF command to a WindowsPC (provided Airytec Switch Off is running in service mode and active)
- If no answer is received, the power state is set to false
- If any answer is received, the power state is set to true

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-philipswinpc
3. Update your configuration file. See the sample below.

# Configuration

Example accessory config (needs to be added to the homebridge config.json):
 ```
"accessories": [
	{
		"accessory": "WinPC",
		"name": "My Windows PC",
		"http_method": "GET",
		"on_url": "wol://40:39:51:04:99:c0",
		"off_url": "http://10.0.1.23:7878/?action=System.Shutdown",
		"status_url": "http://10.0.1.23:7878/",
		"sendimmediately": "yes",
		"poll_status_interval": "60",
		"username" : "User",
		"password" : "password",
		"powerstateOnError" : "0",
		"powerstateOnConnect" : "1"				
	}
]
 ```
