import net from 'net';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import {execute} from './system-services.js';

/* jshint ignore:start */
// We're using modules, so __dirname is not defined bij Node.
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
/* jshint ignore:end */

// Technical specifications Dymo LabelWriter 450.
// https://download.dymo.com/dymo/user-guides/LabelWriter/LWSE450/LWSE450_TechnicalReference.pdf

const CMD_RESET = Buffer.from([0x1b, '*'.charCodeAt(0)]);
// This command advances the most recently printed label to a position where it can be torn off.
const CMD_FORM_FEED = Buffer.from([0x1b, 'E'.charCodeAt(0)]);
const CMD_TEXT_SPEED_MODE = Buffer.from([0x1b, 'h'.charCodeAt(0)]);
const CMD_DENSITY_NORMAL = Buffer.from([0x1b, 'e'.charCodeAt(0)]);
const CMD_NO_DOT_TAB = Buffer.from([0x1b, 'B'.charCodeAt(0), 0]);

// To reset the printer after a synchronization error or to recover from an unknown state, the host computer needs
// to send at least 85 continuous <esc> characters to the printer. This 85-character sequence is required in case the
// printer is in a mode in which it expects a raster line of data. The 85 <esc> characters exceed the default number
// of bytes required for a full line of raster data (84); this ensures that the printer looks for an ESC command.
// https://download.dymo.com/dymo/technical-data-sheets/LW%20450%20Series%20Technical%20Reference.pdf
const CMD_START_ESC = Buffer.from(new Array(313).fill(0x1b));

const IS_WINDOWS = process.platform === 'win32';
const IS_MACOS = process.platform === 'darwin';
const IS_LINUX = process.platform === 'linux';

/**
 * Create service that connects to configured DYMO LabelWriter.
 * If no configuration found, try to find the DYMO printer. First one found is used.
 */
export class DymoServices {

    // JSHint doesn't understand [static] class fields (yet).

    /* jshint ignore:start */

    /**
     * Dymo 99010 labels S0722370 compatible , 89mm x 28mm (3.5inch x 1.1inch, 300dpi).
     * @type {{title: string, imageWidth: number, imageHeight: number}[]}
     */
    static DYMO_LABELS = [
        {
            title: '89mm x 28mm',
            imageWidth: 1050,
            imageHeight: 330
        },
        {
            title: '89mm x 36mm',
            imageWidth: 1050,
            imageHeight: 426
        }
    ];

    /**
     * @private
     * @type {{interface:string,host?:string,port?:number,deviceId?:string}}
     */
    config = {};
    /**
     * @private
     * @type {Buffer[]}
     */
    chunks = [];

    /* jshint ignore:end */

    /**
     * Create new DymoServices instance.
     *
     * @param {{interface:string,host?:string,port?:number,deviceId?:string}} config Optional printer configuration
     */
    constructor(config = undefined) {
        if (config) {
            Object.assign(this.config, config);
            DymoServices.validateConfig(this.config);
        }
    }

    /**
     * Print the bitmap image buffer.
     * The size of the image should match the size of the label.
     *
     * @param {number[][]} imageBuffer Bitmap image array, lines and rows
     * @return Promise<void> Resolves in case of success, rejects otherwise
     */
    print(imageBuffer) {
        if (!imageBuffer || imageBuffer.length === 0) {
            throw Error('Empty imageBuffer, cannot print');
        }

        // Determine the label dimensions based on the bitmap image buffer.
        const labelLineWidth = imageBuffer[0].length * 8;
        const labelLength = imageBuffer.length;
        this.init(labelLineWidth, labelLength);

        // Convert bitmap array to printer bitmap.
        for (let i = 0; i < imageBuffer.length; i++) {
            this.append(Buffer.from([0x16, ...imageBuffer[i]]));
        }

        // End label feed.
        this.append(CMD_FORM_FEED);

        return this.sendDataToPrinter();
    }

