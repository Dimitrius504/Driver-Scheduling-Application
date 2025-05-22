import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function loginAndGetTokens() {
    const url = `${process.env.BASE_URL}/oauth/login`;
    const requestData = {
        API_Key: process.env.API_KEY,
        API_Value: process.env.API_VALUE
    };
    const config = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    console.log("Making request to:", url);
    console.log("Request data:", JSON.stringify(requestData));
    console.log("Headers:", JSON.stringify(config.headers));

    try {
        const response = await axios.post(url, requestData, config);
        console.log("Response Data:", response.data);
        const accessToken = response.data.Access_Token.token;
        const refreshToken = response.data.Refresh_Token.token;
        console.log("Access Token:", accessToken);
        console.log("Refresh Token:", refreshToken);
        return { accessToken, refreshToken };
    } catch (error) {
        console.error("Failed to log in and get tokens:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        return null;
    }
}

export async function refreshAuthToken(refreshToken) {
    if (!refreshToken) {
        console.error('No refresh token provided');
        return null;
    }

    try {
        const response = await axios.get(`${process.env.BASE_URL}/oauth/refresh`, {
            headers: {
                'Authorization': `VRS ${refreshToken}`
            }
        });

        if (response.data && response.data.Access_Token) {
            console.log("New Access Token:", response.data.Access_Token.token);
            return response.data.Access_Token.token;
        } else {
            console.error('Refresh token response missing expected data:', JSON.stringify(response.data, null, 2));
            return null;
        }
    } catch (error) {
        console.error('Error refreshing token:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        return null;
    }
}


async function fetchData(accessToken, endpoint) {
    try {
        const url = `${process.env.BASE_URL}/${endpoint}`;
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        console.log(`${endpoint} Data:`, response.data);
        return response.data;
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        return null;
    }
}
async function testToken(accessToken) {
    try {
        const response = await axios.get(`${process.env.BASE_URL}/tasks`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        console.log("Token test successful, data:", response.data);
        return true;
    } catch (error) {
        console.error("Token test failed:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        return false;
    }
}

async function main() {
    let { accessToken, refreshToken } = await loginAndGetTokens();
    if (!accessToken || !await testToken(accessToken)) {
        console.log('Token validation failed, refreshing token...');
        accessToken = await refreshAuthToken(refreshToken);
        if (!accessToken || !await testToken(accessToken)) {
            console.log('Failed to refresh token, stopping execution.');
            return;
        }
    }

    const tasks = await fetchData(accessToken, 'tasks');
    console.log('Tasks:', tasks);
}

main();