/****************************************************************************
 * audiomoth.js
 * openacousticdevices.info
 * June 2017
 *****************************************************************************/

'use strict';

/*jslint bitwise: true, nomen: true*/

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const USB_MSG_TYPE_GET_TIME = 0x01;
const USB_MSG_TYPE_SET_TIME = 0x02;
const USB_MSG_TYPE_GET_UID = 0x03;
const USB_MSG_TYPE_GET_BATTERY = 0x04;
const USB_MSG_TYPE_GET_APP_PACKET = 0x05;
const USB_MSG_TYPE_SET_APP_PACKET = 0x06;
const USB_MSG_TYPE_GET_FIRMWARE_VERSION = 0x07;
const USB_MSG_TYPE_GET_FIRMWARE_DESCRIPTION = 0x08;
const USB_MSG_TYPE_QUERY_SERIAL_BOOTLOADER = 0x09;
const USB_MSG_TYPE_ENTER_SERIAL_BOOTLOADER = 0x0A;
const USB_MSG_TYPE_QUERY_USBHID_BOOTLOADER = 0x0B
const USB_MSG_TYPE_ENTER_USBHID_BOOTLOADER = 0x0C

const VENDORID = 0x10c4;
const PRODUCTID = 0x0002;

const AUDIOMOTH_PACKETSIZE = 62;
const FULL_USB_HID_PACKETSIZE = 64;

const FIRMWARE_DESCRIPTION_LENGTH = 32;

const pckg = require('./package.json');
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

const command = '"' + path.join(directory, executable) + '" ' + VENDORID + ' ' + PRODUCTID + ' ';

/* Exported conversion function */

function convertFourBytesFromBufferToDate(buffer, offset) {

    const unixTimestamp = (buffer[offset] & 0xFF) + ((buffer[offset + 1] & 0xFF) << 8) + ((buffer[offset + 2] & 0xFF) << 16) + ((buffer[offset + 3] & 0xFF) << 24);

    return new Date(unixTimestamp * 1000);

}

function convertDateToFourBytesInBuffer(buffer, offset, date) {

    const unixTimeStamp = Math.round(date.valueOf() / 1000);

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

    const batteryState = buffer[offset];

    if (batteryState === 0) {

        return "< 3.6V";

    }

    if (batteryState === 15) {

        return "> 4.9V";

    }

    return (3.5 + batteryState / 10).toFixed(1) + "V";


}

function convertThreeBytesFromBufferToFirmwareVersion(buffer, offset) {

    return [buffer[offset], buffer[offset + 1], buffer[offset + 2]];

}

function convertBytesFromBufferToFirmwareDescription(buffer, offset) {

    let descriptionStr = "";

    for (let i = 0; i < FIRMWARE_DESCRIPTION_LENGTH; i++) {

        const descriptionChar = String.fromCharCode(buffer[offset + i]);

        if (descriptionChar === "\u0000") {

            break;

        }

        descriptionStr += descriptionChar;

    }

    return descriptionStr;

}

function convertOneByteFromBufferToBoolean(buffer, offset) {

    return (buffer[offset] === 0x01);

}

exports.convertFourBytesFromBufferToDate = convertFourBytesFromBufferToDate;

exports.convertDateToFourBytesInBuffer = convertDateToFourBytesInBuffer;

exports.convertEightBytesFromBufferToID = convertEightBytesFromBufferToID;

exports.convertOneByteFromBufferToBatteryState = convertOneByteFromBufferToBatteryState;

exports.convertThreeBytesFromBufferToFirmwareVersion = convertThreeBytesFromBufferToFirmwareVersion;

exports.convertBytesFromBufferToFirmwareDescription = convertBytesFromBufferToFirmwareDescription;

exports.convertOneByteFromBufferToBoolean = convertOneByteFromBufferToBoolean;

/* Main device functions */

function writeToDevice(buffer, callback) {

    const cmd = command + buffer.join(' ');

    child_process.exec(cmd, function (error, stdout) {

        if (error) {

            callback('Error calling usbhidtool');

        } else {

            if (stdout.slice(0, 4) === 'NULL') {

                callback(null, null);

            } else if (stdout.slice(0, 5) === 'ERROR') {

                callback('Error reported by usbhidtool - ' + stdout.slice(7, stdout.length - 1));

            } else {

                let parseError = false;

                const data = Array.from(stdout.split(" "), function (byte) {
                    return parseInt(byte, 16);
                });

                for (let i = 0; i < data.length; i += 1) {
                    parseError |= isNaN(data[i]);
                }

                if (parseError || data.length !== 64) {

                    callback('Error parsing response from usbhidtool');

                } else {

                    callback(null, data);

                }

            }

        }

    });

}

