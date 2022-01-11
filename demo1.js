const DymoServices = require('./src/dymo-serices');
const imageServices = require('./src/image-services');

/**
 * Try to find the DYMO LabelWriter and print "Hello World!" on a 89mm x 36mm label.
 */

(async function () {

    const dymoServices = new DymoServices();

    const {imageWidth, imageHeight} = dymoServices.DYMO_LABELS[1];
    const image = await imageServices.createImageWithText(imageWidth, imageHeight, 50, 128, 'Hello World!');

    image.write(__dirname + '/image1.png');

    // Rotate image for label writer.
    image.rotate(-90, true);
    const bitmap = await imageServices.convertImageToBitmap(image);

    await dymoServices.print(bitmap);
    console.log('Successfully printed');
})();
