const Jimp = require('jimp');
const DymoServices = require('./src/dymo-services');
const imageServices = require('./src/image-services');

/**
 * Try to find the DYMO LabelWriter and print given image (image is sized for a 89mm x 36mm label).
 */

(async function () {

    const dymoServices = new DymoServices();
    const image = await Jimp.read(__dirname + '/demo4.png');

    // Rotate image for label writer.
    image.rotate(-90, true);
    const bitmap = await imageServices.convertImageToBitmap(image);

    await dymoServices.print(bitmap);
    console.log('Successfully printed');
})();
