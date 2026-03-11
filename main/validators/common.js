'use strict';

const { INPUT_CAPS } = require('../config');

/**
 * Layer 1 — Form validation.
 * Validates the raw form data before any AI call.
 *
 * @param {object} formData
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateForm(formData) {
    const errors = [];

    const name = (formData.skillName ?? '').trim();
    if (!name) {
        errors.push('Skill name is required');
    } else if (name.length > INPUT_CAPS.SKILL_NAME) {
        errors.push(`Skill name exceeds ${INPUT_CAPS.SKILL_NAME} characters`);
    }

    const whenToUse = (formData.whenToUse ?? '').trim();
    if (!whenToUse) {
        errors.push('"When to use" is required');
    } else if (whenToUse.length > INPUT_CAPS.WHEN_TO_USE) {
        errors.push(`"When to use" exceeds ${INPUT_CAPS.WHEN_TO_USE} characters`);
    }

    const examples = Array.isArray(formData.exampleRequests) ? formData.exampleRequests : [];
    if (examples.length === 0) {
        errors.push('At least one example request is required');
    } else {
        if (examples.length > INPUT_CAPS.EXAMPLE_MAX) {
            errors.push(`Too many example requests (max ${INPUT_CAPS.EXAMPLE_MAX})`);
        }
        examples.forEach((ex, i) => {
            if (typeof ex === 'string' && ex.length > INPUT_CAPS.EXAMPLE_REQUEST) {
                errors.push(`Example request ${i + 1} exceeds ${INPUT_CAPS.EXAMPLE_REQUEST} characters`);
            }
        });
    }

    const inputs = (formData.expectedInputs ?? '').trim();
    if (inputs.length > INPUT_CAPS.EXPECTED_INPUTS) {
        errors.push(`"Expected inputs" exceeds ${INPUT_CAPS.EXPECTED_INPUTS} characters`);
    }

    const outputs = (formData.expectedOutputs ?? '').trim();
    if (outputs.length > INPUT_CAPS.EXPECTED_OUTPUTS) {
        errors.push(`"Expected outputs" exceeds ${INPUT_CAPS.EXPECTED_OUTPUTS} characters`);
    }

    const constraints = (formData.constraints ?? '').trim();
    if (constraints.length > INPUT_CAPS.CONSTRAINTS) {
        errors.push(`"Constraints" exceeds ${INPUT_CAPS.CONSTRAINTS} characters`);
    }

    const validFrameworks = ['claude', 'chatgpt', 'langchain'];
    if (!validFrameworks.includes(formData.framework)) {
        errors.push('Invalid framework selected');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Layer 2 — JSON intermediate validation.
 * Validates the parsed JSON output from the AI.
 *
 * @param {object} json
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateJson(json) {
    const errors = [];

    if (!json || typeof json !== 'object') {
        return { valid: false, errors: ['Output is not a valid JSON object'] };
    }

    const required = ['name', 'description', 'when_to_use', 'example_requests',
                      'expected_inputs', 'expected_outputs', 'instructions'];

    required.forEach(field => {
        if (!json[field] && json[field] !== 0) {
            errors.push(`Missing required field: ${field}`);
        }
    });

    if (typeof json.when_to_use === 'string' && json.when_to_use.length < 30) {
        errors.push('"when_to_use" must be at least 30 characters');
    }

    if (!Array.isArray(json.instructions) || json.instructions.length < 2) {
        errors.push('"instructions" must contain at least 2 items');
    }

    if (!Array.isArray(json.example_requests) || json.example_requests.length === 0) {
        errors.push('"example_requests" must contain at least 1 item');
    }

    if (!json.metadata || typeof json.metadata !== 'object') {
        errors.push('Missing "metadata" object');
    } else {
        const validFrameworks = ['claude', 'chatgpt', 'langchain'];
        if (!validFrameworks.includes(json.metadata.framework)) {
            errors.push('metadata.framework must be claude, chatgpt, or langchain');
        }
    }

    return { valid: errors.length === 0, errors };
}

module.exports = { validateForm, validateJson };
