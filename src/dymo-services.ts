import net from 'net';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import {execute} from './system-services.js';
import {convertImageToBitmap, rotateImage90DegreesCounterClockwise} from './image-services.js';
// noinspection ES6UnusedImports
import Jimp from 'jimp'; // jshint ignore:line

// Technical specifications Dymo LabelWriter 450.
// https://download.dymo.com/dymo/user-guides/LabelWriter/LWSE450/LWSE450_TechnicalReference.pdf

// Returns the printer to its power-up condition, clears all buffers, and resets all character attributes.
// The ESC @ command is the same as the ESC * command.
const CMD_RESET = Buffer.from([0x1b, '*'.charCodeAt(0)]);
// Feed to Tear Position. This command advances the most recently printed label to a position where it can be torn off.
const CMD_FULL_FORM_FEED = Buffer.from([0x1b, 'E'.charCodeAt(0)]);
// Feed to Print Head. Use this command when printing multiple labels.
const CMD_SHORT_FORM_FEED = Buffer.from([0x1b, 'G'.charCodeAt(0)]);
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

export type PrinterInterface = 'CUPS' | 'NETWORK' | 'WINDOWS' | 'DEVICE';

/**
 * Printer configuration type.
 */
type PrinterConfig = {
    interface?: PrinterInterface;
    host?: string;
    port?: number;
    deviceId?: string;
    device?: string;
};

/**
 * Create the service that connects to configured DYMO LabelWriter.
 * If no configuration is found, try to find the DYMO printer. The first one found is used.
 */
export class DymoServices {

    /**
     * Dymo 99010 labels S0722370 compatible, 89mm x 28mm (3.5inch x 1.1inch, 300dpi).
     */
    static DYMO_LABELS: Record<string, { title: string, imageWidth: number, imageHeight: number }> = {
        '89mm x 28mm': {
            title: '89mm x 28mm',
            imageWidth: 964,
            imageHeight: 300
        },
        '89mm x 36mm': {
            title: '89mm x 36mm',
            imageWidth: 964,
            imageHeight: 390
        },
        '54mm x 25mm': {
            title: '54mm x 25mm',
            imageWidth: 584,
            imageHeight: 270
        }
    };

    private chunks: Buffer[] = [];

    private config: PrinterConfig;

    /**
     * Create a new DymoServices instance.
     *
     * @param config Optional printer configuration
     */
    constructor(config: PrinterConfig) {
        DymoServices.validateConfig(config);
        this.config = config || {};
    }

    /**
     * Print the image.
     * The size of the image should match the size of the label.
     *
     * @param image image object in landscape orientation
     * @param [printCount] Number of prints (defaults to 1)
     * @return Resolves in case of success, rejects otherwise
     */
    print(image: Jimp, printCount: number = 1): Promise<void> {
        return new Promise((resolve, reject) => {
            const rotatedImage = rotateImage90DegreesCounterClockwise(image);
            convertImageToBitmap(rotatedImage)
                .then(bitmapImageBuffer => {
                    this.printBitmap(bitmapImageBuffer, printCount)
                        .then(resolve)
                        .catch(reject);
                })
                .catch(reject);
        });
    }

    /**
     * List all available system printers.
     *
     * @return List of printers or empty list
     */
    listPrinters(): Promise<{ deviceId: string, name: string }[]> {
        if (!IS_WINDOWS && !IS_MACOS && !IS_LINUX) {
            return Promise.reject('Cannot list printers, unsupported operating system: ' + process.platform);
        }
        if (IS_WINDOWS) {
            return DymoServices.listPrintersWindows();
        }
        if (IS_MACOS || IS_LINUX) {
            return DymoServices.listPrintersMacLinux();
        }
        return Promise.resolve([]);
    }

    /**
     * Print the bitmap image buffer.
     * The size of the image should match the size of the label.
     *
     * @param imageBuffer Bitmap image array, lines and rows in portrait orientation
     * @param [printCount] Number of prints
     * @return Resolves in case of success, rejects otherwise
     */
    private printBitmap(imageBuffer: number[][], printCount: number = 1): Promise<void> {
        if (!imageBuffer || imageBuffer.length === 0) {
            throw Error('Empty imageBuffer, cannot print');
        }
        if (printCount <= 0) {
            throw Error(`PrintCount cannot be 0 or a negative number: ${printCount}`);
        }

        // Determine the label dimensions based on the bitmap image buffer.
        const labelLineWidth = imageBuffer[0].length * 8;
        const labelLength = imageBuffer.length;
        this.init(labelLineWidth, labelLength);

        for (let count = 1; count <= printCount; count++) {
            // Convert bitmap array to printer bitmap.
            for (let i = 0; i < imageBuffer.length; i++) {
                this.append(Buffer.from([0x16, ...imageBuffer[i]]));
            }
            if (count === printCount) {
                // End print job.
                this.append(CMD_FULL_FORM_FEED);
            } else {
                this.append(CMD_SHORT_FORM_FEED);
            }
        }

        return this.sendDataToPrinter();
    }

