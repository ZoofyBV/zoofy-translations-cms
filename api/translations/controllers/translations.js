'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const { Translate } = require('@google-cloud/translate').v2;
const projectId = 'crafty-sound-323308';
const csv = require('csv-parser');
const fs = require('fs');

module.exports = {

    async translate(ctx) {
        const translate = new Translate({ projectId });
        const { text, target } = ctx.request.body;
        const [translation] = await translate.translate(text, target);
        console.log(`Text: ${text}`);
        console.log(`Translation: ${translation}`);
    },

    async import(ctx) {

        const { request: { body, files: { files } = {} } } = ctx;
        let translations = [];

        let updated = 0;
        let created = 0;

        if (files.type == 'text/csv') {
            fs.createReadStream(files.path)
                .pipe(csv())
                .on('data', (data) => translations.push(data))
                .on('end', () => {
                    console.log('Done!');

                });
        }

        setTimeout(() => {
            translations.forEach(async (translation) => {
                const existing = await strapi.query("translations").findOne({ 
                        translation_key: translation.translation_key, 
                        locale: translation.locale });

                if (existing !== undefined && existing !== null) {
                    updated++;
                    console.log("Updated: " + updated);
                    await strapi.services.translations.update({ id: existing.id }, {
                        ...translation, 
                        status: true
                       });
                } else {
                    created++;
                    console.log("Created: " + created);
                    await strapi.services.translations.create({
                        ...translation, 
                        status: true
                    });
                }
            });
        }, 100);

        ctx.send({
            ok: true,
            created,
            updated,
        });

    }
};