    /**
     * List all available system printers.
     *
     * @return {Promise<{deviceId:string,name:string}[]>} List of printers or empty list
     */
    listPrinters() {
        if (!IS_WINDOWS && !IS_MACOS && !IS_LINUX) {
            return Promise.reject('Cannot list printers, unsupported operating system: ' + process.platform);
        }
        if (IS_WINDOWS) {
            return DymoServices.listPrintersWindows();
        }
        if (IS_MACOS || IS_LINUX) {
            return DymoServices.listPrintersMacLinux();
        }
    }

    /**
     * @private
     *
     * Initialize the buffer and the printer configuration.
     *
     * @param {number} labelLineWidth The width the print head has to print, number of dots (300 dots per inch)
     * @param {number} labelLength Number of lines to print (300 lines per inch)
     */
    init(labelLineWidth, labelLength) {

        this.clear();

        // To reset the printer after a synchronization error or to recover from an unknown state, the host computer
        // needs to send at least 85 continuous <esc> characters to the printer.
        this.append(CMD_START_ESC);
        this.append(CMD_RESET);

        // <esc> B n Set Dot Tab
        // This command shifts the starting dot position on the print head towards the right
        this.append(CMD_NO_DOT_TAB);

        // <esc> D n Set Bytes per Line
        // This command reduces the number of bytes sent for each line.
        // E.g. 332 pixels (will be 336 dots, 42 * 8).
        const labelLineWidthBytes = Math.ceil(labelLineWidth / 8);
        this.append(Buffer.from([0x1b, 'D'.charCodeAt(0), labelLineWidthBytes]));

        // At power up, the label length variable is set to a default value of 3058 (in 300ths of an inch units),
        // which corresponds to approximately 10.2 inches. The Set Label Length command sequence (<esc> L nl n2)
        // allows the host software to change the label length variable to accommodate longer lengths.

        // <esc> L nl n2 Set Label Length
        // This command indicates the maximum distance the printer should travel while searching for the
        // top-of-form hole or mark.
        // E.g. 1052 pixels
        const lsb = labelLength & 0xFF;
        const msb = labelLength >> 8 & 0xFF;
        this.append(Buffer.from([0x1b, 'L'.charCodeAt(0), msb, lsb]));

        // <esc> h Text Speed Mode (300x300 dpi)
        // This command instructs the printer to print in 300 x 300 dpi Text Quality mode.
        // This is the default, high speed printing mode.
        this.append(CMD_TEXT_SPEED_MODE);

        // <esc> e Set Print Density Normal
        // This command sets the strobe time of the printer to 100% of its standard duty cycle.
        this.append(CMD_DENSITY_NORMAL);
    }

    /**
     * @private
     *
     * Send the data to the printer.
     *
     * @return Promise<void> Resolves in case of success, rejects otherwise
     */
    sendDataToPrinter() {
        return new Promise((resolve, reject) => {
            const buffer = Buffer.concat(this.chunks);
            const printerInterface = this.config.interface;

            if (!printerInterface) {
                // Try to guess what printer to use.
                this.listPrinters()
                    .then(printers => {
                        // Use the first match for "LabelWriter 450".
                        const printer = printers.find(printer => {
                            // noinspection SpellCheckingInspection
                            return printer.name && printer.name.toLowerCase().indexOf('dymo') !== -1;
                        });
                        if (!printer) {
                            reject('Cannot find Dymo LabelWriter. Try to configure manually.');
                            return;
                        }
                        // Found a Dymo label writer, retry.
                        this.config.interface = IS_WINDOWS ? 'WINDOWS' : 'CUPS';
                        this.config.deviceId = printer.deviceId;
                        this.sendDataToPrinter()
                            .then(resolve)
                            .catch(reject);
                    })
                    .catch(reject);
                return;
            }

            if (printerInterface === 'NETWORK') {
                DymoServices.sendDataToNetworkPrinter(this.config, buffer)
                    .then(resolve)
                    .catch(reject);
                return;
            }
            if (printerInterface === 'CUPS') {
                DymoServices.sendDataToCupsPrinter(this.config, buffer)
                    .then(resolve)
                    .catch(reject);
                return;
            }
            if (printerInterface === 'WINDOWS') {
                DymoServices.sendDataToWindowsPrinter(this.config, buffer)
                    .then(resolve)
                    .catch(reject);
                return;
            }
            throw Error(`Unknown printer interface configured: "${printerInterface}"`);
        });
    }