    /**
     * Initialize the buffer and the printer configuration.
     *
     * @param labelLineWidth The width the print head has to print, number of dots (300 dots per inch)
     * @param labelLength Number of lines to print (300 lines per inch)
     */
    private init(labelLineWidth: number, labelLength: number): void {

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
        // E.g., 332 pixels (will be 336 dots, 42 * 8).
        const labelLineWidthBytes = Math.ceil(labelLineWidth / 8);
        this.append(Buffer.from([0x1b, 'D'.charCodeAt(0), labelLineWidthBytes]));

        // At power up, the label length variable is set to a default value of 3058 (in 300ths of an inch units),
        // which corresponds to approximately 10.2 inches. The Set Label Length command sequence (<esc> L nl n2)
        // allows the host software to change the label length variable to accommodate longer lengths.

        // <esc> L nl n2 Set Label Length
        // This command indicates the maximum distance the printer should travel while searching for the
        // top-of-form hole or mark.
        // E.g., 1052 pixels
        const lsb = labelLength & 0xFF;
        const msb = labelLength >> 8 & 0xFF;
        this.append(Buffer.from([0x1b, 'L'.charCodeAt(0), msb, lsb]));

        // <esc> h Text Speed Mode (300x300 dpi)
        // This command instructs the printer to print in 300 x 300 dpi Text Quality mode.
        // This is the default, high-speed printing mode.
        this.append(CMD_TEXT_SPEED_MODE);

        // <esc> e Set Print Density Normal
        // This command sets the strobe time of the printer to 100% of its standard duty cycle.
        this.append(CMD_DENSITY_NORMAL);
    }

