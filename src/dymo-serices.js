const spawn = require('child_process').spawn;
const fs = require('fs');
const net = require("net");

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


module.exports = function (cfg) {

    const config = {};
    const chunks = [];

    Object.assign(config, cfg);
    validateConfig(config);

    /**
     * Initialize the buffer and the printer configuration.
     *
     * @param {number} labelLineWidth The width the print head has to print, number of dots (300 dots per inch)
     * @param {number} labelLength Number of lines to print (300 lines per inch)
     */
    const init = (labelLineWidth, labelLength) => {

        clear();

        // To reset the printer after a synchronization error or to recover from an unknown state, the host computer
        // needs to send at least 85 continuous <esc> characters to the printer.
        append(CMD_START_ESC);
        append(CMD_RESET);

        // <esc> B n Set Dot Tab
        // This command shifts the starting dot position on the print head towards the right
        append(CMD_NO_DOT_TAB);

        // <esc> D n Set Bytes per Line
        // This command reduces the number of bytes sent for each line.
        // E.g. 332 pixels (will be 336 dots, 42 * 8).
        const labelLineWidthBytes = labelLineWidth.ceil(labelLineWidth / 8)
        append(Buffer.from([0x1b, 'D'.charCodeAt(0), labelLineWidthBytes]));

        // At power up, the label length variable is set to a default value of 3058 (in 300ths of an inch units),
        // which corresponds to approximately 10.2 inches. The Set Label Length command sequence (<esc> L nl n2)
        // allows the host software to change the label length variable to accommodate longer lengths.

        // <esc> L nl n2 Set Label Length
        // This command indicates the maximum distance the printer should travel while searching for the
        // top-of-form hole or mark.
        // E.g. 1052 pixels
        const lsb = labelLength & 0xFF;
        const msb = labelLength >> 8 & 0xFF;
        append(Buffer.from([0x1b, 'L'.charCodeAt(0), msb, lsb]));

        // <esc> h Text Speed Mode (300x300 dpi)
        // This command instructs the printer to print in 300 x 300 dpi Text Quality mode.
        // This is the default, high speed printing mode.
        append(CMD_TEXT_SPEED_MODE);

        // <esc> e Set Print Density Normal
        // This command sets the strobe time of the printer to 100% of its standard duty cycle.
        append(CMD_DENSITY_NORMAL);
    };

    /**
     * Send the data to the printer.
     *
     * @return Promise<void> Resolves in case of success, rejects otherwise
     */
    const sendDataToPrinter = () => {
        const buffer = Buffer.concat(chunks);
        if (config.interface === 'NETWORK') {
            return sendDataToNetworkPrinter(config, buffer);
        }
        if (config.interface === 'CUPS') {
            return sendDataToCupsPrinter(config, buffer);
        }

    };

    /**
     * Clear the print buffer.
     */
    const clear = () => {
        chunks.length = 0;
    };

    /**
     * Append given buffer to the print buffer.
     *
     * @param {Buffer} buff Buffer to add
     */
    const append = (buff) => {
        if (!Buffer.isBuffer(buff)) {
            throw Error('append() called with type other than Buffer: ' + typeof buff);
        }
        chunks.push(buff);
    };

    /**
     * Print the bitmap image buffer.
     * The size of the image should match the size of the label.
     *
     * @param {number[][]} imageBuffer Bitmap image array, lines and rows
     * @return Promise<void> Resolves in case of success, rejects otherwise
     */
    const print = (imageBuffer) => {
        if (!imageBuffer || imageBuffer.length === 0) {
            throw Error('Empty imageBuffer, cannot print');
        }

        // Determine the label dimensions based on the bitmap image buffer.
        const labelLineWidth = imageBuffer[0].length * 8;
        const labelLength = imageBuffer.length;
        init(labelLineWidth, labelLength);

        // Convert bitmap array to printer bitmap.
        for (let i = 0; i < imageBuffer.length; i++) {
            append(Buffer.from([0x16, ...imageBuffer[i]]));
        }

        // End label feed.
        append(CMD_FORM_FEED);

        return sendDataToPrinter();
    }

    /**
     * Public functions.
     */
    return {
        print
    };
}

/**
 * Validate the configuration.
 * Throw error in case of configuration error.
 *
 * @param {{interface:string,host?:string,port?:number,name?:string}} config Config object
 */
function validateConfig(config) {
    const INTERFACES = ['NETWORK', 'CUPS', 'DEVICE', 'AUTO'];
    if (INTERFACES.indexOf(config.interface) === -1) {
        throw Error(`Invalid interface "${config.interface}", valid interfaces are: ${INTERFACES.join(', ')}`);
    }
}

/**
 * Send data to network printer.
 *
 * @param {{interface:string, host?:string, port?:number}} config Configuration
 * @param {Buffer} buffer Printer data buffer
 * @return Promise<void> Resolves in case of success, rejects otherwise
 */
function sendDataToNetworkPrinter(config, buffer) {
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
 * Send data to CUPS printer.
 *
 * @param {{interface:string, host?:string, port?:number, name?:string}} config Configuration
 * @param {Buffer} buffer Printer data buffer
 * @return Promise<void> Resolves in case of success, rejects otherwise
 */
function sendDataToCupsPrinter(config, buffer) {
    return new Promise((resolve, reject) => {
        // Node’s Child Processes
        // https://jscomplete.com/learn/node-beyond-basics/child-processes
        const proces = spawn('lp', ['-d', `${config.name}`]);
        proces.on("exit", function (code, signal) {
            if (code === 0) {
                resolve();
                return;
            }
            reject("child process exited with " + `code ${code} and signal ${signal}`);
        });
        proces.on("error", function (code, signal) {
            reject("child process error with " + `code ${code} and signal ${signal}`);
        });
        proces.stdin.on("error", function (error) {
            reject("stdin process error: " + error);
        });

        proces.stdout.on("data", data => {
            console.info(`child stdout: ${data}`);
        });

        proces.stderr.on("data", data => {
            reject(`stderr error: \n${data}`);
        });

        proces.stdin.setEncoding('binary');
        proces.stdin.write(buffer);
        proces.stdin.end();
    });
}
