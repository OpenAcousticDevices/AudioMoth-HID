/****************************************************************************
 * audiomoth.js
 * openacousticdevices.info
 * June 2017
 *****************************************************************************/

'use strict';

/*jslint bitwise: true, nomen: true*/

var fs = require('fs');
var path = require('path');
var child_process = require('child_process');

var USB_MSG_TYPE_GET_TIME = 0x01;
var USB_MSG_TYPE_SET_TIME = 0x02;
var USB_MSG_TYPE_GET_UID = 0x03;
var USB_MSG_TYPE_GET_BATTERY = 0x04;
var USB_MSG_TYPE_GET_APP_PACKET = 0x05;
var USB_MSG_TYPE_SET_APP_PACKET = 0x06;
var USB_MSG_TYPE_GET_FIRMWARE_VERSION = 0x07;
var USB_MSG_TYPE_GET_FIRMWARE_DESCRIPTION = 0x08;
var USB_MSG_TYPE_SWITCH_TO_BOOTLOADER = 0x09;

var VENDORID = 0x10c4;
var PRODUCTID = 0x0002;

var FIRMWARE_DESCRIPTION_LENGTH = 32;

var pckg = require('./package.json');
exports.version = pckg.version;

/* Generate command line instruction */

var executable = 'usbhidtool-macOS';

if (process.platform === 'win32') {
    if(process.arch === 'ia32') {
        executable = 'usbhidtool-windows32'
    } else {
        executable = 'usbhidtool-windows';
    }
}

if (process.platform === 'linux') {
    executable = 'usbhidtool-linux';
}

var directory = path.join(__dirname, 'bin');

var unpackedDirectory = directory.replace("app.asar", "app.asar.unpacked");

if (fs.existsSync(directory)) {
    directory = unpackedDirectory;
}

var command = '"' + path.join(directory, executable) + '" ' + VENDORID + ' ' + PRODUCTID + ' ';

/* Exported conversion function */

function convertFourBytesFromBufferToDate(buffer, offset) {

    var unixTimestamp = (buffer[offset] & 0xFF) + ((buffer[offset + 1] & 0xFF) << 8) + ((buffer[offset + 2] & 0xFF) << 16) + ((buffer[offset + 3] & 0xFF) << 24);

    return new Date(unixTimestamp * 1000);

}

function convertDateToFourBytesInBuffer(buffer, offset, date) {

    var unixTimeStamp = date.valueOf() / 1000;

    buffer[offset + 3] = (unixTimeStamp >> 24) & 0xFF;
    buffer[offset + 2] = (unixTimeStamp >> 16) & 0xFF;
    buffer[offset + 1] = (unixTimeStamp >> 8) & 0xFF;
    buffer[offset] = (unixTimeStamp & 0xFF);

}

function convertEightBytesFromBufferToID(buffer, offset) {

    return Array.from(buffer.slice(offset, offset + 8).reverse(), function (byte) {

        return ('0' + (byte & 0xFF).toString(16)).slice(-2);

    }).join('').toUpperCase();

}

function convertOneByteFromBufferToBatteryState(buffer, offset) {

    var batteryState = buffer[offset];

    if (batteryState === 0) {

        return "< 3.6V";

    }

    if (batteryState === 15) {

        return "> 5.0V";

    }

    return (3.5 + batteryState / 10).toFixed(1) + "V";


}

function convertThreeBytesFromBufferToFirmwareVersion(buffer, offset) {

    return [buffer[offset], buffer[offset + 1], buffer[offset + 2]];

}

function convertBytesFromBufferToFirmwareDescription(buffer, offset) {

    var i, descriptionChar, descriptionStr = "";

    for (i = 0; i < FIRMWARE_DESCRIPTION_LENGTH; i++) {

        descriptionChar = String.fromCharCode(buffer[offset + i]);

        if (descriptionChar === "\u0000") {

            break;

        }

        descriptionStr += descriptionChar;

    }

    return descriptionStr;

}

exports.convertFourBytesFromBufferToDate = convertFourBytesFromBufferToDate;

