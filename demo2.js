const {DymoServices, createImageWithText, convertImageToBitmap} = require('node-dymo-printer');

/**
 * Configure the network printer manually and print "Hello World!" on a 89mm x 36mm label.
 */

(async function () {

    // Printer connection details.
    const config = {
        interface: 'NETWORK',
        host: '192.168.1.229',
        port: 9100
    };
    const dymoServices = new DymoServices(config);

    // Create landscape image with the dimensions of the label and with the text "Hello World!".
    const {imageWidth, imageHeight} = DymoServices.DYMO_LABELS[1];
    const image = await createImageWithText(imageWidth, imageHeight, 50, 128, 'Hello World!');

    // For debugging purposes, write the image to disk.
    image.write(__dirname + '/image2.png');

    // Rotate image for label writer. Needs to be in portrait mode for printing.
    image.rotate(-90, true);
    const bitmap = await convertImageToBitmap(image);

    await dymoServices.print(bitmap);
    console.log('Successfully printed');

})();

