import {HorizontalAlign, Jimp, JimpInstance, loadFont, measureText, VerticalAlign} from 'jimp';
import {SANS_10_BLACK, SANS_128_BLACK, SANS_12_BLACK, SANS_14_BLACK, SANS_16_BLACK, SANS_32_BLACK, SANS_64_BLACK, SANS_8_BLACK} from "jimp/fonts";

/**
 * Set the bit of the given value.
 * https://lucasfcosta.com/2018/12/25/bitwise-operations.html
 *
 * @param value Value to change
 * @param bitIndex Bit to set to 1
 * @return Result
 */
function setBit(value: number, bitIndex: number): number {
    const bitMask = 1 << bitIndex;
    return value | bitMask;
}

// noinspection JSUnusedLocalSymbols
/**
 * Simulate newlines by replacing them with just enough spaces to force a break at the location of the newline.
 *
 * @param font Jimp font
 * @param maxTextWidth The max width of the text block
 * @param text The text with newlines
 * @return The resulting text with newlines removed and spaces added
 */
function simulateNewlines(font: any, maxTextWidth: number, text: string): string {

    if (!font) {
        throw Error('simulateNewlines() - font is required');
    }
    if (!Number.isInteger(maxTextWidth)) {
        throw Error('simulateNewlines() - maxTextWidth needs to be a positive number');
    }
    const minimalWidth = measureText(font, '||');
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
        let width = measureText(font, texts[i] + '|');
        while (width < maxTextWidth) {
            texts[i] += ' ';
            width = measureText(font, texts[i] + '|');
        }
    }
    return texts.join('');
}

/**
 * Create the image for the label.
 *
 * @param imageWidth Image width in pixels
 * @param imageHeight Image height in pixels
 * @param horizontalMargin Margin left and right for the text (it's not added to the total image width)
 * @param fontSize Size of the font; Between 8 and 128 pixels
 * @param text Text to print
 */
export async function createImageWithText(imageWidth: number, imageHeight: number, horizontalMargin: number, fontSize: 8 | 10 | 12 | 14 | 16 | 32 | 64 | 128, text: string): Promise<JimpInstance> {

    // Test parameters.
    if (!imageWidth || imageWidth < 0 || !Number.isInteger(imageWidth)) {
        throw Error(`createImageWithText(): imageWidth should be a positive integer: "${imageWidth}"`);
    }
    if (!imageHeight || imageHeight < 0 || !Number.isInteger(imageHeight)) {
        throw Error(`createImageWithText(): imageHeight should be a positive integer: : "${imageHeight}"`);
    }
    if (horizontalMargin < 0 || !Number.isInteger(horizontalMargin)) {
        throw Error(`createImageWithText(): horizontalMargin should be positive integer or 0: "${horizontalMargin}"`);
    }
    if (!text) {
        throw Error(`createImageWithText(): Empty text, nothing to print.`);
    }

    let fontFile: string;
    switch (fontSize) {
        case 8:
            fontFile = SANS_8_BLACK;
            break;
        case 10:
            fontFile = SANS_10_BLACK;
            break;
        case 12:
            fontFile = SANS_12_BLACK;
            break;
        case 14:
            fontFile = SANS_14_BLACK;
            break;
        case 16:
            fontFile = SANS_16_BLACK;
            break;
        case 32:
            fontFile = SANS_32_BLACK;
            break;
        case 64:
            fontFile = SANS_64_BLACK;
            break;
        case 128:
            fontFile = SANS_128_BLACK;
            break;
        default:
            throw Error(`createImageWithText(): Invalid font size: "${fontSize}"`);
    }
    const font = await loadFont(fontFile);

    const image = new Jimp({width: imageWidth, height: imageHeight, color: 0xffffffff});
    const maxTextWidth = image.bitmap.width - 2 * horizontalMargin;
    const maxTextHeight = image.bitmap.height;
    const textObj = {
        // Simulate newlines.
        // text: simulateNewlines(font, maxTextWidth, text),
        text,
        alignmentX: HorizontalAlign.LEFT,
        alignmentY: VerticalAlign.MIDDLE
    };
    // Print text.
    image.print({
        font,
        x: horizontalMargin,
        y: 0,
        text: textObj,
        maxWidth: maxTextWidth,
        maxHeight: maxTextHeight
    });

    return image;
}

