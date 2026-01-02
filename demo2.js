import {createImageWithText, DymoServices} from 'node-dymo-printer';

/**
 * Configure the network printer manually and print "Hello World!" on a 89mm x 36mm label.
 */

// Printer connection details.
const config = {
    interface: 'NETWORK',
    host: '192.168.1.145',
    port: 9100
};

// Create a landscape image with the dimensions of the label 89mm x 36mm and with the text "Hello World".
const {imageWidth, imageHeight} = DymoServices.DYMO_LABELS['54mm x 25mm'];
const image = await createImageWithText(imageWidth, imageHeight, 50, 128, 'Hello World!');

// For debugging purposes, write the image to disk.
image.write('./image2.png');

try {
    // Print the label.
    await new DymoServices(config).print(image, 1);
    console.log('Successfully printed');
} catch (e) {
    console.error(e);
}