    /**
     * @private
     * Clear the print buffer.
     */
    clear() {
        this.chunks.length = 0;
    }

    /**
     * @private
     * Append given buffer to the print buffer.
     *
     * @param {Buffer} buff Buffer to add
     */
    append(buff) {
        if (!Buffer.isBuffer(buff)) {
            throw Error('append() called with type other than Buffer: ' + typeof buff);
        }
        this.chunks.push(buff);
    }

    /**
     * @private
     *
     * Validate the configuration.
     * Throw error in case of configuration error.
     *
     * @param {{interface:string,host?:string,port?:number,deviceId?:string}} config Config object
     */
    static validateConfig(config) {
        const INTERFACES = ['NETWORK', 'CUPS', 'WINDOWS'];
        if (config.interface && INTERFACES.indexOf(config.interface) === -1) {
            throw Error(`Invalid interface "${config.interface}", valid interfaces are: ${INTERFACES.join(', ')}`);
        }
    }

    /**
     * @private
     *
     * Send data to network printer.
     *
     * @param {{interface:string, host?:string, port?:number,deviceId?:string}} config Configuration
     * @param {Buffer} buffer Printer data buffer
     * @return Promise<void> Resolves in case of success, rejects otherwise
     */
    static sendDataToNetworkPrinter(config, buffer) {
        return new Promise((resolve, reject) => {
            const networkPrinter = net.connect({
                host: config.host || 'localhost',
                port: config.port || 9100,
                timeout: 30000
            }, function () {
                networkPrinter.write(buffer, 'binary', () => {
                    networkPrinter.end();
                    resolve();
                });
            });

            networkPrinter.on('error', err => {
                networkPrinter.end();
                reject(err);
            });

            networkPrinter.on('timeout', () => {
                networkPrinter.end();
                reject('Timeout connecting to printer.');
            });
        });
    }

    /**
     * @private
     *
     * Send data to CUPS printer.
     *
     * @param {{interface:string, host?:string, port?:number, deviceId?:string}} config Configuration
     * @param {Buffer} buffer Printer data buffer
     * @return Promise<void> Resolves in case of success, rejects otherwise
     */
    static sendDataToCupsPrinter(config, buffer) {
        return new Promise((resolve, reject) => {
            execute('lp', ['-d', `${config.deviceId}`], buffer)
                .then(resolve)
                .catch(reject);
        });
    }

    /**
     * @private
     *
     * Send data to Windows RAW printer.
     *
     * @param {{interface:string, host?:string, port?:number, deviceId?:string}} config Configuration
     * @param {Buffer} buffer Printer data buffer
     * @return Promise<void> Resolves in case of success, rejects otherwise
     */
    static sendDataToWindowsPrinter(config, buffer) {
        // > RawPrint "Name of Your Printer" filename
        // http://www.columbia.edu/~em36/windowsrawprint.html
        // https://github.com/frogmorecs/RawPrint
        return new Promise((resolve, reject) => {
            const tmp = DymoServices.tmpFile();
            fs.writeFileSync(tmp, buffer, {encoding: 'binary'});
            execute(path.join(__dirname, '..', 'windows', 'RawPrint.exe'), [config.deviceId, tmp], buffer)
                .then(() => {
                    fs.unlinkSync(tmp);
                    resolve();
                })
                .catch(reject);
        });
    }