/**
 * Create a bitmap from the Jimp image-object.
 *
 * @param image Jimp image object (image will be manipulated)
 * @return Bitmap buffer array
 */
export async function convertImageToBitmap(image: JimpInstance): Promise<number[][]> {

    if (!image) {
        throw Error('convertImageToBitmapBuffer(): parameter image is required');
    }
    if (!image.scan) {
        throw Error('convertImageToBitmapBuffer(): parameter image should be of type Jimp image');
    }

    // Convert to black- and white image.
    const bwImage = image
        .opaque()
        .greyscale()
        .brightness(0.3)
        .dither()
        .posterize(2);

    const bitmap: number[][] = [];

    // Helper method is available to scan a region of the bitmap:
    // image.scan(x, y, w, h, f); // scan a given region of the bitmap and call the function f on every pixel
    bwImage.scan(0, 0, bwImage.bitmap.width, bwImage.bitmap.height, (x, y, idx) => {
        // x, y is the position of this pixel on the image.
        // idx is the position start position of this rgba tuple in the bitmap Buffer.

        // Add a new empty row.
        if (bitmap.length <= y) {
            const bytes = Math.ceil(bwImage.bitmap.width / 8);
            bitmap.push(new Array(bytes).fill(0));
        }

        // The image is posterized, so we only have to check the "red" channel.
        const black = (bwImage.bitmap.data[idx] < 50);
        if (black) {
            const row = bitmap[y];
            // Set the right bit.
            // Pixels from left to right, but bits from right to left. Translate this.
            const byteIndex = Math.floor(x / 8);
            // Set bits from left to right.
            row[byteIndex] = setBit(row[byteIndex], [7, 6, 5, 4, 3, 2, 1, 0][x % 8]);
        }
    });
    return bitmap;
}

/**
 * Convenient function to load image.
 *
 * @param arg Path, URL, Buffer or Jimp image
 * @return Promise which resolves with image when successfully loaded, rejects with error otherwise
 */
export async function loadImage(arg: string | Buffer | JimpInstance): Promise<JimpInstance> {
    if (arg && (arg as any)['readInt8']) {
        return (await Jimp.fromBuffer(arg as Buffer)) as JimpInstance;
    }
    if (typeof arg === 'string') {
        return (await Jimp.read(arg)) as JimpInstance;
    }
    return arg as JimpInstance;
}

/**
 * Because Jimp contains a bug rotating the image, we have to crop the image after rotation to keep the same width and height.
 *
 * @param image Image to rotate
 * @return New rotated image
 */
export function rotateImage90DegreesCounterClockwise(image: JimpInstance): JimpInstance {

    if (!image) {
        throw Error('rotateImage90DegreesCounterClockwise(): parameter image is required');
    }
    if (!image.rotate) {
        throw Error('rotateImage90DegreesCounterClockwise(): parameter image should be of type Jimp image');
    }

    // Rotate the image for the label writer. Needs to be in portrait mode for printing.
    const clonedImage = image.clone();
    const previousWidth = clonedImage.bitmap.width;
    const previousHeight = clonedImage.bitmap.height;

    clonedImage.rotate({deg: -90, mode: true});

    // Fix for: when rotated, the width and height of pic gets larger #808
    // https://github.com/oliver-moran/jimp/issues/808
    if (clonedImage.bitmap.width !== previousHeight || clonedImage.bitmap.height !== previousWidth) {
        // Crop to the original size.
        clonedImage.crop({x: 1, y: 0, w: previousHeight, h: previousWidth});
    }
    return clonedImage;
}

