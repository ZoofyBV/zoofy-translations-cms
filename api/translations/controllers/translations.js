'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const { Translate } = require('@google-cloud/translate').v2;
const CsvParser = require("json2csv").Parser;
const projectId = 'zoofy-api-1534349586972';
const csv = require('csv-parser');
const fs = require('fs');

module.exports = {

    async find(ctx) {
        let entities;
        entities = await strapi.services.translations.find({
            ...(ctx.query),
            _limit: -1
        });
        return entities.map(entity => {
            const { translation_key, translation_value, locale, localizations } = entity;
            return {
                translation_key,
                translation_value,
                locale,
                localizations
            };
        });
    },

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

                // Check if Exists
                const existings = await strapi.query("translations").find({
                    translation_key: translation.translation_key,
                    tags: translation.tags
                });
        
                const exist = existings.filter((t) => t.locale === translation.locale)[0];
                const locals = existings.filter(l => l.locale !== translation.locale).map(lan => lan.id);
                
                if (exist !== undefined && exist !== null) {
                    updated++;
                    console.log("Updated: " + updated);
                    await strapi.services.translations.update({ id: exist.id }, {
                        ...translation,
                        status: true,
                        localizations: locals
                    });
                } else {
                    created++;
                    console.log("Created: " + created);
                    await strapi.services.translations.create({
                        ...translation,
                        status: true,
                        localizations: locals
                    });
                }
            });
        }, 100);

        ctx.send({
            ok: true,
            created,
            updated,
        });
    },

    async export(ctx) {

        const { request: { body } } = ctx;
        const translations = await strapi.query("translations").find({
            locale: body.locale,
            _limit: -1,
            _sort: 'tags:asc'
        });

        let translationExports = [];
        translations.forEach((obj) => {
            const { translation_key, translation_value, locale, tags, status } = obj;
            translationExports.push({ translation_key, translation_value, locale, tags, status });
        });

        const csvFields = ['translation_key', 'translation_value', 'tags', 'locale', 'status'];

        const csvParser = new CsvParser({ csvFields });
        const csvData = csvParser.parse(translationExports);

        ctx.set('Content-Type', 'text/csv');
        ctx.set('Content-Disposition', `attachment; filename=translation-${body.locale}.csv`);
        ctx.send(csvData);
    }
};