/* Exported module functions */

function makeResponseHandler(messageType, convert, callback) {

    const handler = function (err, data) {
        if (err) {
            callback(err);
        } else if (data === null) {
            callback(null, null);
        } else if (data[0] !== messageType) {
            callback('Incorrect message type from AudioMoth device');
        } else {
            callback(null, convert(data, 1));
        }
    };

    return handler;

}

exports.getTime = function (callback) {

    const buffer = [0x00, USB_MSG_TYPE_GET_TIME];

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_GET_TIME, convertFourBytesFromBufferToDate, callback));

};

exports.setTime = function (date, callback) {

    const buffer = [0x00, USB_MSG_TYPE_SET_TIME, 0x00, 0x00, 0x00, 0x00];

    convertDateToFourBytesInBuffer(buffer, 2, date);

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_SET_TIME, convertFourBytesFromBufferToDate, callback));

};

exports.getID = function (callback) {

    const buffer = [0x00, USB_MSG_TYPE_GET_UID];

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_GET_UID, convertEightBytesFromBufferToID, callback));

};

exports.getBatteryState = function (callback) {

    const buffer = [0x00, USB_MSG_TYPE_GET_BATTERY];

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_GET_BATTERY, convertOneByteFromBufferToBatteryState, callback));

};

exports.getFirmwareVersion = function (callback) {

    const buffer = [0x00, USB_MSG_TYPE_GET_FIRMWARE_VERSION];

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_GET_FIRMWARE_VERSION, convertThreeBytesFromBufferToFirmwareVersion, callback));

};

exports.getFirmwareDescription = function (callback) {

    const buffer = [0x00, USB_MSG_TYPE_GET_FIRMWARE_DESCRIPTION];

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_GET_FIRMWARE_DESCRIPTION, convertBytesFromBufferToFirmwareDescription, callback));

};

exports.getPacket = function (callback) {

    const buffer = [0x00, USB_MSG_TYPE_GET_APP_PACKET];

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_GET_APP_PACKET, (buffer) => buffer, callback));

};

exports.setPacket = function (packet, callback) {

    const packet_length = Math.min(packet.length, 62);

    const buffer = [0x00, USB_MSG_TYPE_SET_APP_PACKET];

    for (let i = 0; i < packet_length; i += 1) {
        buffer.push(packet[i]);
    }

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_SET_APP_PACKET, (buffer) => buffer, callback));

};

exports.queryBootloader = function (callback) {

    const buffer = [0x00, USB_MSG_TYPE_QUERY_SERIAL_BOOTLOADER];

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_QUERY_SERIAL_BOOTLOADER, convertOneByteFromBufferToBoolean, callback));

};

exports.switchToBootloader = function (callback) {

    const buffer = [0x00, USB_MSG_TYPE_ENTER_SERIAL_BOOTLOADER];

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_ENTER_SERIAL_BOOTLOADER, convertOneByteFromBufferToBoolean, callback));

};

exports.queryUSBHIDBootloader = function (callback) {     
    
    const buffer = [0x00, USB_MSG_TYPE_QUERY_USBHID_BOOTLOADER];

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_QUERY_USBHID_BOOTLOADER, convertOneByteFromBufferToBoolean, callback));

};

function makeBufferForUSBHIDBootloader(packet) {

    const packet_length = Math.min(packet.length, AUDIOMOTH_PACKETSIZE);

    const buffer = [0x00, USB_MSG_TYPE_ENTER_USBHID_BOOTLOADER];

    for (let i = 0; i < packet_length; i += 1) buffer.push(packet[i] & 0xFF);

    while (buffer.length < FULL_USB_HID_PACKETSIZE) buffer.push(0x00);

    return buffer;

}

exports.sendPacketToUSBHIDBootloader = function (packet, callback) { 

    const buffer = makeBufferForUSBHIDBootloader(packet);

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_ENTER_USBHID_BOOTLOADER, (buffer) => buffer, callback));

};

exports.sendMultiplePacketsToUSBHIDBootloader = function (packets, callback) { 

    const buffers = [];

    for (let i = 0; i < packets.length; i += 1) {

        buffers.push(makeBufferForUSBHIDBootloader(packets[i]));

    }

    let buffer = [];

    for (let i = 0; i < buffers.length; i += 1) {

        buffer = buffer.concat(buffers[i]);
    
    }

    writeToDevice(buffer, makeResponseHandler(USB_MSG_TYPE_ENTER_USBHID_BOOTLOADER, (buffer) => buffer, callback));

};
