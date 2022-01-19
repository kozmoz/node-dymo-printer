const {DymoServices, createImageWithText} = require('node-dymo-printer');

/**
 * Try to find the DYMO LabelWriter and print "Hello World!" on a 89mm x 36mm label.
 */

(async function () {

    // Create landscape image with the dimensions of the label and with the text "Hello World!".
    const {imageWidth, imageHeight} = DymoServices.DYMO_LABELS[1];
    const image = await createImageWithText(imageWidth, imageHeight, 50, 128, 'Hello World!');

    // For debugging purposes, write the image to disk.
    image.write(__dirname + '/image1.png');

    // Print it, just one label.
    await new DymoServices().print(image, 1);
    console.log('Successfully printed');

})();