exports.convertDateToFourBytesInBuffer = convertDateToFourBytesInBuffer;

exports.convertEightBytesFromBufferToID = convertEightBytesFromBufferToID;

exports.convertOneByteFromBufferToBatteryState = convertOneByteFromBufferToBatteryState;

exports.convertThreeBytesFromBufferToFirmwareVersion = convertThreeBytesFromBufferToFirmwareVersion;

exports.convertBytesFromBufferToFirmwareDescription = convertBytesFromBufferToFirmwareDescription;

/* Main device functions */

function writeToDevice(buffer, callback) {

    var cmd = command + buffer.join(' ');

    child_process.exec(cmd, function (error, stdout) {

        var i, data, parseError = false;

        if (error) {

            callback(new Error('Error calling usbhidtool'));

        } else {

            if (stdout.slice(0, 4) === 'NULL') {

                callback(null, null);

            } else if (stdout.slice(0, 5) === 'ERROR') {

                callback(new Error('Error reported by usbhidtool - ' + stdout.slice(7, stdout.length - 1)));

            } else {

                data = Array.from(stdout.split(" "), function (byte) {
                    return parseInt(byte, 16);
                });

                for (i = 0; i < data.length; i += 1) {
                    parseError |= isNaN(data[i]);
                }

                if (parseError || data.length !== 64) {

                    callback(new Error("Error parsing response from usbhidtool"));

                } else {

                    callback(null, data);

                }

            }

        }

    });

}

/* Exported module functions */

function makeResponseHandler(messageType, convert, callback) {

    var handler = function (err, data) {
        if (err) {
            callback(err);
        } else if (data === null) {
            callback(null, null);
        } else if (data[0] !== messageType) {
            callback(new Error('Incorrect message type from AudioMoth device'));
        } else {
            callback(null, convert(data, 1));
        }
    };

    return handler;

}

exports.getTime = function (callback) {

    var buffer = [0x00, USB_MSG_TYPE_GET_TIME];

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_GET_TIME, convertFourBytesFromBufferToDate, callback));

};

exports.setTime = function (date, callback) {

    var buffer = [0x00, USB_MSG_TYPE_SET_TIME, 0x00, 0x00, 0x00, 0x00];

    convertDateToFourBytesInBuffer(buffer, 2, date);

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_SET_TIME, convertFourBytesFromBufferToDate, callback));

};

exports.getID = function (callback) {

    var buffer = [0x00, USB_MSG_TYPE_GET_UID];

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_GET_UID, convertEightBytesFromBufferToID, callback));

};

exports.getBatteryState = function (callback) {

    var buffer = [0x00, USB_MSG_TYPE_GET_BATTERY];

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_GET_BATTERY, convertOneByteFromBufferToBatteryState, callback));

};

exports.getFirmwareVersion = function (callback) {

    var buffer = [0x00, USB_MSG_TYPE_GET_FIRMWARE_VERSION];

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_GET_FIRMWARE_VERSION, convertThreeBytesFromBufferToFirmwareVersion, callback));

};

exports.getFirmwareDescription = function (callback) {

    var buffer = [0x00, USB_MSG_TYPE_GET_FIRMWARE_DESCRIPTION];

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_GET_FIRMWARE_DESCRIPTION, convertBytesFromBufferToFirmwareDescription, callback));

};

exports.getPacket = function (callback) {

    var buffer = [0x00, USB_MSG_TYPE_GET_APP_PACKET];

    writeToDevice(buffer, callback);

};

exports.setPacket = function (packet, callback) {

    var i, buffer, packet_length;

    packet_length = Math.min(packet.length, 62);

    buffer = [0x00, USB_MSG_TYPE_SET_APP_PACKET];

    for (i = 0; i < packet_length; i += 1) {
        buffer.push(packet[i]);
    }

    writeToDevice(buffer, callback);

};

exports.switchToBootloader = function (callback) {

    var buffer = [0x00, USB_MSG_TYPE_SWITCH_TO_BOOTLOADER];

    writeToDevice(buffer, callback);

}
