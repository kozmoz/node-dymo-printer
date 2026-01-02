import {DymoServices, createImageWithText} from './dist/dymo-services.js';

/**
 * Try to find the DYMO LabelWriter and print "Hello World".
 */

(async function () {

    // Create a landscape image with the dimensions of the label and with the text "Hello World".
    const {imageWidth, imageHeight} = DymoServices.DYMO_LABELS['54mm x 25mm'];
    const image = await createImageWithText(imageWidth, imageHeight, 50, 128, 'Hello World!');

    // For debugging purposes, write the image to disk.
    image.write('./image1.png');

    // Print it, just one label.
    try {
        await new DymoServices().print(image, 1);
        console.log('Successfully printed');
    } catch (e) {
        console.error('Error while trying to print the image: ', e);
    }

})();
