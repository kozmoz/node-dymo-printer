const Jimp = require('jimp');

// Supported font sizes (in pixels).
const FONT_SIZES = [8, 10, 12, 14, 16, 32, 64, 128];

/**
 * Create the image for the label.
 *
 * @param imageWidth Image width in pixels
 * @param imageHeight Image height in pixels
 * @param horizontalMargin Margin left and right for the text (it's not added to the total image width)
 * @param {number} fontSize Size of the font; 8,10,12,14,16,32,64 or 128 pixels.
 * @param {string} text Text to print
 * @return {Promise<Jimp>}
 */
exports.createImage = (imageWidth, imageHeight, horizontalMargin, fontSize, text) => {
    return new Promise((resolve, reject) => {

        // Test parameters.
        if (!imageWidth || imageWidth < 0 || !Number.isInteger(imageWidth)) {
            throw Error(`createImage(): imageWidth should be a positive integer: "${imageWidth}"`);
        }
        if (!imageHeight || imageHeight < 0 || !Number.isInteger(imageHeight)) {
            throw Error(`createImage(): imageHeight should be a positive integer: : "${imageHeight}"`);
        }
        if (horizontalMargin < 0 || !Number.isInteger(horizontalMargin)) {
            throw Error(`createImage(): horizontalMargin should be positive integer or 0: "${horizontalMargin}"`);
        }
        if (!fontSize || FONT_SIZES.indexOf(fontSize) === -1) {
            throw Error(`createImage(): invalid font size: "${fontSize}"`);
        }
        if (!text) {
            throw Error(`createImage(): Empty text, nothing to print.`);
        }
        if (typeof text !== 'string') {
            throw Error(`createImage(): Text should be of type string.`);
        }

        new Jimp(imageWidth, imageHeight, '#FFFFFF', (err, image) => {
            if (err) {
                reject(err);
                return;
            }

            Jimp.loadFont(Jimp[`FONT_SANS_${fontSize}_BLACK`])
                .then(font => {

                    const maxTextWidth = image.bitmap.width - 2 * horizontalMargin;
                    const maxTextHeight = image.bitmap.height;
                    const textObj = {
                        // Simulate newlines.
                        text: simulateNewlines(font, maxTextWidth, text),
                        alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
                        alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
                    };
                    // Print text and convert to black- and white image.
                    // noinspection JSUnresolvedFunction
                    image
                        .print(font, horizontalMargin, 0, textObj, maxTextWidth, maxTextHeight)
                        .opaque()
                        .greyscale()
                        .brightness(.3)
                        .dither565()
                        .posterize(2);
                    resolve(image);
                })
                .catch(reject);
        });
    });
}

/**
 * Create bitmap image buffer from Jimp image object.
 *
 * @param {Jimp} image Jimp image object
 * @return {Promise<number[][]>} Bitmap buffer array
 */
exports.convertImageToBitmapBuffer = (image) => {
    return new Promise((resolve) => {

        if (!image) {
            throw Error('convertImageToBitmapBuffer(): parameter image is required');
        }
        if (!image.scan) {
            throw TypeError('convertImageToBitmapBuffer(): parameter image should be of type Jimp image');
        }

        const bitmap = [];

        // Helper method is available to scan a region of the bitmap:
        // image.scan(x, y, w, h, f); // scan a given region of the bitmap and call the function f on every pixel
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
            // x, y is the position of this pixel on the image
            // idx is the position start position of this rgba tuple in the bitmap Buffer
            // this is the image


            // Add new empty row.
            if (bitmap.length <= y) {
                const bytes = Math.ceil(image.bitmap.width / 8);
                bitmap.push(new Array(bytes).fill(0))
            }

            // The image is posterized, so we only have to check the "red" channel.
            const black = (image.bitmap.data[idx] < 50);
            if (black) {
                const row = bitmap[y];
                // Set the right bit.
                // Pixels from left to right, but bits from right to left. Translate this.
                const byteIndex = Math.floor(x / 8);
                row[byteIndex] = setBit(row[byteIndex], [7, 6, 5, 4, 3, 2, 1, 0][x % 8]);
            }
        }, function () {
            resolve(bitmap);
        });
    });
}

/**
 * Set the bit of given value.
 * https://lucasfcosta.com/2018/12/25/bitwise-operations.html
 *
 * @param {number} value Value to change
 * @param {number} bitIndex Bit to set to 1
 * @return {number} Result
 */
function setBit(value, bitIndex) {
    const bitMask = 1 << bitIndex;
    return value | bitMask;
}

/**
 * Simulate newlines by replacing them with just enough spaces to force a break at the location of the newline.
 *
 * @param {any} font Jimp font
 * @param {number} maxTextWidth The max width of the text block
 * @param {string} text The text with newlines
 * @return {string} The resulting text with newlines removed and spaces added
 */
function simulateNewlines(font, maxTextWidth, text) {

    if (!font) {
        throw Error('simulateNewlines() - font is required');
    }
    if (!Number.isInteger(maxTextWidth)) {
        throw Error('simulateNewlines() - maxTextWidth needs to be a positive number');
    }
    const minimalWidth = Jimp.measureText(font, '||');
    if (maxTextWidth < minimalWidth) {
        throw Error(`simulateNewlines() - maxTextWidth needs to be greater than ${minimalWidth} but is ${maxTextWidth}`);
    }

    const texts = (text || '').split('\n');
    // No newlines in the text, nothing to do.
    if (texts.length <= 1) {
        return text;
    }
    // It contains newlines, now simulate the newline by adding spaces to force a break.
    for (let i = 0; i < texts.length - 1; i++) {
        let width = Jimp.measureText(font, texts[i] + '|');
        while (width < maxTextWidth) {
            texts[i] += ' ';
            width = Jimp.measureText(font, texts[i] + '|');
        }
    }
    return texts.join('');
}

