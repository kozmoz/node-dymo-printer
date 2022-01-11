const DymoServices = require('./src/dymo-serices');
const imageServices = require('./src/image-services');

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

    const {imageWidth, imageHeight} = dymoServices.DYMO_LABELS[1];
    const image = await imageServices.createImageWithText(imageWidth, imageHeight, 50, 128, 'Hello World!');

    image.write(__dirname + '/image2.png');

    // Rotate image for label writer.
    image.rotate(-90, true);
    const bitmap = await imageServices.convertImageToBitmap(image);

    await dymoServices.print(bitmap);
    console.log('Successfully printed');
})();

