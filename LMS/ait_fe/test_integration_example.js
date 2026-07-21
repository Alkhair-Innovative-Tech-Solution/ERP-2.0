// Next.js Integration Example for Test Service

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8003';

/**
 * Example 1: Check if a test is required for a specific course/specialization.
 * Usually called on the Registration form or Course details page.
 */
export const checkTestRequirement = async (courseId, specializationId) => {
    try {
        const response = await fetch(`${API_URL}/api/tests/check-requirement/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                course_id: courseId,
                specialization_id: specializationId
            })
        });

        if (!response.ok) throw new Error('Failed to check test requirement');
        return await response.json();
    } catch (error) {
        console.error('Error checking test requirement:', error);
        return { test_required: false, error: error.message };
    }
};

/**
 * Example 2: Start the test session and fetch questions.
 * Requires the JWT token obtained from GenerateTestLink (Step 2).
 */
export const startTest = async (token) => {
    try {
        const response = await fetch(`${API_URL}/api/tests/start/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            // Token expired or invalid
            window.location.href = '/login?error=session_expired';
            return null;
        }

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to start test');
        }

        return await response.json();
    } catch (error) {
        console.error('Error starting test:', error);
        throw error;
    }
};

/**
 * Example 3: Submit the test answers.
 * @param {string} token - JWT Test Token
 * @param {number} attemptId - The attempt ID from startTest response
 * @param {Object} answers - Format: { "question_id": "A", ... }
 */
export const submitTest = async (token, attemptId, answers) => {
    try {
        const response = await fetch(`${API_URL}/api/tests/submit/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                attempt_id: attemptId,
                answers
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to submit test');
        }

        return await response.json();
    } catch (error) {
        console.error('Error submitting test:', error);
        throw error;
    }
};

/**
 * Example 4: Fetch Test Results.
 */
export const getTestResult = async (token, attemptId) => {
    try {
        const response = await fetch(`${API_URL}/api/tests/result/${attemptId}/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch test results');
        return await response.json();
    } catch (error) {
        console.error('Error fetching test results:', error);
        throw error;
    }
};
