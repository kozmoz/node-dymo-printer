const {DymoServices, createImageWithText} = require('node-dymo-printer');

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

    // Create landscape image with the dimensions of the label 89mm x 36mm and with the text "Hello World!".
    const {imageWidth, imageHeight} = DymoServices.DYMO_LABELS['89mm x 36mm'];
    const image = await createImageWithText(imageWidth, imageHeight, 50, 128, 'Hello World!');

    // For debugging purposes, write the image to disk.
    image.write(__dirname + '/image2.png');

    // Print the label.
    try {
        const dymoServices = new DymoServices(config);
        await dymoServices.print(image, 1);
        console.log('Successfully printed');
    } catch (e) {
        console.error('Error while trying to print the image: ', e);
    }

})();
