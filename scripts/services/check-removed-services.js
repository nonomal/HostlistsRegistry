const fs = require('fs/promises');
const path = require('path');
const yaml = require('js-yaml');

const YML_FILE_EXTENSION = '.yml';

const servicesDir = path.resolve(__dirname, '../../services/');

const { logger } = require('../helpers/logger');

const { getServiceFilesContent } = require('./helpers');

/**
 * Gets blocked services data from services file.
 *
 * @param {string} filePath - The path to the file.
 * @returns {Promise<object[]|null>} - Array of blocked services objects.
 * Returns `null` if there's an error during the process.
 * @throws {Error} - If the file cannot be read or parsed.
 */
const getBlockedServicesData = async (filePath) => {
    try {
        const fileContent = await fs.readFile(filePath);
        const serviceObjects = JSON.parse(fileContent);
        return serviceObjects.blocked_services;
    } catch (error) {
        logger.error(`Error while reading file ${filePath}`);
        throw new Error(error);
    }
};

/**
 * Write removed services objects into files.
 *
 * @param {Array<object>} removedObjects - Array of objects that should be written in separate files.
 */
const writeRemovedServices = async (removedObjects) => {
    if (removedObjects.length === 0) {
        return;
    }
    const [removedObject, ...restObjects] = removedObjects;
    await fs.writeFile(
        path.join(`${servicesDir}/${removedObject.id}${YML_FILE_EXTENSION}`),
        yaml.dump(removedObject, { lineWidth: -1 }),
    );
    if (removedObjects.length > 1) {
        await writeRemovedServices(restObjects);
    }
};

// TODO: Do a svg check before finding differences
// After recovering deleted files - merge them together

// TODO: Check for an empty string inside a yml file, write about it in the docs

/**
 * Checks if any of the input service data objects is removed
 * and restores it from the `resultFilePath` file.
 *
 * IMPORTANT: Services which previously were built to the `resultFilePath` file **should not be removed**.
 *
 * During the process service `id`s are checked against normalized YML file names
 * and if there are any differences, the corresponding service YML files are restored.
 *
 * @param {string} resultFilePath - The path to the JSON file containing services data.
 * @param {Array<string>} servicesFileNames - Array of services file names from services folder.
 * @param {string} distFilePath - The path to the YML files containing services data.
 * @returns {Promise<void>} - A promise that resolves when the process is complete.
 * @throws {Error} - If the services data file could not be read or parsed, or if the data is not an array.
 */
const restoreRemovedInputServices = async (resultFilePath, servicesFileNames, distFilePath) => {
    // Get data from services JSON file - array with objects
    const blockedServices = await getBlockedServicesData(resultFilePath);
    // Check if data is array
    if (!Array.isArray(blockedServices)) {
        throw new Error('Blocked services data is not an array');
    }
    const serviceFilesContent = await getServiceFilesContent(distFilePath, servicesFileNames);
    // TODO: get rid of "id" inside the "yml" file and take "id" directly from the "yml" filename
    // to avoid checking when adding new files and exclude the possibility of typos.
    const differences = blockedServices.filter(
        (blockedService) => !serviceFilesContent.find((serviceFile) => serviceFile.id === blockedService.id),
    );
    // If there are missing services, find and rewrite the corresponding objects from blocked services.
    if (differences.length > 0) {
        // TODO: Rewrite writeRemovedServices to not call it recursively
        await writeRemovedServices(differences);
        const removedServices = differences.map((difference) => difference.id);
        logger.warning(`These services have been removed: ${removedServices.join(', ')}, and were restored`);
    }
};

module.exports = {
    restoreRemovedInputServices,
};