    /**
     * Send the data to the printer.
     *
     * @return Resolves in case of success, rejects otherwise
     */
    private sendDataToPrinter(): Promise<void> {
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
                        // Found a Dymo label writer.
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
                DymoServices.sendDataToNetworkPrinter(buffer, this.config.host, this.config.port)
                    .then(resolve)
                    .catch(reject);
                return;
            }
            if (printerInterface === 'CUPS') {
                DymoServices.sendDataToCupsPrinter(buffer, this.config.deviceId as string)
                    .then(resolve)
                    .catch(reject);
                return;
            }
            if (printerInterface === 'WINDOWS') {
                DymoServices.sendDataToWindowsPrinter(buffer, this.config.deviceId as string)
                    .then(resolve)
                    .catch(reject);
                return;
            }
            if (printerInterface === 'DEVICE') {
                DymoServices.sendDataToDevicePrinter(buffer, this.config.device as string)
                    .then(resolve)
                    .catch(reject);
                return;
            }
            throw Error(`Unknown printer interface configured: "${printerInterface}"`);
        });
    }

    /**
     * Clear the print buffer.
     */
    private clear(): void {
        this.chunks.length = 0;
    }

    /**
     * Append the given buffer to the print buffer.
     *
     * @param buff Buffer to add
     */
    private append(buff: Buffer): void {
        if (!Buffer.isBuffer(buff)) {
            throw Error('append() called with type other than Buffer: ' + typeof buff);
        }
        this.chunks.push(buff);
    }

    /**
     * Validate the configuration.
     * Throw error in case of configuration error.
     *
     * @param {PrinterConfig} config Config object
     */
    private static validateConfig(config: PrinterConfig): void {
        const INTERFACES = ['NETWORK', 'CUPS', 'WINDOWS', 'DEVICE'];
        if (config.interface && !INTERFACES.includes(config.interface)) {
            throw Error(`Invalid interface "${config.interface}", valid interfaces are: ${INTERFACES.join(', ')}`);
        }
    }

    /**
     * Send data to network printer.
     *
     * @param buffer Printer data buffer
     * @param host Hostname or IP address (defaults to localhost)
     * @param port Port number (defaults to 9100)
     * @return Resolves in case of success, rejects otherwise
     */
    private static sendDataToNetworkPrinter(buffer: Buffer, host: string = 'localhost', port: number = 9100): Promise<void> {
        return new Promise((resolve, reject) => {
            const networkPrinter = net.connect({host, port, timeout: 30000}, function () {
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
     * Send data to USB (device) printer.
     *
     * @param buffer Printer data buffer
     * @param device Device location /dev/usb/lp0
     * @return Resolves in case of success, rejects otherwise
     */
    private static sendDataToDevicePrinter(buffer: Buffer, device: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!device) {
                throw Error('Cannot write to device, the device name is empty');
            }
            fs.writeFile(device, buffer, {encoding: 'binary'}, err => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    /**
     * Send data to CUPS printer.
     *
     * @param buffer Printer data buffer
     * @param deviceId CUPS device id
     * @return Resolves in case of success, rejects otherwise
     */
    private static sendDataToCupsPrinter(buffer: Buffer, deviceId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!deviceId) {
                throw Error('Cannot print to CUPS printer, deviceId is not configured.');
            }
            execute('lp', ['-d', `${deviceId}`], buffer)
                .then(() => resolve())
                .catch(reject);
        });
    }

    /**
     * Send data to Windows RAW printer.
     *
     * @param {Buffer} buffer Printer data buffer
     * @param {string} deviceId Windows printer device id
     * @return Promise<void> Resolves in case of success, rejects otherwise
     */
    private static sendDataToWindowsPrinter(buffer: Buffer, deviceId: string): Promise<void> {
        // > RawPrint "Name of Your Printer" filename
        // http://www.columbia.edu/~em36/windowsrawprint.html
        // https://github.com/frogmorecs/RawPrint
        return new Promise((resolve, reject) => {
            const tmp = DymoServices.tmpFile('tmp.', '', undefined);
            fs.writeFileSync(tmp, buffer, {encoding: 'binary'});
            // Re-create __dirname for ESM
            const __filename = new URL(import.meta.url).pathname;
            const __dirname = path.dirname(__filename);

            execute(path.join(__dirname, '..', 'windows', 'RawPrint.exe'), [deviceId, tmp], buffer)
                .then(() => {
                    fs.unlinkSync(tmp);
                    resolve();
                })
                .catch(reject);
        });
    }

    /**
     * Get the list of installed printers.
     *
     * @return List of printers or empty list
     */
    private static listPrintersMacLinux(): Promise<{ deviceId: string, name: string }[]> {
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
                    const promises: Promise<string>[] = [];
                    printers.forEach(printer => {
                        // noinspection SpellCheckingInspection
                        promises.push(execute('lpstat', ['-l', '-p', printer.deviceId]));
                    });

                    // Update the name for every printer description found.
                    Promise.allSettled(promises)
                        .then((results) => {
                            results.forEach((result, idx) => {
                                if (result.status === 'fulfilled' && result.value) {
                                    const value = `${result.value}`;
                                    const description = value
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
     * Get the list of installed printers.
     *
     * @return List of printers or empty list
     */
    private static listPrintersWindows(): Promise<{ deviceId: string, name: string }[]> {
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
     * Parse "Get-CimInstance Win32_Printer" output.
     *
     * @param stdout Process output
     * @return List of printers or empty list
     */
    private static stdoutHandler(stdout: string): { deviceId: string, name: string }[] {
        const printers: { deviceId: string, name: string }[] = [];
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
     * Return only the printers with deviceid and name.
     *
     * @param printer
     */
    private static isValidPrinter(printer: string): { isValid: boolean, printerData: { name: string, deviceId: string } } {
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
     * Create tmp filename.
     * https://stackoverflow.com/questions/7055061/nodejs-temporary-file-name
     *
     * @param [prefix]
     * @param [suffix]
     * @param [tmpdir] optional, uses OS temp dir by default
     * @return Absolute filename temp file
     */
    private static tmpFile(prefix: string = 'tmp.', suffix: string = '', tmpdir: string | undefined = undefined): string {
        prefix = (typeof prefix !== 'undefined') ? prefix : 'tmp.';
        suffix = (typeof suffix !== 'undefined') ? suffix : '';
        tmpdir = tmpdir ? tmpdir : os.tmpdir();
        const bytes = crypto.randomBytes(16);
        return path.join(tmpdir as string, prefix + bytes.toString('hex') + suffix);
    }
}

export {createImageWithText, loadImage} from './image-services.js';