    /**
     * @private
     *
     * Get list of installed printers.
     *
     * @return {Promise<{deviceId:string,name:string}[]>} List of printers or empty list
     */
    static listPrintersMacLinux() {
        return new Promise((resolve, reject) => {
            // noinspection SpellCheckingInspection
            execute('lpstat', ['-e'])
                .then(stdout => {
                    const printers = stdout
                        .split('\n')
                        .filter(row => !!row.trim())
                        .map(row => {
                            return {
                                deviceId: row.trim(),
                                name: row.replace(/_+/g, ' ').trim(),
                            };
                        });

                    // Try to find the name ("Description:") of every printer found.
                    /** @type {Promise[]} */
                    const promises = [];
                    printers.forEach(printer => {
                        // noinspection SpellCheckingInspection
                        promises.push(execute('lpstat', ['-l', '-p', printer.deviceId]));
                    });

                    // Update the name for every printer description found.
                    Promise.allSettled(promises)
                        .then((results) => {
                            results.forEach((result, idx) => {
                                if (result.status === 'fulfilled' && result.value) {
                                    const description = result.value
                                        .split('\n')
                                        .filter(line => /^description:/gi.test(line.trim()))
                                        .map(line => line.replace(/description:/gi, '').trim())
                                        .find(line => !!line);
                                    if (description) {
                                        printers[idx].name = description;
                                    }
                                }
                            });
                            resolve(printers);
                        });
                })
                .catch(reject);
        });
    }

    /**
     * @private
     *
     * Get list of installed printers.
     *
     * @return {Promise<{deviceId:string,name:string}[]>} List of printers or empty list
     */
    static listPrintersWindows() {
        return new Promise((resolve, reject) => {
            execute('Powershell.exe', [
                '-Command',
                'Get-CimInstance Win32_Printer -Property DeviceID,Name'
            ])
                .then(stdout => {
                    resolve(DymoServices.stdoutHandler(stdout));
                })
                .catch(reject);
        });
    }

    /**
     * @private
     *
     * Parse "Get-CimInstance Win32_Printer" output.
     *
     * @param stdout Process output
     * @return {{deviceId:string,name:string}[]} List of printers or empty list
     */
    static stdoutHandler(stdout) {
        const printers = [];
        stdout
            .split(/(\r?\n){2,}/)
            .map((printer) => printer.trim())
            .filter((printer) => !!printer)
            .forEach((printer) => {
                const {isValid, printerData} = DymoServices.isValidPrinter(printer);
                if (!isValid) {
                    return;
                }
                printers.push(printerData);
            });

        return printers;
    }

    /**
     * @private
     *
     * Return only the printers with deviceid and name.
     *
     * @param printer
     * @return {{isValid: boolean, printerData: {name: string, deviceId: string}}}
     */
    static isValidPrinter(printer) {
        const printerData = {
            deviceId: '',
            name: '',
        };

        const isValid = printer.split(/\r?\n/).some((line) => {
            const [label, value] = line.split(':').map((el) => el.trim());
            const lowerLabel = label.toLowerCase();
            // noinspection SpellCheckingInspection
            if (lowerLabel === 'deviceid') printerData.deviceId = value;
            if (lowerLabel === 'name') printerData.name = value;
            return !!(printerData.deviceId && printerData.name);
        });

        return {
            isValid,
            printerData,
        };
    }

    /**
     * @private
     *
     * Create tmp filename.
     * https://stackoverflow.com/questions/7055061/nodejs-temporary-file-name
     *
     * @param {string} [prefix]
     * @param {string} [suffix]
     * @param {string} [tmpdir] optional, uses OS temp dir by default
     * @return {string} Absolute filename temp file
     */
    static tmpFile(prefix, suffix, tmpdir) {
        prefix = (typeof prefix !== 'undefined') ? prefix : 'tmp.';
        suffix = (typeof suffix !== 'undefined') ? suffix : '';
        tmpdir = tmpdir ? tmpdir : os.tmpdir();
        return path.join(tmpdir, prefix + crypto.randomBytes(16).toString('hex') + suffix);
    }
}

// Make those imageService functions available via this file.
export {createImageWithText, convertImageToBitmap} from './image-services.js';


