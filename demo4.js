import {DymoServices, loadImage} from 'node-dymo-printer';

/**
 * Try to find the DYMO LabelWriter and print the given image (image is sized for an 89mm x 36mm label).
 */

try {
    // Load image to be printed.
    const image = await loadImage('./demo4.png');
    await new DymoServices().print(image, 1);
    console.log('Successfully printed');
} catch (e) {
    console.error(e);
}
