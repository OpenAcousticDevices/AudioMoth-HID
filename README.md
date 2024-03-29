# AudioMoth-HID #
A Node.js library for interfacing with AudioMoth devices over USB. The module is hosted on npm under the name 'audiomoth-hid'.

### Usage ###

The module should be imported as normal:

```javascript
var audiomoth = require('audiomoth-hid');
```

Asynchronous function calls then provide access to its functionality. To obtain the time used by the onboard clock:

```javascript
audiomoth.getTime(function (err, date) {
	console.log("Time/date on device: " + date);
});
```

---
Set the onboard clock with a `Date()` object:

```javascript
audiomoth.setTime(new Date(), function (err, date) {
	console.log("New time/date of device: " + date);
});
```

---
Get AudioMoth's unique 16 digit ID number:

```javascript
audiomoth.getID(function (err, id) {
	console.log("Device unique ID: " + id);
});
```

---
Get string containing the current battery state of attached AudioMoth:

```javascript
audiomoth.getBatteryState(function (err, batteryState) {
	console.log("Attached device's current battery state: " + batteryState);
});
```

---
Send application packet of max length 62 (message limit of 64 bytes, 2 bytes required for message identification) :

```javascript
var packet = new Uint8Array(62);
```

Insert date object into packet

```javascript
var date = new Date();
writeLittleEndianBytes(packet, 0, 4, date.valueOf() / 1000);
```

Insert 32 bit number into packet

```javascript
var i = 10000;
writeLittleEndianBytes(packet, 4, 4, i);
```

Insert arbitrary 8 bit values into packet:

```javascript
packet[8] = 5;
packet[9] = 0x00;
packet[10] = 0x01;
```

```javascript
audiomoth.setPacket(packet, function (err, packet) {
	console.log("Data returned from application specific packet: " + packet);
});
```

---
Get application packet set in AudioMoth firmware:

```javascript
audiomoth.getPacket(function (err, packet) {
	console.log("Data returned from application specific packet: " + packet);
});
```

---
Get firmware version set in AudioMoth firmware:

```javascript
audiomoth.getFirmwareVersion(function (err, firmwareVersion) {
    console.log("Attached device's firmware version: " + firmwareVersion);
});
```

---

Get firmware description set in AudioMoth firmware:

```javascript
audiomoth.getFirmwareDescription(function (err, firmwareDescription) {
    console.log("Attached device's firmware description: " + firmwareDescription);
});
```

---

Query AudioMoth to see if it supports switching to bootloader with a USB command:

```javascript
audiomoth.queryBootloader(function (err, supportsBootloaderSwitch) {
    if (supportsBootloaderSwitch) {
        console.log("Attached device's firmware supports bootloader switching over HID.");
    } else {
        console.error("Attached device's firmware does not support bootloader switching over HID.");
    }
});
```

Switch AudioMoth to bootloader for flashing:

```javascript
audiomoth.switchToBootloader(function (err, switchedToBootloader) {
    if (switchedToBootloader) {
        console.log("Attached device will switch to bootloader.");
    } else {
        console.error("Attached device's firmware does not support bootloader switching over HID.");
    }
});
```

---

Query AudioMoth to see if it supports the USB HID bootloader:

```javascript
audiomoth.queryUSBHIDBootloader(function (err, supportsUSBHIDBootloader) {
    if (supportsUSBHIDBootloader) {
        console.log("Attached device's firmware supports the USB HID bootloader.");
    } else {
        console.error("Attached device's firmware does not support the USB HID bootloader.");
    }
});
```

Send single USB HID packet:

```javascript
audiomoth.sendPacketToUSBHIDBootloader(function (err, packet) {
	console.log("Data returned from USB HID bootloader: " + packet);
});
```

Send multiple USB HID packets:

```javascript
audiomoth.sendMultiplePacketsToUSBHIDBootloader(function (err, packet) {
	console.log("Data returned from USB HID bootloader: " + packet);
});
```

### Linux ###

The module will work as is on macOS and Windows. However, Linux prevents USB HID devices from being writable by default. This can be fixed by navigating to /lib/udev/rules.d/ and adding a file called 99-audiomoth.rules. The content of this file should by:

```
SUBSYSTEM=="usb", ATTRS{idVendor}=="10c4", ATTRS{idProduct}=="0002", MODE="0666"
```

### Updating module ###

Execution permissions are lost when binaries are committed to npm repository from a Windows machine. To avoid this, all updates must be published from MacOS.

### Example applications using this module ###
* [AudioMoth Configuration App](https://github.com/OpenAcousticDevices/AudioMoth-Configuration-App)
* [AudioMoth Time App](https://github.com/OpenAcousticDevices/AudioMoth-Time-App)

### License ###

Copyright 2017 [Open Acoustic Devices](http://www.openacousticdevices.info/).

[MIT license](http://www.openacousticdevices.info/license).
