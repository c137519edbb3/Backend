const { Anomaly, Camera } = require('../models');
const DAYS_OF_WEEK = require('../constants/days');
const { Op } = require('sequelize');

const addAnomaly = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const {
            title, 
            description, 
            criticality, 
            modelName, 
            cameraIds,
            startTime,
            endTime,
            daysOfWeek
        } = req.body;

        // Validate required fields
        if (!title || !description || !modelName || !cameraIds || !startTime || !endTime || !daysOfWeek) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate cameraIds is array
        if (!Array.isArray(cameraIds) || cameraIds.length === 0) {
            return res.status(400).json({ error: 'cameraIds must be a non-empty array' });
        }

        // Validate daysOfWeek is an array
        if (!Array.isArray(daysOfWeek)) {
            return res.status(400).json({ error: 'daysOfWeek must be an array' });
        }

        // Validate days values
        if (!daysOfWeek.every(day => DAYS_OF_WEEK.includes(day))) {
            return res.status(400).json({ error: 'Invalid day values' });
        }

        const cameras = await Camera.findAll({
            where: {
                cameraId: {
                    [Op.in]: cameraIds
                },
                organizationId,
            },
        });

        if (cameras.length !== cameraIds.length) {
            return res.status(404).json({ error: 'One or more cameras not found or access denied' });
        }

        // Create anomaly with all fields
        const anomaly = await Anomaly.create({
            title,
            description,
            criticality,
            modelName,
            organizationId,
            startTime,
            endTime,
            daysOfWeek
        });

        // Associate cameras
        await anomaly.setCameras(cameras);

        // Fetch complete anomaly with cameras
        const createdAnomaly = await Anomaly.findByPk(anomaly.anomalyId, {
            include: [{ model: Camera }]
        });

        return res.status(201).json(createdAnomaly);
    } catch (error) {
        console.error('Error adding anomaly:', error);
        return res.status(500).json({ error: 'Failed to add anomaly' });
    }
};

const getAllAnomalies = async (req, res) => {
    const organizationId = req.user.organizationId;

    try {
        const anomalies = await Anomaly.findAll({
            where: { organizationId },
            include: [
                { 
                    model: Camera,
                    attributes: ['cameraId', 'location', 'ipAddress', 'cameraType'] 
                }
            ]
        });

        res.status(200).json(anomalies);
    } catch (error) {
        console.error('[ERROR] Fetching anomalies:', error);
        res.status(500).json({ message: 'Failed to fetch anomalies', error: error.message });
    }
};

const updateAnomaly = async (req, res) => {
    const { anomalyId } = req.params;
    const { title, description, criticality, modelName, status, cameraIds } = req.body;
    const organizationId = req.user.organizationId;

    try {
        const anomaly = await Anomaly.findOne({
            where: { anomalyId, organizationId }
        });

        if (!anomaly) {
            return res.status(404).json({ message: 'Anomaly not found or does not belong to your organization' });
        }

        // If cameraIds is being updated, verify camera ownership
        if (cameraIds) {
            const cameras = await Camera.findAll({
                where: {
                    cameraId: { [Op.in]: cameraIds },
                    organizationId
                }
            });

            if (cameras.length !== cameraIds.length) {
                return res.status(404).json({ message: 'One or more cameras not found or access denied' });
            }

            // Update camera associations
            await anomaly.setCameras(cameras);
        }

        // Update other fields
        anomaly.title = title ?? anomaly.title;
        anomaly.description = description ?? anomaly.description;
        anomaly.criticality = criticality ?? anomaly.criticality;
        anomaly.modelName = modelName ?? anomaly.modelName;
        anomaly.status = status ?? anomaly.status;

        await anomaly.save();

        // Fetch updated anomaly with cameras
        const updatedAnomaly = await Anomaly.findByPk(anomalyId, {
            include: [{ model: Camera }]
        });

        res.status(200).json({
            message: 'Anomaly updated successfully',
            anomaly: updatedAnomaly
        });
    } catch (error) {
        console.error('[ERROR] Updating anomaly:', error);
        res.status(500).json({ message: 'Failed to update anomaly', error: error.message });
    }
};

const deleteAnomaly = async (req, res) => {
    const { anomalyId } = req.params;
    const organizationId = req.user.organizationId;

    try {
        const anomaly = await Anomaly.findOne({
            where: { anomalyId, organizationId }
        });

        if (!anomaly) {
            return res.status(404).json({ message: 'Anomaly not found or does not belong to your organization' });
        }

        // Remove camera associations and delete anomaly
        await anomaly.setCameras([]);
        await anomaly.destroy();

        res.status(200).json({ message: 'Anomaly deleted successfully' });
    } catch (error) {
        console.error('[ERROR] Deleting anomaly:', error);
        res.status(500).json({ message: 'Failed to delete anomaly', error: error.message });
    }
};

module.exports = { addAnomaly, getAllAnomalies, updateAnomaly, deleteAnomaly };